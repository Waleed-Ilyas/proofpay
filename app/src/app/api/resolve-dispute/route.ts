import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import idl from "@/idl/proofpay.json";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function loadValidatorKeypair(): Keypair {
    // In a deployed environment the keypair comes from an env var, since the
    // gitignored JSON file isn't part of the build. Locally we fall back to
    // reading the file, so development behaviour is unchanged.
    const fromEnv = process.env.VALIDATOR_SECRET_KEY;
    if (fromEnv) {
        return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fromEnv)));
    }

    const keypairPath = path.join(process.cwd(), "validator-authority.json");
    const raw = fs.readFileSync(keypairPath, "utf-8");
    const secretKey = Uint8Array.from(JSON.parse(raw));
    return Keypair.fromSecretKey(secretKey);
}

function makeNodeWallet(keypair: Keypair) {
    return {
        publicKey: keypair.publicKey,
        async signTransaction(tx: any) {
            tx.partialSign(keypair);
            return tx;
        },
        async signAllTransactions(txs: any[]) {
            txs.forEach((tx) => tx.partialSign(keypair));
            return txs;
        },
    };
}

// Downloads a file and converts it into an OpenAI-style image_url content
// part (a base64 data URI), the format Groq's chat completions API expects.
// Returns null (rather than throwing) if the fetch fails, since a broken
// attachment shouldn't block the whole resolution — it just won't be seen.
async function urlToImagePart(
    url: string
): Promise<{ type: "image_url"; image_url: { url: string } } | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const contentType = res.headers.get("content-type") ?? "application/octet-stream";
        const buffer = Buffer.from(await res.arrayBuffer());
        const dataUri = `data:${contentType};base64,${buffer.toString("base64")}`;
        return { type: "image_url", image_url: { url: dataUri } };
    } catch (err) {
        console.error("Failed to fetch attachment for AI review:", err);
        return null;
    }
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

type GroqResult =
    | { ok: true; data: any }
    | { ok: false; status: number; errText: string };

/**
 * Retries on transient failures. Three different kinds count as transient
 * here, and each needs its body read exactly once (a Response's body can
 * only be consumed a single time, so the ok/retry decision and the eventual
 * parsing both happen in this one place, not split across two reads):
 *   - 429 / 5xx: a temporary problem on Groq's side.
 *   - 400 with code "json_validate_failed": the model's own output didn't
 *     come back as valid JSON on this specific attempt — often because it
 *     ran out of the token budget mid-answer. This is model-sampling
 *     variance, not a broken request: the exact same request can fail once
 *     and succeed on the very next try, which is exactly what happened when
 *     this was first hit — retrying automatically here means nobody has to
 *     notice and click the button a second time themselves.
 * Anything else (a malformed request, an auth failure) fails immediately.
 */
async function callGroqWithRetry(body: unknown, maxAttempts = 3): Promise<GroqResult> {
    let last: { status: number; errText: string } | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify(body),
        });

        if (response.ok) {
            return { ok: true, data: await response.json() };
        }

        const errText = await response.text();
        let errCode: string | undefined;
        try {
            errCode = JSON.parse(errText)?.error?.code;
        } catch {
            // errText wasn't JSON — errCode stays undefined, handled below.
        }

        const transient =
            response.status === 429 ||
            response.status >= 500 ||
            (response.status === 400 && errCode === "json_validate_failed");

        if (!transient) {
            return { ok: false, status: response.status, errText };
        }

        last = { status: response.status, errText };
        if (attempt < maxAttempts) {
            await sleep(800 * 2 ** (attempt - 1)); // 800ms, 1600ms, ...
        }
    }

    return { ok: false, status: last!.status, errText: last!.errText };
}

async function getAiVerdict(
    description: string,
    clientEvidence: string,
    clientAttachmentUrl: string | null,
    expertEvidence: string,
    expertAttachmentUrl: string | null
): Promise<{ favor_expert: boolean; reasoning: string }> {
    const systemPrompt = `You are an impartial dispute arbitrator for a freelance escrow platform.
You will be given the agreed work description and evidence submitted by both the client and the expert (freelancer), which may include attached images or files showing the actual delivered work.
Decide who should receive the escrowed funds: the expert (if the work was reasonably completed) or the client (if it was not).
Respond with ONLY a JSON object, no other text, no markdown fences, in exactly this shape:
{"favor_expert": true or false, "reasoning": "2-3 sentence explanation"}`;

    const userPromptText = `Work description: ${description || "No description provided."}

Client's evidence: ${clientEvidence || "No evidence submitted."}

Expert's evidence: ${expertEvidence || "No evidence submitted."}`;

    const userContent: any[] = [{ type: "text", text: userPromptText }];

    if (clientAttachmentUrl) {
        const part = await urlToImagePart(clientAttachmentUrl);
        if (part) {
            userContent.push({ type: "text", text: "The following file was attached as the client's evidence:" });
            userContent.push(part);
        }
    }

    if (expertAttachmentUrl) {
        const part = await urlToImagePart(expertAttachmentUrl);
        if (part) {
            userContent.push({ type: "text", text: "The following file was attached as the expert's evidence:" });
            userContent.push(part);
        }
    }

    // qwen/qwen3.8-27b on Groq: accepts text + image_url content parts, and
    // supports response_format: json_object for a guaranteed-JSON reply.
    const response = await callGroqWithRetry({
        model: "qwen/qwen3.8-27b",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        // The reply is a short JSON object (a boolean and 2-3 sentences),
        // realistically well under 150 tokens. Capping it here matters: this
        // model defaults to a much larger max_tokens when none is given,
        // and Groq's free/on-demand tier enforces a per-minute OUTPUT token
        // ceiling that a single uncapped request can exceed on its own —
        // that's a hard, deterministic failure, not something retrying fixes.
        // Bumped from 500: a truncated response (cut off before its closing
        // brace) is invalid JSON, and Groq's JSON mode rejects it outright —
        // 700 leaves more room for the full 2-3 sentence reasoning while
        // staying safely under the account's 1000-token-per-minute cap.
        max_tokens: 700,
        // Skips Qwen's internal "thinking" mode, which can spend a large,
        // unpredictable share of the output-token budget on reasoning the
        // model doesn't show, before it ever writes the actual JSON answer.
        reasoning_effort: "none",
    });

    if (!response.ok) {
        console.error(`Groq API error: ${response.status} ${response.errText}`);

        if (response.status === 429 || response.status >= 500) {
            throw new Error(
                "The AI arbitrator is temporarily overloaded (this is on Groq's side, not this app). Please wait a moment and press Resolve with AI again."
            );
        }
        if (response.status === 400) {
            throw new Error(
                "The AI arbitrator had trouble producing a valid ruling. Please press Resolve with AI again."
            );
        }
        throw new Error("The AI arbitrator couldn't reach the model. Please try again.");
    }

    const data = response.data;
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) throw new Error("The AI arbitrator returned an empty response. Please try again.");

    const cleaned = rawText.replace(/```json|```/g, "").trim();

    let parsed: any;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        console.error("Gemini response was not valid JSON:", rawText);
        throw new Error("The AI arbitrator's response couldn't be read. Please try again.");
    }

    if (typeof parsed.favor_expert !== "boolean" || typeof parsed.reasoning !== "string") {
        console.error("Gemini response did not match expected shape:", parsed);
        throw new Error("The AI arbitrator's response was incomplete. Please try again.");
    }

    return parsed;
}

export async function POST(request: Request) {
    try {
        const { escrowAddress } = await request.json();
        if (!escrowAddress) {
            return NextResponse.json({ error: "escrowAddress is required" }, { status: 400 });
        }

        const validatorKeypair = loadValidatorKeypair();
        const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        const provider = new AnchorProvider(connection, makeNodeWallet(validatorKeypair) as any, {
            commitment: "confirmed",
        });
        const program = new Program(idl as any, provider);

        const escrowPubkey = new PublicKey(escrowAddress);

        const escrowAccount: any = await (program.account as any).escrow.fetch(escrowPubkey);
        const statusKey = Object.keys(escrowAccount.status)[0];
        if (statusKey !== "disputed") {
            return NextResponse.json(
                { error: `Escrow is not in Disputed status (current: ${statusKey})` },
                { status: 400 }
            );
        }

        const clientPubkey = new PublicKey(escrowAccount.client);
        const expertPubkey = new PublicKey(escrowAccount.expert);

        const [disputePda] = PublicKey.findProgramAddressSync(
            [Buffer.from("dispute"), escrowPubkey.toBuffer()],
            program.programId
        );
        const disputeAccount: any = await (program.account as any).dispute.fetch(disputePda);
        const disputeStatusKey = Object.keys(disputeAccount.status)[0];
        if (disputeStatusKey !== "open") {
            return NextResponse.json(
                { error: `Dispute is not Open (current: ${disputeStatusKey})` },
                { status: 400 }
            );
        }

        // The program itself now enforces this on-chain (resolve_dispute
        // requires counter_hash to be set) — this check here isn't what
        // makes the rule real, it just fails fast, before spending a Groq
        // call, on an attempt the chain would reject anyway at the very end.
        const counterHashBytes: number[] = Array.from(
            disputeAccount.counterHash ?? disputeAccount.counter_hash ?? []
        );
        const counterEvidenceSubmitted = counterHashBytes.some((b) => b !== 0);
        if (!counterEvidenceSubmitted) {
            return NextResponse.json(
                {
                    error:
                        "The other party hasn't submitted their evidence yet. Both sides need to respond before this dispute can be resolved.",
                },
                { status: 400 }
            );
        }

        const { data: metadataRow } = await supabaseAdmin
            .from("escrow_metadata")
            .select("description")
            .eq("escrow_address", escrowAddress)
            .maybeSingle();

        const { data: evidenceRows, error: evidenceError } = await supabaseAdmin
            .from("dispute_evidence")
            .select("role, content, attachment_url, created_at")
            .eq("escrow_address", escrowAddress)
            .order("created_at", { ascending: false });

        if (evidenceError) {
            return NextResponse.json({ error: evidenceError.message }, { status: 500 });
        }

        const latestByRole = new Map<string, { content: string; attachment_url: string | null }>();
        for (const row of evidenceRows ?? []) {
            if (!latestByRole.has(row.role)) {
                latestByRole.set(row.role, { content: row.content, attachment_url: row.attachment_url });
            }
        }

        const clientEvidence = latestByRole.get("client");
        const expertEvidence = latestByRole.get("expert");

        const verdict = await getAiVerdict(
            metadataRow?.description ?? "",
            clientEvidence?.content ?? "",
            clientEvidence?.attachment_url ?? null,
            expertEvidence?.content ?? "",
            expertEvidence?.attachment_url ?? null
        );

        // Build a tamper-evident fingerprint of exactly what was decided and what
        // it was decided from. Anyone can recompute this from the public evidence
        // and the published verdict, then compare it against the value stored in
        // the on-chain Dispute account — if the stored reasoning is ever edited
        // after the fact, the hashes no longer match.
        const verdictPayload = JSON.stringify({
            escrow: escrowAddress,
            favor_expert: verdict.favor_expert,
            reasoning: verdict.reasoning,
            description: metadataRow?.description ?? "",
            client_evidence: clientEvidence?.content ?? "",
            expert_evidence: expertEvidence?.content ?? "",
        });

        const verdictHashBytes = crypto
            .createHash("sha256")
            .update(verdictPayload)
            .digest();
        const verdictHash = Array.from(verdictHashBytes);

        const txSignature = await program.methods
            .resolveDispute(verdict.favor_expert, verdictHash)
            .accounts({
                validator: validatorKeypair.publicKey,
                client: clientPubkey,
                expert: expertPubkey,
                escrow: escrowPubkey,
                dispute: disputePda,
            })
            .rpc();

        await supabaseAdmin.from("dispute_resolutions").insert({
            escrow_address: escrowAddress,
            favor_expert: verdict.favor_expert,
            reasoning: verdict.reasoning,
            verdict_hash: verdictHashBytes.toString("hex"),
        });

        return NextResponse.json({
            success: true,
            favor_expert: verdict.favor_expert,
            reasoning: verdict.reasoning,
            verdictHash: verdictHashBytes.toString("hex"),
            txSignature,
        });
    } catch (err: any) {
        console.error("resolve-dispute error:", err);
        return NextResponse.json(
            { error: err.message ?? "Unknown error resolving dispute" },
            { status: 500 }
        );
    }
}

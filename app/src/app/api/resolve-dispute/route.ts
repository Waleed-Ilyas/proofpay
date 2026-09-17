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

// Downloads a file and converts it into a Gemini inline_data part.
// Returns null (rather than throwing) if the fetch fails, since a broken
// attachment shouldn't block the whole resolution — it just won't be seen.
async function urlToInlinePart(url: string): Promise<{ inline_data: { mime_type: string; data: string } } | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const contentType = res.headers.get("content-type") ?? "application/octet-stream";
        const buffer = Buffer.from(await res.arrayBuffer());
        return {
            inline_data: {
                mime_type: contentType,
                data: buffer.toString("base64"),
            },
        };
    } catch (err) {
        console.error("Failed to fetch attachment for AI review:", err);
        return null;
    }
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

    const parts: any[] = [{ text: userPromptText }];

    if (clientAttachmentUrl) {
        const part = await urlToInlinePart(clientAttachmentUrl);
        if (part) {
            parts.push({ text: "The following file was attached as the client's evidence:" });
            parts.push(part);
        }
    }

    if (expertAttachmentUrl) {
        const part = await urlToInlinePart(expertAttachmentUrl);
        if (part) {
            parts.push({ text: "The following file was attached as the expert's evidence:" });
            parts.push(part);
        }
    }

    const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": process.env.GEMINI_API_KEY!,
            },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ role: "user", parts }],
            }),
        }
    );

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
    if (!rawText) throw new Error("Gemini response had no text content");

    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (typeof parsed.favor_expert !== "boolean" || typeof parsed.reasoning !== "string") {
        throw new Error("Gemini response did not match expected shape");
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
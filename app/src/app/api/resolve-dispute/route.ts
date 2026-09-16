import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import idl from "@/idl/proofpay.json";

// --- Supabase (server-side, service role key, bypasses RLS) ---
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- Load the validator keypair (server-only, never sent to the client) ---
function loadValidatorKeypair(): Keypair {
    const keypairPath = path.join(process.cwd(), "validator-authority.json");
    const raw = fs.readFileSync(keypairPath, "utf-8");
    const secretKey = Uint8Array.from(JSON.parse(raw));
    return Keypair.fromSecretKey(secretKey);
}

// --- Minimal wallet wrapper so AnchorProvider can sign with a raw Keypair ---
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

async function getAiVerdict(
    description: string,
    clientEvidence: string,
    expertEvidence: string
): Promise<{ favor_expert: boolean; reasoning: string }> {
    const systemPrompt = `You are an impartial dispute arbitrator for a freelance escrow platform.
You will be given the agreed work description and evidence submitted by both the client and the expert (freelancer).
Decide who should receive the escrowed funds: the expert (if the work was reasonably completed) or the client (if it was not).
Respond with ONLY a JSON object, no other text, no markdown fences, in exactly this shape:
{"favor_expert": true or false, "reasoning": "2-3 sentence explanation"}`;

    const userPrompt = `Work description: ${description || "No description provided."}

Client's evidence: ${clientEvidence || "No evidence submitted."}

Expert's evidence: ${expertEvidence || "No evidence submitted."}`;

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
                contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            }),
        }
    );

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
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

        // 1. Build a server-side Anchor program instance signed by the validator
        const validatorKeypair = loadValidatorKeypair();
        const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        const provider = new AnchorProvider(connection, makeNodeWallet(validatorKeypair) as any, {
            commitment: "confirmed",
        });
        const program = new Program(idl as any, provider);

        const escrowPubkey = new PublicKey(escrowAddress);

        // 2. Fetch the on-chain escrow to get the real client/expert and confirm it's disputed
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

        // 3. Derive the dispute PDA and confirm it's still open
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

        // 4. Pull description + both parties' latest evidence from Supabase
        const { data: metadataRow } = await supabaseAdmin
            .from("escrow_metadata")
            .select("description")
            .eq("escrow_address", escrowAddress)
            .maybeSingle();

        const { data: evidenceRows, error: evidenceError } = await supabaseAdmin
            .from("dispute_evidence")
            .select("role, content, created_at")
            .eq("escrow_address", escrowAddress)
            .order("created_at", { ascending: false });

        if (evidenceError) {
            return NextResponse.json({ error: evidenceError.message }, { status: 500 });
        }

        const latestByRole = new Map<string, string>();
        for (const row of evidenceRows ?? []) {
            if (!latestByRole.has(row.role)) {
                latestByRole.set(row.role, row.content);
            }
        }

        // 5. Ask the AI for a verdict
        const verdict = await getAiVerdict(
            metadataRow?.description ?? "",
            latestByRole.get("client") ?? "",
            latestByRole.get("expert") ?? ""
        );

        // 6. Sign and submit resolve_dispute on-chain as the validator
        const txSignature = await program.methods
            .resolveDispute(verdict.favor_expert)
            .accounts({
                validator: validatorKeypair.publicKey,
                client: clientPubkey,
                expert: expertPubkey,
                escrow: escrowPubkey,
                dispute: disputePda,
            })
            .rpc();

        // 7. Log the resolution for later display / reputation tracking
        await supabaseAdmin.from("dispute_resolutions").insert({
            escrow_address: escrowAddress,
            favor_expert: verdict.favor_expert,
            reasoning: verdict.reasoning,
        });

        return NextResponse.json({
            success: true,
            favor_expert: verdict.favor_expert,
            reasoning: verdict.reasoning,
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
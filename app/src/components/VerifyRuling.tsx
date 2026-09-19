"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { supabase } from "@/lib/supabase";
import { hashRecord } from "@/lib/sampleRecord";
import { btn, explorerAddress } from "@/components/app/ui";

const LEGACY_MESSAGE =
    "This ruling was made before ProofPay stored verdict fingerprints on Solana, so there is nothing on-chain to compare against. Rulings made from now on can be verified.";

type Result = {
    local: string;
    chain: string;
    disputeAddress: string;
    matched: boolean;
};

const STEPS = [
    "Reading the record from the database",
    "Hashing it here in your browser (SHA-256)",
    "Reading verdict_hash from the dispute account on Solana",
];

const hex = (bytes: ArrayLike<number>) =>
    Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

/**
 * Rebuilds the arbitration record exactly as the resolve-dispute route hashed it
 * (same fields, same order, latest filing per side as of the ruling), hashes it
 * locally, and compares it to the verdict_hash stored on-chain. Nothing here is
 * trusted: the only inputs are the public record and the chain.
 */
export default function VerifyRuling({
    escrowAddress,
    favorExpert,
    reasoning,
    resolvedAt,
}: {
    escrowAddress: string;
    favorExpert: boolean;
    reasoning: string;
    resolvedAt: string;
}) {
    const { program } = useAnchorProgram();
    const [step, setStep] = useState(-1);
    const [result, setResult] = useState<Result | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function run() {
        setError(null);
        setResult(null);
        setStep(0);

        try {
            if (!program) throw new Error("Connect your wallet to read the chain.");

            const [metaRes, evRes] = await Promise.all([
                supabase
                    .from("escrow_metadata")
                    .select("description")
                    .eq("escrow_address", escrowAddress)
                    .maybeSingle(),
                supabase
                    .from("dispute_evidence")
                    .select("role, content, created_at")
                    .eq("escrow_address", escrowAddress)
                    .lte("created_at", resolvedAt)
                    .order("created_at", { ascending: false }),
            ]);

            if (metaRes.error) throw new Error(`Couldn't read the agreed terms: ${metaRes.error.message}`);
            if (evRes.error) throw new Error(`Couldn't read the evidence: ${evRes.error.message}`);

            const latest = new Map<string, string>();
            for (const row of (evRes.data ?? []) as { role: string; content: string }[]) {
                if (!latest.has(row.role)) latest.set(row.role, row.content);
            }

            setStep(1);
            const local = await hashRecord({
                escrow: escrowAddress,
                favor_expert: favorExpert,
                reasoning,
                description: (metaRes.data as { description?: string } | null)?.description ?? "",
                client_evidence: latest.get("client") ?? "",
                expert_evidence: latest.get("expert") ?? "",
            });

            setStep(2);
            const enc = new TextEncoder();
            const [disputePda] = PublicKey.findProgramAddressSync(
                [enc.encode("dispute"), new PublicKey(escrowAddress).toBytes()],
                program.programId
            );
            const info = await program.provider.connection.getAccountInfo(disputePda);
            if (!info) throw new Error("No dispute account was found on Solana for this escrow.");
            const expectedSize = (program.account as any).dispute.size as number | undefined;
            if (typeof expectedSize === "number" && info.data.length < expectedSize) {
                throw new Error(LEGACY_MESSAGE);
            }
            const dispute: any = await (program.account as any).dispute.fetch(disputePda);
            const chain = hex(dispute.verdictHash ?? dispute.verdict_hash);

            setResult({ local, chain, disputeAddress: disputePda.toBase58(), matched: local === chain });
            setStep(3);
        } catch (err: any) {
            console.warn("Verify ruling:", err);
            const message: string = err?.message ?? "";
            setError(/beyond buffer length/i.test(message) ? LEGACY_MESSAGE : message || "The check couldn't finish.");
            setStep(-1);
        }
    }

    const running = step >= 0 && step < 3 && !result && !error;

    return (
        <div className="mt-4">
            {!result && !running && (
                <button onClick={run} className={btn.quiet}>
                    Verify this ruling
                </button>
            )}

            {running && (
                <ul className="space-y-1.5 text-sm" aria-live="polite">
                    {STEPS.map((s, i) => (
                        <li
                            key={s}
                            className={
                                i < step ? "text-verdict" : i === step ? "text-bone" : "text-mute/60"
                            }
                        >
                            {i < step ? "✓ " : i === step ? "› " : "  "}
                            {s}
                        </li>
                    ))}
                </ul>
            )}

            {error && (
                <div className="mt-3 rounded-lg border border-flare/50 bg-flare/10 p-3 text-sm text-flare">
                    <p className="break-words">{error}</p>
                    <button onClick={run} className="mt-2 underline underline-offset-4">
                        Try again
                    </button>
                </div>
            )}

            {result && (
                <div className="mt-1 rounded-xl border border-edge overflow-hidden" aria-live="polite">
                    <div className="p-4 space-y-3 bg-deep/50">
                        <div>
                            <p className="text-xs text-mute">Recomputed here from the public record</p>
                            <p className="addr text-[11px] break-all text-signal mt-1">{result.local}</p>
                        </div>
                        <div>
                            <p className="text-xs text-mute">verdict_hash on Solana</p>
                            <p className="addr text-[11px] break-all text-signal mt-1">{result.chain}</p>
                        </div>
                        <a
                            href={explorerAddress(result.disputeAddress)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-mute underline underline-offset-4 hover:text-brass"
                        >
                            See the dispute account on Solana Explorer
                        </a>
                    </div>
                    <div
                        className={`px-4 py-3 ${
                            result.matched ? "bg-verdict text-night" : "bg-flare text-night"
                        }`}
                    >
                        <p className="font-display text-xl">
                            {result.matched ? "The values match" : "The values don't match"}
                        </p>
                        <p className="text-sm mt-0.5">
                            {result.matched
                                ? "This is exactly the record the arbitrator ruled on."
                                : "The record in the database is not what the arbitrator hashed."}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

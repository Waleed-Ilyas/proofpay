"use client";

import { useEffect, useRef, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { supabase } from "@/lib/supabase";
import { hashRecord } from "@/lib/sampleRecord";
import { btn, explorerAddress } from "@/components/app/ui";

const LEGACY_MESSAGE =
    "This ruling predates on-chain verification, so there's nothing on-chain to check it against.";

type Result = {
    local: string;
    chain: string;
    disputeAddress: string;
    matched: boolean;
};

/** null = still checking, true = can be verified, false = known unverifiable. */
type Availability = boolean | null;

const STEPS = [
    "Reading the record from the database",
    "Hashing it here in your browser (SHA-256)",
    "Reading verdict_hash from the dispute account on Solana",
];

const hex = (bytes: ArrayLike<number>) =>
    Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

async function findDisputePda(program: any, escrowAddress: string) {
    const enc = new TextEncoder();
    const [pda] = PublicKey.findProgramAddressSync(
        [enc.encode("dispute"), new PublicKey(escrowAddress).toBytes()],
        program.programId
    );
    return pda;
}

/** True only if the account exists and is at least as large as the current Dispute layout. */
async function canBeVerified(program: any, escrowAddress: string): Promise<boolean> {
    const pda = await findDisputePda(program, escrowAddress);
    const info = await program.provider.connection.getAccountInfo(pda);
    if (!info) return false;
    const expectedSize = (program.account as any).dispute.size as number | undefined;
    if (typeof expectedSize === "number" && info.data.length < expectedSize) return false;
    return true;
}

/**
 * Rebuilds the arbitration record exactly as the resolve-dispute route hashed it
 * (same fields, same order, latest filing per side as of the ruling), hashes it
 * locally, and compares it to the verdict_hash stored on-chain. Nothing here is
 * trusted: the only inputs are the public record and the chain.
 *
 * Before showing an actionable button, this checks quietly in the background
 * whether the dispute account can even be verified (it may predate on-chain
 * fingerprints). Rulings known not to qualify get a plain note instead of a
 * button that would only lead to an error.
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
    const [available, setAvailable] = useState<Availability>(null);
    const [step, setStep] = useState(-1);
    const [result, setResult] = useState<Result | null>(null);
    const [error, setError] = useState<string | null>(null);
    const checkId = useRef(0);

    useEffect(() => {
        if (!program) return; // no wallet yet; try again once it connects
        const id = ++checkId.current;
        setAvailable(null);
        canBeVerified(program, escrowAddress)
            .then((ok) => {
                if (id === checkId.current) setAvailable(ok);
            })
            .catch(() => {
                // A network hiccup here shouldn't block the feature — fall back
                // to showing the button, and let a real click surface any error.
                if (id === checkId.current) setAvailable(true);
            });
    }, [program, escrowAddress]);

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
            const disputePda = await findDisputePda(program, escrowAddress);
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
            {available === null && !result && !error && (
                <div className="h-9 w-40 rounded-lg bg-edge/40 animate-pulse" aria-hidden="true" />
            )}

            {available === false && !result && (
                <p className="text-sm text-mute">{LEGACY_MESSAGE}</p>
            )}

            {available === true && !result && !running && !error && (
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

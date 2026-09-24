"use client";

import { useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { btn } from "@/components/app/ui";

const TIMEOUT_SECONDS = 12 * 60 * 60; // must match DISPUTE_TIMEOUT_SECONDS in constants.rs
const URGENT_THRESHOLD_SECONDS = 2 * 60 * 60;

const RADIUS = 25;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function pad(n: number) {
    return String(Math.max(0, n)).padStart(2, "0");
}

function splitHMS(totalSeconds: number) {
    const clamped = Math.max(0, totalSeconds);
    const h = Math.floor(clamped / 3600);
    const m = Math.floor((clamped % 3600) / 60);
    const s = Math.floor(clamped % 60);
    return { h, m, s };
}

/**
 * Shown on a Disputed escrow while the counterparty hasn't responded
 * on-chain yet. A draining ring plus a live-ticking clock face — the visual
 * point is the same one the text made before (time is actually running out),
 * just legible at a glance instead of a line to read. Once the 12 hours pass,
 * the raiser gets a Claim timeout button. Renders nothing once the
 * counterparty has submitted counter-evidence — there's nothing left to
 * count down to at that point.
 */
export default function DisputeTimer({
    escrowAddress,
    clientAddress,
    expertAddress,
    raisedBy,
    raisedAt,
    counterSubmitted,
    onTimeoutClaimed,
}: {
    escrowAddress: string;
    clientAddress: string;
    expertAddress: string;
    raisedBy: string;
    raisedAt: number;
    counterSubmitted: boolean;
    onTimeoutClaimed: (txSignature?: string) => void;
}) {
    const { publicKey } = useWallet();
    const { program } = useAnchorProgram();
    const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
    const [claiming, setClaiming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Ticks every second — this is meant to visibly move, not just be correct
    // whenever someone happens to glance at it.
    useEffect(() => {
        const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
        return () => clearInterval(id);
    }, []);

    const deadline = raisedAt + TIMEOUT_SECONDS;
    const remaining = deadline - now;
    const expired = remaining <= 0;
    const urgent = !expired && remaining <= URGENT_THRESHOLD_SECONDS;
    const isRaiser = publicKey?.toBase58() === raisedBy;

    const fractionRemaining = useMemo(
        () => Math.min(1, Math.max(0, remaining / TIMEOUT_SECONDS)),
        [remaining]
    );
    const dashoffset = CIRCUMFERENCE * (1 - fractionRemaining);
    const ringColor = expired || urgent ? "var(--color-flare)" : "var(--color-brass)";
    const { h, m, s } = splitHMS(remaining);

    if (counterSubmitted) return null;

    async function claim() {
        if (!program) return;
        setClaiming(true);
        setError(null);
        try {
            const escrowPubkey = new PublicKey(escrowAddress);
            const enc = new TextEncoder();
            const [disputePda] = PublicKey.findProgramAddressSync(
                [enc.encode("dispute"), escrowPubkey.toBytes()],
                program.programId
            );

            const signature = await program.methods
                .claimTimeout()
                .accounts({
                    client: new PublicKey(clientAddress),
                    expert: new PublicKey(expertAddress),
                    escrow: escrowPubkey,
                    raiser: new PublicKey(raisedBy),
                    dispute: disputePda,
                })
                .rpc();

            onTimeoutClaimed(signature);
        } catch (err: any) {
            console.error("claim_timeout failed:", err);
            setError(err?.message ?? "The timeout couldn't be claimed. Try again.");
        } finally {
            setClaiming(false);
        }
    }

    return (
        <div
            className={`mt-3 rounded-xl border p-4 flex items-center gap-4 transition-colors duration-500 ${
                expired || urgent ? "border-flare/40 bg-flare/[0.06]" : "border-edge bg-deep/50"
            }`}
            aria-live="polite"
        >
            <div className={`relative shrink-0 size-16 ${expired ? "animate-pulse" : ""}`}>
                <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden="true">
                    <circle
                        cx="32"
                        cy="32"
                        r={RADIUS}
                        fill="none"
                        stroke="var(--color-edge)"
                        strokeWidth="5"
                    />
                    <circle
                        cx="32"
                        cy="32"
                        r={RADIUS}
                        fill="none"
                        stroke={ringColor}
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset={dashoffset}
                        style={{ transition: "stroke-dashoffset 1s linear, stroke 0.6s ease" }}
                    />
                </svg>
                <div className="absolute inset-0 grid place-items-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" stroke={ringColor} strokeWidth="1.6" />
                        <path
                            d="M12 7v5l3.2 2"
                            stroke={ringColor}
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>
            </div>

            <div className="min-w-0 flex-1">
                {!expired ? (
                    <>
                        <p
                            className="addr text-2xl leading-none tabular-nums tracking-wide transition-colors duration-500"
                            style={{ color: ringColor }}
                        >
                            {h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`}
                        </p>
                        <p className="text-xs text-mute mt-1.5">
                            left for the other side to respond, or {isRaiser ? "you" : "the raiser"} can
                            claim the funds
                        </p>
                    </>
                ) : isRaiser ? (
                    <>
                        <p className="text-flare font-medium leading-snug">
                            The response window has closed with no reply.
                        </p>
                        <button onClick={claim} disabled={claiming} className={`${btn.primary} mt-2`}>
                            {claiming ? "Claiming…" : "Claim timeout"}
                        </button>
                    </>
                ) : (
                    <p className="text-flare font-medium leading-snug">
                        The response window has closed. The raiser can now claim the funds.
                    </p>
                )}
                {error && <p className="text-flare text-xs mt-2 break-words">{error}</p>}
            </div>
        </div>
    );
}

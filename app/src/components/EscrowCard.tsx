"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { EscrowData } from "@/hooks/useEscrows";
import { useDispute } from "@/hooks/useDispute";
import { supabase } from "@/lib/supabase";
import RaiseDisputeForm from "./RaiseDisputeForm";
import DisputeEvidence from "./DisputeEvidence";
import SubmitEvidenceForm from "./SubmitEvidenceForm";
import ResolveWithAiButton from "./ResolveWithAiButton";
import DisputeResolution from "./DisputeResolution";
import DisputeTimer from "./DisputeTimer";
import {
    CopyButton,
    STATUS,
    Track,
    btn,
    explorerAddress,
    explorerTx,
    formatSol,
    nextStep,
    shorten,
} from "@/components/app/ui";

function AddressRow({ label, address, you }: { label: string; address: string; you: boolean }) {
    return (
        <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-mute w-14 shrink-0">{label}</span>
            <a
                href={explorerAddress(address)}
                target="_blank"
                rel="noreferrer"
                title={address}
                className="addr text-[13px] text-bone/90 hover:text-brass transition-colors"
            >
                {shorten(address)}
            </a>
            <span className="flex-1 text-xs text-brass">{you ? "you" : ""}</span>
            <CopyButton value={address} label={`${label} address`} />
        </div>
    );
}

/**
 * The escrow account CLOSES the moment it settles (release, cancel, or a
 * ruling), refunding its rent and freeing this client/expert pair to
 * transact again. That also means it disappears from any future on-chain
 * scan for good — this is the only record of the outcome that survives.
 * upsert (not insert) so retries or a resolve-then-refresh can't duplicate
 * or fail on this row.
 */
async function recordSettledEscrow(
    escrow: EscrowData,
    status: "completed" | "refunded",
    txSignature?: string
) {
    const { error } = await supabase.from("escrow_history").upsert(
        {
            escrow_address: escrow.publicKey,
            client: escrow.client,
            expert: escrow.expert,
            amount: escrow.amount,
            status,
            tx_signature: txSignature ?? null,
        },
        { onConflict: "escrow_address" }
    );
    if (error) console.error("Failed to record settled escrow:", error);
}

export function EscrowCard({
    escrow,
    onActionComplete,
    onStatusChange,
    onSettled,
}: {
    escrow: EscrowData;
    onActionComplete: () => void;
    /** Optional: apply a known-good status immediately, without waiting on a refetch. */
    onStatusChange?: (publicKey: string, status: string) => void;
    /** Optional: announce a just-settled outcome (release, cancel, a ruling,
     *  or a claimed timeout), so the app can show a clear confirmation
     *  instead of the card just quietly disappearing into Settled/All. */
    onSettled?: (escrowAddress: string, message: string) => void;
}) {
    const { publicKey } = useWallet();
    const { program } = useAnchorProgram();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDisputeForm, setShowDisputeForm] = useState(false);
    const [lastTx, setLastTx] = useState<string | null>(null);
    const [rulingTx, setRulingTx] = useState<string | null>(null);
    const [evidenceVersion, setEvidenceVersion] = useState(0);
    const { dispute, refetch: refetchDispute } = useDispute(
        escrow.publicKey,
        escrow.status === "disputed"
    );
    // The raiser's evidence is already on-chain from the moment they raised
    // the dispute — counterSubmitted tracks whether the OTHER side has now
    // done the same. Until both have, resolving would only ever be hearing
    // one side of the story.
    const bothSidesFiled = dispute?.counterSubmitted ?? false;
    const waitingOnRole: "client" | "expert" | null = dispute
        ? dispute.raisedBy === escrow.client
            ? "expert"
            : "client"
        : null;

    // Pulse the badge when the escrow moves to a new state, so the lifecycle
    // is visible as it happens rather than just silently re-rendering.
    const [badgePulse, setBadgePulse] = useState(false);
    const prevStatus = useRef(escrow.status);

    useEffect(() => {
        if (prevStatus.current !== escrow.status) {
            prevStatus.current = escrow.status;
            setBadgePulse(true);
            const timer = setTimeout(() => setBadgePulse(false), 500);
            return () => clearTimeout(timer);
        }
    }, [escrow.status]);

    const isClient = publicKey?.toBase58() === escrow.client;
    const isExpert = publicKey?.toBase58() === escrow.expert;
    const escrowPubkey = new PublicKey(escrow.publicKey);
    const status = STATUS[escrow.status];

    const runAction = async (action: "accept" | "release" | "cancel") => {
        if (!program || !publicKey) return;
        setLoading(true);
        setError(null);

        try {
            let signature: string | undefined;
            let nextStatus: string | null = null;
            if (action === "accept") {
                signature = await program.methods
                    .acceptEscrow()
                    .accounts({ expert: publicKey, escrow: escrowPubkey })
                    .rpc();
                nextStatus = "active";
            } else if (action === "release") {
                signature = await program.methods
                    .releaseEscrow()
                    .accounts({
                        client: publicKey,
                        expert: new PublicKey(escrow.expert),
                        escrow: escrowPubkey,
                        systemProgram: SystemProgram.programId,
                    })
                    .rpc();
                nextStatus = "completed";
            } else if (action === "cancel") {
                signature = await program.methods
                    .cancelEscrow()
                    .accounts({
                        client: publicKey,
                        escrow: escrowPubkey,
                        systemProgram: SystemProgram.programId,
                    })
                    .rpc();
                nextStatus = "refunded";
            }

            if (signature) setLastTx(signature);
            // Reflect the outcome immediately — we already know the transaction
            // succeeded, so there's no reason to wait on a public RPC's
            // getProgramAccounts index to catch up before the UI updates.
            if (nextStatus) {
                onStatusChange?.(escrow.publicKey, nextStatus);
                if (nextStatus === "completed" || nextStatus === "refunded") {
                    await recordSettledEscrow(escrow, nextStatus, signature);
                    onSettled?.(
                        escrow.publicKey,
                        nextStatus === "completed"
                            ? "Funds released to the expert — check Settled or All."
                            : "Escrow cancelled and refunded — check Settled or All."
                    );
                }
            }
            onActionComplete();
        } catch (err: any) {
            console.error(err);
            setError(err.message ?? "The transaction didn't go through.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <article
            id={`escrow-${escrow.publicKey}`}
            className="pp-card-in rounded-2xl border border-edge bg-surface overflow-hidden scroll-mt-24"
        >
            <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-mute">
                        {isClient ? "You're the client" : "You're the expert"}
                    </span>
                    <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            status?.pill ?? "bg-raised text-mute"
                        } ${badgePulse ? "pp-badge-change" : ""}`}
                    >
                        {status?.label ?? escrow.status}
                    </span>
                </div>

                <p className="mt-4 font-display text-5xl leading-none">
                    {formatSol(escrow.amount)}
                    <span className="ml-2 text-xl text-mute">SOL</span>
                </p>

                <div className="mt-5">
                    <Track status={escrow.status} />
                    <p className="mt-3 text-sm text-mute leading-relaxed">
                        {nextStep(escrow.status, isClient)}
                    </p>
                </div>

                <div className="mt-5 space-y-2 border-t border-dashed border-edge pt-4">
                    <AddressRow label="Client" address={escrow.client} you={isClient} />
                    <AddressRow label="Expert" address={escrow.expert} you={isExpert} />
                    <AddressRow label="Escrow" address={escrow.publicKey} you={false} />
                </div>

                <div className="mt-5 flex flex-wrap gap-2.5">
                    {isExpert && escrow.status === "awaitingAcceptance" && (
                        <button onClick={() => runAction("accept")} disabled={loading} className={btn.primary}>
                            {loading ? "Working…" : "Accept job"}
                        </button>
                    )}

                    {isClient && escrow.status === "awaitingAcceptance" && (
                        <button onClick={() => runAction("cancel")} disabled={loading} className={btn.danger}>
                            {loading ? "Working…" : "Cancel and refund"}
                        </button>
                    )}

                    {isClient && escrow.status === "active" && (
                        <button onClick={() => runAction("release")} disabled={loading} className={btn.primary}>
                            {loading ? "Working…" : "Release funds"}
                        </button>
                    )}

                    {(isClient || isExpert) && escrow.status === "active" && (
                        <button
                            onClick={() => setShowDisputeForm((v) => !v)}
                            disabled={loading}
                            className={showDisputeForm ? btn.quiet : btn.danger}
                        >
                            {showDisputeForm ? "Never mind" : "Raise dispute"}
                        </button>
                    )}

                    {escrow.status === "disputed" && (
                        <ResolveWithAiButton
                            escrowAddress={escrow.publicKey}
                            canResolve={bothSidesFiled}
                            waitingOnRole={waitingOnRole}
                            onResolved={(r) => {
                                if (r?.txSignature) {
                                    setLastTx(r.txSignature);
                                    setRulingTx(r.txSignature);
                                }
                                if (typeof r?.favorExpert === "boolean") {
                                    const settledStatus = r.favorExpert ? "completed" : "refunded";
                                    onStatusChange?.(escrow.publicKey, settledStatus);
                                    recordSettledEscrow(escrow, settledStatus, r.txSignature);
                                    onSettled?.(
                                        escrow.publicKey,
                                        `The arbitrator ruled for the ${
                                            r.favorExpert ? "expert" : "client"
                                        } — check Settled or All to see the outcome.`
                                    );
                                }
                                onActionComplete();
                            }}
                        />
                    )}
                </div>

                {lastTx && (
                    <a
                        href={explorerTx(lastTx)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-block text-xs text-verdict underline underline-offset-4"
                    >
                        Confirmed on Solana. View the transaction
                    </a>
                )}

                {error && <p className="text-sm text-flare mt-3 break-words">{error}</p>}
            </div>

            {showDisputeForm && (
                <div className="pp-expand">
                    <RaiseDisputeForm
                        escrowAddress={escrow.publicKey}
                        role={isClient ? "client" : "expert"}
                        onDisputeRaised={() => {
                            setShowDisputeForm(false);
                            setEvidenceVersion((v) => v + 1);
                            // We already know this succeeded on-chain — show
                            // "Disputed" immediately rather than waiting on
                            // the slower background rescan to catch up.
                            onStatusChange?.(escrow.publicKey, "disputed");
                            onActionComplete();
                        }}
                    />
                </div>
            )}

            {escrow.status === "disputed" && dispute && (
                <div className="px-5 sm:px-6">
                    <DisputeTimer
                        escrowAddress={escrow.publicKey}
                        clientAddress={escrow.client}
                        expertAddress={escrow.expert}
                        raisedBy={dispute.raisedBy}
                        raisedAt={dispute.raisedAt}
                        counterSubmitted={dispute.counterSubmitted}
                        onTimeoutClaimed={(signature) => {
                            // Matches the payout rule in claim_timeout.rs: the
                            // raiser wins by default when the other side never
                            // responds in time.
                            const settledStatus =
                                dispute.raisedBy === escrow.expert ? "completed" : "refunded";
                            onStatusChange?.(escrow.publicKey, settledStatus);
                            recordSettledEscrow(escrow, settledStatus, signature);
                            onSettled?.(
                                escrow.publicKey,
                                "The response window closed with no reply — funds settled. Check Settled or All."
                            );
                            onActionComplete();
                        }}
                    />
                </div>
            )}

            {escrow.status === "disputed" && (isClient || isExpert) && publicKey && (
                <div className="pp-expand">
                    <SubmitEvidenceForm
                        escrowAddress={escrow.publicKey}
                        submittedBy={publicKey.toBase58()}
                        role={isClient ? "client" : "expert"}
                        isRaiser={dispute ? dispute.raisedBy === publicKey.toBase58() : false}
                        onSubmitted={() => {
                            setEvidenceVersion((v) => v + 1);
                            onActionComplete();
                        }}
                        onCounterEvidenceRecorded={refetchDispute}
                    />
                </div>
            )}

            {escrow.status === "disputed" && (
                <div className="pp-expand">
                    <DisputeEvidence escrowAddress={escrow.publicKey} refreshKey={evidenceVersion} />
                </div>
            )}

            {(escrow.status === "disputed" ||
                escrow.status === "completed" ||
                escrow.status === "refunded") && (
                <DisputeResolution
                    escrowAddress={escrow.publicKey}
                    status={escrow.status}
                    txSignature={rulingTx}
                />
            )}
        </article>
    );
}

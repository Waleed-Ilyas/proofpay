"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { EscrowData } from "@/hooks/useEscrows";
import RaiseDisputeForm from "./RaiseDisputeForm";
import DisputeEvidence from "./DisputeEvidence";
import SubmitEvidenceForm from "./SubmitEvidenceForm";
import ResolveWithAiButton from "./ResolveWithAiButton";
import DisputeResolution from "./DisputeResolution";
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

export function EscrowCard({
    escrow,
    onActionComplete,
}: {
    escrow: EscrowData;
    onActionComplete: () => void;
}) {
    const { publicKey } = useWallet();
    const { program } = useAnchorProgram();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDisputeForm, setShowDisputeForm] = useState(false);
    const [lastTx, setLastTx] = useState<string | null>(null);
    const [rulingTx, setRulingTx] = useState<string | null>(null);
    const [evidenceVersion, setEvidenceVersion] = useState(0);

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
            if (action === "accept") {
                signature = await program.methods
                    .acceptEscrow()
                    .accounts({ expert: publicKey, escrow: escrowPubkey })
                    .rpc();
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
            } else if (action === "cancel") {
                signature = await program.methods
                    .cancelEscrow()
                    .accounts({
                        client: publicKey,
                        escrow: escrowPubkey,
                        systemProgram: SystemProgram.programId,
                    })
                    .rpc();
            }

            if (signature) setLastTx(signature);
            onActionComplete();
        } catch (err: any) {
            console.error(err);
            setError(err.message ?? "The transaction didn't go through.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <article className="pp-card-in rounded-2xl border border-edge bg-surface overflow-hidden">
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
                            onResolved={(r) => {
                                if (r?.txSignature) {
                                    setLastTx(r.txSignature);
                                    setRulingTx(r.txSignature);
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
                        onSubmitted={() => {
                            setEvidenceVersion((v) => v + 1);
                            onActionComplete();
                        }}
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

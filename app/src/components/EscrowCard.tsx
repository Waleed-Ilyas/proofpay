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

const statusLabels: Record<string, string> = {
    awaitingAcceptance: "Awaiting acceptance",
    active: "Active",
    disputed: "Disputed",
    completed: "Completed",
    refunded: "Refunded",
};

const statusStyles: Record<string, string> = {
    awaitingAcceptance: "bg-[#B08D33] text-[#10121A]",
    active: "bg-[#2A2E3A] text-[#EDE6D6] border border-[#B08D33]",
    disputed: "bg-[#9A4B3F] text-[#EDE6D6]",
    completed: "bg-[#3F6B4F] text-[#EDE6D6]",
    refunded: "bg-[#2A2E3A] text-[#9AA0AC]",
};

function shorten(address: string) {
    return `${address.slice(0, 4)}…${address.slice(-4)}`;
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

    const runAction = async (action: "accept" | "release" | "cancel") => {
        if (!program || !publicKey) return;
        setLoading(true);
        setError(null);

        try {
            if (action === "accept") {
                await program.methods
                    .acceptEscrow()
                    .accounts({ expert: publicKey, escrow: escrowPubkey })
                    .rpc();
            } else if (action === "release") {
                await program.methods
                    .releaseEscrow()
                    .accounts({
                        client: publicKey,
                        expert: new PublicKey(escrow.expert),
                        escrow: escrowPubkey,
                        systemProgram: SystemProgram.programId,
                    })
                    .rpc();
            } else if (action === "cancel") {
                await program.methods
                    .cancelEscrow()
                    .accounts({
                        client: publicKey,
                        escrow: escrowPubkey,
                        systemProgram: SystemProgram.programId,
                    })
                    .rpc();
            }

            onActionComplete();
        } catch (err: any) {
            console.error(err);
            setError(err.message ?? "The transaction didn't go through.");
        } finally {
            setLoading(false);
        }
    };

    const primaryBtn =
        "px-4 py-2 rounded-sm bg-[#B08D33] text-[#10121A] text-sm font-medium hover:bg-[#8C6F28] disabled:opacity-40 transition-colors";
    const quietBtn =
        "px-4 py-2 rounded-sm border border-[#2A2E3A] text-[#EDE6D6] text-sm font-medium hover:border-[#B08D33] disabled:opacity-40 transition-colors";
    const dangerBtn =
        "px-4 py-2 rounded-sm border border-[#9A4B3F] text-[#C77A6C] text-sm font-medium hover:bg-[#9A4B3F] hover:text-[#EDE6D6] disabled:opacity-40 transition-colors";

    return (
        <div className="flex flex-col gap-4 p-5 rounded-sm border border-[#2A2E3A] bg-[#171A24] w-full max-w-md pp-card-in">
            <div className="flex items-center justify-between">
                <span className="text-sm text-[#9AA0AC]">
                    {isClient ? "You're the client" : "You're the expert"}
                </span>
                <span
                    className={`text-xs px-2.5 py-1 rounded-full ${statusStyles[escrow.status] ?? "bg-[#2A2E3A] text-[#9AA0AC]"
                        } ${badgePulse ? "pp-badge-change" : ""}`}
                >
                    {statusLabels[escrow.status] ?? escrow.status}
                </span>
            </div>

            <p className="font-display text-3xl">{escrow.amount} SOL</p>

            <div className="text-xs text-[#5A606C] space-y-1 font-mono-address">
                <div className="flex justify-between">
                    <span>client</span>
                    <span className="text-[#9AA0AC]">{shorten(escrow.client)}</span>
                </div>
                <div className="flex justify-between">
                    <span>expert</span>
                    <span className="text-[#9AA0AC]">{shorten(escrow.expert)}</span>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {isExpert && escrow.status === "awaitingAcceptance" && (
                    <button onClick={() => runAction("accept")} disabled={loading} className={primaryBtn}>
                        {loading ? "Working…" : "Accept job"}
                    </button>
                )}

                {isClient && escrow.status === "awaitingAcceptance" && (
                    <button onClick={() => runAction("cancel")} disabled={loading} className={dangerBtn}>
                        {loading ? "Working…" : "Cancel and refund"}
                    </button>
                )}

                {isClient && escrow.status === "active" && (
                    <button onClick={() => runAction("release")} disabled={loading} className={primaryBtn}>
                        {loading ? "Working…" : "Release funds"}
                    </button>
                )}

                {(isClient || isExpert) && escrow.status === "active" && (
                    <button
                        onClick={() => setShowDisputeForm((v) => !v)}
                        disabled={loading}
                        className={showDisputeForm ? quietBtn : dangerBtn}
                    >
                        {showDisputeForm ? "Never mind" : "Raise dispute"}
                    </button>
                )}

                {escrow.status === "disputed" && (
                    <ResolveWithAiButton
                        escrowAddress={escrow.publicKey}
                        onResolved={onActionComplete}
                    />
                )}
            </div>

            {showDisputeForm && (
                <div className="pp-expand">
                    <RaiseDisputeForm
                        escrowAddress={escrow.publicKey}
                        role={isClient ? "client" : "expert"}
                        onDisputeRaised={() => {
                            setShowDisputeForm(false);
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
                        onSubmitted={onActionComplete}
                    />
                </div>
            )}

            {escrow.status === "disputed" && (
                <div className="pp-expand">
                    <DisputeEvidence escrowAddress={escrow.publicKey} />
                </div>
            )}

            {(escrow.status === "disputed" ||
                escrow.status === "completed" ||
                escrow.status === "refunded") && (
                    <DisputeResolution escrowAddress={escrow.publicKey} />
                )}

            {error && <p className="text-sm text-[#C77A6C] break-all">{error}</p>}
        </div>
    );
}
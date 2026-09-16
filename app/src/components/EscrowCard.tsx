"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { EscrowData } from "@/hooks/useEscrows";

const statusLabels: Record<string, string> = {
    awaitingAcceptance: "Awaiting Acceptance",
    active: "Active",
    completed: "Completed",
    refunded: "Refunded",
};

const statusColors: Record<string, string> = {
    awaitingAcceptance: "bg-yellow-600",
    active: "bg-blue-600",
    completed: "bg-green-600",
    refunded: "bg-gray-600",
};

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

    const isClient = publicKey?.toBase58() === escrow.client;
    const isExpert = publicKey?.toBase58() === escrow.expert;
    const escrowPubkey = new PublicKey(escrow.publicKey);

    const runAction = async (
        action: "accept" | "release" | "cancel"
    ) => {
        if (!program || !publicKey) return;
        setLoading(true);
        setError(null);

        try {
            if (action === "accept") {
                await program.methods
                    .acceptEscrow()
                    .accounts({
                        expert: publicKey,
                        escrow: escrowPubkey,
                    })
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
            setError(err.message ?? "Action failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-3 p-5 rounded-xl border border-gray-700 bg-gray-900/50 w-full max-w-md">
            <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">
                    {isClient ? "You are the Client" : "You are the Expert"}
                </span>
                <span
                    className={`text-xs px-2 py-1 rounded-full ${statusColors[escrow.status] ?? "bg-gray-600"}`}
                >
                    {statusLabels[escrow.status] ?? escrow.status}
                </span>
            </div>

            <p className="text-lg font-semibold">{escrow.amount} SOL</p>

            <div className="text-xs text-gray-500 break-all">
                <p>Client: {escrow.client}</p>
                <p>Expert: {escrow.expert}</p>
            </div>

            <div className="flex gap-2 mt-2">
                {isExpert && escrow.status === "awaitingAcceptance" && (
                    <button
                        onClick={() => runAction("accept")}
                        disabled={loading}
                        className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium"
                    >
                        {loading ? "Processing..." : "Accept"}
                    </button>
                )}

                {isClient && escrow.status === "awaitingAcceptance" && (
                    <button
                        onClick={() => runAction("cancel")}
                        disabled={loading}
                        className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-500 disabled:opacity-50 text-sm font-medium"
                    >
                        {loading ? "Processing..." : "Cancel & Refund"}
                    </button>
                )}

                {isClient && escrow.status === "active" && (
                    <button
                        onClick={() => runAction("release")}
                        disabled={loading}
                        className="px-3 py-2 rounded-md bg-green-600 hover:bg-green-500 disabled:opacity-50 text-sm font-medium"
                    >
                        {loading ? "Processing..." : "Release Funds"}
                    </button>
                )}
            </div>

            {error && <p className="text-xs text-red-400 break-all">{error}</p>}
        </div>
    );
}
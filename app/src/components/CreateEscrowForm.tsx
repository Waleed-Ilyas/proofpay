"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import BN from "bn.js";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { supabase } from "@/lib/supabase";

export function CreateEscrowForm({ onCreated }: { onCreated?: () => void }) {
    const { publicKey } = useWallet();
    const { program } = useAnchorProgram();

    const [expertAddress, setExpertAddress] = useState("");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [status, setStatus] = useState<string | null>(null);
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleCreateEscrow = async () => {
        setIsError(false);

        if (!program || !publicKey) {
            setStatus("Connect your wallet first.");
            setIsError(true);
            return;
        }

        let expertPubkey: PublicKey;
        try {
            expertPubkey = new PublicKey(expertAddress.trim());
        } catch {
            setStatus("That doesn't look like a valid Solana wallet address.");
            setIsError(true);
            return;
        }

        const solAmount = parseFloat(amount);
        if (isNaN(solAmount) || solAmount <= 0) {
            setStatus("Enter an amount greater than 0.");
            setIsError(true);
            return;
        }

        const lamports = new BN(solAmount * LAMPORTS_PER_SOL);

        const [escrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), publicKey.toBuffer(), expertPubkey.toBuffer()],
            program.programId
        );

        setLoading(true);
        setStatus(null);

        try {
            await program.methods
                .createEscrow(lamports)
                .accounts({
                    client: publicKey,
                    expert: expertPubkey,
                    escrow: escrowPda,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            if (description.trim()) {
                const { error: metadataError } = await supabase
                    .from("escrow_metadata")
                    .insert({
                        escrow_address: escrowPda.toBase58(),
                        description: description.trim(),
                    });

                if (metadataError) {
                    console.error("Failed to save description:", metadataError);
                }
            }

            setStatus(`Escrow created at ${escrowPda.toBase58()}`);
            setExpertAddress("");
            setAmount("");
            setDescription("");
            onCreated?.();
        } catch (err: any) {
            console.error(err);
            setStatus(err.message ?? "The transaction didn't go through. Try again.");
            setIsError(true);
        } finally {
            setLoading(false);
        }
    };

    const fieldClass =
        "px-3 py-2.5 rounded-sm bg-[#10121A] border border-[#2A2E3A] text-sm text-[#EDE6D6] placeholder:text-[#5A606C] focus:outline-none focus:border-[#B08D33] transition-colors";

    return (
        <div className="flex flex-col gap-5 w-full max-w-md p-6 rounded-sm border border-[#2A2E3A] bg-[#171A24]">
            <h2 className="font-display text-xl">Create an escrow</h2>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm text-[#9AA0AC]">Expert&apos;s wallet address</label>
                <input
                    type="text"
                    value={expertAddress}
                    onChange={(e) => setExpertAddress(e.target.value)}
                    placeholder="Solana wallet address"
                    className={`${fieldClass} font-mono-address`}
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm text-[#9AA0AC]">Amount in SOL</label>
                <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="1.0"
                    className={`${fieldClass} font-mono-address`}
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm text-[#9AA0AC]">
                    What&apos;s the work?{" "}
                    <span className="text-[#5A606C]">
                        Optional, but the arbitrator uses it if there&apos;s a dispute.
                    </span>
                </label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Build a landing page with a signup form and three sections"
                    rows={3}
                    className={`${fieldClass} resize-none`}
                />
            </div>

            <button
                onClick={handleCreateEscrow}
                disabled={loading || !publicKey}
                className="mt-1 px-4 py-3 rounded-sm bg-[#B08D33] text-[#10121A] font-medium hover:bg-[#8C6F28] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                {loading ? "Creating escrow…" : "Create and deposit"}
            </button>

            {status && (
                <p
                    className={`text-sm break-all font-mono-address ${isError ? "text-[#C77A6C]" : "text-[#7FA88C]"
                        }`}
                >
                    {status}
                </p>
            )}
        </div>
    );
}
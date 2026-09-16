"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import BN from "bn.js";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";



export function CreateEscrowForm() {
    const { publicKey } = useWallet();
    const { program } = useAnchorProgram();

    const [expertAddress, setExpertAddress] = useState("");
    const [amount, setAmount] = useState("");
    const [status, setStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleCreateEscrow = async () => {
        if (!program || !publicKey) {
            setStatus("Connect your wallet first.");
            return;
        }

        let expertPubkey: PublicKey;
        try {
            expertPubkey = new PublicKey(expertAddress.trim());
        } catch {
            setStatus("That doesn't look like a valid Solana wallet address.");
            return;
        }

        const solAmount = parseFloat(amount);
        if (isNaN(solAmount) || solAmount <= 0) {
            setStatus("Enter a valid amount greater than 0.");
            return;
        }

        const lamports = new BN(solAmount * LAMPORTS_PER_SOL);

        const [escrowPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("escrow"),
                publicKey.toBuffer(),
                expertPubkey.toBuffer(),
            ],
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

            setStatus(`✅ Escrow created! Address: ${escrowPda.toBase58()}`);
            setExpertAddress("");
            setAmount("");
        } catch (err: any) {
            console.error(err);
            setStatus(`❌ Failed: ${err.message ?? "Unknown error"}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 w-full max-w-md p-6 rounded-xl border border-gray-700 bg-gray-900/50">
            <h2 className="text-xl font-semibold">Create an Escrow</h2>

            <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-400">Expert&apos;s wallet address</label>
                <input
                    type="text"
                    value={expertAddress}
                    onChange={(e) => setExpertAddress(e.target.value)}
                    placeholder="Enter Solana wallet address"
                    className="px-3 py-2 rounded-md bg-gray-800 border border-gray-600 text-sm"
                />
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-400">Amount (SOL)</label>
                <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="1.0"
                    className="px-3 py-2 rounded-md bg-gray-800 border border-gray-600 text-sm"
                />
            </div>

            <button
                onClick={handleCreateEscrow}
                disabled={loading || !publicKey}
                className="mt-2 px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
                {loading ? "Creating..." : "Create & Deposit"}
            </button>

            {status && (
                <p className="text-sm break-all mt-2 text-gray-300">{status}</p>
            )}
        </div>
    );
}
"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { supabase } from "@/lib/supabase";
import { sha256ToBytes, sha256ToHex } from "@/lib/hash";

interface RaiseDisputeFormProps {
    escrowAddress: string; // base58 pubkey of the escrow PDA
    role: "client" | "expert";
    onDisputeRaised: () => void; // call after success to refresh the escrow list
}

export default function RaiseDisputeForm({
    escrowAddress,
    role,
    onDisputeRaised,
}: RaiseDisputeFormProps) {
    const { publicKey } = useWallet();
    const { program } = useAnchorProgram();

    const [evidence, setEvidence] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit() {
        setError(null);

        if (!evidence.trim()) {
            setError("Please describe what happened before submitting.");
            return;
        }
        if (!program || !publicKey) {
            setError("Wallet/program not ready yet. Try again in a moment.");
            return;
        }

        setSubmitting(true);
        try {
            // 1. Hash the evidence text client-side
            const hashBytes = await sha256ToBytes(evidence); // number[] of 32 bytes, matches Rust [u8;32]
            const hashHex = await sha256ToHex(evidence);

            // 2. Store the full evidence text + hash off-chain in Supabase
            const { error: supabaseError } = await supabase
                .from("dispute_evidence")
                .insert({
                    escrow_address: escrowAddress,
                    submitted_by: publicKey.toBase58(),
                    role,
                    content: evidence,
                    evidence_hash: hashHex,
                });

            if (supabaseError) {
                throw new Error(`Supabase insert failed: ${supabaseError.message}`);
            }

            // 3. Derive the dispute PDA (seeds = ["dispute", escrow_pubkey], must match raise_dispute.rs)
            const escrowPubkey = new PublicKey(escrowAddress);
            const [disputePda] = PublicKey.findProgramAddressSync(
                [Buffer.from("dispute"), escrowPubkey.toBuffer()],
                program.programId
            );

            // 4. Call the on-chain raise_dispute instruction
            await program.methods
                .raiseDispute(hashBytes)
                .accounts({
                    raiser: publicKey,
                    escrow: escrowPubkey,
                    dispute: disputePda,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            setEvidence("");
            onDisputeRaised();
        } catch (err: any) {
            console.error(err);
            setError(err.message ?? "Something went wrong raising the dispute.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="mt-3 p-3 border border-red-800 rounded-md bg-red-950/40">
            <p className="text-sm font-medium text-red-300 mb-2">Raise a Dispute</p>
            <textarea
                className="w-full border border-gray-700 rounded-md p-2 text-sm bg-gray-900 text-gray-100"
                rows={4}
                placeholder="Describe what happened and why you're raising a dispute..."
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                disabled={submitting}
            />
            {error && <p className="text-xs text-red-400 mt-1 break-all">{error}</p>}
            <button
                onClick={handleSubmit}
                disabled={submitting}
                className="mt-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-md disabled:opacity-50 font-medium"
            >
                {submitting ? "Submitting..." : "Submit Dispute"}
            </button>
        </div>
    );
}
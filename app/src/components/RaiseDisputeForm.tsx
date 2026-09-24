"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { supabase } from "@/lib/supabase";
import { sha256ToBytes, sha256ToHex } from "@/lib/hash";
import { AttachmentPicker, inputClass } from "@/components/app/ui";

interface RaiseDisputeFormProps {
    escrowAddress: string;
    role: "client" | "expert";
    onDisputeRaised: () => void;
}

async function uploadAttachment(
    file: File,
    escrowAddress: string,
    role: string
): Promise<string | null> {
    const ext = file.name.split(".").pop();
    const path = `${escrowAddress}/${role}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
        .from("dispute-attachments")
        .upload(path, file);

    if (error) {
        console.error("Attachment upload failed:", error);
        return null;
    }

    const { data } = supabase.storage.from("dispute-attachments").getPublicUrl(path);
    return data.publicUrl;
}

export default function RaiseDisputeForm({
    escrowAddress,
    role,
    onDisputeRaised,
}: RaiseDisputeFormProps) {
    const { publicKey } = useWallet();
    const { program } = useAnchorProgram();

    const [evidence, setEvidence] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit() {
        setError(null);

        if (!evidence.trim()) {
            setError("Describe what happened before submitting.");
            return;
        }
        if (!program || !publicKey) {
            setError("Wallet isn't ready yet. Try again in a moment.");
            return;
        }

        setSubmitting(true);
        try {
            const hashBytes = await sha256ToBytes(evidence);
            const hashHex = await sha256ToHex(evidence);

            let attachmentUrl: string | null = null;
            if (file) {
                attachmentUrl = await uploadAttachment(file, escrowAddress, role);
            }

            const { error: supabaseError } = await supabase
                .from("dispute_evidence")
                .insert({
                    escrow_address: escrowAddress,
                    submitted_by: publicKey.toBase58(),
                    role,
                    content: evidence,
                    evidence_hash: hashHex,
                    attachment_url: attachmentUrl,
                });

            if (supabaseError) {
                throw new Error(`Supabase insert failed: ${supabaseError.message}`);
            }

            const escrowPubkey = new PublicKey(escrowAddress);
            const [disputePda] = PublicKey.findProgramAddressSync(
                [Buffer.from("dispute"), escrowPubkey.toBuffer()],
                program.programId
            );

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
            setFile(null);
            onDisputeRaised();

            // Fire-and-forget: a failed or unconfigured email should never
            // block or appear to fail the dispute itself, which already
            // succeeded on-chain by this point.
            fetch("/api/notify-dispute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ escrowAddress, raisedBy: publicKey.toBase58() }),
            }).catch((notifyErr) => console.error("notify-dispute request failed:", notifyErr));
        } catch (err: any) {
            console.error(err);
            setError(err.message ?? "The dispute didn't go through. Try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="p-5 sm:p-6 border-t border-flare/30 bg-flare/[0.06]">
            <p className="font-display text-xl text-flare">Raise a dispute</p>
            <p className="text-sm text-mute mt-1">
                Your account is hashed and its fingerprint is written on-chain with the dispute.
                The escrow is frozen until the arbitrator rules.
            </p>
            <textarea
                className={`${inputClass} mt-4 focus:border-flare`}
                rows={4}
                placeholder="What went wrong, and why are you disputing?"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                disabled={submitting}
            />
            <div className="mt-3">
                <AttachmentPicker file={file} onChange={setFile} disabled={submitting} tone="flare" />
            </div>
            {error && <p className="text-sm text-flare mt-3 break-words">{error}</p>}
            <button
                onClick={handleSubmit}
                disabled={submitting}
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-flare text-night px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
            >
                {submitting ? "Submitting…" : "Submit dispute"}
            </button>
        </div>
    );
}

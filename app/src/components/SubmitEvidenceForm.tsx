"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { supabase } from "@/lib/supabase";
import { sha256ToBytes, sha256ToHex } from "@/lib/hash";
import { AttachmentPicker, btn, inputClass } from "@/components/app/ui";

interface SubmitEvidenceFormProps {
    escrowAddress: string;
    submittedBy: string;
    role: "client" | "expert";
    onSubmitted: () => void;
    /** True if this wallet is the one who raised the current dispute. The
     *  raiser already recorded their evidence hash on-chain via raise_dispute;
     *  only the OTHER party's first submission gets stamped on-chain here. */
    isRaiser?: boolean;
    /** Called after a successful on-chain counter-evidence submission, so the
     *  parent can refetch the dispute and hide the countdown. */
    onCounterEvidenceRecorded?: () => void;
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

export default function SubmitEvidenceForm({
    escrowAddress,
    submittedBy,
    role,
    onSubmitted,
    isRaiser = false,
    onCounterEvidenceRecorded,
}: SubmitEvidenceFormProps) {
    const { publicKey } = useWallet();
    const { program } = useAnchorProgram();
    const [evidence, setEvidence] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [chainWarning, setChainWarning] = useState<string | null>(null);
    const [submittedOnce, setSubmittedOnce] = useState(false);

    async function handleSubmit() {
        setError(null);
        setChainWarning(null);

        if (!evidence.trim()) {
            setError("Describe your side before submitting.");
            return;
        }

        // Only the counterparty's FIRST submission gets stamped on-chain — the
        // program only accepts one counter-evidence hash per dispute, and the
        // raiser already has their own hash on-chain from raise_dispute.
        const shouldRecordOnChain = !isRaiser && !submittedOnce && !!program && !!publicKey;

        setSubmitting(true);
        try {
            const hashHex = await sha256ToHex(evidence);

            let attachmentUrl: string | null = null;
            if (file) {
                attachmentUrl = await uploadAttachment(file, escrowAddress, role);
            }

            const { error: supabaseError } = await supabase
                .from("dispute_evidence")
                .insert({
                    escrow_address: escrowAddress,
                    submitted_by: submittedBy,
                    role,
                    content: evidence,
                    evidence_hash: hashHex,
                    attachment_url: attachmentUrl,
                });

            if (supabaseError) {
                throw new Error(`Supabase insert failed: ${supabaseError.message}`);
            }

            setEvidence("");
            setFile(null);
            setSubmittedOnce(true);
            onSubmitted();

            // A failure here is kept separate from the error above: the
            // evidence is already safely saved either way, so this only ever
            // shows a soft warning, never blocks the form or implies the
            // submission itself failed.
            if (shouldRecordOnChain) {
                try {
                    const hashBytes = await sha256ToBytes(evidence);
                    const escrowPubkey = new PublicKey(escrowAddress);
                    const enc = new TextEncoder();
                    const [disputePda] = PublicKey.findProgramAddressSync(
                        [enc.encode("dispute"), escrowPubkey.toBytes()],
                        program!.programId
                    );
                    await program!.methods
                        .submitCounterEvidence(hashBytes)
                        .accounts({
                            responder: publicKey,
                            escrow: escrowPubkey,
                            dispute: disputePda,
                        })
                        .rpc();
                    onCounterEvidenceRecorded?.();
                } catch (chainErr: any) {
                    console.error("submit_counter_evidence failed:", chainErr);
                    setChainWarning(
                        "Your evidence was saved, but couldn't be stamped on-chain to stop the response timer. You can try submitting again."
                    );
                }
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message ?? "Your evidence didn't save. Try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="p-5 sm:p-6 border-t border-edge">
            <p className="font-display text-xl text-brass">
                {submittedOnce ? "Update your evidence" : "Submit your evidence"}
            </p>
            <p className="text-sm text-mute mt-1">
                Each filing is timestamped and hashed. The arbitrator reads the latest one from each
                side.
            </p>
            <textarea
                className={`${inputClass} mt-4`}
                rows={3}
                placeholder="What happened, from your side?"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                disabled={submitting}
            />
            <div className="mt-3">
                <AttachmentPicker file={file} onChange={setFile} disabled={submitting} />
            </div>
            {error && <p className="text-sm text-flare mt-3 break-words">{error}</p>}
            {chainWarning && <p className="text-sm text-flare mt-2 break-words">{chainWarning}</p>}
            <button onClick={handleSubmit} disabled={submitting} className={`${btn.quiet} mt-4`}>
                {submitting ? "Submitting…" : "Submit evidence"}
            </button>
        </div>
    );
}

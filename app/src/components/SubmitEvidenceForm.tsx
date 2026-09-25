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
    const [stage, setStage] = useState<"chain" | "saving" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [submittedOnce, setSubmittedOnce] = useState(false);
    // True once submit_counter_evidence has actually succeeded on-chain, even
    // if the written explanation below hasn't saved yet — this is what lets a
    // retry (after, say, a Supabase hiccup) skip trying the chain step again,
    // since the program only ever accepts one counter-evidence hash.
    const [onChainDone, setOnChainDone] = useState(false);

    async function handleSubmit() {
        setError(null);

        if (!evidence.trim()) {
            setError("Describe your side before submitting.");
            return;
        }

        // Only the counterparty's FIRST submission needs an on-chain stamp —
        // that's what actually stops the 12-hour response timer, not this
        // form's own record of it.
        const needsOnChainStep =
            !isRaiser && !submittedOnce && !onChainDone && !!program && !!publicKey;

        setSubmitting(true);
        try {
            // The on-chain step runs FIRST, before anything is shown as
            // "submitted" — the same order raising a dispute already uses.
            // Doing it the other way around (save first, sign after) let
            // evidence appear as filed on screen while the timer kept
            // running, if the wallet step then failed or was rejected.
            if (needsOnChainStep) {
                setStage("chain");
                const hashBytes = await sha256ToBytes(evidence);
                const escrowPubkey = new PublicKey(escrowAddress);
                const enc = new TextEncoder();
                const [disputePda] = PublicKey.findProgramAddressSync(
                    [enc.encode("dispute"), escrowPubkey.toBytes()],
                    program!.programId
                );

                try {
                    await program!.methods
                        .submitCounterEvidence(hashBytes)
                        .accounts({
                            responder: publicKey,
                            escrow: escrowPubkey,
                            dispute: disputePda,
                        })
                        .rpc();
                } catch (chainErr: any) {
                    const alreadyDone = /already been submitted/i.test(chainErr?.message ?? "");
                    if (!alreadyDone) {
                        console.error("submit_counter_evidence failed:", chainErr);
                        setError(
                            chainErr?.message ??
                                "Your response couldn't be recorded on Solana. Try again."
                        );
                        setSubmitting(false);
                        setStage(null);
                        return;
                    }
                    // A prior attempt already landed on-chain (e.g. the page
                    // was reloaded after that succeeded but before the text
                    // below saved) — nothing left to do on-chain, continue on.
                }
                setOnChainDone(true);
            }

            setStage("saving");
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
                throw new Error(
                    needsOnChainStep || onChainDone
                        ? `Your response was already recorded on Solana, but this written explanation didn't save (${supabaseError.message}). Please try again — it won't touch the blockchain step again.`
                        : `Supabase insert failed: ${supabaseError.message}`
                );
            }

            setEvidence("");
            setFile(null);
            setSubmittedOnce(true);
            onSubmitted();
            if (needsOnChainStep || onChainDone) onCounterEvidenceRecorded?.();
        } catch (err: any) {
            console.error(err);
            setError(err.message ?? "Your evidence didn't save. Try again.");
        } finally {
            setSubmitting(false);
            setStage(null);
        }
    }

    const buttonLabel = submitting
        ? stage === "chain"
            ? "Confirm in your wallet…"
            : "Saving…"
        : "Submit evidence";

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
            <button onClick={handleSubmit} disabled={submitting} className={`${btn.quiet} mt-4`}>
                {buttonLabel}
            </button>
        </div>
    );
}

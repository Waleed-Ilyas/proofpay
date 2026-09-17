"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { sha256ToHex } from "@/lib/hash";

interface SubmitEvidenceFormProps {
    escrowAddress: string;
    submittedBy: string;
    role: "client" | "expert";
    onSubmitted: () => void;
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
}: SubmitEvidenceFormProps) {
    const [evidence, setEvidence] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submittedOnce, setSubmittedOnce] = useState(false);

    async function handleSubmit() {
        setError(null);

        if (!evidence.trim()) {
            setError("Describe your side before submitting.");
            return;
        }

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
        } catch (err: any) {
            console.error(err);
            setError(err.message ?? "Your evidence didn't save. Try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="mt-3 p-4 border border-[#2A2E3A] rounded-sm bg-[#10121A]">
            <p className="text-sm font-medium text-[#B08D33] mb-2">
                {submittedOnce ? "Update your evidence" : "Submit your evidence"}
            </p>
            <textarea
                className="w-full border border-[#2A2E3A] rounded-sm p-2.5 text-sm bg-[#171A24] text-[#EDE6D6] placeholder:text-[#5A606C] focus:outline-none focus:border-[#B08D33] transition-colors"
                rows={3}
                placeholder="What happened, from your side?"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                disabled={submitting}
            />
            <div className="mt-3">
                <label className="text-xs text-[#9AA0AC] block mb-1.5">
                    Attach a screenshot or file (optional)
                </label>
                <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    disabled={submitting}
                    className="text-xs text-[#9AA0AC] file:mr-3 file:px-3 file:py-1.5 file:rounded-sm file:border file:border-[#2A2E3A] file:bg-[#171A24] file:text-[#EDE6D6] file:text-xs file:cursor-pointer hover:file:border-[#B08D33]"
                />
            </div>
            {error && <p className="text-xs text-[#C77A6C] mt-2 break-all">{error}</p>}
            <button
                onClick={handleSubmit}
                disabled={submitting}
                className="mt-3 px-4 py-2 rounded-sm border border-[#B08D33] text-[#B08D33] text-sm font-medium hover:bg-[#B08D33] hover:text-[#10121A] disabled:opacity-40 transition-colors"
            >
                {submitting ? "Submitting…" : "Submit evidence"}
            </button>
        </div>
    );
}
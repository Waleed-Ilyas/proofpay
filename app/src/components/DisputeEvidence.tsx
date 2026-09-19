"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatWhen, shorten } from "@/components/app/ui";

interface EvidenceRow {
    id: number;
    created_at: string;
    submitted_by: string;
    role: "client" | "expert";
    content: string;
    evidence_hash: string;
    attachment_url: string | null;
}

function isImageUrl(url: string) {
    return /\.(png|jpe?g|gif|webp)$/i.test(url);
}

export default function DisputeEvidence({
    escrowAddress,
    refreshKey = 0,
}: {
    escrowAddress: string;
    /** Bump this to refetch after a new filing. */
    refreshKey?: number;
}) {
    const [rows, setRows] = useState<EvidenceRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function fetchEvidence() {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from("dispute_evidence")
                .select("id, created_at, submitted_by, role, content, evidence_hash, attachment_url")
                .eq("escrow_address", escrowAddress)
                .order("created_at", { ascending: false });

            if (cancelled) return;

            if (fetchError) {
                setError(fetchError.message);
                setRows([]);
            } else {
                setRows((data as EvidenceRow[]) ?? []);
            }
            setLoading(false);
        }

        fetchEvidence();
        return () => {
            cancelled = true;
        };
    }, [escrowAddress, refreshKey]);

    if (loading) return <p className="p-5 sm:p-6 border-t border-edge text-sm text-mute">Loading evidence…</p>;
    if (error)
        return (
            <p className="p-5 sm:p-6 border-t border-edge text-sm text-flare">
                Could not load evidence: {error}
            </p>
        );

    const latestByRole = new Map<string, EvidenceRow>();
    const countByRole = new Map<string, number>();
    for (const row of rows) {
        countByRole.set(row.role, (countByRole.get(row.role) ?? 0) + 1);
        if (!latestByRole.has(row.role)) latestByRole.set(row.role, row);
    }

    return (
        <div className="p-5 sm:p-6 border-t border-edge">
            <p className="font-display text-xl">Filed evidence</p>
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
                {(["client", "expert"] as const).map((role) => {
                    const row = latestByRole.get(role);
                    const count = countByRole.get(role) ?? 0;
                    return (
                        <div key={role} className="paper rounded-[6px] p-4 text-sm">
                            <div className="flex items-baseline justify-between gap-3">
                                <p className="text-xs text-ink/60">{role === "client" ? "Client" : "Expert"} filed</p>
                                {row && (
                                    <p className="text-[11px] text-ink/50">{formatWhen(row.created_at)}</p>
                                )}
                            </div>
                            {row ? (
                                <>
                                    <p className="mt-2 leading-relaxed whitespace-pre-wrap break-words">
                                        {row.content}
                                    </p>
                                    {row.attachment_url &&
                                        (isImageUrl(row.attachment_url) ? (
                                            <a href={row.attachment_url} target="_blank" rel="noreferrer">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={row.attachment_url}
                                                    alt={`${role} attachment`}
                                                    className="mt-3 max-h-40 rounded border border-ink/20"
                                                />
                                            </a>
                                        ) : (
                                            <a
                                                href={row.attachment_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="mt-3 inline-block text-xs underline underline-offset-4"
                                            >
                                                View attached file
                                            </a>
                                        ))}
                                    <p className="addr text-[10px] text-ink/50 mt-3 break-all">
                                        sha256 {shorten(row.evidence_hash, 8)}
                                        {count > 1 ? ` · latest of ${count} filings` : ""}
                                    </p>
                                </>
                            ) : (
                                <p className="mt-2 text-ink/50 italic">Nothing filed yet.</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

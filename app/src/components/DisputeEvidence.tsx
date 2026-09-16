"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface EvidenceRow {
    id: number;
    created_at: string;
    submitted_by: string;
    role: "client" | "expert";
    content: string;
    evidence_hash: string;
}

export default function DisputeEvidence({
    escrowAddress,
}: {
    escrowAddress: string;
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
                .select("id, created_at, submitted_by, role, content, evidence_hash")
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
    }, [escrowAddress]);

    if (loading) {
        return (
            <p className="text-xs text-gray-500 mt-2">Loading evidence...</p>
        );
    }

    if (error) {
        return (
            <p className="text-xs text-red-400 mt-2">
                Could not load evidence: {error}
            </p>
        );
    }

    if (rows.length === 0) {
        return (
            <p className="text-xs text-gray-500 mt-2">
                No evidence submitted yet.
            </p>
        );
    }

    // Rows are already sorted newest-first, so the first occurrence of each
    // role is that party's latest submission. Any earlier rows for the same
    // role (e.g. from a retried transaction) are dropped.
    const latestByRole = new Map<string, EvidenceRow>();
    for (const row of rows) {
        if (!latestByRole.has(row.role)) {
            latestByRole.set(row.role, row);
        }
    }

    return (
        <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm font-medium text-gray-300">Submitted Evidence</p>
            {["client", "expert"].map((role) => {
                const row = latestByRole.get(role);
                return (
                    <div
                        key={role}
                        className="p-2 rounded-md border border-gray-700 bg-gray-800/60"
                    >
                        <p className="text-xs font-semibold text-gray-400 capitalize mb-1">
                            {role}
                        </p>
                        {row ? (
                            <p className="text-sm text-gray-200 whitespace-pre-wrap">
                                {row.content}
                            </p>
                        ) : (
                            <p className="text-xs text-gray-500 italic">
                                No evidence submitted yet.
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
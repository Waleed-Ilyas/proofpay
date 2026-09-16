"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ResolutionRow {
    favor_expert: boolean;
    reasoning: string;
    resolved_at: string;
}

export default function DisputeResolution({
    escrowAddress,
}: {
    escrowAddress: string;
}) {
    const [resolution, setResolution] = useState<ResolutionRow | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function fetchResolution() {
            setLoading(true);
            const { data } = await supabase
                .from("dispute_resolutions")
                .select("favor_expert, reasoning, resolved_at")
                .eq("escrow_address", escrowAddress)
                .order("resolved_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!cancelled) {
                setResolution(data as ResolutionRow | null);
                setLoading(false);
            }
        }

        fetchResolution();
        return () => {
            cancelled = true;
        };
    }, [escrowAddress]);

    if (loading || !resolution) return null;

    return (
        <div className="mt-3 p-3 rounded-md border border-purple-800 bg-purple-950/30">
            <p className="text-sm font-medium text-purple-300 mb-1">
                AI Resolution: Funds released to {resolution.favor_expert ? "Expert" : "Client"}
            </p>
            <p className="text-sm text-gray-300">{resolution.reasoning}</p>
        </div>
    );
}
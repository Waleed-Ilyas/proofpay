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
        <div className="mt-3 p-4 rounded-sm border border-[#3F6B4F] bg-[#3F6B4F]/10 pp-verdict-in">
            <p className="font-display text-base text-[#7FA88C] mb-1.5">
                Arbitrator ruled for the {resolution.favor_expert ? "expert" : "client"}
            </p>
            <p className="text-sm text-[#9AA0AC]">{resolution.reasoning}</p>
        </div>

    );
}
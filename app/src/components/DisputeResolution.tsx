"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { explorerTx, formatWhen } from "@/components/app/ui";
import VerifyRuling from "@/components/VerifyRuling";

interface ResolutionRow {
    favor_expert: boolean;
    reasoning: string;
    resolved_at: string;
}

export default function DisputeResolution({
    escrowAddress,
    status,
    txSignature,
}: {
    escrowAddress: string;
    /** Passing the escrow status refetches when it changes, so a fresh ruling appears without a reload. */
    status?: string;
    txSignature?: string | null;
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
    }, [escrowAddress, status]);

    if (loading || !resolution) return null;

    const winner = resolution.favor_expert ? "expert" : "client";

    return (
        <div className="p-5 sm:p-6 border-t border-verdict/30 bg-verdict/[0.05] pp-verdict-in">
            <div className="paper rounded-[6px] p-5">
                <p className="text-xs text-ink/60">Record of arbitration</p>
                <p className="font-display text-2xl leading-snug mt-1">
                    Arbitrator ruled for the {winner}
                </p>
                <p className="text-sm leading-relaxed text-ink/80 mt-3">{resolution.reasoning}</p>
                <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
                    <p className="text-xs text-ink/55">{formatWhen(resolution.resolved_at)}</p>
                    <div className="-rotate-[5deg] border-2 border-[#17714d] text-[#17714d] rounded-[3px] px-3 py-1.5 mix-blend-multiply">
                        <p className="font-display text-lg leading-none">
                            {resolution.favor_expert ? "Released to expert" : "Refunded to client"}
                        </p>
                    </div>
                </div>
            </div>

            {txSignature && (
                <a
                    href={explorerTx(txSignature)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-xs text-mute underline underline-offset-4 hover:text-brass"
                >
                    View the ruling transaction on Solana Explorer
                </a>
            )}

            <VerifyRuling
                escrowAddress={escrowAddress}
                favorExpert={resolution.favor_expert}
                reasoning={resolution.reasoning}
                resolvedAt={resolution.resolved_at}
            />
        </div>
    );
}

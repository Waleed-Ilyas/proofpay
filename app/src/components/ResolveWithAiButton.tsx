"use client";

import { useEffect, useState } from "react";
import { btn } from "@/components/app/ui";

// Mirrors what the API route actually does, so the wait reads as progress
// rather than a frozen screen. Timings are approximate; the real work is
// gated on the network, so the last stage holds until the response lands.
const stages = [
    "Collecting evidence from both sides",
    "Reviewing attached files",
    "Weighing evidence against the agreed terms",
    "Signing the ruling on-chain",
];

export type ResolveResult = { txSignature?: string; verdictHash?: string; favorExpert?: boolean };

export default function ResolveWithAiButton({
    escrowAddress,
    onResolved,
}: {
    escrowAddress: string;
    onResolved: (result?: ResolveResult) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [stage, setStage] = useState(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!loading) {
            setStage(0);
            return;
        }

        const timer = setInterval(() => {
            setStage((prev) => Math.min(prev + 1, stages.length - 1));
        }, 1800);

        return () => clearInterval(timer);
    }, [loading]);

    async function handleClick() {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/resolve-dispute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ escrowAddress }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error ?? "Resolution failed");
            }

            onResolved({
                txSignature: data.txSignature,
                verdictHash: data.verdictHash,
                favorExpert: data.favor_expert,
            });
        } catch (err: any) {
            console.error(err);
            setError(err.message ?? "The arbitrator couldn't complete the ruling.");
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="w-full rounded-xl border border-brass/50 bg-brass/[0.06] p-4" aria-live="polite">
                <div className="flex items-center gap-2 mb-3">
                    <span className="font-display text-lg text-brass">Arbitrator at work</span>
                    <span className="flex gap-1">
                        <span className="w-1 h-1 rounded-full bg-brass pp-dot-1" />
                        <span className="w-1 h-1 rounded-full bg-brass pp-dot-2" />
                        <span className="w-1 h-1 rounded-full bg-brass pp-dot-3" />
                    </span>
                </div>

                <div className="relative h-0.5 bg-edge rounded-full overflow-hidden mb-3">
                    <div className="absolute inset-y-0 w-1/4 bg-brass pp-scan" />
                </div>

                <div className="space-y-1.5">
                    {stages.map((s, i) => (
                        <p
                            key={s}
                            className={`text-sm transition-colors duration-500 ${
                                i < stage ? "text-verdict" : i === stage ? "text-bone" : "text-mute/60"
                            }`}
                        >
                            {i < stage ? "✓ " : i === stage ? "› " : "  "}
                            {s}
                        </p>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div>
            <button onClick={handleClick} className={btn.primary}>
                Resolve with AI
            </button>
            {error && <p className="text-sm text-flare mt-2 break-words">{error}</p>}
        </div>
    );
}

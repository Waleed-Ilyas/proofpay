"use client";

import { useEffect, useState } from "react";

// Mirrors what the API route actually does, so the wait reads as progress
// rather than a frozen screen. Timings are approximate — the real work is
// gated on the network, so the last stage holds until the response lands.
const stages = [
    "Collecting evidence from both sides",
    "Reviewing attached files",
    "Weighing evidence against the agreed terms",
    "Signing the ruling on-chain",
];

export default function ResolveWithAiButton({
    escrowAddress,
    onResolved,
}: {
    escrowAddress: string;
    onResolved: () => void;
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

            onResolved();
        } catch (err: any) {
            console.error(err);
            setError(err.message ?? "The arbitrator couldn't complete the ruling.");
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="mt-2 w-full p-4 rounded-sm border border-[#B08D33] bg-[#B08D33]/5">
                <div className="flex items-center gap-2 mb-3">
                    <span className="font-display text-sm text-[#B08D33]">
                        Arbitrator at work
                    </span>
                    <span className="flex gap-1">
                        <span className="w-1 h-1 rounded-full bg-[#B08D33] pp-dot-1" />
                        <span className="w-1 h-1 rounded-full bg-[#B08D33] pp-dot-2" />
                        <span className="w-1 h-1 rounded-full bg-[#B08D33] pp-dot-3" />
                    </span>
                </div>

                <div className="relative h-0.5 bg-[#2A2E3A] rounded-full overflow-hidden mb-3">
                    <div className="absolute inset-y-0 w-1/4 bg-[#B08D33] pp-scan" />
                </div>

                <div className="space-y-1.5">
                    {stages.map((s, i) => (
                        <p
                            key={s}
                            className={`text-xs transition-colors duration-500 ${i < stage
                                ? "text-[#7FA88C]"
                                : i === stage
                                    ? "text-[#EDE6D6]"
                                    : "text-[#5A606C]"
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
        <div className="mt-2">
            <button
                onClick={handleClick}
                className="px-4 py-2 rounded-sm bg-[#B08D33] text-[#10121A] text-sm font-medium hover:bg-[#8C6F28] transition-colors"
            >
                Resolve with AI
            </button>
            {error && <p className="text-xs text-[#C77A6C] mt-1 break-all">{error}</p>}
        </div>
    );
}
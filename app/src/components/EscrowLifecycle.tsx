"use client";

import { useEffect, useState } from "react";

const stages = [
    { label: "Client deposits", detail: "1.00 SOL locked on-chain", tone: "bg-brass", text: "text-night" },
    { label: "Expert accepts", detail: "Work begins", tone: "bg-brass", text: "text-night" },
    { label: "Dispute raised", detail: "Both sides file evidence", tone: "bg-flare", text: "text-night" },
    { label: "Arbitrator reviews", detail: "Terms and evidence weighed", tone: "bg-flare", text: "text-night" },
    { label: "Settled on-chain", detail: "Funds released to client/expert per conditions.", tone: "bg-verdict", text: "text-night" },
];

export function EscrowLifecycle() {
    const [active, setActive] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setActive((prev) => (prev + 1) % stages.length);
        }, 2400);
        return () => clearInterval(timer);
    }, []);

    const stage = stages[active];

    return (
        <div className="w-full max-w-sm">
            <div className="bg-surface border border-edge p-5">
                <div className="flex items-center justify-between mb-5">
                    <span className="text-xs text-mute">Escrow lifecycle</span>
                    <span
                        className={`text-xs px-2.5 py-1 font-medium transition-colors duration-500 ${stage.tone} ${stage.text}`}
                    >
                        {stage.label}
                    </span>
                </div>

                <div className="relative h-1 bg-edge mb-6">
                    <div
                        className={`absolute top-0 left-0 h-1 transition-all duration-700 ease-out ${stage.tone}`}
                        style={{ width: `${((active + 1) / stages.length) * 100}%` }}
                    />
                </div>

                <p className="font-display text-xl transition-opacity duration-500">
                    {stage.detail}
                </p>

                <div className="mt-5 pt-4 border-t border-dashed border-edge space-y-1.5 text-xs addr text-mute">
                    <div className="flex justify-between">
                        <span>escrow</span>
                        <span>24Bk...KwVp</span>
                    </div>
                    <div className="flex justify-between">
                        <span>amount</span>
                        <span>1.00 SOL</span>
                    </div>
                </div>
            </div>

            <div className="flex gap-1.5 mt-3 justify-center">
                {stages.map((s, i) => (
                    <button
                        key={s.label}
                        onClick={() => setActive(i)}
                        aria-label={`Show stage: ${s.label}`}
                        className={`h-1.5 transition-all duration-300 ${i === active ? stage.tone : "bg-edge"}`}
                        style={{ width: i === active ? "24px" : "8px" }}
                    />
                ))}
            </div>
        </div>
    );
}
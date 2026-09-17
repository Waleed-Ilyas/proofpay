"use client";

import { useEffect, useState } from "react";

const stages = [
    { label: "Client deposits", detail: "1.00 SOL locked on-chain", tone: "#B08D33" },
    { label: "Expert accepts", detail: "Work begins", tone: "#B08D33" },
    { label: "Dispute raised", detail: "Both sides submit evidence", tone: "#9A4B3F" },
    { label: "AI reviews", detail: "Terms and evidence weighed", tone: "#9A4B3F" },
    { label: "Settled on-chain", detail: "Funds released to expert", tone: "#3F6B4F" },
];

export function EscrowFlowAnimation() {
    const [active, setActive] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setActive((prev) => (prev + 1) % stages.length);
        }, 2200);
        return () => clearInterval(timer);
    }, []);

    const stage = stages[active];

    return (
        <div className="w-full max-w-sm">
            <div className="bg-[#171A24] border border-[#2A2E3A] rounded-sm p-5">
                <div className="flex items-center justify-between mb-5">
                    <span className="text-xs text-[#9AA0AC]">Escrow lifecycle</span>
                    <span
                        className="text-xs px-2 py-0.5 rounded-full transition-colors duration-500"
                        style={{ backgroundColor: stage.tone, color: "#10121A" }}
                    >
                        {stage.label}
                    </span>
                </div>

                <div className="relative h-1 bg-[#2A2E3A] rounded-full mb-6">
                    <div
                        className="absolute top-0 left-0 h-1 rounded-full transition-all duration-700 ease-out"
                        style={{
                            width: `${((active + 1) / stages.length) * 100}%`,
                            backgroundColor: stage.tone,
                        }}
                    />
                    <div
                        className="absolute -top-1.5 w-4 h-4 rounded-full border-2 border-[#10121A] transition-all duration-700 ease-out"
                        style={{
                            left: `calc(${((active + 1) / stages.length) * 100}% - 8px)`,
                            backgroundColor: stage.tone,
                        }}
                    />
                </div>

                <p className="font-display text-xl transition-opacity duration-500">
                    {stage.detail}
                </p>

                <div className="mt-5 pt-4 border-t border-dashed border-[#2A2E3A] space-y-1.5 text-xs font-mono-address text-[#9AA0AC]">
                    <div className="flex justify-between">
                        <span>escrow</span>
                        <span>24Bk…KwVp</span>
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
                        className="h-1.5 rounded-full transition-all duration-300"
                        style={{
                            width: i === active ? "24px" : "8px",
                            backgroundColor: i === active ? stage.tone : "#2A2E3A",
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
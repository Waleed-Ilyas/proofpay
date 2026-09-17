"use client";

import { useEffect, useRef, useState } from "react";

// Four beats of the story, matching the four steps of the real flow.
// Each drives the characters' posture, the seal's appearance, and the caption.
const beats = [
    {
        key: "deposit",
        caption: "The client locks the payment before work begins.",
        sealTone: "#B08D33",
        sealLabel: "1.00 SOL",
    },
    {
        key: "accept",
        caption: "The expert accepts. Neither side can touch the funds.",
        sealTone: "#B08D33",
        sealLabel: "locked",
    },
    {
        key: "dispute",
        caption: "They disagree. Both sides submit their evidence.",
        sealTone: "#9A4B3F",
        sealLabel: "disputed",
    },
    {
        key: "verdict",
        caption: "The arbitrator rules, and the chain moves the money.",
        sealTone: "#3F6B4F",
        sealLabel: "settled",
    },
];

function Figure({
    x,
    label,
    tone,
    lean,
    arm,
}: {
    x: number;
    label: string;
    tone: string;
    lean: number;
    arm: number;
}) {
    return (
        <g
            transform={`translate(${x}, 0) rotate(${lean}, 0, 150)`}
            style={{ transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
            {/* head */}
            <circle cx="0" cy="74" r="20" fill={tone} />
            {/* a small notch of personality: a tilt line for the brow */}
            <rect x="-9" y="68" width="18" height="3" rx="1.5" fill="#10121A" opacity="0.35" />
            {/* body */}
            <path
                d="M -22 150 Q -22 102 0 100 Q 22 102 22 150 Z"
                fill={tone}
                opacity="0.9"
            />
            {/* arm reaching toward the centre */}
            <rect
                x="-4"
                y="108"
                width="8"
                height="34"
                rx="4"
                fill={tone}
                transform={`rotate(${arm}, 0, 112)`}
                style={{ transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)" }}
            />
            <text
                x="0"
                y="176"
                textAnchor="middle"
                fontSize="13"
                fill="#9AA0AC"
                fontFamily="var(--font-body), sans-serif"
            >
                {label}
            </text>
        </g>
    );
}

export function WorkflowScene() {
    const [beat, setBeat] = useState(0);
    const [started, setStarted] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Only start the loop once the scene is actually on screen, so the story
    // begins when the reader arrives rather than halfway through.
    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setStarted(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.4 }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!started) return;
        const timer = setInterval(() => {
            setBeat((b) => (b + 1) % beats.length);
        }, 2600);
        return () => clearInterval(timer);
    }, [started]);

    const current = beats[beat];

    // Postures per beat: the client leans in to deposit, the expert leans in to
    // accept, both lean away in dispute, and both settle upright at the verdict.
    const clientLean = [6, 0, -7, 0][beat];
    const expertLean = [0, 6, 7, 0][beat];
    const clientArm = [38, 0, -22, 0][beat];
    const expertArm = [0, -38, 22, 0][beat];

    // The seal drifts toward whoever the money ends up with.
    const sealX = [180, 200, 200, 220][beat];
    const sealScale = [0.9, 1, 1.06, 1][beat];
    const sealShake = current.key === "dispute";

    return (
        <div ref={ref} className="w-full">
            <svg
                viewBox="0 0 400 230"
                className="w-full max-w-2xl mx-auto"
                role="img"
                aria-label={current.caption}
            >
                <Figure
                    x={70}
                    label="Client"
                    tone="#8C7A52"
                    lean={clientLean}
                    arm={clientArm}
                />
                <Figure
                    x={330}
                    label="Expert"
                    tone="#6E7585"
                    lean={expertLean}
                    arm={expertArm}
                />

                {/* the escrow itself, held between them */}
                <g
                    transform={`translate(${sealX}, 112) scale(${sealScale})`}
                    style={{ transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)" }}
                    className={sealShake ? "pp-seal-shake" : ""}
                >
                    <circle
                        r="30"
                        fill={current.sealTone}
                        style={{ transition: "fill 0.8s ease" }}
                    />
                    <circle r="23" fill="#10121A" opacity="0.85" />
                    <text
                        y="4"
                        textAnchor="middle"
                        fontSize="10"
                        fill="#EDE6D6"
                        fontFamily="var(--font-mono), monospace"
                    >
                        {current.sealLabel}
                    </text>
                </g>

                {/* the line of custody between the two parties */}
                <line
                    x1="100"
                    y1="112"
                    x2="300"
                    y2="112"
                    stroke={current.sealTone}
                    strokeWidth="1"
                    strokeDasharray="4 6"
                    opacity="0.3"
                    style={{ transition: "stroke 0.8s ease" }}
                />
            </svg>

            <p className="text-center text-[#9AA0AC] mt-4 min-h-[1.5rem] transition-opacity duration-500">
                {current.caption}
            </p>

            <div className="flex gap-1.5 mt-4 justify-center">
                {beats.map((b, i) => (
                    <button
                        key={b.key}
                        onClick={() => setBeat(i)}
                        aria-label={b.caption}
                        className="h-1.5 rounded-full transition-all duration-300"
                        style={{
                            width: i === beat ? "24px" : "8px",
                            backgroundColor: i === beat ? current.sealTone : "#2A2E3A",
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
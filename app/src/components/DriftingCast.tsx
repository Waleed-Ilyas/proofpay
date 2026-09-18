"use client";

import { useEffect, useRef } from "react";

/**
 * A bounded atmosphere layer, not a page-wide screensaver.
 *
 * Sizing measures the WRAPPING element via ResizeObserver, never the canvas
 * itself. Observing the canvas's own box while also setting canvas.width /
 * canvas.height creates a feedback loop: changing the backing-store size can
 * change the element's own rendered box, which re-fires the observer, which
 * resizes it again, compounding every frame until the canvas reaches an
 * absurd size (seen in production: 33,554,432 x 33,554,432). Observing the
 * parent breaks the loop structurally, since resizing the canvas never
 * changes the parent's size.
 */

type Figure = {
    x: number;
    y: number;
    size: number;
    speed: number;
    drift: number;
    phase: number;
    spin: number;
    tone: string;
    alpha: number;
};

const TONES = ["#C09925", "#7FA9E8", "#4FB286", "#E2715A"];
const MAX_DPR = 2;

function drawFigure(ctx: CanvasRenderingContext2D, f: Figure, t: number) {
    const s = f.size;
    const lean = Math.sin(t * 0.0006 + f.phase) * 0.24;
    const strideL = Math.sin(t * 0.003 + f.phase) * 0.5;
    const strideR = Math.sin(t * 0.003 + f.phase + Math.PI) * 0.5;

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(lean * f.spin * 0.4);
    ctx.globalAlpha = f.alpha;
    ctx.fillStyle = f.tone;
    ctx.strokeStyle = f.tone;
    ctx.lineCap = "round";
    ctx.lineWidth = s * 0.16;

    ctx.beginPath();
    ctx.arc(0, -s * 1.05, s * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-s * 0.22, -s * 0.7);
    ctx.lineTo(-s * 0.26, s * 0.35);
    ctx.quadraticCurveTo(0, s * 0.48, s * 0.26, s * 0.35);
    ctx.lineTo(s * 0.22, -s * 0.7);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-s * 0.14, s * 0.3);
    ctx.lineTo(-s * 0.14 + strideL * s * 0.22, s * 0.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.14, s * 0.3);
    ctx.lineTo(s * 0.14 + strideR * s * 0.22, s * 0.95);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(s * 0.2, -s * 0.55);
    ctx.lineTo(s * 0.2 + lean * s * 1.1, -s * 1.1 - Math.abs(lean) * s * 0.4);
    ctx.stroke();

    ctx.restore();
}

export function DriftingCast() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;
        const context = el.getContext("2d");
        if (!context) return;

        const canvas: HTMLCanvasElement = el;
        const ctx: CanvasRenderingContext2D = context;

        // The element whose box we actually measure. Never the canvas itself.
        const container = canvas.parentElement;
        if (!container) return;

        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        let figures: Figure[] = [];
        let raf = 0;
        let running = false;
        let last = 0;
        let lastW = 0;
        let lastH = 0;
        const pointer = { x: -9999, y: -9999 };

        function seed(w: number, h: number) {
            const count = Math.min(28, Math.max(10, Math.round((w * h) / 46000)));
            figures = Array.from({ length: count }, () => ({
                x: Math.random() * w,
                y: (Math.random() - 0.35) * h,
                size: 7 + Math.random() * 11,
                speed: 5 + Math.random() * 11,
                drift: -6 + Math.random() * 12,
                phase: Math.random() * Math.PI * 2,
                spin: 0.6 + Math.random() * 0.8,
                tone: TONES[Math.floor(Math.random() * TONES.length)],
                alpha: 0.1 + Math.random() * 0.16,
            }));
        }

        function applySize() {
            // Measured from the CONTAINER's box, capped and rounded, so a
            // sub-pixel jitter can't retrigger a resize on the next frame.
            const rect = container!.getBoundingClientRect();
            const w = Math.max(1, Math.round(rect.width));
            const h = Math.max(1, Math.round(rect.height));

            if (w === lastW && h === lastH) return;
            lastW = w;
            lastH = h;

            const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

            // CSS box is set explicitly and independently of the backing store,
            // so changing width/height below cannot change the element's own
            // rendered size and cannot re-trigger this observer.
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            if (figures.length === 0) seed(w, h);
        }

        function frame(now: number) {
            const w = lastW;
            const h = lastH;
            const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
            last = now;

            ctx.clearRect(0, 0, w, h);

            for (const f of figures) {
                f.y -= f.speed * dt;
                f.x += (f.drift + Math.sin(now * 0.0004 + f.phase) * 8) * dt;

                const dx = f.x - pointer.x;
                const dy = f.y - pointer.y;
                const dist = Math.hypot(dx, dy);
                if (dist < 120 && dist > 0.001) {
                    const push = (1 - dist / 120) * 26 * dt;
                    f.x += (dx / dist) * push;
                    f.y += (dy / dist) * push;
                }

                if (f.y < -40) {
                    f.y = h + 30;
                    f.x = Math.random() * w;
                }
                if (f.x < -40) f.x = w + 30;
                if (f.x > w + 40) f.x = -30;

                drawFigure(ctx, f, now);
            }

            raf = requestAnimationFrame(frame);
        }

        function start() {
            if (running || reduce) return;
            running = true;
            last = performance.now();
            raf = requestAnimationFrame(frame);
        }

        function stop() {
            running = false;
            cancelAnimationFrame(raf);
        }

        function onPointer(e: PointerEvent) {
            const rect = canvas.getBoundingClientRect();
            pointer.x = e.clientX - rect.left;
            pointer.y = e.clientY - rect.top;
        }

        function onLeave() {
            pointer.x = -9999;
            pointer.y = -9999;
        }

        function onVisibility() {
            if (document.hidden) stop();
            else start();
        }

        applySize();

        if (reduce) {
            seed(lastW, lastH);
            figures.forEach((f) => drawFigure(ctx, f, 0));
        }

        // Observing the container, not the canvas. Resizing the canvas below
        // cannot change the container's box, so this cannot self-trigger.
        const ro = new ResizeObserver(() => applySize());
        ro.observe(container);

        const io = new IntersectionObserver(
            ([entry]) => (entry.isIntersecting ? start() : stop()),
            { threshold: 0 }
        );
        io.observe(canvas);

        container.addEventListener("pointermove", onPointer);
        container.addEventListener("pointerleave", onLeave);
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            stop();
            ro.disconnect();
            io.disconnect();
            container.removeEventListener("pointermove", onPointer);
            container.removeEventListener("pointerleave", onLeave);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none z-0 block"
        />
    );
}
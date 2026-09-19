"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { VaultScene } from "./VaultScene";
import { STAGES, TONE } from "./stages";
import { useInView } from "@/lib/useInView";
import { useReducedMotion } from "@/lib/useReducedMotion";

const STEP_MS = 3800;

export function HeroStage() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, "0px");

  useEffect(() => {
    if (reduce || paused || !inView) return;
    const id = setInterval(() => setActive((a) => (a + 1) % STAGES.length), STEP_MS);
    return () => clearInterval(id);
  }, [reduce, paused, inView]);

  const stage = STAGES[active];
  const tone = TONE[stage.tone];

  return (
    <section ref={ref} className="relative overflow-hidden hero-atmosphere grain">
      <div className="max-w-6xl mx-auto w-full px-6 lg:px-10 pt-10 pb-16 lg:pt-8 lg:pb-14 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-10 lg:gap-8 items-center">
        <div className="relative z-10">
          <h1 className="font-display text-[3rem] leading-[1.02] sm:text-6xl lg:text-[4.6rem]">
            <span className="block hero-in">Neither of you holds the money.</span>
            <span
              className="block hero-in italic text-brass-gradient pb-1"
              style={{ animationDelay: "140ms" }}
            >
              Both of you get a hearing.
            </span>
          </h1>

          <p
            className="hero-in mt-7 text-lg leading-relaxed text-mute max-w-[30rem]"
            style={{ animationDelay: "300ms" }}
          >
            The moment a client creates an escrow, the payment is locked inside a Solana program. If
            the two sides disagree about the work, each files evidence, an AI arbitrator reads it,
            and the ruling is the transaction that moves the funds.
          </p>

          <div
            className="hero-in mt-10 flex flex-wrap items-center gap-x-6 gap-y-4"
            style={{ animationDelay: "440ms" }}
          >
            <Link href="/app" className="btn-brass px-7 py-4 text-base">
              Open the app
            </Link>
            <a
              href="#custody"
              className="font-medium whitespace-nowrap underline decoration-edge underline-offset-8 transition-colors duration-150 hover:decoration-brass"
            >
              See where the money sits
            </a>
          </div>

          <p className="hero-in mt-8 text-sm text-mute" style={{ animationDelay: "560ms" }}>
            Live on Solana devnet. Works with Phantom and Solflare.
          </p>
        </div>

        {/* The vault and its caption are stacked, so nothing covers the vault. */}
        <div
          className="relative z-10"
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          <div className="relative h-[24rem] sm:h-[31rem] lg:h-[35rem]">
            <VaultScene stage={active} />
          </div>

          <div
            className="hero-in glass border border-edge rounded-2xl p-5"
            style={{ animationDelay: "700ms" }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-mute">Escrow lifecycle</span>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors duration-500 ${tone.pill}`}
              >
                {stage.short}
              </span>
            </div>

            <div className="mt-3 flex gap-1.5">
              {STAGES.map((s, i) => (
                <button
                  key={s.short}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Show stage ${i + 1}: ${s.short}`}
                  aria-current={i === active}
                  className="group flex-1 py-2"
                >
                  <span
                    className={`block h-1 rounded-full transition-colors duration-500 ${
                      i <= active ? TONE[STAGES[i].tone].bar : "bg-edge group-hover:bg-mute/40"
                    }`}
                  />
                </button>
              ))}
            </div>

            <p className="mt-1 font-display text-[1.45rem] leading-snug min-h-[2.1rem]">
              {stage.detail}
            </p>

            <dl className="mt-3 pt-3 border-t border-dashed border-edge flex justify-between gap-4 text-xs addr text-mute">
              <div className="flex gap-3">
                <dt>escrow</dt>
                <dd>24Bk...KwVp</dd>
              </div>
              <div className="flex gap-3">
                <dt>amount</dt>
                <dd>1.00 SOL</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

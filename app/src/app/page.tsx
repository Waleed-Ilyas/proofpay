"use client";

import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { EscrowFlowAnimation } from "@/components/EscrowFlowAnimation";
import { WorkflowScene } from "@/components/WorkflowScene";

function SealEmblem() {
  return (
    <svg viewBox="0 0 200 200" className="w-32 h-32 pp-seal" aria-hidden="true">
      <circle cx="100" cy="100" r="92" fill="#B08D33" className="pp-glow" opacity="0.35" />
      <polygon
        points="100,10 124,20 148,16 162,36 184,44 180,68 194,88 180,108 184,132 162,140 148,160 124,156 100,168 76,156 52,160 38,140 16,132 20,108 6,88 20,68 16,44 38,36 52,16 76,20"
        fill="#B08D33"
      />
      <circle cx="100" cy="88" r="56" fill="#171A24" stroke="#8C6F28" strokeWidth="3" />
      <path
        d="M74 90 L94 110 L130 66"
        fill="none"
        stroke="#EDE6D6"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pp-check"
      />
    </svg>
  );
}

const steps = [
  {
    n: "1",
    title: "Client creates the escrow",
    body: "SOL is deposited into a program-owned account the moment the job starts — not held by a platform, held by code.",
  },
  {
    n: "2",
    title: "Expert accepts",
    body: "The job becomes active. Both sides know exactly where the funds are and what has to happen to release them.",
  },
  {
    n: "3",
    title: "Release, or raise a dispute",
    body: "Most jobs end with a simple release. If something's wrong, either side submits evidence — text, screenshots, or files.",
  },
  {
    n: "4",
    title: "AI reviews and settles",
    body: "A verdict is generated from the original terms and both parties' evidence, then signed and submitted on-chain.",
  },
];

export default function Landing() {
  return (
    <main className="flex flex-col flex-1">
      <header className="flex items-center justify-between px-6 md:px-12 py-6 max-w-6xl mx-auto w-full">
        <span className="font-display text-2xl">ProofPay</span>
        <Link
          href="/app"
          className="px-5 py-2 rounded-sm border border-[#B08D33] text-[#B08D33] text-sm font-medium hover:bg-[#B08D33] hover:text-[#10121A] transition-colors"
        >
          Open App
        </Link>
      </header>

      <section className="px-6 md:px-12 max-w-6xl mx-auto w-full grid md:grid-cols-2 gap-12 items-center py-12 md:py-20">
        <div>
          <h1
            className="font-display text-4xl md:text-5xl leading-tight pp-rise"
            style={{ animationDelay: "0.1s" }}
          >
            Escrow that only lets go when the work is done.
          </h1>
          <p
            className="mt-5 text-[#9AA0AC] text-lg max-w-md pp-rise"
            style={{ animationDelay: "0.25s" }}
          >
            Funds lock on Solana the moment a job starts. If the two sides
            disagree about the outcome, an AI arbitrator reads the evidence and
            settles it on-chain — no platform in the middle, no waiting weeks.
          </p>
          <div
            className="mt-8 flex flex-wrap gap-3 pp-rise"
            style={{ animationDelay: "0.4s" }}
          >
            <Link
              href="/app"
              className="px-6 py-3 rounded-sm bg-[#B08D33] text-[#10121A] font-medium hover:bg-[#8C6F28] transition-colors"
            >
              Launch App
            </Link>
            <a
              href="#how"
              className="px-6 py-3 rounded-sm border border-[#2A2E3A] text-[#EDE6D6] font-medium hover:border-[#B08D33] transition-colors"
            >
              See how it works
            </a>
          </div>
        </div>

        <div
          className="flex flex-col items-center gap-8 pp-rise"
          style={{ animationDelay: "0.3s" }}
        >
          <SealEmblem />
          <EscrowFlowAnimation />
        </div>
      </section>

      <section
        id="how"
        className="px-6 md:px-12 max-w-6xl mx-auto w-full py-16 border-t border-[#2A2E3A]"
      >
        <Reveal>
          <h2 className="font-display text-2xl mb-10">How it works</h2>
        </Reveal>

        <Reveal>
          <div className="mb-14">
            <WorkflowScene />
          </div>
        </Reveal>

        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <Reveal key={step.n} delay={i * 120}>
              <div className="relative">
                <div className="w-10 h-10 rounded-full border-2 border-[#B08D33] flex items-center justify-center font-display text-[#B08D33]">
                  {step.n}
                </div>
                <h3 className="mt-4 font-medium text-lg">{step.title}</h3>
                <p className="mt-2 text-sm text-[#9AA0AC]">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-6 md:px-12 max-w-6xl mx-auto w-full py-16 border-t border-[#2A2E3A]">
        <div className="grid md:grid-cols-3 gap-8">
          <Reveal>
            <h3 className="font-display text-xl mb-2">Evidence, not opinions</h3>
            <p className="text-sm text-[#9AA0AC]">
              Disputes are decided on what was actually submitted — not on
              whoever argues hardest or replies fastest.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <h3 className="font-display text-xl mb-2">An arbitrator that looks</h3>
            <p className="text-sm text-[#9AA0AC]">
              Screenshots and files attached as evidence are reviewed directly
              by the AI, not just described to it in text.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <h3 className="font-display text-xl mb-2">Settled on-chain</h3>
            <p className="text-sm text-[#9AA0AC]">
              The verdict isn&apos;t a recommendation. It&apos;s a signed Solana
              transaction that moves the funds.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="px-6 md:px-12 max-w-6xl mx-auto w-full py-20 border-t border-[#2A2E3A]">
        <Reveal>
          <div className="text-center">
            <h2 className="font-display text-3xl mb-4">
              Try it on Devnet right now.
            </h2>
            <p className="text-[#9AA0AC] mb-8 max-w-md mx-auto">
              Connect Phantom or Solflare, create an escrow, and take it all the
              way through a dispute in a couple of minutes.
            </p>
            <Link
              href="/app"
              className="inline-block px-8 py-4 rounded-sm bg-[#B08D33] text-[#10121A] font-medium hover:bg-[#8C6F28] transition-colors"
            >
              Launch App
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="px-6 md:px-12 max-w-6xl mx-auto w-full py-8 border-t border-[#2A2E3A] text-sm text-[#9AA0AC]">
        <p>ProofPay — built on Solana. Running on Devnet.</p>
      </footer>
    </main >
  );
}
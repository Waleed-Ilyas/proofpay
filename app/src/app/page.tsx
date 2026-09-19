import Link from "next/link";
import { ArbitrationRecord } from "@/components/landing/ArbitrationRecord";
import { HeroStage } from "@/components/landing/HeroStage";
import { LiveVerifier } from "@/components/landing/LiveVerifier";
import { StoryStage } from "@/components/landing/StoryStage";

function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="14" stroke="#ddb04a" strokeWidth="2.5" />
      <circle cx="16" cy="16" r="8.5" stroke="#ddb04a" strokeWidth="1.5" opacity=".6" />
      <path d="M16 6v20M6 16h20M9 9l14 14M23 9L9 23" stroke="#ddb04a" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="16" r="3" fill="#ddb04a" />
    </svg>
  );
}

const faqs = [
  {
    q: "Which wallets and which network?",
    a: "Phantom or Solflare, set to Solana devnet. Devnet SOL is free from a faucet, so nothing here costs real money.",
  },
  {
    q: "Who can raise a dispute, and when?",
    a: "Either the client or the expert, while the escrow is active. It can't be raised before the expert accepts, and it can't be raised after the money has moved.",
  },
  {
    q: "What if the client never releases the payment?",
    a: "The expert can raise a dispute while the escrow is active, and the arbitrator rules on the evidence. There is no timer in the program yet, so a dispute is the way out.",
  },
  {
    q: "Can someone change their evidence after filing?",
    a: "They can file an update. Every filing is stored with a timestamp and its SHA-256 hash, and the arbitrator reads the latest one from each side. The hash of the filing that opens the dispute is written on-chain at that moment.",
  },
  {
    q: "What does it cost to use?",
    a: "Each step is a normal Solana transaction, so there is a small network fee. Creating an escrow and raising a dispute also pay a small rent deposit for the account they create. The program itself takes no cut: releases, refunds and rulings all move the full amount.",
  },
  {
    q: "Can I open a second escrow with the same person?",
    a: "Not yet. Each client and expert wallet pair gets one escrow, so to run another you'll need a different wallet on either side.",
  },
];

export default function Landing() {
  return (
    <main className="flex flex-col flex-1">
      <header className="sticky top-0 z-40 header-solid border-b border-edge/70">
        <div className="max-w-6xl mx-auto w-full px-6 lg:px-10 h-14 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Mark />
            <span className="font-display text-2xl leading-none">ProofPay</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-mute">
            <a href="#custody" className="hover:text-bone transition-colors">How it works</a>
            <a href="#verify" className="hover:text-bone transition-colors">Verify a ruling</a>
            <a href="#faq" className="hover:text-bone transition-colors">FAQ</a>
          </nav>
          <Link href="/app" className="btn-brass text-sm px-4 py-2">
            Open the app
          </Link>
        </div>
      </header>

      <HeroStage />

      {/* Problem */}
      <section className="border-t border-edge bg-deep">
        <div className="max-w-6xl mx-auto w-full px-6 lg:px-10 py-24 lg:py-32 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-14 lg:gap-20">
          <h2 className="font-display text-4xl lg:text-5xl leading-[1.06]">
            Someone always has to go first, and that someone carries the risk.
          </h2>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-edge bg-surface p-6">
              <p className="text-sm text-flare font-medium">If the client pays first</p>
              <p className="mt-3 text-[1.05rem] leading-relaxed">
                The money is gone before anything arrives. Getting it back means asking the person who
                already has it.
              </p>
            </div>
            <div className="rounded-2xl border border-edge bg-surface p-6">
              <p className="text-sm text-flare font-medium">If the expert works first</p>
              <p className="mt-3 text-[1.05rem] leading-relaxed">
                The work is delivered before anything is paid. Getting paid means asking the person who
                already has the work.
              </p>
            </div>
            <div className="sm:col-span-2 rounded-2xl border border-edge p-6 bg-raised/40">
              <p className="text-sm text-mute font-medium">If a platform holds it</p>
              <p className="mt-3 text-[1.05rem] leading-relaxed">
                The risk moves to a third party who sets the rules, decides the outcome behind closed
                doors, takes a percentage, and can freeze the account while it thinks about it.
              </p>
            </div>
            <div className="sm:col-span-2 rounded-2xl border border-brass/50 p-6 bg-gradient-to-br from-brass/12 to-transparent">
              <p className="text-sm text-brass font-medium">If a program holds it</p>
              <p className="mt-3 text-[1.05rem] leading-relaxed">
                Neither party has to trust the other, and neither has to trust us with the money. The
                rules are code anyone can read, the SOL sits in an account only the program can move,
                and every ruling is public and checkable.
              </p>
            </div>
          </div>
        </div>
      </section>

      <StoryStage />

      {/* The record */}
      <section className="border-t border-edge bg-deep">
        <div className="max-w-6xl mx-auto w-full px-6 lg:px-10 py-24 lg:py-32 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-14 lg:gap-20 items-center">
          <div>
            <h2 className="font-display text-4xl lg:text-5xl leading-[1.06]">
              A disagreement becomes a record, not an argument
            </h2>
            <p className="mt-6 text-mute leading-relaxed">
              Each side files what was agreed, what happened, and any screenshots that show it. Every
              filing is hashed and timestamped the moment it is submitted, and the arbitrator reads the
              latest one from each side.
            </p>
            <p className="mt-4 text-mute leading-relaxed">
              Attached images are read directly. A claim about a delivered dashboard is checked against
              a picture of the dashboard, not against a description of it.
            </p>
          </div>
          <ArbitrationRecord />
        </div>
      </section>

      {/* Verify */}
      <section id="verify" className="relative border-t border-edge vault-atmosphere">
        <div className="max-w-6xl mx-auto w-full px-6 lg:px-10 py-24 lg:py-32 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-14 lg:gap-20 items-start">
          <div className="lg:sticky lg:top-24">
            <h2 className="font-display text-4xl lg:text-5xl leading-[1.06]">
              Check the ruling yourself
            </h2>
            <p className="mt-6 text-mute leading-relaxed">
              A database can be edited afterwards. So when a dispute settles, the whole record is hashed
              and that fingerprint is written into the dispute account on Solana, in the same
              transaction that moves the money.
            </p>
            <p className="mt-4 text-mute leading-relaxed">
              Recompute it from the published record. If one character of the reasoning changed later,
              the two values stop matching.
            </p>

            <ol className="mt-8 space-y-4 border-l border-edge pl-6">
              <li>
                <p className="text-sm text-mute">1. The published record</p>
                <p className="mt-0.5">terms, client filing, expert filing, decision, reasoning</p>
              </li>
              <li>
                <p className="text-sm text-mute">2. Hashed with SHA-256</p>
                <p className="mt-0.5">One fingerprint, 64 characters</p>
              </li>
              <li>
                <p className="text-sm text-mute">3. Compared with verdict_hash on-chain</p>
                <p className="mt-0.5 text-verdict">If they match, the record is untouched</p>
              </li>
            </ol>
          </div>

          <LiveVerifier />
        </div>
      </section>

      {/* The arbitrator */}
      <section className="border-t border-edge bg-deep">
        <div className="max-w-6xl mx-auto w-full px-6 lg:px-10 py-24 lg:py-32">
          <div className="max-w-2xl">
            <h2 className="font-display text-4xl lg:text-5xl leading-[1.06]">
              One arbitrator, a short list of powers
            </h2>
            <p className="mt-6 text-lg text-mute leading-relaxed">
              An AI model reads the agreed work, both filings and any attached images, and returns a
              ruling with its reasoning. The program accepts a ruling from exactly one key, and that key's
              powers are narrow.
            </p>
          </div>

          <div className="mt-14 grid md:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-edge bg-surface p-7">
              <p className="font-display text-2xl">What it can do</p>
              <ul className="mt-5 space-y-3 text-mute leading-relaxed">
                <li>Send the escrowed SOL to the client or to the expert, once per dispute.</li>
                <li>Record its decision and the record&apos;s fingerprint on-chain.</li>
                <li>Rule only on an escrow that is actually in dispute.</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-edge bg-surface p-7">
              <p className="font-display text-2xl">What it can&apos;t do</p>
              <ul className="mt-5 space-y-3 text-mute leading-relaxed">
                <li>Send the SOL to anyone other than the client or the expert.</li>
                <li>Rule a second time on a dispute that is already resolved.</li>
                <li>Quietly alter a ruling afterwards. The published record would stop matching its fingerprint.</li>
              </ul>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-flare/40 bg-flare/[0.06] p-7">
            <p className="font-display text-2xl text-flare">Limits, stated plainly</p>
            <ul className="mt-5 grid md:grid-cols-2 gap-x-10 gap-y-3 text-mute leading-relaxed">
              <li>It is an AI model, and it can be wrong. That is why its reasoning is public.</li>
              <li>
                Today the ruling key is a single key held by ProofPay&apos;s backend. A decentralized
                validator set is the intended next step.
              </li>
              <li>This runs on Solana devnet and has not been audited. Use test SOL only.</li>
              <li>Attachments are stored at public links, so don&apos;t upload anything private.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-edge bg-surface">
        <div className="max-w-6xl mx-auto w-full px-6 lg:px-10 py-24 lg:py-32 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-14 lg:gap-20">
          <h2 className="font-display text-4xl lg:text-5xl leading-[1.06]">Questions people ask</h2>
          <div className="divide-y divide-edge border-y border-edge">
            {faqs.map((f) => (
              <details key={f.q} className="faq group py-1">
                <summary className="flex items-center justify-between gap-6 py-5">
                  <span className="text-lg">{f.q}</span>
                  <span className="plus shrink-0 grid place-items-center size-8 rounded-full border border-edge text-brass text-xl leading-none">
                    +
                  </span>
                </summary>
                <p className="pb-6 pr-12 text-mute leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Close */}
      <section className="relative overflow-hidden border-t border-edge hero-atmosphere grain">
        <div className="max-w-6xl mx-auto w-full px-6 lg:px-10 py-24 lg:py-32 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-14 lg:gap-20 items-center">
          <div>
            <h2 className="font-display text-5xl lg:text-6xl leading-[1.04]">
              Run a whole dispute in about four minutes
            </h2>
            <p className="mt-6 text-lg text-mute leading-relaxed max-w-[30rem]">
              Point Phantom or Solflare at devnet, create an escrow, argue with yourself from two
              wallets, and watch the ruling settle it.
            </p>
            <Link href="/app" className="btn-brass mt-10 px-8 py-4 text-base">
              Open the app
            </Link>
          </div>

          <ol className="space-y-4">
            {[
              ["Create an escrow", "From the first wallet, name the expert's address and an amount."],
              ["Accept it", "Switch to the expert's wallet and accept the job."],
              ["Raise a dispute", "Either wallet can. Both sides then file their evidence."],
              ["Resolve with AI", "The arbitrator rules, the SOL moves, and the fingerprint lands on-chain."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-5 rounded-2xl border border-edge bg-surface/70 glass p-5">
                <span className="font-display text-3xl text-brass leading-none w-6 shrink-0">{i + 1}</span>
                <div>
                  <p className="font-medium">{t}</p>
                  <p className="text-sm text-mute mt-1 leading-relaxed">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-edge bg-deep">
        <div className="max-w-6xl mx-auto w-full px-6 lg:px-10 py-8 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-mute">
          <span className="flex items-center gap-2 text-bone">
            <Mark /> ProofPay
          </span>
          <span>Solana devnet</span>
          <a
            href="https://github.com/Waleed-Ilyas/proofpay"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-edge underline-offset-4 whitespace-nowrap transition-colors duration-150 hover:decoration-brass"
          >
            Source on GitHub
          </a>
        </div>
      </footer>
    </main>
  );
}

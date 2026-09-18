import Link from "next/link";
import { ArbitrationRecord } from "@/components/ArbitrationRecord";
import { CustodyLedger } from "@/components/CustodyLedger";
import { DriftingCast } from "@/components/DriftingCast";
import { EscrowLifecycle } from "@/components/EscrowLifecycle";
import { HashCrystal } from "@/components/HashCrystal";

export default function Landing() {
  return (
    <main className="flex flex-col flex-1">
      <header className="border-b border-edge relative z-10">
        <div className="max-w-6xl mx-auto w-full px-6 lg:px-10 py-5 flex items-center justify-between gap-6">
          <span className="font-display text-2xl leading-none">ProofPay</span>
          <Link
            href="/app"
            className="text-sm font-semibold bg-brass text-night px-4 py-2 whitespace-nowrap transition-opacity duration-150 hover:opacity-90"
          >
            Open the app
          </Link>
        </div>
      </header>

      {/* Hook: the drifting cast lives only in this section */}
      <section className="relative overflow-hidden bg-night isolate hero-atmosphere">
        <DriftingCast />
        <div className="relative max-w-6xl mx-auto w-full px-6 lg:px-10 pt-14 pb-20 lg:pt-16 lg:pb-24 grid lg:grid-cols-[1.05fr_minmax(0,1fr)] gap-14 lg:gap-20 items-center">
          <div>
            <h1 className="font-display text-4xl lg:text-5xl leading-[1.08]">
              Neither of you holds the money. Both of you get a hearing.
            </h1>
            <p className="mt-7 text-lg leading-relaxed text-mute max-w-md">
              Payment sits inside a Solana program from the moment work starts.
              If the two sides disagree about the result, each files evidence
              and the ruling is the transaction that moves the funds.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-5">
              <Link
                href="/app"
                className="bg-brass text-night px-6 py-3.5 font-semibold whitespace-nowrap transition-opacity duration-150 hover:opacity-90"
              >
                Open the app
              </Link>
              <a
                href="#custody"
                className="font-medium whitespace-nowrap underline decoration-edge underline-offset-8 transition-colors duration-150 hover:decoration-brass"
              >
                See where the money sits
              </a>
            </div>
          </div>

          <div className="w-full flex justify-center">
            <EscrowLifecycle />
          </div>
        </div>
      </section>

      {/* Solution: the record itself */}
      <section className="border-t border-edge bg-surface">
        <div className="max-w-6xl mx-auto w-full px-6 lg:px-10 py-24 lg:py-32 grid lg:grid-cols-[1fr_minmax(0,1.05fr)] gap-14 lg:gap-20 items-center">
          <div>
            <h2 className="font-display text-3xl lg:text-4xl leading-tight">
              A disagreement becomes a record, not an argument
            </h2>
            <p className="mt-5 text-mute leading-relaxed">
              Each side files once: what was agreed, what happened, and any
              screenshots that show it. The text is hashed the moment it is
              submitted, so neither party can quietly revise their story after
              reading the other one.
            </p>
            <p className="mt-4 text-mute leading-relaxed">
              Attached images are read by the arbitrator directly. A claim about
              a delivered dashboard is checked against a picture of the
              dashboard, not against a description of it.
            </p>
          </div>
          <ArbitrationRecord />
        </div>
      </section>

      {/* Problem */}
      <section className="border-t border-edge">
        <div className="max-w-6xl mx-auto w-full px-6 lg:px-10 py-24 lg:py-32 grid lg:grid-cols-[1fr_minmax(0,1.15fr)] gap-14 lg:gap-20">
          <h2 className="font-display text-3xl lg:text-4xl leading-tight">
            Someone always has to go first, and that someone carries the risk.
          </h2>

          <div className="grid sm:grid-cols-2 gap-px bg-edge border border-edge">
            <div className="bg-night p-6">
              <p className="text-sm text-flare font-medium">
                If the client pays first
              </p>
              <p className="mt-3 text-[1.05rem] leading-relaxed">
                The money is gone before anything arrives. Getting it back means
                asking the person who already has it.
              </p>
            </div>
            <div className="bg-night p-6">
              <p className="text-sm text-flare font-medium">
                If the expert works first
              </p>
              <p className="mt-3 text-[1.05rem] leading-relaxed">
                The work is delivered before anything is paid. Getting paid
                means asking the person who already has the work.
              </p>
            </div>
            <div className="bg-night p-6 sm:col-span-2">
              <p className="text-sm text-mute font-medium">
                If a platform holds it
              </p>
              <p className="mt-3 text-[1.05rem] leading-relaxed">
                The risk moves to a third party who sets the rules, decides the
                outcome behind closed doors, takes a percentage, and can freeze
                the account while it thinks about it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="custody" className="border-t border-edge bg-surface">
        <div className="max-w-6xl mx-auto w-full px-6 lg:px-10 py-24 lg:py-32">
          <div className="grid lg:grid-cols-[1fr_minmax(0,1.6fr)] gap-12 lg:gap-20 items-start">
            <div className="lg:sticky lg:top-12">
              <h2 className="font-display text-3xl lg:text-4xl leading-tight">
                Where the SOL is, at every state
              </h2>
              <p className="mt-5 text-mute leading-relaxed">
                Escrow normally means a company is holding your money and
                promising to be fair about it. Here a program holds it, and the
                third column is the reason that matters.
              </p>
            </div>
            <CustodyLedger />
          </div>
        </div>
      </section>

      {/* Proof */}
      <section className="relative overflow-hidden border-t border-edge proof-atmosphere">
        <div className="relative max-w-6xl mx-auto w-full px-6 lg:px-10 py-24 lg:py-32 grid lg:grid-cols-[1fr_minmax(0,1.1fr)] gap-14 lg:gap-20 items-center">
          <div>
            <HashCrystal />
            <h2 className="font-display text-3xl lg:text-4xl leading-tight mt-8">
              Check the ruling yourself
            </h2>
            <p className="mt-5 text-mute leading-relaxed">
              A database can be edited afterwards. So when a dispute settles,
              the whole record is hashed and that fingerprint is written into
              the dispute account on Solana, in the same transaction that moves
              the money.
            </p>
            <p className="mt-4 text-mute leading-relaxed">
              Recompute it from the published record. If one character of the
              reasoning changed later, the two values stop matching.
            </p>
          </div>

          <div className="border border-edge">
            <div className="px-6 py-5 border-b border-edge">
              <p className="text-sm text-mute">1. The published record</p>
              <p className="mt-2 text-[1.05rem] leading-relaxed">
                terms, client filing, expert filing, decision, reasoning
              </p>
            </div>
            <div className="px-6 py-5 border-b border-edge">
              <p className="text-sm text-mute">2. Hashed with SHA-256</p>
              <p className="addr text-xs mt-2 text-signal scroll-x whitespace-nowrap">
                8f3ac91b7e2d4a6058fc1e9b3d7a24e0d21c
              </p>
            </div>
            <div className="px-6 py-5 bg-verdict text-night">
              <p className="text-sm font-medium">
                3. Compared with verdict_hash on-chain
              </p>
              <p className="font-display text-xl mt-2">The values match</p>
            </div>
          </div>
        </div>
      </section>

      {/* Close */}
      <section className="border-t border-edge bg-surface">
        <div className="max-w-6xl mx-auto w-full px-6 lg:px-10 py-24 lg:py-32">
          <div className="max-w-2xl">
            <h2 className="font-display text-4xl lg:text-5xl leading-[1.08]">
              Run a whole dispute in about four minutes
            </h2>
            <p className="mt-6 text-lg text-mute leading-relaxed">
              Point Phantom or Solflare at devnet, create an escrow, argue with
              yourself from two wallets, and watch the ruling settle it.
            </p>
            <Link
              href="/app"
              className="inline-block mt-10 bg-brass text-night px-7 py-4 font-semibold whitespace-nowrap transition-opacity duration-150 hover:opacity-90"
            >
              Open the app
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-edge">
        <div className="max-w-6xl mx-auto w-full px-6 lg:px-10 py-8 flex flex-wrap gap-x-8 gap-y-2 text-sm text-mute">
          <span>ProofPay</span>
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
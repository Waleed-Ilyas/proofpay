"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { CreateEscrowForm } from "@/components/CreateEscrowForm";
import { EscrowCard } from "@/components/EscrowCard";
import { VaultScene } from "@/components/landing/VaultScene";
import { CopyButton, btn, formatSol, shorten } from "@/components/app/ui";
import { useEscrows } from "@/hooks/useEscrows";

const WalletMultiButton = dynamic(
    () =>
        import("@solana/wallet-adapter-react-ui").then(
            (mod) => mod.WalletMultiButton
        ),
    { ssr: false }
);

type Filter = "open" | "settled" | "all";

const filters: { key: Filter; label: string }[] = [
    { key: "open", label: "Open" },
    { key: "settled", label: "Settled" },
    { key: "all", label: "All" },
];

// Escrow records live on-chain and can't be deleted, and that permanence is the
// point of the product. This filter just controls what the person sees on their
// own dashboard; nothing is hidden from the chain or from the other party.
const openStatuses = ["awaitingAcceptance", "active", "disputed"];

function Mark() {
    return (
        <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <circle cx="16" cy="16" r="14" stroke="#ddb04a" strokeWidth="2.5" />
            <circle cx="16" cy="16" r="8.5" stroke="#ddb04a" strokeWidth="1.5" opacity=".6" />
            <path d="M16 6v20M6 16h20M9 9l14 14M23 9L9 23" stroke="#ddb04a" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="16" cy="16" r="3" fill="#ddb04a" />
        </svg>
    );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
    return (
        <div className="rounded-2xl border border-edge bg-surface px-5 py-4">
            <p className="text-sm text-mute">{label}</p>
            <p className="mt-1 font-display text-4xl leading-none">
                {value}
                {unit && <span className="ml-1.5 text-lg text-mute">{unit}</span>}
            </p>
        </div>
    );
}

export default function AppPage() {
    const { publicKey, connected, disconnect } = useWallet();
    const { escrows, loading, refetch } = useEscrows();
    const [filter, setFilter] = useState<Filter>("open");

    const visibleEscrows = useMemo(() => {
        if (filter === "all") return escrows;
        if (filter === "open") {
            return escrows.filter((e) => openStatuses.includes(e.status));
        }
        return escrows.filter((e) => !openStatuses.includes(e.status));
    }, [escrows, filter]);

    const stats = useMemo(() => {
        const open = escrows.filter((e) => openStatuses.includes(e.status));
        return {
            held: open.reduce((sum, e) => sum + e.amount, 0),
            openCount: open.length,
            settledCount: escrows.length - open.length,
        };
    }, [escrows]);

    const address = publicKey?.toBase58();

    return (
        <main className="flex flex-col flex-1 vault-atmosphere">
            <header className="sticky top-0 z-40 header-solid border-b border-edge/70">
                <div className="max-w-6xl mx-auto w-full px-6 lg:px-10 h-14 flex items-center justify-between gap-4">
                    <Link href="/" className="flex items-center gap-2.5">
                        <Mark />
                        <span className="font-display text-2xl leading-none">ProofPay</span>
                        <span className="hidden sm:inline text-xs text-brass border border-brass/40 rounded-full px-2 py-0.5">
                            Devnet
                        </span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <WalletMultiButton />
                        {connected && (
                            <button
                                onClick={() => disconnect()}
                                className="hidden sm:inline-flex px-4 py-2.5 rounded-lg border border-edge text-mute text-sm font-medium hover:border-flare hover:text-flare transition-colors"
                            >
                                Log out
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {!connected ? (
                <section className="flex-1 max-w-6xl mx-auto w-full px-6 lg:px-10 py-12 lg:py-16 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-10 items-center">
                    <div>
                        <h1 className="font-display text-5xl lg:text-6xl leading-[1.04]">
                            Connect your wallet
                        </h1>
                        <p className="mt-6 text-lg text-mute leading-relaxed max-w-[30rem]">
                            ProofPay uses your Solana wallet as your account. Set Phantom or Solflare to
                            Devnet, then connect to create or accept an escrow.
                        </p>
                        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                            <WalletMultiButton />
                            <a
                                href="https://faucet.solana.com"
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-mute underline decoration-edge underline-offset-8 hover:decoration-brass hover:text-bone transition-colors"
                            >
                                Need devnet SOL? Get some free
                            </a>
                        </div>
                    </div>
                    <div className="relative h-[22rem] sm:h-[30rem]">
                        <VaultScene stage={0} />
                    </div>
                </section>
            ) : (
                <section className="max-w-6xl mx-auto w-full px-6 lg:px-10 py-10">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <h1 className="font-display text-4xl lg:text-5xl leading-none">Your escrows</h1>
                            {address && (
                                <p className="mt-3 flex items-center gap-1 text-sm text-mute">
                                    Your address
                                    <span className="addr text-[13px] text-bone/90 ml-1.5">{shorten(address, 6)}</span>
                                    <CopyButton value={address} label="your wallet address" />
                                </p>
                            )}
                        </div>
                        <button onClick={refetch} className={btn.quiet}>
                            Refresh
                        </button>
                    </div>

                    <div className="mt-6 grid sm:grid-cols-3 gap-4">
                        <Stat label="SOL held in escrow" value={formatSol(stats.held)} unit="SOL" />
                        <Stat label="Open escrows" value={String(stats.openCount)} />
                        <Stat label="Settled" value={String(stats.settledCount)} />
                    </div>

                    <div className="mt-8 grid lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] gap-8 items-start">
                        <div className="lg:sticky lg:top-20">
                            <CreateEscrowForm onCreated={refetch} />
                        </div>

                        <div className="flex flex-col gap-4 min-w-0">
                            <div role="tablist" aria-label="Filter escrows" className="flex gap-1 p-1 rounded-xl bg-surface border border-edge w-fit">
                                {filters.map((f) => (
                                    <button
                                        key={f.key}
                                        role="tab"
                                        aria-selected={filter === f.key}
                                        onClick={() => setFilter(f.key)}
                                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                            filter === f.key
                                                ? "bg-brass text-night"
                                                : "text-mute hover:text-bone"
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            {loading && escrows.length === 0 && (
                                <div className="space-y-4" aria-label="Loading escrows">
                                    {[0, 1].map((i) => (
                                        <div key={i} className="h-56 rounded-2xl border border-edge bg-surface animate-pulse" />
                                    ))}
                                </div>
                            )}

                            {!loading && escrows.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-edge p-8 text-center">
                                    <p className="font-display text-2xl">No escrows yet</p>
                                    <p className="mt-2 text-sm text-mute leading-relaxed max-w-sm mx-auto">
                                        Create one on the left, or send your address to a client so they can
                                        create one for you.
                                    </p>
                                </div>
                            )}

                            {!loading && escrows.length > 0 && visibleEscrows.length === 0 && (
                                <p className="text-sm text-mute">
                                    Nothing here. Switch to another tab to see your other escrows.
                                </p>
                            )}

                            {visibleEscrows.map((escrow) => (
                                <EscrowCard
                                    key={escrow.publicKey}
                                    escrow={escrow}
                                    onActionComplete={refetch}
                                />
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </main>
    );
}

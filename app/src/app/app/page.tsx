"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { CreateEscrowForm } from "@/components/CreateEscrowForm";
import { EscrowCard } from "@/components/EscrowCard";
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

// Escrow records live on-chain and can't be deleted — that permanence is the
// point of the product. This filter just controls what the person sees on their
// own dashboard; nothing is hidden from the chain or from the other party.
const openStatuses = ["awaitingAcceptance", "active", "disputed"];

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

    return (
        <main className="flex flex-col flex-1">
            <header className="flex items-center justify-between px-6 md:px-12 py-6 max-w-6xl mx-auto w-full border-b border-[#2A2E3A]">
                <Link href="/" className="font-display text-2xl">
                    ProofPay
                </Link>
                <div className="flex items-center gap-3">
                    <WalletMultiButton />
                    {connected && (
                        <button
                            onClick={() => disconnect()}
                            className="px-4 py-2 rounded-sm border border-[#2A2E3A] text-[#9AA0AC] text-sm font-medium hover:border-[#9A4B3F] hover:text-[#C77A6C] transition-colors"
                        >
                            Log out
                        </button>
                    )}
                </div>
            </header>

            {!connected ? (
                <section className="flex-1 flex items-center justify-center px-6 py-24">
                    <div className="text-center max-w-md">
                        <h1 className="font-display text-3xl mb-3">Connect your wallet</h1>
                        <p className="text-[#9AA0AC] mb-8">
                            ProofPay uses your Solana wallet as your account. Set Phantom or
                            Solflare to Devnet, then connect to create or accept an escrow.
                        </p>
                        <div className="flex justify-center">
                            <WalletMultiButton />
                        </div>
                    </div>
                </section>
            ) : (
                <section className="px-6 md:px-12 max-w-6xl mx-auto w-full py-12">
                    <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
                        <CreateEscrowForm onCreated={refetch} />

                        <div className="flex flex-col gap-4 w-full max-w-md">
                            <div className="flex items-center justify-between">
                                <h2 className="font-display text-xl">Your Escrows</h2>
                                <button
                                    onClick={refetch}
                                    className="text-xs text-[#9AA0AC] hover:text-[#EDE6D6]"
                                >
                                    Refresh
                                </button>
                            </div>

                            <div className="flex gap-1 p-1 rounded-sm bg-[#171A24] border border-[#2A2E3A] w-fit">
                                {filters.map((f) => (
                                    <button
                                        key={f.key}
                                        onClick={() => setFilter(f.key)}
                                        className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${filter === f.key
                                            ? "bg-[#B08D33] text-[#10121A]"
                                            : "text-[#9AA0AC] hover:text-[#EDE6D6]"
                                            }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            {loading && (
                                <p className="text-sm text-[#9AA0AC]">Loading escrows…</p>
                            )}

                            {!loading && escrows.length === 0 && (
                                <p className="text-sm text-[#9AA0AC]">
                                    No escrows yet. Create one, or ask a client to send you one.
                                </p>
                            )}

                            {!loading && escrows.length > 0 && visibleEscrows.length === 0 && (
                                <p className="text-sm text-[#9AA0AC]">
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
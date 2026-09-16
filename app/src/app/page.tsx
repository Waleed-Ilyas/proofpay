"use client";

import dynamic from "next/dynamic";
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

export default function Home() {
  const { publicKey, connected } = useWallet();
  const { escrows, loading, refetch } = useEscrows();

  return (
    <main className="flex flex-col items-center flex-1 gap-6 p-8">
      <h1 className="text-4xl font-bold mt-8">ProofPay</h1>
      <p className="text-gray-500">
        Trustless escrow payments for freelance work, on Solana.
      </p>

      <WalletMultiButton />

      {connected && publicKey && (
        <p className="text-sm text-gray-400">
          Connected: {publicKey.toBase58()}
        </p>
      )}

      {connected && (
        <div className="flex flex-col lg:flex-row gap-8 w-full max-w-5xl items-start justify-center mt-4">
          <CreateEscrowForm onCreated={refetch} />

          <div className="flex flex-col gap-4 w-full max-w-md">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your Escrows</h2>
              <button
                onClick={refetch}
                className="text-xs text-gray-400 hover:text-gray-200"
              >
                Refresh
              </button>
            </div>

            {loading && (
              <p className="text-sm text-gray-500">Loading escrows...</p>
            )}

            {!loading && escrows.length === 0 && (
              <p className="text-sm text-gray-500">
                No escrows yet. Create one, or ask a client to send you one.
              </p>
            )}

            {escrows.map((escrow) => (
              <EscrowCard
                key={escrow.publicKey}
                escrow={escrow}
                onActionComplete={refetch}
              />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
"use client";

import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

export default function Home() {
  const { publicKey, connected } = useWallet();

  return (
    <main className="flex flex-col items-center justify-center flex-1 gap-6 p-8">
      <h1 className="text-4xl font-bold">ProofPay</h1>
      <p className="text-gray-500">
        Trustless escrow payments for freelance work, on Solana.
      </p>

      <WalletMultiButton />

      {connected && publicKey && (
        <p className="text-sm text-gray-400">
          Connected: {publicKey.toBase58()}
        </p>
      )}
    </main>
  );
}
"use client";

import { useMemo } from "react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import idl from "@/idl/proofpay.json";
import { resilientConnection } from "@/lib/resilientConnection";

export function useAnchorProgram() {
    const { connection } = useConnection();
    const wallet = useWallet();

    const provider = useMemo(() => {
        if (!wallet.publicKey || !wallet.signTransaction) return null;
        // Blockhash fetch, simulation and send all use the same commitment
        // (Phantom's guidance for avoiding spurious "blockhash not found"),
        // and a send that a lagging RPC node rejects for that reason is
        // resent instead of failing (see resilientConnection.ts).
        return new AnchorProvider(resilientConnection(connection), wallet as any, {
            commitment: "confirmed",
            preflightCommitment: "confirmed",
        });
    }, [connection, wallet]);

    const program = useMemo(() => {
        if (!provider) return null;
        return new Program(idl as any, provider);
    }, [provider]);

    return { program, provider };
}

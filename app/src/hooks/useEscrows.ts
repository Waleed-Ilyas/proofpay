"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAnchorProgram } from "./useAnchorProgram";

export interface EscrowData {
    publicKey: string;
    client: string;
    expert: string;
    amount: number; // in SOL, for display
    status: string;
}

export function useEscrows() {
    const { program } = useAnchorProgram();
    const { publicKey } = useWallet();

    const [escrows, setEscrows] = useState<EscrowData[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchEscrows = useCallback(async () => {
        if (!program || !publicKey) {
            setEscrows([]);
            return;
        }

        setLoading(true);
        try {
            // Escrow account layout: 8-byte discriminator, then client (32 bytes)
            // at offset 8, then expert (32 bytes) at offset 40.
            const accountNamespace = program.account as any;

            const [asClient, asExpert] = await Promise.all([
                accountNamespace.escrow.all([
                    { memcmp: { offset: 8, bytes: publicKey.toBase58() } },
                ]),
                accountNamespace.escrow.all([
                    { memcmp: { offset: 40, bytes: publicKey.toBase58() } },
                ]),
            ]);

            const combined = [...asClient, ...asExpert];

            // Dedupe in case the same wallet is somehow both (shouldn't normally happen)
            const seen = new Set<string>();
            const parsed: EscrowData[] = [];

            for (const item of combined) {
                const key = item.publicKey.toBase58();
                if (seen.has(key)) continue;
                seen.add(key);

                const account = item.account as any;
                const statusKey = Object.keys(account.status)[0];

                parsed.push({
                    publicKey: key,
                    client: account.client.toBase58(),
                    expert: account.expert.toBase58(),
                    amount: account.amount.toNumber() / 1_000_000_000,
                    status: statusKey,
                });
            }

            setEscrows(parsed);
        } catch (err) {
            console.error("Failed to fetch escrows:", err);
            setEscrows([]);
        } finally {
            setLoading(false);
        }
    }, [program, publicKey]);

    useEffect(() => {
        fetchEscrows();
    }, [fetchEscrows]);

    return { escrows, loading, refetch: fetchEscrows };
}
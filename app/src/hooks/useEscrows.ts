"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAnchorProgram } from "./useAnchorProgram";
import { supabase } from "@/lib/supabase";

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

    // Guards a delayed background refetch (see refetchSoon) against clobbering
    // a more recent optimistic update with stale data the RPC hasn't caught
    // up to yet.
    const version = useRef(0);

    // Solana's public devnet RPC can serve a stale getProgramAccounts snapshot
    // for several seconds AFTER a transaction it already confirmed -- long
    // enough for a delayed background refetch to land in that window and
    // "revert" an escrow we already know just settled back to its old status.
    // A short-lived pin means: for a little while after WE perform a
    // settling action ourselves, don't trust a fetch that disagrees with what
    // we already confirmed on-chain. It expires on its own, so a pair that
    // legitimately reuses the same (now-settled) address for a fresh escrow
    // shortly after isn't permanently masked.
    const pins = useRef(new Map<string, { status: string; expiresAt: number }>());
    const PIN_DURATION_MS = 20_000;

    const fetchEscrows = useCallback(async () => {
        if (!program || !publicKey) {
            setEscrows([]);
            return;
        }

        setLoading(true);
        const myVersion = ++version.current;
        try {
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
            const seen = new Set<string>();
            const parsed: EscrowData[] = [];

            for (const item of combined) {
                const key = item.publicKey.toBase58();
                if (seen.has(key)) continue;
                seen.add(key);

                const account = item.account as any;
                const statusKey = Object.keys(account.status)[0];

                let effectiveStatus = statusKey;
                const pin = pins.current.get(key);
                if (pin && pin.expiresAt > Date.now() && pin.status !== statusKey) {
                    // We know for certain this address just settled (we did
                    // it ourselves); trust that over a lagging RPC snapshot
                    // that still shows its pre-settlement status.
                    effectiveStatus = pin.status;
                }

                parsed.push({
                    publicKey: key,
                    client: account.client.toBase58(),
                    expert: account.expert.toBase58(),
                    amount: account.amount.toNumber() / 1_000_000_000,
                    status: effectiveStatus,
                });
            }

            // A settled escrow's account is CLOSED on purpose (see
            // escrow_history.sql), so the chain scan above will never return
            // it again once it settles. Fill in what the chain no longer has
            // from Supabase, where each settle action records its outcome.
            let withHistory = parsed;
            try {
                const addr = publicKey.toBase58();
                const { data: historyRows, error: historyError } = await supabase
                    .from("escrow_history")
                    .select("escrow_address, client, expert, amount, status")
                    .or(`client.eq.${addr},expert.eq.${addr}`);

                if (historyError) {
                    console.error("Failed to load settled escrow history:", historyError);
                } else if (historyRows) {
                    const known = new Set(parsed.map((e) => e.publicKey));
                    type HistoryRow = {
                        escrow_address: string;
                        client: string;
                        expert: string;
                        amount: number;
                        status: string;
                    };
                    const fromHistory: EscrowData[] = (historyRows as HistoryRow[])
                        .filter((h) => !known.has(h.escrow_address))
                        .map((h) => ({
                            publicKey: h.escrow_address,
                            client: h.client,
                            expert: h.expert,
                            amount: h.amount,
                            status: h.status,
                        }));
                    withHistory = [...parsed, ...fromHistory];
                }
            } catch (historyErr) {
                // A missing table or a network hiccup here shouldn't take down
                // the whole list — the still-open, on-chain escrows still show.
                console.error("Failed to load settled escrow history:", historyErr);
            }

            // If a newer fetch or optimistic update started after this one,
            // this result is stale (a slow public devnet RPC can resolve out
            // of order) — drop it instead of overwriting fresher local state.
            if (myVersion === version.current) {
                setEscrows(withHistory);
            }
        } catch (err) {
            console.error("Failed to fetch escrows:", err);
            if (myVersion === version.current) setEscrows([]);
        } finally {
            if (myVersion === version.current) setLoading(false);
        }
    }, [program, publicKey]);

    useEffect(() => {
        fetchEscrows();
    }, [fetchEscrows]);

    /**
     * Applies a status change immediately, from a transaction we already know
     * succeeded, without waiting on a refetch. Solana's public devnet RPC can
     * take a moment to reflect a just-confirmed change in getProgramAccounts
     * results (it's a heavier scan than a single account read), so relying on
     * an immediate refetch alone can show stale data for a few seconds.
     */
    const updateLocalStatus = useCallback((publicKeyStr: string, status: string) => {
        version.current += 1; // this local write now counts as the latest truth
        pins.current.set(publicKeyStr, { status, expiresAt: Date.now() + PIN_DURATION_MS });
        setEscrows((prev) =>
            prev.map((e) => (e.publicKey === publicKeyStr ? { ...e, status } : e))
        );
    }, []);

    /** A background reconciliation fetch, delayed to give the RPC time to catch up. */
    const refetchSoon = useCallback(
        (delayMs = 2500) => {
            const myVersion = version.current;
            setTimeout(() => {
                // Only proceed if nothing newer (another optimistic update or
                // fetch) has happened since this was scheduled.
                if (myVersion === version.current) fetchEscrows();
            }, delayMs);
        },
        [fetchEscrows]
    );

    return { escrows, loading, refetch: fetchEscrows, refetchSoon, updateLocalStatus };
}

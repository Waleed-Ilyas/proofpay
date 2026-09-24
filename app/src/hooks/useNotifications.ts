"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useAnchorProgram } from "./useAnchorProgram";
import { supabase } from "@/lib/supabase";
import { EscrowData } from "./useEscrows";

export type NotificationKind =
    | "dispute_needs_response"
    | "dispute_urgent"
    | "evidence_filed"
    | "ruling_made";

export interface NotificationItem {
    id: string;
    escrowAddress: string;
    kind: NotificationKind;
    message: string;
    detail?: string;
    /** ISO timestamp. For a dispute, this is when it was raised, not the
     *  current time — see the note on read-state below. */
    at: string;
    tone: "flare" | "brass" | "verdict";
}

const LAST_SEEN_PREFIX = "proofpay:notifications:lastSeen:";
const TIMEOUT_SECONDS = 12 * 60 * 60; // must match DISPUTE_TIMEOUT_SECONDS in constants.rs
const URGENT_THRESHOLD_SECONDS = 2 * 60 * 60;
const ZERO_HASH = "0".repeat(64);
const REFRESH_MS = 60_000;

function toNumber(v: unknown): number {
    if (typeof v === "number") return v;
    if (v && typeof (v as { toNumber?: () => number }).toNumber === "function") {
        return (v as { toNumber: () => number }).toNumber();
    }
    return Number(v);
}

function toHex(bytes: ArrayLike<number>): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * Pulls together everything in this wallet's escrows that's worth surfacing
 * in one place: a dispute raised against you that you haven't answered
 * on-chain yet (and how urgent it is), evidence the other side filed, and
 * rulings that landed. Nothing here is new backend — it's the same on-chain
 * Dispute accounts and Supabase rows every other part of the app already
 * reads, just gathered across all of a wallet's escrows instead of one card.
 *
 * Read state is a plain localStorage timestamp per wallet, so "unread" means
 * "happened after I last opened the bell." A still-open dispute keeps
 * appearing in the list after being seen once (it's still relevant), it just
 * stops incrementing the badge count.
 */
export function useNotifications(escrows: EscrowData[], wallet: string | null) {
    const { program } = useAnchorProgram();
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastSeen, setLastSeen] = useState(0);

    const lastSeenKey = wallet ? `${LAST_SEEN_PREFIX}${wallet}` : null;

    useEffect(() => {
        if (!lastSeenKey || typeof window === "undefined") return;
        const stored = window.localStorage.getItem(lastSeenKey);
        setLastSeen(stored ? Number(stored) : 0);
    }, [lastSeenKey]);

    const markSeen = useCallback(() => {
        if (!lastSeenKey || typeof window === "undefined") return;
        const now = Date.now();
        window.localStorage.setItem(lastSeenKey, String(now));
        setLastSeen(now);
    }, [lastSeenKey]);

    const escrowKey = escrows.map((e) => `${e.publicKey}:${e.status}`).join(",");

    const fetchAll = useCallback(async () => {
        if (!program || !wallet || escrows.length === 0) {
            setItems([]);
            return;
        }

        setLoading(true);
        try {
            const disputed = escrows.filter((e) => e.status === "disputed");
            const addresses = escrows.map((e) => e.publicKey);
            const results: NotificationItem[] = [];

            await Promise.all(
                disputed.map(async (e) => {
                    try {
                        const enc = new TextEncoder();
                        const [disputePda] = PublicKey.findProgramAddressSync(
                            [enc.encode("dispute"), new PublicKey(e.publicKey).toBytes()],
                            program.programId
                        );
                        const acc: any = await (program.account as any).dispute.fetch(disputePda);
                        const raisedBy: string = (acc.raisedBy ?? acc.raised_by).toBase58();
                        const raisedAt = toNumber(acc.raisedAt ?? acc.raised_at);
                        const counterHex = toHex(acc.counterHash ?? acc.counter_hash);
                        const responded = counterHex !== ZERO_HASH;
                        const iAmRaiser = raisedBy === wallet;

                        // Only the side that still owes a response gets nudged.
                        if (responded || iAmRaiser) return;

                        const now = Math.floor(Date.now() / 1000);
                        const remaining = raisedAt + TIMEOUT_SECONDS - now;
                        const expired = remaining <= 0;
                        const urgent = !expired && remaining <= URGENT_THRESHOLD_SECONDS;

                        results.push({
                            id: `dispute-${e.publicKey}`,
                            escrowAddress: e.publicKey,
                            kind: expired || urgent ? "dispute_urgent" : "dispute_needs_response",
                            message: expired
                                ? "A dispute's response window has closed"
                                : "A dispute needs your response",
                            detail: expired
                                ? "The other side can now claim the funds."
                                : urgent
                                  ? `About ${Math.max(1, Math.round(remaining / 60))} minutes left to respond.`
                                  : "File your evidence before the 12-hour window closes.",
                            at: new Date(raisedAt * 1000).toISOString(),
                            tone: expired || urgent ? "flare" : "brass",
                        });
                    } catch (err) {
                        console.error("useNotifications: failed to read dispute for", e.publicKey, err);
                    }
                })
            );

            const [{ data: evidenceRows, error: evidenceError }, { data: resolutionRows, error: resolutionError }] =
                await Promise.all([
                    supabase
                        .from("dispute_evidence")
                        .select("escrow_address, role, submitted_by, created_at")
                        .in("escrow_address", addresses)
                        .order("created_at", { ascending: false })
                        .limit(50),
                    supabase
                        .from("dispute_resolutions")
                        .select("escrow_address, favor_expert, resolved_at")
                        .in("escrow_address", addresses)
                        .order("resolved_at", { ascending: false })
                        .limit(50),
                ]);

            if (evidenceError) console.error("useNotifications: evidence fetch failed:", evidenceError);
            if (resolutionError) console.error("useNotifications: resolutions fetch failed:", resolutionError);

            for (const row of evidenceRows ?? []) {
                if (row.submitted_by === wallet) continue; // your own filing isn't a notification
                results.push({
                    id: `evidence-${row.escrow_address}-${row.created_at}`,
                    escrowAddress: row.escrow_address,
                    kind: "evidence_filed",
                    message: `The ${row.role} filed evidence on a dispute`,
                    at: row.created_at,
                    tone: "brass",
                });
            }

            for (const row of resolutionRows ?? []) {
                results.push({
                    id: `ruling-${row.escrow_address}-${row.resolved_at}`,
                    escrowAddress: row.escrow_address,
                    kind: "ruling_made",
                    message: `A ruling favored the ${row.favor_expert ? "expert" : "client"}`,
                    at: row.resolved_at,
                    tone: "verdict",
                });
            }

            results.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
            setItems(results);
        } finally {
            setLoading(false);
        }
        // escrowKey intentionally stands in for `escrows` here: it changes only
        // when an address or its status actually changes, not on every new
        // array reference from optimistic updates, avoiding a refetch loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [program, wallet, escrowKey]);

    useEffect(() => {
        fetchAll();
        const id = setInterval(fetchAll, REFRESH_MS);
        return () => clearInterval(id);
    }, [fetchAll]);

    const unreadCount = useMemo(
        () => items.filter((n) => new Date(n.at).getTime() > lastSeen).length,
        [items, lastSeen]
    );

    return { items, unreadCount, loading, markSeen, refetch: fetchAll };
}

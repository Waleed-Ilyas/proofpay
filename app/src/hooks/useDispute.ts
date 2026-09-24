"use client";

import { useCallback, useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useAnchorProgram } from "./useAnchorProgram";

export interface DisputeData {
    disputeAddress: string;
    raisedBy: string;
    raisedAt: number; // unix seconds
    counterSubmitted: boolean;
    status: string;
}

const ZERO_HASH = "0".repeat(64);

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

/** Fetches the on-chain Dispute account for an escrow — its raiser, when the
 *  12-hour response window started, and whether the counterparty has already
 *  answered on-chain. Only meaningful while the escrow is Disputed. */
export function useDispute(escrowAddress: string, enabled: boolean) {
    const { program } = useAnchorProgram();
    const [dispute, setDispute] = useState<DisputeData | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchDispute = useCallback(async () => {
        if (!program || !enabled) {
            setDispute(null);
            return;
        }

        setLoading(true);
        try {
            const enc = new TextEncoder();
            const [disputePda] = PublicKey.findProgramAddressSync(
                [enc.encode("dispute"), new PublicKey(escrowAddress).toBytes()],
                program.programId
            );
            const acc: any = await (program.account as any).dispute.fetch(disputePda);

            const raisedBy: string = (acc.raisedBy ?? acc.raised_by).toBase58();
            const raisedAt = toNumber(acc.raisedAt ?? acc.raised_at);
            const counterHashHex = toHex(acc.counterHash ?? acc.counter_hash);
            const statusKey = Object.keys(acc.status)[0];

            setDispute({
                disputeAddress: disputePda.toBase58(),
                raisedBy,
                raisedAt,
                counterSubmitted: counterHashHex !== ZERO_HASH,
                status: statusKey,
            });
        } catch (err) {
            console.error("Failed to fetch dispute:", err);
            setDispute(null);
        } finally {
            setLoading(false);
        }
    }, [program, escrowAddress, enabled]);

    useEffect(() => {
        fetchDispute();
    }, [fetchDispute]);

    return { dispute, refetch: fetchDispute, loading };
}

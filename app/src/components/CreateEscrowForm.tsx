"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import BN from "bn.js";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { supabase } from "@/lib/supabase";
import { btn, explorerAddress, inputClass } from "@/components/app/ui";

export function CreateEscrowForm({ onCreated }: { onCreated?: () => void }) {
    const { publicKey } = useWallet();
    const { program } = useAnchorProgram();

    const [expertAddress, setExpertAddress] = useState("");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [status, setStatus] = useState<string | null>(null);
    const [createdAddress, setCreatedAddress] = useState<string | null>(null);
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleCreateEscrow = async () => {
        setIsError(false);
        setCreatedAddress(null);

        if (!program || !publicKey) {
            setStatus("Connect your wallet first.");
            setIsError(true);
            return;
        }

        let expertPubkey: PublicKey;
        try {
            expertPubkey = new PublicKey(expertAddress.trim());
        } catch {
            setStatus("That doesn't look like a valid Solana wallet address.");
            setIsError(true);
            return;
        }

        const solAmount = parseFloat(amount);
        if (isNaN(solAmount) || solAmount <= 0) {
            setStatus("Enter an amount greater than 0.");
            setIsError(true);
            return;
        }

        // Math.round: 1.1 * 1e9 isn't a whole number in floating point, and BN rejects fractions.
        const lamports = new BN(Math.round(solAmount * LAMPORTS_PER_SOL));

        // A fresh nonce for every escrow, so the same two wallets can create
        // any number of independent escrows over time instead of being
        // limited to exactly one together for all time. The current time in
        // milliseconds is more than enough to make two escrows between the
        // same pair collide by chance; a genuine collision (astronomically
        // unlikely from a single click) would just fail this specific
        // transaction, safely, with nothing lost.
        const nonce = new BN(Date.now());

        const [escrowPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("escrow"),
                publicKey.toBuffer(),
                expertPubkey.toBuffer(),
                nonce.toArrayLike(Buffer, "le", 8),
            ],
            program.programId
        );

        setLoading(true);
        setStatus(null);

        try {
            await program.methods
                .createEscrow(lamports, nonce)
                .accounts({
                    client: publicKey,
                    expert: expertPubkey,
                    escrow: escrowPda,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            if (description.trim()) {
                // upsert, not insert: this escrow's address can be a REUSED
                // one. The program's escrow PDA is derived only from
                // [client, expert], so once a pair's earlier escrow settles
                // and its account closes, their next escrow together gets
                // the exact same address. A plain insert would collide with
                // the old metadata row still sitting under that address and
                // fail — upsert replaces it, which is correct: the old
                // description belonged to a deal that's already finished.
                const { error: metadataError } = await supabase
                    .from("escrow_metadata")
                    .upsert(
                        {
                            escrow_address: escrowPda.toBase58(),
                            description: description.trim(),
                        },
                        { onConflict: "escrow_address" }
                    );

                if (metadataError) {
                    console.error(
                        "Failed to save description:",
                        metadataError.message,
                        metadataError.details,
                        metadataError.hint
                    );
                }
            }

            setStatus("Escrow created. The SOL is now locked in the program.");
            setCreatedAddress(escrowPda.toBase58());
            setExpertAddress("");
            setAmount("");
            setDescription("");
            onCreated?.();
        } catch (err: any) {
            console.error(err);
            const message: string = err?.message ?? "";
            if (/already in use/i.test(message)) {
                // The escrow address is derived from (client, expert), so a pair gets one escrow.
                setStatus(
                    "You already have an escrow with this expert wallet. Each client and expert pair can have one, so use a different expert wallet."
                );
            } else {
                setStatus(message || "The transaction didn't go through. Try again.");
            }
            setIsError(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rounded-2xl border border-edge bg-surface p-6 flex flex-col gap-5">
            <div>
                <h2 className="font-display text-2xl">Create an escrow</h2>
                <p className="text-sm text-mute mt-1">
                    The SOL is locked in the program the moment you confirm.
                </p>
            </div>

            <label className="flex flex-col gap-1.5">
                <span className="text-sm text-mute">Expert&apos;s wallet address</span>
                <input
                    type="text"
                    value={expertAddress}
                    onChange={(e) => setExpertAddress(e.target.value)}
                    placeholder="Solana wallet address"
                    spellCheck={false}
                    className={`${inputClass} font-mono-address text-[13px]`}
                />
            </label>

            <label className="flex flex-col gap-1.5">
                <span className="text-sm text-mute">Amount in SOL</span>
                <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="1.0"
                    className={`${inputClass} font-mono-address`}
                />
            </label>

            <label className="flex flex-col gap-1.5">
                <span className="text-sm text-mute">
                    What&apos;s the work?{" "}
                    <span className="text-mute/70">
                        Optional, but the arbitrator uses it if there&apos;s a dispute.
                    </span>
                </span>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Build a landing page with a signup form and three sections"
                    rows={3}
                    className={`${inputClass} resize-none`}
                />
            </label>

            <button
                onClick={handleCreateEscrow}
                disabled={loading || !publicKey}
                className={`${btn.primary} py-3 text-base`}
            >
                {loading ? "Creating escrow…" : "Create and deposit"}
            </button>

            {status && (
                <div
                    role="status"
                    className={`rounded-lg border p-3 text-sm ${
                        isError
                            ? "border-flare/50 bg-flare/10 text-flare"
                            : "border-verdict/40 bg-verdict/10 text-verdict"
                    }`}
                >
                    <p className="break-words">{status}</p>
                    {createdAddress && (
                        <a
                            href={explorerAddress(createdAddress)}
                            target="_blank"
                            rel="noreferrer"
                            className="addr mt-1.5 block text-xs underline underline-offset-4 break-all"
                        >
                            {createdAddress}
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}

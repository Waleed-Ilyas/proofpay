import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import idl from "@/idl/proofpay.json";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Same loader as /api/resolve-dispute. This route only ever reads on-chain
// accounts (it never signs a transaction), but Anchor's Program still wants
// a wallet-shaped object to construct a provider — any keypair works here.
function loadValidatorKeypair(): Keypair {
    const fromEnv = process.env.VALIDATOR_SECRET_KEY;
    if (fromEnv) {
        return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fromEnv)));
    }
    const keypairPath = path.join(process.cwd(), "validator-authority.json");
    const raw = fs.readFileSync(keypairPath, "utf-8");
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

function makeNodeWallet(keypair: Keypair) {
    return {
        publicKey: keypair.publicKey,
        async signTransaction(tx: any) {
            return tx;
        },
        async signAllTransactions(txs: any[]) {
            return txs;
        },
    };
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function disputeEmailHtml(escrowAddress: string) {
    return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="margin-bottom: 4px;">A dispute was raised on ProofPay</h2>
      <p style="color: #555;">
        A dispute was raised on an escrow you're part of. You have
        <strong>12 hours</strong> to file your evidence, or the other side
        can claim the funds once the window closes.
      </p>
      <p style="font-family: monospace; font-size: 12px; color: #888; word-break: break-all;">
        Escrow: ${escrowAddress}
      </p>
      <a href="${APP_URL}/app"
         style="display: inline-block; margin-top: 12px; padding: 10px 18px;
                background: #ddb04a; color: #06151a; text-decoration: none;
                border-radius: 6px; font-weight: 600;">
        Open ProofPay
      </a>
      <p style="color: #999; font-size: 12px; margin-top: 24px;">
        You're receiving this because this email was saved for dispute alerts
        on this wallet. ProofPay runs on Solana devnet.
      </p>
    </div>`;
}

export async function POST(request: Request) {
    try {
        const { escrowAddress, raisedBy } = await request.json();
        if (!escrowAddress || !raisedBy) {
            return NextResponse.json({ error: "escrowAddress and raisedBy are required" }, { status: 400 });
        }

        if (!process.env.RESEND_API_KEY) {
            // Not configured — this is a soft feature, so say so plainly and
            // exit quietly rather than throwing.
            return NextResponse.json({ sent: false, reason: "Email is not configured." });
        }

        // Determine the counterparty (the one who did NOT raise this dispute)
        // by reading the escrow directly from chain — the source of truth.
        const validatorKeypair = loadValidatorKeypair();
        const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        const provider = new AnchorProvider(connection, makeNodeWallet(validatorKeypair) as any, {
            commitment: "confirmed",
        });
        const program = new Program(idl as any, provider);

        const escrowPubkey = new PublicKey(escrowAddress);
        const escrowAccount: any = await (program.account as any).escrow.fetch(escrowPubkey);
        const client = new PublicKey(escrowAccount.client).toBase58();
        const expert = new PublicKey(escrowAccount.expert).toBase58();
        const counterparty = raisedBy === client ? expert : client;

        const { data: emailRow, error: emailError } = await supabaseAdmin
            .from("wallet_emails")
            .select("email")
            .eq("wallet_address", counterparty)
            .maybeSingle();

        if (emailError) {
            console.error("notify-dispute: email lookup failed:", emailError);
            return NextResponse.json({ sent: false, reason: "Could not look up an email for this wallet." });
        }

        if (!emailRow?.email) {
            // Nothing to send to — not an error, just nothing opted in.
            return NextResponse.json({ sent: false, reason: "The other party hasn't opted in to email alerts." });
        }

        const resendResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: "ProofPay <notifications@mail.proofpay.site>",
                to: [emailRow.email],
                subject: "A dispute was raised on your ProofPay escrow",
                html: disputeEmailHtml(escrowAddress),
            }),
        });

        if (!resendResponse.ok) {
            const errText = await resendResponse.text();
            console.error(`notify-dispute: Resend error ${resendResponse.status}: ${errText}`);
            return NextResponse.json({ sent: false, reason: "The email couldn't be sent." });
        }

        return NextResponse.json({ sent: true });
    } catch (err: any) {
        // A failed notification should never look like the dispute itself
        // failed — the caller treats this as fire-and-forget either way.
        console.error("notify-dispute error:", err);
        return NextResponse.json({ sent: false, reason: err?.message ?? "Unknown error" });
    }
}

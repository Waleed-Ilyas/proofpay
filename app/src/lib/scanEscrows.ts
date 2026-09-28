import type { PublicKey } from "@solana/web3.js";

export interface ScannedEscrow {
    publicKey: PublicKey;
    account: any;
}

/**
 * Finds every escrow account where `wallet` sits at `ownerOffset` (8 = client,
 * 40 = expert), decoding each one on its own.
 *
 * Why not just `program.account.escrow.all([...])`? That helper decodes every
 * match in a single map() with no error handling, so ONE account it can't read
 * throws for the whole call and the wallet's entire list goes blank. Escrow
 * accounts created before the nonce upgrade are 8 bytes shorter than the
 * current layout and can never be decoded again (nothing on-chain can close
 * them either), so any wallet that used the app back then would hit exactly
 * that. Here, an unreadable account is skipped and counted instead.
 */
export async function scanEscrows(
    program: any,
    ownerOffset: number,
    wallet: string
): Promise<{ items: ScannedEscrow[]; skipped: number }> {
    // Resolve the account's exact name from the IDL instead of assuming its casing.
    const idlName: string =
        (program.idl?.accounts ?? []).find(
            (a: { name: string }) => a.name.toLowerCase() === "escrow"
        )?.name ?? "Escrow";

    // Same discriminator filter Anchor's own .all() applies.
    const discriminator = program.coder.accounts.memcmp(idlName);

    const raw = await program.provider.connection.getProgramAccounts(program.programId, {
        commitment: program.provider.connection.commitment,
        filters: [
            { memcmp: { offset: discriminator.offset, bytes: discriminator.bytes } },
            { memcmp: { offset: ownerOffset, bytes: wallet } },
        ],
    });

    const items: ScannedEscrow[] = [];
    let skipped = 0;

    for (const { pubkey, account } of raw) {
        try {
            items.push({
                publicKey: pubkey,
                account: program.coder.accounts.decode(idlName, account.data),
            });
        } catch {
            skipped += 1;
        }
    }

    return { items, skipped };
}

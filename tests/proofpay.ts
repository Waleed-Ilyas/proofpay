import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

describe("proofpay", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.Proofpay as Program;

    const client = anchor.web3.Keypair.generate();
    const expert = anchor.web3.Keypair.generate();

    let escrowPda: PublicKey;

    const escrowAmount = 1 * LAMPORTS_PER_SOL;

    before(async () => {
        // Airdrop test SOL to both parties on the local validator
        const clientAirdrop = await provider.connection.requestAirdrop(
            client.publicKey,
            5 * LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(clientAirdrop);

        const expertAirdrop = await provider.connection.requestAirdrop(
            expert.publicKey,
            1 * LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(expertAirdrop);

        [escrowPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("escrow"),
                client.publicKey.toBuffer(),
                expert.publicKey.toBuffer(),
            ],
            program.programId
        );
    });

    it("creates an escrow and deposits funds", async () => {
        await program.methods
            .createEscrow(new anchor.BN(escrowAmount))
            .accounts({
                client: client.publicKey,
                expert: expert.publicKey,
                escrow: escrowPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([client])
            .rpc();

        const escrowAccount = await program.account.escrow.fetch(escrowPda);

        assert.strictEqual(escrowAccount.client.toBase58(), client.publicKey.toBase58());
        assert.strictEqual(escrowAccount.expert.toBase58(), expert.publicKey.toBase58());
        assert.strictEqual(escrowAccount.amount.toNumber(), escrowAmount);
        assert.deepEqual(escrowAccount.status, { awaitingAcceptance: {} });

        const escrowBalance = await provider.connection.getBalance(escrowPda);
        assert.isAtLeast(escrowBalance, escrowAmount);
    });

    it("lets the expert accept the escrow", async () => {
        await program.methods
            .acceptEscrow()
            .accounts({
                expert: expert.publicKey,
                escrow: escrowPda,
            })
            .signers([expert])
            .rpc();

        const escrowAccount = await program.account.escrow.fetch(escrowPda);
        assert.deepEqual(escrowAccount.status, { active: {} });
    });
});
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

    it("lets the client release funds to the expert after work is done", async () => {
        const expertBalanceBefore = await provider.connection.getBalance(expert.publicKey);

        await program.methods
            .releaseEscrow()
            .accounts({
                client: client.publicKey,
                expert: expert.publicKey,
                escrow: escrowPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([client])
            .rpc();

        const escrowAccount = await program.account.escrow.fetch(escrowPda);
        assert.deepEqual(escrowAccount.status, { completed: {} });

        const expertBalanceAfter = await provider.connection.getBalance(expert.publicKey);
        assert.isAbove(expertBalanceAfter, expertBalanceBefore);
    });

    describe("cancellation flow", () => {
        const client2 = anchor.web3.Keypair.generate();
        const expert2 = anchor.web3.Keypair.generate();
        let escrowPda2: PublicKey;
        const cancelAmount = 0.5 * LAMPORTS_PER_SOL;

        before(async () => {
            const airdrop = await provider.connection.requestAirdrop(
                client2.publicKey,
                2 * LAMPORTS_PER_SOL
            );
            await provider.connection.confirmTransaction(airdrop);

            [escrowPda2] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("escrow"),
                    client2.publicKey.toBuffer(),
                    expert2.publicKey.toBuffer(),
                ],
                program.programId
            );

            await program.methods
                .createEscrow(new anchor.BN(cancelAmount))
                .accounts({
                    client: client2.publicKey,
                    expert: expert2.publicKey,
                    escrow: escrowPda2,
                    systemProgram: SystemProgram.programId,
                })
                .signers([client2])
                .rpc();
        });

        it("lets the client cancel and get refunded before the expert accepts", async () => {
            const clientBalanceBefore = await provider.connection.getBalance(client2.publicKey);

            await program.methods
                .cancelEscrow()
                .accounts({
                    client: client2.publicKey,
                    escrow: escrowPda2,
                    systemProgram: SystemProgram.programId,
                })
                .signers([client2])
                .rpc();

            const escrowAccount = await program.account.escrow.fetch(escrowPda2);
            assert.deepEqual(escrowAccount.status, { refunded: {} });

            const clientBalanceAfter = await provider.connection.getBalance(client2.publicKey);
            assert.isAbove(clientBalanceAfter, clientBalanceBefore);
        });
    });
});
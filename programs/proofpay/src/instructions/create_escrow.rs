use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction;

use crate::state::{Escrow, EscrowStatus};

pub fn handle_create_escrow(ctx: Context<CreateEscrow>, amount: u64, nonce: u64) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;

    escrow.client = ctx.accounts.client.key();
    escrow.expert = ctx.accounts.expert.key();
    escrow.amount = amount;
    escrow.status = EscrowStatus::AwaitingAcceptance;
    escrow.nonce = nonce;
    escrow.bump = ctx.bumps.escrow;

    // Move the client's SOL into the escrow PDA, which the program controls.
    // Neither the client nor the expert can withdraw it directly — only our
    // program's instructions can move funds out from here.
    let transfer_ix = system_instruction::transfer(
        &ctx.accounts.client.key(),
        &ctx.accounts.escrow.key(),
        amount,
    );

    invoke(
        &transfer_ix,
        &[
            ctx.accounts.client.to_account_info(),
            ctx.accounts.escrow.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    Ok(())
}

#[derive(Accounts)]
#[instruction(amount: u64, nonce: u64)]
pub struct CreateEscrow<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    /// CHECK: The expert is just a wallet address at this stage, not
    /// a signer yet — they haven't accepted the contract terms.
    pub expert: UncheckedAccount<'info>,

    #[account(
        init,
        payer = client,
        space = 8 + Escrow::INIT_SPACE,
        // The nonce (chosen by the client, typically their local clock in
        // milliseconds) is folded in here so the SAME two wallets can create
        // any number of independent escrows over time, each with its own
        // permanent address and its own history — rather than being limited
        // to exactly one escrow together for all time.
        seeds = [b"escrow", client.key().as_ref(), expert.key().as_ref(), nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,

    pub system_program: Program<'info, System>,
}

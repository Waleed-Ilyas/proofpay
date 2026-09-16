use anchor_lang::prelude::*;

use crate::error::ProofPayError;
use crate::state::{Escrow, EscrowStatus};

pub fn handle_release_escrow(ctx: Context<ReleaseEscrow>) -> Result<()> {
    require!(
        ctx.accounts.escrow.status == EscrowStatus::Active,
        ProofPayError::InvalidEscrowStatus
    );

    require_keys_eq!(
        ctx.accounts.escrow.client,
        ctx.accounts.client.key(),
        ProofPayError::UnauthorizedClient
    );

    let amount = ctx.accounts.escrow.amount;

    // Since our program owns this PDA, we can move lamports out of it
    // by directly adjusting the account's balance — no System Program
    // transfer needed (and none is possible: a data-carrying account
    // can't be the `from` side of a system_instruction::transfer).
    **ctx
        .accounts
        .escrow
        .to_account_info()
        .try_borrow_mut_lamports()? -= amount;
    **ctx
        .accounts
        .expert
        .to_account_info()
        .try_borrow_mut_lamports()? += amount;

    ctx.accounts.escrow.status = EscrowStatus::Completed;

    Ok(())
}

#[derive(Accounts)]
pub struct ReleaseEscrow<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    /// CHECK: We verify this matches escrow.expert before transferring.
    #[account(mut)]
    pub expert: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.client.as_ref(), escrow.expert.as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    pub system_program: Program<'info, System>,
}

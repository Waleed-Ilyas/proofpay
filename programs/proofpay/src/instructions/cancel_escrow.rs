use anchor_lang::prelude::*;

use crate::error::ProofPayError;
use crate::state::{Escrow, EscrowStatus};

pub fn handle_cancel_escrow(ctx: Context<CancelEscrow>) -> Result<()> {
    require!(
        ctx.accounts.escrow.status == EscrowStatus::AwaitingAcceptance,
        ProofPayError::InvalidEscrowStatus
    );

    require_keys_eq!(
        ctx.accounts.escrow.client,
        ctx.accounts.client.key(),
        ProofPayError::UnauthorizedClient
    );

    let amount = ctx.accounts.escrow.amount;

    **ctx
        .accounts
        .escrow
        .to_account_info()
        .try_borrow_mut_lamports()? -= amount;
    **ctx
        .accounts
        .client
        .to_account_info()
        .try_borrow_mut_lamports()? += amount;

    ctx.accounts.escrow.status = EscrowStatus::Refunded;

    Ok(())
}

#[derive(Accounts)]
pub struct CancelEscrow<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.client.as_ref(), escrow.expert.as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    pub system_program: Program<'info, System>,
}

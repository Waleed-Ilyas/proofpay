use anchor_lang::prelude::*;

use crate::constants::VALIDATOR_AUTHORITY;
use crate::error::ProofPayError;
use crate::state::{Dispute, DisputeStatus, Escrow, EscrowStatus};

pub fn handle_resolve_dispute(ctx: Context<ResolveDispute>, favor_expert: bool) -> Result<()> {
    require!(
        ctx.accounts.dispute.status == DisputeStatus::Open,
        ProofPayError::DisputeAlreadyResolved
    );

    require!(
        ctx.accounts.escrow.status == EscrowStatus::Disputed,
        ProofPayError::InvalidEscrowStatus
    );

    let amount = ctx.accounts.escrow.amount;

    if favor_expert {
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
    } else {
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
    }

    ctx.accounts.dispute.status = DisputeStatus::Resolved;
    ctx.accounts.dispute.resolved_in_favor_of_expert = favor_expert;

    Ok(())
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    /// Only this specific key can resolve disputes — our backend's AI
    /// verification service holds this key and signs after reaching a verdict.
    #[account(
        constraint = validator.key() == VALIDATOR_AUTHORITY @ ProofPayError::UnauthorizedValidator
    )]
    pub validator: Signer<'info>,

    /// CHECK: Verified against escrow.client before funds move.
    #[account(mut)]
    pub client: UncheckedAccount<'info>,

    /// CHECK: Verified against escrow.expert before funds move.
    #[account(mut)]
    pub expert: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"escrow", client.key().as_ref(), expert.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        seeds = [b"dispute", escrow.key().as_ref()],
        bump = dispute.bump
    )]
    pub dispute: Account<'info, Dispute>,
}

use anchor_lang::prelude::*;

use crate::constants::DISPUTE_TIMEOUT_SECONDS;
use crate::error::ProofPayError;
use crate::state::{Dispute, DisputeStatus, Escrow, EscrowStatus};

/// Permissionless: anyone can call this (in practice the raiser's own wallet,
/// or the frontend, triggers it), but it only pays out if every on-chain
/// condition holds. It cannot be used to bypass a real response.
pub fn handle_claim_timeout(ctx: Context<ClaimTimeout>) -> Result<()> {
    require!(
        ctx.accounts.dispute.status == DisputeStatus::Open,
        ProofPayError::DisputeAlreadyResolved
    );
    require!(
        ctx.accounts.escrow.status == EscrowStatus::Disputed,
        ProofPayError::InvalidEscrowStatus
    );
    require!(
        ctx.accounts.dispute.counter_hash == [0u8; 32],
        ProofPayError::CounterEvidenceAlreadySubmittedForTimeout
    );

    let now = Clock::get()?.unix_timestamp;
    require!(
        now >= ctx.accounts.dispute.raised_at + DISPUTE_TIMEOUT_SECONDS,
        ProofPayError::TimeoutNotReached
    );

    let raised_by = ctx.accounts.dispute.raised_by;
    let amount = ctx.accounts.escrow.amount;

    // The raiser wins by default: whichever side didn't respond loses the
    // funds to the side that did show up and ask for a ruling.
    if raised_by == ctx.accounts.escrow.expert {
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
        ctx.accounts.dispute.resolved_in_favor_of_expert = true;
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
        ctx.accounts.dispute.resolved_in_favor_of_expert = false;
    }

    ctx.accounts.dispute.status = DisputeStatus::Resolved;
    // verdict_hash stays [0u8; 32]: no ruling was made, so there is nothing to fingerprint.

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimTimeout<'info> {
    /// CHECK: verified against escrow.client before funds move.
    #[account(mut, address = escrow.client @ ProofPayError::UnauthorizedClient)]
    pub client: UncheckedAccount<'info>,

    /// CHECK: verified against escrow.expert before funds move.
    #[account(mut, address = escrow.expert @ ProofPayError::UnauthorizedExpert)]
    pub expert: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.client.as_ref(), escrow.expert.as_ref(), escrow.nonce.to_le_bytes().as_ref()],
        bump = escrow.bump,
        close = client
    )]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: verified against dispute.raised_by before closing to it.
    #[account(mut, address = dispute.raised_by)]
    pub raiser: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"dispute", escrow.key().as_ref()],
        bump = dispute.bump,
        close = raiser
    )]
    pub dispute: Account<'info, Dispute>,
}

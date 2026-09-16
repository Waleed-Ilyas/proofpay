use anchor_lang::prelude::*;

use crate::error::ProofPayError;
use crate::state::{Dispute, DisputeStatus, Escrow, EscrowStatus};

pub fn handle_raise_dispute(ctx: Context<RaiseDispute>, evidence_hash: [u8; 32]) -> Result<()> {
    require!(
        ctx.accounts.escrow.status == EscrowStatus::Active,
        ProofPayError::InvalidEscrowStatus
    );

    let raiser = ctx.accounts.raiser.key();
    require!(
        raiser == ctx.accounts.escrow.client || raiser == ctx.accounts.escrow.expert,
        ProofPayError::UnauthorizedDisputeRaiser
    );

    let dispute = &mut ctx.accounts.dispute;
    dispute.escrow = ctx.accounts.escrow.key();
    dispute.raised_by = raiser;
    dispute.evidence_hash = evidence_hash;
    dispute.status = DisputeStatus::Open;
    dispute.resolved_in_favor_of_expert = false;
    dispute.bump = ctx.bumps.dispute;

    ctx.accounts.escrow.status = EscrowStatus::Disputed;

    Ok(())
}

#[derive(Accounts)]
pub struct RaiseDispute<'info> {
    #[account(mut)]
    pub raiser: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.client.as_ref(), escrow.expert.as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        init,
        payer = raiser,
        space = 8 + Dispute::INIT_SPACE,
        seeds = [b"dispute", escrow.key().as_ref()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,

    pub system_program: Program<'info, System>,
}

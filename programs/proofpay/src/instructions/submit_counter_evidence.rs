use anchor_lang::prelude::*;

use crate::error::ProofPayError;
use crate::state::{Dispute, DisputeStatus, Escrow, EscrowStatus};

/// Called by whichever party did NOT raise the dispute, to record their
/// evidence hash on-chain. This is what makes the 12-hour timer trustworthy:
/// claim_timeout only pays out if this was never called.
pub fn handle_submit_counter_evidence(
    ctx: Context<SubmitCounterEvidence>,
    evidence_hash: [u8; 32],
) -> Result<()> {
    require!(
        ctx.accounts.escrow.status == EscrowStatus::Disputed,
        ProofPayError::InvalidEscrowStatus
    );
    require!(
        ctx.accounts.dispute.status == DisputeStatus::Open,
        ProofPayError::DisputeAlreadyResolved
    );

    let responder = ctx.accounts.responder.key();
    let dispute = &ctx.accounts.dispute;

    // Must be the OTHER party: the one who did not raise this dispute.
    require!(
        responder != dispute.raised_by
            && (responder == ctx.accounts.escrow.client
                || responder == ctx.accounts.escrow.expert),
        ProofPayError::UnauthorizedCounterparty
    );

    require!(
        dispute.counter_hash == [0u8; 32],
        ProofPayError::CounterEvidenceAlreadySubmitted
    );

    ctx.accounts.dispute.counter_hash = evidence_hash;

    Ok(())
}

#[derive(Accounts)]
pub struct SubmitCounterEvidence<'info> {
    pub responder: Signer<'info>,

    #[account(
        seeds = [b"escrow", escrow.client.as_ref(), escrow.expert.as_ref(), escrow.nonce.to_le_bytes().as_ref()],
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

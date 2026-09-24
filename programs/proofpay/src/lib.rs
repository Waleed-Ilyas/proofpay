pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use error::*;
pub use instructions::*;
pub use state::*;

declare_id!("DGXKWH8owsS4QcnbB8jY4Lzw69gHLpHnX3NuRLCwHe3k");

#[program]
pub mod proofpay {
    use super::*;

    pub fn create_escrow(ctx: Context<CreateEscrow>, amount: u64, nonce: u64) -> Result<()> {
        crate::instructions::create_escrow::handle_create_escrow(ctx, amount, nonce)
    }

    pub fn accept_escrow(ctx: Context<AcceptEscrow>) -> Result<()> {
        crate::instructions::accept_escrow::handle_accept_escrow(ctx)
    }

    pub fn release_escrow(ctx: Context<ReleaseEscrow>) -> Result<()> {
        crate::instructions::release_escrow::handle_release_escrow(ctx)
    }

    pub fn cancel_escrow(ctx: Context<CancelEscrow>) -> Result<()> {
        crate::instructions::cancel_escrow::handle_cancel_escrow(ctx)
    }

    pub fn raise_dispute(ctx: Context<RaiseDispute>, evidence_hash: [u8; 32]) -> Result<()> {
        crate::instructions::raise_dispute::handle_raise_dispute(ctx, evidence_hash)
    }

    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        favor_expert: bool,
        verdict_hash: [u8; 32],
    ) -> Result<()> {
        crate::instructions::resolve_dispute::handle_resolve_dispute(
            ctx,
            favor_expert,
            verdict_hash,
        )
    }

    /// Called by whichever party did NOT raise the dispute, to record their
    /// evidence hash on-chain. This is what makes claim_timeout trustworthy.
    pub fn submit_counter_evidence(
        ctx: Context<SubmitCounterEvidence>,
        evidence_hash: [u8; 32],
    ) -> Result<()> {
        crate::instructions::submit_counter_evidence::handle_submit_counter_evidence(
            ctx,
            evidence_hash,
        )
    }

    /// Callable by anyone once the 12-hour response window has passed with no
    /// counter-evidence submitted. Pays the raiser; the non-responding side
    /// gets nothing.
    pub fn claim_timeout(ctx: Context<ClaimTimeout>) -> Result<()> {
        crate::instructions::claim_timeout::handle_claim_timeout(ctx)
    }
}

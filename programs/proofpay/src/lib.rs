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

    pub fn create_escrow(ctx: Context<CreateEscrow>, amount: u64) -> Result<()> {
        crate::instructions::create_escrow::handle_create_escrow(ctx, amount)
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
}

use anchor_lang::prelude::*;

use crate::state::{Escrow, EscrowStatus};
use crate::ProofPayError;

pub fn handle_accept_escrow(ctx: Context<AcceptEscrow>) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;

    // Only allow accepting if the escrow is still waiting — this guards
    // against an expert somehow calling this twice, or on a completed contract.
    require!(
        escrow.status == EscrowStatus::AwaitingAcceptance,
        ProofPayError::InvalidEscrowStatus
    );

    // Confirm the wallet calling this instruction matches the expert
    // address the client originally specified when creating the escrow.
    require_keys_eq!(
        escrow.expert,
        ctx.accounts.expert.key(),
        ProofPayError::UnauthorizedExpert
    );

    escrow.status = EscrowStatus::Active;

    Ok(())
}

#[derive(Accounts)]
pub struct AcceptEscrow<'info> {
    pub expert: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.client.as_ref(), escrow.expert.as_ref(), escrow.nonce.to_le_bytes().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,
}

use anchor_lang::prelude::*;

use crate::constants::VALIDATOR_AUTHORITY;
use crate::error::ProofPayError;
use crate::state::{Dispute, DisputeStatus, Escrow, EscrowStatus};

pub fn handle_resolve_dispute(
    ctx: Context<ResolveDispute>,
    favor_expert: bool,
    verdict_hash: [u8; 32],
) -> Result<()> {
    require!(
        ctx.accounts.dispute.status == DisputeStatus::Open,
        ProofPayError::DisputeAlreadyResolved
    );

    require!(
        ctx.accounts.escrow.status == EscrowStatus::Disputed,
        ProofPayError::InvalidEscrowStatus
    );

    // The raiser's evidence is already on-chain from the moment they raised
    // this dispute (evidence_hash, set in raise_dispute). This is the real
    // enforcement of "both sides get a hearing" — without it, a ruling
    // could be made having heard only one side, and nothing on-chain would
    // have stopped it. The frontend already guides people this way, but
    // this is what makes it an actual rule rather than a suggestion.
    require!(
        ctx.accounts.dispute.counter_hash != [0u8; 32],
        ProofPayError::CounterEvidenceRequired
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
    ctx.accounts.dispute.verdict_hash = verdict_hash;

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

    /// CHECK: Verified against escrow.client before funds move, and before
    /// the escrow's rent is returned to it on close.
    #[account(mut, address = escrow.client @ ProofPayError::UnauthorizedClient)]
    pub client: UncheckedAccount<'info>,

    /// CHECK: Verified against escrow.expert before funds move.
    #[account(mut, address = escrow.expert @ ProofPayError::UnauthorizedExpert)]
    pub expert: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"escrow", client.key().as_ref(), expert.key().as_ref(), escrow.nonce.to_le_bytes().as_ref()],
        bump = escrow.bump,
        // Rent returns to the client, and closing frees this client/expert
        // pair to create a new escrow afterward. Closing the ESCROW is safe:
        // verification only ever reads the DISPUTE account below.
        close = client
    )]
    pub escrow: Account<'info, Escrow>,

    // IMPORTANT: the dispute account is deliberately NOT closed here.
    // verdict_hash is written in this same instruction, and "Verify this
    // ruling" depends on being able to read it back from Solana at any point
    // in the future. Closing it here would delete the fingerprint in the same
    // transaction that creates it. Only claim_timeout (where no fingerprint
    // is ever written) closes a dispute account.
    #[account(
        mut,
        seeds = [b"dispute", escrow.key().as_ref()],
        bump = dispute.bump
    )]
    pub dispute: Account<'info, Dispute>,
}

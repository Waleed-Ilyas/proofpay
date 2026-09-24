use anchor_lang::prelude::*;

#[error_code]
pub enum ProofPayError {
    #[msg("This escrow is not in the correct status for this action")]
    InvalidEscrowStatus,

    #[msg("Only the designated expert can accept this escrow")]
    UnauthorizedExpert,

    #[msg("Only the client who created this escrow can perform this action")]
    UnauthorizedClient,

    #[msg("The escrow does not have sufficient funds for this operation")]
    InsufficientFunds,

    #[msg("Only the client or expert on this escrow can raise a dispute")]
    UnauthorizedDisputeRaiser,

    #[msg("This dispute has already been resolved")]
    DisputeAlreadyResolved,

    #[msg("Only the authorized validator can resolve disputes")]
    UnauthorizedValidator,

    #[msg("Only the party who did not raise the dispute can submit counter-evidence")]
    UnauthorizedCounterparty,

    #[msg("Counter-evidence has already been submitted for this dispute")]
    CounterEvidenceAlreadySubmitted,

    #[msg("The 12-hour response window has not passed yet")]
    TimeoutNotReached,

    #[msg("Counter-evidence was submitted, so this dispute can no longer be timed out")]
    CounterEvidenceAlreadySubmittedForTimeout,
}

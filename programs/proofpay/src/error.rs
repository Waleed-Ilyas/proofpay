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
}

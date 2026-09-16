use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Escrow {
    /// The client who deposits funds and receives the completed work
    pub client: Pubkey,
    /// The expert who will complete the work and receive payment
    pub expert: Pubkey,
    /// Total amount held in escrow, in lamports (1 SOL = 1_000_000_000 lamports)
    pub amount: u64,
    /// Current status of this escrow contract
    pub status: EscrowStatus,
    /// Bump seed for this PDA, stored so we don't have to re-derive it every time
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum EscrowStatus {
    /// Client has created and funded the escrow, waiting for expert to accept
    AwaitingAcceptance,
    /// Expert has accepted, work is in progress, funds are locked
    Active,
    /// Client approved the work, funds released to expert
    Completed,
    /// Contract was cancelled before the expert accepted, funds returned to client
    Refunded,
}

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
    /// Chosen by the client at creation time (their wallet's local clock, in
    /// milliseconds) and folded into this account's PDA seeds alongside
    /// [client, expert]. Without this, every escrow between the same two
    /// wallets would derive to the exact same address forever, so a pair
    /// could never do more than one deal together across their lifetime,
    /// even after settling. With it, each deal between a pair gets its own
    /// permanent, independent address and history.
    pub nonce: u64,
    /// Bump seed for this PDA, stored so we don't have to re-derive it every time
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum EscrowStatus {
    /// Client has created and funded the escrow, waiting for expert to accept
    AwaitingAcceptance,
    /// Expert has accepted, work is in progress, funds are locked
    Active,
    /// A dispute has been raised; awaiting AI/validator resolution or timeout
    Disputed,
    /// Client approved the work, funds released to expert
    Completed,
    /// Contract was cancelled before the expert accepted, funds returned to client
    Refunded,
}

#[account]
#[derive(InitSpace)]
pub struct Dispute {
    /// The escrow this dispute belongs to
    pub escrow: Pubkey,
    /// Who raised the dispute
    pub raised_by: Pubkey,
    /// Short reason/evidence hash provided by whoever raised it. We store a
    /// fixed-size hash on-chain (e.g. SHA-256 of the full evidence text/files),
    /// with the actual evidence content kept off-chain (Supabase) for size reasons.
    pub evidence_hash: [u8; 32],
    /// Unix timestamp (seconds) the dispute was raised. Start of the 12-hour
    /// response window: the counterparty must submit counter_hash before
    /// raised_at + TIMEOUT_SECONDS, or the raiser can claim the funds via
    /// claim_timeout.
    pub raised_at: i64,
    /// SHA-256 hash of the counterparty's evidence, submitted on-chain via
    /// submit_counter_evidence. Zeroed until they respond. claim_timeout checks
    /// this is still zero before paying out on a timeout.
    pub counter_hash: [u8; 32],
    /// Current status of the dispute itself
    pub status: DisputeStatus,
    /// Set once resolved: true if the ruling favored the expert (funds released),
    /// false if it favored the client (funds refunded)
    pub resolved_in_favor_of_expert: bool,
    /// SHA-256 fingerprint of the arbitration record: the verdict, its reasoning,
    /// and the evidence it was based on. Written at resolution time so the ruling
    /// is tamper-evident — anyone can recompute this from the published evidence
    /// and verdict and check it against the value stored here. Zeroed until resolved,
    /// and also zeroed for a timeout resolution, since no ruling was made.
    pub verdict_hash: [u8; 32],
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum DisputeStatus {
    Open,
    Resolved,
}

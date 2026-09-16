use anchor_lang::prelude::*;

/// The public key authorized to resolve disputes. In this MVP, this key
/// is held by our off-chain backend, which calls Claude to analyze dispute
/// evidence, then signs the resolution transaction with this key. A future
/// version would replace this with a decentralized validator/staking system.
#[constant]
pub const VALIDATOR_AUTHORITY: Pubkey = pubkey!("EgEs66rzfECcwdvbhj1xt996Lj5ieCsRmg6uv5EgEVzp");

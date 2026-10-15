use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PaymentChannel {
    pub payer: Pubkey,
    pub merchant: Pubkey,
    pub mint: Pubkey,
    pub rent_payer: Pubkey,
    pub max_amount: u64,
    pub expires_at: i64,
    pub nonce: u64,
    pub bump: u8,
}

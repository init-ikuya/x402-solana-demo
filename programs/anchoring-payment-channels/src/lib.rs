pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("TzMc42AtPM8FRnzQyfw2MV9qaD1ChAkMMVuW12jiurd");

#[program]
pub mod anchoring_payment_channels {
    use super::*;

    pub fn open(ctx: Context<Open>, nonce: u64, max_amount: u64, expires_at: i64) -> Result<()> {
        crate::instructions::open::handle_open(ctx, nonce, max_amount, expires_at)
    }

    pub fn settle(ctx: Context<Settle>, amount: u64) -> Result<()> {
        crate::instructions::settle::handle_settle(ctx, amount)
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        crate::instructions::refund::handle_refund(ctx)
    }
}

pub mod auth_capture;
pub mod batch;
pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

#[allow(ambiguous_glob_reexports)]
pub use auth_capture::*;
pub use batch::*;
pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("4PpHEbD82o3bEtTYk478dcbTp4M4G9Q8Jqswcvoozq88");

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

    pub fn open_batch(
        ctx: Context<OpenBatch>,
        nonce: u64,
        deposit: u64,
        expires_at: i64,
    ) -> Result<()> {
        batch::handle_open_batch(ctx, nonce, deposit, expires_at)
    }

    pub fn claim_batch(ctx: Context<ClaimBatch>, cumulative_amount: u64) -> Result<()> {
        batch::handle_claim_batch(ctx, cumulative_amount)
    }

    pub fn close_batch(ctx: Context<CloseBatch>) -> Result<()> {
        batch::handle_close_batch(ctx)
    }

    pub fn authorize_hold(
        ctx: Context<AuthorizeHold>,
        nonce: u64,
        amount: u64,
        capture_deadline: i64,
        refund_deadline: i64,
    ) -> Result<()> {
        auth_capture::authorize_hold(ctx, nonce, amount, capture_deadline, refund_deadline)
    }

    pub fn capture_hold(ctx: Context<HoldOperation>, amount: u64, sequence: u64) -> Result<()> {
        auth_capture::operate_hold(ctx, HoldAction::Capture, amount, sequence)
    }

    pub fn capture_and_void_hold(
        ctx: Context<HoldOperation>,
        amount: u64,
        sequence: u64,
    ) -> Result<()> {
        auth_capture::operate_hold(ctx, HoldAction::CaptureAndVoid, amount, sequence)
    }

    pub fn void_hold(ctx: Context<HoldOperation>, sequence: u64) -> Result<()> {
        auth_capture::operate_hold(ctx, HoldAction::Void, 0, sequence)
    }

    pub fn reclaim_hold(ctx: Context<HoldOperation>, sequence: u64) -> Result<()> {
        auth_capture::operate_hold(ctx, HoldAction::Reclaim, 0, sequence)
    }

    pub fn refund_captured(ctx: Context<HoldOperation>, amount: u64, sequence: u64) -> Result<()> {
        auth_capture::refund_captured(ctx, amount, sequence)
    }
}

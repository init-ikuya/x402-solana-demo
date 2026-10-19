use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("The deposit must be positive")]
    InvalidAmount,
    #[msg("The channel expiry is outside the allowed window")]
    InvalidExpiry,
    #[msg("The channel has expired")]
    ChannelExpired,
    #[msg("The channel has not expired yet")]
    ChannelNotExpired,
    #[msg("The charge exceeds the authorized ceiling")]
    ChargeExceedsMaximum,
    #[msg("The channel escrow holds less than the authorized deposit")]
    InsufficientEscrow,
    #[msg("The hold deadlines are invalid")]
    InvalidDeadline,
    #[msg("The signer is not authorized for this operation")]
    InvalidAuthority,
    #[msg("The operation sequence is stale")]
    InvalidSequence,
    #[msg("The capture deadline has passed")]
    CaptureExpired,
    #[msg("The capture deadline has not passed")]
    CaptureNotExpired,
    #[msg("The refund deadline has passed")]
    RefundExpired,
    #[msg("The hold is already closed")]
    HoldClosed,
    #[msg("The amount exceeds the remaining authorized balance")]
    AmountExceedsBalance,
    #[msg("The vault balance is less than the recorded hold")]
    InsufficientVault,
    #[msg("The payment counters overflow")]
    CounterOverflow,
}

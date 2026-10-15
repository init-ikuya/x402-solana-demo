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
}

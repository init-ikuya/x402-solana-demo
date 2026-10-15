use anchor_lang::prelude::*;

#[constant]
pub const CHANNEL_SEED: &[u8] = b"channel";

#[constant]
pub const MAX_CHANNEL_LIFETIME_SECONDS: i64 = 300;

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::{get_associated_token_address, AssociatedToken},
    token::{self, CloseAccount, Mint, Token, TokenAccount, TransferChecked},
};
use solana_instructions_sysvar::{load_current_index_checked, load_instruction_at_checked};

use crate::error::ErrorCode;

pub const BATCH_SEED: &[u8] = b"batch";
pub const BATCH_VOUCHER_DOMAIN: &[u8] = b"x402-anchor-batch-v1";
pub const MAX_BATCH_LIFETIME_SECONDS: i64 = 3_600;
pub const BATCH_CLAIM_GRACE_SECONDS: i64 = 300;

#[account]
#[derive(InitSpace)]
pub struct BatchChannel {
    pub payer: Pubkey,
    pub merchant: Pubkey,
    pub mint: Pubkey,
    pub rent_payer: Pubkey,
    pub deposit: u64,
    pub claimed: u64,
    pub expires_at: i64,
    pub nonce: u64,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct OpenBatch<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub rent_payer: Signer<'info>,
    /// CHECK: Bound to the batch channel; token account authority is checked on claims.
    pub merchant: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = payer)]
    pub payer_token: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = rent_payer,
        space = 8 + BatchChannel::INIT_SPACE,
        seeds = [BATCH_SEED, payer.key().as_ref(), merchant.key().as_ref(), mint.key().as_ref(), &nonce.to_le_bytes()],
        bump
    )]
    pub channel: Account<'info, BatchChannel>,
    #[account(
        init,
        payer = rent_payer,
        associated_token::mint = mint,
        associated_token::authority = channel
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_open_batch(
    ctx: Context<OpenBatch>,
    nonce: u64,
    deposit: u64,
    expires_at: i64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(deposit > 0, ErrorCode::InvalidAmount);
    require!(
        expires_at > now && expires_at <= now + MAX_BATCH_LIFETIME_SECONDS,
        ErrorCode::InvalidExpiry
    );
    let channel = &mut ctx.accounts.channel;
    channel.payer = ctx.accounts.payer.key();
    channel.merchant = ctx.accounts.merchant.key();
    channel.mint = ctx.accounts.mint.key();
    channel.rent_payer = ctx.accounts.rent_payer.key();
    channel.deposit = deposit;
    channel.claimed = 0;
    channel.expires_at = expires_at;
    channel.nonce = nonce;
    channel.bump = ctx.bumps.channel;
    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.payer_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        ),
        deposit,
        ctx.accounts.mint.decimals,
    )
}

#[derive(Accounts)]
pub struct ClaimBatch<'info> {
    #[account(
        mut,
        has_one = payer,
        has_one = merchant,
        has_one = mint,
        seeds = [BATCH_SEED, channel.payer.as_ref(), channel.merchant.as_ref(), channel.mint.as_ref(), &channel.nonce.to_le_bytes()],
        bump = channel.bump
    )]
    pub channel: Account<'info, BatchChannel>,
    /// CHECK: Bound to the channel and checked against the Ed25519 instruction.
    pub payer: UncheckedAccount<'info>,
    /// CHECK: Bound to the channel and checked as the destination token authority.
    pub merchant: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, address = get_associated_token_address(&channel.key(), &mint.key()), token::mint = mint, token::authority = channel)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::authority = merchant)]
    pub merchant_token: Account<'info, TokenAccount>,
    /// CHECK: Must be the instructions sysvar; load_instruction_at_checked validates the account.
    #[account(address = solana_sdk_ids::sysvar::instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn batch_voucher_message(channel: &Pubkey, cumulative_amount: u64) -> Vec<u8> {
    let mut message = Vec::with_capacity(BATCH_VOUCHER_DOMAIN.len() + 32 + 32 + 8);
    message.extend_from_slice(BATCH_VOUCHER_DOMAIN);
    message.extend_from_slice(crate::id().as_ref());
    message.extend_from_slice(channel.as_ref());
    message.extend_from_slice(&cumulative_amount.to_le_bytes());
    message
}

fn checked_inline_ed25519(
    sysvar: &AccountInfo,
    expected_payer: &Pubkey,
    expected_message: &[u8],
) -> Result<()> {
    let current =
        load_current_index_checked(sysvar).map_err(|_| error!(ErrorCode::InvalidBatchVoucher))?;
    require!(current > 0, ErrorCode::InvalidBatchVoucher);
    let instruction = load_instruction_at_checked((current - 1) as usize, sysvar)
        .map_err(|_| error!(ErrorCode::InvalidBatchVoucher))?;
    require_keys_eq!(
        instruction.program_id,
        solana_sdk_ids::ed25519_program::ID,
        ErrorCode::InvalidBatchVoucher
    );
    require!(
        instruction.accounts.is_empty(),
        ErrorCode::InvalidBatchVoucher
    );
    let data = &instruction.data;
    let size = 16 + 32 + 64 + expected_message.len();
    require!(
        data.len() == size && data[0] == 1 && data[1] == 0,
        ErrorCode::InvalidBatchVoucher
    );
    let field = |offset: usize| u16::from_le_bytes([data[offset], data[offset + 1]]);
    require!(
        field(2) == 48
            && field(4) == u16::MAX
            && field(6) == 16
            && field(8) == u16::MAX
            && field(10) == 112
            && field(12) == expected_message.len() as u16
            && field(14) == u16::MAX,
        ErrorCode::InvalidBatchVoucher
    );
    require!(
        data[16..48] == expected_payer.to_bytes(),
        ErrorCode::InvalidBatchVoucher
    );
    require!(
        data[112..] == *expected_message,
        ErrorCode::InvalidBatchVoucher
    );
    Ok(())
}

pub fn handle_claim_batch(ctx: Context<ClaimBatch>, cumulative_amount: u64) -> Result<()> {
    let channel = &ctx.accounts.channel;
    let deadline = channel
        .expires_at
        .checked_add(BATCH_CLAIM_GRACE_SECONDS)
        .ok_or(error!(ErrorCode::InvalidExpiry))?;
    require!(
        Clock::get()?.unix_timestamp <= deadline,
        ErrorCode::BatchClaimExpired
    );
    require!(
        cumulative_amount > channel.claimed,
        ErrorCode::StaleBatchVoucher
    );
    require!(
        cumulative_amount <= channel.deposit,
        ErrorCode::ChargeExceedsMaximum
    );
    let message = batch_voucher_message(&channel.key(), cumulative_amount);
    checked_inline_ed25519(
        &ctx.accounts.instructions_sysvar.to_account_info(),
        &channel.payer,
        &message,
    )?;
    let delta = cumulative_amount - channel.claimed;
    require!(
        ctx.accounts.vault.amount >= delta,
        ErrorCode::InsufficientEscrow
    );
    let nonce = channel.nonce.to_le_bytes();
    let bump = [channel.bump];
    let seeds: &[&[u8]] = &[
        BATCH_SEED,
        channel.payer.as_ref(),
        channel.merchant.as_ref(),
        channel.mint.as_ref(),
        &nonce,
        &bump,
    ];
    token::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.merchant_token.to_account_info(),
                authority: channel.to_account_info(),
            },
            &[seeds],
        ),
        delta,
        ctx.accounts.mint.decimals,
    )?;
    ctx.accounts.channel.claimed = cumulative_amount;
    Ok(())
}

#[derive(Accounts)]
pub struct CloseBatch<'info> {
    #[account(
        mut,
        close = rent_payer,
        has_one = payer,
        has_one = mint,
        has_one = rent_payer,
        seeds = [BATCH_SEED, channel.payer.as_ref(), channel.merchant.as_ref(), channel.mint.as_ref(), &channel.nonce.to_le_bytes()],
        bump = channel.bump
    )]
    pub channel: Account<'info, BatchChannel>,
    /// CHECK: Bound to the channel and checked as the refund token authority.
    pub payer: UncheckedAccount<'info>,
    #[account(mut)]
    pub rent_payer: SystemAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, address = get_associated_token_address(&channel.key(), &mint.key()), token::mint = mint, token::authority = channel)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::authority = payer)]
    pub payer_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_close_batch(ctx: Context<CloseBatch>) -> Result<()> {
    let channel = &ctx.accounts.channel;
    let deadline = channel
        .expires_at
        .checked_add(BATCH_CLAIM_GRACE_SECONDS)
        .ok_or(error!(ErrorCode::InvalidExpiry))?;
    require!(
        Clock::get()?.unix_timestamp > deadline,
        ErrorCode::BatchCloseTooEarly
    );
    let nonce = channel.nonce.to_le_bytes();
    let bump = [channel.bump];
    let seeds: &[&[u8]] = &[
        BATCH_SEED,
        channel.payer.as_ref(),
        channel.merchant.as_ref(),
        channel.mint.as_ref(),
        &nonce,
        &bump,
    ];
    let signer = &[seeds];
    if ctx.accounts.vault.amount > 0 {
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.payer_token.to_account_info(),
                    authority: channel.to_account_info(),
                },
                signer,
            ),
            ctx.accounts.vault.amount,
            ctx.accounts.mint.decimals,
        )?;
    }
    token::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.rent_payer.to_account_info(),
            authority: channel.to_account_info(),
        },
        signer,
    ))
}

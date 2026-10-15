use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, TransferChecked},
};

use crate::{constants::*, error::ErrorCode, state::PaymentChannel};

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct Open<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub rent_payer: Signer<'info>,
    /// CHECK: This address is bound to the channel and must sign settlement.
    pub merchant: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = payer)]
    pub payer_token: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = rent_payer,
        space = 8 + PaymentChannel::INIT_SPACE,
        seeds = [CHANNEL_SEED, payer.key().as_ref(), merchant.key().as_ref(), mint.key().as_ref(), &nonce.to_le_bytes()],
        bump
    )]
    pub channel: Account<'info, PaymentChannel>,
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

pub fn handle_open(ctx: Context<Open>, nonce: u64, max_amount: u64, expires_at: i64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(max_amount > 0, ErrorCode::InvalidAmount);
    require!(
        expires_at > now && expires_at <= now + MAX_CHANNEL_LIFETIME_SECONDS,
        ErrorCode::InvalidExpiry
    );
    let channel = &mut ctx.accounts.channel;
    channel.payer = ctx.accounts.payer.key();
    channel.merchant = ctx.accounts.merchant.key();
    channel.mint = ctx.accounts.mint.key();
    channel.rent_payer = ctx.accounts.rent_payer.key();
    channel.max_amount = max_amount;
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
        max_amount,
        ctx.accounts.mint.decimals,
    )
}

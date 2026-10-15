use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, TransferChecked};

use crate::{constants::*, error::ErrorCode, state::PaymentChannel};

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(
        mut,
        close = rent_payer,
        has_one = payer,
        has_one = mint,
        has_one = rent_payer,
        seeds = [CHANNEL_SEED, channel.payer.as_ref(), channel.merchant.as_ref(), channel.mint.as_ref(), &channel.nonce.to_le_bytes()],
        bump = channel.bump
    )]
    pub channel: Account<'info, PaymentChannel>,
    pub payer: Signer<'info>,
    #[account(mut)]
    pub rent_payer: SystemAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = channel)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::authority = payer)]
    pub payer_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_refund(ctx: Context<Refund>) -> Result<()> {
    let channel = &ctx.accounts.channel;
    require!(
        Clock::get()?.unix_timestamp > channel.expires_at,
        ErrorCode::ChannelNotExpired
    );
    let nonce = channel.nonce.to_le_bytes();
    let bump = [channel.bump];
    let seeds: &[&[u8]] = &[
        CHANNEL_SEED,
        channel.payer.as_ref(),
        channel.merchant.as_ref(),
        channel.mint.as_ref(),
        &nonce,
        &bump,
    ];
    let signer = &[seeds];
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

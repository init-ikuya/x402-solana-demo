use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, TransferChecked};

use crate::{constants::*, error::ErrorCode, state::PaymentChannel};

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(
        mut,
        close = rent_payer,
        has_one = merchant,
        has_one = payer,
        has_one = mint,
        has_one = rent_payer,
        seeds = [CHANNEL_SEED, channel.payer.as_ref(), channel.merchant.as_ref(), channel.mint.as_ref(), &channel.nonce.to_le_bytes()],
        bump = channel.bump
    )]
    pub channel: Account<'info, PaymentChannel>,
    pub merchant: Signer<'info>,
    /// CHECK: The channel account binds this address, and its token account receives the refund.
    pub payer: UncheckedAccount<'info>,
    #[account(mut)]
    pub rent_payer: SystemAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = channel)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::authority = merchant)]
    pub merchant_token: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::authority = payer)]
    pub payer_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_settle(ctx: Context<Settle>, amount: u64) -> Result<()> {
    let channel = &ctx.accounts.channel;
    require!(
        Clock::get()?.unix_timestamp <= channel.expires_at,
        ErrorCode::ChannelExpired
    );
    require!(
        amount <= channel.max_amount,
        ErrorCode::ChargeExceedsMaximum
    );
    require!(
        ctx.accounts.vault.amount >= channel.max_amount,
        ErrorCode::InsufficientEscrow
    );
    let refund = ctx.accounts.vault.amount - amount;
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
    if amount > 0 {
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.merchant_token.to_account_info(),
                    authority: channel.to_account_info(),
                },
                signer,
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;
    }
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
        refund,
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

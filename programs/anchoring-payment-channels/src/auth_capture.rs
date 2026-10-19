use crate::error::ErrorCode;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, TransferChecked},
};

pub const AUTH_CAPTURE_SEED: &[u8] = b"auth-capture";
pub const MAX_HOLD_LIFETIME_SECONDS: i64 = 86_400;

#[account]
#[derive(InitSpace)]
pub struct AuthCapturePayment {
    pub payer: Pubkey,
    pub merchant: Pubkey,
    pub mint: Pubkey,
    pub payer_token: Pubkey,
    pub merchant_token: Pubkey,
    pub vault: Pubkey,
    pub funded: u64,
    pub captured: u64,
    pub released: u64,
    pub refunded: u64,
    pub next_operation: u64,
    pub nonce: u64,
    pub capture_deadline: i64,
    pub refund_deadline: i64,
    pub hold_closed: bool,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct AuthorizeHold<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub rent_payer: Signer<'info>,
    /// CHECK: Bound to the payment record and its token account.
    pub merchant: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = payer)]
    pub payer_token: Account<'info, TokenAccount>,
    #[account(token::mint = mint, token::authority = merchant)]
    pub merchant_token: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = rent_payer,
        space = 8 + AuthCapturePayment::INIT_SPACE,
        seeds = [AUTH_CAPTURE_SEED, payer.key().as_ref(), &nonce.to_le_bytes()],
        bump
    )]
    pub payment: Account<'info, AuthCapturePayment>,
    #[account(
        init,
        payer = rent_payer,
        associated_token::mint = mint,
        associated_token::authority = payment
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn authorize_hold(
    ctx: Context<AuthorizeHold>,
    nonce: u64,
    amount: u64,
    capture_deadline: i64,
    refund_deadline: i64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(amount > 0, ErrorCode::InvalidAmount);
    require!(
        capture_deadline > now
            && refund_deadline >= capture_deadline
            && refund_deadline <= now.saturating_add(MAX_HOLD_LIFETIME_SECONDS),
        ErrorCode::InvalidDeadline
    );
    let payment = &mut ctx.accounts.payment;
    payment.payer = ctx.accounts.payer.key();
    payment.merchant = ctx.accounts.merchant.key();
    payment.mint = ctx.accounts.mint.key();
    payment.payer_token = ctx.accounts.payer_token.key();
    payment.merchant_token = ctx.accounts.merchant_token.key();
    payment.vault = ctx.accounts.vault.key();
    payment.funded = amount;
    payment.captured = 0;
    payment.released = 0;
    payment.refunded = 0;
    payment.next_operation = 0;
    payment.nonce = nonce;
    payment.capture_deadline = capture_deadline;
    payment.refund_deadline = refund_deadline;
    payment.hold_closed = false;
    payment.bump = ctx.bumps.payment;
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
        amount,
        ctx.accounts.mint.decimals,
    )
}

#[derive(Accounts)]
pub struct HoldOperation<'info> {
    #[account(
        mut,
        has_one = payer,
        has_one = merchant,
        has_one = mint,
        has_one = payer_token,
        has_one = merchant_token,
        has_one = vault,
        seeds = [AUTH_CAPTURE_SEED, payment.payer.as_ref(), &payment.nonce.to_le_bytes()],
        bump = payment.bump
    )]
    pub payment: Account<'info, AuthCapturePayment>,
    pub authority: Signer<'info>,
    /// CHECK: The payment record binds the payer address.
    pub payer: UncheckedAccount<'info>,
    /// CHECK: The payment record binds the merchant address.
    pub merchant: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = payment)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::authority = payer)]
    pub payer_token: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::authority = merchant)]
    pub merchant_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Clone, Copy)]
pub enum HoldAction {
    Capture,
    CaptureAndVoid,
    Void,
    Reclaim,
}

fn remaining(payment: &AuthCapturePayment) -> Result<u64> {
    payment
        .funded
        .checked_sub(
            payment
                .captured
                .checked_add(payment.released)
                .ok_or(ErrorCode::CounterOverflow)?,
        )
        .ok_or_else(|| error!(ErrorCode::CounterOverflow))
}

pub fn operate_hold(
    ctx: Context<HoldOperation>,
    action: HoldAction,
    amount: u64,
    sequence: u64,
) -> Result<()> {
    let payment = &ctx.accounts.payment;
    require!(
        sequence == payment.next_operation,
        ErrorCode::InvalidSequence
    );
    require!(!payment.hold_closed, ErrorCode::HoldClosed);
    let now = Clock::get()?.unix_timestamp;
    let is_reclaim = matches!(action, HoldAction::Reclaim);
    let expected = if is_reclaim {
        payment.payer
    } else {
        payment.merchant
    };
    require_keys_eq!(
        ctx.accounts.authority.key(),
        expected,
        ErrorCode::InvalidAuthority
    );
    if is_reclaim {
        require!(
            now >= payment.capture_deadline,
            ErrorCode::CaptureNotExpired
        );
    } else if matches!(action, HoldAction::Capture | HoldAction::CaptureAndVoid) {
        require!(now < payment.capture_deadline, ErrorCode::CaptureExpired);
    }
    let available = remaining(payment)?;
    require!(available > 0, ErrorCode::HoldClosed);
    require!(
        ctx.accounts.vault.amount >= available,
        ErrorCode::InsufficientVault
    );
    let captured = if matches!(action, HoldAction::Capture | HoldAction::CaptureAndVoid) {
        amount
    } else {
        require!(amount == 0, ErrorCode::InvalidAmount);
        0
    };
    require!(captured <= available, ErrorCode::AmountExceedsBalance);
    if matches!(action, HoldAction::Capture) {
        require!(captured > 0, ErrorCode::InvalidAmount);
    }
    let released = if matches!(action, HoldAction::Capture) {
        0
    } else {
        available - captured
    };
    let nonce = payment.nonce.to_le_bytes();
    let bump = [payment.bump];
    let seeds: &[&[u8]] = &[AUTH_CAPTURE_SEED, payment.payer.as_ref(), &nonce, &bump];
    let signer = &[seeds];
    if captured > 0 {
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.merchant_token.to_account_info(),
                    authority: payment.to_account_info(),
                },
                signer,
            ),
            captured,
            ctx.accounts.mint.decimals,
        )?;
    }
    if released > 0 {
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.payer_token.to_account_info(),
                    authority: payment.to_account_info(),
                },
                signer,
            ),
            released,
            ctx.accounts.mint.decimals,
        )?;
    }
    let payment = &mut ctx.accounts.payment;
    payment.captured = payment
        .captured
        .checked_add(captured)
        .ok_or(ErrorCode::CounterOverflow)?;
    payment.released = payment
        .released
        .checked_add(released)
        .ok_or(ErrorCode::CounterOverflow)?;
    payment.next_operation = payment
        .next_operation
        .checked_add(1)
        .ok_or(ErrorCode::CounterOverflow)?;
    payment.hold_closed = released > 0 || payment.captured == payment.funded;
    Ok(())
}

pub fn refund_captured(ctx: Context<HoldOperation>, amount: u64, sequence: u64) -> Result<()> {
    let payment = &ctx.accounts.payment;
    require_keys_eq!(
        ctx.accounts.authority.key(),
        payment.merchant,
        ErrorCode::InvalidAuthority
    );
    require!(
        sequence == payment.next_operation,
        ErrorCode::InvalidSequence
    );
    require!(
        Clock::get()?.unix_timestamp < payment.refund_deadline,
        ErrorCode::RefundExpired
    );
    require!(amount > 0, ErrorCode::InvalidAmount);
    let refundable = payment
        .captured
        .checked_sub(payment.refunded)
        .ok_or(ErrorCode::CounterOverflow)?;
    require!(amount <= refundable, ErrorCode::AmountExceedsBalance);
    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.merchant_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.payer_token.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;
    let payment = &mut ctx.accounts.payment;
    payment.refunded = payment
        .refunded
        .checked_add(amount)
        .ok_or(ErrorCode::CounterOverflow)?;
    payment.next_operation = payment
        .next_operation
        .checked_add(1)
        .ok_or(ErrorCode::CounterOverflow)?;
    Ok(())
}

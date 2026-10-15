use {
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::{program_option::COption, program_pack::Pack, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    anchor_spl::{
        associated_token::{get_associated_token_address, ID as ASSOCIATED_TOKEN_ID},
        token::{spl_token, ID as TOKEN_ID},
    },
    litesvm::LiteSVM,
    solana_account::Account,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

type Mint = spl_token::state::Mint;
type TokenAccount = spl_token::state::Account;

fn put_mint(svm: &mut LiteSVM, mint: Pubkey) {
    let mut data = vec![0; Mint::LEN];
    Mint::pack(
        Mint {
            mint_authority: COption::None,
            supply: 1_000_000,
            decimals: 6,
            is_initialized: true,
            freeze_authority: COption::None,
        },
        &mut data,
    )
    .unwrap();
    svm.set_account(
        mint,
        Account {
            lamports: 1_000_000,
            data,
            owner: TOKEN_ID,
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();
}

fn put_token(svm: &mut LiteSVM, address: Pubkey, mint: Pubkey, owner: Pubkey, amount: u64) {
    let mut data = vec![0; TokenAccount::LEN];
    TokenAccount::pack(
        TokenAccount {
            mint,
            owner,
            amount,
            delegate: COption::None,
            state: spl_token::state::AccountState::Initialized,
            is_native: COption::None,
            delegated_amount: 0,
            close_authority: COption::None,
        },
        &mut data,
    )
    .unwrap();
    svm.set_account(
        address,
        Account {
            lamports: 1_000_000,
            data,
            owner: TOKEN_ID,
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();
}

fn balance(svm: &LiteSVM, key: Pubkey) -> u64 {
    TokenAccount::unpack(&svm.get_account(&key).unwrap().data)
        .unwrap()
        .amount
}

fn send(
    svm: &mut LiteSVM,
    instruction: anchor_lang::solana_program::instruction::Instruction,
    fee_payer: &Keypair,
    signers: &[&Keypair],
) -> bool {
    let message = Message::new_with_blockhash(
        &[instruction],
        Some(&fee_payer.pubkey()),
        &svm.latest_blockhash(),
    );
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(message), signers).unwrap();
    svm.send_transaction(tx).is_ok()
}

#[test]
fn settles_actual_amount_and_returns_unspent_deposit() {
    let program_id = anchoring_payment_channels::id();
    let payer = Keypair::new();
    let merchant = Keypair::new();
    let sponsor = Keypair::new();
    let mint = Pubkey::new_unique();
    let payer_token = Pubkey::new_unique();
    let merchant_token = Pubkey::new_unique();
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(
        env!("CARGO_TARGET_TMPDIR"),
        "/../deploy/anchoring_payment_channels.so"
    ));
    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&payer.pubkey(), 1_000_000_000).unwrap();
    svm.airdrop(&merchant.pubkey(), 1_000_000_000).unwrap();
    svm.airdrop(&sponsor.pubkey(), 1_000_000_000).unwrap();
    put_mint(&mut svm, mint);
    put_token(&mut svm, payer_token, mint, payer.pubkey(), 2_000);
    put_token(&mut svm, merchant_token, mint, merchant.pubkey(), 0);

    let nonce: u64 = 7;
    let channel = Pubkey::find_program_address(
        &[
            b"channel",
            payer.pubkey().as_ref(),
            merchant.pubkey().as_ref(),
            mint.as_ref(),
            &nonce.to_le_bytes(),
        ],
        &program_id,
    )
    .0;
    let vault = get_associated_token_address(&channel, &mint);
    let expiry = svm.get_sysvar::<Clock>().unix_timestamp + 200;
    let open = anchor_lang::solana_program::instruction::Instruction::new_with_bytes(
        program_id,
        &anchoring_payment_channels::instruction::Open {
            nonce,
            max_amount: 1_000,
            expires_at: expiry,
        }
        .data(),
        anchoring_payment_channels::accounts::Open {
            payer: payer.pubkey(),
            rent_payer: sponsor.pubkey(),
            merchant: merchant.pubkey(),
            mint,
            payer_token,
            channel,
            vault,
            token_program: TOKEN_ID,
            associated_token_program: ASSOCIATED_TOKEN_ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    assert!(send(&mut svm, open, &sponsor, &[&payer, &sponsor]));
    assert_eq!(balance(&svm, payer_token), 1_000);
    assert_eq!(balance(&svm, vault), 1_000);
    let mut account_data: &[u8] = &svm.get_account(&channel).unwrap().data;
    let state =
        anchoring_payment_channels::state::PaymentChannel::try_deserialize(&mut account_data)
            .unwrap();
    assert_eq!(state.max_amount, 1_000);
    assert_eq!(state.merchant, merchant.pubkey());

    let settle = |amount| {
        anchor_lang::solana_program::instruction::Instruction::new_with_bytes(
            program_id,
            &anchoring_payment_channels::instruction::Settle { amount }.data(),
            anchoring_payment_channels::accounts::Settle {
                channel,
                merchant: merchant.pubkey(),
                payer: payer.pubkey(),
                rent_payer: sponsor.pubkey(),
                mint,
                vault,
                merchant_token,
                payer_token,
                token_program: TOKEN_ID,
            }
            .to_account_metas(None),
        )
    };
    assert!(!send(
        &mut svm,
        settle(1_001),
        &sponsor,
        &[&merchant, &sponsor]
    ));
    assert_eq!(balance(&svm, vault), 1_000);
    assert!(send(
        &mut svm,
        settle(300),
        &sponsor,
        &[&merchant, &sponsor]
    ));
    assert_eq!(balance(&svm, merchant_token), 300);
    assert_eq!(balance(&svm, payer_token), 1_700);
    assert!(svm.get_account(&channel).is_none());
    assert!(svm.get_account(&vault).is_none());

    // A second request uses a distinct nonce. The payer can recover its ceiling
    // after the deadline if the merchant never settles it.
    let second_nonce: u64 = 8;
    let second_channel = Pubkey::find_program_address(
        &[
            b"channel",
            payer.pubkey().as_ref(),
            merchant.pubkey().as_ref(),
            mint.as_ref(),
            &second_nonce.to_le_bytes(),
        ],
        &program_id,
    )
    .0;
    let second_vault = get_associated_token_address(&second_channel, &mint);
    let second_expiry = svm.get_sysvar::<Clock>().unix_timestamp + 100;
    let second_open = anchor_lang::solana_program::instruction::Instruction::new_with_bytes(
        program_id,
        &anchoring_payment_channels::instruction::Open {
            nonce: second_nonce,
            max_amount: 1_000,
            expires_at: second_expiry,
        }
        .data(),
        anchoring_payment_channels::accounts::Open {
            payer: payer.pubkey(),
            rent_payer: sponsor.pubkey(),
            merchant: merchant.pubkey(),
            mint,
            payer_token,
            channel: second_channel,
            vault: second_vault,
            token_program: TOKEN_ID,
            associated_token_program: ASSOCIATED_TOKEN_ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    assert!(send(&mut svm, second_open, &sponsor, &[&payer, &sponsor]));
    let refund = anchor_lang::solana_program::instruction::Instruction::new_with_bytes(
        program_id,
        &anchoring_payment_channels::instruction::Refund {}.data(),
        anchoring_payment_channels::accounts::Refund {
            channel: second_channel,
            payer: payer.pubkey(),
            rent_payer: sponsor.pubkey(),
            mint,
            vault: second_vault,
            payer_token,
            token_program: TOKEN_ID,
        }
        .to_account_metas(None),
    );
    assert!(!send(
        &mut svm,
        refund.clone(),
        &sponsor,
        &[&payer, &sponsor]
    ));
    assert_eq!(balance(&svm, payer_token), 700);
    let mut clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp = second_expiry + 1;
    svm.set_sysvar(&clock);
    svm.expire_blockhash();
    assert!(send(&mut svm, refund, &sponsor, &[&payer, &sponsor]));
    assert_eq!(balance(&svm, payer_token), 1_700);
    assert!(svm.get_account(&second_channel).is_none());
    assert!(svm.get_account(&second_vault).is_none());
}

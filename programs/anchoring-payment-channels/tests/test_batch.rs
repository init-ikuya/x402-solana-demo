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
type Instruction = anchor_lang::solana_program::instruction::Instruction;

fn put_mint(svm: &mut LiteSVM, mint: Pubkey) {
    let mut data = vec![0; Mint::LEN];
    Mint::pack(
        Mint {
            mint_authority: COption::None,
            supply: 10_000,
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
    instructions: &[Instruction],
    sponsor: &Keypair,
    signers: &[&Keypair],
) -> bool {
    let message = Message::new_with_blockhash(
        instructions,
        Some(&sponsor.pubkey()),
        &svm.latest_blockhash(),
    );
    let transaction =
        VersionedTransaction::try_new(VersionedMessage::Legacy(message), signers).unwrap();
    match svm.send_transaction(transaction) {
        Ok(_) => true,
        Err(error) => {
            eprintln!("Batch transaction failed: {error:?}");
            false
        }
    }
}

fn voucher_instruction(payer: &Keypair, channel: Pubkey, amount: u64) -> Instruction {
    let message = anchoring_payment_channels::batch::batch_voucher_message(&channel, amount);
    let signature = payer.sign_message(&message);
    let mut data = vec![0u8; 112 + message.len()];
    data[0] = 1;
    for (at, value) in [
        (2, 48u16),
        (4, u16::MAX),
        (6, 16),
        (8, u16::MAX),
        (10, 112),
        (12, message.len() as u16),
        (14, u16::MAX),
    ] {
        data[at..at + 2].copy_from_slice(&value.to_le_bytes());
    }
    data[16..48].copy_from_slice(payer.pubkey().as_ref());
    data[48..112].copy_from_slice(signature.as_ref());
    data[112..].copy_from_slice(&message);
    Instruction {
        program_id: solana_sdk_ids::ed25519_program::ID,
        accounts: vec![],
        data,
    }
}

#[test]
fn batch_reuses_escrow_and_enforces_signed_cumulative_amount() {
    let program_id = anchoring_payment_channels::id();
    let payer = Keypair::new();
    let merchant = Keypair::new();
    let sponsor = Keypair::new();
    let attacker = Keypair::new();
    let mint = Pubkey::new_unique();
    let payer_token = Pubkey::new_unique();
    let merchant_token = Pubkey::new_unique();
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(
        env!("CARGO_TARGET_TMPDIR"),
        "/../deploy/anchoring_payment_channels.so"
    ));
    svm.add_program(program_id, bytes).unwrap();
    for key in [&payer, &merchant, &sponsor, &attacker] {
        svm.airdrop(&key.pubkey(), 1_000_000_000).unwrap();
    }
    put_mint(&mut svm, mint);
    put_token(&mut svm, payer_token, mint, payer.pubkey(), 2_000);
    put_token(&mut svm, merchant_token, mint, merchant.pubkey(), 0);
    let nonce = 17u64;
    let channel = Pubkey::find_program_address(
        &[
            b"batch",
            payer.pubkey().as_ref(),
            merchant.pubkey().as_ref(),
            mint.as_ref(),
            &nonce.to_le_bytes(),
        ],
        &program_id,
    )
    .0;
    let vault = get_associated_token_address(&channel, &mint);
    let expiry = svm.get_sysvar::<Clock>().unix_timestamp + 100;
    let open = Instruction::new_with_bytes(
        program_id,
        &anchoring_payment_channels::instruction::OpenBatch {
            nonce,
            deposit: 1_000,
            expires_at: expiry,
        }
        .data(),
        anchoring_payment_channels::accounts::OpenBatch {
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
    assert!(send(&mut svm, &[open], &sponsor, &[&payer, &sponsor]));
    assert_eq!(balance(&svm, vault), 1_000);
    let claim = |amount| {
        Instruction::new_with_bytes(
            program_id,
            &anchoring_payment_channels::instruction::ClaimBatch {
                cumulative_amount: amount,
            }
            .data(),
            anchoring_payment_channels::accounts::ClaimBatch {
                channel,
                payer: payer.pubkey(),
                merchant: merchant.pubkey(),
                mint,
                vault,
                merchant_token,
                instructions_sysvar: solana_sdk_ids::sysvar::instructions::ID,
                token_program: TOKEN_ID,
            }
            .to_account_metas(None),
        )
    };
    assert!(!send(&mut svm, &[claim(300)], &sponsor, &[&sponsor]));
    assert!(!send(
        &mut svm,
        &[voucher_instruction(&attacker, channel, 300), claim(300)],
        &sponsor,
        &[&sponsor]
    ));
    assert!(!send(
        &mut svm,
        &[voucher_instruction(&payer, channel, 1_001), claim(1_001)],
        &sponsor,
        &[&sponsor]
    ));
    assert!(send(
        &mut svm,
        &[voucher_instruction(&payer, channel, 300), claim(300)],
        &sponsor,
        &[&sponsor]
    ));
    assert_eq!(balance(&svm, merchant_token), 300);
    assert_eq!(balance(&svm, vault), 700);
    svm.expire_blockhash();
    assert!(!send(
        &mut svm,
        &[voucher_instruction(&payer, channel, 300), claim(300)],
        &sponsor,
        &[&sponsor]
    ));
    assert!(send(
        &mut svm,
        &[voucher_instruction(&payer, channel, 550), claim(550)],
        &sponsor,
        &[&sponsor]
    ));
    assert_eq!(balance(&svm, merchant_token), 550);
    assert_eq!(balance(&svm, vault), 450);
    let mut state_data: &[u8] = &svm.get_account(&channel).unwrap().data;
    let state =
        anchoring_payment_channels::batch::BatchChannel::try_deserialize(&mut state_data).unwrap();
    assert_eq!(state.claimed, 550);

    let close = Instruction::new_with_bytes(
        program_id,
        &anchoring_payment_channels::instruction::CloseBatch {}.data(),
        anchoring_payment_channels::accounts::CloseBatch {
            channel,
            payer: payer.pubkey(),
            rent_payer: sponsor.pubkey(),
            mint,
            vault,
            payer_token,
            token_program: TOKEN_ID,
        }
        .to_account_metas(None),
    );
    assert!(!send(&mut svm, &[close.clone()], &sponsor, &[&sponsor]));
    let mut clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp = expiry + 1;
    svm.set_sysvar(&clock);
    svm.expire_blockhash();
    assert!(send(
        &mut svm,
        &[voucher_instruction(&payer, channel, 600), claim(600)],
        &sponsor,
        &[&sponsor]
    ));
    clock.unix_timestamp = expiry + 301;
    svm.set_sysvar(&clock);
    svm.expire_blockhash();
    assert!(!send(
        &mut svm,
        &[voucher_instruction(&payer, channel, 700), claim(700)],
        &sponsor,
        &[&sponsor]
    ));
    assert!(send(&mut svm, &[close], &sponsor, &[&sponsor]));
    assert_eq!(balance(&svm, payer_token), 1_400);
    assert_eq!(balance(&svm, merchant_token), 600);
    assert!(svm.get_account(&channel).is_none());
    assert!(svm.get_account(&vault).is_none());
}

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

struct Fixture {
    svm: LiteSVM,
    payer: Keypair,
    merchant: Keypair,
    sponsor: Keypair,
    mint: Pubkey,
    payer_token: Pubkey,
    merchant_token: Pubkey,
    payment: Pubkey,
    vault: Pubkey,
    nonce: u64,
}

impl Fixture {
    fn new() -> Self {
        let payer = Keypair::new();
        let merchant = Keypair::new();
        let sponsor = Keypair::new();
        let mint = Pubkey::new_unique();
        let payer_token = Pubkey::new_unique();
        let merchant_token = Pubkey::new_unique();
        let nonce: u64 = 101;
        let payment = Pubkey::find_program_address(
            &[
                b"auth-capture",
                payer.pubkey().as_ref(),
                &nonce.to_le_bytes(),
            ],
            &anchoring_payment_channels::id(),
        )
        .0;
        let vault = get_associated_token_address(&payment, &mint);
        let mut svm = LiteSVM::new();
        let bytes = include_bytes!(concat!(
            env!("CARGO_TARGET_TMPDIR"),
            "/../deploy/anchoring_payment_channels.so"
        ));
        svm.add_program(anchoring_payment_channels::id(), bytes)
            .unwrap();
        for wallet in [&payer, &merchant, &sponsor] {
            svm.airdrop(&wallet.pubkey(), 1_000_000_000).unwrap();
        }
        put_mint(&mut svm, mint);
        put_token(&mut svm, payer_token, mint, payer.pubkey(), 2_000);
        put_token(&mut svm, merchant_token, mint, merchant.pubkey(), 0);
        Self {
            svm,
            payer,
            merchant,
            sponsor,
            mint,
            payer_token,
            merchant_token,
            payment,
            vault,
            nonce,
        }
    }

    fn send(
        &mut self,
        data: Vec<u8>,
        accounts: Vec<anchor_lang::solana_program::instruction::AccountMeta>,
        authority: Pubkey,
    ) -> bool {
        self.svm.expire_blockhash();
        let ix = anchor_lang::solana_program::instruction::Instruction::new_with_bytes(
            anchoring_payment_channels::id(),
            &data,
            accounts,
        );
        let message = Message::new_with_blockhash(
            &[ix],
            Some(&self.sponsor.pubkey()),
            &self.svm.latest_blockhash(),
        );
        let signed: &[&Keypair] = if authority == self.payer.pubkey() {
            &[&self.sponsor, &self.payer]
        } else {
            &[&self.sponsor, &self.merchant]
        };
        let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(message), signed).unwrap();
        self.svm.send_transaction(tx).is_ok()
    }

    fn authorize(&mut self, amount: u64, capture_deadline: i64, refund_deadline: i64) -> bool {
        let data = anchoring_payment_channels::instruction::AuthorizeHold {
            nonce: self.nonce,
            amount,
            capture_deadline,
            refund_deadline,
        }
        .data();
        let accounts = anchoring_payment_channels::accounts::AuthorizeHold {
            payer: self.payer.pubkey(),
            rent_payer: self.sponsor.pubkey(),
            merchant: self.merchant.pubkey(),
            mint: self.mint,
            payer_token: self.payer_token,
            merchant_token: self.merchant_token,
            payment: self.payment,
            vault: self.vault,
            token_program: TOKEN_ID,
            associated_token_program: ASSOCIATED_TOKEN_ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None);
        self.send(data, accounts, self.payer.pubkey())
    }

    fn operation(&mut self, data: Vec<u8>, authority: Pubkey) -> bool {
        let accounts = anchoring_payment_channels::accounts::HoldOperation {
            payment: self.payment,
            authority,
            payer: self.payer.pubkey(),
            merchant: self.merchant.pubkey(),
            mint: self.mint,
            vault: self.vault,
            payer_token: self.payer_token,
            merchant_token: self.merchant_token,
            token_program: TOKEN_ID,
        }
        .to_account_metas(None);
        self.send(data, accounts, authority)
    }

    fn balance(&self, key: Pubkey) -> u64 {
        TokenAccount::unpack(&self.svm.get_account(&key).unwrap().data)
            .unwrap()
            .amount
    }

    fn state(&self) -> anchoring_payment_channels::AuthCapturePayment {
        let account = self.svm.get_account(&self.payment).unwrap();
        let mut bytes: &[u8] = &account.data;
        anchoring_payment_channels::AuthCapturePayment::try_deserialize(&mut bytes).unwrap()
    }
}

#[test]
fn partial_capture_release_and_merchant_funded_refund() {
    let mut f = Fixture::new();
    let now = f.svm.get_sysvar::<Clock>().unix_timestamp;
    assert!(f.authorize(1_000, now + 100, now + 200));
    assert_eq!(f.balance(f.payer_token), 1_000);
    assert_eq!(f.balance(f.vault), 1_000);
    assert!(!f.operation(
        anchoring_payment_channels::instruction::CaptureHold {
            amount: 300,
            sequence: 0
        }
        .data(),
        f.payer.pubkey()
    ));
    assert!(!f.operation(
        anchoring_payment_channels::instruction::CaptureHold {
            amount: 1_001,
            sequence: 0
        }
        .data(),
        f.merchant.pubkey()
    ));
    assert!(f.operation(
        anchoring_payment_channels::instruction::CaptureHold {
            amount: 300,
            sequence: 0
        }
        .data(),
        f.merchant.pubkey()
    ));
    assert_eq!(f.balance(f.merchant_token), 300);
    assert_eq!(f.balance(f.vault), 700);
    assert!(!f.operation(
        anchoring_payment_channels::instruction::CaptureHold {
            amount: 100,
            sequence: 0
        }
        .data(),
        f.merchant.pubkey()
    ));
    assert!(f.operation(
        anchoring_payment_channels::instruction::CaptureAndVoidHold {
            amount: 0,
            sequence: 1
        }
        .data(),
        f.merchant.pubkey()
    ));
    assert_eq!(f.balance(f.payer_token), 1_700);
    assert_eq!(f.balance(f.vault), 0);
    assert!(!f.operation(
        anchoring_payment_channels::instruction::VoidHold { sequence: 2 }.data(),
        f.merchant.pubkey()
    ));
    assert!(!f.operation(
        anchoring_payment_channels::instruction::RefundCaptured {
            amount: 301,
            sequence: 2
        }
        .data(),
        f.merchant.pubkey()
    ));
    assert!(f.operation(
        anchoring_payment_channels::instruction::RefundCaptured {
            amount: 100,
            sequence: 2
        }
        .data(),
        f.merchant.pubkey()
    ));
    put_token(&mut f.svm, f.merchant_token, f.mint, f.merchant.pubkey(), 0);
    assert!(!f.operation(
        anchoring_payment_channels::instruction::RefundCaptured {
            amount: 100,
            sequence: 3
        }
        .data(),
        f.merchant.pubkey()
    ));
    assert_eq!(f.state().refunded, 100);
    put_token(
        &mut f.svm,
        f.merchant_token,
        f.mint,
        f.merchant.pubkey(),
        200,
    );
    let state = f.state();
    assert_eq!(
        (state.funded, state.captured, state.released, state.refunded),
        (1_000, 300, 700, 100)
    );
    assert_eq!(state.next_operation, 3);
    assert!(state.hold_closed);
    assert_eq!(f.balance(f.merchant_token), 200);
    assert_eq!(f.balance(f.payer_token), 1_800);
}

#[test]
fn atomic_capture_and_void_and_standalone_void_move_exact_balances() {
    let mut paid = Fixture::new();
    let now = paid.svm.get_sysvar::<Clock>().unix_timestamp;
    assert!(paid.authorize(1_000, now + 100, now + 200));
    assert!(paid.operation(
        anchoring_payment_channels::instruction::CaptureAndVoidHold {
            amount: 300,
            sequence: 0
        }
        .data(),
        paid.merchant.pubkey()
    ));
    let state = paid.state();
    assert_eq!(
        (state.funded, state.captured, state.released, state.refunded),
        (1_000, 300, 700, 0)
    );
    assert_eq!(state.next_operation, 1);
    assert!(state.hold_closed);
    assert_eq!(paid.balance(paid.payer_token), 1_700);
    assert_eq!(paid.balance(paid.merchant_token), 300);
    assert_eq!(paid.balance(paid.vault), 0);

    let mut canceled = Fixture::new();
    let now = canceled.svm.get_sysvar::<Clock>().unix_timestamp;
    assert!(canceled.authorize(500, now + 100, now + 200));
    assert!(canceled.operation(
        anchoring_payment_channels::instruction::VoidHold { sequence: 0 }.data(),
        canceled.merchant.pubkey()
    ));
    let state = canceled.state();
    assert_eq!((state.captured, state.released), (0, 500));
    assert_eq!(state.next_operation, 1);
    assert!(state.hold_closed);
    assert_eq!(canceled.balance(canceled.payer_token), 2_000);
    assert_eq!(canceled.balance(canceled.merchant_token), 0);
    assert_eq!(canceled.balance(canceled.vault), 0);
}

#[test]
fn deadline_reclaim_is_direct_and_payment_identity_cannot_reopen() {
    let mut f = Fixture::new();
    let now = f.svm.get_sysvar::<Clock>().unix_timestamp;
    let deadline = now + 100;
    assert!(!f.authorize(0, deadline, deadline + 100));
    assert!(!f.authorize(500, now, deadline + 100));
    assert!(f.authorize(500, deadline, deadline + 100));
    assert!(!f.authorize(500, deadline, deadline + 100));
    assert!(!f.operation(
        anchoring_payment_channels::instruction::ReclaimHold { sequence: 0 }.data(),
        f.payer.pubkey()
    ));
    let mut clock = f.svm.get_sysvar::<Clock>();
    clock.unix_timestamp = deadline;
    f.svm.set_sysvar(&clock);
    assert!(!f.operation(
        anchoring_payment_channels::instruction::CaptureHold {
            amount: 100,
            sequence: 0
        }
        .data(),
        f.merchant.pubkey()
    ));
    assert!(f.operation(
        anchoring_payment_channels::instruction::ReclaimHold { sequence: 0 }.data(),
        f.payer.pubkey()
    ));
    assert_eq!(f.balance(f.payer_token), 2_000);
    assert_eq!(f.balance(f.vault), 0);
    let state = f.state();
    assert!(state.hold_closed);
    assert_eq!(state.released, 500);
    assert_eq!(state.next_operation, 1);
    assert!(!f.operation(
        anchoring_payment_channels::instruction::ReclaimHold { sequence: 1 }.data(),
        f.payer.pubkey()
    ));
}

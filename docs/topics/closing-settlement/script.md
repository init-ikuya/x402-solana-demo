# Fall Class — Issue #90 speaker script

英語・5分。独立した7枚の発表案です。Demo Dayは2026年10月19日または21日（未確定、発表者提供）。4方式の実装要件は維持し、説明は#90に絞ります。Issue #83案は採用しません。

## 時間配分

| Slide | 内容 | 秒 |
| --- | --- | --- |
| 1 | Introduction | 20 |
| 2 | Context | 35 |
| 3 | Actors | 45 |
| 4 | Problem | 45 |
| 5 | Proposed route | 50 |
| 6 | Validation | 50 |
| 7 | Progress | 35 |

合計280秒＋予備20秒。音読の実測ではありません。ライブデモ時間は含みません。

## Slide 1 — Introduction

> Hi everyone. This project implements x402 payments on Solana. The repository covers four payment schemes, but this talk focuses on one recovery problem: what happens when a client closes a channel and the payment facilitator is unavailable? That recovery change is still at the design stage.

根拠：[現在のプログラム](../../../programs/anchoring-payment-channels/src/lib.rs)、[私たちの設計・検証計画](ARCHITECTURE.md#design-focus-issue-90-planned)。予定を実装済みの結果として説明しません。

## Slide 2 — Context

> In batch settlement, a client signs payment vouchers while an API handles requests. The merchant collects the vouchers and redeems them later. Solana specifications and SDK code already exist, and the Foundation reports its channel program live on mainnet. My focus is an improvement described in upstream issue ninety, rather than a claim that Solana payments do not exist.

出典：[SVM batch-settlement仕様](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/batch-settlement/scheme_batch_settlement_svm.md)、[SDK](https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/typescript/packages/mechanisms/svm/src/batch-settlement/README.md)、[Foundation README](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/README.md)。稼働は提供元の報告であり、独立検証ではありません。

## Slide 3 — Actors

> There are three actors. In our current exact and upto demo, the model calls a paid API tool, while application code checks the budget and signs with the client wallet. Batch integration is planned. In the proposed batch flow, the client funds the channel and signs payment vouchers. The gateway provides the API and keeps the latest voucher. The facilitator sponsors transactions and holds the channel payee authority. In this arrangement, that authority belongs to the facilitator, not the merchant receiving the API payment. Our recovery worker will give the merchant a separate submission route, with its own RPC connection and transaction fees.

出典：[#90](https://github.com/solana-foundation/payment-channels/issues/90)、[settleの現行制約](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle.rs)、[settle_and_seal](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle_and_seal.rs)、[送金・終了処理](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/README.md#instructions)。直接送信workerと障害デモは[私たちの設計](ARCHITECTURE.md#design-focus-issue-90-planned)です。

## Slide 4 — Problem

> Imagine that the merchant has already served several requests and holds a valid voucher. Before it is settled, the client requests closure. The channel enters Closing and a grace period begins. Normal settlement currently rejects that state. The alternative is cooperative settlement and sealing, which requires the facilitator signature. If the facilitator is offline, the merchant cannot use either route independently. This is the failure scenario we want to reproduce.

出典：[#90](https://github.com/solana-foundation/payment-channels/issues/90)、[settleの現行制約](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle.rs)、[settle_and_seal](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle_and_seal.rs)、[送金・終了処理](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/README.md#instructions)。直接送信workerと障害デモは[私たちの設計](ARCHITECTURE.md#design-focus-issue-90-planned)です。

## Slide 5 — Proposed route

> The proposal allows normal settlement during Closing, strictly before the deadline. The merchant submits the saved voucher directly. The program still validates its signature, channel, expiry, and amount. It records the settlement and leaves the channel Closing. This does not transfer tokens or extend the deadline. After the deadline, sealing and distribution complete the payment and refund. If the channel was already sealed, the recovery fails; this is not a guarantee against every race.

出典：[#90](https://github.com/solana-foundation/payment-channels/issues/90)、[settleの現行制約](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle.rs)、[settle_and_seal](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle_and_seal.rs)、[送金・終了処理](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/README.md#instructions)。直接送信workerと障害デモは[私たちの設計](ARCHITECTURE.md#design-focus-issue-90-planned)です。

## Slide 6 — Validation

> I will compare baseline and modified behavior using the same outage scenario. The tests will check the instant before the deadline, the deadline itself, and the time afterward. Invalid signatures, excessive amounts, and duplicate vouchers must still fail. Settlement should only update state; distribution should pay once and return the unused balance. I also want to test restarts and unknown transaction outcomes, so a timeout does not accidentally cause an unsafe retry.

根拠：[現在のプログラム](../../../programs/anchoring-payment-channels/src/lib.rs)、[私たちの設計・検証計画](ARCHITECTURE.md#design-focus-issue-90-planned)。予定を実装済みの結果として説明しません。

## Slide 7 — Progress

> Today the repository contains a single-request Anchor escrow prototype for upto. Next I will reproduce the batch channel lifecycle, implement the changed state gate, and compare the results. All four payment schemes remain in the repository scope. This presentation focuses on reducing facilitator dependence during the Closing grace period. Thank you.

根拠：[現在のプログラム](../../../programs/anchoring-payment-channels/src/lib.rs)、[私たちの設計・検証計画](ARCHITECTURE.md#design-focus-issue-90-planned)。予定を実装済みの結果として説明しません。

## Optional demo architecture appendix — outside the timed talk

The agent calls the gateway's paid API. The gateway returns the x402 quote, receives the signed retry, and calls its configured facilitator URL. For `exact`, the facilitator verifies and settles the payment. For `upto`, it confirms the deposit before the API runs and the final charge afterward. The facilitator submits to Solana; the gateway returns the paid report and settlement header. See the [current demo architecture](../../demo-payment-architecture.md). This appendix describes the running `exact` / `upto` routes, not the planned Issue #90 recovery route.

## Optional FAQ appendix — outside the timed talk

The app, not the model, holds the local Solana signing key. The model calls a paid API tool; application code checks the budget and signs. The official FAQ lists Base and Solana, while this demo uses Solana Devnet USDC. A separate local facilitator verifies and submits payments. Fiat conversion and card deposits are outside x402's native scope and outside this demo. Sources: [x402 FAQ](https://docs.x402.org/faq), [facilitator](https://docs.x402.org/core-concepts/facilitator), [demo tools](../../../examples/client/src/payment-tools.ts).

## 根拠と確認範囲

- payment-channels参照コミット：`3ffa4d6728ad88e4a9667a76ad9ccd68a302c696`。x402：`cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71`。Issueは可変なので、実装・発表前に関連PRとともに再確認します。
- [公式README](https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/README.md)のmainnet稼働報告は、完成・安定性や全facilitatorの対応の証明ではありません。同READMEのv2拡張は未実装の提案と記載されています。payment channel v2とx402 v2は別です。
- #90は通常のsettleを許す状態の変更です。新しいvoucher形式や暗号方式を作る課題ではありません。追加実装が比較的小さいという難易度評価は私たちの判断で、チャネル基盤全体の実装が容易という意味ではありません。
- #90は既にSealedになった状態や早期の協調終了を救済しません。オンチェーンでの署名・時刻検証を維持し、settleとdistributeを混同しません。
- #83には[修正PR #84](https://github.com/solana-foundation/payment-channels/pull/84)が存在し、確認時点ではOpen・未マージでした（head `25df9636698c320a0716ba224cbc8724acf63edf`）。ユーザー方針により発表候補から除外しています。

## 発表前の確認

音読し、5分以内に調整します。実装後にテスト結果・実行ログ・参照コミットを更新し、予定と観測結果を分けます。実験用Anchorプログラムは独立したデプロイであり、公式canonicalプログラムを変更したとは説明しません。

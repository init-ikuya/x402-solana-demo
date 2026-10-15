# デモの支払いアーキテクチャ

この文書は現在の `exact` と、このリポジトリの Anchor プログラムを使う `upto` ルートを説明するデモ用資料です。計画段階の `batch-settlement` と `auth-capture` の構成は [全体アーキテクチャ](ARCHITECTURE.md)を参照してください。

## 誰が誰と通信するか

```mermaid
flowchart LR
    A["AI agent / payment client<br/>API を選び、条件と予算を確認して署名"]
    G["Gateway / paid API<br/>402 と有料データを返す"]
    F["Facilitator<br/>支払いを検証し、取引を送信"]
    S["Solana Devnet<br/>トークンとプログラムの状態"]
    A <-->|"GET、402、PAYMENT-SIGNATURE、API 応答"| G
    G <-->|"/supported、/verify、/settle"| F
    F <-->|"RPC: 状態確認、シミュレーション、送信"| S
```

支払い先の API URL は client が持ち、facilitator URL は gateway が `GATEWAY_FACILITATOR_URL` として持ちます。client は facilitator に直接 HTTP リクエストを送りません。gateway は x402 の `paymentMiddleware` と `x402ResourceServer` を使い、facilitator へ検証と精算を委ねます。facilitator は受取人でも購入者でもありません。取引の送信やネットワーク手数料の負担を担当しても、client と merchant の署名権限を代行するわけではありません。

現行の起動設定では facilitator URL の既定値はローカルの `http://127.0.0.1:4022` です。デモでは `exact` と `upto` のどちらもこのリポジトリのローカル facilitator を使います。

## `exact`: 支払いを確認してから応答する

```mermaid
sequenceDiagram
    participant C as AI agent / client
    participant G as Gateway / paid API
    participant F as Facilitator
    participant S as Solana Devnet
    C->>G: GET /api/trump-insider
    G-->>C: 402 PAYMENT-REQUIRED (exact、価格、受取先)
    Note over C: ネットワーク・資産・受取先・金額・予算を確認
    C->>C: 支払いペイロードに署名
    C->>G: GET + PAYMENT-SIGNATURE
    G->>F: POST /verify
    F-->>G: 有効な支払い承認
    G->>G: 有料 API の結果を生成
    G->>F: POST /settle
    F->>S: 署名済み取引を送信し、確認
    S-->>F: 確認結果
    F-->>G: 精算結果
    G-->>C: 200 + 有料 JSON + PAYMENT-RESPONSE
    Note over C: 精算結果を確認し、API の内容から回答
```

`exact` では、このリポジトリの Anchor プログラムは呼びません。gateway の有料リソースは創作のパロディ JSON を返します。

## `upto`: 上限を先に預け、実額で精算する

```mermaid
sequenceDiagram
    participant C as AI agent / client
    participant G as Gateway / paid API
    participant F as Local facilitator
    participant S as このリポジトリの Anchor program
    C->>G: GET /api/trump-insider/upto
    G-->>C: 402 PAYMENT-REQUIRED (upto、上限 1000)
    Note over C: 条件と予算を確認し、上限分の open に署名
    C->>G: GET + PAYMENT-SIGNATURE
    G->>F: POST /settle (預け入れ)
    F->>S: open を送信し、確認
    S-->>F: 預け入れ確認
    F-->>G: 預け入れ結果
    G->>G: API を実行し、実額 300 を指定
    G->>F: POST /settle (実額の精算)
    F->>S: settle を送信し、確認
    S-->>F: 精算と未使用分返却を確認
    F-->>G: 精算結果
    G-->>C: 200 + 有料 JSON + PAYMENT-RESPONSE (実額 300)
```

`upto` の 1000 と 300 は USDC の最小単位です。300 はデモ用の固定値で、実測した利用量ではありません。402 応答では `scheme: "upto"` を広告し、client、gateway、facilitator がこのリポジトリの Anchor プログラムの `open` と `settle` を使います。公式 SVM `upto` 仕様は別の固定プログラム ID と命令形式を定めているため、この Solana ペイロードは公式バインディングと相互運用できません。

### `upto` のアカウント関係（実装済み）

```mermaid
erDiagram
    PAYER ||--o{ PAYMENT_CHANNEL : "payer"
    MERCHANT ||--o{ PAYMENT_CHANNEL : "merchant"
    RENT_PAYER ||--o{ PAYMENT_CHANNEL : "rent_payer"
    MINT ||--o{ PAYMENT_CHANNEL : "mint"
    PAYMENT_CHANNEL ||--|| VAULT_TOKEN_ACCOUNT : "PDA is token authority"
    PAYER ||--o{ PAYER_TOKEN_ACCOUNT : "token authority"
    MERCHANT ||--o{ MERCHANT_TOKEN_ACCOUNT : "token authority"
    MINT ||--o{ VAULT_TOKEN_ACCOUNT : "denominates"
    MINT ||--o{ PAYER_TOKEN_ACCOUNT : "denominates"
    MINT ||--o{ MERCHANT_TOKEN_ACCOUNT : "denominates"

    PAYMENT_CHANNEL {
        pubkey payer
        pubkey merchant
        pubkey mint
        pubkey rent_payer
        u64 max_amount
        i64 expires_at
        u64 nonce
        u8 bump
    }
    VAULT_TOKEN_ACCOUNT {
        pubkey mint
        pubkey authority "PaymentChannel PDA"
        u64 amount
    }
```

`PaymentChannel` はこのリポジトリの Anchor プログラムが所有する PDA で、シードは `"channel"`、payer、merchant、mint、nonce（リトルエンディアンの `u64`）です。vault は Token Program が所有する、この PDA を authority とする関連トークン口座です。`open` で payer のトークン口座から上限額を預けます。`settle` では merchant の署名を要し、vault から merchant のトークン口座へ実額、payer のトークン口座へ残額を送ります。期限後の `refund` は payer の署名で vault の全額を payer のトークン口座へ戻します。どちらの終了経路でも vault と `PaymentChannel` を閉じ、口座 rent を `rent_payer` に返します。

payer と merchant のトークン口座アドレスは `PaymentChannel` に保存しません。各命令が渡された口座の mint と token authority を検証します。図の `PAYER_TOKEN_ACCOUNT` と `MERCHANT_TOKEN_ACCOUNT` はその口座種別であり、チャネルごとに新設する状態口座ではありません。

預け入れ後に `settle` が実行されず期限が過ぎた場合、payer は [返金 CLI](../examples/client/README.md#recover-an-expired-upto-deposit) から RPC に直接 `refund` を送れます。gateway と facilitator は不要ですが、payer の署名と取引手数料用の SOL が必要です。

いずれのルートも、支払い結果が不明な場合は client が次の支払いを止めます。署名したリクエストを無条件に繰り返す構成ではありません。現在の HTTP 結合テストは模擬 RPC、Anchor の状態遷移テストは LiteSVM を使っており、Devnet 上の実送金成功までは証明していません。

実装と実行方法: [client](../examples/client/README.md)、[gateway と local facilitator](../examples/gateway/README.md)。フローの根拠: [x402 v2 支払いフロー](https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md#61-asset-transfer-methods-and-payment-flow-models)。

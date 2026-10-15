# x402 AI Gateway with Custom Settlement Program — 独自決済プログラムの実装(+可能であれば公式実装との比較)

**領域**: Payment × AI

## 提出用タイトル・概要(英語)

**Title**: Pay-per-Call AI Gateway on Solana — An Independent x402-Style Settlement Program

**Abstract**:

> Most AI APIs still assume subscriptions or credit cards, leaving AI agents without a way to pay autonomously for what they consume — the gap the x402 protocol, an HTTP 402-based payment standard, was created to fill (as of September 2026, Solana leads all x402 chains in settlement volume). This project builds a pay-per-call AI gateway on Solana following x402. x402's standard `exact` scheme transfers the exact requested amount in one client-signed transfer — deliberately simple, but unable to express usage-based pricing where the final cost is unknown until the request has been served. x402's `upto` scheme addresses this by separating the authorized maximum from the settled amount; on EVM it rests on Permit2, but Solana has no Permit2 equivalent — as the official SVM `upto` spec itself puts it, a signed Solana transfer commits to an exact amount, so the server cannot lower it after signing — and upto-style settlement therefore requires a purpose-built on-chain program: the Solana Foundation's audited `payment-channels` program (escrowed deposits, signed cumulative vouchers, Ed25519 verification). This project implements an independent settlement program in Anchor and targets a devnet deployment. Where time permits, it further aims to explore design space the official v1 does not yet natively cover — handling of Token-2022 mints carrying extensions outside v1's fixed allow-list (real stablecoins such as PYUSD and USDG are currently rejected for this reason) and separated funding/close/refund authorities, both under discussion on the official v2 roadmap — and to compare the resulting design against the official implementation and its published Cantina security audit.

**Referenced upstream issues** (official v2 roadmap items this project explores ahead):
[payment-channels #83 (Token-2022 mint extensions)](https://github.com/solana-foundation/payment-channels/issues/83) · [#91 (separate funding/close/refund authorities)](https://github.com/solana-foundation/payment-channels/issues/91) · [#89 (settle_metered under a client-signed cap)](https://github.com/solana-foundation/payment-channels/issues/89)

## 提出用タイトル・概要(日本語)

**タイトル**: Solana 上の Pay-per-Call AI ゲートウェイ — 独自決済プログラムの実装

**概要**:

> 多くの AI API は依然としてサブスクリプションかクレジットカード前提であり、AIエージェントが消費した分を自律的に支払う手段を欠いている — このギャップを埋めるために生まれたのが HTTP 402 ベースの決済プロトコル x402 である(2026年9月時点で Solana が x402 全対応チェーン中最大の決済ボリューム)。本プロジェクトでは、x402 に倣った AI 従量課金ゲートウェイを Solana 上に構築する。x402 標準の `exact` スキームは「要求額ちょうどを1回の署名送金で決済する」単純な方式で、「使い終わるまで最終コストが分からない」従量課金を表現できない。そのための `upto` スキームは EVM では Permit2 に依存するが、**Solana には Permit2 相当が存在しない — 公式の SVM `upto` 仕様自身が「署名済み Solana 送金は金額に対して確定的で、署名後にサーバーが減額できない」ことを理由として挙げており、upto 型決済には専用オンチェーンプログラムが必要**になる。その公式回答が Solana Foundation の監査済み `payment-channels` プログラム(エスクロー入金+累計額署名バウチャー+Ed25519 検証)である。本プロジェクトでは同型の決済プログラムを Anchor で独自に実装して devnet にデプロイする。さらに可能であれば、公式 v1 がネイティブには未対応で v2 ロードマップで議論中の設計領域 — v1 の固定許可リスト外の拡張を持つ Token-2022 ミントの扱い(実在のステーブルコイン PYUSD/USDG がこの理由で弾かれている)、funding/close/refund の権限分離 — の探索や、公式実装および公開されている Cantina 監査レポートと突き合わせた比較分析にも取り組みたい。

**参照 upstream issue**(本プロジェクトが先行探索する公式 v2 ロードマップ項目):
[payment-channels #83(Token-2022 mint extension 対応)](https://github.com/solana-foundation/payment-channels/issues/83) · [#91(funding/close/refund の権限分離)](https://github.com/solana-foundation/payment-channels/issues/91) · [#89(クライアント署名上限下の settle_metered)](https://github.com/solana-foundation/payment-channels/issues/89)

## 位置付け(先例マップ — 提出・発表で自分から明示する)

| レイヤー | 存在するもの | 本プロジェクトとの関係 |
|---|---|---|
| プロトコル仕様 | x402 `exact` / `upto` スキーム。本家は [x402-foundation/x402](https://github.com/x402-foundation/x402)(旧 Coinbase 管理から財団化)で、[`scheme_upto_svm.md`](https://github.com/x402-foundation/x402/blob/main/specs/schemes/upto/scheme_upto_svm.md) が payment-channels を決済レイヤーとして正式に仕様化済み | 402 フローとメッセージ形式に倣う(「準拠」ではなく「互換」と表現)。仕様上サーバーの self-facilitate は明示的に許容されている |
| ホスト型サービス | Coinbase の facilitator が 2026-09-17 に Solana で `upto` 提供開始。x402.org のデフォルト facilitator は **Solana devnet 対応済み** | 本プロジェクトは facilitator-less(ゲートウェイが verify/settle を内蔵) |
| 公式オンチェーン実装 | Solana Foundation の [payment-channels](https://github.com/solana-foundation/payment-channels)(MIT、mainnet 稼働、2026年7月 Cantina 監査済み)。x402 `upto`(1リクエスト=1チャネルの単発従量課金)と MPP `session` / `batch-settlement`(1チャネルで複数リクエスト)の両方の決済レイヤー | 同型アーキテクチャを独自に実装し、v2 ロードマップ領域を先行探索する(可能であれば比較研究も)。本実装の「1デポジット→複数リクエスト→まとめて claim」は後者(session/batch-settlement)型の使い方に相当 |

**「なぜ既にあるものを作るのか」への答え**: 独立実装そのものが学習成果であることに加え、可能であれば公式 v1 に無い領域(公式チーム自身が issue として列挙している)の探索まで進みたいため。探索候補:

- [#83](https://github.com/solana-foundation/payment-channels/issues/83)/#84: 公式 v1 は Token-2022 ミント自体は受け付けるが、**mint extension は固定許可リスト(MetadataPointer / TokenMetadata のみ)** で、それ以外の拡張を持つミント(実在の PYUSD / USDG は TransferFee・PermanentDelegate・TransferHook 等を含む)は `open` が誤解を招くエラー(0x38「malformed」)で失敗する。チーム方針は「安易な許可リスト拡大はしない・エラーを正しく表面化する」→ 本実装は `token_interface` を使い、**どの拡張をどんな根拠で許可/拒否するかの設計自体を探索**し、拒否時は明示的なエラーで表面化する
- [#91](https://github.com/solana-foundation/payment-channels/issues/91): funding / close / refund の**権限分離** — v1 では payer が3つの権限を束ねており、**ネイティブな分離は未対応**(コントローラープログラムを payer に立てる回避策は可能だが、追加のカストディプログラムが要ると issue 自身が指摘) → 本実装で設計を試す
- [#89](https://github.com/solana-foundation/payment-channels/issues/89): settle_metered(クライアント署名上限下の従量精算) — 本実装のバウチャー設計の参照点

## アーキテクチャ

```
[クライアント / AIエージェント]
   │ 0. open_channel: vault PDA に USDC(Token/Token-2022)をデポジット(上限・期限つき)
   │ 1. GET /ask (支払いなし)
   ▼
[ゲートウェイ (x402互換 402フロー)]
   │ 2. 402 Payment Required + PaymentRequirements(単価・チャネル情報)
   ▼
[クライアント] 累計額バウチャー(ed25519署名)を X-PAYMENT ヘッダに載せて再リクエスト
   ▼
[ゲートウェイ] バウチャーをオフチェーン検証 → AI API を呼んで回答返却
   │ 3. claim: 最新バウチャー1枚で、オンチェーン ed25519 検証つきのまとめ引き出し
   ▼
[Vault PDA] ──► 期限切れ後は refund で未使用分がクライアントへ(タイムロック)
```

- **累計額バウチャー方式**: サーバーは常に最新(=最大額)の1枚だけ保持すればよく、古いバウチャーでの二重請求は構造的に不可能。オンチェーンは open / claim / refund の3トランザクションで済む
- **信頼モデル**: `exact` の facilitator が担うオフチェーンのトランザクション検査を、オンチェーンのプログラム強制(署名・上限・受取人・期限)に置き換える

## 実装スコープ

### オンチェーン(Anchor、devnet にデプロイ) — 作業の重心

**フレームワーク選択の明示**: 公式実装は Pinocchio 0.11(フレームワークなしの軽量ネイティブ Rust)で書かれている。本プロジェクトは意図的に **Anchor** を採用する — 目的が CU 最適化ではなく学習と設計理解であること、`anchor-spl` の `token_interface` が(探索まで進んだ場合の)Token-2022 対応を安全に扱えることが理由。この「Pinocchio(実運用の決済プリミティブ、CU 効率優先) vs Anchor(開発速度と検証容易性優先)」というトレードオフ自体を、比較研究に進めた場合は CU 計測付きでその一軸にする。

- `open_channel` / `claim` / `refund` / `close_channel`(前提: claim は Ed25519SigVerify プリコンパイル + instructions sysvar introspection による署名検証、精算額 ≤ デポジットの強制、受取人バインド、リプレイ防止)
- **(可能であれば)公式 v1 が未カバーの領域の探索候補**:
  1. `token_interface` による拡張付き Token-2022 ミントの扱い(+ 非対応 extension の明示的エラー表面化)
  2. funding / refund の権限分離(デポジットの追加入金者と返金受取人を別鍵にできる)
- テスト: bankrun/LiteSVM で正常系+攻撃系(改ざんバウチャー、期限前 refund、他人の claim、過大請求、Token-2022 の transfer fee 付きミント等のエッジケース)

### 比較研究(可能であれば — 発展要素)

- 公式 payment-channels の v1 設計(50バイトの累計額バウチャー、`open_slot` アドレッシング + 1,500 slot ウィンドウによるバウチャーリプレイ防止、SHA-256 の分配コミットメント、rent_payer 分離)と自実装の設計判断を対比するドキュメント。v2 ADR(バッチ精算・channel re-arm・rollup — いずれも提案段階で未実装)との関係も整理する
- **公開されている Cantina 監査レポートを読み、監査指摘が自実装に該当するかを1件ずつ検証**する(セキュリティ自己監査)

### オフチェーン(ゲートウェイ・AI エージェントともに TypeScript)

配置は同じリポジトリの `examples/` 配下とする。`examples/gateway/` はサービス側の参考実装兼デモ用サーバー、`examples/client/` は決済 CLI と LLM エージェントを含む。中核の決済プログラムはこれらのサンプルや AI 提供元に依存しない。gateway と client は npm workspace に追加済みで、ルートから起動できる。LLM のツール呼び出しにはローカル Ollama 接続を実装済み。実際のモデルを使ったデモ実行は未検証。

- ゲートウェイ: **TypeScript の HTTP サーバー**として実装。402 レスポンス生成、バウチャーのオフチェーン検証、AI API(Claude 等)呼び出し、オンチェーン精算を担当する。採用する x402 の仕様バージョンとメッセージ形式は実装前に確認する
- AI エージェント: **TypeScript で実装**。LLM が有料 API をツールとして選択し、その結果を使って回答するツール呼び出しループと、差し替え可能なモデル接続インターフェースを含む。現行アダプターは Ollama の `/api/chat`
- エージェントの支払いツール: 402 を受けたら設定済みの支出上限内でバウチャーを生成・署名して再リクエストする。秘密鍵はアプリケーション側で管理し、モデルのプロンプトやツール結果には渡さない
- プログラム接続: 当初は Anchor 標準の TypeScript クライアントと Anchor IDL を使用する。Codama は生成クライアントが必要になった段階で導入を検討する
- 初期デモではゲートウェイとエージェントをローカルで起動し、devnet の決済プログラムに接続する。公開ホスティングと MCP 対応は発展要素とする

### マイルストーン(フォールバック付き)

1. **Phase 1**: 公式 SDK の `exact` (SVM) で 402 → 支払い → AI 回答の最小疎通(x402 理解の担保・フォールバック)。x402.org のデフォルト facilitator が Solana devnet をサポート済みのため devnet で完結できる
2. **Phase 2**: 自作決済プログラムの実装・devnet デプロイ(ここまでが確約する成果物)
3. **Phase 3(可能であれば)**: v1 未カバー領域の探索(Token-2022 拡張の扱い・権限分離)、公式実装・Cantina 監査との比較ドキュメント
4. **Phase 4(余力)**: MCP サーバー化、動的プライシング

## デモの筋書き

1. 支払いなしでリクエスト → **402 が返る**
2. エージェントがデポジット → 自動でバウチャーを添えて AI に質問 → 回答(数回繰り返して累計額が増える様子)
3. claim → **使った分だけ**引き出されるのを explorer で見せる(3 tx で N リクエスト分を決済)
4. 期限切れ後の refund、改ざんバウチャーの拒否
5. (Phase 3 の探索まで進んだ場合)**公式 v1 の許可リスト外の拡張(TransferFee 等)を持つ Token-2022 ミントでチャネルを開いて同じフローが動く**ことを見せる(公式 v1 では PYUSD 型のミントは `open` が失敗する)

## リスク・割り切り

- ed25519 の instruction introspection は実装が細かい — Phase 2 冒頭に単体で疎通(公式実装のコードが公開されているため、詰まったら参照できるのは本構成の利点)
- 「サーバーがレスポンスを返した証明」は厳密には作れない — バウチャーが少額刻みなので被害は最大1リクエスト分という信頼モデルを明示(公式実装・Lightning 系と同じ割り切り)
- 独自実装である以上「x402 準拠」「upto 準拠」とは言わず「互換(フローと形式に倣う)」と表現する
- upstream への PR や issue コメント等の貢献は成果物に**含めない**(payment-channels のマージ済み PR は少人数のコアメンバーに限られ、CONTRIBUTING も未整備で、外部貢献の受け入れ実績が確認できないため)。本プロジェクトは独立した実装・比較研究として完結させる

## 活用する既存課題・資産

- `solana-fall-transfer-hook` / `solana-summer-escrow`: **Token-2022・`token_interface` の実戦経験**(Phase 3 の探索に進む場合の土台)
- `solana-fall-vault`: vault PDA・signer seeds
- `solana-summer-escrow`: タイムロック返金
- `solana-fall-fundraiser-codama`: 将来 Codama を導入する場合のクライアント生成の参考
- `flores-ai-agent` 等: クライアント側 AI エージェント実装
- `haiku_verse`: AI API 統合とコスト管理の設計経験

## 参考リンク

- [What is x402(Solana 公式)](https://solana.com/x402/what-is-x402)
- [x402-foundation/x402(本家リポジトリ)](https://github.com/x402-foundation/x402) / [upto スキーム仕様](https://github.com/x402-foundation/x402/blob/main/specs/schemes/upto/scheme_upto.md) / [**upto SVM 仕様(payment-channels を決済レイヤーに指定)**](https://github.com/x402-foundation/x402/blob/main/specs/schemes/upto/scheme_upto_svm.md) / [exact SVM 仕様](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_svm.md)
- [x402 ネットワークサポート(Solana devnet 対応 facilitator の一覧)](https://docs.x402.org/core-concepts/network-and-token-support)
- [What is EIP-2612 on Solana?(Solana 公式 — permit 型のオフチェーン署名承認を持たない設計の解説)](https://solana.com/developers/evm-to-svm/eip2612)
- [solana-foundation/payment-channels(公式実装・MIT・Cantina 監査済み)](https://github.com/solana-foundation/payment-channels)
- [Payment Channels 発表(Solana 公式ニュース)](https://solana.com/news/payment-channels-1-million-payments-per-second)
- [Coinbase facilitator の upto 対応(2026-09-17、Solana Compass)](https://solanacompass.com/news/coinbase-upgrades-x402-facilitator-on-solana-upto-scheme-live-verify-latency-cut-66)
- [Solana が x402 ボリューム首位(Solana Compass)](https://solanacompass.com/news/solana-claims-top-spot-on-x402-as-ai-agents-settle-33m-usdc-in-a-single-week)

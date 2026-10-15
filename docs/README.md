# ドキュメント

## 共通資料とテーマ別資料

- [全体アーキテクチャ](ARCHITECTURE.md)：4方式の実装方針、共通構成、アカウント設計。
- [デモの3者間アーキテクチャ](demo-payment-architecture.md)：client、gateway、facilitator の役割と `exact` / `upto` の通信順序。提出用資料ではありません。
- [exact と upto のデモ決済フロー](../examples/gateway/README.md#exact-payment-flow)：実装済みのクライアント、ゲートウェイ、facilitator の流れ。提出用資料ではありません。
- [アーキテクチャ提出用の図](architecture-submission.md)・[3文の説明文](architecture-submission-blurb.md)：提出用の編集元。PDFは生成物としてGit管理対象外です。
- [プロジェクトノート](ideas.md)：目的、スコープ、課題候補。
- [AI Gatewayの構想](proposals/ai-gateway.md)：初期提案。現在の実装スコープは全体アーキテクチャとプロジェクトノートを参照してください。
- Issue #90：[設計](topics/closing-settlement/ARCHITECTURE.md)・[スライド](topics/closing-settlement/slides.md)・[原稿](topics/closing-settlement/script.md)。
- auth-capture：[設計](topics/auth-capture/ARCHITECTURE.md)・[スライド](topics/auth-capture/slides.md)・[原稿](topics/auth-capture/script.md)。
- `references/`：学校の参考PDFなど。PDFはGit管理対象外なので、ローカルに保管します。

## 発表資料

Solana School: Fall Class の Demo Day 向け資料を管理します。発表は **英語・5分** です。Demo Day は **2026年10月19日または21日（日程未確定、発表者からの情報）** です。

- [Issue #90のスライド](topics/closing-settlement/slides.md): 英語の本編7枚＋任意のデモ構成・FAQ補足2枚。`---` をスライドの区切りとして使います。
- [Issue #90の読み上げ原稿](topics/closing-settlement/script.md): スライドごとの英語読み上げ原稿、時間配分、日本語の発表者メモ。4分40秒の説明と20秒の余裕を目標にします。
- [auth-captureのスライド](topics/auth-capture/slides.md): Solana auth-captureを主題にした別案（英語の本編7枚＋任意のデモ構成・FAQ補足2枚）。[専用アーキテクチャ](topics/auth-capture/ARCHITECTURE.md)と[読み上げ原稿](topics/auth-capture/script.md)を用意しています。#90案とは独立して発表できます。
- 図やスクリーンショットを追加する場合は、各テーマのディレクトリの `assets/` に配置し、原稿から相対パスで参照します。

スライドは [Marp](https://marp.app/) 形式の Markdown です。図とレイアウトにはHTML/CSSを使用するため、生成時は `--html` を付けます。16:9・ページ番号付きで生成できます。読み上げ原稿は別ファイルで管理します。

## 現在の資料と時間配分

- 主資料はIssue #90に絞った英語の本編7枚と、質問時だけ使うデモ構成・FAQ補足2枚です。背景、登場人物、問題、直接精算経路、検証計画、進捗を説明します。リポジトリの4方式実装要件は維持します。
- 本編の説明4分40秒＋予備20秒が目標です。FAQ補足は時間配分に含みません。更新後の原稿の音読とライブデモの時間は未計測です。
- Issue #83の別案は、既存の修正PR #84を確認したためユーザー方針により取り下げました。
- HTML/PDFはGit管理対象外です。Markdown更新後に以下のコマンドで再生成してください。
- Issue #90版とauth-capture版の9ページPDFは生成・レイアウト確認済みです。更新後の音読時間は未計測です。

## アーキテクチャ図PDF生成

提出用PDFは、リポジトリのルートで次のコマンドから再生成します。初回はMarp CLIのダウンロードにネットワーク接続が必要です。
CIも同じMarkdownからPDFを生成し、nightly releaseとActions Artifactに含めます。PDF自体はGit管理対象外です。

```sh
npx --yes @marp-team/marp-cli@4.5.0 --html --pdf docs/architecture-submission.md -o docs/architecture-submission.pdf
```

## スライド生成

Node.js と npm がある環境で、リポジトリのルートから実行します。初回は Marp CLI のダウンロードにネットワーク接続が必要です。
CIではIssue #90案とauth-capture案の両方をPDFに変換し、nightly releaseへ `closing-settlement-slides.pdf` と `auth-capture-slides.pdf` の名前で添付します。

```sh
# ブラウザーで発表できる HTML
npx --yes @marp-team/marp-cli@4.5.0 --html docs/topics/closing-settlement/slides.md -o docs/topics/closing-settlement/slides.html

# 配布用 PDF（Chrome / Edge / Firefox など対応ブラウザーが必要）
npx --yes @marp-team/marp-cli@4.5.0 --html docs/topics/closing-settlement/slides.md --pdf -o docs/topics/closing-settlement/slides.pdf
```

生成物は Git 管理対象から除外し、Markdown を編集元とします。

auth-capture案は、同じコマンドのディレクトリ名を `closing-settlement` から `auth-capture` に置き換えて生成します。両案とも説明4分40秒＋予備20秒が目標です。

## 根拠・引用元の記載方針

- x402の仕様やSolanaの実装状況を述べる箇所には、主張ごとに一次資料へのリンクを添える。スライドでは短い出典番号・リンク、読み上げ原稿では対応する仕様節や確認範囲を記す。
- 実装状況は、仕様・公開コード・提供元によるデプロイ報告・自身で検証した結果を区別する。将来構想や本プロジェクトの設計はその旨を明示する。
- 根拠を確認できない主張は断定しない。実装比較ではタグまたはコミットを固定し、更新されるURLだけで比較対象を定義しない。
- 原稿の各スライドに対応する出典を記載し、末尾に固定コミット・未検証の範囲をまとめている。

## 発表前に更新すること

- 音読を計測し、スライド切替やデモを含めて5分以内に調整する。
- 実装済み機能、テスト結果、デモ手順を実際の成果に合わせる。
- デモの実行ログ、使用したコミット、devnet のトランザクションを記録する。
- upstream との比較を載せる場合は、参照コミットと一次資料を確認する。
- 発表者名と実測値を追加し、発表日を10月19日または21日のどちらかに確定する。未実装の構想は計画として明示する。

設計の詳細は [ARCHITECTURE.md](ARCHITECTURE.md)、スコープは [ideas.md](ideas.md) を参照してください。

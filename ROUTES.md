# アクセス可能なURL一覧

このドキュメントには、開発サーバー起動時にアクセス可能な主要URLが記載されています。

## 開発サーバーの起動

```bash
npm run dev
```

デフォルトでは `http://localhost:3000` で起動します。

## 統合システム入り口（ログインハブ）

| URL | 説明 |
|-----|------|
| `/` | **統合ログインハブ**（学校・クラブ・部員の3カード） |
| `/school/login` | 学校管理者ログイン（デモ: `admin` / 空欄可）→ `/school/clubs` |
| `/club/login` | クラブログイン（ID・PW。ハブからはインライン表示も可） |
| `/school` | 学校管理者ポータル（年度切替・サマリーカード） |
| `/school/clubs` | クラブ一覧（クラブ管理の子） |
| `/school/clubs/groups` | グループ作成 |
| `/school/clubs/register` | クラブ登録（追加・メンテナンス） |
| `/school/clubs/[clubId]/messages` | クラブ個別メッセージ |
| `/school/messages` | お知らせ一覧 |
| `/school/settings` | 設定（→ 共通カテゴリー設定へリダイレクト） |
| `/school/settings/category` | 共通カテゴリー設定 |
| `/school/settings/account-titles` | 共通科目設定 |
| `/school/settings/staff` | 担当者設定 |
| `/school/contract` | 契約状況 |
| `/school/guide` | 操作ガイド |
| `/club` | クラブ入り口 → `/club/dashboard` へリダイレクト |
| `/member` | 部員・保護者マイページ（デモ用プレースホルダ） |

## クラブ向け（`/club` 配下・正本）

| URL | ページ名 |
|-----|---------|
| `/club/dashboard` | クラブポータル |
| `/club/accounting/register/new` | 入出金登録（新規） |
| `/club/accounting/register/history` | 登録履歴 |
| `/club/accounting/ledger/cash-bank` | 現金・預金出納帳 |
| `/club/collection/history` | 集金実績 |
| `/club/members/list` | 部員一覧 |
| `/club/settings/account-titles` | 勘定科目マスター |
| `/club/budget/book` | 予算書 |
| `/club/guide` | 操作ガイド |

**旧URL**（`/dashboard` 等）は `next.config.js` のリダイレクトで `/club/*` に転送されます。

## 大学向け（試作）

| URL | 説明 |
|-----|------|
| `/university/dashboard` | 大学統合ダッシュボード |
| `/university/approvals` | 承認待ち一覧 |

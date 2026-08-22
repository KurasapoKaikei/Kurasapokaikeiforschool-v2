# アクセス可能な URL 一覧

開発サーバー起動時にアクセス可能な主要 URL です。正本は `src/app/` の App Router 構成に従います。

## 開発サーバーの起動

```bash
npm run dev
```

デフォルトでは `http://localhost:3000` で起動します。

ルート一覧の自動生成:

```bash
npm run routes
```

---

## 統合入り口・認証

| URL | 説明 |
|-----|------|
| `/` | 統合ログインハブ（学校・監査人・クラブ・部員） |
| `/register/school` | 学校向け新規申込 |
| `/register/verify?id=SCH-xxxxx` | メール認証・本登録 |
| `/school/login` | 学校管理者ログイン |
| `/club/login` | クラブログイン |
| `/audit/login` | 監査人ログイン |
| `/member` | 部員マイページ（プレースホルダ） |

---

## 学校管理者ポータル（`/school`）

| URL | 説明 |
|-----|------|
| `/school` | ポータルトップ |
| `/school/audit` | 監査（提出区分・期限通知・監査期間解除） |
| `/school/rollover` | 繰越（年度繰越処理） |
| `/school/clubs` | クラブダッシュボード（一覧） |
| `/school/clubs/register` | クラブ登録 |
| `/school/clubs/groups` | グループ作成 |
| `/school/clubs/[clubId]/messages` | クラブ個別メッセージ |
| `/school/clubs/auditors` | 監査人ダッシュボード |
| `/school/clubs/auditors/register` | 監査人登録 |
| `/school/messages` | メッセージ一覧 |
| `/school/messages/drafts` | 下書き |
| `/school/contract` | 契約状況 |
| `/school/settings` | 設定（リダイレクト） |
| `/school/settings/category` | 共通カテゴリー設定 |
| `/school/settings/account-titles` | 共通科目設定 |
| `/school/settings/staff` | 担当者設定 |
| `/school/settings/audit-flow` | 監査運用設定（監査フロー有効時） |
| `/school/guide` | 操作ガイド |

詳細: `docs/school-portal-specification.md`

---

## クラブポータル（`/club`）

| URL | 説明 |
|-----|------|
| `/club` | クラブ入り口 → `/club/dashboard` |
| `/club/dashboard` | クラブポータルトップ |
| `/club/settlement` | 決算提出 |
| `/club/messages` | メッセージBOX |
| `/club/accounting/register/new` | 入出金登録（新規） |
| `/club/accounting/register/history` | 登録履歴 |
| `/club/accounting/ledger/cash-bank` | 現金・預金出納帳 |
| `/club/accounting/ledger/subject` | 科目別台帳 |
| `/club/accounting/ledger/deferred` | 繰延（計上・精算）台帳 |
| `/club/accounting/ledger/missing-receipts` | 証憑未登録一覧 |
| `/club/accounting/summary/annual` | 年間収支集計表 |
| `/club/accounting/summary/monthly` | 月次収支集計表 |
| `/club/collection/history` | 集金実績 |
| `/club/collection/schedule` | 集金予定 |
| `/club/collection/settings` | 集金設定 |
| `/club/members/list` | 部員一覧 |
| `/club/members/register` | 部員登録（CSV 含む） |
| `/club/budget/book` | 予算書 |
| `/club/budget/comparison` | 予実比較 |
| `/club/settings/club` | クラブ設定 |
| `/club/settings/staff` | 担当者設定 |
| `/club/settings/category` | カテゴリー設定 |
| `/club/settings/account-titles` | 科目設定 |
| `/club/settings/fiscal-years` | 会計年度設定 |
| `/club/guide` | 操作ガイド |

**旧 URL**（`/dashboard` 等）は `next.config.js` のリダイレクトで `/club/*` に転送されます。

---

## 監査人ポータル（`/audit`）

| URL | 説明 |
|-----|------|
| `/audit` | 担当クラブダッシュボード |
| `/audit/clubs/[clubId]` | 監査詳細 |
| `/audit/messages` | メッセージBOX |
| `/audit/messages/drafts` | 下書き |
| `/audit/guide` | 操作ガイド |

---

## 試作・将来拡張

| URL | 説明 |
|-----|------|
| `/university/dashboard` | 大学統合ダッシュボード（試作） |
| `/university/approvals` | 承認待ち一覧（試作） |
| `/parent` | 保護者ページ（プレースホルダ） |

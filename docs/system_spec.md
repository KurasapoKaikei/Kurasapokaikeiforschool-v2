# クラサポ会計 機能詳細仕様書 v2.9（2026年度運用 正本）

- **対象システム**: クラサポ会計（Next.js / クライアントサイド LocalStorage 実装）
- **対象会計年度**: **2026年度（2026/04/01 〜 2027/03/31）固定運用**
- **本ドキュメントの位置づけ**: 開発者がこのファイル単体を読めば、現行実装の挙動（特に振替・集計・履歴・編集動線）を完全に把握できる正本仕様書。
- **過去の v2.8 / 2025年度仕様は本書では取り扱わない**（旧仕様は `docs/spec.md` を参照）。

---

## 目次

- [1. システム概要（2026年度運用）](#1-システム概要2026年度運用)
- [2. 画面構成とカラーシステム](#2-画面構成とカラーシステム)
- [3. 会計ロジック（振替・集計・バリデーション）](#3-会計ロジック振替集計バリデーション)
- [4. データベース / LocalStorage 構造](#4-データベース--localstorage-構造)
- [5. 登録履歴・出納帳の表示仕様](#5-登録履歴出納帳の表示仕様)
- [6. 編集・キャンセル動線](#6-編集キャンセル動線)
- [付録 A. ユーティリティ関数一覧](#付録-a-ユーティリティ関数一覧)
- [付録 B. 用語集](#付録-b-用語集)

---

## 1. システム概要（2026年度運用）

### 1.1 プロジェクト

| 項目 | 値 |
| --- | --- |
| 名称 | クラサポ会計 |
| コンセプト | 「できるクラブは会計もスマートに。」 |
| 想定利用者 | 部活・サークル・社会人クラブの会計担当者 |
| データ保持 | クライアントサイド（ブラウザ `localStorage`） |
| サーバー連携 | OCR API（Gemini）に画像をPOSTする `POST /api/ocr` のみ |
| 認証 | 単一マシン前提のため、本格認証は持たず「担当者設定の先頭名」を作業者として扱う |

### 1.2 技術スタック

| 領域 | 採用 |
| --- | --- |
| フレームワーク | Next.js 14.0.4（App Router） |
| ランタイム | React 18.2 |
| 言語 | TypeScript 5 |
| スタイリング | Tailwind CSS 3.3 / `tailwind-merge` / `class-variance-authority` |
| UIプリミティブ | Radix UI 各種 / lucide-react |
| 日付 | `date-fns` |
| AI | `@google/generative-ai`（OCR連携） |
| バリデーション | `zod` / `react-hook-form` |

### 1.3 稼働ポート / 起動

- **開発サーバー稼働ポート: `3000`（Next.js 既定）**
- 起動コマンド: `npm run dev`
- ポート競合時の解放（Windows / PowerShell）:

```powershell
Get-NetTCPConnection -LocalPort 3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### 1.4 2026年度完全固定

- **会計年度開始日**: `YYYY-04-01`。各画面の `getFiscalYearStart()` は「現在月 ≥ 4月なら今年、< 4月なら昨年」を年度年として `YYYY-04-01` を返す。
- 登録履歴・現金預金出納帳・収支集計表は **`date >= fiscalYearStart` の取引のみ** をスコープに集計する。
- `defaultUserInfo.fiscalPeriod = "2026.4.1～2027.3.31"`（`UserInfoContext.tsx`）。
- 旧 2025 年度データから 2026 年度へシフトする 1 回限りのマイグレーション `applyCollectionScheduleFiscalYear2026MigrationOnce()` が `getCollectionSchedules()` 呼び出し時に自動適用される（集金スケジュールの `targetMonth` / `dueDate` を 2025FY → 2026FY に置換）。

---

## 2. 画面構成とカラーシステム

### 2.1 サイドバー（`src/components/layout/Sidebar.tsx`）

メニュー定義（順序・色は実装の `menuItems` と一致）：

| 親メニュー | パス | アイコン色 | サブメニュー |
| --- | --- | --- | --- |
| マイページ | `/dashboard` | `#E66A84`（ピンク） | — |
| 入出金登録 | `/accounting/input` | `#A3BC68`（黄緑） | 新規登録 `/accounting/register/new` / 登録履歴 `/accounting/register/history` |
| **集計・帳簿** | `/accounting/ledger` | `#68A384`（青緑） | 収支集計表 `/accounting/summary` / 現金・預金出納帳 `/accounting/ledger/cash-bank` / 科目別台帳 `/accounting/ledger/subject` / 収支報告書 `/accounting/report` |
| 集金管理 | `/collection` | `#D99529`（オレンジ） | 集金実績 / 集金予定一覧 / 集金設定 |
| 予実管理 | `/budget` | `#1A237E`（ディープインディゴ） | 予算書 / 前年度比 |
| 部員管理 | `/members` | `#9D8CC3`（パープル） | 部員一覧 / 部員登録 |
| 設定 | `/settings` | `#77B8DA`（ブルー） | クラブ設定 / 担当者設定 / カテゴリー設定 / 科目設定 |
| 操作ガイド | `/guide` | `#4A90E2`（濃ブルー） | — |

> 重要: 「集金・帳簿」表記は **「集計・帳簿」** に統一済み。サイドバー、ページ見出し（`/accounting/ledger/page.tsx`）、操作ガイド本文すべてで一貫している。

### 2.2 ページ全体トーン

- 共通背景: `#F5F5F0`
- 共通テキスト: `#374151` / セカンダリ `#6B7280` / ミュート `#9CA3AF`
- 各ドメインのアクセントは上記カラー Hex を **左ボーダー 5px** とヘッダ帯背景に使用。

### 2.3 主要画面一覧

| 区分 | 画面 | パス |
| --- | --- | --- |
| 入出金 | 新規登録 | `/accounting/register/new` |
| 入出金 | 登録履歴 | `/accounting/register/history` |
| 入出金 | 個別編集 | `/accounting/register/edit/[id]` |
| 入出金 | CSV一括編集 | `/accounting/register/csv/[id]` |
| 集計・帳簿 | 収支集計表（年/月切替） | `/accounting/summary` |
| 集計・帳簿 | 月次明細 | `/accounting/summary/monthly` |
| 集計・帳簿 | 年次明細 | `/accounting/summary/annual` |
| 集計・帳簿 | 現金・預金出納帳 | `/accounting/ledger/cash-bank` |
| 集計・帳簿 | 科目別台帳 | `/accounting/ledger/subject` |
| 集計・帳簿 | 収支報告書 | `/accounting/report` |
| 集金 | 集金実績 / 予定 / 設定 | `/collection/{history,schedule,settings}` |
| 部員 | 部員一覧 / 部員登録 / 個別 | `/members/{list,register,[id]}` |
| 設定 | クラブ / 担当者 / カテゴリー / 科目 | `/settings/{club,staff,category,account-titles}` |
| その他 | 操作ガイド | `/guide` |

---

## 3. 会計ロジック（振替・集計・バリデーション）

### 3.1 取引タイプ

`Transaction.type` は 5 種類：

| `type` | 用途 | 金額の符号扱い |
| --- | --- | --- |
| `income` | 収入（手動・OCR・CSV） | 入金（口座 +） |
| `expense` | 支出（手動・OCR・CSV） | 出金（口座 −） |
| `transfer` | **振替（旧データ互換 / 通常は使わない）** | 出納帳上は出金扱い |
| `collection` | 集金（部員からの入金） | 入金（口座 +） |
| `deferred` | 計上（未収/未払/仮払/仮受）と精算 | 計上は支出側で残高 −、精算は別系統 |

> **重要**: 現行運用では振替は `type` を `transfer` 単独にせず、**`expense` と `income` の 2 レコード対**で 1 件の振替を表現する（後述 3.3）。`type==="transfer"` は旧データ互換のために残されている。

### 3.2 金額入力バリデーション

`src/utils/amountInput.ts` の各関数で統一管理：

- `isAllowedSignedIntegerTyping(value)`: 入力途中の整数のみ許可（カンマ・全角は除外）。
- `formatAmountInputDisplay(value)`: 3桁カンマで表示用整形。
- `parseSubmitAmount(value)`: submit 時に `Number` 化。整数以外/NaN を弾く。
- 振替フォームでは `Math.abs(parseSubmitAmount(...))` を必ず通し、**負の数を入れても自動的に絶対値化**される。

### 3.3 振替ロジック（最重要）

#### 3.3.1 物理データ構造

1 件の振替は **同一 `transferGroupId` を持つ 2 つの `Transaction`** として保存される。

| 役割 | `type` | `counterparty` | `accountTitle` | `category` | `memo` 接頭辞 |
| --- | --- | --- | --- | --- | --- |
| 出金元レコード | `expense` | 出金元口座名（From） | 入金先口座名（To） | `共通` | `振替（出金）→ <To>` |
| 入金先レコード | `income` | 入金先口座名（To） | 出金元口座名（From） | `共通` | `振替（入金）← <From>` |

ユーザーメモがある場合は `振替（出金）→ <To> / <userMemo>` のように ` / <userMemo>` が末尾に付与される。

`transferGroupId` は `crypto.randomUUID()`（未対応環境は `tg_<ts>_<rand>` フォールバック）。

#### 3.3.2 符号ロジック（出金マイナス／入金プラス）

現金・預金出納帳での残高計算は **`counterparty` に登場する口座を「自口座」とみなす**：

```
isIncome  = type === "income" || type === "collection"
isExpense = type === "expense" || type === "transfer" || type === "deferred"
runningBalance += (isIncome ? amount : 0) - (isExpense ? amount : 0)
```

このため上記マッピングにより：

- **出金元口座（From）の出納帳**: `counterparty===From` の `expense` レコードがヒット → `−amount`
- **入金先口座（To）の出納帳**: `counterparty===To` の `income` レコードがヒット → `+amount`

つまり「From は減る・To は増える」が**口座台帳上で必ず成立**する。

#### 3.3.3 バリデーション

新規登録画面（`/accounting/register/new`、振替タブ）の `handleSubmit`：

1. `date` / `fromAccountTitle` / `toAccountTitle` のいずれか欠落 → アラート。
2. From と To が同一 → アラート。
3. `parseSubmitAmount(formData.amount)` が NaN または 0 → アラート。
4. `Math.abs(rawAmount)` で常に正の数に変換。
5. ペアを `addTransaction()` × 2 で保存し、両者に同じ `transferGroupId` を付与。

#### 3.3.4 `isTransferLeg(t)` 判定

集計系画面で「振替の片側レコードを除外」するための共通判定（`src/utils/localStorage.ts`）：

```ts
export const isTransferLeg = (
  t: Pick<Transaction, "type" | "memo" | "transferGroupId">
): boolean => {
  if (t.transferGroupId) return true
  if (t.type === "expense" && /^振替（出金）/.test(t.memo ?? "")) return true
  if (t.type === "income"  && /^振替（入金）/.test(t.memo ?? "")) return true
  return false
}
```

- **新データ**: `transferGroupId` の有無で一意に判定。
- **旧データ**: `transferGroupId` を持たない 2025FY 以前のレコードでも、memo 接頭辞でフォールバック判定。

### 3.4 集計除外ルール（収支集計表・科目別台帳・収支報告書）

以下のすべての集計画面で **2 つの除外ルール**を厳守する：

1. `isTransferLeg(t) === true` の取引は集計から除外。
2. `t.accountTitle` が「現金・預金口座名（`AccountTitle.group === "cash"` の `name` 集合）」に一致する取引は科目集計に出現させない。

実装箇所（いずれも `useMemo` の filter チェーン）：

| 画面 | ファイル | 関連 useMemo |
| --- | --- | --- |
| 収支集計表 | `src/app/(dashboard)/accounting/summary/page.tsx` | `incomeTitles` / `expenseTitles` / `incomeByMonthAndTitle` / `expenseByMonthAndTitle` |
| 月次明細 | `src/app/(dashboard)/accounting/summary/monthly/page.tsx` | 同上 |
| 年次明細 | `src/app/(dashboard)/accounting/summary/annual/page.tsx` | 同上 |
| 科目別台帳 | `src/app/(dashboard)/accounting/ledger/subject/page.tsx` | `filteredTransactions` で `isTransferLeg` の早期 `return false` |
| 収支報告書 | `src/app/(dashboard)/accounting/report/page.tsx` | `incomeByCategory` / `expenseByCategory` |

`cashAccountNameSet` の生成例（収支集計表）：

```ts
const cashAccountNameSet = useMemo(
  () => new Set(accountTitles.filter((a) => a.group === "cash").map((a) => a.name)),
  [accountTitles]
)
```

> 補足: 口座残高を扱う計算（収支報告書の `accountBalances`、出納帳の `runningBalance`）は振替を**含めて**反映する必要があるため、これらの計算には `isTransferLeg` フィルタを**適用しない**。

### 3.5 集金（Collection）

- 集金設定（`CollectionSchedule`）に対し、部員ごとに `CollectionRecord` を作成し、入金イベントごとに `PaymentHistoryEntry` を `paymentHistory[]` に追加。
- `linkedTransactionId` で `Transaction(type==="collection")` と相互参照。
- 集金トランザクションは出納帳では入金扱い（`isIncome === true`）、収支集計表では `isTransferLeg(t)` ではないため通常通り集計対象。

### 3.6 計上（Deferred）

`type === "deferred"` は未収・未払・仮払・仮受の計上と精算で使用。出納帳の残高計算上は支出扱い（`isExpense`）。集計表では本書バージョン時点では特別な扱いをしない。

### 3.7 作業者（Operator）の自動記録

- `UserInfoContext` の `currentOperatorName`: `userInfo.staffNames` の先頭の非空文字。未登録なら `"未設定"`。
- `Transaction.createdBy`: 新規登録時に必ず `currentOperatorName` を保存。
- `Transaction.updatedBy` / `Transaction.lastEditedAt`: 編集時に必ず更新。`updateTransaction()` 側で `lastEditedAt` が未指定なら `new Date().toISOString()` を自動付与。
- 振替の編集時は、**`createdBy` と `createdAt` は元レコードを引き継ぐ**（履歴の「初回登録者」を保つ）。

---

## 4. データベース / LocalStorage 構造

### 4.1 LocalStorage キー

`src/utils/localStorage.ts` の `STORAGE_KEYS`:

| 定数 | キー名 | 内容 |
| --- | --- | --- |
| `CATEGORIES` | `classapo_categories` | カテゴリー（部門）マスタ |
| `ACCOUNT_TITLES` | `classapo_account_titles` | 勘定科目マスタ（現金・預金 / 収入 / 支出） |
| `TRANSACTIONS` | `classapo_transactions` | 取引レコード（全 type 共通） |
| `MONTHLY_NOTES` | `classapo_monthly_notes` | 収支集計表の月次メモ |
| `MEMBERS` | `classapo_members` | 部員マスタ |
| `COLLECTION_SCHEDULES` | `classapo_collection_schedules` | 集金予定 |
| `COLLECTION_RECORDS` | `classapo_collection_records` | 集金実績 |
| `COLLECTION_RESET_MARKER` | `classapo_collection_reset_marker` | 集金データ初期化バージョン |
| `SYSTEM_SETTINGS` | `classapo_system_settings` | システム設定（期首繰越金等） |
| `BUDGET_SETTINGS` | `classapo_budget_settings` | 予算設定 |
| `CSV_IMPORT_BATCHES` | `classapo_csv_import_batches` | CSV取込履歴 |
| `CLUB_PROFILE` | `classapo_club_profile` | 担当者名簿（最大5名） |
| `CURRENT_OPERATOR` | `classapo_current_operator` | 現在作業者（任意） |

### 4.2 `Transaction` 型（正本）

```ts
export interface Transaction {
  id: string
  date: string                                // YYYY-MM-DD
  type: "income" | "expense" | "transfer" | "collection" | "deferred"
  amount: number                              // 常に正の整数（円）
  counterparty: string                        // 自口座名（出納帳のキー）
  category: string                            // カテゴリー名 or "共通"（振替）
  accountTitle: string                        // 科目名 or 対向口座名（振替）
  memo: string
  receiptUrl: string | null

  // --- CSV 取込関連 ---
  csvImportId?: string | null
  originalFileName?: string | null

  // --- 集金ドリルダウン補助 ---
  collectionMemberId?: string
  collectionScheduleId?: string

  // --- 振替の対を束ねるID（同IDの2件で1組） ---
  transferGroupId?: string | null

  // --- 作業者 / 編集履歴 ---
  createdBy?: string | null                   // 初回登録者
  updatedBy?: string | null                   // 最終編集者
  lastEditedAt?: string | null                // 最終編集ISO
  createdAt: string                           // 初回登録ISO（不変）
}
```

### 4.3 関連マスタ型

```ts
export interface Category { id; name; order; isUsed }
export interface AccountTitle {
  id; group: "cash" | "income" | "expense"; name;
  categoryIds: string[];                       // cash は []（共通）
  balance: number | null; order; isUsed
}
export interface CsvImportBatch  { id; fileName; contentHash; registeredAt; transactionIds[] }
export interface MonthlyNote     { key: "<subjectId>_<year>-<month>"; subjectId; year; month; note }
export interface Member          { id; name; grade: 1..4; email; status: "active"|"retired"; retiredAt; createdAt }
export interface CollectionSchedule { id; name; amount; targetMonth: "YYYY-MM"; dueDate; ... }
export interface CollectionRecord   { id; scheduleId; memberId; status; paidAt; paidAmount?; linkedTransactionId?; paymentHistory? }
export interface SystemSettings  { openingCarryover; openingCarryoverLocked; yearRolloverCompletedAt }
export interface BudgetSetting   { id; fiscalYear; categoryId; accountTitleId; amount; updatedAt }
```

### 4.4 主要 CRUD API（`localStorage.ts` から export）

| 関数 | 役割 |
| --- | --- |
| `getTransactions()` / `saveTransactions(list)` | 取引の全件取得 / 一括保存 |
| `addTransaction(omit)` | 新規追加。`id` と `createdAt` を自動付与 |
| `updateTransaction(id, updates)` | 部分更新。`lastEditedAt` が未指定なら自動付与。`id` / `createdAt` は保護 |
| `deleteTransaction(id)` | 削除。CSV由来なら所属バッチからも除去 |
| `isTransferLeg(t)` | 振替片側判定（前述 3.3.4） |
| `getCategories` / `saveCategories` | カテゴリーマスタ |
| `getAccountTitles` / `saveAccountTitles` | 科目マスタ |
| `getSystemSettings` / `saveSystemSettings` | システム設定 |
| `getClubProfile` / `saveClubProfile` | 担当者設定（最大5名） |
| `getCurrentOperator` / `setCurrentOperator` | 現在の作業者 |
| `getBudgetSettings` / `saveBudgetSettings` / `upsertBudgetSetting` | 予算 |
| `getCsvImportBatches` / `createCsvImportBatchAndTransactions` / `deleteCsvImportBatch` / `syncCsvImportBatchFromTransactions` | CSV |
| `getMonthlyNote` / `saveMonthlyNote` | 月次メモ |
| `getMembers` / `addMember` / `updateMember` | 部員 |
| `getCollectionSchedules` / `addCollectionSchedule` / `addCollectionScheduleForMembers` / `updateCollectionSchedule` / `deleteCollectionSchedule` | 集金予定 |
| `getCollectionRecords` / `saveCollectionRecords` / `updateCollectionRecord` / `syncCollectionRecordsForMember` / `syncAllCollectionRecords` | 集金実績 |

### 4.5 マイグレーション

| 定数 | 内容 |
| --- | --- |
| `COLLECTION_RESET_VERSION = "2026-02-25-reset-v1"` | 集金データ初期化 1 回限り |
| `COLLECTION_SCHEDULE_FISCAL_2026_MIGRATION_VERSION = "2026-05-06-fy2026-v1"` | 集金スケジュールの 2025FY → 2026FY シフト |
| `TX_ORIGINAL_FILENAME_BACKFILL_VERSION = "2026-04-30-v1"` | CSV取込明細への `originalFileName` 遡及付与 |

---

## 5. 登録履歴・出納帳の表示仕様

### 5.1 登録履歴（`/accounting/register/history`）

#### 5.1.1 スコープ

- 表示対象は **`date >= getFiscalYearStart()` の取引のみ**（2026FY なら `2026-04-01` 以降）。
- 800ms ポーリングで `getTransactions()` / `getCsvImportBatches()` を再読込（他画面の変更に追随）。

#### 5.1.2 タブ

- `すべて`: 振替を 1 行集約した手動・CSV・集金・計上の全件一覧。
- `CSV`: 取込ファイル単位のサマリ。

#### 5.1.3 カラム比率（合計24 で 100% を分配）

> 履歴一覧テーブルは **`table-fixed` + `<colgroup>`** で `(ratio / 24) * 100%` を各列に割り当てる。
> 仕様議論段階では「合計26」での比率調整を試みたが、最終調整で **合計24** に圧縮した（下記が実装値）。

| 順 | 列 | 比率 | 用途 |
| --- | --- | ---: | --- |
| 1 | 日付 | 2 | `YYYY-MM-DD`（`whitespace-nowrap` + 省略） |
| 2 | 現金・預金口座 | 4.5 | 通常: 自口座（`counterparty`）。振替: 「振替 From → To」 |
| 3 | 入金額 | 2 | 右寄せ・タブラー数字 |
| 4 | 出金額 | 2 | 右寄せ・タブラー数字 |
| 5 | カテゴリー | 2.5 | `category` |
| 6 | 科目 | 2.5 | `accountTitle`（振替時は「ー」） |
| 7 | メモ | 4 | ユーザーメモ。空なら「ー」 |
| 8 | 登録日 | 2 | **2段表示**：1段目 `createdAt`、2段目 `lastEditedAt + " 編集"`（あれば） |
| 9 | 作業者 | 1.5 | **2段表示**：1段目 `createdBy`、2段目 `updatedBy`（あれば） |
| 10 | 編集 | 1 | 鉛筆アイコン（通常編集 or 振替編集へ） |
| 合計 | | **24** | |

#### 5.1.4 2段表示の具体ルール

**登録日列**:

```
2026/05/01 10:00          ← createdAt（必ず表示、書式 YYYY/MM/DD HH:mm）
2026/05/09 17:59 編集     ← lastEditedAt が非null のときのみ。グレー・小フォント
```

**作業者列**:

```
山田 太郎                  ← createdBy（必ず表示。「未設定」になることもあり）
佐藤 花子                  ← updatedBy が非null のときのみ。グレー・小フォント
```

- 列幅が狭いので `whitespace-nowrap overflow-hidden text-ellipsis` で省略。
- `title` 属性で `登録: <createdBy> / 編集: <updatedBy>` をホバー表示。

#### 5.1.5 振替の集約レンダリング

`allRows: HistoryRow[]` を `useMemo` で構築：

1. **`transferGroupId` を持つレコードを `Map<gid, Transaction[]>` で束ねる** → `kind: "transfer"` の行に変換。
2. 残った `transferGroupId` 無しの旧データを `memo` プレフィックスで判定し、**同日付・同金額**で出金 1 件 + 入金 1 件を 1:1 ペアリング（`Map<date_amount, income[]>` から shift）。
3. ペアにならなかった単独レコードは `kind: "single"` として通常表示。

振替行の表示内容：

| 列 | 内容 |
| --- | --- |
| 日付 | 代表レコード（expense 優先）の `date` |
| 現金・預金口座 | バッジ `[振替]` + `<From> → <To>`。`flex-wrap` + `break-words` + `text-[12.5px]` で 1 行に収まらない場合のみ折り返し。`title` 属性に全文 |
| 入金額 / 出金額 | 同額（`Math.abs(amount)`） |
| カテゴリー / 科目 | 一律「ー」 |
| メモ | `extractTransferUserMemo()` でユーザー入力部のみ抽出（` / <userMemo>` 以降）。空なら「ー」 |
| 登録日 | expense / income の `createdAt` のうち**新しい方**、`lastEditedAt` は両者の最大 |
| 作業者 | `createdBy` / `updatedBy` は expense → income の順で最初の非空文字を採用 |
| 編集 | クリックで `handleRowEdit()` → 振替編集モードへ |

ソートキー: `date DESC, createdAt DESC`。

#### 5.1.6 編集ボタン挙動

- 通常レコード → `getEditUrl(t, editReturnTo)` で `/accounting/register/edit/[id]` または CSV 一括編集へ。
- 振替行 → `withReturnTo("/accounting/register/new?tab=transfer&editTransfer=<expId>:<incId>", editReturnTo)`。

### 5.2 現金・預金出納帳（`/accounting/ledger/cash-bank`）

#### 5.2.1 カラム比率（合計32 で 100% を分配）

| 順 | 列 | 比率 |
| --- | --- | ---: |
| 1 | 日付 | 3 |
| 2 | カテゴリー | 3 |
| 3 | 科目 | 3 |
| 4 | 入金額 | 3 |
| 5 | 出金額 | 3 |
| 6 | 残高 | 3 |
| 7 | メモ | 6 |
| 8 | レシート・証憑 | 3 |
| 9 | 編集 | 2 |
| 10 | 削除 | 2 |
| 合計 | | **32** |

#### 5.2.2 抽出ロジック

- 検索条件: 現金・預金口座（必須）・開始日・終了日。
- フィルタ: `t.counterparty === selectedCashAccount.name` かつ `startDate <= t.date <= endDate`。
- 開始残高 = 期首繰越（`AccountTitle.balance`）+ 期首〜開始日前日までの収支。
- 月別に集計し、月末に「N月合計」サブトータル行を挿入。

#### 5.2.3 残高計算

```
isIncome  = type === "income" || type === "collection"
isExpense = type === "expense" || type === "transfer" || type === "deferred"
runningBalance += (isIncome ? amount : 0) − (isExpense ? amount : 0)
```

これにより振替も含めて自口座（`counterparty`）が一致するレコードがすべて反映される。

#### 5.2.4 レシート・証憑列の表示統一

| 行 | 表示 |
| --- | --- |
| 通常 `income` / `expense` で `receiptUrl` あり | リンクまたはサムネ |
| 通常 `income` / `expense` で `receiptUrl` なし | 赤背景アラート（`bg-[#FEE2E2]`）+「未登録」 |
| `type === "collection"` | **「ー」のみ**（赤背景アラートの対象外） |
| `isTransferLeg(t)` | **「ー」のみ**（赤背景アラートの対象外） |

> 登録履歴・出納帳の両画面で「ー」表記を統一済み。集金行も振替行も同様に視覚ノイズを抑制。

#### 5.2.5 振替時のレシート添付

新規登録画面の振替タブでは **レシート添付エリア自体を非表示** とする（右ペインの OCR ／ レシート表示は `activeTab === "income" || "expense"` のときのみ描画）。これにより振替で添付を促す動線は完全に消える。

### 5.3 科目別台帳（`/accounting/ledger/subject`）

- 期間フィルタは出納帳と同じ（期首〜本日デフォルト）。
- 科目選択 = `AccountTitle`（収入 or 支出グループ）。
- フィルタで **`isTransferLeg(t)` を early return false** することで、振替片側レコードが科目別台帳に出現しない。
- レシート・証憑列のシンボルも「ー」に統一。

### 5.4 収支集計表（`/accounting/summary`）

#### 5.4.1 ビューモード

- `annual`: 4月〜翌3月の **`FISCAL_MONTHS = [4,5,6,7,8,9,10,11,12,1,2,3]`** 順に月別マトリクスを表示。
- `monthly`: 1 ヶ月単位の科目別収支。

#### 5.4.2 集計対象の絞り込み

```
incomeSources = transactions.filter(t =>
    (t.type === "income" || t.type === "collection") && !isTransferLeg(t)
  ).filter(t => !cashAccountNameSet.has(t.accountTitle))

expenseSources = transactions.filter(t =>
    t.type === "expense" && !isTransferLeg(t)
  ).filter(t => !cashAccountNameSet.has(t.accountTitle))
```

- **振替の2レコードは集計から完全除外**。
- **現金・預金口座名（`AccountTitle.group === "cash"` の `name`）は科目として一切登場しない**。
- マスタに登録された収入・支出科目のみが行に並ぶ（実取引由来のフォールバック科目もマスタ照合済）。

### 5.5 収支報告書（`/accounting/report`）

- カテゴリー別の `incomeByCategory` / `expenseByCategory` で `isTransferLeg(t)` を除外。
- 口座残高 `accountBalances` は振替を**含めて**反映（出納帳ロジックと同一）。

---

## 6. 編集・キャンセル動線

### 6.1 通常取引の編集動線

- 履歴行・出納帳行の鉛筆アイコン → `getEditUrl(t, returnTo)`：
  - 通常: `/accounting/register/edit/[id]?returnTo=<currentUrl>`
  - CSV由来: `/accounting/register/csv/[batchId]?returnTo=<currentUrl>`
- `useUserInfo().currentOperatorName` を読み、保存時に `updateTransaction(id, { ..., updatedBy: currentOperatorName })` を実行（`lastEditedAt` は自動付与）。

### 6.2 振替の編集動線（登録履歴・出納帳で共通）

#### 6.2.1 遷移パス

両画面とも以下を URL に組み立てて遷移：

```
/accounting/register/new?tab=transfer&editTransfer=<expenseId>:<incomeId>&returnTo=<元URL>
```

- 登録履歴（`handleRowEdit`）: `row.expenseTx.id` / `row.incomeTx.id` を直接使用。
- 出納帳（`handleEdit`）: `resolveTransferPair(t)` で対のID解決。
  - 第一優先: `transferGroupId` で同 group の expense / income を引く。
  - フォールバック: `memo` プレフィックス + 同日付 + 同金額のヒューリスティック。
  - 解決できなければ通常編集 (`getEditUrl`) に退避。

#### 6.2.2 編集モード初期化

新規登録ページの `useEffect`（`transferEditInitDoneRef` で 1 回限定）：

1. `searchParams.get("editTransfer")` を `:` で分割し `expenseId` / `incomeId` を取得。
2. 両IDが揃ったら `getTransactions()` から該当2件を取得。
3. フォームを以下でプリフィル：
   - `date` = expense.date（or income.date）
   - `fromAccountTitle` = expense.counterparty
   - `toAccountTitle`   = income.counterparty
   - `amount` = `String(Math.abs(expense.amount))`（表示はカンマ整形）
   - `memo` = `extractTransferUserMemo(expense)` または income 側
4. `setTransferEditState({ expenseId, incomeId })` を立てる。
5. `setActiveTab("transfer")` でタブを切替。

#### 6.2.3 振替編集モード時の UI

- 振替フィールドの上部に **アンバーの編集モードバナー** を表示：
  > 振替の編集モードです。登録すると元の振替（出金・入金の対）は置き換えられます。
- バナー右端に「編集をやめる」リンクボタン（`setTransferEditState(null)` で通常登録に戻す）。
- フォーム下部の送信ボタンを **キャンセル / 振替を更新する** の 2 ボタン横並びに切り替える（後述 6.3）。
- 通常登録モードでは従来通り全幅の「登録する」ボタンのみ。

#### 6.2.4 振替更新時の保存ロジック（`handleSubmit` 内）

`activeTab === "transfer" && transferEditState` の場合の処理順：

1. 既存対の元レコードを `getTransactions()` から探し、`originalExp` / `originalInc` として保持（`createdBy` / `createdAt` 引継ぎ用）。
2. `deleteTransaction(transferEditState.expenseId)` と `deleteTransaction(transferEditState.incomeId)` で旧対を削除。
3. 新しい `transferGroupId` を生成し、新しい `addTransaction()` 2 件を作成。各レコードに：
   - `createdBy` = 元データの `createdBy` ?? `currentOperatorName`（初回登録者を保つ）
   - `updatedBy` = `currentOperatorName`
   - `lastEditedAt` = `new Date().toISOString()`
4. 新レコードの `createdAt` は `addTransaction` が現在時刻を打つため、**元の `createdAt` を保ちたい場合は `saveTransactions(list)` で直接書き戻し**する（実装済み）。
5. `alert("振替を更新しました")` → `setTransferEditState(null)` → `resetForm()`。

### 6.3 キャンセルボタン

#### 6.3.1 位置・並び

振替編集モードのみ表示。**フォーム右端寄せ**で 2 ボタンを横並び：

```
[                                          [キャンセル]  [振替を更新する] ]
                                              ↑左            ↑右（メイン）
```

レイアウト：

```tsx
<div className="flex w-full justify-end gap-3">
  <Button type="button" variant="outline" onClick={cancelHandler}
          className="shrink-0 py-3 px-5 text-sm font-medium rounded-lg
                     border border-gray-300 bg-white text-[#6B7280]
                     hover:bg-gray-50 hover:text-[#374151]">
    キャンセル
  </Button>
  <Button type="submit"
          className="shrink-0 py-3 px-6 text-sm font-semibold text-white rounded-lg shadow-sm"
          style={{ backgroundColor: "#A3BC68" /* 入出金テーマ */ }}>
    振替を更新する
  </Button>
</div>
```

#### 6.3.2 動作

- **キャンセル**: `setTransferEditState(null)` でモードを解除し、`router.back()` で 1 つ前の画面（出納帳・登録履歴・他）へ戻る。入力内容は保存されない。
- **振替を更新する**: `type="submit"` でフォーム送信 → 上記 6.2.4 の保存処理。

#### 6.3.3 通常登録時

通常の収入・支出・集金・計上タブでは **従来どおり全幅の「登録する」ボタンのみ**。キャンセルは表示されない（必要な場合はサイドバー等で別画面へ移動）。

### 6.4 タブ切替時のクリーンアップ

`handleTabChange()` で振替タブから離脱したとき、`transferEditState` を `null` にリセットする。これにより：

- 振替編集中に他タブへ移動 → 戻ってきた際に編集モードが残らない。
- URL から `editTransfer` クエリが消えても初期化フラグ（`transferEditInitDoneRef`）で再プリフィルしない。

---

## 付録 A. ユーティリティ関数一覧

| ファイル | 関数 / 定数 | 用途 |
| --- | --- | --- |
| `src/utils/localStorage.ts` | `isTransferLeg(t)` | 振替片側判定（集計除外用） |
| `src/utils/localStorage.ts` | `addTransaction` / `updateTransaction` / `deleteTransaction` | Transaction CRUD |
| `src/utils/transactionEditPath.ts` | `getEditUrl(t, returnTo)` | 通常取引の編集先URL生成（CSV由来か個別か） |
| `src/utils/transactionEditPath.ts` | `isCsvLinkedTransaction(t)` | CSV取込由来判定 |
| `src/utils/transactionEditPath.ts` | `withReturnTo(url, returnTo)` | `returnTo` クエリ付与 |
| `src/utils/amountInput.ts` | `formatAmountInputDisplay` / `isAllowedSignedIntegerTyping` / `parseSubmitAmount` | 金額入力の整形・検証 |
| `src/contexts/UserInfoContext.tsx` | `useUserInfo()` / `currentOperatorName` | 現作業者名の取得 |
| 各ページ | `getFiscalYearStart()` | 期首日（`YYYY-04-01`）算出 |
| `summary/page.tsx` | `FISCAL_MONTHS` | 年度月順 `[4..12,1..3]` |
| `register/history/page.tsx` | `formatTransactionRegisteredAt(iso)` | `YYYY/MM/DD HH:mm` 整形 |
| `register/history/page.tsx` | `extractTransferUserMemo(tx)` | 振替memoからユーザー入力部抽出 |

---

## 付録 B. 用語集

| 用語 | 定義 |
| --- | --- |
| **会計年度（FY）** | 4月1日〜翌年3月31日。本書では `FY2026 = 2026/04/01 〜 2027/03/31`。 |
| **期首** | 会計年度の開始日。`getFiscalYearStart()` が返す `YYYY-04-01`。 |
| **振替（Transfer）** | 自クラブ内の口座間移動。実体は `expense` + `income` の 2 レコードを `transferGroupId` で束ねたもの。 |
| **From / To** | 振替の出金元（From）と入金先（To）。出金元は残高 −、入金先は残高 +。 |
| **`isTransferLeg(t)`** | レコードが振替の片側か判定。`true` の場合は収支集計・科目別台帳・収支報告書から除外。 |
| **`cashAccountNameSet`** | `AccountTitle.group === "cash"` の `name` 集合。これに含まれる科目名は科目集計に出さない。 |
| **作業者** | 担当者設定の先頭名（未登録なら「未設定」）。`createdBy` / `updatedBy` に自動記録。 |
| **`editReturnTo`** | 編集画面から元の画面へ戻るための URL（クエリ `returnTo` で受け渡し）。 |
| **集計・帳簿** | サイドバー第3メニュー。旧表記「集金・帳簿」は廃止。 |

---

## 改訂履歴

| 版 | 日付 | 主な変更 |
| --- | --- | --- |
| v2.9 | 2026-05-10 | 初版。2026年度完全固定運用を正本化。振替1行集約、`isTransferLeg`、登録履歴の比率合計24・2段表示、現金預金口座の集計除外、サイドバー「集計・帳簿」、振替編集動線統一とキャンセルボタンを反映。 |

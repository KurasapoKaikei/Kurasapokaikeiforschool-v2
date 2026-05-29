# クラサポ会計 — 全システム統合グランドマスター仕様書

| 項目 | 内容 |
|------|------|
| **版** | **Ver 2.0**（2026-05-29 確定） |
| **ファイル** | `docs/system-grand-spec.md`（本書のみでシステム全体を復元可能とする正本） |
| **リポジトリ** | `kurasaokaikei` |
| **フレームワーク** | Next.js 14（App Router）/ React 18 / TypeScript / Tailwind CSS |
| **データ層（現行デモ）** | ブラウザ `localStorage` / `sessionStorage` 中心（Prisma スキーマは将来本番 DB 用） |
| **開発 URL** | `http://localhost:3000` |
| **位置づけ** | 部分差分・個別仕様書を統合した**唯一の復元用マスター**。実装と差異がある場合は本書の「確定仕様」列を優先し、実装追従は本書に従う。 |

---

## 目次

1. [システム概要](#1-システム概要)
2. [① システム全域 — ヘッダー3段構造・デザイン共通仕様](#2-システム全域--ヘッダー3段構造デザイン共通仕様)
3. [② クラブポータル — 決算提出フローと全域ロック機構](#3-クラブポータル--決算提出フローと全域ロック機構)
4. [③ 監査人ポータル — ダッシュボード連動](#4-監査人ポータル--ダッシュボード連動)
5. [認証・セッション・ポータル隔離](#5-認証セッションポータル隔離)
6. [学校管理者ポータル](#6-学校管理者ポータル)
7. [クラブポータル — 全機能](#7-クラブポータル--全機能)
8. [監査人ポータル — 全機能](#8-監査人ポータル--全機能)
9. [決算ワークフロー二系統と統合方針](#9-決算ワークフロー二系統と統合方針)
10. [会計・帳簿・集金・予実・部員](#10-会計帳簿集金予実部員)
11. [メッセージ BOX](#11-メッセージ-box)
12. [保護者・大学・その他ルート](#12-保護者大学その他ルート)
13. [localStorage / sessionStorage 完全一覧](#13-localstorage--sessionstorage-完全一覧)
14. [ソースファイル復元索引](#14-ソースファイル復元索引)
15. [改訂履歴](#15-改訂履歴)

---

## 1. システム概要

### 1.1 コンセプト

- **名称**: クラサポ会計
- **スローガン**: 「できるクラブは会計もスマートに。」
- **価値**: AI（Gemini）による入力補助、証憑紐付け、決算・繰越、監査人連携、学校俯瞰

### 1.2 三ポータル構成

| ポータル | ベース URL | 第2段テーマカラー | 利用者 |
|----------|------------|-------------------|--------|
| **学校管理者** | `/school` | ネイビー `#001e43` | 学生支援課・部活動統括係 |
| **クラブ** | `/club` | 優しいピンク `#E66A84`（サイドメニュー「ポータルトップ」と100%同期） | 部活動会計担当 |
| **監査人** | `/audit` | オレンジ `#ff9800` | 内部・外部監査担当 |

### 1.3 統合ログインハブ

- **URL**: `/` — `LoginHubView`
- 学校ログイン → `/school/login`
- クラブログイン → ハブ内 `ClubLoginForm`（成功後 `/club/dashboard`）
- 監査人 → `/audit/login`（または学校ログインで `AUD-*` ID の場合 `/audit` へ振分）

### 1.4 技術スタック

| 層 | 技術 |
|----|------|
| UI | React 18, Tailwind CSS, Radix UI, lucide-react |
| フォーム | react-hook-form, zod |
| 日付 | date-fns |
| OCR（任意） | `@google/generative-ai` — `/api/ocr` |
| DB（準備） | Prisma 5 + PostgreSQL（`prisma/schema.prisma`） |

### 1.5 App Shell 共通パターン

各ポータルは **Layout Gate** でログイン画面のみ Shell 除外し、ログイン後は **サイドバー + 統一3段ヘッダー + メイン**。

| ポータル | Gate | Shell | ヘッダー |
|----------|------|-------|----------|
| 学校 | `SchoolLayoutGate` | `SchoolAppShell` | `SchoolHeader` → `PortalUnifiedHeader` |
| クラブ | `ClubLayoutGate` | `ClubAppShell` | `ClubPortalHeader` → `PortalUnifiedHeader` |
| 監査人 | `AuditorLayoutGate` | `AuditorAppShell` | `AuditorHeader` → `PortalUnifiedHeader` |

年度 Context: `PortalFiscalYearProvider` — 選択肢 `2024年度` / `2025年度` / `2026年度`（デフォルト `2026年度`）。

---

## 2. システム全域 — ヘッダー3段構造・デザイン共通仕様

**実装正本**: `src/components/layout/PortalUnifiedHeader.tsx`  
**ブランド定義**: `src/lib/portalBrand.ts`

### 2.1 第1段 — 学校コンテキスト帯

| 項目 | 仕様 |
|------|------|
| 背景 | `#FAFAFA`、`border-b border-gray-100` |
| 学校名 | 公式感・威厳のため **従来の2倍相当** — Tailwind **`text-xl font-bold`**、`tracking-tight`、`text-[#4B5563]` |
| デモ表示名（確定） | **「クラクラサポサポ大学」**（契約未登録時のグランドマスター表示名。`getSchoolHeaderDisplay()` の最終フォールバックは `SCHOOL_DISPLAY_NAME` を上書き可能） |
| 会計期間（右インライン） | **`2026.4.1 〜 2027.3.31`** 形式（第1段では `text-xs text-[#9CA3AF]` で学校名の右にインライン表示） |
| データ解決順 | `loadCurrentSchool()` → 学校管理者セッション契約 → `contract_info` → デモ固定 |
| 実装 | `src/lib/schoolHeaderDisplay.ts` |
| 更新トリガー | `storage` イベント、`SCHOOL_SESSION_CHANGED_EVENT` |

### 2.2 第2段 — ポータル・アイデンティティ帯

| ポータル | 背景色 | 左（白抜き） | 右 |
|----------|--------|--------------|-----|
| 学校 | `#001e43` | **管理者ポータル** | 会計期間ラベル + ログアウト |
| 監査人 | `#ff9800` | **監査人ポータル** | 同上 |
| クラブ | `#E66A84` | **`{clubName}ポータル`**（動的。例: ラグビー部ポータル） | 同上 |

**クラブ名の取得**: `ClubPortalHeader` — `activeClub.name` → `userInfo.organizationName` → `mockUserInfo.organizationName`（`src/constants/userInfo.ts`）。

**ログアウトボタン**

- 白枠 `border border-white`、白文字、`LogOut` アイコン
- クリックで当該ポータルセッション削除後 **`http://localhost:3000/`**（`router.push("/")`）へ遷移
- 学校: `clearSchoolAdminSession` / クラブ: `logoutClubSession` / 監査人: 監査人セッションクリア

**高さ**: `h-12`、左右 `px-6`。

### 2.3 第3段 — 年度切替コントロール

| 項目 | 仕様 |
|------|------|
| ラベル | 「年度切替:」 |
| ボタン形状 | **pill（`rounded-full`）** |
| 非選択 | `bg-gray-100 text-[#374151]` |
| 選択中 | 当該ポータルの **brandColor** 背景 + 白文字 + `shadow-sm` |
| 選択肢 | `PORTAL_FISCAL_YEARS`: 2024年度 / 2025年度 / 2026年度 |
| Context | `usePortalFiscalYear()` |

### 2.4 ヘッダー共通スタイル定数

```typescript
// src/lib/portalBrand.ts
export const PORTAL_BRAND = {
  school: "#001e43",
  club: "#E66A84",   // CLUB_BRAND_PINK と同一
  audit: "#ff9800",
} as const
```

### 2.5 サイドメニューとの色同期（クラブ）

- ポータルトップのアクティブ色: `#E66A84`（`Sidebar.tsx` `menuItems[0].colorHex`）
- 第2段ヘッダー帯と **100%同一** のピンクを使用すること

### 2.6 廃止・非推奨 UI

- 旧 `LegacyAppHeader` / 単段ヘッダー — 全ポータルで `PortalUnifiedHeader` に統一
- クラブダッシュボード上部の独立 `ClubPortalYearBar` — 第3段ヘッダーに統合済みのため使用しない

---

## 3. クラブポータル — 決算提出フローと全域ロック機構

**画面 URL**: `/club/settlement`  
**実装**: `src/app/club/settlement/page.tsx`（ページ直実装が Ver 2.0 正本）

> 補足: `src/components/club/ClubSettlementView.tsx` は旧来の `schoolClubSettlement` 連動 UI。新規開発・復元時は **page.tsx 仕様を優先**。

### 3.1 画面レイアウト構成（上から順）

1. **小タイトル** — 左ネイビー縦線（`border-l-4`、`#001e43`）、文言「決算」、`text-xl font-semibold`
2. **■ 担当監査人**
3. **■ 決算ステータス**（双六型ステップフロー）
4. **提出ボタンエリア**（注意文 + ボタン）

**全体**: 左寄せ（`text-left`）、白背景カード、テーマネイビー `#001e43`。

### 3.2 担当監査人・決算ステータス — 見出しとカードの完全統一

| 要素 | クラス・仕様 |
|------|----------------|
| 見出し（両方） | `text-sm font-semibold text-gray-700`、先頭に「■ 」 |
| カード（両方） | `bg-gray-50 border border-gray-100 rounded-xl p-5 space-y-3` |
| 監査人表示 | `[部署名] [氏名] 様`（例: 財務部 山田太郎 様）。本番は学校登録監査人マスタから動的取得 |
| データ源（将来） | `getSchoolAuditorById` + クラブ割当 |

### 3.3 履歴対応型ステップフロー（双六 UI）

**基本3ステップ**: `作成中` → `提出済` → `承認済`

**差し戻しのたびに末尾へ履歴が無限蓄積**:

```
作成中 → 提出済 → 承認済
         ↓（差戻し発生時）
作成中 → 提出済 → 差戻し → 提出済 → 承認済
         ↓（再度差戻し）
… → 差戻し → 提出済 → 承認済  （末尾に都度追加）
```

| 視覚状態 | 条件 | スタイル |
|----------|------|----------|
| **現在地** | `index === currentStepIndex` | ネイビー背景 `#001e43`、白文字、`rounded-full` |
| **差し戻しステップ** | `status === "REJECTED"` かつ通過済 | 薄赤 `bg-red-50 text-red-600 border-red-200` + `RotateCcw` アイコン |
| **通過済（差戻し以外）** | `index < currentStepIndex` | 青系 `bg-blue-50 text-blue-700` + `CheckCircle2` |
| **未達** | 上記以外 | 薄グレー `bg-gray-100 text-gray-400 border-gray-200` |

**永続化キー**: `club_settlement_history_flow` — JSON `{ steps: StepItem[], currentIndex: number }`  
**StepItem**: `{ id, label, status }` where `status ∈ PREPARING | SUBMITTED | REJECTED | APPROVED`

### 3.4 提出ボタン

| 項目 | 仕様 |
|------|------|
| 文言（未提出） | `決算データを提出する` |
| 文言（提出済） | `決算データ提出済み`（disabled） |
| 色 | ネイビー `#001e43`、ホバー `hover:opacity-90` |
| 確認 | `confirm("決算データを学校へ提出しますか？提出後はすべての操作がロックされます。")` |
| 成功後 | `alert` → **`window.location.reload()`** |

**デモ用差戻し**: ロック中のみ「【デモ】監査人から差し戻しを受ける」ボタン表示 — フロー末尾に `差戻し` + `提出済` を挿入しロック解除。

### 3.5 全域ロック（localStorage 連動）

#### 3.5.1 ロックフラグ

| キー | 値 | 設定タイミング |
|------|-----|----------------|
| `is_club_settlement_locked` | `"true"` / `"false"` | 提出確認後 `true`、差戻しデモで `false` |

#### 3.5.2 ロック対象機能（5領域）

提出後、以下 **すべて** の登録・保存・編集・削除を強制 `disabled`:

| # | 機能 | 代表パス |
|---|------|----------|
| 1 | **入出金登録** | `/club/accounting/register/new`, `history`, `csv/[id]`, `edit/[id]` |
| 2 | **集計・帳簿** | `/club/accounting/summary`, `ledger/cash-bank`, `ledger/subject` |
| 3 | **集金管理** | `/club/collection/schedule`, `settings` |
| 4 | **予実管理** | `/club/budget/*`（`BudgetManagementView`） |
| 5 | **設定** | `/club/settings/club`, `staff`, `category`, `account-titles`, `fiscal-years` |

**ロック対象外（閲覧・決算・メッセージ等）**: ダッシュボード、決算ページ、メッセージBOX、部員管理、操作ガイド、決算以外のナビゲーション。

#### 3.5.3 警告アラート

**コンポーネント**: `SettlementLockAlert` — `src/components/club/SettlementLockAlert.tsx`

| 項目 | 値 |
|------|-----|
| 表示位置 | 各ロック対象ページ **最上部** |
| 背景 | `bg-red-50` |
| 枠 | `border border-red-200` |
| 文字 | `text-red-600 text-sm` |
| アイコン | `AlertTriangle` |
| 文言（確定） | 「当年度の決算は提出済のため、登録、編集、削除はできません。ロックを解除したい場合は監査人から差戻しをしてもらってください。」 |

各ページは `useEffect` で `localStorage.getItem("is_club_settlement_locked") === "true"` を検知し `isLocked` state を立てる。

---

## 4. 監査人ポータル — ダッシュボード連動

**画面**: `/audit` — `AuditorDashboardView`  
**カード**: `AuditorClubDashboardCard`  
**ロック検知フック**: `useClubSettlementLocked` — キー `is_club_settlement_locked`

### 4.1 廃止した UI

- 混乱を招く旧 **「決算ワークフロー」** 専用セクション・重複進捗 UI は **画面から完全削除**
- カード内の旧「進捗状況」ブロックも非表示

### 4.2 提出状況・ステータスのリアルタイム同期

| 表示項目 | 未提出（ロック false） | 提出済（ロック true） |
|----------|------------------------|------------------------|
| **当期の決算提出状況** | バッジ「未提出」（灰 `variant="muted"`） | バッジ「提出済」（青系ネイビー `variant="navy"`） |
| **監査ステータス** | 「未着手」（灰） | **「監査中」**（ネイビー系 — システム標準カラー） |

**同期メカニズム**

- クラブ側提出 → `is_club_settlement_locked = "true"`
- 監査人画面は `storage` イベント、`focus`、`visibilitychange` で再読込
- **即時反映**（ポーリング不要、同一タブは state 更新、別タブは storage イベント）

### 4.3 カード下部アクション

| 要素 | 仕様 |
|------|------|
| ボタン | `決算データを確認・承認・差戻し`（オレンジ `bg-orange-500`） |
| 活性条件 | **`isClubSubmitted === true`** のみ（提出済後） |
| 非活性 | `bg-orange-500/40 cursor-not-allowed` |
| クリック | `SchoolSettlementReviewDialog` を開く |

### 4.4 監査人ダッシュボード上部

- オレンジ枠のログイン情報帯（氏名・部署・担当クラブ件数）
- 担当クラブのみグリッド表示（`assignedClubIds` でフィルタ）

---

## 5. 認証・セッション・ポータル隔離

### 5.1 ポータル間ストレージ完全隔離

**正本**: `src/lib/portalSessionStorage.ts`

| ポータル | localStorage キー | 内容 |
|----------|-------------------|------|
| クラブ | `club_current_session` | `{ id, name, groupNames }` |
| 監査人 | `auditor_current_session` | 監査人セッション |
| 学校管理者 | `school_admin_session` | 管理者ログイン |
| 学校マスタ | `school_current_session` | 学校契約・表示 |
| なりすまし | `club_portal_impersonation`（**sessionStorage**） | `{ viewer: "school" \| "auditor", clubId }` |

**禁止**: `localStorage.clear()`、他ポータルキーの削除、クラブ閲覧時の `clearCurrentClub()`。

### 5.2 ログイン仕様サマリー

| ポータル | URL | 初期値 | デモ成功条件 |
|----------|-----|--------|--------------|
| 学校 | `/school/login` | ID/PW 空 | 両方空、または `admin`/`admin`、本登録資格、`AUD-*` は監査人へ |
| クラブ | `/club/login` | 空 | 学校登録クラブ ID+PW 一致 |
| 監査人 | `/audit/login` | — | 監査人マスタ認証 |

**パスワード UI**: `PasswordInput` — 👁 表示切替、`deferAutofillUntilFocus` 対応。

### 5.3 セッション有効期限

- **自動タイムアウトなし**（無期限）。明示ログアウトのみ。

### 5.4 なりすまし（閲覧モード）

- バナー: `ClubImpersonationBanner` — 「監査人閲覧モード」/ 学校閲覧
- 戻る: 監査人 → `/audit`、学校 → `/school`
- 実装: `setImpersonatedClub` + `window.location.assign`

---

## 6. 学校管理者ポータル

### 6.1 サイドメニュー（`SchoolSidebar`）

| メニュー | パス |
|----------|------|
| ポータルトップ | `/school` |
| クラブ管理 | `/school/clubs`（一覧・グループ・登録） |
| 監査人管理 | `/school/clubs/auditors`（監査運用 ON 時） |
| メッセージBOX | `/school/messages` |
| 契約状況 | `/school/contract` |
| 設定 | `/school/settings/*` |
| 操作ガイド | `/school/guide` |

### 6.2 管理者トップ（`SchoolMypageView`）

- 全クラブ監査状況サマリー（4色ワークフロー集計）
- 機能カード: クラブ DB、監査人 DB、クラブ登録、メッセージ、契約、ガイド

### 6.3 クラブ・監査人管理

- クラブ登録: `/school/clubs/register` — ID・パスワード・グループ
- 監査人登録: `/school/clubs/auditors/register`
- 監査運用設定: `/school/settings/audit-flow` — 監査人メニュー表示 ON/OFF

### 6.4 契約・デモデータ

`SCHOOL_CONTRACT_DEMO`（`schoolTheme.ts`）— スタンダードプラン、年間料金、請求月など。

---

## 7. クラブポータル — 全機能

### 7.1 サイドメニュー完全一覧（`Sidebar.tsx`）

| メニュー | 色 hex | 子メニュー |
|----------|--------|------------|
| ポータルトップ | `#E66A84` | — |
| 入出金登録 | `#A3BC68` | 新規登録、登録履歴 |
| 集計・帳簿 | `#68A384` | 収支集計表、現金・預金出納帳、科目別台帳、収支報告書 |
| 集金管理 | `#D99529` | 集金実績、集金予定一覧、集金設定 |
| 予実管理 | `#1A237E` | 予算書、前年度比 |
| 部員管理 | `#9D8CC3` | 部員一覧、部員登録 |
| メッセージBOX | `#4A90E2` | — |
| 決算 | `#005088` | — |
| 設定 | `#77B8DA` | クラブ設定、担当者、カテゴリー、科目 |
| 操作ガイド | `#4A90E2` | — |

アクティブ親メニュー左端: ネイビー `#001e43` 縦線（決算ページ小タイトルと統一）。

### 7.2 ダッシュボード `/club/dashboard`

**レイアウト**: `67vh` 3列グリッド（lg 以上）

| 列 | 内容 |
|----|------|
| 左 | 現在の残高（現金預金内訳・合計・入る予定・支払う予定・実質残高） |
| 中央上 | メッセージBOX（最大5件） |
| 中央下 | 現在の部員数（学年別） |
| 右上 | 決算ステータス（`ClubDashboardSettlementSummary` — workflow 連動） |
| 右下 | 証憑未登録数 `未登録 / 支出仕訳総数` |

**削除済**: 「重要：未処理・エラー通知」セクション。

### 7.3 全ルート一覧

```
/club/login
/club/dashboard
/club/accounting/input
/club/accounting/register/new
/club/accounting/register/history
/club/accounting/register/edit/[id]
/club/accounting/register/csv/[id]
/club/accounting/summary
/club/accounting/summary/monthly
/club/accounting/summary/annual
/club/accounting/ledger/cash-bank
/club/accounting/ledger/subject
/club/accounting/report
/club/collection
/club/collection/history
/club/collection/schedule
/club/collection/settings
/club/budget
/club/budget/book
/club/budget/comparison
/club/budget/year-over-year
/club/members/list
/club/members/register
/club/members/[id]
/club/messages
/club/settlement
/club/settings/club
/club/settings/staff
/club/settings/category
/club/settings/account-titles
/club/settings/fiscal-years
/club/guide
```

---

## 8. 監査人ポータル — 全機能

```
/audit/login
/audit
/audit/clubs/[clubId]
/audit/messages
/audit/messages/drafts
/audit/guide
```

- クラブ詳細: `AuditorClubReviewView`
- メッセージ: 学校・クラブとの連絡
- 閲覧: なりすましでクラブダッシュボードへ

---

## 9. 決算ワークフロー二系統と統合方針

現行コードには **並行する2系統** がある。復元時は用途を分けて実装する。

### 9.1 系統 A — Ver 2.0 提出ロック（本書 §3）

| キー | 用途 |
|------|------|
| `is_club_settlement_locked` | クラブ編集ロック |
| `club_settlement_history_flow` | 双六 UI 履歴 |

**監査人連動**: `useClubSettlementLocked` → 提出済/監査中表示。

### 9.2 系統 B — `club_workflow_status`（学校・ダッシュボード連動）

| キー | 形式 |
|------|------|
| `club_workflow_status` | `Record<clubId, { status, hadRejection?, resubmittedAfterReject? }>` |

| status | 表示 | 色 |
|--------|------|-----|
| `EDITING` | 未提出 | 赤 |
| `SUBMITTED` | 監査中 | 緑 |
| `REJECTED` | 差戻 | 黄 |
| `APPROVED` | 承認済 | 青 |

**API**: `setClubWorkflowStatus()` — `src/lib/clubWorkflowStatus.ts`  
**学校同期**: `schoolClubSettlement.ts`  
**イベント**: `CLUB_WORKFLOW_CHANGED_EVENT`

### 9.3 統合方針（推奨）

1. クラブ提出時: **A のロック + B の `SUBMITTED` を同時更新**
2. 監査人承認/差戻: B を更新し、差戻時は A のロック解除
3. UI: 決算ページは A、ダッシュボード進捗は B — 最終的には単一 API に集約

---

## 10. 会計・帳簿・集金・予実・部員

### 10.1 勘定・カテゴリー

- カテゴリー: 部会計・合宿・遠征等、仕訳必須帰属
- 科目グループ: 現金・預金 / 資産 / 負債 / 収入 / 支出
- 詳細: `docs/spec.md` v2.8 参照

### 10.2 入出金登録

- タブ: 収入 / 支出 / 振替 / 集金
- AI OCR: Gemini — `/api/ocr`
- 振替: `transferGroupId` またはメモプレフィックスで片側除外
- 二重登録警告、残高不整合アラート

### 10.3 証憑

**集計**: `computeClubReceiptStats` — `src/lib/clubReceiptStats.ts`

- 対象: `type === "expense"` かつ振替片側でない
- ダッシュボード: `証憑未登録数： {n} / {total} 件`
- 帳簿赤ハイライト: `bg-red-50 text-red-600` — 現金出納帳・科目別台帳

### 10.4 集金

- 実績・予定・設定
- 部員別月次、カテゴリー・科目・対象部員の一括予約
- サービス: `collectionPayment.ts`, `collectionPaymentSync.ts`

### 10.5 予実・予算

- 予算書、前年度比（`/budget/comparison` ↔ `year-over-year` リダイレクト同一扱い）
- `BudgetManagementView` — 決算ロック連動

### 10.6 部員

- 一覧・登録・詳細
- CSV インポート、保護者トークン URL（`/member`）

### 10.7 決算・繰越（業務ロジック）

1. 証憑・異常解消
2. 実残高エビデンス
3. 残高照合
4. 繰延（未収・仮受・仮払・未払）
5. 整合性確認（資産 − 負債 = 次期繰越金）

---

## 11. メッセージ BOX

| ポータル | パス | 仕様書 |
|----------|------|--------|
| クラブ | `/club/messages` | `docs/specifications/club_portal_message_box.md` |
| 学校 | `/school/messages` | 一斉配信・下書き・クラブ個別 |
| 監査人 | `/audit/messages` | 下書き対応 |

**ストレージ**: `portalMessageStorage.ts`、変更イベント `PORTAL_MESSAGES_CHANGED_EVENT`。

---

## 12. 保護者・大学・その他ルート

| パス | 用途 |
|------|------|
| `/parent` | 保護者閲覧（トークン） |
| `/member` | 部員向け |
| `/register/school` | 学校新規登録 |
| `/register/verify` | 登録確認 |
| `/university/dashboard` | 大学統合 DB |
| `/university/approvals` | 承認待ち |

---

## 13. localStorage / sessionStorage 完全一覧

| キー | 用途 |
|------|------|
| `is_club_settlement_locked` | Ver2 決算提出ロック |
| `club_settlement_history_flow` | Ver2 双六フロー履歴 |
| `club_workflow_status` | ワークフロー正本（クラブ ID 別） |
| `club_current_session` | クラブログイン |
| `auditor_current_session` | 監査人ログイン |
| `school_admin_session` | 学校管理者ログイン |
| `school_current_session` | 学校マスタ |
| `school_current_user` | 学校表示ユーザー |
| `kurasaokaikei-school-clubs` | クラブマスタ |
| `school_auditors` | 監査人マスタ |
| `contract_info` | 契約情報 |
| 取引・科目・部員等 | `utils/localStorage.ts` クラブスコープキー |
| `club_portal_impersonation` | sessionStorage なりすまし |

**レガシー移行読取のみ**: `kurasaokaikei-current-club`, `kurasaokaikei-school-admin-session` 等。

---

## 14. ソースファイル復元索引

### 14.1 ヘッダー・シェル

```
src/components/layout/PortalUnifiedHeader.tsx
src/components/layout/ClubPortalHeader.tsx
src/components/layout/school/SchoolHeader.tsx
src/components/layout/audit/AuditorHeader.tsx
src/lib/portalBrand.ts
src/lib/schoolHeaderDisplay.ts
src/contexts/PortalFiscalYearContext.tsx
src/components/layout/ClubAppShell.tsx
src/components/layout/school/SchoolAppShell.tsx
src/components/layout/audit/AuditorAppShell.tsx
```

### 14.2 決算・ロック

```
src/app/club/settlement/page.tsx
src/components/club/SettlementLockAlert.tsx
src/components/audit/useClubSettlementLocked.ts
src/components/audit/AuditorClubDashboardCard.tsx
src/components/audit/AuditorDashboardView.tsx
src/lib/clubWorkflowStatus.ts
src/lib/schoolClubSettlement.ts
```

### 14.3 認証

```
src/components/auth/LoginHubView.tsx
src/components/auth/SchoolLoginView.tsx
src/components/auth/ClubLoginForm.tsx
src/components/auth/AuditorLoginView.tsx
src/lib/clubLoginSession.ts
src/lib/schoolLoginSession.ts
src/lib/currentAuditor.ts
```

### 14.4 クラブ UI

```
src/components/layout/Sidebar.tsx
src/app/club/dashboard/page.tsx
src/lib/clubReceiptStats.ts
src/lib/clubPortalData.ts
```

### 14.5 関連ドキュメント（参照用・本書が正本）

- `docs/spec.md` — 会計詳細 v2.8
- `docs/system_spec.md` — セッション・ワークフロー v3.0
- `docs/LATEST_SYSTEM_SPEC.md` — 2026-05 スナップショット
- `docs/settlement-spec.md` — 決算ページ早期仕様
- `docs/specifications/school_onboarding_spec.md`
- `docs/specifications/club_portal_message_box.md`

---

## 15. 改訂履歴

| 版 | 日付 | 内容 |
|----|------|------|
| **2.0** | 2026-05-29 | 全システム統合グランドマスター初版。3段ヘッダー、決算双六UI・全域ロック、監査人ダッシュボード連動を確定記載。全ルート・ストレージ・復元索引を網羅。 |
| 1.x | — | 分散仕様（`spec.md`, `system_spec.md` 等）を統合前の個別版 |

---

*本書 `docs/system-grand-spec.md` Ver 2.0 が、クラサポ会計システム復元の唯一のグランドマスター正本である。*

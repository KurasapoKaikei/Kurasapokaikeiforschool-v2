# クラサポ会計 — 最新システム仕様書（実装ベース）

> **直近の仕様変更（2026-06-20 以降）** は `docs/spec_latest.md` を正本として参照してください（コピー機能、一覧ソート、クラブ設定、ヘッダー表記など）。

| 項目 | 内容 |
|------|------|
| ドキュメント版 | 2026-05 時点のフロントエンド実装に準拠（詳細は `spec_latest.md` で追記） |
| 対象リポジトリ | `kurasaokaikei`（Next.js App Router） |
| データ永続化（デモ） | ブラウザ `localStorage` 中心 |

---

## 1. システム概要

本システムは、大学・学校の部活動（クラブ）会計を、**学校管理者**・**クラブ（部活動）**・**監査人**の三者で運用する Web アプリケーションです。現行デモはサーバー DB ではなく、クライアント側ストレージと React コンポーネントで業務フローを再現しています。

### 1.1 三つのポータルと役割

| ポータル | ベース URL | 主な利用者 | 主な役割 |
|----------|------------|------------|----------|
| **学校管理者ポータル** | `/school` | 学生支援課・部活動統括係など | 全クラブの登録・監視、監査人割当、メッセージ配信、契約・マスタ設定、リアルタイム監査進捗の俯瞰 |
| **クラブポータル** | `/club` | 各部活動の会計担当 | 入出金・帳簿・集金・予実、決算提出、メッセージ受信、証憑（レシート）管理 |
| **監査人ポータル** | `/audit` | 外部・内部監査担当者 | 担当クラブの決算監査（承認・差戻）、クラブ閲覧（なりすまし）、メッセージ |

### 1.2 技術スタック（概要）

- **フレームワーク**: Next.js 14（App Router）
- **UI**: React、Tailwind CSS、共有 UI コンポーネント（`src/components`）
- **状態**: React Context（例: `SchoolClubsContext`, `ClubSessionContext`）、`localStorage` イベント連動
- **ルーティング**: ポータルごとに Layout Gate でログイン画面と App Shell（サイドバー付き）を切り替え

### 1.3 決算ワークフロー（全ポータル共通の正本）

クラブごとの決算・監査状態の**正本**は `localStorage` キー **`club_workflow_status`**（クラブ ID ごと）です。学校側の決算ステータス（`schoolClubSettlement.ts`）と双方向同期されます。

| 内部コード | 画面表示（バッジ） | 色（Tailwind 目安） | 意味 |
|------------|-------------------|---------------------|------|
| `EDITING` | **未提出** | 赤 (`bg-red-50 text-red-700`) | クラブが未提出・編集中 |
| `SUBMITTED` | **監査中** | 緑 (`bg-green-50 text-green-700`) | 提出済み、監査人の審査待ち |
| `REJECTED` | **差戻** | 黄 (`bg-yellow-50 text-yellow-700`) | 監査人が差戻し |
| `APPROVED` | **承認済** | 青 (`bg-blue-50 text-blue-700`) | 監査完了（編集ロック対象） |

定義の単一ソース: `src/lib/clubWorkflowMeta.ts`（`CLUB_WORKFLOW_STATUS_META`）。

更新 API: `setClubWorkflowStatus()`（`src/lib/clubWorkflowStatus.ts`）。変更時に `CLUB_WORKFLOW_CHANGED_EVENT` を発火し、各ダッシュボードがリアルタイム再描画します。

---

## 2. 認証・ログイン仕様

### 2.1 共通 UI：パスワード入力（👁 表示トグル）

コンポーネント: `src/components/ui/password-input.tsx`

| 仕様 | 内容 |
|------|------|
| 初期表示 | `type="password"`（マスク） |
| 👁 ボタン | 右端に配置。クリックで `text` / `password` を切替（`Eye` / `EyeOff` アイコン） |
| `aria-label` | 「パスワードを表示」「パスワードを隠す」 |
| `deferAutofillUntilFocus` | `true` のとき、マウント直後は `readOnly` でブラウザ自動入力の見え方を抑制し、**フォーカス時に入力可能**にする |
| 使用箇所 | 学校ログイン、クラブログイン、監査人ログイン等 |

### 2.2 学校管理者ログイン（`/school/login`）

| 項目 | 内容 |
|------|------|
| 画面コンポーネント | `src/components/auth/SchoolLoginView.tsx` |
| レイアウト | **App Shell なし**（`SchoolLayoutGate` がログイン path のみ子要素をそのまま表示） |
| 初期値 | **ログイン ID・パスワードとも空文字**（`useState("")`） |
| 認証ロジック | `authenticateSchool()`（`src/lib/schoolLoginSession.ts`） |
| 成功時遷移 | `establishSchoolLogin()` → `window.location.assign(SCHOOL_ROUTES.home)`（`/school`） |

**認証ルール（デモ）**

1. ID・パスワード**両方空欄** → 成功（デモ用）
2. `admin` / `admin` → 成功
3. 本登録済み学校の管理者資格（`getActiveRegistrationByCredentials`）→ 成功
4. ログイン ID が `AUD-` で始まる場合 → **監査人ログイン**に振り分け（`establishAuditorLoginById`）→ `/audit` へ遷移

**パスワード欄**: `PasswordInput` + `deferAutofillUntilFocus={true}`。

### 2.3 クラブログイン（`/club/login`）

| 項目 | 内容 |
|------|------|
| 画面 | `src/app/club/login/page.tsx` → `ClubLoginView` → `ClubLoginForm` |
| レイアウト | **App Shell なし**（`ClubLayoutGate` が `/club/login` のみシェル除外） |
| 初期値 | **クラブ ID・パスワードとも空文字** |
| 認証 | `authenticateClub()`（`src/lib/clubLoginSession.ts`） |
| 成功時遷移 | `establishClubLogin()` → `window.location.assign(CLUB_PORTAL_DASHBOARD)`（`/club/dashboard`） |

**認証ルール**

- クラブ ID・パスワードの**いずれかが空** → 失敗（`null` を返す）
- `loadSchoolClubs()` から該当クラブを検索し、登録時の `password` と一致すれば成功
- 成功時は `kurasaokaikei-current-club` にセッション保存し、管理者なりすまし状態を解除

**パスワード欄**: 学校ログインと同様に `PasswordInput` + `deferAutofillUntilFocus`。

### 2.4 監査人ログイン

| 経路 | 内容 |
|------|------|
| 専用画面 | `/audit/login`（`AuditorLoginView`） |
| 学校ログインから | `/school/login` で ID が `AUD-*` の場合に監査人セッション確立 |
| レイアウト | `AuditorLayoutGate`: ログイン path では **サイドバーなし** |
| 保護 | ログイン以外の `/audit/*` は `loadCurrentAuditor()` 必須。未ログイン時は `/audit/login` へ `replace` |

### 2.5 ログイン画面におけるサイドメニュー（Shell）の非表示

| ポータル | 制御コンポーネント | 条件 |
|----------|-------------------|------|
| 学校 | `src/components/layout/school/SchoolLayoutGate.tsx` | `pathname === SCHOOL_ROUTES.login` → 子のみ（`SchoolAppShell` なし） |
| クラブ | `src/components/layout/club/ClubLayoutGate.tsx` | `pathname === clubPath("/login")` → 子のみ（`ClubAppShell` なし） |
| 監査人 | `src/components/layout/audit/AuditorLayoutGate.tsx` | `pathname === AUDIT_ROUTES.login` → 子のみ（`AuditorAppShell` なし） |

ログイン成功後は各 App Shell がサイドバー・ヘッダーを表示します。

---

## 3. 画面構造・レイアウト

### 3.1 クラブポータル — トップ画面（ダッシュボード）

**URL**: `/club/dashboard`  
**実装**: `src/app/club/dashboard/page.tsx`

#### 削除した要素

- **「重要：未処理・エラー通知」** セクションはコードから**完全削除**済み（旧・監査警告件数表示は廃止）。

#### 全体レイアウト

- 上部: `ClubPortalYearBar`（年度切替）
- 本体: 高さ `67vh` の 3 列グリッド（`lg:grid-cols-3`、モバイルは 1 列）

```
┌─────────────────┬─────────────────┬─────────────────┐
│  左列           │  中央列         │  右列           │
│  現在の残高     │  現在の部員数   │  証憑未登録数   │
│  （スクロール） │  （上半分）     │  （上半分）     │
│                 ├─────────────────┼─────────────────┤
│                 │  メッセージBOX  │  決算ステータス │
│                 │  （下半分）     │  （下半分）     │
└─────────────────┴─────────────────┴─────────────────┘
```

#### 左列：現在の残高

- **通常時**: 現金預金内訳・合計のみ（資産・負債・実質残高は非表示）
- **繰延後**: 資産・負債に非ゼロ残高がある場合のみ、該当セクションと実質残高を追加表示
- データ源: `getPortalTransactions`, `getPortalAccountTitles`（`clubPortalData`）
- 科目行クリックで現金預金出納帳へ遷移可能

#### 中央列（上下 2 分割、`flex-1` ずつ）

**上半分 — 現在の部員数**

- 4 学年別人数 + 合計（在籍 `active` のみ）
- データ: `getPortalMembers(activeClub)`

**下半分 — メッセージBOX**

- 最大 **5 件** 表示（`ClubMessageInboxList` の `maxItems={5}`、`variant="compact"`）
- ヘッダーに「一覧はこちら ➔」→ `/club/messages`
- データ: `getPortalMessages(activeClub)`、`PORTAL_MESSAGES_CHANGED_EVENT` で更新

#### 右列（上下 2 分割）

**上半分 — 証憑未登録数**

- コンポーネント: `ClubDashboardVoucherStats`（`src/components/club/ClubDashboardVoucherStats.tsx`）
- 表示形式: **`{未登録} / {証憑必要仕訳数}`**（データ未投入時は `0 / 0`）
- 集計: `computeClubReceiptStats(transactions)`（`src/lib/clubReceiptStats.ts`）
- 「証憑未登録一覧➔」リンク: `/club/accounting/ledger/missing-receipts`

**下半分 — 決算ステータス**

- コンポーネント: `ClubDashboardSettlementSummary`（`src/components/club/ClubDashboardSettlementSummary.tsx`）
- 4 色ルールのステップ進捗（`ClubSettlementProgressSteps`）、スタッキングバー、現在ステータスバッジ（`ClubWorkflowStatusBadge`）
- 通常: `[未提出] → [監査中] → [承認済]`  
  差戻履歴あり: `[未提出] → [監査中] → [差戻] → [監査中(再)] → [承認済]`
- `club_workflow_status` を購読してリアルタイム更新

### 3.2 学校管理者ポータル — トップ（参考）

**URL**: `/school`（`SchoolMypageView`）

- リアルタイム監査状況サマリー（全クラブの 4 色集計）
- 主要機能カード 6 件: クラブダッシュボード、監査人ダッシュボード、クラブ登録、メッセージBOX、契約状況、操作ガイド

### 3.3 監査人ポータル — トップ（参考）

**URL**: `/audit`（`AuditorDashboardView`）

- 担当クラブのカード一覧、ワークフローに応じた承認・差戻（`SUBMITTED` のみ操作可）
- カード表示は **監査ステータスのみ**（「当期の決算提出状況」行は削除済・`spec_latest.md` §7 参照）
- 承認済クラブカードは背景 `bg-gray-50`（文字・ボタンは opacity で落とさない）

### 3.4 なりすまし（閲覧モード）

学校管理者・監査人がクラブ画面を閲覧する際、`ClubImpersonationBanner` が表示され、「ダッシュボードへ戻る」で各ポータルに復帰します（`src/lib/schoolClubSession.ts` の `viewer: "school" | "auditor"`）。

---

## 4. 裏側ロジック — 証憑チェック

| 関数 | 内容 |
|------|------|
| `requiresReceipt(t)` | 証憑必須か。経費 `expense`（振替片側除外）。繰延は未払金・前払費用で出納帳上の出金のみ。収入・振替・集金は不要 |
| `isMissingRequiredReceipt(t)` | 上記かつ `receiptUrl` が空 |
| `getReceiptAlertTone(t)` | 未登録時の色。通常支出＝`red`、繰延＝`yellow` |
| `computeClubReceiptStats(txs)` | `{ missingReceiptCount, totalExpenseEntries }` |

**分母**: 証憑が必要な仕訳数  
**分子**: そのうち `receiptUrl` 未設定の件数  
**表示**: `{分子} / {分母}`（例: `3/10`）

### 4.1 集計ロジック（ダッシュボードと帳簿で共通）

**実装ファイル**: `src/lib/clubReceiptStats.ts`（§4 表参照）

振替判定: `src/utils/localStorage.ts` の `isTransferLeg()`（`transferGroupId` または memo プレフィックス `振替（出金）` / `振替（入金）`）。

### 4.2 帳簿 — 赤／黄アラート

対象画面:

| 画面 | パス | 実装ファイル |
|------|------|----------------|
| 現金預金出納帳 | `/club/accounting/ledger/cash-bank` | `src/app/club/accounting/ledger/cash-bank/page.tsx` |
| 科目別台帳 | `/club/accounting/ledger/subject` | `src/app/club/accounting/ledger/subject/page.tsx` |
| 証憑未登録一覧 | `/club/accounting/ledger/missing-receipts` | `src/components/club/ClubMissingReceiptsView.tsx` |

**ハイライト条件**

- データ行（合計行・期首行を除く）について、`getReceiptAlertTone(tx)` が非 null のとき証憑セルを着色
  - `red` → 背景 `#FEE2E2`、「未登録」（赤文字）— 通常の経費支出
  - `yellow` → 背景 `#FEF3C7`、「未登録」（黄文字）— 繰延の未払金・前払費用による出金

**除外（証憑列は「ー」、アラートなし）**

- 収入・振替・集金
- 繰延のうち未収入金・預り金など、未払金・前払費用の出金以外

### 4.3 データ連動

- 取引データ: クラブごとの `localStorage`（`getTransactions()` 等、`utils/localStorage.ts`）
- ダッシュボードは `loadPortalData` と `storage` イベントで取引・メッセージを再読込
- 帳簿画面は取引の追加・編集・削除後にテーブル再描画

---

## 5. 主要ルート一覧（クイックリファレンス）

### 学校管理者（`/school`）

| パス | 画面 |
|------|------|
| `/school/login` | ログイン |
| `/school` | 管理者トップ |
| `/school/clubs` | クラブダッシュボード（カード一覧） |
| `/school/clubs/auditors` | 監査人ダッシュボード |
| `/school/messages` | メッセージBOX |

### クラブ（`/club`）

| パス | 画面 |
|------|------|
| `/club/login` | ログイン |
| `/club/dashboard` | トップ（3 列ダッシュボード） |
| `/club/settlement` | 決算提出 |
| `/club/accounting/ledger/cash-bank` | 現金預金出納帳 |
| `/club/accounting/ledger/subject` | 科目別台帳 |
| `/club/accounting/ledger/missing-receipts` | 証憑未登録一覧 |
| `/club/messages` | メッセージBOX 一覧 |

### 監査人（`/audit`）

| パス | 画面 |
|------|------|
| `/audit/login` | ログイン |
| `/audit` | 担当クラブ一覧 |
| `/audit/clubs/[clubId]` | クラブ監査詳細 |

---

## 6. 主要 localStorage キー（デモ）

| キー | 用途 |
|------|------|
| `club_workflow_status` | クラブ別決算ワークフロー正本 |
| `kurasaokaikei-school-admin-session` | 学校管理者ログインセッション |
| `kurasaokaikei-current-club` | クラブログインセッション |
| `kurasaokaikei-school-clubs` | 登録クラブマスタ |
| `school_auditors` | 監査人マスタ |
| 取引・科目等 | `utils/localStorage.ts` 内のクラブスコープキー |

---

## 7. 関連ソースファイル索引

| 領域 | パス |
|------|------|
| ワークフロー定義 | `src/lib/clubWorkflowMeta.ts` |
| ワークフロー永続化 | `src/lib/clubWorkflowStatus.ts` |
| 証憑集計 | `src/lib/clubReceiptStats.ts` |
| クラブダッシュボード | `src/app/club/dashboard/page.tsx` |
| 決算ステータス UI | `src/components/club/ClubDashboardSettlementSummary.tsx` |
| 証憑未登録 UI | `src/components/club/ClubDashboardVoucherStats.tsx` |
| 証憑未登録一覧 | `src/components/club/ClubMissingReceiptsView.tsx` |
| 学校ログイン | `src/components/auth/SchoolLoginView.tsx` |
| クラブログイン | `src/components/auth/ClubLoginForm.tsx` |
| パスワード入力 | `src/components/ui/password-input.tsx` |
| クラブ Layout Gate | `src/components/layout/club/ClubLayoutGate.tsx` |
| 学校 Layout Gate | `src/components/layout/school/SchoolLayoutGate.tsx` |

---

## 8. 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-05 | 初版: ログイン空欄化・Shell 非表示、クラブ 3 列ダッシュボード、証憑 0/0・帳簿赤ハイライト、4 色ワークフロー統一を反映 |

---

*本書は `docs/spec.md` 等の旧ドキュメントより**現行 UI 実装を優先**したスナップショットです。差異がある場合はソースコードを正とします。*

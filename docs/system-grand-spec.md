# クラサポ会計 for school — システム全体総合仕様書（グランドスペック）

| 項目 | 内容 |
|------|------|
| **文書名** | クラサポ会計 for school 全システム統合グランドマスター仕様書 |
| **版** | **3.0.0**（学校トップ 1:1 グリッド・監査進捗サマリー UI 統一・クラブ 3 列ダッシュボード刷新版） |
| **改訂日** | 2026年6月10日 |
| **対象リポジトリ** | `kurasaokaikei`（Next.js 14 App Router） |
| **正本の優先順位** | 本書 → ソースコード → その他 `docs/*.md` |

本書は、システムが完全に損壊した場合でも **ゼロから同一システムを 100% 復元できる** ことを目的とした、設計・UI・データ・コンポーネントの **シングル・オブ・ソース（最高位設計図）** である。学校管理者・監査人・クラブ・部員の四層構造、決算監査ワークフロー、localStorage 正本、画面レイアウト、コンポーネント対応表を網羅する。

---

## システム全体の組織構造とポータル間連携

### 四層組織構造

本システムは、次の **4 つの階層** からなるプラットフォームである。上位から下位へ、契約・統制、学内横断ルール、現場会計実務、個人部費の閲覧・申請が重なる。

| 階層 | 主体 | ポータル URL | 権限の要点 |
|------|------|--------------|------------|
| **第1層 学校管理者** | 契約主体・学内統括 | `/school` | 全クラブ・全監査人の統括、契約、共通マスタ配布、最終ロック |
| **第2層 監査人** | 外部/内部監査担当 | `/audit` | 担当クラブ（複数可）の査読、承認/差戻、メッセージ、閲覧のみ |
| **第3層 クラブ** | 部活動会計実務 | `/club` | 入出金・帳簿・集金・予実・決算提出・証憑管理（自クラブのみ） |
| **第4層 部員** | 個人利用者 | `/member`（将来） | 部費納入状況確認、入退部・精算申請ワークフロー（デモ: 準備中） |

**ID の与え方**: 学校 → クラブ → 部員（保護者連携）の順に識別子を発行。各層は独立ログイン・独立セッションを持ち、他層のデータ領域には同一鍵では入れない。

### ポータル間連携（決算監査フロー）

```
[クラブ] 決算データ提出
    ↓ is_club_settlement_locked_{clubId} = "true"
    ↓ club_auditor_audit_status_{clubId} = "in_review"
[監査人] 査読 → 承認 or 差戻
    ↓ 承認: approved + ロック維持
    ↓ 差戻: rejected + ロック解除
[学校管理者] 全校俯瞰（監査進捗サマリー）・最終完全ロック（承認済年度）
```

**ポータル間セッション分離**（`src/lib/portalSessionStorage.ts`）:
- 監査人ログイン時に学校/クラブの localStorage を削除しない
- なりすまし閲覧時に `clearCurrentClub()` を呼ばない
- ログアウトは当該ポータルキーのみ削除（`localStorage.clear()` 禁止）

### 共通データモデル：4 つの監査ステータス（厳密定義）

全ポータルで表示名称・色・集計バケットを統一する。**旧称「作成中」「提出済」は廃止**。

| 内部バケット | 表示名称 | localStorage 正本の判定 | クラブ側データロック | 意味 |
|--------------|----------|------------------------|---------------------|------|
| **`preparing`** | **未提出** | `club_auditor_audit_status` が `not_started`（または未設定）かつ `is_club_settlement_locked` が `false` | なし | クラブが編集・提出可能 |
| **`in_audit`** | **監査中** | ロック `true` または監査状態 `in_review` | **一次ロック**（入出金・集金・予実・設定等の書き込み不可） | 提出済み、監査人審査中 |
| **`rejected`** | **差戻し** | 監査状態 `rejected`（ロックは `false`） | 解除（修正・再提出可能） | 監査人コメント付きでクラブへ通知（メッセージ BOX 経由） |
| **`approved`** | **承認済** | 監査状態 `approved`（ロック `true` 維持） | **監査完了ロック**（学校管理者が年度単位で最終完全ロック） | 監査人承認済。編集原則禁止 |

**分類関数（正本）**: `classifyClubAuditProgress(clubId)` / `classifyFromState(auditStatus, locked)` — `src/lib/schoolAuditProgressSummary.ts`

**localStorage キー（クラブ ID 末尾で完全分離）**:

| キー | 値 | 用途 |
|------|-----|------|
| `is_club_settlement_locked_{clubId}` | `"true"` / `"false"` | 一次ロック・「監査中」表示 |
| `club_auditor_audit_status_{clubId}` | `not_started` / `in_review` / `approved` / `rejected` | 監査バッジ・承認/差戻ボタン活性 |
| `club_settlement_history_flow_{clubId}` | `{ steps, currentIndex }` | 双六 UI 履歴 |
| `kurasaokaikei-school-club-settlement-status` | 学校側決算マップ | 学校ポータル一覧バッジ |

**4 色バッジパレット**（`src/lib/clubSettlementPortalSync.ts`）:

| ステータス | Tailwind クラス定数 |
|------------|---------------------|
| 未提出 | `SETTLEMENT_NOT_SUBMITTED_BADGE_CLASSES` — 赤 |
| 監査中 | `SETTLEMENT_IN_AUDIT_BADGE_CLASSES` — 緑 |
| 差戻し | `SETTLEMENT_REJECTED_BADGE_CLASSES` — 黄（amber） |
| 承認済 | `AUDITOR_APPROVED_BADGE_CLASSES` — 青 |

**変更通知イベント**: `CLUB_SETTLEMENT_LOCK_CHANGED_EVENT` / `CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT` / `SETTLEMENT_CHANGED_EVENT`

---

## 各ポータルの主要役割と画面・機能要件

### 学校管理者ポータル（`/school`）

| 項目 | 内容 |
|------|------|
| **利用者** | 学生支援課・部活動統括係など |
| **テーマカラー** | ネイビー `#172554` / `#005088` |
| **主な役割** | 全クラブ・監査人の統括、契約状況管理、共通マスタ、メッセージ配信、監査進捗俯瞰 |

**主要画面**:

| パス | 画面 | コンポーネント |
|------|------|----------------|
| `/school` | トップ（SchoolTopView） | `SchoolMypageView` |
| `/school/clubs` | クラブダッシュボード（決算状況一覧） | `SchoolClubDashboardListSection` |
| `/school/clubs/register` | クラブ登録 | `SchoolClubRegisterView` |
| `/school/clubs/groups` | グループ作成 | — |
| `/school/clubs/auditors` | 監査人ダッシュボード | `SchoolAuditorsListView` |
| `/school/clubs/auditors/register` | 監査人登録 | `SchoolAuditorsRegisterView` |
| `/school/messages` | メッセージ BOX | — |
| `/school/contract` | 契約状況詳細 | `SchoolContractView` |
| `/school/settings/*` | 共通マスタ・監査運用設定 | — |

**契約管理**: 契約プラン、オプション、金額、支払いサイクル（年払い/月払い）、お支払い日、お支払方法。デモデータ: `SCHOOL_CONTRACT_DEMO`（`src/lib/schoolTheme.ts`）、表示: `getSchoolContractDisplay()`。

### 監査人ポータル（`/audit`）

| 項目 | 内容 |
|------|------|
| **利用者** | 学校登録の監査担当者（ID: `AUD-0001` 形式） |
| **テーマカラー** | オレンジ `#ff9800` |
| **主な役割** | 担当クラブ（`assignedClubIds` 複数可）の査読、差戻/承認、メッセージ、クラブ閲覧（なりすまし） |

**操作制限**:
- `canAuditorActOnSettlement(clubId)` ≡ ロック `true` かつ `in_review` のときのみ承認・差戻活性
- 入出金・設定の直接編集は不可（閲覧のみ）

**主要画面**: `/audit`（`AuditorDashboardView`）、`/audit/clubs/[clubId]`（`AuditorClubReviewView`）、`/audit/messages`

### クラブポータル（`/club`）

| 項目 | 内容 |
|------|------|
| **利用者** | 各部活動の会計担当 |
| **テーマカラー** | くすみピンク `#E66A84`（`CLUB_BRAND_PINK`） |
| **主な役割** | 決算書作成、証憑アップロード、提出・修正、入出金・帳簿・集金・予実 |

**証憑未登録数の定義**（厳密）:
- **分母**: 全支出仕訳数（振替片側 `isTransferLeg` は除外）
- **分子**: 分母のうち `receiptUrl` 未設定の件数
- **表示形式**: `{未登録} / {全支出仕訳数}`（例: `0/0`）
- **集計**: `computeClubReceiptStats()` — `src/lib/clubReceiptStats.ts`
- **帳簿連動**: 未登録行は科目別台帳・現金預金出納帳で **赤強調**（`bg-red-50 text-red-600`）

**ロック対象機能**（監査中）: ダッシュボード、入出金登録、集計・帳簿、集金管理、予実管理、設定 — `SettlementLockAlert` + 全書き込みボタン `disabled`

### 部員マイページ（`/member`）

| 項目 | 内容 |
|------|------|
| **現状** | デモ準備中（ログインハブからモーダル表示） |
| **目標機能** | 個人部費の納入ステータス確認、入退部・精算申請ワークフロー |
| **将来** | 保護者トークン URL（`/parent/view?token=...`）との連携 — §14 参照 |

---

## 【最新】学校管理者ポータル・トップ画面（SchoolTopView）のレイアウト仕様

**URL**: `/school`  
**実装**: `src/components/school/SchoolMypageView.tsx`（別名 **SchoolTopView**）  
**年度**: 現在年度（`DEFAULT_PORTAL_FISCAL_YEAR`）のみ表示。過去年度はプレースホルダ。

### 画面構成（上から下）

#### 1. 監査進捗サマリー（全幅）

コンポーネント: `SchoolAuditProgressSummary` — §「監査進捗サマリー共通 UI」参照。

#### 2. メインメニュー（1:1 グリッド）

**グリッドクラス（必須）**:

```html
<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
```

| 領域 | 幅（lg 以上） | 内容 |
|------|---------------|------|
| **左半分（50%）** | `lg:grid-cols-2` の第1列 | 3 等分メニューカード（縦一列） |
| **右半分（50%）** | 第2列 | 契約状況カード（`h-full` で左と高さ同期） |

### 【右半分（50%幅）】契約状況カード

**コンポーネント**: `SchoolContractStatusSummaryCard`（`src/components/school/SchoolContractStatusSummaryCard.tsx`）

| 仕様 | 値 |
|------|-----|
| 高さ | `h-full min-h-0 flex flex-col` — 左側 3 等分コンテナと **完全同期** |
| 左アクセント | ネイビー 5px 縦線（`SCHOOL_THEME.navy`） |
| ヘッダー | 「契約状況」+ 「詳細を見る」→ `/school/contract` |

**表示項目**（縦等間隔 `flex-1 flex-col` + 各 `DataRow` が `flex-1 justify-center`）:

1. 契約プラン
2. オプション
3. 金額
4. 支払いサイクル（年払い / 月払い）
5. お支払い日
6. お支払方法

### 【左半分（50%幅）】3 等分メニューカード

右側契約状況の縦幅を **ぴったり 3 等分** した等高コンテナ。

**コンテナクラス**（監査フロー有効時・3 枚）:

```html
<div class="flex min-h-0 flex-col gap-4 lg:grid lg:h-full lg:grid-rows-3">
```

**配置順（上→下）**:

| 順 | カード | 遷移先 | アクセント色 | 条件 |
|----|--------|--------|--------------|------|
| 1 | **監査人ダッシュボード** | `/school/clubs/auditors` | オレンジ `#ea580c` | 監査フロー有効時のみ |
| 2 | **クラブダッシュボード** | `/school/clubs` | ネイビー | 常時 |
| 3 | **メッセージBOX** | `/school/messages` | 青 `#2563eb` | 常時 |

監査フロー無効時（`loadSchoolUseAuditFlow() === false`）は 2 枚（クラブ + メッセージ）で `lg:grid-rows-2`。

**カード共通**: `PortalMenuCard` — 白背景、`rounded-xl`、`border-left` 5px、`h-full min-h-0`。

---

## 各ダッシュボード内における「監査進捗サマリー」の共通 UI 仕様

### タイトル

- **正式名称**: 「**監査進捗サマリー**」
- **禁止**: タイトルに「リアルタイム」等の修飾語を付けない（旧仕様から削除済み）
- 補助説明文（小さく）: 「学内全クラブの決算提出・監査ステータス（localStorage から自動集計）」

### 適用箇所

| 画面 | コンポーネント | 集計対象 |
|------|----------------|----------|
| 学校トップ | `SchoolAuditProgressSummary` | 全登録クラブ |
| 監査人カード内 | `AuditorAssignedClubProgressSummary` | 担当クラブのみ |
| 監査人ポータル | 各 `AuditorClubDashboardCard` のバッジ | 個別クラブ |

### ステータス表示形式（学校トップ・4 列グリッド）

各ステータスセル（`items-start` 左寄せ）:

1. **ステータス名**: 共通コンパーネント `SettlementAuditStatusBadge`（`src/components/school/SettlementAuditStatusBadge.tsx`）
   - **3 文字幅に引き締めたコンパクトバッジ**: `w-16 shrink-0 rounded-full text-xs`
   - クラブ/監査人ダッシュボードと **100% 同一デザイン**
   - 配置: セル内 **左寄せ**（`flex flex-col items-start`）

2. **件数（クラブ数）**: バッジの **外側・下** に配置
   - フォント: **`text-3xl font-extrabold`（sm 以上で `text-4xl`）**
   - 単位「クラブ」: `text-lg sm:text-xl text-[#9CA3AF]`
   - 色: ステータス別（赤/緑/黄/青）

3. **プログレスバー**: 各セル下部、総クラブ数に対する比率

**並び順（左→右）**: 未提出（赤）→ 監査中（緑）→ 差戻し（黄）→ 承認済（青）

**総クラブ数**: ヘッダー右端、`text-3xl font-extrabold`

### データ同期仕様

`localStorage` から各クラブの最新監査状態を **Event Listener** で購読し、**画面リロードなし** でカウント数とカラーバーを自動集計・完全同期する。

**購読イベント**（`SchoolAuditProgressSummary`）:
- `CLUB_SETTLEMENT_LOCK_CHANGED_EVENT`
- `CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT`
- `SETTLEMENT_CHANGED_EVENT`
- `storage`（キーが `is_club_settlement_locked_*` / `club_auditor_audit_status_*`）
- `focus` / `visibilitychange`（visible 時）

**集計 API**: `aggregateSchoolAuditProgress(clubIds)` — `src/lib/schoolAuditProgressSummary.ts`

---

## 【最新】クラブポータル・トップ画面のレイアウト仕様

**URL**: `/club/dashboard`  
**実装**: `src/app/club/dashboard/page.tsx`

### 削除した要素

- **「重要：未処理・エラー通知」** セクション — **完全削除**（コードから除去済み）

### 全体レイアウト

| 要素 | 仕様 |
|------|------|
| 上部 | `SettlementLockAlert`（監査中のみ赤警告） |
| 本体高さ | `h-[67vh] max-h-[67vh]`（サイドバーには適用しない） |
| グリッド | `grid grid-cols-1 gap-6 lg:grid-cols-3`（3 列） |

```
┌─────────────────┬─────────────────┬─────────────────┐
│  左列           │  中央列         │  右列           │
│  現在の残高     │  メッセージBOX  │  決算ステータス │
│  （スクロール） │  （上半分）     │  （上半分）     │
│                 ├─────────────────┼─────────────────┤
│                 │  現在の部員数   │  証憑未登録数   │
│                 │  （下半分）     │  （下半分）     │
└─────────────────┴─────────────────┴─────────────────┘
```

### 左列：現在の残高（従来維持）

- 現金預金内訳・合計、入る予定（資産）、支払う予定（負債）、実質残高（次期繰越金）
- データ: `getPortalTransactions`, `getPortalAccountTitles`
- 左縦線: ピンク `#E66A84`
- 科目行クリック → 現金預金出納帳

### 中央列（上下 2 分割、`flex-1` ずつ）

#### 上段 — メッセージBOX（縦幅を従来の半分に縮小）

- `ClubMessageInboxList` — `maxItems={5}`, `variant="compact"`
- 「一覧はこちら ➔」→ `/club/messages`
- 左縦線: 青 `#4A90E2`

#### 下段 — 現在の部員数（新設）

- 4 学年別人数 + 合計（在籍 `active` のみ）
- データ: `getPortalMembers(activeClub)`
- 左縦線: 紫 `#9D8CC3`

### 右列（上下 2 分割）

#### 上段 — 決算ステータス

- `ClubDashboardSettlementSummary`
- 双六 UI（`ClubSettlementProgressSteps`）、スタッキングバー、現在ステータスバッジ
- 通常: `[未提出] → [監査中] → [承認済]`
- 差戻履歴あり: `[未提出] → [監査中] → [差戻] → [監査中(再)] → [承認済]`

#### 下段 — 証憑未登録数

- `ClubDashboardVoucherStats`
- 表示: **`{未登録} / {全支出仕訳数}`**（未投入時 `0/0`）
- 現金預金出納帳データと連動（同一 `transactions` ソース）
- 「出納帳へ ➔」→ `/club/accounting/ledger/cash-bank`
- 左縦線: 赤 `#EF4444`

---

## 技術スタックとプロジェクト構造

### 技術スタック

| 項目 | 版/内容 |
|------|---------|
| フレームワーク | Next.js **14.0.4**（App Router） |
| UI | React 18、Tailwind CSS 3、Radix UI、lucide-react |
| 型 | TypeScript 5 |
| ORM（本番目標） | Prisma 5 + PostgreSQL |
| デモ永続化 | ブラウザ `localStorage` + React Context |

### ディレクトリ構造（復元用）

```
kurasaokaikei/
├── docs/
│   └── system-grand-spec.md      ← 本書（正本）
├── prisma/
│   └── schema.prisma             ← DB スキーマ（本番目標）
├── src/
│   ├── app/                      ← Next.js ページ（ルート = URL）
│   │   ├── page.tsx              ← 統合ログインハブ /
│   │   ├── school/               ← 学校管理者ポータル
│   │   ├── club/                 ← クラブポータル
│   │   ├── audit/                ← 監査人ポータル
│   │   ├── member/               ← 部員（準備中）
│   │   └── (parent)/             ← 保護者（将来）
│   ├── components/
│   │   ├── auth/                 ← ログイン UI
│   │   ├── school/               ← 学校ポータル UI
│   │   ├── club/                 ← クラブポータル UI
│   │   ├── audit/                ← 監査人ポータル UI
│   │   ├── layout/               ← App Shell・ヘッダー・サイドバー
│   │   ├── shared/               ← 共通 UI
│   │   └── ui/                   ← shadcn 系プリミティブ
│   ├── contexts/                 ← React Context（ClubSession, SchoolClubs 等）
│   ├── hooks/                    ← useClubSettlementLock 等
│   ├── lib/                      ← ビジネスロジック・永続化 API
│   ├── services/                 ← ドメインサービス
│   ├── utils/                    ← localStorage 取引・科目ユーティリティ
│   └── types/                    ← 共有型
└── scripts/
    └── list-routes.js            ← 全 URL 一覧出力
```

### コンポーネント階層（App Shell）

| ポータル | Layout Gate | App Shell | Header | Sidebar |
|----------|-------------|-----------|--------|---------|
| 学校 | `SchoolLayoutGate` | `SchoolAppShell` | `SchoolHeader` → `PortalUnifiedHeader` | `SchoolSidebar` |
| クラブ | `ClubLayoutGate` | `ClubAppShell` | `ClubPortalHeader` | `Sidebar` |
| 監査人 | `AuditorLayoutGate` | `AuditorAppShell` | `AuditorHeader` | `AuditorSidebar` |

**ログイン画面**: 各 Gate が login path のみ Shell を除外（サイドバーなし）。

---

## 画面共通ヘッダー（統一 3 段構造）

全ポータル（学校・クラブ・監査人）の画面上部に **sticky 3 段ヘッダー** を固定配置。

### 第1段：学校環境（コンテキスト層）

- 左: 学校名（`text-xl font-bold` 2倍強調）+ 会計期間インライン
- 背景: 薄グレー/白

### 第2段：ポータル・アイデンティティ帯

| ポータル | 背景色 | 表示名 |
|----------|--------|--------|
| 学校管理者 | ネイビー `#001e43` | 学校管理者ポータル |
| 監査人 | オレンジ `#ff9800` | 監査人ポータル |
| クラブ | くすみピンク `#E66A84` | `{クラブ名}ポータル` |

右側: 会計期間テキスト + ログアウトボタン（白枠・白文字）  
**ログアウト**: セッションクリア → `/`（統合ログインハブ）へリダイレクト

### 第3段：年度切替

- ラベル「年度切替:」+ pill 型年度ボタン（2024/2025/2026）
- 選択中年度をポータルテーマ色でハイライト

---

## 認証・セッション・ログイン

### 統合ログインハブ（`/`）

`LoginHubView` — 3 大型カード: 学校（ネイビー）/ クラブ（ピンク）/ 部員（グレー・準備中モーダル）

### 学校ログイン（`/school/login`）

- デモ: ID/PW 空欄 or `admin`/`admin` → 成功
- 成功: `kurasaokaikei-school-admin-session` → `/school`
- ID が `AUD-*` → 監査人へ振り分け

### クラブログイン（`/club/login`）

- 学校登録クラブ ID + パスワード照合（`kurasaokaikei-school-clubs`）
- 成功: `kurasaokaikei-current-club` → `/club/dashboard`
- **セッション固定化**: リロード時デフォルトクラブへフォールバック禁止

### 監査人ログイン（`/audit/login`）

- セッション: `auditor_current_session`
- 未ログイン `/audit/*` → `/audit/login` へ replace

### なりすまし（閲覧モード）

| 操作者 | バナー | sessionStorage キー | 戻り先 |
|--------|--------|---------------------|--------|
| 学校管理者 | `ClubImpersonationBanner` | `kurasaokaikei-school-impersonate-club` | `/school/clubs` |
| 監査人 | 同上（監査人閲覧モード） | `club_portal_impersonation` | `/audit` |

---

## 決算提出フローと全域ロック機構

### クラブ決算ページ（`/club/settlement`）

`ClubSettlementView` — 縦並び:
1. 小タイトル「決算」
2. 担当監査人カード（`bg-gray-50 rounded-xl`）
3. 決算ステータスカード（双六 UI + 「メッセージBOXへ ➔」）
4. 提出ボタン（ロック時「決算データ提出済み（監査中）」disabled）

### 提出時（`applyClubSettlementSubmit`）

1. `is_club_settlement_locked_{clubId} = "true"`
2. `club_auditor_audit_status_{clubId} = "in_review"`
3. 双六 UI を「監査中」へ
4. 学校側決算マップを `submitted` に同期

### 監査人承認（`auditorApproveSettlement`）

1. 監査状態 → `approved`
2. ロック **`true` 維持**（編集不可継続）
3. 双六 → 承認済
4. カード背景 `bg-gray-50`（opacity 減衰なし）

### 監査人差戻（`auditorRejectSettlement`）

1. 監査状態 → `rejected`
2. ロック → **`false`**（編集再開）
3. 双六に差戻し履歴追加
4. 理由はメッセージ BOX 経由（自動投稿はデモでは任意）

### ロック時の UI 制限

- 赤警告 `SettlementLockAlert`: 「当年度の決算は**監査中**のため…」
- 全書き込みボタン `disabled={isLocked}`

---

## 監査人ポータル詳細

### 監査人マスタ

- キー: `school_auditors`（イベント: `kurasaokaikei-school-auditors-changed`）
- ID: `AUD-` + 4桁、`assignedClubIds: string[]`
- 登録: `/school/clubs/auditors/register`

### ダッシュボードカード（`AuditorClubDashboardCard`）

**下部 3 ボタン（2:1:1 = 50%:25%:25%）**:

| 位置 | ラベル | 活性 |
|------|--------|------|
| 左 50% | クラブページへ（ピンク） | 常時 |
| 中 25% | 承認（青） | `canReview` のみ |
| 右 25% | 差戻（黄） | `canReview` のみ |

### 学校ポータル監査人カード（`SchoolAuditorDashboardCard`）

5 段レイアウト: ヘッダー / 基本情報 / 監査進捗サマリー（ミニ 4 列）/ 担当クラブチップ / フッター操作

---

## 証憑管理（クラブ）

### 集計（`clubReceiptStats.ts`）

```typescript
// 対象: type === "expense" && !isTransferLeg(t)
// 未登録: receiptUrl が空
computeClubReceiptStats(transactions) → { missingReceiptCount, totalExpenseEntries }
```

### 帳簿赤ハイライト

| 画面 | パス |
|------|------|
| 現金預金出納帳 | `/club/accounting/ledger/cash-bank` |
| 科目別台帳 | `/club/accounting/ledger/subject` |

条件: `isExpenseMissingReceipt(row.transaction)` → `bg-red-50 text-red-600` + 証憑列「未登録」

---

## localStorage キー一覧（デモ正本）

| キー | 用途 |
|------|------|
| `kurasaokaikei-school-admin-session` | 学校管理者セッション |
| `kurasaokaikei-current-club` | クラブログインセッション |
| `kurasaokaikei-last-active-club-session` | クラブセッション復元 |
| `kurasaokaikei-school-clubs` | 登録クラブマスタ |
| `school_auditors` | 監査人マスタ |
| `auditor_current_session` | 監査人セッション |
| `is_club_settlement_locked_{clubId}` | 決算一次ロック |
| `club_auditor_audit_status_{clubId}` | 監査ステータス |
| `club_settlement_history_flow_{clubId}` | 双六 UI 履歴 |
| `kurasaokaikei-school-club-settlement-status` | 学校側決算マップ |
| `club_workflow_status` | ワークフロー正本（クラブ ID 別、LATEST_SYSTEM_SPEC 参照） |
| 取引・科目・部員 | `src/utils/localStorage.ts` 内クラブスコープキー |

**原則**: 状態キーは必ず `_{clubId}` 末尾で完全分離。グローバル共有禁止。

---

## 全ルート一覧（復元用）

### 学校管理者 `/school`

| パス | 画面 |
|------|------|
| `/school/login` | ログイン |
| `/school` | トップ（SchoolTopView） |
| `/school/clubs` | クラブダッシュボード |
| `/school/clubs/register` | クラブ登録 |
| `/school/clubs/groups` | グループ作成 |
| `/school/clubs/auditors` | 監査人ダッシュボード |
| `/school/clubs/auditors/register` | 監査人登録 |
| `/school/clubs/[clubId]/messages` | クラブ個別メッセージ |
| `/school/messages` | メッセージ BOX |
| `/school/messages/drafts` | 下書き |
| `/school/contract` | 契約状況 |
| `/school/settings/category` | 共通カテゴリー |
| `/school/settings/account-titles` | 共通科目 |
| `/school/settings/staff` | 担当者設定 |
| `/school/settings/audit-flow` | 監査運用設定 |
| `/school/guide` | 操作ガイド |

### クラブ `/club`

| パス | 画面 |
|------|------|
| `/club/login` | ログイン |
| `/club/dashboard` | **トップ（3 列ダッシュボード）** |
| `/club/settlement` | 決算提出 |
| `/club/accounting/*` | 入出金・帳簿・集計 |
| `/club/accounting/ledger/cash-bank` | 現金預金出納帳 |
| `/club/accounting/ledger/subject` | 科目別台帳 |
| `/club/collection/*` | 集金管理 |
| `/club/budget/*` | 予実管理 |
| `/club/members/*` | 部員管理 |
| `/club/messages` | メッセージ BOX |
| `/club/settings/*` | 設定 |
| `/club/guide` | 操作ガイド |

### 監査人 `/audit`

| パス | 画面 |
|------|------|
| `/audit/login` | ログイン |
| `/audit` | 担当クラブ一覧 |
| `/audit/clubs/[clubId]` | 監査詳細 |
| `/audit/messages` | メッセージ BOX |
| `/audit/messages/drafts` | 下書き |
| `/audit/guide` | 操作ガイド |

### その他

| パス | 画面 |
|------|------|
| `/` | 統合ログインハブ |
| `/member` | 部員（準備中） |
| `/parent` | 保護者（準備中） |
| `/register/school` | 学校申込 |

---

## 主要ソースファイル索引（コンポーネント対応表）

| 領域 | ファイル |
|------|----------|
| 学校トップ | `src/components/school/SchoolMypageView.tsx` |
| 監査進捗サマリー | `src/components/school/SchoolAuditProgressSummary.tsx` |
| 共通ステータスバッジ | `src/components/school/SettlementAuditStatusBadge.tsx` |
| 契約状況カード | `src/components/school/SchoolContractStatusSummaryCard.tsx` |
| 監査集計 | `src/lib/schoolAuditProgressSummary.ts` |
| 決算同期正本 | `src/lib/clubSettlementPortalSync.ts` |
| クラブダッシュボード | `src/app/club/dashboard/page.tsx` |
| 決算ステータス UI | `src/components/club/ClubDashboardSettlementSummary.tsx` |
| 証憑未登録 UI | `src/components/club/ClubDashboardVoucherStats.tsx` |
| 証憑集計 | `src/lib/clubReceiptStats.ts` |
| 監査人ダッシュボード | `src/components/audit/AuditorDashboardView.tsx` |
| 監査人カード | `src/components/audit/AuditorClubDashboardCard.tsx` |
| 学校監査人カード | `src/components/school/SchoolAuditorDashboardCard.tsx` |
| 監査人担当サマリー | `src/components/school/AuditorAssignedClubProgressSummary.tsx` |
| 統合ヘッダー | `src/components/layout/PortalUnifiedHeader.tsx` |
| 学校テーマ・ルート | `src/lib/schoolTheme.ts` |
| 取引 localStorage | `src/utils/localStorage.ts` |
| Prisma スキーマ | `prisma/schema.prisma` |

---

## 勘定科目マスタと配布（概要）

- **学校マスタ**: `/school/settings/category`, `/school/settings/account-titles`
- **クラブ実務**: `/club/settings/*`
- **グループ**: 現金預金 / 資産 / 負債 / 収入 / 支出
- **繰延固定 4 科目**: 未収入金、仮払金、未払金、仮受金
- for school 契約: 学校配布科目はクラブが削除・改名不可

---

## 保護者・部員（将来拡張）

- 部員登録時に `parentViewToken` 発行（Prisma `Member.parentViewToken`）
- 閲覧 URL: `/parent/view?token={token}` — 自児の集金・納入状況のみ
- 部員マイページ `/member`: 部費納入確認、入退部・精算申請 WF

---

## 開発・復元手順

```bash
# 依存関係
npm install

# 開発サーバー
npm run dev
# → http://localhost:3000

# ルート一覧確認
npm run routes

# DB（本番移行時）
npm run db:generate
npm run db:push
```

**復元チェックリスト**:
1. 本書 §「4 つの監査ステータス」に従い `clubSettlementPortalSync.ts` を実装
2. `SchoolMypageView` の 1:1 グリッド + 3 等分メニュー + 契約カード `h-full`
3. `SchoolAuditProgressSummary` タイトル「監査進捗サマリー」+ `SettlementAuditStatusBadge` + `text-3xl/4xl` 件数
4. `/club/dashboard` 3 列レイアウト、未処理通知なし、証憑 `0/0`
5. 全 Layout Gate でログイン画面 Shell 除外
6. localStorage イベント購読でリアルタイム同期

---

## 改訂履歴

| 版 | 日付 | 内容 |
|----|------|------|
| 2.0 | 2026-05-29 | 3 段ヘッダー・ロック・監査人連動の統合初版 |
| 2.2.0 | 2026-06-01 | 4 色ステータス名称統一、リアルタイム監査進捗サマリー |
| 2.3.0 | 2026-06-05 | 監査人カード UI 刷新、担当クラブ 4 色サマリー |
| **3.0.0** | **2026-06-10** | **学校トップ 1:1 グリッド（SchoolTopView）、監査進捗サマリー共通バッジ UI、クラブ 3 列ダッシュボード（部員数・証憑 0/0）、本書全面刷新による 100% 復元仕様** |

---

*本書は `docs/LATEST_SYSTEM_SPEC.md` および `docs/system_spec.md` より優先する。実装と差異がある場合、本書とソースコードを突合し、本書を更新すること。*

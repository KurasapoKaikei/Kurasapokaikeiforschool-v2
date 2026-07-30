# クラサポ会計 for school 全システム統合グランドマスター仕様書

| 項目 | 内容 |
|------|------|
| **文書名** | クラサポ会計 for school 全システム統合グランドマスター仕様書 |
| **版** | **3.0.0**（最新UI・等高左右50%ダッシュボード・3文字バッジ完全統合版） |
| **改訂日** | 2026年6月10日 |
| **対象リポジトリ** | `kurasaokaikei`（Next.js 14 App Router） |
| **正本の優先順位** | 本書 → ソースコード → その他 `docs/*.md` |

本書は、クラサポ会計における「学校管理者」「クラブ」「監査人」「保護者」のすべての組織階層、役割定義、初期導入、認証、および「ヘッダー3段構造」「全域ロック機構」「監査人連動」「最新ポータルレイアウト」のすべての正解仕様を網羅した、システム全体の最高位設計図（シングル・オブ・ソース）である。システムが完全に損壊した場合でも **ゼロから全く同じシステムを 100% 復元できる** ことを目的とする。

---

## 1. システムコンセプトと組織構造

本システムは、クラサポ会計（運営）、学校、クラブ、保護者の四層からなるプラットフォームである。上から下へ、契約と統制、学内の横断ルール、現場の会計実務、家庭への閲覧と決済が重なり、会計上の誰が何を扱い、何を見るかの境界を一貫して示す。

| 階層 | 主体 | ポータル URL | 権限の要点 |
|------|------|--------------|------------|
| **第1層 クラサポ会計（運営社）** | サービス提供・契約管理 | （バックオフィス・`/register/school` 申込導線） | 契約、料金、提供可否、基盤、サポート、全テナント障害周知 |
| **第2層 学校（管理者ポータル）** | 契約主体・学内統括 | `/school` | 会計年度、クラブ枠、共通科目ルール、承認手順、監査人割当、最終ロック |
| **第3層 クラブ（クラブポータル）** | 部活動会計実務 | `/club/dashboard` | 入出金、予算、部員、集金、帳表、学校への年度報告（自クラブのみ） |
| **第4層 保護者（保護者マイページ）** | 一般利用者 | `/parent`（将来 `/parent/view?token=...`） | 子ども（部員）に紐づく閲覧、納入、お知らせ。他児童・学内全体にはアクセス不可 |

### 1.1 運用ロール：監査人（学校配下の横断役割）

監査人は四層の独立階層ではなく、**学校が登録・割当する外部/内部監査担当**として `/audit` ポータルを持つ。学校管理者が監査人アカウントを発行し担当クラブを紐付け、クラブが決算提出後に査読・承認/差戻を行う。学校トップの「監査人ダッシュボード」カードおよびサイドメニューから管理する。

### 1.2 ID の与え方とセッション分離

上位から下位へ、入場券のように識別子を発行する。

```
運営 → 学校テナント（SCH-XXXXX）
学校 → クラブ（club-XXXX）+ 監査人（AUD-XXXX）
クラブ → 部員登録に伴い保護者閲覧トークン（parentViewToken）
```

各層は独立ログイン・独立セッションを持ち、他層のデータ領域には同一鍵では入れない。

**ポータル間セッション分離の原則**（実装: 各 `clear*()` 関数で個別削除、`localStorage.clear()` 禁止）:

- 監査人ログイン時に学校/クラブの localStorage を削除しない
- なりすまし閲覧時に `clearCurrentClub()` を呼ばない
- ログアウトは当該ポータルキーのみ削除

### 1.3 ポータル間連携（決算監査フロー）

```
[クラブ] 決算データ提出（applyClubSettlementSubmit）
    ↓ is_club_settlement_locked_{clubId} = "true"
    ↓ club_auditor_audit_status_{clubId} = "in_review"
[監査人] 査読 → 承認 or 差戻
    ↓ 承認: approved + ロック維持
    ↓ 差戻: rejected + ロック解除
[学校管理者] 全校俯瞰（監査進捗サマリー）・最終完全ロック（承認済年度）
```

---

## 2. ユーザー別役割と権限定義

### ① クラサポ会計（運営）

- 新規校の導入、契約の有効化、利用停止、全テナントに関わる障害周知
- 学校申込フロー（`/register/school` → `/register/verify?token=...`）の起点
- 一般の大学・部管理者に見えない基盤・バックオフィス的導線

### ② 学校（契約主体）

- 会計年度の一括定義、共通勘定科目マスタの展開、カテゴリー雛形の一括配布
- クラブ枠（何部まで、新部開設、枠の割当、名称・所属の一貫）
- for school 契約: 学校配布科目はクラブが削除・改名不可
- クラブが提出した決算（年度単位）の受付、承認・却下・差戻し
- 承認済年度はデータロックを執行（後追い手直し原則禁止）
- 監査人アカウントの登録・担当クラブ割当
- 全クラブの決算状況俯瞰、メッセージ配信、契約状況管理

### ③ クラブ（実務主体）

- 日々の入出金、証憑、帳簿、予算と実績、部員、集金、学校への年度報告の提出と指摘対応
- 操作は自クラブのデータに限定（`{baseKey}__{clubId}` スコープ）
- 監査中は `SettlementLockAlert` により全書き込みボタン `disabled`

### ④ 保護者（利用者）

- 自児に関する閲覧、納入、将来のオンライン決済、学校・クラブからのお知らせ
- 専用URL（トークン）からの閲覧方式、または専用IDによるアクセス
- 他児、帳簿の秘匿、部内協議にはアクセス不可

### ⑤ 監査人（学校配下・査読専用）

- 担当クラブ（`assignedClubIds: string[]`、複数可）の決算査読
- `canAuditorActOnSettlement(clubId)` ≡ ロック `true` かつ `in_review` のときのみ承認・差戻活性
- 入出金・設定の直接編集は不可（閲覧のみ、なりすましモード）

---

## 3. 初期導入フロー（セットアップ）

### 3.1 学校の申し込みからダッシュボード開通まで

1. 学校担当者が公式ランディングページ（`/register/school`）から申し込み
2. 運営が契約締結後、学校管理者の初期招請または仮ID付与
3. メール認証（`/register/verify?token=...`）→ 学校ID発行 → 自動ログイン
4. 本登録時: `upsertSchoolMaster()` + `initializeCleanSchoolWorkspace()`（`src/lib/schoolRegistration.ts`, `schoolWorkspace.ts`）
5. 学校テナント開通後、初回ログインとパスワード設定を行い、学内用ダッシュボード（`/school`）が利用可能となる

**デモ正本学校**: `SCH-79268`（クラサポ大学）— `src/lib/schoolMasters.ts`

### 3.2 学校側設定

学校管理画面で以下を一括登録・配布準備する。

| 設定項目 | 画面パス | 内容 |
|----------|----------|------|
| 会計期間 | 学校設定 | 当年度用の開始日・終了日 |
| クラブ枠 | 契約状況 | 認めるクラブ数（例: 最大30部活） |
| 共通勘定マスタ | `/school/settings/account-titles` | 全校共通の科目階層（配布元） |
| カテゴリー雛形 | `/school/settings/category` | 一括配布用カテゴリー |
| 監査運用 | `/school/settings/audit-flow` | 監査フロー有効/無効（`loadSchoolUseAuditFlow()`） |
| 担当者 | `/school/settings/staff` | 学校管理者担当者情報 |

### 3.3 各クラブへのID付与

学校が各クラブの管理者用アカウントを発行する。

| 項目 | 仕様 |
|------|------|
| クラブID形式 | `club-` + 4桁数字（例: `club-7392`）— `generateClubId()` |
| 初期パスワード | 英数字6桁（大文字+小文字+数字必須）— `generateInitialPassword()` |
| ストレージ | デモ校=グローバル `kurasaokaikei-school-clubs` / 新規校=ワークスペース分離 |
| 登録画面 | `/school/clubs/register` — `SchoolClubRegisterView` |
| 配布UI | `SchoolLoginCredentialsModal` — 登録完了時にログインID・初期PWをクリップボードコピー（**印刷機能は廃止**）。一覧は `SchoolInlineCopyButton` で個別コピー |
| グループ | `/school/clubs/groups` — 運動部/文化部等の大分類（登録時ラジオ選択） |

クラブ側で期首残高、部員名簿、集金スケジュールを登録後、日々の入出金と予実が一貫する。

### 3.4 監査人の登録

| 項目 | 仕様 |
|------|------|
| ID形式 | `AUD-` + 4桁ゼロ埋め（例: `AUD-0001`） |
| ストレージ | `school_auditors`（イベント: `kurasaokaikei-school-auditors-changed`） |
| 初期PW | クラブと同等ルール |
| 担当クラブ | `assignedClubIds: string[]` |
| 登録画面 | `/school/clubs/auditors/register` — `SchoolAuditorsRegisterView` |

### 3.5 保護者用マイページの生成

部員登録（`/club/members/register`）に伴い、システムが児童一人あたりに紐づく推測困難な専用閲覧用URLトークンを発行する。

| 項目 | 仕様 |
|------|------|
| Prisma フィールド | `Member.parentViewToken` — `prisma/schema.prisma` |
| 目標URL | `/parent/view?token={token}` |
| スコープAPI | `getMemberIdsForParentId()`, `filterRowsByMemberAllowlist()` — `src/lib/parentScope.ts` |
| 現状 | `/parent` はプレースホルダ（閲覧機能は未実装、スキーマのみ準備済） |

保護者に初回案内を送り、パスワード設定後、当該児の納入状況とお知らせのみにアクセスする。

---

## 4. 画面共通ヘッダー（統一3段構造仕様）

全ポータル（管理者・クラブ・監査人）の画面上部には、以下の統一された「3段構造ヘッダー」を固定（`sticky`）配置する。

**実装正本**: `src/components/layout/PortalUnifiedHeader.tsx`  
**年度Context**: `PortalFiscalYearProvider` — `DEFAULT_PORTAL_FISCAL_YEAR = "2026年度"`

### 4.1 第1段：学校環境（コンテキスト層）

| 仕様 | 値 |
|------|-----|
| 背景色 | 非常に薄いグレー `#FAFAFA`（または白） |
| 左側 | 学校名（大学名）— `text-xl font-bold text-[#4B5563]` ＋ 会計期間（小さめグレー） |
| 右側（**クラブポータルのみ**） | **現在の作業者：〇〇〇** — 作業者選択モーダルで宣言した担当者名（複数時は「、」区切り）。未宣言時は「未選択」 |

> **実装定数との対応**: デモ実装では `SCHOOL_DISPLAY_NAME`（`"東京都市大学"`）および `SCHOOL_FISCAL_PERIOD`（`"2026.8.1～2027.7.31"`）を `src/lib/schoolTheme.ts` で保持。本番・デモ切替時は `schoolHeaderDisplay.ts` / `currentSchool.ts` 経由で表示。クラブの作業者表示は `ClubPortalHeader` → `UserInfoContext.currentWorkers`（`kurasaokaikei-current-workers`）。

### 4.2 第2段：ポータル・アイデンティティ帯（カラーブランディング層）

背景色は各ポータルのテーマカラーを全面適用（白抜き文字）。

| ポータル | 背景色 | 表示名 |
|----------|--------|--------|
| 学校管理者ポータル | ネイビー `#001e43` | 学校管理者ポータル |
| 監査人ポータル | オレンジ `#ff9800` | 監査人ポータル |
| クラブポータル | くすみピンク `#E66A84`（サイドメニューアクティブ色と100%シンクロ） | **クラブ名のみ**（例：「ラグビー部」。「ポータル」文言は付けない） |

右側に `会計期間 : 2026.4.1 〜 2027.3.31` と白枠の「ログアウト」ボタンを配置。

**ログアウト動作**:

| ポータル | 処理 | 遷移先 |
|----------|------|--------|
| 学校 | `clearSchoolAdminSession()` | `/`（統合ログインハブ） |
| クラブ | `logoutClubSession()` — クラブ・なりすまし・last-active 全削除 | `/` |
| 監査人 | `clearCurrentAuditor()` | `/` |

### 4.3 第3段：年度切替コントロール（操作層）

| 仕様 | 値 |
|------|-----|
| 背景色 | 白 |
| ラベル | 「年度切替:」 |
| ボタン | pill（丸角）型の年度ボタン（2024年度、2025年度、2026年度） |
| ハイライト | 現在選択中の年度をポータルテーマカラーで強調 |
| 定数 | `SCHOOL_FISCAL_YEARS = ["2024年度", "2025年度", "2026年度"]` |

過去年度（≠2026年度）選択時、学校トップはプレースホルダ「（過去年度のデータはありません）」を表示。

---

## 5. 【最新】学校管理者ポータル・トップ画面（SchoolTopView）のレイアウト仕様

**URL**: `/school`  
**実装**: `src/components/school/SchoolMypageView.tsx`（別名 **SchoolTopView**）  
**年度**: 現在年度（`DEFAULT_PORTAL_FISCAL_YEAR`）のみフル表示。過去年度はプレースホルダ。

### 5.1 メインメニューからの削除事項

画面の整理に伴い、以下のカードは **メインメニューから完全に削除** されている（サイドメニュー・直接URLからは引き続きアクセス可能）。

| 削除カード | 代替アクセス |
|------------|--------------|
| クラブ登録 | サイドメニュー「クラブ管理」→ `/school/clubs/register` |
| 操作ガイド | サイドメニュー → `/school/guide` |

### 5.2 画面構成（上から下）

#### ① 監査進捗サマリー（全幅）

コンポーネント: `SchoolAuditProgressSummary` — §6 参照。

#### ② メインメニュー（1:1 等高グリッド）

大画面（`lg` 以上）において、左右50%ずつ（1:1）に分割する **完全な等高グリッド構造** を採用する。

```text
lg以上における画面配置イメージ：
[左半分：縦にぴったり3等分（等高）]   │ [右半分：高さを左側と完全同期]
1. 監査人ダッシュボード               │
──────────────────────────────────────┤ 契約状況カード（h-full）
2. クラブダッシュボード               │ （契約プラン、オプション、金額、
──────────────────────────────────────┤  支払いサイクル、お支払い日、
3. メッセージBOX                     │  お支払方法を縦に等間隔分散配置）
```

**グリッドクラス（必須）**:

```html
<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
```

| 領域 | 幅（lg 以上） | 内容 |
|------|---------------|------|
| **左半分（50%）** | `lg:grid-cols-2` の第1列 | 3 等分メニューカード（縦一列） |
| **右半分（50%）** | 第2列 | 契約状況カード（`h-full` で左と高さ同期） |

### 5.3 【左半分（50%幅）】3 等分メニューカード

右側契約状況の縦幅を **ぴったり 3 等分** した等高コンテナ。

**コンテナクラス**（監査フロー有効時・3 枚）:

```html
<div class="flex min-h-0 flex-col gap-4 lg:grid lg:h-full lg:grid-rows-3">
```

**配置順（上→下）**:

| 順 | カード | 遷移先 | アクセント色 | 条件 |
|----|--------|--------|--------------|------|
| 1 | **監査人ダッシュボード** | `/school/clubs/auditors` | オレンジ `#ea580c` | 監査フロー有効時のみ |
| 2 | **クラブダッシュボード** | `/school/clubs` | ネイビー `#172554` | 常時 |
| 3 | **メッセージBOX** | `/school/messages` | 青 `#2563eb` | 常時 |

監査フロー無効時（`loadSchoolUseAuditFlow() === false`）は 2 枚（クラブ + メッセージ）で `lg:grid-rows-2`。

**カード共通**: `PortalMenuCard` — 白背景、`rounded-xl`、`border-left` 5px、`h-full min-h-0`。

### 5.4 【右半分（50%幅）】契約状況カード

**コンポーネント**: `SchoolContractStatusSummaryCard`（`src/components/school/SchoolContractStatusSummaryCard.tsx`）

| 仕様 | 値 |
|------|-----|
| 高さ | `h-full min-h-0 flex flex-col` — 左側 3 等分コンテナと **完全同期** |
| 左アクセント | ネイビー 5px 縦線（`SCHOOL_THEME.navy` = `#172554`） |
| ヘッダー | 「契約状況」+ 「詳細を見る」→ `/school/contract` |

**表示項目**（縦等間隔 `flex-1 flex-col` + 各 `DataRow` が `flex-1 justify-center`）:

1. 契約プラン
2. オプション
3. 金額
4. 支払いサイクル（年払い / 月払い）
5. お支払い日
6. お支払方法

**デモデータ**: `SCHOOL_CONTRACT_DEMO` — `getSchoolContractDisplay()`（`src/lib/schoolTheme.ts`）

---

## 6. 各ダッシュボード内における「監査進捗サマリー」の共通 UI 仕様

### 6.1 タイトル

| 項目 | 仕様 |
|------|------|
| **正式名称** | 「**監査進捗サマリー**」 |
| **禁止** | タイトルに「リアルタイム」等の修飾語を付けない（旧仕様から削除済み） |
| 補助説明文 | 「全クラブの監査ステータス」 |

### 6.2 適用箇所

| 画面 | コンポーネント | 集計対象 |
|------|----------------|----------|
| 学校トップ | `SchoolAuditProgressSummary` | 全登録クラブ |
| 学校クラブ一覧 | `SchoolClubDashboardCard` / `SchoolUnassignedClubDashboardCard` | 個別クラブ（監査ステータスのみ） |
| 監査人カード内 | `AuditorAssignedClubProgressSummary` | 担当クラブのみ |
| 監査人ポータル | 各 `AuditorClubDashboardCard` のバッジ | 個別クラブ |

**学校管理者ポータル・クラブカード（2026-06-20 改定）**: `SchoolClubDashboardCard` および `SchoolUnassignedClubDashboardCard` から **「当期の決算提出状況」行を完全削除**（監査ステータスと情報が重複していたため）。カード上部の強調エリアに `SettlementAuditStatusBadge` で **監査ステータスのみ**（未提出 / 監査中 / 差戻 / 承認済）を表示する。旧仕様の「当期の決算提出状況」連動は学校側 UI から廃止。

### 6.3 4 つの監査ステータス（厳密定義）

全ポータルで表示名称・色・集計バケットを統一する。**旧称「作成中」「提出済」は廃止**。

| 内部バケット | 表示名称 | localStorage 正本の判定 | クラブ側データロック | 意味 |
|--------------|----------|------------------------|---------------------|------|
| **`preparing`** | **未提出** | `club_auditor_audit_status` が `not_started`（または未設定）かつ `is_club_settlement_locked` が `false` | なし | クラブが編集・提出可能 |
| **`in_audit`** | **監査中** | ロック `true` または監査状態 `in_review` | **一次ロック** | 提出済み、監査人審査中 |
| **`rejected`** | **差戻し** | 監査状態 `rejected`（ロックは `false`） | 解除（修正・再提出可能） | 監査人コメント付きでクラブへ通知 |
| **`approved`** | **承認済** | 監査状態 `approved`（ロック `true` 維持） | **監査完了ロック** | 監査人承認済。編集原則禁止 |

**分類関数（正本）**: `classifyClubAuditProgress(clubId)` / `classifyFromState(auditStatus, locked)` — `src/lib/schoolAuditProgressSummary.ts`

### 6.4 3文字バッジ完全統合仕様

**コンポーネント**: `SettlementAuditStatusBadge`（`src/components/school/SettlementAuditStatusBadge.tsx`）

| 仕様 | 値 |
|------|-----|
| 幅 | **`w-16 shrink-0`** — 3文字幅に引き締めたコンパクトバッジ |
| 形状 | `rounded-full text-xs font-medium tracking-tight` |
| 統一範囲 | 学校トップ・クラブダッシュボード・監査人ダッシュボードで **100% 同一デザイン** |
| 配置 | セル内 **左寄せ**（`flex flex-col items-start`） |

**4 色バッジパレット**（`src/lib/clubSettlementPortalSync.ts`）:

| ステータス | Tailwind クラス定数 | 色 |
|------------|---------------------|-----|
| 未提出 | `SETTLEMENT_NOT_SUBMITTED_BADGE_CLASSES` | 赤 |
| 監査中 | `SETTLEMENT_IN_AUDIT_BADGE_CLASSES` | 緑 |
| 差戻し | `SETTLEMENT_REJECTED_BADGE_CLASSES` | 黄（amber） |
| 承認済 | `AUDITOR_APPROVED_BADGE_CLASSES` | 青 |

### 6.5 ステータス表示形式（学校トップ・4 列グリッド）

各ステータスセル（`items-start` 左寄せ）:

1. **ステータス名**: `SettlementAuditStatusBadge`（上記3文字バッジ）
2. **件数（クラブ数）**: バッジの **外側・下** に配置
   - フォント: **`text-3xl font-extrabold`**（sm 以上で `text-4xl`）
   - 単位「クラブ」: `text-lg sm:text-xl text-[#9CA3AF]`
   - 色: ステータス別（赤/緑/黄/青）
3. **プログレスバー**: 各セル下部、総クラブ数に対する比率

**禁止（2026-07-17）**: 各セルに補足説明文（「未提出・ロックなし」「監査中かつ未承認」「監査人差戻し中」「監査人承認・完全ロック」等）を表示しない。バッジ・件数・プログレスバーのみ。

**並び順（左→右）**: 未提出（赤）→ 監査中（緑）→ 差戻し（黄）→ 承認済（青）

**総クラブ数**: ヘッダー右端、`text-3xl font-extrabold`

### 6.6 データ同期仕様

`localStorage` から各クラブの最新監査状態を **Event Listener** で購読し、**画面リロードなし** でカウント数とカラーバーを自動集計・完全同期する。

**購読イベント**（`SchoolAuditProgressSummary`）:

- `CLUB_SETTLEMENT_LOCK_CHANGED_EVENT`（`kurasaokaikei-club-settlement-lock-changed`）
- `CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT`（`kurasaokaikei-club-auditor-audit-status-changed`）
- `SETTLEMENT_CHANGED_EVENT`
- `storage`（キーが `is_club_settlement_locked_*` / `club_auditor_audit_status_*`）
- `focus` / `visibilitychange`（visible 時）

**集計 API**: `aggregateSchoolAuditProgress(clubIds)` — `src/lib/schoolAuditProgressSummary.ts`

---

## 7. 【最新】クラブポータル・トップ画面のレイアウト仕様

**URL**: `/club/dashboard`  
**実装**: `src/app/club/dashboard/page.tsx`

### 7.1 削除した要素

- **「重要：未処理・エラー通知」** セクション — **完全削除**（コードから除去済み）

### 7.2 全体レイアウト

| 要素 | 仕様 |
|------|------|
| 上部 | `SettlementLockAlert`（監査中のみ赤警告） |
| 本体高さ | `h-[67vh] max-h-[67vh]`（サイドバーには適用しない） |
| グリッド | `grid grid-cols-1 gap-6 lg:grid-cols-3`（3 列） |

```text
┌─────────────────┬─────────────────┬─────────────────┐
│  左列           │  中央列         │  右列           │
│  現在の現金預金 │  現在の部員数   │  証憑未登録数   │
│  残高           │  （上半分）     │  （上半分）     │
│  （スクロール） ├─────────────────┼─────────────────┤
│                 │  メッセージBOX  │  決算ステータス │
│                 │  （下半分）     │  （下半分）     │
└─────────────────┴─────────────────┴─────────────────┘
```

### 7.3 左列：現在の現金預金残高

- カード見出し: **現在の現金預金残高**（薄いグレー帯「現金預金」は置かない）
- **通常時**: 現金預金内訳・合計のみを表示（「入る予定（資産）」「支払う予定（負債）」「実質残高（次期繰越金）」は非表示）
- **繰延後**: 繰延により資産・負債に非ゼロ残高がある場合のみ、該当セクションと実質残高（次期繰越金）を追加表示
- データ: `getPortalTransactions`, `getPortalAccountTitles`（`clubPortalData.ts`）。残高集計は現金預金出納帳と同じ
- 左縦線: ピンク `#E66A84`
- 科目行クリック → 現金預金出納帳（`/club/accounting/ledger/cash-bank`）
- **繰延固定4科目**: 未収入金、未払金、預り金、仮払金（旧称「仮受金」は預り金に合算）

### 7.4 中央列（上下 2 分割、`flex-1` ずつ）

#### 上段 — 現在の部員数

- 4 学年別人数 + 合計（在籍 `active` のみ）
- データ: `getPortalMembers(activeClub)`
- 左縦線: 紫 `#9D8CC3`

#### 下段 — メッセージBOX

- `ClubMessageInboxList` — `maxItems={5}`, `variant="compact"`
- 「一覧はこちら ➔」→ `/club/messages`
- 左縦線: 青 `#4A90E2`

### 7.5 右列（上下 2 分割）

#### 上段 — 証憑未登録数

- `ClubDashboardVoucherStats`
- 表示: **`{未登録} / {全支出仕訳数}`**（未投入時 `0/0`）
- 集計: `computeClubReceiptStats()` — `src/lib/clubReceiptStats.ts`
- 現金預金出納帳データと連動（同一 `transactions` ソース）
- 「出納帳へ ➔」→ `/club/accounting/ledger/cash-bank`
- 左縦線: 赤 `#EF4444`

#### 下段 — 決算ステータス

- `ClubDashboardSettlementSummary`
- 双六 UI（`ClubSettlementProgressSteps`）、スタッキングバー、現在ステータスバッジ（`SettlementAuditStatusBadge` と同一デザイン）
- 通常: `[未提出] → [監査中] → [承認済]`
- 差戻履歴あり: `[未提出] → [監査中] → [差戻] → [監査中(再)] → [承認済]`

### 7.6 クラブサイドバーメニュー色（機能別アクセント）

`src/components/layout/Sidebar.tsx`:

| メニュー | colorHex |
|----------|----------|
| ポータルトップ | `#E66A84` |
| 入出金登録 | `#A3BC68` |
| 集計・帳簿 | `#68A384` |
| 集金管理 | `#D99529` |
| 予実管理 | `#1A237E` |
| 部員管理 | `#9D8CC3` |
| メッセージBOX | `#4A90E2` |
| 決算 | `#005088` |
| 設定 | `#77B8DA` |

### 7.7 クラブ設定（`/club/settings/club`）

**実装**: `src/app/club/settings/club/page.tsx`

| セクション | 仕様 |
|------------|------|
| ご契約情報 | `ClubContractInfoSection` — 学校契約データ連動（`getSchoolContractDisplay`）、レイアウトは `SchoolContractView` と統一 |
| 団体情報 | `ClubOrganizationInfoSection` — 団体名（編集不可）、代表者役職・氏名（姓/名）・電話（編集可）。保存先: `kurasaokaikei-club-organization-profiles` |
| ログイン情報 | ログインID（クラブID）の表示のみ。パスワード変更・メールアドレス変更は **削除済** |

---

## 8. 監査人ポータル詳細

### 8.1 基本情報

| 項目 | 内容 |
|------|------|
| ベースURL | `/audit` |
| テーマカラー | オレンジ `#ff9800` / `#EA580C` |
| セッションキー | `kurasaokaikei-current-auditor` |
| Gate | `AuditorLayoutGate` — 未ログイン `/audit/*` → `/audit/login` replace |

### 8.2 監査人マスタ

- キー: `school_auditors`
- ID: `AUD-` + 4桁、`assignedClubIds: string[]`
- 登録: `/school/clubs/auditors/register`

### 8.3 ダッシュボードカード（`AuditorClubDashboardCard`）

**表示（2026-06-20 改定）**: ハイライト枠内に **監査ステータス**（`SettlementAuditStatusBadge`）のみ。「当期の決算提出状況」行は削除（学校管理者ポータルと統一）。部員数・下部アクションボタンは従来どおり。

**下部 3 ボタン（2:1:1 = 50%:25%:25%）**:

| 位置 | ラベル | 活性 |
|------|--------|------|
| 左 50% | クラブページへ（ピンク `#E66A84`） | 常時 |
| 中 25% | 承認（青） | `canReview` のみ |
| 右 25% | 差戻（黄） | `canReview` のみ |

承認済クラブカードは背景 `bg-gray-50`（文字・ボタンは opacity で落とさない）。

### 8.4 学校ポータル監査人カード（`SchoolAuditorDashboardCard`）

5 段レイアウト: ヘッダー / 基本情報 / 監査進捗サマリー（ミニ 4 列）/ 担当クラブチップ / フッター操作

### 8.5 主要画面

| パス | 画面 | コンポーネント |
|------|------|----------------|
| `/audit/login` | ログイン | `AuditorLoginView` |
| `/audit` | 担当クラブ一覧 | `AuditorDashboardView` |
| `/audit/clubs/[clubId]` | 監査詳細 | `AuditorClubReviewView` |
| `/audit/messages` | メッセージ BOX | `AuditorMessagesView` |

---

## 9. 決算提出フローと全域ロック機構

### 9.1 localStorage キー（クラブ ID 末尾で完全分離）

| キー | 値 | 用途 |
|------|-----|------|
| `is_club_settlement_locked_{clubId}` | `"true"` / `"false"` | 一次ロック・「監査中」表示 |
| `club_auditor_audit_status_{clubId}` | `not_started` / `in_review` / `approved` / `rejected` | 監査バッジ・承認/差戻ボタン活性 |
| `club_settlement_history_flow_{clubId}` | `{ steps, currentIndex }` | 双六 UI 履歴 |
| `kurasaokaikei-school-club-settlement-status` | 学校側決算マップ | 学校ポータル一覧バッジ |

**原則**: 状態キーは必ず `_{clubId}` 末尾で完全分離。グローバル共有禁止。

### 9.2 クラブ決算ページ（`/club/settlement`）

`ClubSettlementView` — 縦並び:

1. 小タイトル「決算」
2. 担当監査人カード（`bg-gray-50 rounded-xl`）
3. 決算ステータスカード（双六 UI + 「メッセージBOXへ ➔」）
4. 提出ボタン（ロック時「決算データ提出済み（監査中）」disabled）

### 9.3 提出時（`applyClubSettlementSubmit`）

1. `is_club_settlement_locked_{clubId} = "true"`
2. `club_auditor_audit_status_{clubId} = "in_review"`
3. 双六 UI を「監査中」へ
4. 学校側決算マップを `submitted` に同期

### 9.4 監査人承認（`auditorApproveSettlement`）

1. 監査状態 → `approved`
2. ロック **`true` 維持**（編集不可継続）
3. 双六 → 承認済
4. カード背景 `bg-gray-50`

### 9.5 監査人差戻（`auditorRejectSettlement`）

1. 監査状態 → `rejected`
2. ロック → **`false`**（編集再開）
3. 双六に差戻し履歴追加
4. 理由はメッセージ BOX 経由（`sendAuditPortalMessage` で自動投稿）

### 9.6 ロック時の UI 制限

**ロック対象機能**（監査中）: ダッシュボード、入出金登録、集計・帳簿、集金管理、予実管理、設定

- 赤警告 `SettlementLockAlert`: 「当年度の決算は**監査中**のため…」
- 全書き込みボタン `disabled={isLocked}` — `useClubSettlementLock()` hook

### 9.7 証憑管理（クラブ）

**集計**（`clubReceiptStats.ts`）:

```typescript
// 対象: type === "expense" && !isTransferLeg(t)
// 未登録: receiptUrl が空
computeClubReceiptStats(transactions) → { missingReceiptCount, totalExpenseEntries }
```

**証憑未登録数の定義（厳密）**:

- **分母**: 全支出仕訳数（振替片側 `isTransferLeg` は除外）
- **分子**: 分母のうち `receiptUrl` 未設定の件数
- **表示形式**: `{未登録} / {全支出仕訳数}`（例: `0/0`）

**帳簿赤ハイライト**:

| 画面 | パス | 条件 |
|------|------|------|
| 現金預金出納帳 | `/club/accounting/ledger/cash-bank` | `isExpenseMissingReceipt` → `bg-red-50 text-red-600` |
| 科目別台帳 | `/club/accounting/ledger/subject` | 同上 + 証憑列「未登録」 |
| 繰延（計上・精算） | `/club/accounting/ledger/deferred` | 未収入金・未払金・預り金・仮払金の計上／精算一覧 |

---

## 10. 認証・セッション・ログイン

### 10.1 統合ログインハブ（`/`）

`LoginHubView` — 4 大型カード:

| ボタン | カラー | 遷移・挙動 |
|--------|--------|------------|
| 学校ログイン | ネイビー `#005088` | `/school/login` へ遷移 |
| 監査人ログイン | オレンジ `#EA580C` | `/audit/login` へ遷移 |
| クラブログイン | ピンク `#E66A84` | 同一画面内でクラブID・パスワードフォーム表示 |
| 部員ログイン | グレー `#9CA3AF` | モーダル「部員ページは現在準備中です」 |

### 10.2 学校ログイン（`/school/login`）

| 項目 | 内容 |
|------|------|
| コンポーネント | `SchoolLoginView` |
| レイアウト | **App Shell なし**（`SchoolLayoutGate` がログイン path のみ子要素表示） |
| 初期値 | ID・パスワードとも **空文字** |
| 認証 | `authenticateSchool()` — `src/lib/schoolLoginSession.ts` |
| 成功条件 | 空欄 / `admin`+`admin` / 本登録済み資格 |
| セッションキー | `kurasaokaikei-school-admin-session` |
| 成功後 | `establishSchoolLogin()` → `/school` |
| AUD-* ID | `establishAuditorLoginById()` → `/audit` へ振り分け |

**パスワード入力**: `PasswordInput` + `deferAutofillUntilFocus={true}` — 👁 表示トグル付き

### 10.3 クラブログイン（`/club/login`）

| 項目 | 内容 |
|------|------|
| コンポーネント | `ClubLoginView` → `ClubLoginForm` |
| レイアウト | **App Shell なし**（`ClubLayoutGate` が `/club/login` のみシェル除外） |
| 初期値 | クラブID・パスワードとも **空文字** |
| 認証 | `authenticateClub()` — `loadSchoolClubs()` 照合 |
| セッションキー | `kurasaokaikei-current-club` |
| 成功後 | `/club/dashboard`（URLにクラブIDを露出しない） |
| 失敗時 | 「クラブIDまたはパスワードが正しくありません。」 |

### 10.4 セッション固定化（Session Fixation 対策）

**ファイル**: `src/lib/activeClubSession.ts`

| 項目 | 内容 |
|------|------|
| キー | `kurasaokaikei-last-active-club-session` |
| 目的 | リロード/HMR直後に直前のクラブセッションへ復元する（デモデータの自動投入は廃止済） |
| 優先順位 | ① `getCurrentClub()`（正規ログイン）→ ② `getImpersonatedClub()`（なりすまし）→ ③ `readLastActiveClub()`（直前セッション復元） |
| Context | `ClubSessionContext` が 400ms 間隔で `refresh()` + `isHydrated` フラグ |

**なりすまし優先順位**（`schoolClubSession.ts`）:

1. 学校管理者なりすまし（`sessionStorage`: `kurasaokaikei-school-impersonate-club`, `viewer: "school"`）
2. 監査人なりすまし（同上, `viewer: "auditor"`）
3. クラブログイン（`localStorage`: `kurasaokaikei-current-club`）

### 10.5 監査人ログイン（`/audit/login`）

| 項目 | 内容 |
|------|------|
| セッションキー | `kurasaokaikei-current-auditor` |
| 認証 | メール+初期PW / `AUD-XXXX`+初期PW |
| Gate | 未ログイン `/audit/*` → `/audit/login` replace |
| イベント | `kurasaokaikei-auditor-session-changed` |
| 学校ログイン経由 | `/school/login` で ID が `AUD-*` の場合に監査人セッション確立 |

### 10.6 なりすまし（閲覧モード）

| 操作者 | バナー | sessionStorage キー | 戻り先 |
|--------|--------|---------------------|--------|
| 学校管理者 | `ClubImpersonationBanner` | `kurasaokaikei-school-impersonate-club` | `/school/clubs` |
| 監査人 | 同上（オレンジ帯） | 同上（`viewer: "auditor"`） | `/audit` |

**閲覧制限**: `ClubAppShell` が学校管理者なりすまし時のみメイン領域に透明オーバーレイ（`pointer-events-auto`）— サイドバーは遷移可能

### 10.7 保護者トークン認証（将来）

| 項目 | 仕様 |
|------|------|
| トークン発行 | 部員登録時に `parentViewToken` を自動生成（推測困難なランダム文字列） |
| 閲覧URL | `/parent/view?token={token}` |
| 権限 | 当該児の集金・納入状況のみ。他児・帳簿全面・監査行にはアクセス不可 |
| 漏えい対策 | 再発行、必要に応じた有効期限（学校・クラブと合意のうえ運用） |
| 段階的導入 | 専用URL閲覧 → 専用ID+初回パスワード再設定 |

### 10.8 ログイン画面における Shell 非表示

| ポータル | 制御コンポーネント | 条件 |
|----------|-------------------|------|
| 学校 | `SchoolLayoutGate` | `pathname === SCHOOL_ROUTES.login` |
| クラブ | `ClubLayoutGate` | `pathname === clubPath("/login")` |
| 監査人 | `AuditorLayoutGate` | `pathname === AUDIT_ROUTES.login` |

---

## 11. 勘定科目マスタと配布

### 11.1 学校マスタ（配布元）

| 画面 | パス | 役割 |
|------|------|------|
| 共通カテゴリー | `/school/settings/category` | 全クラブ共通カテゴリーの定義・編集（**実装済**） |
| 共通科目 | `/school/settings/account-titles` | 全クラブ共通科目の定義・編集（**実装済**） |

**共通カテゴリー（2026-07-17）**:

| 項目 | 仕様 |
|------|------|
| 正本 | `kurasaokaikei-school-common-categories`（`src/lib/schoolCommonCategories.ts`） |
| 全クラブ反映 | 保存時にクラブ参照キー `classapo_categories` へ同期 |
| UI | `CategorySettingsEditor`（追加・編集・削除・並び替え） |
| イベント | `SCHOOL_COMMON_CATEGORIES_CHANGED_EVENT` |
| 削除制限 | 選択年度に全クラブ横断で仕訳が1件でもあれば削除不可（`schoolCategoryUsage.ts`）。過年度は判定対象外 |
| 名称編集 | いつでも可。当年度仕訳のみ名称波及、過年度は不変 |
| クラブ追加権限 | 「クラブごとにカテゴリーの追加権限を与える」許可する／許可しない（既定: 許可しない）。選択年度にクラブ独自カテゴリーが残っている間は許可しないへ変更不可 |

**共通科目（2026-07-17）**:

| 項目 | 仕様 |
|------|------|
| 正本 | `kurasaokaikei-school-common-account-titles`（`src/lib/schoolCommonAccountTitles.ts`） |
| 全クラブ反映 | 保存時にクラブ参照キー `classapo_account_titles` へ同期 |
| UI | `AccountTitlesSettingsView`（追加・編集・削除・並び替え・カテゴリー紐付け。**期首残高フィールドなし**） |
| 期首残高 | 学校正本には持たない。各クラブがクラブポータルで入力。学校同期時はクラブ残高を保持 |
| イベント | `SCHOOL_COMMON_ACCOUNT_TITLES_CHANGED_EVENT` |
| 削除制限 | 選択年度に全クラブ横断で仕訳が1件でもあれば削除不可（`schoolCategoryUsage.ts`）。過年度は判定対象外 |
| 名称編集 | いつでも可。当年度仕訳のみ名称波及（`renameAccountTitleInFiscalYearAcrossClubs`）、収入・現金預金は `propagateMasterRename` も実行。過年度は不変 |
| クラブ追加権限 | 「クラブごとに科目の追加権限を与える」許可する／許可しない（既定: 許可しない）。**現金・預金のクラブ独自科目は許可しないでも常に追加・編集可**（学校共通の現金・預金は編集・削除不可）。選択年度にクラブ独自の収入・支出科目が残っている間は許可しないへ変更不可（現金・預金の独自科目は判定対象外） |
| カテゴリー連携 | 学校共通カテゴリー（`getSchoolCommonCategoriesForEditor`）を科目紐付けに使用 |

### 11.2 クラブ実務（配布先）

| 画面 | パス | 備考 |
|------|------|------|
| カテゴリー | `/club/settings/category` | 学校登録カテゴリーは **編集・削除不可**（「学校共通」バッジ）。独自追加は学校の追加権限スイッチが ON のときのみ |
| 科目設定 | `/club/settings/account-titles` | 学校共通科目（現金・預金含む）は編集・削除不可。**現金・預金のクラブ独自科目は常に追加・編集可**（権限オフでも可）。**初期残高（円）は一覧入力枠で全科目入力可（ご利用初年度のみ）**。収入・支出の独自追加は権限 ON のときのみ。前期繰越金設定あり |
| 会計年度 | `/club/settings/fiscal-years` | |
| クラブ設定 | `/club/settings/club` | ご契約情報・団体情報・ログインID表示。パスワード変更・メール変更は **削除済** |

### 11.3 科目体系

| グループ | 内容 |
|----------|------|
| 現金預金 | 現金、普通預金等 |
| 資産 | 未収入金、仮払金等 |
| 負債 | 未払金、預り金等 |
| 収入 | 会費収入、寄付金等 |
| 支出 | 遠征費、備品費等 |

**繰延固定4科目**: 未収入金、未払金、預り金、仮払金（表示順。旧称「仮受金」は預り金に合算）— ダッシュボード残高・繰延台帳で使用。計上は科目別台帳・収支集計表に符号付きで反映し、現金預金出納帳からは除外（`deferredAccounting.ts`）

### 11.4 データスコープ

クラブごとの localStorage キー: `{baseKey}__{clubId}`

| ベースキー | 用途 |
|------------|------|
| `classapo_transactions` | 取引データ |
| `classapo_account_titles` | 勘定科目 |
| `classapo_members` | 部員名簿 |

実装: `src/lib/clubPortalData.ts`, `src/utils/localStorage.ts`

---

## 12. 保護者・部員（将来拡張）

### 12.1 部員マイページ（`/member`）

| 項目 | 内容 |
|------|------|
| 現状 | デモ準備中（ログインハブからモーダル表示） |
| 目標機能 | 個人部費の納入ステータス確認、入退部・精算申請ワークフロー |
| 将来連携 | 保護者トークン URL との統合 |

### 12.2 保護者マイページ（`/parent`）

| 項目 | 内容 |
|------|------|
| 現状 | プレースホルダ |
| 目標URL | `/parent/view?token={parentViewToken}` |
| Prisma | `Member.parentViewToken` |
| スコープ | `src/lib/parentScope.ts` |

### 12.3 データ閲覧範囲の原則

| 階層 | 閲覧範囲 |
|------|----------|
| 学校 | 自校全クラブの横断閲覧、年度報告承認、ロック決定 |
| クラブ | 自部の会計行・部員・保護者紐づけのみ編集 |
| 保護者 | 自児の閲覧と将来の決済導線のみ |

---

## 13. 技術スタックとプロジェクト構造

### 13.1 技術スタック

| 項目 | 版/内容 |
|------|---------|
| フレームワーク | Next.js **14.0.4**（App Router） |
| UI | React 18、Tailwind CSS 3、Radix UI、lucide-react |
| 型 | TypeScript 5 |
| ORM（本番目標） | Prisma 5 + PostgreSQL |
| デモ永続化 | ブラウザ `localStorage` + React Context |

### 13.2 ディレクトリ構造（復元用）

```text
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
│   │   ├── (parent)/             ← 保護者（将来）
│   │   └── register/             ← 学校申込
│   ├── components/
│   │   ├── auth/                 ← ログイン UI
│   │   ├── school/               ← 学校ポータル UI
│   │   ├── club/                 ← クラブポータル UI
│   │   ├── audit/                ← 監査人ポータル UI
│   │   ├── layout/               ← App Shell・ヘッダー・サイドバー
│   │   ├── shared/               ← 共通 UI
│   │   └── ui/                   ← shadcn 系プリミティブ
│   ├── contexts/                 ← React Context
│   ├── hooks/                    ← useClubSettlementLock 等
│   ├── lib/                      ← ビジネスロジック・永続化 API
│   ├── services/                 ← ドメインサービス
│   ├── utils/                    ← localStorage 取引・科目ユーティリティ
│   └── types/                    ← 共有型
└── scripts/
    └── list-routes.js            ← 全 URL 一覧出力
```

### 13.3 コンポーネント階層（App Shell）

| ポータル | Layout Gate | App Shell | Header | Sidebar |
|----------|-------------|-----------|--------|---------|
| 学校 | `SchoolLayoutGate` | `SchoolAppShell` | `SchoolHeader` → `PortalUnifiedHeader` | `SchoolSidebar` |
| クラブ | `ClubLayoutGate` | `ClubAppShell` | `ClubPortalHeader` | `Sidebar` |
| 監査人 | `AuditorLayoutGate` | `AuditorAppShell` | `AuditorHeader` | `AuditorSidebar` |

**共通背景色**: `#F5F5F0`  
**サイドバー幅**: `w-64`（`ml-64` でメインオフセット）

### 13.4 Context プロバイダ

| Context | ファイル | 用途 |
|---------|----------|------|
| `ClubSessionContext` | `contexts/ClubSessionContext.tsx` | アクティブクラブ |
| `SchoolClubsContext` | `contexts/SchoolClubsContext.tsx` | 登録クラブ一覧 |
| `SchoolClubGroupsContext` | `contexts/SchoolClubGroupsContext.tsx` | グループ |
| `PortalFiscalYearContext` | `contexts/PortalFiscalYearContext.tsx` | 年度切替 |
| `UserInfoContext` | `contexts/UserInfoContext.tsx` | 組織名・担当者 |

### 13.5 カラーテーマ総括

| 用途 | カラーコード |
|------|-------------|
| 学校ネイビー（テーマ） | `#172554`, `#005088`, `#001e43`（ヘッダー第2段） |
| クラブピンク | `#E66A84` |
| 監査オレンジ | `#ff9800` / `#EA580C` |
| メッセージBOX（クラブ） | `#4A90E2` |
| 保護者（Legacy） | `#7C6BA8` |
| 背景 | `#F5F5F0` |
| テキスト系 | `#374151`, `#6B7280`, `#9CA3AF` |
| 警告/エラー | `#EF4444` |

---

## 14. localStorage キー一覧（デモ正本）

| キー | 用途 |
|------|------|
| `kurasaokaikei-school-admin-session` | 学校管理者セッション |
| `kurasaokaikei-current-club` | クラブログインセッション |
| `kurasaokaikei-last-active-club-session` | クラブセッション復元（セッション固定化） |
| `kurasaokaikei-school-clubs` | 登録クラブマスタ |
| `kurasaokaikei-school-club-groups` | クラブグループ |
| `kurasaokaikei-school-masters` | 学校マスタ |
| `kurasaokaikei-school-workspaces` | 新規校ワークスペース分離 |
| `school_auditors` | 監査人マスタ |
| `kurasaokaikei-current-auditor` | 監査人セッション |
| `is_club_settlement_locked_{clubId}` | 決算一次ロック |
| `club_auditor_audit_status_{clubId}` | 監査ステータス |
| `club_settlement_history_flow_{clubId}` | 双六 UI 履歴 |
| `kurasaokaikei-school-club-settlement-status` | 学校側決算マップ |
| `current_school` / `current_school_user` | 学校コンテキスト |
| 取引・科目・部員 | `src/utils/localStorage.ts` 内クラブスコープキー |

**sessionStorage キー**:

| キー | 用途 |
|------|------|
| `kurasaokaikei-school-impersonate-club` | 学校/監査人なりすまし閲覧 |

---

## 15. 全ルート一覧（復元用）

### 15.1 学校管理者 `/school`

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

### 15.2 クラブ `/club`

| パス | 画面 |
|------|------|
| `/club/login` | ログイン |
| `/club/dashboard` | **トップ（3 列ダッシュボード）** |
| `/club/settlement` | 決算提出 |
| `/club/accounting/input` | 入出金入力ハブ |
| `/club/accounting/register/new` | 新規登録 |
| `/club/accounting/register/history` | 登録履歴 |
| `/club/accounting/register/edit/[id]` | 編集 |
| `/club/accounting/ledger/cash-bank` | 現金預金出納帳 |
| `/club/accounting/ledger/subject` | 科目別台帳 |
| `/club/accounting/ledger/deferred` | 繰延（計上・精算）台帳 |
| `/club/accounting/summary` | 収支集計表 |
| `/club/accounting/report` | 収支報告書 |
| `/club/collection` | 集金管理 |
| `/club/collection/history` | 集金実績 |
| `/club/collection/schedule` | 集金予定 |
| `/club/budget` | 予実管理 |
| `/club/budget/book` | 予算書 |
| `/club/members` | 部員管理 |
| `/club/members/register` | 部員登録 |
| `/club/messages` | メッセージ BOX |
| `/club/settings/*` | 設定 |
| `/club/guide` | 操作ガイド |

### 15.3 監査人 `/audit`

| パス | 画面 |
|------|------|
| `/audit/login` | ログイン |
| `/audit` | 担当クラブ一覧 |
| `/audit/clubs/[clubId]` | 監査詳細 |
| `/audit/messages` | メッセージ BOX |
| `/audit/messages/drafts` | 下書き |
| `/audit/guide` | 操作ガイド |

### 15.4 その他

| パス | 画面 |
|------|------|
| `/` | 統合ログインハブ |
| `/member` | 部員（準備中） |
| `/parent` | 保護者（準備中） |
| `/parent/view?token=...` | 保護者閲覧（将来） |
| `/register/school` | 学校申込 |
| `/register/verify` | メール認証・本登録 |

---

## 16. 主要ソースファイル索引（コンポーネント対応表）

| 領域 | ファイル |
|------|----------|
| グランドスペック（本書） | `docs/system-grand-spec.md` |
| 学校トップ（SchoolTopView） | `src/components/school/SchoolMypageView.tsx` |
| 監査進捗サマリー | `src/components/school/SchoolAuditProgressSummary.tsx` |
| 共通ステータスバッジ（3文字） | `src/components/school/SettlementAuditStatusBadge.tsx` |
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
| 統合ヘッダー（3段） | `src/components/layout/PortalUnifiedHeader.tsx` |
| セッション固定化 | `src/lib/activeClubSession.ts` |
| クラブログイン | `src/lib/clubLoginSession.ts` |
| 学校ログイン | `src/lib/schoolLoginSession.ts` |
| 監査人セッション | `src/lib/currentAuditor.ts` |
| なりすまし | `src/lib/schoolClubSession.ts` |
| クラブ登録・ID発行 | `src/lib/schoolClubs.ts` |
| 監査人登録 | `src/lib/schoolAuditors.ts` |
| 学校申込 | `src/lib/schoolRegistration.ts` |
| 保護者スコープ | `src/lib/parentScope.ts` |
| 学校テーマ・ルート | `src/lib/schoolTheme.ts` |
| ポータルブランド | `src/lib/portalBrand.ts` |
| 取引 localStorage | `src/utils/localStorage.ts` |
| Prisma スキーマ | `prisma/schema.prisma` |

---

## 17. 開発・復元手順

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

### 17.1 復元チェックリスト

1. 本書 §6.3「4 つの監査ステータス」に従い `clubSettlementPortalSync.ts` を実装
2. `SchoolMypageView` の 1:1 等高グリッド + 左3等分メニュー + 右契約カード `h-full`（クラブ登録・操作ガイドはメインメニューから除外）
3. `SchoolAuditProgressSummary` タイトル「監査進捗サマリー」+ `SettlementAuditStatusBadge`（`w-16` 3文字バッジ）+ `text-3xl/4xl` 件数
4. `/club/dashboard` 3 列レイアウト、未処理通知なし、証憑 `0/0`、部員数カード
5. `PortalUnifiedHeader` 3 段構造（学校名2倍強調、ポータル別ブランド色、年度 pill）
6. 全 Layout Gate でログイン画面 Shell 除外
7. `activeClubSession.ts` によるセッション固定化（デフォルトクラブ逆戻り防止）
8. localStorage イベント購読でリアルタイム同期
9. 保護者 `parentViewToken` スキーマと `/parent/view?token=` ルート（将来）

### 17.2 実装ギャップ（復元時の注意）

| 項目 | 仕様 | 現行実装 |
|------|------|----------|
| 学校共通カテゴリー配布UI | マスタ一括配布 | **実装済**（`/school/settings/category` → 全クラブ同期） |
| 学校共通科目配布UI | マスタ一括配布 | **実装済**（`/school/settings/account-titles` → 全クラブ同期） |
| `/parent/view?token=` | 保護者閲覧 | 未実装（Prisma スキーマのみ） |
| `/member` | 部員マイページ | プレースホルダ |
| 学校最終完全ロック | 承認済年度 | localStorage デモのみ（Prisma `fiscalYearLock.ts` は別系統） |
| ヘッダー学校名 | 本書例「クラクラサポサポ大学」 | デモ定数 `SCHOOL_DISPLAY_NAME` = 「東京都市大学」 |

---

## 18. 改訂履歴

| 版 | 日付 | 内容 |
|----|------|------|
| 2.0 | 2026-05-29 | 3 段ヘッダー・ロック・監査人連動の統合初版 |
| 2.2.0 | 2026-06-01 | 4 色ステータス名称統一、監査進捗サマリー |
| 2.3.0 | 2026-06-05 | 監査人カード UI 刷新、担当クラブ 4 色サマリー |
| **3.0.0** | **2026-06-10** | **最新UI・等高左右50%ダッシュボード・3文字バッジ完全統合版。学校トップからクラブ登録・操作ガイド削除、四層組織構造・初期導入・勘定マスタ配布・保護者トークン・セッション固定化を完全統合。100% 復元仕様として本書全面刷新** |

---

*本書は `docs/LATEST_SYSTEM_SPEC.md` および `docs/system_spec.md` より優先する。実装と差異がある場合、本書とソースコードを突合し、本書を更新すること。*

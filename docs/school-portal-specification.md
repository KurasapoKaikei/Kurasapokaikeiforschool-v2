# クラサポ会計 — 学校管理者ポータル 仕様書

**文書バージョン**: 2026-06-19（監査人管理・メッセージBOX UI 修正完了・セーブポイント）  
**対象範囲**: `/school` 配下の学校管理者ポータル、および連携する監査人ポータル `/audit`

---

## 1. システム概要

学校管理者ポータルは、大学・学校の管理者がクラブ会計を一元管理するための Web アプリケーションです。  
`SchoolAppShell`（サイドバー + ヘッダー + メインコンテンツ）で `/school` 配下の全画面をラップします。

### 1.1 主要機能と役割

| 機能領域 | 役割 |
|----------|------|
| **ポータルトップ（ダッシュボード）** | 学校全体の状況サマリー、監査進捗、メインメニューカード、契約状況サマリーを表示する起点画面（`/school`） |
| **クラブ管理** | 登録クラブのダッシュボード閲覧、新規クラブ登録、グループ（クラブのまとまり）作成を行う |
| **監査人管理** | 監査フロー有効時のみ表示。監査人の一覧・ダッシュボードおよび監査人の新規登録を行う |
| **メッセージBOX** | 学校管理者とクラブ・監査人間のメッセージ送受信。一覧表示と下書き管理 |
| **契約状況** | 学校の契約プラン・オプション（監査人オプション等）・金額情報の確認 |
| **設定** | 共通カテゴリー・共通科目・担当者のマスタ設定。監査フロー有効時は監査運用設定も利用可能 |
| **操作ガイド** | ポータルの操作方法を案内する画面 |

### 1.2 表示条件（監査フロー）

監査人管理メニューおよび設定内の「監査運用設定」は、学校マスタの **監査フロー有効フラグ**（`loadSchoolUseAuditFlow()`）が `true` の場合のみサイドバーに表示されます。  
フラグは `localStorage` 上の学校マスタデータに基づき、セッション変更・ストレージ変更イベントで動的に同期されます。

### 1.3 ルート定義の参照元

メニューのタイトルおよび URL は `src/lib/schoolTheme.ts` の `SCHOOL_PAGE_TITLES` / `SCHOOL_ROUTES` を参照しています。  
サイドバーのメニュー構成は `src/components/layout/school/SchoolSidebar.tsx` の `buildMenuItems()` で定義されています。

---

## 2. サイドバー構造

実装ファイル: `src/components/layout/school/SchoolSidebar.tsx`

- 固定幅 256px（`w-64`）、左側に固定表示
- ロゴクリック先: `/school`
- セクションラベル: 「学校管理」
- 親メニュー（サブ項目あり）は **アコーディオン式**（クリックで展開/折りたたみ）。親項目自体はリンクではなくトグルボタン
- 親メニュー（サブ項目なし）は **直接リンク**

### 2.1 メニュー構成（完全リスト）

#### トップレベル

| # | タイトル | URL | 種別 | 表示条件 |
|---|---------|-----|------|----------|
| 1 | ポータルトップ | `/school` | リンク | 常時 |
| 2 | クラブ管理 | `/school/clubs` | 親（アコーディオン） | 常時 |
| 3 | 監査人管理 | `/school/clubs/auditors` | 親（アコーディオン） | 監査フロー有効時のみ |
| 4 | メッセージBOX | `/school/messages` | 親（アコーディオン） | 常時 |
| 5 | 契約状況 | `/school/contract` | リンク | 常時 |
| 6 | 設定 | `/school/settings` | 親（アコーディオン） | 常時 |
| 7 | 操作ガイド | `/school/guide` | リンク | 常時 |

#### クラブ管理（子メニュー）

| # | タイトル | URL |
|---|---------|-----|
| 1 | クラブダッシュボード | `/school/clubs` |
| 2 | クラブ登録 | `/school/clubs/register` |
| 3 | グループ作成 | `/school/clubs/groups` |

#### 監査人管理（親メニュー・子メニュー）※監査フロー有効時のみ

親メニュー「監査人管理」は `buildMenuItems()` 内で `auditFlowEnabled === true` のときのみ配列に挿入される。  
`parentKey: "auditor"`、`match: isSchoolAuditorPath()` により、監査人関連パス全体で親のハイライト・アコーディオン展開が連動する。

| # | タイトル | URL | 備考 |
|---|---------|-----|------|
| — | 監査人管理（親） | `/school/clubs/auditors` | 展開トグル。リンクではなくボタン |
| 1 | 監査人ダッシュボード | `/school/clubs/auditors` | 子メニュー |
| 2 | 監査人登録 | `/school/clubs/auditors/register` | 子メニュー |

> **表示位置**: 「クラブ管理」の直後（メッセージBOX の前）  
> **アイコン**: 親＝`ClipboardCheck`、子「監査人ダッシュボード」＝`List`、子「監査人登録」＝`Plus`

#### メッセージBOX（子メニュー）

| # | タイトル | URL |
|---|---------|-----|
| 1 | メッセージ一覧 | `/school/messages` |
| 2 | 下書き | `/school/messages/drafts` |

#### 設定（子メニュー）

| # | タイトル | URL | 備考 |
|---|---------|-----|------|
| 1 | 共通カテゴリー設定 | `/school/settings/category` | 常時 |
| 2 | 共通科目設定 | `/school/settings/account-titles` | 常時 |
| 3 | 担当者設定 | `/school/settings/staff` | 常時 |
| 4 | 監査運用設定 | `/school/settings/audit-flow` | 監査フロー有効時のみ |

### 2.2 表示順（上から下）

```
ポータルトップ                    → /school
クラブ管理                        → /school/clubs（展開トグル）
  ├ クラブダッシュボード          → /school/clubs
  ├ クラブ登録                    → /school/clubs/register
  └ グループ作成                  → /school/clubs/groups
[監査フロー有効時]
監査人管理                        → /school/clubs/auditors（展開トグル）
  ├ 監査人ダッシュボード          → /school/clubs/auditors
  └ 監査人登録                    → /school/clubs/auditors/register
メッセージBOX                     → /school/messages（展開トグル）
  ├ メッセージ一覧                → /school/messages
  └ 下書き                        → /school/messages/drafts
契約状況                          → /school/contract
設定                              → /school/settings（展開トグル）
  ├ 共通カテゴリー設定            → /school/settings/category
  ├ 共通科目設定                  → /school/settings/account-titles
  ├ 担当者設定                    → /school/settings/staff
  └ [監査フロー有効時] 監査運用設定 → /school/settings/audit-flow
操作ガイド                        → /school/guide
```

### 2.3 関連ルート（サイドバー外）

以下はサイドバーに直接リンクはないが、学校ポータル内で利用される動的ルートです。

| パス | 用途 |
|------|------|
| `/school/login` | 学校管理者ログイン |
| `/school/clubs/[clubId]/messages` | クラブ個別メッセージ |

---

## 3. 技術スタック

### 3.1 フレームワーク・言語

| 項目 | バージョン・詳細 |
|------|-----------------|
| **Next.js** | 14.0.4（**App Router**） |
| **React** | 18.2 |
| **TypeScript** | 5.x |
| ルーティング | `src/app/` ディレクトリベース（App Router） |

学校管理者ポータルのページは `src/app/school/` 配下に配置されています。

### 3.2 スタイリング

| 項目 | 詳細 |
|------|------|
| **Tailwind CSS** | 3.3 — ユーティリティクラスによるレイアウト・配色 |
| **tailwindcss-animate** | アニメーション補助 |
| **tailwind-merge** / **clsx** | クラス名の結合（`cn()` ユーティリティ） |
| **Radix UI** | アコーディオン、ダイアログ等の UI プリミティブ |
| **lucide-react** | サイドバー・各画面のアイコン |
| **shadcn/ui 系** | `class-variance-authority` 等を利用したコンポーネント設計 |

学校ポータルのテーマカラー（ネイビー等）は `src/lib/schoolTheme.ts` の `SCHOOL_THEME` で定義されています。

### 3.3 データ・その他

| 項目 | 詳細 |
|------|------|
| **Prisma** | 5.7 — PostgreSQL ORM（本番 DB 連携用） |
| **デモデータ** | 学校マスタ・クラブ等は `localStorage` ベースのシードデータを併用 |
| **Google Gemini** | OCR・AI 補助（クラブ会計機能側） |

### 3.4 主要コンポーネント構成

```
src/components/layout/school/
├── SchoolAppShell.tsx    # レイアウト枠（Sidebar + Header + main）
├── SchoolSidebar.tsx     # サイドバー（本仕様書 §2 のメニュー定義）
└── SchoolHeader.tsx      # 統合ヘッダー（ログアウト等）
```

---

## 4. 監査人登録機能

実装ファイル:

| レイヤー | ファイル |
|----------|----------|
| ページ | `src/app/school/clubs/auditors/register/page.tsx` |
| 画面 | `src/components/school/SchoolAuditorsRegisterView.tsx` |
| フォーム・一覧 | `src/components/school/SchoolAuditorsRegisterSection.tsx` |
| 控え一覧 | `src/components/school/SchoolAuditorsAccountBackupSection.tsx` |
| データ層 | `src/lib/schoolAuditors.ts` |
| ワークスペース | `src/lib/schoolWorkspace.ts` |

### 4.1 画面仕様

- **アクセス経路**: サイドバー「監査人管理」>「監査人登録」（`/school/clubs/auditors/register`）
- **表示条件**: `loadSchoolUseAuditFlow()` が `true` の場合のみ利用可能。無効時は案内メッセージと「監査運用設定」へのリンクを表示
- **登録項目（すべて必須）**: 姓、名、部署、電話番号、メールアドレス、担当クラブ（1件以上）
- **氏名**: `lastName`（姓）と `firstName`（名）を別フィールドで保存。一覧・選択肢では `formatAuditorDisplayName()` により全角スペース結合表示（例: `鈴木　一郎`）
- **担当クラブ制約**: 他の監査人に既に割り当て済みのクラブは選択不可（編集時は自監査人の担当分は選択可能）
- **メール重複チェック**: 同一メールアドレスの二重登録を拒否（編集時は自身を除外）
- **確認ダイアログ**: 登録・更新・削除は `ActionConfirmDialog`（`useActionConfirmDialog`）経由で確定
- **保存後の挙動（2026-06-18 改定）**: 新規登録成功後は **監査人ダッシュボードへ遷移しない**。登録画面（`/school/clubs/auditors/register`）に留まり、フォームをリセットし、画面上に「監査人を登録しました」（編集時は「変更を保存しました」）を緑色テキストで表示する。連続登録が可能。ユーザーが再入力を始めると成功メッセージは非表示になる
- **編集モード**: 控え一覧の編集ボタン、または `?edit={監査人ID}` クエリでフォームに既存データを読み込み。編集保存後はクエリをクリアして登録画面に留まる（一覧画面へは遷移しない）

### 4.2 登録ロジック（`schoolAuditors.ts`）

| 関数 | 役割 |
|------|------|
| `addSchoolAuditor()` | 新規監査人を作成。ID は `AUD-0001` 形式で採番。初期パスワードを自動生成。`order: 1` で先頭に追加 |
| `updateSchoolAuditor()` | 既存監査人を更新（`order` は維持） |
| `deleteSchoolAuditor()` | 監査人を削除（残りの `order` を再採番） |
| `setSchoolAuditorsOrder()` | 並び替え後の配列順を `order` に反映して即保存 |
| `filterUnassignedClubs()` | どの監査人にも割り当てられていないクラブを抽出 |
| `findAuditorForClub()` | クラブ ID から担当監査人を検索 |
| `saveAll()` | 永続化の共通入口。成功時 `true`、書き込み不可時 `false` を返す |

**データモデル（`SchoolAuditor`）**:

| フィールド | 説明 |
|-----------|------|
| `lastName` | 姓 |
| `firstName` | 名 |
| `order` | 一覧表示順（1 始まり）。読み込み時は `order` 昇順でソート |
| `assignedClubIds` | 担当クラブ ID 配列（配列順が担当クラブの表示順にも利用される） |
| その他 | `id`, `department`, `phone`, `email`, `initialPassword`, `auditStatus`, `createdAt`, `updatedAt` |

**ストレージの分岐**:

| 学校種別 | 保存先 | 備考 |
|----------|--------|------|
| デモ校（`SCH-79268`） | グローバル `localStorage` キー `school_auditors` | 従来互換（レガシー） |
| 新規登録校 | 学校ワークスペース blob 内の `auditors` 配列 | `writeScopedWorkspace()` 経由 |

`saveAll()` は `assertSchoolWorkspaceWritable()` により、保護対象デモ校への誤書き込みを拒否する。  
`addSchoolAuditor` / `updateSchoolAuditor` / `deleteSchoolAuditor` は `saveAll()` が `false` を返した場合 `null` または `false` を返し、UI 側で「保存に失敗しました」を表示する。

### 4.3 イベント発火仕様（修正内容）

監査人データの変更通知は、以下のカスタムイベントで行う。

| イベント名 | 定数 | 発火タイミング |
|------------|------|----------------|
| 監査人変更 | `SCHOOL_AUDITORS_CHANGED_EVENT`（`kurasaokaikei-school-auditors-changed`） | 監査人マスタの保存成功時 |
| ワークスペース変更 | `SCHOOL_WORKSPACE_CHANGED_EVENT`（`kurasaokaikei-school-workspace-changed`） | 学校ワークスペース blob 保存時 |

**修正前の問題**: 新規登録校（スコープドワークスペース）では `saveAllToGlobal()` が呼ばれず、`SCHOOL_AUDITORS_CHANGED_EVENT` が発火しないため、登録直後に一覧・担当クラブの排他制御が更新されなかった。

**修正後の動作**:

1. **レガシー（デモ校）**: `saveAllToGlobal()` 内で `dispatchChanged()` → `SCHOOL_AUDITORS_CHANGED_EVENT` を発火（従来どおり）
2. **スコープドワークスペース（新規校）**: `writeScopedWorkspace()` 完了後、`saveAll()` 内で `dispatchChanged()` → `SCHOOL_AUDITORS_CHANGED_EVENT` を発火
3. **UI 側の購読拡張**: 以下のコンポーネントが `SCHOOL_WORKSPACE_CHANGED_EVENT` にもリスナーを登録し、ワークスペース経由の変更を確実に反映
   - `SchoolAuditorsRegisterSection`
   - `SchoolAuditorsListSection`
   - `SchoolAuditorsAccountBackupSection`

**確認ダイアログの stale closure 修正**（`useActionConfirmDialog.ts`）:  
`pendingRef` で最新の `onConfirm` コールバックを保持し、ダイアログ確定時に常に最新のフォーム状態で `persistAuditor` が実行されるようにした。  
`SchoolAuditorsRegisterSection` の `persistAuditor` は `useCallback` で依存配列を明示している。

### 4.4 監査人ダッシュボード（一覧）

実装ファイル:

| レイヤー | ファイル |
|----------|----------|
| ページ | `src/app/school/clubs/auditors/page.tsx` |
| 画面 | `src/components/school/SchoolAuditorsListView.tsx` |
| 一覧・並び替え | `src/components/school/SchoolAuditorsListSection.tsx` |
| 監査人カード | `src/components/school/SchoolAuditorDashboardCard.tsx` |
| 未割当クラブカード | `src/components/school/SchoolUnassignedClubDashboardCard.tsx` |
| 監査人ポータル | `src/components/audit/AuditorDashboardView.tsx`（`/audit`） |

- **アクセス経路**: サイドバー「監査人管理」>「監査人ダッシュボード」（`/school/clubs/auditors`）
- **表示形式**: 監査人ごとにカード形式で氏名・部署・連絡先・監査進捗・担当クラブを表示

#### 未割当クラブの可視化

- 全クラブ（`SchoolClubsContext` / `kurasaokaikei-school-clubs`）のうち、いずれの監査人の `assignedClubIds` にも含まれないクラブを `filterUnassignedClubs()` で抽出
- 監査人カード一覧の下に **「未割当クラブ」** セクションを表示
- 各カードの「担当監査人」行に琥珀色バッジ **「未割当」** を表示。点線ボーダーで通常カードと区別
- 監査人が 0 人でも未割当クラブがあれば当該セクションは表示する

#### 担当クラブ数の表示（カードヘッダー）

各監査人カードのヘッダー左側に氏名・監査人 ID、右側に担当クラブ数を縦並びで配置する。

| 要素 | スタイル |
|------|----------|
| ラベル「担当クラブ数」 | `text-xs`（監査人 ID と同サイズ） |
| 数値 | `text-lg font-bold`（氏名と同サイズ） |
| 配置 | `flex flex-col items-center text-center` でラベル幅に対し数値を中央揃え |

担当クラブ名バッジ一覧は従来どおりカード下部に表示（件数の重複表示はヘッダーに集約）。

#### 並び替えと永続化

- **UI**: 登録済みクラブ一覧と同様の HTML5 ドラッグ＆ドロップ。カード左上にグリップアイコン（`GripVertical`）と順序番号を表示
- **控え一覧**: 監査人登録画面（`SchoolAuditorsAccountBackupSection`）のテーブル行でも同様に並び替え可能
- **保存**: ドロップ確定時に `setSchoolAuditorsOrder()` → `applyAuditorDisplayOrder()` で配列順を `order` に反映 → `saveAll()` で即保存
- **ストレージ**: デモ校は `localStorage` キー `school_auditors`、新規校はワークスペース blob 内 `auditors` 配列
- **読み込み**: `loadSchoolAuditors()` は `order` 昇順でソート（旧 `updatedAt` 降順ソートは廃止）
- **同期**: 保存成功時に `SCHOOL_AUDITORS_CHANGED_EVENT` を発火。一覧は `refresh()` で再読み込み
- **監査人ポータル（`/audit`）**: `AuditorDashboardView` が `SCHOOL_AUDITORS_CHANGED_EVENT` を購読し、担当クラブ ID を `getSchoolAuditorById()` から取得。マスタの `assignedClubIds` 配列順でクラブカードを表示

**並び替え永続化の不具合修正（2026-06-18）**: 並び替え直後に旧 `order` 値で再ソートされ順序がリセットされていた問題を修正。`setSchoolAuditorsOrder()` が配列インデックスを `order` に書き込んでから保存するよう変更。

#### 操作ボタン（カードフッター）

各監査人カード下部に、クラブダッシュボードと統一感のある操作ボタンを配置する。

| 領域 | 幅 | 内容 |
|------|-----|------|
| 左半分 | 50% | **メッセージBOX**（`bg-sky-500` / `hover:bg-sky-600`、クラブカードと同スタイル） |
| 右半分 | 50%（各25%） | **編集**（グレー背景） / **削除**（薄赤・アウトライン） |

- **メッセージBOX**: `schoolAuditorComposeMessagePath(auditorId)` へ遷移し、学校管理者ポータルの監査人宛てメッセージ作成画面を開く
- **編集**: 監査人登録画面 `?edit={id}` へ遷移
- **削除**: `ActionConfirmDialog` 経由で確定後 `deleteSchoolAuditor()` を実行

実装: `SchoolAuditorDashboardCard.tsx` フッター、`SchoolAuditorsListSection.tsx` から各ハンドラを渡す。

---

## 4.5 クラブダッシュボード（一覧）

実装ファイル:

| レイヤー | ファイル |
|----------|----------|
| ページ | `src/app/school/clubs/page.tsx` |
| 画面 | `src/components/school/SchoolClubListView.tsx` |
| カード一覧 | `src/components/school/SchoolClubDashboardListSection.tsx` |
| クラブカード | `src/components/school/SchoolClubDashboardCard.tsx` |
| 未割当クラブカード | `src/components/school/SchoolUnassignedClubDashboardCard.tsx`（監査人ダッシュボード §4.4 でも利用） |

- **アクセス経路**: サイドバー「クラブ管理」>「クラブダッシュボード」（`/school/clubs`）、またはポータルトップのメニューカード
- **表示形式**: グループタブ付きカードグリッド（`md:grid-cols-2` / `lg:grid-cols-3`）

#### クラブカードの表示項目（2026-06-20 改定）

| 項目 | 仕様 |
|------|------|
| ヘッダー | クラブ名 + クラブ ID（mono） |
| **監査ステータス** | カード上部の強調エリア（`SettlementAuditStatusBadge`）。未提出 / 監査中 / 差戻 / 承認済 |
| 部員数 | 在籍部員数 |
| 操作 | 「クラブページへ」（ピンク）/ 「メッセージBOX」（青） |

**削除済**: 「当期の決算提出状況」行（未提出 / 監査中バッジ）は監査ステータスと重複するため **完全削除**。学校管理者ポータルでは監査ステータスのみを表示する。

#### ポータルトップの監査進捗サマリー

`/school` 上部の `SchoolAuditProgressSummary` も監査ステータス（未提出・監査中・差戻・承認済）の件数集計のみを表示する。補助説明文は「学内全クラブの監査ステータス（localStorage から自動集計）」。

---

## 5. 監査人ポータル（`/audit`）メッセージBOX

実装ファイル:

| レイヤー | ファイル |
|----------|----------|
| ページ | `src/app/audit/messages/page.tsx` |
| ルーティング | `src/components/audit/AuditorMessagesView.tsx` |
| 一覧 | `src/components/audit/AuditorMessagesListView.tsx` |
| 下書き | `src/components/audit/AuditorMessagesDraftsView.tsx` |
| クラブ宛作成 | `src/components/audit/AuditorClubComposeForm.tsx` |
| 学校宛作成 | `src/components/audit/AuditorSchoolComposeForm.tsx` |
| データ層 | `src/lib/portalMessages.ts`, `src/lib/auditorDraftMessages.ts` |
| テーマ | `src/lib/auditorTheme.ts`（`AUDIT_MESSAGE_BOX_ACCENT` = `#EA580C`） |

### 5.1 画面構成（学校管理者ポータルと統一）

監査人メッセージBOX（`/audit/messages`）は、学校管理者メッセージBOX（`/school/messages`）と **同一の1カラムレイアウト** を採用する。

```
MessageBoxTitleBand（オレンジアクセント）
  ↓
SchoolPortalSegmentTabs（クラブ宛て / 学校管理者宛て）
  ↓
新規作成ボタン（タブ直下・カード左上）
  ↓
単一ホワイトカード（左ボーダー5px + ヘッダー「〇〇宛て送信履歴」）
  ↓
SchoolMessageHistoryList（共通テーブルUI）
```

- 左右分割のサイドバー（チャット相手リスト）は **採用しない**
- タブコンポーネントは `SchoolPortalSegmentTabs` を学校側と共通利用
- 履歴テーブル・空状態文言（「メッセージがありません」）は `SchoolMessageHistoryUi` を共通利用
- アクセント色のみ監査人テーマ（オレンジ `#EA580C`）に差し替え

### 5.2 タブと表示データ

| タブ | ヘッダータイトル | 新規作成ボタン | 履歴データ |
|------|-----------------|----------------|-----------|
| クラブ宛て | クラブ宛て送信履歴 | クラブへ新規作成 | `loadAuditorOutboundMessages()` — 担当クラブへの送信済み |
| 学校管理者宛て | 学校管理者宛て送信履歴 | 学校管理者へ新規作成 | `loadAuditorSchoolConversationMessages()` — 学校からの受信 + 監査人から学校への送信 |

**学校管理者宛てのデータ規約**（`portalMessages.ts`）:

- 監査人→学校送信先 ID: `SCHOOL_ADMIN_TARGET_ID`（`"school-admin"`）
- 送信関数: `sendAuditorToSchoolMessage()`
- 学校→監査人受信: 既存の `audience: "auditor"` メッセージ（`getMessagesForAuditor` 系）

### 5.3 作成画面・URL クエリ

| 用途 | URL |
|------|-----|
| クラブ宛て新規作成 | `/audit/messages?compose=1&to={clubId}` |
| 学校管理者宛て新規作成 | `/audit/messages?compose=school` |
| 下書き編集 | `/audit/messages?draft={draftId}` |
| 下書き一覧 | `/audit/messages/drafts` |

下書きは `auditor_draft_messages`（`auditorDraftMessages.ts`）に保存。学校宛下書きは `targetId: "school-admin"` で識別。

### 5.4 詳細表示

一覧行クリック時は `SchoolMessageDetailPanel` を全画面表示。受信メッセージは `counterpartyFieldLabel="送信元"`、送信メッセージは `"送信先"` を表示。

---

## 6. 監査人ポータル ダッシュボード

実装: `src/components/audit/AuditorDashboardView.tsx`

- **監査進捗サマリー**: `AuditorAuditProgressSummary` — 担当クラブの未提出・監査中・承認済・差戻の件数をカード表示
- **担当クラブ一覧**: マスタ `assignedClubIds` の配列順で `AuditorClubDashboardCard` を表示
- **同期**: `SCHOOL_AUDITORS_CHANGED_EVENT` 購読により、学校側での並び替え・割当変更を即反映

---

## 7. 現在の状態（セーブポイント）

| 項目 | 状態 |
|------|------|
| サイドメニュー再編 | **完了** — 「クラブ管理」「監査人管理」への階層化を反映済み |
| 監査人登録機能 | **完了** — 登録・更新・削除、連続登録、イベント連動、ワークスペース分岐 |
| 監査人ダッシュボード（学校側） | **完了** — 未割当クラブ表示、担当クラブ数 UI、並び替え永続化、操作ボタン（メッセージBOX/編集/削除） |
| 監査人ポータル連携 | **完了** — `/audit` でマスタの担当クラブ順を反映、監査進捗サマリー表示 |
| 監査人メッセージBOX | **完了** — クラブ宛て/学校管理者宛てタブ、学校側と統一の1カラムUI |
| 画面レイアウト | **正常** — 各ポータルで表示・操作を確認済み |
| 開発サーバー | `npm run dev` で起動・各画面のコンパイル成功を確認 |
| 本ドキュメント | 上記安定時点の仕様を記録（**2026-06-19 セーブポイント**） |

### 7.1 直近の変更履歴

**サイドバー（§2）**

1. **クラブ管理への再編**: 旧トップレベル「クラブダッシュボード」「クラブ登録」を「クラブ管理」親メニュー配下の子項目に統合
2. **監査人管理への再編**: 旧「監査人ダッシュボード」親メニューを「監査人管理」に改名し、子項目に「監査人ダッシュボード」「監査人登録」を配置

**監査人登録（§4）**

1. **`saveAll()` の戻り値とイベント発火**: スコープドワークスペース保存後に `SCHOOL_AUDITORS_CHANGED_EVENT` を明示発火
2. **UI リスナー拡張**: 登録画面・一覧・控え一覧が `SCHOOL_WORKSPACE_CHANGED_EVENT` を購読
3. **確認ダイアログ修正**: `useActionConfirmDialog` の `pendingRef` 化
4. **連続登録対応**: 登録成功後のダッシュボード遷移を廃止

**監査人ダッシュボード・一覧（§4.4）— 2026-06-18〜19**

1. **未割当クラブ表示**: `filterUnassignedClubs()` と `SchoolUnassignedClubDashboardCard`
2. **担当クラブ数 UI**: カードヘッダー右端にラベル（小）・数値（大）
3. **並び替え機能・永続化**: `order` フィールドと `setSchoolAuditorsOrder()` による即保存
4. **操作ボタン（2026-06-19）**: フッターを 50% メッセージBOX + 25% 編集 + 25% 削除の横並びボタンに変更

**監査人メッセージBOX（§5）— 2026-06-19**

1. **タブ追加**: 「クラブ宛て」「学校管理者宛て」の2タブ（`SchoolPortalSegmentTabs` 共通）
2. **学校管理者宛て送信**: `AuditorSchoolComposeForm` + `sendAuditorToSchoolMessage()`
3. **1カラムUI統一**: 学校管理者ポータルと同構造（タブ → 作成ボタン → 単一カード → 履歴テーブル）。サイドバー式の相手リストは廃止
4. **詳細パネル**: `SchoolMessageDetailPanel` に `counterpartyFieldLabel` を追加し送受信の表示を区別

**監査人ダッシュボード（§6）— 2026-06-19**

1. **監査進捗サマリー**: `AuditorAuditProgressSummary` をダッシュボード上部に配置

**学校クラブダッシュボード（§4.5）— 2026-06-20**

1. **「当期の決算提出状況」の削除**: `SchoolClubDashboardCard` / `SchoolUnassignedClubDashboardCard` から重複行を除去
2. **監査ステータスの強調表示**: カード上部に `SettlementAuditStatusBadge` を配置し、監査ステータスを主表示に統一
3. **監査進捗サマリー文言**: 補助説明から「決算提出」を削除し監査ステータスのみに

---

## 8. 関連ドキュメント

プロジェクト内のその他仕様書（参考）:

- `docs/README.md` — ドキュメント索引
- `docs/spec_latest.md` — 直近の確定仕様
- `docs/system-grand-spec.md` — 全システム統合仕様
- `docs/LATEST_SYSTEM_SPEC.md` — 最新システム仕様
- `docs/routes.md` — ルート一覧
- `docs/project-structure.md` — プロジェクト構造

本 `school-portal-specification.md` は、**学校管理者ポータル（監査人管理・メッセージBOX UI 含む）の詳細仕様** を記録したドキュメントです。直近の横断的な変更は `docs/spec_latest.md` を正本として参照してください。

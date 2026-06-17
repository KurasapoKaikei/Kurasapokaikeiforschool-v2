# クラサポ会計 — 学校管理者ポータル 仕様書

**文書バージョン**: 2026-06-17（サイドメニュー再編・監査人登録修正完了時点）  
**対象範囲**: `/school` 配下の学校管理者ポータル

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
- **登録項目（すべて必須）**: 氏名、部署、電話番号、メールアドレス、担当クラブ（1件以上）
- **担当クラブ制約**: 他の監査人に既に割り当て済みのクラブは選択不可（編集時は自監査人の担当分は選択可能）
- **メール重複チェック**: 同一メールアドレスの二重登録を拒否（編集時は自身を除外）
- **確認ダイアログ**: 登録・更新・削除は `ActionConfirmDialog`（`useActionConfirmDialog`）経由で確定
- **保存後遷移**: 登録・更新成功後は監査人ダッシュボード（`/school/clubs/auditors`）へ遷移
- **編集モード**: 控え一覧の編集ボタン、または `?edit={監査人ID}` クエリでフォームに既存データを読み込み

### 4.2 登録ロジック（`schoolAuditors.ts`）

| 関数 | 役割 |
|------|------|
| `addSchoolAuditor()` | 新規監査人を作成。ID は `AUD-0001` 形式で採番。初期パスワードを自動生成 |
| `updateSchoolAuditor()` | 既存監査人を更新 |
| `deleteSchoolAuditor()` | 監査人を削除 |
| `saveAll()` | 永続化の共通入口。成功時 `true`、書き込み不可時 `false` を返す |

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

---

## 5. 現在の状態

| 項目 | 状態 |
|------|------|
| サイドメニュー再編 | **完了** — 「クラブ管理」「監査人管理」への階層化を反映済み |
| 監査人登録機能 | **完了** — 登録・更新・削除、イベント連動、ワークスペース分岐を修正済み |
| 画面レイアウト | **正常** — `SchoolAppShell` によるサイドバー + ヘッダー構成で表示確認済み |
| アコーディオン動作 | **正常** — 親メニューの展開/折りたたみ、現在地ハイライトが動作 |
| 開発サーバー | `npm run dev` で起動・各画面のコンパイル成功を確認 |
| 本ドキュメント | 上記安定時点の仕様を記録（2026-06-17） |

### 5.1 直近の変更履歴

**サイドバー（§2）**

1. **クラブ管理への再編**: 旧トップレベル「クラブダッシュボード」「クラブ登録」を「クラブ管理」親メニュー配下の子項目に統合
2. **監査人管理への再編**: 旧「監査人ダッシュボード」親メニューを「監査人管理」に改名し、子項目に「監査人ダッシュボード」「監査人登録」を配置

**監査人登録（§4）**

1. **`saveAll()` の戻り値とイベント発火**: スコープドワークスペース保存後に `SCHOOL_AUDITORS_CHANGED_EVENT` を明示発火。書き込み不可時は `false` を返す
2. **UI リスナー拡張**: 登録画面・一覧・控え一覧が `SCHOOL_WORKSPACE_CHANGED_EVENT` を購読
3. **確認ダイアログ修正**: `useActionConfirmDialog` の `pendingRef` 化により、登録確定時のコールバックが最新フォーム状態を参照

---

## 6. 関連ドキュメント

プロジェクト内のその他仕様書（参考）:

- `docs/system-grand-spec.md` — 全システム統合仕様
- `docs/LATEST_SYSTEM_SPEC.md` — 最新システム仕様
- `ROUTES.md` — ルート一覧
- `PROJECT_STRUCTURE.md` — プロジェクト構造

本 `SPECIFICATION.md` は、**サイドメニュー再編および監査人登録修正完了後の学校管理者ポータルの安定スナップショット** を目的としたドキュメントです。

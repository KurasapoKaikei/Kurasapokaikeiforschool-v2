# クラサポ会計 — 最新仕様書

**文書バージョン**: 2026-06-20  
**対象範囲**: 学校管理者ポータル（`/school`）、クラブポータル（`/club`）、監査人ポータル（`/audit`）

本書は、初期データ方針の変更・部員 CSV 一括登録プレビュー・作業者ログ連動など、直近の開発・修正を反映した最新仕様です。学校ポータル詳細は `SPECIFICATION.md`（2026-06-19 セーブポイント以降の追記含む）も併せて参照してください。

---

## 1. システム概要

クラサポ会計は、大学・学校の部活動会計を Web 上で管理する Next.js 14（App Router）アプリケーションです。  
デモ・本番を問わず、**データ正本はブラウザの `localStorage`**（学校ワークスペース blob 含む）に保持されます。

| ポータル | ベース URL | 主な利用者 |
|----------|-----------|-----------|
| 学校管理者 | `/school` | 学校担当者 |
| クラブ | `/club` | 部活担当者 |
| 監査人 | `/audit` | 監査担当者 |

---

## 2. 初期データ状態の定義

### 2.1 基本方針

**LocalStorage をクリア（Clear site data）した直後の状態では、いかなるデモデータも自動投入しない。**  
ユーザーが手動で登録・設定するまで、以下のマスタ・業務データは **すべて空（データなし）** からスタートする。

| データ種別 | 主な localStorage キー / 保存先 | 初期状態 |
|-----------|----------------------------------|---------|
| 学校マスタ | `kurasaokaikei-school-masters` | **空**（キーなし） |
| クラブ | `kurasaokaikei-school-clubs`（デモ校）/ ワークスペース blob | **空配列 `[]`** |
| クラブグループ | `kurasaokaikei-school-club-groups` | **空配列 `[]`** |
| 監査人 | `school_auditors` | **空配列 `[]`** |
| カテゴリー | `classapo_categories` | **空配列 `[]`** |
| 科目 | `classapo_account_titles` | **空配列 `[]`** |
| 担当者名簿（クラブ） | `classapo_club_profile` | **未設定**（`staffNames: []`） |
| 部員 | クラブ ID スコープキー | **空配列 `[]`** |

### 2.2 廃止した自動投入処理

以下は **完全に削除** 済みであり、起動時・ログイン時・ページマウント時にも実行されない。

- `src/lib/demoDataSeed.ts`（`ensureDemoDataSeeded()` / `reseedDemoData()`）
- ラグビー部・AUD-0001 等のハードコード初期クラブ／監査人
- Context マウント時の空データ上書き保存（`SchoolClubsContext` / `SchoolClubGroupsContext` 等）

### 2.3 空状態を維持する実装要点

| ファイル | 挙動 |
|----------|------|
| `src/lib/schoolMasters.ts` | `ensureSchoolMastersSeeded()` — 既存マスタが **1件もない** 場合は書き込まない |
| `src/contexts/SchoolClubsContext.tsx` | 読込のみ。マウント時の自動 `saveSchoolClubs()` なし |
| `src/contexts/SchoolClubGroupsContext.tsx` | ユーザー操作時のみ `saveSchoolClubGroups()` |
| `src/app/club/settings/category/page.tsx` | 初回読込では `saveCategories()` しない |
| `src/app/club/settings/account-titles/page.tsx` | 初回読込では `saveAccountTitles()` しない |
| `src/utils/localStorage.ts` | キー未存在時は `[]` を返すのみ（デフォルト科目・カテゴリーの注入なし） |
| `src/contexts/UserInfoContext.tsx` | デフォルト `organizationName` は `""` |

### 2.4 空状態でも動作する操作

- 学校管理者ログイン（`admin` / 空欄等）— クラブ・監査人がなくてもログイン可能
- クラブ・監査人・カテゴリー・科目の **手動登録** — 空状態から順次追加
- メッセージ BOX — 初回のみ空配列 `[]` へのリセットマーカー処理（`PortalMessageStorageInit`）。クラブ・監査人データには非接触

### 2.5 開発時の注意（キャッシュ）

ソース修正後も古い JS が残る場合がある。症状: Clear site data 後もデモクラブが復活する。

1. `.next` フォルダを削除
2. `npm run dev` を再起動（古い dev サーバーがポート 3000 に残っていないか確認）
3. ブラウザで Hard Reload（Ctrl+Shift+R）

PWA / Service Worker 設定は **未使用**（`next.config.js` に該当設定なし）。

---

## 3. 部員管理 ＞ 部員登録（CSV 一括登録）

**画面 URL**: `/club/members/register`（CSV タブ）  
**実装**: `src/app/club/members/register/page.tsx`

### 3.1 概要

CSV ファイルをアップロードした直後に **即時保存しない**。  
パース結果を画面上の **プレビューテーブル** で確認し、ユーザーが「登録する」を押したときのみ一括登録を実行する。

### 3.2 操作フロー

```
1. テンプレート CSV をダウンロード（列: 氏名, 学年, メールアドレス）
2. CSV をドラッグ＆ドロップまたはファイル選択でアップロード
3. クライアント側でパース → バリデーション → プレビュー表示（ステップ3）
4. ユーザーが内容を確認
   ├ 「登録する」→ 有効行のみ addMember() で一括保存
   └ 「キャンセル」→ プレビューを破棄し、別ファイルを選択可能
```

### 3.3 プレビューテーブル

| 列 | 内容 |
|----|------|
| No. | 行番号 |
| 氏名 | CSV 氏名列（未入力は赤字「未入力」） |
| 学年 | 1〜4 学年ラベル（不正時は「-」） |
| メールアドレス | 任意（空欄は「—」） |
| 状態 | 行ごとのバリデーション結果（「登録可」またはエラー文言） |

- エラー行は背景を赤系で強調
- エラーがある行は **登録対象外**（「登録する」ボタンはエラー行がある間 disabled）
- 有効行数をボタンラベルに表示（例: `登録する（12名）`）

### 3.4 ボタン配置（プレビュー下部）

| ボタン | 動作 |
|--------|------|
| **登録する** | `validRows` のみ `addMember()`。成功後は件数メッセージ表示 |
| **キャンセル** | プレビュー・ファイル名・パース状態をリセット。別 CSV を選択可能 |

### 3.5 登録後

- 成功時: 「○名の部員を一括登録しました」＋「別の CSV を登録」で再投入可能
- 「最近の登録」一覧（直近 5 件）を更新

---

## 4. 設定 ＞ 担当者設定 と ログ連動

### 4.1 担当者設定（マスタ）

**画面 URL**: `/club/settings/staff`  
**実装**: `src/app/club/settings/staff/page.tsx`  
**保存先**: `classapo_club_profile`（`staffNames` 配列、最大 5 名）

| 項目 | 仕様 |
|------|------|
| 担当者 1 | **必須** |
| 担当者 2〜5 | 任意（空欄は保存しない） |
| 保存 | `UserInfoContext.updateStaffNames()` 経由 |

担当者名簿は **作業者選択モーダルの選択肢** および **作業者ラベル解決** の元データとなる。

### 4.2 クラブログイン時の作業者選択モーダル

クラブ ID・パスワードでログインし、クラブポータル（`/club/*`）に入った **セッション開始時** に、今から作業する担当者を選択するモーダルを表示する。

| 項目 | 内容 |
|------|------|
| 表示条件 | クラブログイン済み ＋ 担当者名簿が 1 名以上 ＋ 当該 clubId の作業者セッション未宣言 |
| 非表示 | `/club/login`、学校/監査人なりすまし閲覧、担当者 0 名 |
| UI | チェックボックスで **複数選択** 可。「確定する」でセッション保存 |
| 実装 | `ClubCurrentWorkersGate` → `ClubCurrentWorkersDialog`（`ClubAppShell` に組込み） |

**ストレージ**: `kurasaokaikei-current-workers`（clubId 単位の JSON）

```json
{
  "club-1234": {
    "workerNames": ["山田 太郎", "佐藤 花子"],
    "declaredAt": "2026-06-20T12:00:00.000Z"
  }
}
```

**セッションクリアタイミング**:

- 当該クラブでの再ログイン時（`clubLoginSession.ts`）
- クラブログアウト時（`clubLogout.ts`）

担当者名簿が 0 名の場合はモーダルをスキップし、作業者ラベルは後述フォールバックを使用。

### 4.3 入出金登録との連動（作業者列）

**登録履歴 URL**: `/club/accounting/register/history`  
**データ**: 取引レコードの `createdBy` / `updatedBy` フィールド（`src/utils/localStorage.ts`）

| タイミング | 記録される作業者 |
|-----------|-----------------|
| 入出金 **新規登録** | `UserInfoContext.currentOperatorName` → `createdBy` |
| 入出金 **編集** | `updatedBy` に `currentOperatorName` |
| 振替・CSV 編集等 | 同上 |

**`currentOperatorName` の解決順**:

1. 作業者セッションで宣言済みの担当者名（複数時は「、」区切り。例: `山田 太郎、佐藤 花子`）
2. 未宣言時: 担当者設定の先頭名
3. それもなければ: `"管理者"`

**関連実装**:

| ファイル | 役割 |
|----------|------|
| `src/lib/currentWorkersSession.ts` | 作業者セッション CRUD・ラベル整形 |
| `src/contexts/UserInfoContext.tsx` | `currentWorkers` / `currentOperatorName` 提供 |
| `src/app/club/accounting/register/new/page.tsx` | 登録時 `createdBy` 付与 |
| `src/components/accounting/EditTransactionModal.tsx` | 編集時 `updatedBy` 付与 |
| `src/app/club/accounting/register/history/page.tsx` | 履歴「作業者」列表示 |

---

## 5. 関連ドキュメント

| ファイル | 内容 |
|----------|------|
| `SPECIFICATION.md` | 学校管理者ポータル詳細（監査人管理・メッセージ BOX 等） |
| `docs/LATEST_SYSTEM_SPEC.md` | システム全体仕様（参考） |
| `docs/system-grand-spec.md` | 統合仕様 |
| `ROUTES.md` | ルート一覧 |

---

## 6. 変更履歴（2026-06-20）

1. **初期データ完全廃止** — デモ自動投入モジュール削除、空状態維持の防御的修正
2. **部員 CSV 一括登録** — アップロード後プレビュー確認 → 登録する / キャンセル
3. **作業者ログ連動** — ログイン時担当者選択モーダル、入出金履歴への `createdBy` 自動記録
4. **開発キャッシュ** — `.next`  stale バンドルによるデモ復活問題を解消（運用手順を §2.5 に記載）

# クラサポ会計 システム仕様書（実装正本）

| 項目 | 内容 |
| --- | --- |
| ドキュメント | `docs/system_spec.md`（本書） |
| 対象 | クラサポ会計 Next.js アプリ（クライアント LocalStorage デモ実装） |
| 版 | **v3.0**（2026-05 確定） |
| 位置づけ | **セッション分離・決算ワークフロー・監査人連携・UI/バグ修正**の現行実装を正とする正本。会計帳簿・集金等の詳細は `docs/spec.md` を併読。 |

---

## 1. 基本構造とセキュリティ（セッション永続化）

### 1.1 ポータル間 localStorage / sessionStorage の完全隔離

各ポータルが同一オリジンで動作するため、認証・業務データのキー衝突を防ぐ。**他ポータルのキーを読み書き・削除しない**（`localStorage.clear()` は使用しない）。

**実装の単一正本**: `src/lib/portalSessionStorage.ts`（`PORTAL_SESSION_KEYS`）

| ポータル | 用途 | 正本キー（localStorage） | レガシー移行元（読取時のみ） |
| --- | --- | --- | --- |
| クラブ | ログインセッション | `club_current_session` | `kurasaokaikei-current-club` |
| 監査人 | ログインセッション | `auditor_current_session` | `kurasaokaikei-current-auditor` |
| 学校管理者 | 管理者ログイン | `school_admin_session` | `kurasaokaikei-school-admin-session` |
| 学校 | 学校マスタ・契約 | `school_current_session` | `current_school` |
| 学校 | 表示用ユーザー | `school_current_user` | `current_school_user` |
| クラブ閲覧 | なりすまし（監査人/学校） | `club_portal_impersonation`（**sessionStorage**） | `kurasaokaikei-school-impersonate-club` |

> **補足（ドキュメント上の呼称）**: 要件資料では `club_current_user` / `club_auth_token` 等の名称が使われる場合があるが、**現行実装は上表の JSON セッションキー1本**（クラブは `club_current_session` に `{ id, name, groupNames }` を格納）。トークン分割キーは未使用。

**主要モジュール**

| モジュール | 役割 |
| --- | --- |
| `src/lib/clubLoginSession.ts` | クラブログイン・`establishClubLogin` / `clearCurrentClub`（明示ログアウト時のみ） |
| `src/lib/currentAuditor.ts` | 監査人セッション |
| `src/lib/schoolLoginSession.ts` | 学校管理者セッション |
| `src/lib/currentSchool.ts` | 学校データ |
| `src/lib/schoolClubSession.ts` | なりすまし閲覧（sessionStorage） |
| `src/lib/clubPortalAccess.ts` | 閲覧モード判定・戻り先 URL |

**禁止事項（バグ再発防止）**

- 監査人・学校が「クラブページへ」遷移する際に **`clearCurrentClub()` を呼ばない**（クラブ本人ログインを破壊しない）。
- なりすまし終了時は **`clearImpersonatedClub()` のみ**（sessionStorage）。
- 学校ログイン時に監査人セッションを自動削除しない（ポータル間の巻き込みログアウト防止）。

### 1.2 セッション有効期限（自動ログアウト）

- **自動ログアウト（セッションタイムアウト）は実装していない**（無期限）。
- ログアウトは各ポータル右上の「ログアウト」操作時のみ、当該ポータル専用キーを削除。
- F5 リロード・ブラウザ再起動後も、localStorage / sessionStorage に残っている限りログイン状態を維持。

### 1.3 ロゴ下ポータル名

クラブ・学校・監査人の各シェルヘッダーで、ロゴ直下にポータル名（例: **クラブポータル**）を表示（監査人ポータルと同系のスタイル）。

---

## 2. 決算ワークフロー共通仕様（`club_workflow_status`）

### 2.1 共有キーとデータ形状

| 項目 | 仕様 |
| --- | --- |
| ストレージ | `localStorage` |
| キー | **`club_workflow_status`**（正本） |
| 形式 | `Record<clubId, ClubWorkflowRecord>` の JSON |
| レコード | `{ status, hadRejection?, resubmittedAfterReject? }` |

**ステータス列挙（`ClubWorkflowStatus`）**

| 値 | 意味 | 学校側 `ClubSettlementStatus` |
| --- | --- | --- |
| `EDITING` | 作成中 | `draft` |
| `SUBMITTED` | 提出済 | `submitted` |
| `REJECTED` | 差戻し | `rejected` |
| `APPROVED` | 承認済 | `approved` |

**更新 API（必ず経由）**

- 正本更新: `setClubWorkflowStatus(clubId, status, options?)` — `src/lib/clubWorkflowStatus.ts`
- 学校側同期: `setClubSettlementFromWorkflow` — `src/lib/schoolClubSettlement.ts`
- 変更通知: `CLUB_WORKFLOW_CHANGED_EVENT` / `SETTLEMENT_CHANGED_EVENT`（`window` カスタムイベント + `storage`）

### 2.2 リアルタイム連動（双方向）

| 操作 | トリガー | `club_workflow_status` | クラブ側 | 監査人側 |
| --- | --- | --- | --- | --- |
| クラブ提出 | 「決算データを提出する」 | `SUBMITTED` | 編集ロック・3ステップ | 承認/差戻が可能に |
| 監査人承認 | 確認後 OK | `APPROVED` | 全域編集ロック・承認済警告 | カード背景 `bg-gray-50` |
| 監査人差戻 | 確認後 OK | `REJECTED` + `hadRejection` | 編集ロック解除・5ステップ | 差戻バッジ（黄） |

---

## 3. クラブポータル：決算ページ UI・UX・ロック

**画面**: `/club/settlement` — `src/components/club/ClubSettlementView.tsx`  
**進捗 UI**: `src/components/club/ClubSettlementProgressSteps.tsx`  
**シェル**: `src/components/layout/ClubAppShell.tsx`

### 3.1 画面構成（上から）

1. **担当監査人** — オレンジ左縦線アクセント、大きく「部署　氏名」（未割当時はデモ: 教務課　山田太郎）。
2. **現在のステータス** — 動的ステップバー + 説明文 + 差戻し理由（該当時）。
3. **「決算データを提出する」** — `EDITING` / `REJECTED` のみ活性。`SUBMITTED` / `APPROVED` は disabled。

### 3.2 動的進捗フロー（ステップ UI）

| 条件 | ステップ |
| --- | --- |
| 通常 | `[作成中] → [提出済] → [承認済]`（3段） |
| `hadRejection` または `status === REJECTED` | `[作成中] → [提出済] → [差戻し] → [提出済(再)] → [承認済]`（5段） |

**差戻し現在地（`REJECTED`）**

- 「作成中」「提出済」: ハイライト（ピンク系 `highlight`）。
- 「差戻し」: アクティブ（オレンジ `rejected`）。
- 「提出済(再)」「承認済」: 薄グレー（`pending`）。

### 3.3 編集ロック（SUBMITTED / APPROVED）

**判定**: `isClubPortalEditLocked(clubId)` → `SUBMITTED` または `APPROVED`

| 状態 | 警告バナー | 編集オーバーレイ | 対象パス |
| --- | --- | --- | --- |
| `SUBMITTED` | 提出済文言（赤系） | 入出金・集金・予実・設定系 | `isClubSettlementLockPath` |
| `APPROVED` | **承認済文言（灰系）** | **クラブポータル全域**（`/club`、login 除く） | 全域 |

**承認済の警告文（確定文言）**

```text
⚠️ 単年度の決算データは【承認済み】のため、すべての編集操作がロックされています（閲覧モード）。
```

定数: `CLUB_SETTLEMENT_APPROVED_LOCK_WARNING` — `src/lib/clubWorkflowStatus.ts`  
表示: `src/components/club/ClubSettlementLockBanner.tsx`

**提出済の警告文**

```text
⚠️ 当年度の決算データは提出済みのため、新規登録・編集・削除はできません（閲覧モード）。内容を修正したい場合は、担当監査人に『差戻し』を依頼してください。
```

### 3.4 サイドメニュー（親・子）— ロック対象外（重要）

**コンポーネント**: `src/components/layout/Sidebar.tsx`

| 項目 | 仕様 |
| --- | --- |
| ナビゲーション | **常に許可**（`isClubPortalNavigationBlocked` は常に `false`） |
| 親メニュー | タイトル部分は `<Link>` で遷移、右端シェブロンで **開閉トグル**（ワークフロー state と独立） |
| 子メニュー | `<Link prefetch>` で各子ルートへ遷移 |
| `EDITING` / `REJECTED` | 全親・子リンク **完全活性** |
| `SUBMITTED` / `APPROVED` | 遷移・閲覧は可。メイン領域のみ編集オーバーレイ（サイドバーは `z-[200]` で前面） |

**アコーディオン**: ワークフローによる強制全開は行わない。パス一致時のみ自動展開し、ユーザーの手動開閉を維持。

### 3.5 監査人閲覧モード

| 項目 | 仕様 |
| --- | --- |
| バナー | 「**監査人閲覧モード**」— `ClubImpersonationBanner.tsx` |
| 遷移 | `setImpersonatedClub({ viewer: "auditor" })` → sessionStorage |
| 戻る | 「ダッシュボードへ戻る」→ **`/audit`**（`resolveClubPortalDashboardBackHref`） |
| 実装 | `window.location.assign` + `clearImpersonatedClub()`（クラブ localStorage は触らない） |

---

## 4. 監査人ポータル：ダッシュボードカード

**画面**: `/audit` — `src/components/audit/AuditorDashboardView.tsx`  
**カード**: `src/components/audit/AuditorClubDashboardCard.tsx`

### 4.1 カード情報レイアウト

- **削除済**: 重複していた「進捗状況」セクションは表示しない。
- **当期の決算提出状況**: テキストではなく角丸バッジ（提出済＝青、未提出＝灰）。
- **監査ステータス**: `ClubSettlementAuditBadge`（監査中 / 承認済 / 差戻 等）。

### 4.2 下部アクションボタン（左→右）

| 位置 | ラベル | 色 | 動作 |
| --- | --- | --- | --- |
| 左 50% | クラブページへ | **ピンク**（`CLUB_BRAND_PINK`） | 監査人閲覧モードでクラブダッシュボードへ |
| 右 25% | 承認 | **青** `bg-blue-600` | 確認ダイアログ後 `setClubWorkflowStatus(APPROVED)` |
| 右 25% | 差戻 | **黄** `bg-amber-100` | 確認ダイアログ後 `setClubWorkflowStatus(REJECTED)` |

**確認メッセージ**

- 承認: 「このクラブの決算データを承認しますか？」
- 差戻: 「このクラブの決算データを差し戻しますか？クラブ側は再編集が可能になります」

### 4.3 ボタン活性化原則

| `club_workflow_status` | 承認 | 差戻 |
| --- | --- | --- |
| `SUBMITTED` | **活性** | **活性** |
| `EDITING` / `REJECTED` / `APPROVED` | disabled（グレー） | disabled（グレー） |

判定: `canAuditorActOnClubWorkflow` / カード内 `liveWorkflow === "SUBMITTED"`

### 4.4 承認済（APPROVED）カード — アーカイブデザイン

| 項目 | 仕様 |
| --- | --- |
| 背景のみ | `bg-gray-50`（未処理は `bg-white`） |
| 文字・バッジ・ボタン | **不透明度・減衰なし**。色は未処理カードと同一の鮮やかさ |
| 禁止 | カード全体 `opacity-*`、網掛けオーバーレイ、`saturate` によるトーンダウン |
| ホバー | 浮き上がりエフェクトなし（静かな完了感） |

---

## 5. 実装ファイル索引（ワークフロー・セッション）

```
src/lib/portalSessionStorage.ts      # ポータルキー定義・移行ヘルパー
src/lib/clubWorkflowStatus.ts        # club_workflow_status 正本
src/lib/schoolClubSettlement.ts      # 学校側決算ステータス同期
src/lib/auditorClubDashboard.ts      # 監査人承認・差戻 API
src/lib/clubPortalAccess.ts          # 閲覧モード・戻り先
src/lib/activeClubSession.ts         # なりすまし優先の activeClub 解決
src/contexts/ClubSessionContext.tsx  # クラブセッション Context
src/components/layout/ClubAppShell.tsx
src/components/layout/Sidebar.tsx
src/components/club/ClubSettlementView.tsx
src/components/club/ClubSettlementProgressSteps.tsx
src/components/club/ClubSettlementLockBanner.tsx
src/components/layout/club/ClubImpersonationBanner.tsx
src/components/audit/AuditorDashboardView.tsx
src/components/audit/AuditorClubDashboardCard.tsx
src/components/audit/ClubSettlementAuditBadge.tsx
```

---

## 6. 変更履歴（本書 v3.0）

| 日付 | 内容 |
| --- | --- |
| 2026-05 | ポータル間 localStorage キー分離、セッション衝突・サイドメニューフリーズ修正 |
| 2026-05 | `club_workflow_status` 正本化、監査人承認・差戻し、5ステップ進捗 UI |
| 2026-05 | サイドメニュー開閉とワークフロー分離、APPROVED 全域ロック・承認済警告文 |
| 2026-05 | 監査人承認済カード `bg-gray-50` アーカイブ（視認性維持） |

---

## 7. 関連ドキュメント

- `docs/spec.md` — 会計・集金・帳簿の機能詳細（v2 系）
- `docs/specifications/club_portal_message_box.md` — メッセージ BOX
- `docs/specifications/school_onboarding_spec.md` — 学校オンボーディング

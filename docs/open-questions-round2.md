# 確認事項シート（第 2 回）— 回答待ちの項目のみ

**作成日**: 2026-08-19
**作成者**: インフラ担当
**回答者**: 本会計ソフトを構築した担当者
**前回**: [`open-questions.md`](./open-questions.md)（回答済み。ありがとうございました）

---

## この文書について

第 1 回で**未回答だった 5 項目だけ**を抜き出しました。それ以外は回答をもとに確定済みです。

**Q-1 と Q-2 が埋まれば `prisma/schema.prisma` を確定できます。** 残りは後追いで構いません。

| # | 項目 | 優先度 | 前回の番号 |
|---|------|--------|-----------|
| Q-1 | `Transaction` の不足フィールド 13 個の確認 | **最優先** | A-5 |
| Q-2 | localStorage キーの棚卸し漏れ | **最優先** | A-6 |
| Q-3 | 集金設定の 4 フィールドの要否 | 中 | A-7-3 |
| Q-4 | 旧形式で保存されたメッセージの実在 | 低 | C-1 |
| Q-5 | 銀行 CSV の実サンプル送付 | 低 | B-1-1 |

---

# Q-1 ★ `Transaction` の不足フィールド 13 個（前回 A-5）

`src/utils/localStorage.ts:62-112` の `Transaction` にはあるが、`prisma/schema.prisma` に無いフィールドです。**これが欠けると振替・繰延・集金の帳簿横連動が再現できません。**

## (1) 用途の確認

各行の「用途（こちらの理解）」が合っているか、○ / × でお答えください。**× の場合は正しい説明をお願いします。**

| # | フィールド | 用途（こちらの理解） | ○/× | 訂正・補足 |
|---|-----------|-------------------|------|-----------|
| 1 | `transferGroupId` | 振替の対（出金 + 入金の 2 行）を束ねる ID。同一 ID を持つ 2 件で 1 つの振替 | | |
| 2 | `deferredPlSide` | 繰延計上の収支区分（`income` / `expense`） | | |
| 3 | `deferredPlCategory` | 繰延計上のカテゴリー名 | | |
| 4 | `deferredPlSubject` | 繰延計上の科目名 | | |
| 5 | `deferredRecordId` | 精算が対象とする「計上仕訳」の ID | | |
| 6 | `deferredSettlementMode` | 預り金の精算区分（`period`=当期計上・現金影響なし / `refund`=返金・現金出金） | | |
| 7 | `csvImportId` | CSV 一括取込のバッチ紐付け（手動登録時は無し） | | |
| 8 | `originalFileName` | CSV 取込時の元ファイル名 | | |
| 9 | `collectionMemberId` | 集金取引 → 部員へのドリルダウン用 | | |
| 10 | `collectionScheduleId` | 集金取引 → 集金設定へのドリルダウン用 | | |
| 11 | `createdBy` | 登録した作業者の**氏名** | | |
| 12 | `updatedBy` | 最終編集した作業者の**氏名** | | |
| 13 | `lastEditedAt` | 最終編集日時（ISO 文字列） | | |

**回答**:

## (2) 漏れの有無

**この 13 個のほかに、DB 側へ持っていく必要があるフィールドはありませんか。**

とくに以下のような「仕様書に書かれていない暗黙の依存」があれば教えてください。

- `memo` の中身をパースして情報を復元している箇所（`deferredPlSide` のコメントに「無い場合は memo 内の『カテゴリー:』『科目:』から復元する」とあります）
- ID の命名規則に意味を持たせている箇所
- 特定の文字列を目印に使っている箇所

**回答**:

## (3) `createdBy` / `updatedBy` を「氏名の文字列」から「ユーザー ID」に変えてよいか

現状は氏名の文字列です。DB 移行後は**ユーザー ID の外部キー**にしたいと考えています。

**理由**: 担当者が改名・卒業・退部しても、誰が登録したかを追跡できるようにするため。会計の監査証跡として、氏名だけだと同姓同名や改名で辿れなくなります。

**懸念**: 現在は「担当者設定の氏名」を自由入力で持っており（`classapo_current_operator`）、ユーザーアカウントと 1:1 で対応していない可能性があります。

**質問**: 作業者は必ずログインアカウントを持ちますか。それとも「クラブの共有アカウントでログインし、担当者名だけ選ぶ」運用ですか。

**回答**:

---

# Q-2 ★ localStorage キーの棚卸し漏れ（前回 A-6）

移行対象として **58 キー**を特定しました。実際のキー名を全て挙げます。

## (1) この一覧に漏れはありませんか

**クラブ業務データ**（`__{clubId}` が付いてクラブ単位に分離される。15 件）

```
classapo_categories
classapo_account_titles
classapo_transactions
classapo_monthly_notes
classapo_collection_schedules
classapo_collection_records
classapo_system_settings
classapo_budget_settings
classapo_csv_import_batches
classapo_club_profile
classapo_current_operator
classapo_report_remarks
classapo_collection_reset_marker
classapo_csv_member_kana_hints
classapo_members
```

**学校正本**（クラブ非依存。20 件）

```
kurasaokaikei-school-masters
kurasaokaikei-school-clubs
kurasaokaikei-school-club-groups
kurasaokaikei-school-workspaces
kurasaokaikei-school-registrations
kurasaokaikei-school-common-categories
kurasaokaikei-school-common-account-titles
kurasaokaikei-school-allow-club-category-add
kurasaokaikei-school-allow-club-account-title-add
kurasaokaikei-school-club-settlement-status
kurasaokaikei-school-club-settlement-reject-reason
kurasaokaikei-school-settlement-notice-window
kurasaokaikei-school-fiscal-rollover-2026
kurasaokaikei-school-admin-session
kurasaokaikei-club-organization-profiles
kurasaokaikei-current-auditor
kurasaokaikei-current-club
kurasaokaikei-current-workers
kurasaokaikei-last-active-club-session
kurasaokaikei-school-impersonate-club
```

**移行マーカー・リセットマーカー**（4 件）

```
classapo_club_scope_migration_v1
classapo_collection_schedule_fy2026_migration
classapo_collection_schedule_master_repair_marker
classapo_tx_original_filename_backfill
kurasaokaikei-portal-messages-reset-2026-05-v1
```

**そのほか**

- `school_auditors`（監査人。プレフィックスが他と異なります）
- `pending_school_data` / `active_schools`（申込フロー。`schoolRegistration.ts`）
- `kurasaokaikei-verify-result-{token}`（**sessionStorage**。メール認証の一時キャッシュ）

**質問**: 上記に**漏れているキーはありませんか**。とくに以下が気になっています。

- 動的に生成されるキー（ID や年度が名前に埋め込まれるもの）
- 過去バージョンの遺物で、まだ読み込みだけ行っているもの
- `sessionStorage` を使っている箇所（上記 1 件以外）

**回答**:

## (2) マーカー系は移行後に不要という理解で合っていますか

`classapo_club_scope_migration_v1` などの 5 件は、**localStorage 時代の一回限りの移行処理の記録**であり、DB 移行後は不要という理解です。合っていますか。

**回答**:

## (3) デモ校（SCH-79268）のデータは捨ててよいですか

`src/lib/schoolWorkspace.ts` を見ると、**デモ校（`SCH-79268` = クラサポ大学）と新規登録校でデータの持ち方が違います**。

- デモ校: 従来のグローバルキーをそのまま使う
- 新規登録校: `kurasaokaikei-school-workspaces` の blob 内に分離して持つ

さらに `isProtectedDemoSchool()` で「初期化・クリアの対象外」として保護されています。

**質問**

1. デモ校のデータは**移行対象外（捨ててよい）**ですか。それとも本番へ持っていく必要がありますか
2. 持っていく場合、デモ校を「1 つの学校」として登録し直す形でよいですか

**回答**:

---

# Q-3 集金設定の 4 フィールドの要否（前回 A-7-3）

`CollectionSchedule`（`src/utils/localStorage.ts:143-162`）の以下 4 つについてです。

| フィールド | こちらの理解 |
|-----------|------------|
| `groupId` | 同一設定から一括作成されたスケジュールを束ねる ID |
| `memberIds` | 設定時に選択された部員 ID の配列 |
| `memberCount` | 設定時の対象部員数 |
| `monthCount` | 設定時の対象月数 |

**質問**

1. 上記の理解で合っていますか
2. **DB 移行後も必要ですか。** `memberCount` / `monthCount` は `memberIds` と作成期間から再計算できそうに見えますが、**「設定時点の値」として保存しておく意味**（後から部員が増減しても当時の設定を残す等）がありますか
3. `groupId` で束ねた一括作成分を、**まとめて編集・削除する機能**はありますか

**回答**:

---

# Q-4 旧形式で保存されたメッセージは実在しますか（前回 C-1）

`src/lib/portalMessages.ts` の `normalizeSender()` は、`sender` が `"監査"` / `"学校"` / `"クラサポ"` / `"クラサポ会計"` という**日本語の値**で保存されている旧データを、`"audit"` / `"school"` / `"system"` に変換する処理です。

前回報告したとおり、この判定は型定義の不具合で**常に false になっていた**可能性があります（修正済み）。

**質問**

1. `sender` が日本語で保存されていた時期は実際にありましたか
2. その形式のデータが**まだ残っている端末**に心当たりはありますか

> 前回 A-3 で「実運用中の学校は 0 校」と伺ったので、**残っていなければこの変換処理は移行対象から外せます**（コードも削除できます）。

**回答**:

---

# Q-5 銀行 CSV の実サンプル（前回 B-1-1）

「添付の仕方が分からないため後ほど送ります」とのことでした。

**送付方法の候補**

| 方法 | 手順 |
|------|------|
| GitHub に置く | `docs/samples/` フォルダを作り、ファイルをドラッグ&ドロップでコミット |
| Issue に添付 | リポジトリの Issues → New issue → ファイルをドラッグ&ドロップ |
| メール等 | インフラ担当へ直接送付 |

**口座番号・氏名はマスクして構いません。** 知りたいのは以下です。

- 文字コード（Shift_JIS か UTF-8 か）
- 列構成とヘッダー行の有無
- 日付・金額の書式

> なお **Excel 対応は方針が決まりました**。取込時に文字コードを自動判別し、加えてテンプレートを `.xlsx` で配布して直接読み込む形にします。したがって**サンプルが無くても実装は進められます**が、実物で検証できると確実です。急ぎではありません。

**回答**:

---

## 前回の回答で確定した事項（参考・回答不要）

| 前回 # | 決定 |
|--------|------|
| A-1 | 会計期間は**学校ごとに可変**。申込時の**決算日**から算出（例: 8/20 決算 → 8/21〜8/20）。※入力欄は `settlementMonth` / `settlementDay` として**既に存在**しており、会計期間の算出に使われていないだけでした |
| A-2 | 繰越で次年度を生成。過年度は **7 年分**表示。繰越ロジックは新規開発 |
| A-3 | **実運用中の学校は 0 校** → データ移行の作業がほぼ不要に |
| A-4 | 金額は **`Int`（円・負数許容）** |
| A-7 | 部分入金・過入金あり。**1 予定に複数の入金履歴**が必要 |
| B-1 | Excel 対応：**文字コード自動判別 + `.xlsx` テンプレート**で対応 |
| B-2 | **顧問＝クラブ責任者**（監査人とは別）。監査人を挟むかは申込オプション `auditFlow` で分岐 |
| B-3 | 保護者は閲覧のみ。将来はクラブ ID + 部員パスワード（年度ごとに再発行） |
| B-4 | 保存期間 **7 年**。個人情報も同期間 |
| B-5 | 学校共通マスタはクラブ側で編集不可 |
| C-2 | 日付は `YYYY-MM-DD` 文字列のまま |
| C-3 | （インフラ担当側の判断事項でした。回答不要） |
| C-4 | 正規化列 + ユニーク制約でよい |

---

## 改訂履歴

| 版 | 日付 | 内容 |
|----|------|------|
| 1.0.0 | 2026-08-19 | 第 2 回。第 1 回で未回答だった 5 項目を抽出 |

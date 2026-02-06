# プロジェクト構造詳細

## ルーティング設計

### クラブ向けダッシュボード（単体版）
`src/app/(dashboard)/` 配下に配置

#### `/dashboard` - マイページ/全体俯瞰
- **カラー:** Pink (#E66A84)
- **機能:** 会計年度情報、残高、アラート件数の表示

#### `/accounting` - 入出金・帳簿管理
- **カラー:** Green (#A3BC68)
- **機能:**
  - 取引一覧表示（証憑不足の取引は赤く表示）
  - 新規取引入力（`/accounting/new`）
    - AI OCR入力（Gemini 1.5 Flash）
    - 証憑画像アップロード
    - 異常検知アラート表示

#### `/collection` - 集金管理
- **カラー:** Orange (#D99529)
- **機能:** 部員ごとの集金状況管理

#### `/members` - 部員・保護者管理
- **カラー:** Purple (#9D8CC3)
- **機能:** 部員情報の登録・編集・削除

#### `/settings` - 設定・マスター管理
- **カラー:** Blue (#77B8DA)
- **機能:**
  - `/settings/account-titles` - 勘定科目マスター管理
  - `/settings/fiscal-years` - 会計年度管理

### 大学向け統合ダッシュボード（for School版）
`src/app/(university)/` 配下に配置

#### `/university/dashboard` - 統合ダッシュボード
- **カラー:** Pink (#E66A84)
- **機能:** 全クラブの会計状況を一覧表示

#### `/university/approvals` - 承認待ち一覧
- **カラー:** Green (#A3BC68)
- **機能:** 多段階承認フロー
  - クラブ申請 -> 顧問(一次承認) -> 大学(最終決裁)

## データベース設計の要点

### 主要なリレーション

1. **Organization (組織)**
   - クラブ（単体版）または大学（for School版）
   - `allowCustomCategory`: クラブ固有の勘定科目を許可するか
   - `parentId`: 大学版の場合、親組織（大学）のID

2. **User (ユーザー)**
   - `role`: UniversityAdmin, FacultyAuditor, ClubStudent
   - `organizationId`: 所属組織

3. **FiscalYear (会計年度)**
   - `status`: OPEN, PENDING, CLOSED
   - 組織ごとに複数の会計年度を管理

4. **Transaction (取引)**
   - `receiptUrl`: 証憑画像URL（ない場合は赤く表示）
   - `isAlert`: 異常検知フラグ
   - `status`: NORMAL, DEFERRED, SETTLED
   - `approvalStatus`: 承認フロー用（DRAFT, CLUB_PENDING, FACULTY_PENDING, UNIVERSITY_PENDING, APPROVED, REJECTED）
   - `deferredFromId`: 繰延元の取引ID（繰延・精算システム用）

5. **AccountTitle (勘定科目)**
   - `isMaster`: 大学側のマスター科目か
   - `organizationId`: nullの場合はマスター科目、設定されている場合はクラブ固有科目

6. **Approval (承認)**
   - 多段階承認フローを管理
   - `level`: CLUB, FACULTY, UNIVERSITY

## 実装すべき重要ロジック

### 1. AI OCR入力 (`src/lib/gemini.ts`)
- `analyzeReceipt()`: レシート画像を解析して日付・金額・科目を抽出

### 2. リスクベース監査アラート
- `detectAnomalies()`: 二重登録、高額支出、残高不整合を検知
- 証憑がない支出取引は、帳簿上で行全体を赤く(#EF4444)表示

### 3. 繰延・精算システム
- 年度末に「繰延(DEFERRED)」とした未払・未収金を、次年度に「プラスの値」を入力するだけで消し込む逆仕訳ロジック
- `Transaction.deferredFromId` と `Transaction.status` を使用

### 4. 多段階承認フロー
- `Transaction.approvalStatus` と `Approval` モデルで管理
- クラブ申請 -> 顧問(一次承認) -> 大学(最終決裁)

## 次の実装ステップ

1. **認証システム**
   - NextAuth.js または独自実装
   - ロールベースアクセス制御

2. **UIコンポーネント**
   - shadcn/ui コンポーネントの追加
   - 取引一覧テーブル（証憑不足の行を赤く表示）
   - AI OCR入力フォーム

3. **API Routes**
   - `/api/transactions` - 取引CRUD
   - `/api/ocr` - OCR解析エンドポイント
   - `/api/approvals` - 承認フローエンドポイント

4. **ビジネスロジック**
   - 繰延・精算ロジックの実装
   - 残高計算ロジック
   - 異常検知ロジックの強化

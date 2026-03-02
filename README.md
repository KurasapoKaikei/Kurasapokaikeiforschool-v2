# クラサポ会計 (Classapo Accounting)

大学スポーツ・部活動向け会計DXソリューション

> **「できるクラブは会計もスマートに。」**

---

## クイックスタート

```bash
# 1. 依存関係のインストール
npm install

# 2. 環境変数の設定
cp .env.example .env
# .env を編集して DATABASE_URL と GEMINI_API_KEY を設定

# 3. データベースのセットアップ
npm run db:generate
npm run db:push

# 4. 開発サーバーの起動
npm run dev
```

デフォルトでは http://localhost:3000 で起動します。

---

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| Framework | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Database | PostgreSQL, Prisma |
| AI | Google Gemini 1.5 Flash API |

---

## プロジェクト構造

```
kurasaokaikei/
├── docs/
│   ├── spec.md              # 開発マスターガイド（詳細仕様）
│   └── kansa.md             # 監査レポート
├── prisma/
│   └── schema.prisma        # データベーススキーマ
├── src/
│   ├── app/
│   │   ├── (dashboard)/     # クラブ向け画面（単体版）
│   │   │   ├── dashboard/   # マイページ
│   │   │   ├── accounting/  # 入出金・帳簿
│   │   │   │   ├── register/    # 新規登録・履歴
│   │   │   │   ├── ledger/      # 出納帳・科目別台帳
│   │   │   │   ├── summary/     # 収支集計表
│   │   │   │   └── report/      # 収支報告書
│   │   │   ├── collection/  # 集金管理
│   │   │   │   ├── history/         # 集金実績
│   │   │   │   ├── schedule/        # 集金予定一覧
│   │   │   │   └── settings/        # 集金設定
│   │   │   ├── members/     # 部員管理
│   │   │   │   ├── list/            # 部員一覧
│   │   │   │   └── register/        # 部員登録
│   │   │   ├── settings/    # 設定
│   │   │   │   ├── club/            # クラブ設定
│   │   │   │   ├── category/        # カテゴリー設定
│   │   │   │   ├── account-titles/  # 科目設定
│   │   │   │   └── fiscal-years/    # 会計年度設定
│   │   │   └── guide/       # 操作ガイド
│   │   ├── (university)/    # 大学向け画面（for School版）
│   │   │   └── university/
│   │   │       ├── dashboard/   # 統合ダッシュボード
│   │   │       └── approvals/   # 承認待ち一覧
│   │   └── api/
│   │       └── ocr/         # OCR API
│   ├── components/
│   │   ├── layout/          # Header, Sidebar
│   │   ├── ui/              # shadcn/ui コンポーネント
│   │   └── accounting/      # 会計関連コンポーネント
│   ├── contexts/            # React Context
│   ├── utils/               # ユーティリティ関数
│   └── lib/                 # Prisma, Gemini クライアント
├── package.json
├── tailwind.config.ts
└── next.config.js
```

---

## アクセス可能なURL

| 画面 | URL |
|------|-----|
| ホーム | http://localhost:3000/ |
| マイページ | http://localhost:3000/dashboard |
| 入出金登録 | http://localhost:3000/accounting/register/new |
| 登録履歴 | http://localhost:3000/accounting/register/history |
| 現金預金出納帳 | http://localhost:3000/accounting/ledger/cash-bank |
| 科目別台帳 | http://localhost:3000/accounting/ledger/subject |
| 年間収支集計表 | http://localhost:3000/accounting/summary/annual |
| 月次収支集計表 | http://localhost:3000/accounting/summary/monthly |
| 集金管理（トップ） | http://localhost:3000/collection |
| 集金実績 | http://localhost:3000/collection/history |
| 集金予定一覧 | http://localhost:3000/collection/schedule |
| 集金設定 | http://localhost:3000/collection/settings |
| 部員管理（トップ） | http://localhost:3000/members |
| 部員一覧 | http://localhost:3000/members/list |
| 部員登録 | http://localhost:3000/members/register |
| 設定 | http://localhost:3000/settings |
| 操作ガイド | http://localhost:3000/guide |

ルート一覧を確認するには：
```bash
npm run routes
```

---

## NPM スクリプト

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | プロダクションビルド |
| `npm run start` | プロダクションサーバー起動 |
| `npm run lint` | ESLint 実行 |
| `npm run db:generate` | Prisma クライアント生成 |
| `npm run db:push` | スキーマをDBに反映 |
| `npm run db:migrate` | マイグレーション実行 |
| `npm run routes` | ルート一覧表示 |

---

## ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| **[docs/spec.md](./docs/spec.md)** | 開発マスターガイド（詳細仕様書 / v2.8・最終更新: 2026.2.6） |
| **[docs/kansa.md](./docs/kansa.md)** | 監査レポート |
| **[prisma/schema.prisma](./prisma/schema.prisma)** | データベース設計 |

> **開発時は必ず [docs/spec.md](./docs/spec.md) を参照してください。**  
> 特に最新のセクション `10`（localStorage連動）、`16`（Dashboard 3カラム）、
> `17`（入出金登録の動的UI）、`18`（金額表示と画面間連携）を実装基準としてください。

---

## 主要機能（概要）

| 機能 | 説明 |
|------|------|
| **AI OCR入力** | レシート画像をGemini 1.5 Flashで解析し自動入力 |
| **リスクベース監査アラート** | 証憑不足・二重登録・残高不整合を自動検知 |
| **繰延・精算システム** | 「プラス入力」で完結する次年度繰越処理 |
| **多段階承認フロー** | クラブ→顧問→大学の承認ステータス遷移（for School版） |

> 詳細は [docs/spec.md](./docs/spec.md) を参照

---

## データベース設計（概要）

| モデル | 説明 |
|--------|------|
| Organization | クラブ/大学組織 |
| User | ユーザー（ロール管理） |
| FiscalYear | 会計年度 |
| Category | カテゴリー（部門） |
| AccountTitle | 勘定科目 |
| Transaction | 取引（仕訳） |
| Member | 部員 |
| CollectionItem | 集金項目 |
| Approval | 承認フロー |
| Alert | 異常検知アラート |

> 詳細は [prisma/schema.prisma](./prisma/schema.prisma) を参照

---

## ライセンス

Private - All rights reserved

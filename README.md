# クラサポ会計 (Classapo Accounting)

大学スポーツ・部活動向け会計DXソリューション

## 技術スタック

- **Framework:** Next.js 14 (App Router), TypeScript
- **Database/ORM:** PostgreSQL, Prisma
- **UI/Styling:** Tailwind CSS, shadcn/ui
- **AI:** Google Gemini 1.5 Flash API (OCR解析、監査照合、異常検知)

## プロジェクト構造

```
kurasaokaikei/
├── prisma/
│   └── schema.prisma          # Prismaスキーマ定義
├── src/
│   ├── app/
│   │   ├── (dashboard)/       # クラブ向けダッシュボード（単体版）
│   │   │   ├── dashboard/     # マイページ/全体俯瞰（Pink #E66A84）
│   │   │   ├── accounting/    # 入出金・帳簿管理（Green #A3BC68）
│   │   │   │   └── new/       # 新規取引入力（AI OCR）
│   │   │   ├── collection/    # 集金管理（Orange #D99529）
│   │   │   ├── members/       # 部員・保護者管理（Purple #9D8CC3）
│   │   │   └── settings/      # 設定・マスター（Blue #77B8DA）
│   │   │       ├── account-titles/  # 勘定科目マスター
│   │   │       └── fiscal-years/    # 会計年度管理
│   │   ├── (university)/      # 大学向け統合ダッシュボード（for School版）
│   │   │   └── university/
│   │   │       ├── dashboard/ # 統合ダッシュボード
│   │   │       └── approvals/ # 承認待ち一覧（多段階承認フロー）
│   │   ├── layout.tsx         # ルートレイアウト
│   │   ├── page.tsx           # ホームページ
│   │   └── globals.css        # グローバルスタイル
│   └── lib/
│       ├── prisma.ts          # Prismaクライアント
│       └── gemini.ts          # Gemini API統合
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## カラーシステム

機能セクションごとに以下のテーマカラーを適用：

- **Dashboard (マイページ/全体俯瞰):** #E66A84 (Pink)
- **Accounting (入出金・帳簿):** #A3BC68 (Green)
- **Collection (集金管理):** #D99529 (Orange)
- **Members (部員・保護者):** #9D8CC3 (Purple)
- **Settings (設定・マスター):** #77B8DA (Blue)
- **Alert (監査警告):** #EF4444 (Red - 証憑不足や異常値用)

## セットアップ

1. 依存関係のインストール:
```bash
npm install
```

2. 環境変数の設定:
`.env` ファイルを作成し、`.env.example` を参考に設定してください。

3. データベースのセットアップ:
```bash
npm run db:generate
npm run db:push
# または
npm run db:migrate
```

4. 開発サーバーの起動:
```bash
npm run dev
```

デフォルトでは `http://localhost:3000` で起動します。ポートが異なる場合は、ターミナルに表示されるURLを確認してください。

## アクセス可能なURL一覧

開発サーバー起動後、以下のURLにアクセスできます：

- **ホーム**: http://localhost:3000/ （ダッシュボードへリダイレクト）
- **マイページ**: http://localhost:3000/dashboard
- **入出金登録**: http://localhost:3000/accounting/register
- **集金・帳簿**: http://localhost:3000/accounting/ledger
- **集金管理**: http://localhost:3000/collection
- **部員管理**: http://localhost:3000/members
- **設定**: http://localhost:3000/settings
- **操作ガイド**: http://localhost:3000/guide

詳細は `ROUTES.md` を参照してください。

ルート一覧を確認するには：
```bash
npm run routes
```

## 主要機能

### 1. AI OCR入力
レシート画像をGemini 1.5 Flashで解析し、日付・金額・科目を自動入力

### 2. リスクベース監査アラート
- 証憑（画像）がない支出取引は、帳簿上で行全体を赤く(#EF4444)表示
- 二重登録、高額支出(5万円超)、残高不整合を自動検知

### 3. 繰延・精算システム
年度末に「繰延(DEFERRED)」とした未払・未収金を、次年度に「プラスの値」を入力するだけで消し込む逆仕訳ロジック

### 4. 多段階承認フロー (for School)
クラブ申請 -> 顧問(一次承認) -> 大学(最終決裁) のステータス遷移

## データベース設計

詳細は `prisma/schema.prisma` を参照してください。

主要なモデル:
- **Organization:** クラブ/大学組織
- **User:** ユーザー（ロール管理）
- **FiscalYear:** 会計年度
- **Transaction:** 取引（仕訳）
- **AccountTitle:** 勘定科目
- **Member:** 部員
- **CollectionItem:** 集金項目
- **Approval:** 承認フロー

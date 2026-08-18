# プロジェクト構造

Next.js 14 App Router ベースのディレクトリ構成です。

## ルート直下

```
kurasaokaikei/
├── docs/                 # 仕様書（正本は docs/spec_latest.md）
│   └── infrastructure-design.md  # インフラ設計正本
├── infra/                # AWS CLI によるインフラ構築スクリプト
│   ├── config/           # 環境別設定（common / prod / staging）
│   ├── lib/common.sh     # 冪等ヘルパー
│   └── NN-*.sh           # 番号順に実行する構築スクリプト
├── prisma/
│   ├── schema.prisma     # Prisma スキーマ
│   └── migrations/       # マイグレーション履歴（Git 管理下）
├── src/
│   ├── app/              # App Router ページ
│   ├── components/       # UI コンポーネント
│   ├── contexts/         # React Context
│   ├── hooks/            # カスタムフック
│   ├── lib/              # ビジネスロジック・ストレージ
│   └── utils/            # ユーティリティ
├── Dockerfile            # 本番コンテナ（ECS Fargate 用）
├── docker-compose.yml    # ローカル開発（PostgreSQL）
├── .env.example          # 環境変数のひな形
├── package.json
├── next.config.js        # output: 'standalone'（コンテナ実行用）
└── README.md             # リポジトリ入り口（詳細は docs/ 参照）
```

## インフラ・運用

| ファイル | 内容 |
|---------|------|
| `docs/infrastructure-design.md` | AWS 構成・認証認可・DB 移行・コスト・増設順序の正本 |
| `infra/README.md` | 構築手順とトラブルシュート |
| `Dockerfile` | node:20-slim ベースのマルチステージビルド（非 root 実行） |
| `docker-compose.yml` | `npm run db:up` でローカル PostgreSQL を起動 |

**ヘルスチェックは 2 系統**。`/api/health` は DB を見ない浅いチェックで ALB 用、`/api/health/deep` は DB 疎通を含み外形監視・アラート用（詳細は設計書 §3.2）。

## `src/app/` — ポータル別ルーティング

| パス | 用途 |
|------|------|
| `src/app/page.tsx` | 統合ログインハブ `/` |
| `src/app/school/` | 学校管理者ポータル `/school/*` |
| `src/app/club/` | クラブポータル `/club/*` |
| `src/app/audit/` | 監査人ポータル `/audit/*` |
| `src/app/register/` | 学校申込・認証 |
| `src/app/(university)/` | 大学向け試作画面 |
| `src/app/(parent)/` | 保護者ページ（プレースホルダ） |
| `src/app/member/` | 部員ページ（プレースホルダ） |

URL 一覧の詳細は `docs/routes.md` を参照。

## `src/components/` — 主要コンポーネント

```
src/components/
├── layout/
│   ├── school/           # SchoolAppShell, SchoolSidebar, SchoolHeader
│   ├── club/             # ClubAppShell, ClubImpersonationBanner
│   └── audit/            # AuditorLayoutGate, AuditorSidebar
├── school/               # 学校ポータル画面部品
├── club/                 # クラブポータル画面部品
├── audit/                # 監査人ポータル画面部品
├── accounting/           # 入出金・帳簿共通
└── ui/                   # shadcn/ui 系プリミティブ
```

## `src/lib/` — データ・セッション

| 領域 | 代表ファイル |
|------|-------------|
| 学校・クラブマスタ | `schoolClubs.ts`, `schoolAuditors.ts`, `schoolMasters.ts` |
| クラブセッション | `clubLoginSession.ts`, `clubPortalData.ts` |
| 決算・監査 | `clubWorkflowStatus.ts`, `schoolClubSettlement.ts` |
| メッセージ | `portalMessages.ts` |
| 契約・学校コンテキスト | `currentSchool.ts`, `getSchoolContractDisplay.ts` |

デモ環境では `localStorage` を正本として利用します（`docs/spec_latest.md` §2 参照）。

## データベース（Prisma）

本番連携用のスキーマは `prisma/schema.prisma` に定義。現行デモの多くはクライアント側 `localStorage` で動作します。

## レガシーについて

旧 `(dashboard)/` ルートグループは廃止され、クラブ機能は `src/app/club/` に集約されています。旧 URL は `next.config.js` でリダイレクトされます。

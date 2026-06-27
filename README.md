# クラサポ会計 (Classapo Accounting)

大学スポーツ・部活動向け会計DXソリューション

> **「できるクラブは会計もスマートに。」**

---

## クイックスタート

```bash
npm install
cp .env.example .env   # DATABASE_URL, GEMINI_API_KEY を設定
npm run db:generate
npm run db:push
npm run dev
```

デフォルト: http://localhost:3000

---

## 技術スタック

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Prisma · Google Gemini

---

## ドキュメント

**仕様書はすべて [`docs/`](./docs/) に集約されています。**

| ドキュメント | 内容 |
|-------------|------|
| **[docs/README.md](./docs/README.md)** | **ドキュメント索引（ここから参照）** |
| [docs/spec_latest.md](./docs/spec_latest.md) | 直近の確定仕様（正本） |
| [docs/routes.md](./docs/routes.md) | URL一覧 |
| [docs/project-structure.md](./docs/project-structure.md) | プロジェクト構造 |

開発・修正時は `docs/spec_latest.md` および関連仕様書を必ず確認してください。

---

## NPM スクリプト

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | プロダクションビルド |
| `npm run routes` | ルート一覧表示 |
| `npm run db:generate` | Prisma クライアント生成 |
| `npm run db:push` | スキーマをDBに反映 |

---

## ライセンス

Private - All rights reserved

# クラサポ会計 — ドキュメント索引

仕様書はすべて `docs/` フォルダに集約されています。実装・修正前は必ず該当ドキュメントを読み込んでください。

## 正本（最優先）

| ファイル | 内容 |
|----------|------|
| **[spec_latest.md](./spec_latest.md)** | **直近の確定仕様**（初期データ、コピー機能、クラブ設定、表示順など） |

## ポータル別・機能別

| ファイル | 内容 |
|----------|------|
| [school-portal-specification.md](./school-portal-specification.md) | 学校管理者ポータル詳細（サイドバー、監査人管理、メッセージBOX） |
| [system-specification-for-school.md](./system-specification-for-school.md) | 学校向け全体設計・クラブ管理・ログイン |
| [settlement-spec.md](./settlement-spec.md) | 決算提出ページ仕様 |
| [specifications/club_portal_message_box.md](./specifications/club_portal_message_box.md) | クラブメッセージBOX |
| [specifications/school_onboarding_spec.md](./specifications/school_onboarding_spec.md) | 学校オンボーディング |
| [specifications/school_registration_flow.md](./specifications/school_registration_flow.md) | 学校登録フロー |

## システム全体・参考

| ファイル | 内容 |
|----------|------|
| [system-grand-spec.md](./system-grand-spec.md) | 統合仕様（最高位設計図） |
| [LATEST_SYSTEM_SPEC.md](./LATEST_SYSTEM_SPEC.md) | 実装ベースのシステム概要 |
| [system_spec.md](./system_spec.md) | ワークフロー・セッション・監査人カード等 |
| [spec.md](./spec.md) | 会計・集金・帳簿の機能詳細（v2 系） |
| [kansa.md](./kansa.md) | 監査レポート |
| [system-design-draft.md](./system-design-draft.md) | 設計ドラフト |

## 開発リファレンス

| ファイル | 内容 |
|----------|------|
| [routes.md](./routes.md) | URL・ルート一覧 |
| [project-structure.md](./project-structure.md) | ディレクトリ構成 |

## 読み方の目安

1. 依頼内容に関係するセクションを `spec_latest.md` で確認
2. 学校ポータルなら `school-portal-specification.md` を併読
3. 会計・帳簿なら `spec.md`、決算なら `settlement-spec.md`
4. 全体像が必要なら `system-grand-spec.md`

システムを更新した際は、該当する `docs/` 内の仕様書も同時に更新してください。

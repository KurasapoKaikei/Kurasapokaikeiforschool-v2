# infra — AWS CLI によるインフラ構築

[`docs/infrastructure-design.md`](../docs/infrastructure-design.md) の構成を、AWS CLI のシェルスクリプトで構築する。

---

## 方針

**すべてのスクリプトは冪等**。同じスクリプトを何度実行しても結果は同じで、既存リソースがあればスキップする。作成済みのリソース ID は **SSM Parameter Store に保存**し、ローカルの state ファイルは持たない（複数人・複数マシンから同じ手順を再現できるようにするため）。

> **CloudFormation / CDK ではなく CLI を使うことのトレードオフ**
> CLI 直叩きには「宣言的な差分適用がない」「コンソールで手動変更されたときのドリフトを検知できない」という弱点がある。本スクリプト群は各リソースを *検索してから作る* 形にして冪等性を確保しているが、削除の取りこぼしや部分的な失敗からの復旧は CloudFormation ほど強くない。
> 運用が固まり、変更が頻繁になった段階で CloudFormation / CDK への移行を検討すること。その際も、本スクリプトが作るリソース名・タグ体系はそのまま `import` できるよう命名を統一してある。

---

## 前提

| ツール | 用途 | 必須 |
|--------|------|------|
| AWS CLI v2 | 全スクリプト | 必須 |
| `jq` | `deploy.sh`（タスク定義の書き換え） | 必須 |
| Docker | `deploy.sh`（イメージのビルドと push） | `deploy.sh` のみ必須 |
| Bash | Windows は Git Bash で動作確認 | 必須 |

Windows(Git Bash) 特有のパス変換対策（`MSYS_NO_PATHCONV`）は `lib/common.sh` で処理済み。

---

## 設定

| ファイル | 内容 |
|---------|------|
| `config/common.env` | 全環境共通（リージョン、VPC CIDR、ドメイン、アカウントガード） |
| `config/prod.env` | 本番のサイズ設定 |
| `config/staging.env` | ステージングのサイズ設定 |

### ★ 構築先アカウントの指定（必須）

`config/common.env` の **`AWS_PROFILE_NAME` と `EXPECTED_ACCOUNT_ID` は両方とも必須**。どちらか欠けていればスクリプトは何もせず停止する。

```bash
AWS_PROFILE_NAME="default"          # ~/.aws/credentials のセクション名
EXPECTED_ACCOUNT_ID="579617311268"  # 上記プロファイルが指すべきアカウント
```

**なぜ必須にしているか。** AWS CLI は `--profile` も `AWS_PROFILE` も指定されないと、必ず `~/.aws/credentials` の `[default]` にフォールバックする。開発機に複数プロジェクトのプロファイルがあると、指定漏れがそのまま **別プロジェクトのアカウントを操作する事故**になる。暗黙のフォールバックを封じるため、プロファイル名を必ず書かせる設計にしている。

現在の設定は `default` プロファイル（IAM ユーザー `staysync.admin` / アカウント `579617311268`）。

確認方法:

```bash
aws configure list-profiles                      # プロファイル一覧
AWS_PROFILE=default aws sts get-caller-identity  # そのプロファイルの実体
./infra/00-preflight.sh prod                     # 構築先を枠付きで表示（何も作らない）
```

実行時に実アカウントと `EXPECTED_ACCOUNT_ID` が食い違えば、**リソースを 1 つも作らずに中断する**。

```
[XX] ★ アカウント不一致のため中断しました ★
     プロファイル : default
     実際のID     : 579617311268  (arn:aws:iam::579617311268:user/staysync.admin)
     期待するID   : 999999999999
```

---

## 構築手順

```bash
chmod +x infra/*.sh

# 0. 前提チェック（何も作らない）
./infra/00-preflight.sh prod

# 1. ネットワーク（VPC / サブネット / SG）— prod と staging で共有
./infra/10-network.sh prod

# 2. データ層（RDS / S3 / シークレット）— RDS の作成に 5〜10 分
WAIT=1 ./infra/20-data.sh prod

# 3. コンテナレジストリ
./infra/30-registry.sh prod

# 4. イメージを push（ECS 未作成のため PUSH_ONLY）
PUSH_ONLY=1 ./infra/deploy.sh prod

# 5. コンピュート（ECS / ALB / タスク定義 / サービス）
./infra/40-compute.sh prod

# 6. 監視
ALERT_EMAIL=ops@example.com ./infra/50-observability.sh prod
```

ステージングは同じ手順で `prod` を `staging` に置き換える。VPC・ALB・ECS クラスタ・ECR は共有されるため、2 回目は差分だけが作られる。

### 2 回目以降のデプロイ

```bash
./infra/deploy.sh prod
```

ビルド → push → タスク定義更新 → **マイグレーション実行** → サービス更新 → 安定待ち、までを行う。マイグレーションが失敗した場合はサービスを更新せずに中止する。

---

## スクリプト一覧

| スクリプト | 作るもの | 共有/環境別 |
|-----------|---------|-----------|
| `00-preflight.sh` | （確認のみ） | — |
| `10-network.sh` | VPC, IGW, サブネット x4, ルートテーブル, S3 エンドポイント, SG x3 | VPC/サブネットは共有、SG は環境別 |
| `20-data.sh` | DB サブネットグループ, RDS, S3 x2, SSM シークレット | サブネットグループのみ共有 |
| `30-registry.sh` | ECR + ライフサイクルポリシー | 共有 |
| `40-compute.sh` | IAM x2, ロググループ, ECS クラスタ, ALB, TG, リスナー, タスク定義, サービス | クラスタ/ALB は共有 |
| `50-observability.sh` | SNS, CloudWatch アラーム x8, コスト異常検知 | 環境別 |
| `deploy.sh` | イメージのビルド/push/デプロイ/マイグレーション | 環境別 |
| `99-teardown.sh` | 上記の削除（S3 と最終スナップショットは既定で残す） | 環境別 |

---

## 設計上の要点

### NAT Gateway を作らない

ECS タスクをパブリックサブネットに置き、IGW 経由で egress する。NAT Gateway は月 8,250 円かかり、最小構成では総額の 3 割を占めてしまうため。

セキュリティは以下で担保する。

- タスクの SG は **ALB の SG からの inbound のみ**許可（インターネットからの直接到達は不可）
- **RDS はプライベートサブネット**（`--no-publicly-accessible`、インターネット経路なし）

### 実質シングル AZ

ALB は仕様上 2 AZ のサブネットを要求するため 2 AZ 分作るが、**ECS サービスと RDS は `ap-northeast-1a` のみ**に配置する。サブネットの作成自体は無料。

AZ 冗長化する場合は次の 2 箇所を変えるだけでよい（月 +6,100 円）。

```bash
# config/prod.env
ECS_DESIRED_COUNT="2"
DB_MULTI_AZ="true"

# 40-compute.sh の create-service / update-service
subnets=[$SUBNET_A,$SUBNET_C]
```

### ヘルスチェックを 2 系統に分ける

| エンドポイント | 用途 | DB 疎通 |
|--------------|------|--------|
| `/api/health` | **ALB ターゲットグループ** | 見ない |
| `/api/health/deep` | 外形監視・アラート | 見る（失敗時 503） |

ALB のヘルスチェックで DB 疎通を判定すると、DB が一時的に落ちた際に全タスクが unhealthy と判定されて ECS がタスクを落とし続け、DB 復旧後も再起動ループから抜けられなくなる。

### シークレット

Secrets Manager（1 件あたり月 60 円）ではなく **SSM Parameter Store の SecureString（無料）** を使う。ECS タスク定義の `secrets` で ARN 注入するため、環境変数に平文が載ることはない。

自動ローテーションが使えないため、**DB パスワードは半期に 1 回手動で更新**する運用とする。

### ドメイン未設定でも動く

`config/common.env` の `DOMAIN_NAME` が空の場合、ALB の HTTP リスナーで公開する（prod: 80 / staging: 8080）。ドメイン取得前でも動作確認できるようにするため。

**本番運用の前には必ず ACM 証明書を取得し、`DOMAIN_NAME` と `ACM_CERTIFICATE_ARN` を設定して HTTPS 化すること。** 設定するとホストベースルーティングに切り替わり、80 番は 443 へリダイレクトされる。

---

## 費用

インフラ設計書 §6 のとおり。

| 環境 | 月額 |
|------|------|
| 本番（開発期間中 / WAF・GuardDuty 無効） | 約 11,250 円 |
| 本番（稼働後） | 約 14,100 円 |
| ステージング | 約 2,700 円 |

**WAF と GuardDuty は本スクリプトでは有効化していない。** 実データを投入する日に別途有効化する（設計書 §6.7 順序 0）。

---

## トラブルシュート

```bash
# ECS サービスの状態
aws ecs describe-services --region ap-northeast-1 \
  --cluster kurasapo-cluster --services kurasapo-prod-svc \
  --query 'services[0].{status:status,running:runningCount,desired:desiredCount,events:events[:5]}'

# アプリのログ
aws logs tail /ecs/kurasapo-prod --region ap-northeast-1 --follow

# タスクが起動しない理由（停止したタスクの stoppedReason）
aws ecs list-tasks --region ap-northeast-1 --cluster kurasapo-cluster \
  --service-name kurasapo-prod-svc --desired-status STOPPED
aws ecs describe-tasks --region ap-northeast-1 --cluster kurasapo-cluster \
  --tasks <taskArn> --query 'tasks[0].{reason:stoppedReason,containers:containers[].reason}'

# ターゲットのヘルス
aws elbv2 describe-target-health --region ap-northeast-1 \
  --target-group-arn "$(aws ssm get-parameter --region ap-northeast-1 \
    --name /kurasapo/prod/alb/targetGroupArn --query Parameter.Value --output text)"

# RDS の状態
aws rds describe-db-instances --region ap-northeast-1 \
  --db-instance-identifier kurasapo-prod-db \
  --query 'DBInstances[0].{status:DBInstanceStatus,endpoint:Endpoint.Address}'
```

| 症状 | 原因の候補 |
|------|-----------|
| タスクが起動直後に停止する | SSM パラメータ未設定（`GOOGLE_GEMINI_API_KEY` が PLACEHOLDER のままでも起動はする）、実行ロールの権限不足 |
| ターゲットが unhealthy | `/api/health` に到達できていない。SG（ALB→タスクの 3000 番）を確認 |
| マイグレーションが失敗 | `DATABASE_URL` が未保存。RDS が available になった後に `20-data.sh` を再実行する |
| `deploy.sh` で `jq: command not found` | jq を導入する |

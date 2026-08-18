#!/usr/bin/env bash
# ============================================================
# 00 前提チェック
#
# 何も作らない。構築を始める前に、環境が整っているかだけを確認する。
#
#   ./infra/00-preflight.sh prod
# ============================================================

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
load_config "${1:-}"

section "前提チェック（${ENV_NAME}）"

# --- ツール --------------------------------------------------
for cmd in aws jq; do
  if command -v "$cmd" >/dev/null 2>&1; then
    ok "$cmd: $(command -v "$cmd")"
  else
    if [[ "$cmd" == "jq" ]]; then
      warn "jq が見つかりません（一部スクリプトで必要）。https://jqlang.github.io/jq/"
    else
      die "$cmd が見つかりません"
    fi
  fi
done

if command -v docker >/dev/null 2>&1; then
  ok "docker: $(docker --version)"
else
  warn "docker が見つかりません。deploy.sh（イメージのビルドと push）が実行できません。"
fi

# --- AWS 認証 ------------------------------------------------
require_aws
ARN="$(aws_text sts get-caller-identity --query 'Arn')"
ok "AWS アカウント: $ACCOUNT_ID"
ok "実行者:         $ARN"
ok "リージョン:     $AWS_REGION"

if [[ -z "${EXPECTED_ACCOUNT_ID:-}" ]]; then
  warn "config/common.env の EXPECTED_ACCOUNT_ID が未設定です。"
  warn "意図しないアカウントへ構築する事故を防ぐため、設定を強く推奨します:"
  warn "    EXPECTED_ACCOUNT_ID=\"$ACCOUNT_ID\""
fi

# --- 設定の表示 ----------------------------------------------
section "適用される設定"
cat <<EOF
  環境            : $ENV_NAME
  VPC             : $VPC_NAME ($VPC_CIDR)
  AZ              : $AZ_A / $AZ_C（稼働リソースは $AZ_A に集約）
  ECS クラスタ    : $ECS_CLUSTER_NAME
  ECS サービス    : $ECS_SERVICE_NAME (desired=$ECS_DESIRED_COUNT, ${TASK_CPU}CPU/${TASK_MEMORY}MB)
  RDS             : $DB_IDENTIFIER ($DB_INSTANCE_CLASS, MultiAZ=$DB_MULTI_AZ, ${DB_ALLOCATED_STORAGE}GB)
  ECR             : $ECR_REPO_NAME
  ALB             : $ALB_NAME
  ログ            : $LOG_GROUP_NAME (保持 ${LOG_RETENTION_DAYS} 日)
  SSM プレフィクス: $SSM_PREFIX
EOF

if [[ -n "${DOMAIN_NAME:-}" ]]; then
  echo "  ドメイン        : $DOMAIN_NAME (HTTPS)"
  [[ -n "${ACM_CERTIFICATE_ARN:-}" ]] || warn "DOMAIN_NAME があるのに ACM_CERTIFICATE_ARN が未設定です"
else
  echo "  ドメイン        : 未設定 → HTTP:${HTTP_LISTENER_PORT} で公開"
fi

# --- 既存リソースの状況 --------------------------------------
section "既存リソースの検出"
VPC_ID="$(find_vpc)"
if [[ -n "$VPC_ID" ]]; then ok "VPC 既存: $VPC_ID"; else skip "VPC なし（10-network.sh で作成）"; fi

ALB_ARN="$(find_alb)"
if [[ -n "$ALB_ARN" ]]; then ok "ALB 既存"; else skip "ALB なし（40-compute.sh で作成）"; fi

DB_EXISTS="$(find_db)"
if [[ -n "$DB_EXISTS" ]]; then ok "RDS 既存: $DB_EXISTS"; else skip "RDS なし（20-data.sh で作成）"; fi

REPO="$(aws_text ecr describe-repositories --repository-names "$ECR_REPO_NAME" --query 'repositories[0].repositoryName')"
if [[ -n "$REPO" ]]; then ok "ECR 既存: $REPO"; else skip "ECR なし（30-registry.sh で作成）"; fi

section "チェック完了"
echo "問題がなければ、次の順で実行してください:"
echo "  ./infra/10-network.sh      $ENV_NAME"
echo "  ./infra/20-data.sh         $ENV_NAME"
echo "  ./infra/30-registry.sh     $ENV_NAME"
echo "  ./infra/deploy.sh          $ENV_NAME    # 先にイメージを push"
echo "  ./infra/40-compute.sh      $ENV_NAME"
echo "  ./infra/50-observability.sh $ENV_NAME"

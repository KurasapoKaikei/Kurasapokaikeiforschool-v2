#!/usr/bin/env bash
# ============================================================
# 共通ヘルパー
#
# 全スクリプトはこれを source する。単体で実行するものではない。
# ============================================================

set -euo pipefail

# --- Windows(Git Bash) 対策 ---------------------------------
# MSYS は "/kurasapo/prod/DATABASE_URL" のようなスラッシュ始まりの引数を
# Windows パスへ勝手に変換してしまう。SSM パラメータ名や IAM パスが壊れるため無効化する。
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

# --- 表示 ---------------------------------------------------
if [[ -t 1 ]]; then
  C_RESET='\033[0m'; C_INFO='\033[36m'; C_OK='\033[32m'; C_WARN='\033[33m'; C_ERR='\033[31m'; C_DIM='\033[2m'
else
  C_RESET=''; C_INFO=''; C_OK=''; C_WARN=''; C_ERR=''; C_DIM=''
fi

log()  { printf "${C_INFO}[..]${C_RESET} %s\n" "$*"; }
ok()   { printf "${C_OK}[ok]${C_RESET} %s\n" "$*"; }
skip() { printf "${C_DIM}[--]${C_RESET} %s\n" "$*"; }
warn() { printf "${C_WARN}[!!]${C_RESET} %s\n" "$*" >&2; }
die()  { printf "${C_ERR}[XX]${C_RESET} %s\n" "$*" >&2; exit 1; }

section() {
  printf "\n${C_INFO}=== %s ===${C_RESET}\n" "$*"
}

# --- 設定の読み込み -----------------------------------------
# usage: load_config <env>
load_config() {
  local env_name="${1:-}"
  [[ -n "$env_name" ]] || die "環境名が必要です: prod | staging"

  local dir
  dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  INFRA_DIR="$dir"

  # shellcheck source=/dev/null
  source "$INFRA_DIR/config/common.env"

  local env_file="$INFRA_DIR/config/${env_name}.env"
  [[ -f "$env_file" ]] || die "設定ファイルがありません: $env_file"
  # shellcheck source=/dev/null
  source "$env_file"

  ENV_NAME="$env_name"

  # 名前の組み立て（共有リソースは env を含めない）
  VPC_NAME="${PROJECT}-vpc"
  IGW_NAME="${PROJECT}-igw"
  ALB_NAME="${PROJECT}-alb"
  ECS_CLUSTER_NAME="${PROJECT}-cluster"
  ECR_REPO_NAME="${PROJECT}-app"
  DB_SUBNET_GROUP_NAME="${PROJECT}-db-subnets"

  # 環境ごとのリソース
  APP_SG_NAME="${PROJECT}-${ENV_NAME}-app-sg"
  DB_SG_NAME="${PROJECT}-${ENV_NAME}-db-sg"
  ALB_SG_NAME="${PROJECT}-alb-sg"
  DB_IDENTIFIER="${PROJECT}-${ENV_NAME}-db"
  TARGET_GROUP_NAME="${PROJECT}-${ENV_NAME}-tg"
  ECS_SERVICE_NAME="${PROJECT}-${ENV_NAME}-svc"
  TASK_FAMILY="${PROJECT}-${ENV_NAME}-task"
  LOG_GROUP_NAME="/ecs/${PROJECT}-${ENV_NAME}"
  SNS_TOPIC_NAME="${PROJECT}-${ENV_NAME}-alerts"
  SSM_PREFIX="/${PROJECT}/${ENV_NAME}"
  TASK_EXEC_ROLE_NAME="${PROJECT}-${ENV_NAME}-task-exec-role"
  TASK_ROLE_NAME="${PROJECT}-${ENV_NAME}-task-role"
}

# --- AWS ヘルパー -------------------------------------------
# 値が取れないとき AWS CLI は "None" を返す。空文字に正規化する。
aws_text() {
  local out
  out="$(aws --region "$AWS_REGION" "$@" --output text 2>/dev/null || true)"
  [[ "$out" == "None" ]] && out=""
  printf '%s' "$out"
}

aws_json() {
  aws --region "$AWS_REGION" "$@" --output json
}

# 共通タグ（ec2 create-tags 形式）
ec2_tags() {
  local name="$1" scope="${2:-$ENV_NAME}"
  printf 'Key=Name,Value=%s Key=Project,Value=%s Key=Env,Value=%s Key=ManagedBy,Value=infra-cli' \
    "$name" "$PROJECT" "$scope"
}

# create 系の --tag-specifications 用
tagspec() {
  local resource_type="$1" name="$2" scope="${3:-$ENV_NAME}"
  printf 'ResourceType=%s,Tags=[{Key=Name,Value=%s},{Key=Project,Value=%s},{Key=Env,Value=%s},{Key=ManagedBy,Value=infra-cli}]' \
    "$resource_type" "$name" "$PROJECT" "$scope"
}

# --- 検索ヘルパー（冪等性の要）------------------------------
find_vpc() {
  aws_text ec2 describe-vpcs \
    --filters "Name=tag:Name,Values=$VPC_NAME" "Name=state,Values=available" \
    --query 'Vpcs[0].VpcId'
}

find_subnet() {
  aws_text ec2 describe-subnets \
    --filters "Name=tag:Name,Values=$1" "Name=vpc-id,Values=$2" \
    --query 'Subnets[0].SubnetId'
}

find_sg() {
  aws_text ec2 describe-security-groups \
    --filters "Name=group-name,Values=$1" "Name=vpc-id,Values=$2" \
    --query 'SecurityGroups[0].GroupId'
}

find_alb() {
  aws_text elbv2 describe-load-balancers --names "$ALB_NAME" \
    --query 'LoadBalancers[0].LoadBalancerArn'
}

find_target_group() {
  aws_text elbv2 describe-target-groups --names "$1" \
    --query 'TargetGroups[0].TargetGroupArn'
}

find_db() {
  aws_text rds describe-db-instances --db-instance-identifier "$DB_IDENTIFIER" \
    --query 'DBInstances[0].DBInstanceIdentifier'
}

account_id() {
  aws_text sts get-caller-identity --query 'Account'
}

# --- ランダムパスワード -------------------------------------
gen_password() {
  # RDS のマスターパスワードに使えない文字（/ @ " スペース）を避ける
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr -d '/@" \n=+' | cut -c1-32
  else
    LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32
  fi
}

# --- 確認プロンプト -----------------------------------------
confirm() {
  local prompt="$1"
  if [[ "${ASSUME_YES:-0}" == "1" ]]; then
    warn "ASSUME_YES=1 のため確認をスキップ: $prompt"
    return 0
  fi
  read -r -p "$prompt [yes/N]: " reply
  [[ "$reply" == "yes" ]] || die "中止しました"
}

# --- 前提チェック -------------------------------------------
require_aws() {
  command -v aws >/dev/null 2>&1 || die "AWS CLI が見つかりません"
  local ident
  ident="$(aws_text sts get-caller-identity --query 'Account')"
  [[ -n "$ident" ]] || die "AWS 認証情報が無効です。aws configure を確認してください"
  ACCOUNT_ID="$ident"

  if [[ -n "${EXPECTED_ACCOUNT_ID:-}" && "$ACCOUNT_ID" != "$EXPECTED_ACCOUNT_ID" ]]; then
    die "アカウント不一致: 現在=$ACCOUNT_ID / 期待=$EXPECTED_ACCOUNT_ID
     config/common.env の EXPECTED_ACCOUNT_ID を確認してください。
     意図しないアカウントへの構築を防ぐためのガードです。"
  fi
}

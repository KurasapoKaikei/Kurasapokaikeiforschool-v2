#!/usr/bin/env bash
# ============================================================
# 10 ネットワーク
#
# 作るもの:
#   [共有] VPC / IGW / パブリックサブネット x2 / プライベートサブネット x2
#          ルートテーブル / S3 ゲートウェイエンドポイント / ALB 用 SG
#   [環境] アプリ用 SG / DB 用 SG
#
# NAT Gateway は作らない（インフラ設計書 §3.2）。
# ECS タスクはパブリックサブネットに置き、IGW 経由で egress する。
# インバウンドは ALB の SG からのみ許可するため、直接到達はできない。
#
#   ./infra/10-network.sh prod
# ============================================================

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
load_config "${1:-}"
require_aws

section "ネットワーク構築（${ENV_NAME}）"

# ------------------------------------------------------------
# VPC（prod / staging で共有）
# ------------------------------------------------------------
VPC_ID="$(find_vpc)"
if [[ -n "$VPC_ID" ]]; then
  skip "VPC は既存: $VPC_ID"
else
  log "VPC を作成中 ($VPC_CIDR)"
  VPC_ID="$(aws_text ec2 create-vpc \
    --cidr-block "$VPC_CIDR" \
    --tag-specifications "$(tagspec vpc "$VPC_NAME" shared)" \
    --query 'Vpc.VpcId')"
  [[ -n "$VPC_ID" ]] || die "VPC の作成に失敗しました"
  aws ec2 modify-vpc-attribute --region "$AWS_REGION" --vpc-id "$VPC_ID" --enable-dns-hostnames >/dev/null
  aws ec2 modify-vpc-attribute --region "$AWS_REGION" --vpc-id "$VPC_ID" --enable-dns-support >/dev/null
  ok "VPC 作成: $VPC_ID"
fi

# ------------------------------------------------------------
# インターネットゲートウェイ
# ------------------------------------------------------------
IGW_ID="$(aws_text ec2 describe-internet-gateways \
  --filters "Name=attachment.vpc-id,Values=$VPC_ID" --query 'InternetGateways[0].InternetGatewayId')"
if [[ -n "$IGW_ID" ]]; then
  skip "IGW は既存: $IGW_ID"
else
  IGW_ID="$(aws_text ec2 create-internet-gateway \
    --tag-specifications "$(tagspec internet-gateway "$IGW_NAME" shared)" \
    --query 'InternetGateway.InternetGatewayId')"
  aws ec2 attach-internet-gateway --region "$AWS_REGION" \
    --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID" >/dev/null
  ok "IGW 作成・アタッチ: $IGW_ID"
fi

# ------------------------------------------------------------
# サブネット
#   ALB が 2 AZ を要求するため 2 AZ 分作るが、
#   稼働リソース（ECS / RDS）は AZ_A のみ使う ＝ 実質シングル AZ
# ------------------------------------------------------------
create_subnet() {
  local name="$1" cidr="$2" az="$3" is_public="$4"
  local sid
  sid="$(find_subnet "$name" "$VPC_ID")"
  if [[ -n "$sid" ]]; then
    skip "サブネット既存: $name ($sid)"
  else
    sid="$(aws_text ec2 create-subnet \
      --vpc-id "$VPC_ID" --cidr-block "$cidr" --availability-zone "$az" \
      --tag-specifications "$(tagspec subnet "$name" shared)" \
      --query 'Subnet.SubnetId')"
    [[ -n "$sid" ]] || die "サブネット作成に失敗: $name"
    if [[ "$is_public" == "public" ]]; then
      # ECS タスクにパブリック IP を自動付与（NAT を使わないため必須）
      aws ec2 modify-subnet-attribute --region "$AWS_REGION" \
        --subnet-id "$sid" --map-public-ip-on-launch >/dev/null
    fi
    ok "サブネット作成: $name ($sid, $az)"
  fi
  printf '%s' "$sid"
}

PUBLIC_SUBNET_A="$(create_subnet "${PROJECT}-public-a"  "$PUBLIC_SUBNET_A_CIDR"  "$AZ_A" public)"
PUBLIC_SUBNET_C="$(create_subnet "${PROJECT}-public-c"  "$PUBLIC_SUBNET_C_CIDR"  "$AZ_C" public)"
PRIVATE_SUBNET_A="$(create_subnet "${PROJECT}-private-a" "$PRIVATE_SUBNET_A_CIDR" "$AZ_A" private)"
PRIVATE_SUBNET_C="$(create_subnet "${PROJECT}-private-c" "$PRIVATE_SUBNET_C_CIDR" "$AZ_C" private)"

# ------------------------------------------------------------
# ルートテーブル
# ------------------------------------------------------------
setup_route_table() {
  local name="$1" subnet_a="$2" subnet_c="$3" with_igw="$4"
  local rtb
  rtb="$(aws_text ec2 describe-route-tables \
    --filters "Name=tag:Name,Values=$name" "Name=vpc-id,Values=$VPC_ID" \
    --query 'RouteTables[0].RouteTableId')"
  if [[ -z "$rtb" ]]; then
    rtb="$(aws_text ec2 create-route-table --vpc-id "$VPC_ID" \
      --tag-specifications "$(tagspec route-table "$name" shared)" \
      --query 'RouteTable.RouteTableId')"
    ok "ルートテーブル作成: $name ($rtb)"
  else
    skip "ルートテーブル既存: $name ($rtb)"
  fi

  if [[ "$with_igw" == "igw" ]]; then
    # 既に 0.0.0.0/0 があれば作成はエラーになるので無視する
    aws ec2 create-route --region "$AWS_REGION" --route-table-id "$rtb" \
      --destination-cidr-block "0.0.0.0/0" --gateway-id "$IGW_ID" >/dev/null 2>&1 \
      && ok "  デフォルトルート → IGW" \
      || skip "  デフォルトルートは既存"
  fi

  for sn in "$subnet_a" "$subnet_c"; do
    local assoc
    assoc="$(aws_text ec2 describe-route-tables --route-table-ids "$rtb" \
      --query "RouteTables[0].Associations[?SubnetId=='$sn'].RouteTableAssociationId | [0]")"
    if [[ -z "$assoc" ]]; then
      aws ec2 associate-route-table --region "$AWS_REGION" \
        --route-table-id "$rtb" --subnet-id "$sn" >/dev/null
      ok "  サブネット関連付け: $sn"
    fi
  done
  printf '%s' "$rtb"
}

PUBLIC_RTB="$(setup_route_table "${PROJECT}-public-rtb" "$PUBLIC_SUBNET_A" "$PUBLIC_SUBNET_C" igw)"
PRIVATE_RTB="$(setup_route_table "${PROJECT}-private-rtb" "$PRIVATE_SUBNET_A" "$PRIVATE_SUBNET_C" none)"

# ------------------------------------------------------------
# S3 ゲートウェイエンドポイント（無料。証憑アクセスを IGW 経由にしない）
# ------------------------------------------------------------
S3_EP="$(aws_text ec2 describe-vpc-endpoints \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=service-name,Values=com.amazonaws.${AWS_REGION}.s3" \
  --query 'VpcEndpoints[0].VpcEndpointId')"
if [[ -n "$S3_EP" ]]; then
  skip "S3 エンドポイント既存: $S3_EP"
else
  S3_EP="$(aws_text ec2 create-vpc-endpoint \
    --vpc-id "$VPC_ID" \
    --service-name "com.amazonaws.${AWS_REGION}.s3" \
    --vpc-endpoint-type Gateway \
    --route-table-ids "$PUBLIC_RTB" "$PRIVATE_RTB" \
    --tag-specifications "$(tagspec vpc-endpoint "${PROJECT}-s3-endpoint" shared)" \
    --query 'VpcEndpoint.VpcEndpointId')"
  ok "S3 ゲートウェイエンドポイント作成: $S3_EP"
fi

# ------------------------------------------------------------
# セキュリティグループ
# ------------------------------------------------------------
ensure_sg() {
  local name="$1" desc="$2" scope="$3"
  local sg
  sg="$(find_sg "$name" "$VPC_ID")"
  if [[ -n "$sg" ]]; then
    skip "SG 既存: $name ($sg)"
  else
    sg="$(aws_text ec2 create-security-group \
      --group-name "$name" --description "$desc" --vpc-id "$VPC_ID" \
      --tag-specifications "$(tagspec security-group "$name" "$scope")" \
      --query 'GroupId')"
    [[ -n "$sg" ]] || die "SG 作成に失敗: $name"
    ok "SG 作成: $name ($sg)"
  fi
  printf '%s' "$sg"
}

# 既存ルールと重複しても失敗させない
allow_from_cidr() {
  aws ec2 authorize-security-group-ingress --region "$AWS_REGION" \
    --group-id "$1" --protocol tcp --port "$2" --cidr "$3" >/dev/null 2>&1 \
    && ok "  許可: $3 → :$2" || skip "  ルール既存: $3 → :$2"
}
allow_from_sg() {
  aws ec2 authorize-security-group-ingress --region "$AWS_REGION" \
    --group-id "$1" --protocol tcp --port "$2" --source-group "$3" >/dev/null 2>&1 \
    && ok "  許可: SG:$3 → :$2" || skip "  ルール既存: SG:$3 → :$2"
}

ALB_SG="$(ensure_sg "$ALB_SG_NAME" "ALB inbound from internet" shared)"
APP_SG="$(ensure_sg "$APP_SG_NAME" "ECS tasks for $ENV_NAME" "$ENV_NAME")"
DB_SG="$(ensure_sg  "$DB_SG_NAME"  "RDS for $ENV_NAME"       "$ENV_NAME")"

log "SG ルールを設定中"
# ALB: インターネットから 80 / 443。DOMAIN_NAME 未設定時は環境ごとの HTTP ポートも開ける
allow_from_cidr "$ALB_SG" 80  "0.0.0.0/0"
allow_from_cidr "$ALB_SG" 443 "0.0.0.0/0"
if [[ -z "${DOMAIN_NAME:-}" && "$HTTP_LISTENER_PORT" != "80" ]]; then
  allow_from_cidr "$ALB_SG" "$HTTP_LISTENER_PORT" "0.0.0.0/0"
fi

# アプリ: ALB の SG からのみ。インターネットからの直接到達は不可
allow_from_sg "$APP_SG" "$CONTAINER_PORT" "$ALB_SG"

# DB: アプリの SG からのみ
allow_from_sg "$DB_SG" "$DB_PORT" "$APP_SG"

# ------------------------------------------------------------
# 結果を SSM に保存（後続スクリプトが参照する。ローカル state を持たない）
# ------------------------------------------------------------
put_param() {
  aws ssm put-parameter --region "$AWS_REGION" \
    --name "$1" --value "$2" --type String --overwrite >/dev/null
}
log "リソース ID を SSM Parameter Store に保存中"
put_param "${SSM_PREFIX}/net/vpcId"            "$VPC_ID"
put_param "${SSM_PREFIX}/net/publicSubnetIds"  "${PUBLIC_SUBNET_A},${PUBLIC_SUBNET_C}"
put_param "${SSM_PREFIX}/net/privateSubnetIds" "${PRIVATE_SUBNET_A},${PRIVATE_SUBNET_C}"
put_param "${SSM_PREFIX}/net/albSgId"          "$ALB_SG"
put_param "${SSM_PREFIX}/net/appSgId"          "$APP_SG"
put_param "${SSM_PREFIX}/net/dbSgId"           "$DB_SG"

section "完了"
cat <<EOF
  VPC            : $VPC_ID
  パブリック     : $PUBLIC_SUBNET_A ($AZ_A) / $PUBLIC_SUBNET_C ($AZ_C)
  プライベート   : $PRIVATE_SUBNET_A ($AZ_A) / $PRIVATE_SUBNET_C ($AZ_C)
  SG (ALB/App/DB): $ALB_SG / $APP_SG / $DB_SG
  NAT Gateway    : なし（月 8,250 円の削減）

次: ./infra/20-data.sh $ENV_NAME
EOF

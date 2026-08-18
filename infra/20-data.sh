#!/usr/bin/env bash
# ============================================================
# 20 データ層
#
# 作るもの:
#   [共有] DB サブネットグループ
#   [環境] RDS PostgreSQL (Single-AZ) / S3 バケット（証憑・エクスポート）
#          SSM SecureString（DATABASE_URL / AUTH_SECRET）
#
# RDS の作成には 5〜10 分かかる。WAIT=1 を付けると完了まで待つ。
#
#   ./infra/20-data.sh prod
#   WAIT=1 ./infra/20-data.sh prod
# ============================================================

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
load_config "${1:-}"
require_aws

section "データ層構築（${ENV_NAME}）"

get_param() { aws_text ssm get-parameter --name "$1" --query 'Parameter.Value'; }

VPC_ID="$(get_param "${SSM_PREFIX}/net/vpcId")"
[[ -n "$VPC_ID" ]] || die "ネットワークが未構築です。先に ./infra/10-network.sh $ENV_NAME を実行してください"
DB_SG="$(get_param "${SSM_PREFIX}/net/dbSgId")"
PRIVATE_SUBNETS="$(get_param "${SSM_PREFIX}/net/privateSubnetIds")"
IFS=',' read -r PRIVATE_A PRIVATE_C <<< "$PRIVATE_SUBNETS"

# ------------------------------------------------------------
# DB サブネットグループ（prod / staging で共有）
# ------------------------------------------------------------
SG_EXISTS="$(aws_text rds describe-db-subnet-groups \
  --db-subnet-group-name "$DB_SUBNET_GROUP_NAME" --query 'DBSubnetGroups[0].DBSubnetGroupName')"
if [[ -n "$SG_EXISTS" ]]; then
  skip "DB サブネットグループ既存: $DB_SUBNET_GROUP_NAME"
else
  aws rds create-db-subnet-group --region "$AWS_REGION" \
    --db-subnet-group-name "$DB_SUBNET_GROUP_NAME" \
    --db-subnet-group-description "Private subnets for ${PROJECT}" \
    --subnet-ids "$PRIVATE_A" "$PRIVATE_C" \
    --tags "Key=Project,Value=${PROJECT}" "Key=ManagedBy,Value=infra-cli" >/dev/null
  ok "DB サブネットグループ作成: $DB_SUBNET_GROUP_NAME"
fi

# ------------------------------------------------------------
# RDS PostgreSQL
# ------------------------------------------------------------
if [[ -n "$(find_db)" ]]; then
  skip "RDS 既存: $DB_IDENTIFIER"
else
  log "RDS を作成中: $DB_IDENTIFIER ($DB_INSTANCE_CLASS, MultiAZ=$DB_MULTI_AZ)"
  DB_PASSWORD="$(gen_password)"

  MULTI_AZ_FLAG="--no-multi-az"
  [[ "$DB_MULTI_AZ" == "true" ]] && MULTI_AZ_FLAG="--multi-az"

  DELETION_FLAG="--no-deletion-protection"
  [[ "$DB_DELETION_PROTECTION" == "true" ]] && DELETION_FLAG="--deletion-protection"

  aws rds create-db-instance --region "$AWS_REGION" \
    --db-instance-identifier "$DB_IDENTIFIER" \
    --db-instance-class "$DB_INSTANCE_CLASS" \
    --engine "$DB_ENGINE" \
    --engine-version "$DB_ENGINE_VERSION" \
    --master-username "$DB_MASTER_USERNAME" \
    --master-user-password "$DB_PASSWORD" \
    --db-name "$DB_NAME" \
    --allocated-storage "$DB_ALLOCATED_STORAGE" \
    --max-allocated-storage "$DB_MAX_ALLOCATED_STORAGE" \
    --storage-type gp3 \
    --storage-encrypted \
    --db-subnet-group-name "$DB_SUBNET_GROUP_NAME" \
    --vpc-security-group-ids "$DB_SG" \
    --no-publicly-accessible \
    $MULTI_AZ_FLAG \
    $DELETION_FLAG \
    --backup-retention-period "$DB_BACKUP_RETENTION" \
    --preferred-backup-window "$DB_BACKUP_WINDOW" \
    --preferred-maintenance-window "$DB_MAINTENANCE_WINDOW" \
    --auto-minor-version-upgrade \
    --copy-tags-to-snapshot \
    --port "$DB_PORT" \
    --tags "Key=Project,Value=${PROJECT}" "Key=Env,Value=${ENV_NAME}" "Key=ManagedBy,Value=infra-cli" >/dev/null
  ok "RDS 作成を開始: $DB_IDENTIFIER（利用可能まで 5〜10 分）"

  # パスワードは SecureString にのみ保存する。ログにも標準出力にも出さない
  aws ssm put-parameter --region "$AWS_REGION" \
    --name "${SSM_PREFIX}/db/masterPassword" \
    --value "$DB_PASSWORD" --type SecureString --overwrite >/dev/null
  ok "マスターパスワードを SSM に保存: ${SSM_PREFIX}/db/masterPassword"
  unset DB_PASSWORD
fi

if [[ "${WAIT:-0}" == "1" ]]; then
  log "RDS が available になるまで待機中（数分かかります）"
  aws rds wait db-instance-available --region "$AWS_REGION" --db-instance-identifier "$DB_IDENTIFIER"
  ok "RDS 利用可能"
fi

# ------------------------------------------------------------
# DATABASE_URL を組み立てて SSM へ
# ------------------------------------------------------------
DB_ENDPOINT="$(aws_text rds describe-db-instances --db-instance-identifier "$DB_IDENTIFIER" \
  --query 'DBInstances[0].Endpoint.Address')"
if [[ -n "$DB_ENDPOINT" ]]; then
  DB_PASSWORD="$(aws_text ssm get-parameter --name "${SSM_PREFIX}/db/masterPassword" --with-decryption --query 'Parameter.Value')"
  if [[ -n "$DB_PASSWORD" ]]; then
    DATABASE_URL="postgresql://${DB_MASTER_USERNAME}:${DB_PASSWORD}@${DB_ENDPOINT}:${DB_PORT}/${DB_NAME}?schema=public&connection_limit=5&sslmode=require"
    aws ssm put-parameter --region "$AWS_REGION" \
      --name "${SSM_PREFIX}/DATABASE_URL" \
      --value "$DATABASE_URL" --type SecureString --overwrite >/dev/null
    ok "DATABASE_URL を SSM に保存（connection_limit=5 / sslmode=require）"
    unset DATABASE_URL DB_PASSWORD
  fi
else
  warn "RDS のエンドポイントがまだ確定していません。"
  warn "available になった後、このスクリプトを再実行すると DATABASE_URL が保存されます。"
fi

# ------------------------------------------------------------
# AUTH_SECRET（Auth.js 用。P1 で使用）
# ------------------------------------------------------------
if [[ -n "$(aws_text ssm get-parameter --name "${SSM_PREFIX}/AUTH_SECRET" --query 'Parameter.Name')" ]]; then
  skip "AUTH_SECRET は既存"
else
  aws ssm put-parameter --region "$AWS_REGION" \
    --name "${SSM_PREFIX}/AUTH_SECRET" \
    --value "$(gen_password)$(gen_password)" --type SecureString >/dev/null
  ok "AUTH_SECRET を生成して SSM に保存"
fi

# OCR キーの空プレースホルダ（値は運用者が後から入れる）
if [[ -z "$(aws_text ssm get-parameter --name "${SSM_PREFIX}/GOOGLE_GEMINI_API_KEY" --query 'Parameter.Name')" ]]; then
  aws ssm put-parameter --region "$AWS_REGION" \
    --name "${SSM_PREFIX}/GOOGLE_GEMINI_API_KEY" \
    --value "PLACEHOLDER" --type SecureString >/dev/null
  warn "GOOGLE_GEMINI_API_KEY はプレースホルダです。実値を設定してください:"
  warn "  aws ssm put-parameter --region $AWS_REGION --name ${SSM_PREFIX}/GOOGLE_GEMINI_API_KEY --value '<key>' --type SecureString --overwrite"
fi

# ------------------------------------------------------------
# S3 バケット
# ------------------------------------------------------------
ensure_bucket() {
  local bucket="$1" lifecycle="$2"
  if aws s3api head-bucket --region "$AWS_REGION" --bucket "$bucket" >/dev/null 2>&1; then
    skip "S3 バケット既存: $bucket"
  else
    aws s3api create-bucket --region "$AWS_REGION" --bucket "$bucket" \
      --create-bucket-configuration "LocationConstraint=$AWS_REGION" >/dev/null
    ok "S3 バケット作成: $bucket"
  fi

  # パブリックアクセス全ブロック
  aws s3api put-public-access-block --region "$AWS_REGION" --bucket "$bucket" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" >/dev/null

  # 保存時暗号化（SSE-S3。KMS はリクエスト課金があるため使わない）
  aws s3api put-bucket-encryption --region "$AWS_REGION" --bucket "$bucket" \
    --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}' >/dev/null

  # バージョニング（Object Lock の代わりに改ざん・誤削除へ備える）
  aws s3api put-bucket-versioning --region "$AWS_REGION" --bucket "$bucket" \
    --versioning-configuration Status=Enabled >/dev/null

  aws s3api put-bucket-tagging --region "$AWS_REGION" --bucket "$bucket" \
    --tagging "TagSet=[{Key=Project,Value=${PROJECT}},{Key=Env,Value=${ENV_NAME}},{Key=ManagedBy,Value=infra-cli}]" >/dev/null

  if [[ "$lifecycle" == "receipts" ]]; then
    # 証憑: 90日で IA、1年で Glacier IR。Deep Archive は使わない（監査時に即時取り出せないため）
    aws s3api put-bucket-lifecycle-configuration --region "$AWS_REGION" --bucket "$bucket" \
      --lifecycle-configuration '{
        "Rules": [{
          "ID": "receipts-tiering",
          "Status": "Enabled",
          "Filter": {"Prefix": ""},
          "Transitions": [
            {"Days": 90,  "StorageClass": "STANDARD_IA"},
            {"Days": 365, "StorageClass": "GLACIER_IR"}
          ],
          "NoncurrentVersionExpiration": {"NoncurrentDays": 2555}
        }]
      }' >/dev/null
    ok "  ライフサイクル設定（90日→IA, 365日→Glacier IR, 旧版7年で削除）"
  elif [[ "$lifecycle" == "exports" ]]; then
    aws s3api put-bucket-lifecycle-configuration --region "$AWS_REGION" --bucket "$bucket" \
      --lifecycle-configuration '{
        "Rules": [{
          "ID": "exports-expire",
          "Status": "Enabled",
          "Filter": {"Prefix": ""},
          "Expiration": {"Days": 90}
        }]
      }' >/dev/null
    ok "  ライフサイクル設定（90日で削除）"
  fi
}

RECEIPTS_BUCKET="${PROJECT}-${ENV_NAME}-receipts-${ACCOUNT_ID}"
EXPORTS_BUCKET="${PROJECT}-${ENV_NAME}-exports-${ACCOUNT_ID}"
ensure_bucket "$RECEIPTS_BUCKET" receipts
ensure_bucket "$EXPORTS_BUCKET"  exports

aws ssm put-parameter --region "$AWS_REGION" --name "${SSM_PREFIX}/s3/receiptsBucket" \
  --value "$RECEIPTS_BUCKET" --type String --overwrite >/dev/null
aws ssm put-parameter --region "$AWS_REGION" --name "${SSM_PREFIX}/s3/exportsBucket" \
  --value "$EXPORTS_BUCKET" --type String --overwrite >/dev/null

section "完了"
cat <<EOF
  RDS          : $DB_IDENTIFIER (${DB_ENDPOINT:-作成中})
  証憑バケット : $RECEIPTS_BUCKET
  出力バケット : $EXPORTS_BUCKET
  シークレット : ${SSM_PREFIX}/DATABASE_URL, ${SSM_PREFIX}/AUTH_SECRET

次: ./infra/30-registry.sh $ENV_NAME
EOF

#!/usr/bin/env bash
# ============================================================
# 30 コンテナレジストリ
#
# 作るもの:
#   [共有] ECR リポジトリ（prod / staging で共有し、タグで区別する）
#          ライフサイクルポリシー（直近 10 イメージのみ保持）
#
# ECR は放置するとストレージ費用が増え続けるため、
# ライフサイクルポリシーは必須（インフラ設計書 §3.11）。
#
#   ./infra/30-registry.sh prod
# ============================================================

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
load_config "${1:-}"
require_aws

section "コンテナレジストリ（${ENV_NAME}）"

if [[ -n "$(aws_text ecr describe-repositories --repository-names "$ECR_REPO_NAME" --query 'repositories[0].repositoryName')" ]]; then
  skip "ECR リポジトリ既存: $ECR_REPO_NAME"
else
  aws ecr create-repository --region "$AWS_REGION" \
    --repository-name "$ECR_REPO_NAME" \
    --image-scanning-configuration scanOnPush=true \
    --image-tag-mutability IMMUTABLE \
    --encryption-configuration encryptionType=AES256 \
    --tags "Key=Project,Value=${PROJECT}" "Key=ManagedBy,Value=infra-cli" >/dev/null
  ok "ECR リポジトリ作成: $ECR_REPO_NAME（push 時スキャン有効・タグ不変）"
fi

log "ライフサイクルポリシーを適用中（直近 10 イメージのみ保持）"
aws ecr put-lifecycle-policy --region "$AWS_REGION" \
  --repository-name "$ECR_REPO_NAME" \
  --lifecycle-policy-text '{
    "rules": [
      {
        "rulePriority": 1,
        "description": "タグ付きイメージは直近10世代のみ保持",
        "selection": {
          "tagStatus": "tagged",
          "tagPrefixList": ["prod-", "staging-"],
          "countType": "imageCountMoreThan",
          "countNumber": 10
        },
        "action": {"type": "expire"}
      },
      {
        "rulePriority": 2,
        "description": "タグなしイメージは1日で削除",
        "selection": {
          "tagStatus": "untagged",
          "countType": "sinceImagePushed",
          "countUnit": "days",
          "countNumber": 1
        },
        "action": {"type": "expire"}
      }
    ]
  }' >/dev/null
ok "ライフサイクルポリシー適用"

REPO_URI="$(aws_text ecr describe-repositories --repository-names "$ECR_REPO_NAME" \
  --query 'repositories[0].repositoryUri')"
aws ssm put-parameter --region "$AWS_REGION" --name "${SSM_PREFIX}/ecr/repositoryUri" \
  --value "$REPO_URI" --type String --overwrite >/dev/null

section "完了"
cat <<EOF
  リポジトリ URI : $REPO_URI

次: ./infra/deploy.sh $ENV_NAME   （イメージをビルドして push）
EOF

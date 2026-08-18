#!/usr/bin/env bash
# ============================================================
# デプロイ
#
#   1. Docker イメージをビルド
#   2. ECR に push
#   3. タスク定義を新リビジョンで登録
#   4. マイグレーション（prisma migrate deploy）をワンショットタスクで実行
#   5. ECS サービスを新リビジョンへ更新し、安定するまで待つ
#
#   ./infra/deploy.sh prod
#   SKIP_MIGRATE=1 ./infra/deploy.sh prod    # マイグレーションを飛ばす
#   PUSH_ONLY=1    ./infra/deploy.sh prod    # 初回（ECS 未作成時）はこれ
# ============================================================

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
load_config "${1:-}"
require_aws

command -v docker >/dev/null 2>&1 || die "docker が必要です"

REPO_ROOT="$(cd "$INFRA_DIR/.." && pwd)"
GIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "nogit")"
IMAGE_TAG="${ENV_NAME}-${GIT_SHA}-$(date +%Y%m%d%H%M%S)"
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE_URI="${REGISTRY}/${ECR_REPO_NAME}:${IMAGE_TAG}"

section "デプロイ（${ENV_NAME}） tag=${IMAGE_TAG}"

# ------------------------------------------------------------
# 1. ビルド
# ------------------------------------------------------------
log "Docker イメージをビルド中"
docker build --platform linux/amd64 -t "$IMAGE_URI" "$REPO_ROOT"
ok "ビルド完了: $IMAGE_URI"

# ------------------------------------------------------------
# 2. push
# ------------------------------------------------------------
log "ECR にログイン中"
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null
log "push 中"
docker push "$IMAGE_URI"
ok "push 完了"

aws ssm put-parameter --region "$AWS_REGION" --name "${SSM_PREFIX}/deploy/lastImageUri" \
  --value "$IMAGE_URI" --type String --overwrite >/dev/null

if [[ "${PUSH_ONLY:-0}" == "1" ]]; then
  section "push のみで終了"
  echo "  イメージ: $IMAGE_URI"
  echo "次: ./infra/40-compute.sh $ENV_NAME"
  exit 0
fi

# ------------------------------------------------------------
# 3. タスク定義を新リビジョンで登録
# ------------------------------------------------------------
CURRENT_TD="$(aws_text ecs describe-task-definition --task-definition "$TASK_FAMILY" \
  --query 'taskDefinition.taskDefinitionArn')"
[[ -n "$CURRENT_TD" ]] || die "タスク定義 $TASK_FAMILY がありません。先に ./infra/40-compute.sh $ENV_NAME を実行してください"

log "タスク定義を更新中（イメージ差し替え）"
TD_JSON="$(aws ecs describe-task-definition --region "$AWS_REGION" \
  --task-definition "$TASK_FAMILY" --query 'taskDefinition' --output json)"

NEW_TD_ARN="$(printf '%s' "$TD_JSON" | jq \
  --arg img "$IMAGE_URI" --arg rev "$IMAGE_TAG" '
    .containerDefinitions |= map(
      .image = $img
      | .environment = ((.environment // []) | map(select(.name != "APP_REVISION")) + [{name:"APP_REVISION", value:$rev}])
    )
    | del(.taskDefinitionArn, .revision, .status, .requiresAttributes,
          .compatibilities, .registeredAt, .registeredBy, .deregisteredAt)
  ' > /tmp/td.json && aws ecs register-task-definition --region "$AWS_REGION" \
    --cli-input-json file:///tmp/td.json --query 'taskDefinition.taskDefinitionArn' --output text | tr -d '\r')"
rm -f /tmp/td.json
ok "新リビジョン: $NEW_TD_ARN"

# ------------------------------------------------------------
# 4. マイグレーション（ワンショットタスク）
# ------------------------------------------------------------
if [[ "${SKIP_MIGRATE:-0}" == "1" ]]; then
  skip "マイグレーションをスキップ（SKIP_MIGRATE=1）"
else
  log "prisma migrate deploy をワンショットタスクで実行中"
  get_param() { aws_text ssm get-parameter --name "$1" --query 'Parameter.Value'; }
  SUBNETS="$(get_param "${SSM_PREFIX}/net/publicSubnetIds")"
  APP_SG="$(get_param "${SSM_PREFIX}/net/appSgId")"
  SUBNET_A="${SUBNETS%%,*}"

  TASK_ARN="$(aws_text ecs run-task \
    --cluster "$ECS_CLUSTER_NAME" \
    --task-definition "$NEW_TD_ARN" \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_A],securityGroups=[$APP_SG],assignPublicIp=ENABLED}" \
    --overrides "{\"containerOverrides\":[{\"name\":\"${CONTAINER_NAME}\",\"command\":[\"npx\",\"prisma\",\"migrate\",\"deploy\"]}]}" \
    --started-by "deploy-migrate" \
    --query 'tasks[0].taskArn')"
  [[ -n "$TASK_ARN" ]] || die "マイグレーションタスクの起動に失敗しました"

  log "完了を待機中: ${TASK_ARN##*/}"
  aws ecs wait tasks-stopped --region "$AWS_REGION" --cluster "$ECS_CLUSTER_NAME" --tasks "$TASK_ARN"

  EXIT_CODE="$(aws_text ecs describe-tasks --cluster "$ECS_CLUSTER_NAME" --tasks "$TASK_ARN" \
    --query 'tasks[0].containers[0].exitCode')"
  if [[ "$EXIT_CODE" != "0" ]]; then
    warn "マイグレーションが失敗しました (exitCode=$EXIT_CODE)"
    warn "ログ: aws logs tail $LOG_GROUP_NAME --region $AWS_REGION --since 10m"
    die "デプロイを中止します（サービスは更新していません）"
  fi
  ok "マイグレーション成功"
fi

# ------------------------------------------------------------
# 5. サービス更新
# ------------------------------------------------------------
if [[ -z "$(aws_text ecs describe-services --cluster "$ECS_CLUSTER_NAME" --services "$ECS_SERVICE_NAME" --query 'services[?status==`ACTIVE`].serviceName | [0]')" ]]; then
  warn "ECS サービス $ECS_SERVICE_NAME が未作成です。./infra/40-compute.sh $ENV_NAME を実行してください"
  exit 0
fi

log "ECS サービスを更新中"
aws ecs update-service --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER_NAME" --service "$ECS_SERVICE_NAME" \
  --task-definition "$NEW_TD_ARN" >/dev/null

log "サービスが安定するまで待機中（数分かかります）"
if aws ecs wait services-stable --region "$AWS_REGION" \
     --cluster "$ECS_CLUSTER_NAME" --services "$ECS_SERVICE_NAME"; then
  ok "デプロイ完了"
else
  warn "サービスが安定しませんでした。ロールバックを検討してください:"
  warn "  aws ecs update-service --region $AWS_REGION --cluster $ECS_CLUSTER_NAME --service $ECS_SERVICE_NAME --task-definition $CURRENT_TD"
  exit 1
fi

ALB_DNS="$(aws_text elbv2 describe-load-balancers --names "$ALB_NAME" --query 'LoadBalancers[0].DNSName')"
section "完了"
cat <<EOF
  イメージ : $IMAGE_URI
  タスク定義: $NEW_TD_ARN
  URL      : http://${ALB_DNS}:${HTTP_LISTENER_PORT}/
  ヘルス   : http://${ALB_DNS}:${HTTP_LISTENER_PORT}/api/health
  深いヘルス: http://${ALB_DNS}:${HTTP_LISTENER_PORT}/api/health/deep
EOF

#!/usr/bin/env bash
# ============================================================
# 40 コンピュート
#
# 作るもの:
#   [共有] ECS クラスタ / ALB
#   [環境] IAM ロール2種 / CloudWatch ロググループ / ターゲットグループ
#          リスナー（または既存リスナーへのホストベースルール）
#          タスク定義 / ECS サービス
#
# 前提: ./infra/30-registry.sh と PUSH_ONLY=1 ./infra/deploy.sh を実行済みであること
#       （タスク定義の登録に実在するイメージが必要なため）
#
#   ./infra/40-compute.sh prod
# ============================================================

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
load_config "${1:-}"
require_aws

section "コンピュート構築（${ENV_NAME}）"

get_param() { aws_text ssm get-parameter --name "$1" --query 'Parameter.Value'; }

VPC_ID="$(get_param "${SSM_PREFIX}/net/vpcId")"
[[ -n "$VPC_ID" ]] || die "先に ./infra/10-network.sh $ENV_NAME を実行してください"
PUBLIC_SUBNETS="$(get_param "${SSM_PREFIX}/net/publicSubnetIds")"
ALB_SG="$(get_param "${SSM_PREFIX}/net/albSgId")"
APP_SG="$(get_param "${SSM_PREFIX}/net/appSgId")"
RECEIPTS_BUCKET="$(get_param "${SSM_PREFIX}/s3/receiptsBucket")"
EXPORTS_BUCKET="$(get_param "${SSM_PREFIX}/s3/exportsBucket")"
IMAGE_URI="$(get_param "${SSM_PREFIX}/deploy/lastImageUri")"
IFS=',' read -r SUBNET_A SUBNET_C <<< "$PUBLIC_SUBNETS"

[[ -n "$IMAGE_URI" ]] || die "イメージが未 push です。先に実行してください:
     ./infra/30-registry.sh $ENV_NAME
     PUSH_ONLY=1 ./infra/deploy.sh $ENV_NAME"

# ------------------------------------------------------------
# IAM ロール
# ------------------------------------------------------------
TRUST_POLICY='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

ensure_role() {
  local role_name="$1"
  if [[ -n "$(aws_text iam get-role --role-name "$role_name" --query 'Role.RoleName')" ]]; then
    skip "IAM ロール既存: $role_name"
  else
    aws iam create-role --role-name "$role_name" \
      --assume-role-policy-document "$TRUST_POLICY" \
      --tags "Key=Project,Value=${PROJECT}" "Key=Env,Value=${ENV_NAME}" "Key=ManagedBy,Value=infra-cli" >/dev/null
    ok "IAM ロール作成: $role_name"
  fi
}

ensure_role "$TASK_EXEC_ROLE_NAME"
ensure_role "$TASK_ROLE_NAME"

# 実行ロール: イメージ pull とログ出力
aws iam attach-role-policy --role-name "$TASK_EXEC_ROLE_NAME" \
  --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy" >/dev/null 2>&1 || true

# 実行ロール: SSM SecureString の読み取り（コンテナ起動時のシークレット注入用）
aws iam put-role-policy --role-name "$TASK_EXEC_ROLE_NAME" \
  --policy-name "ssm-secrets-read" \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Effect\": \"Allow\",
        \"Action\": [\"ssm:GetParameters\", \"ssm:GetParameter\"],
        \"Resource\": \"arn:aws:ssm:${AWS_REGION}:${ACCOUNT_ID}:parameter${SSM_PREFIX}/*\"
      },
      {
        \"Effect\": \"Allow\",
        \"Action\": [\"kms:Decrypt\"],
        \"Resource\": \"*\",
        \"Condition\": {\"StringEquals\": {\"kms:ViaService\": \"ssm.${AWS_REGION}.amazonaws.com\"}}
      }
    ]
  }" >/dev/null
ok "実行ロールに SSM 読み取り権限を付与"

# タスクロール: アプリが使う権限（証憑バケットのみ。最小権限）
aws iam put-role-policy --role-name "$TASK_ROLE_NAME" \
  --policy-name "app-runtime" \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Effect\": \"Allow\",
        \"Action\": [\"s3:GetObject\", \"s3:PutObject\", \"s3:DeleteObject\"],
        \"Resource\": [
          \"arn:aws:s3:::${RECEIPTS_BUCKET}/*\",
          \"arn:aws:s3:::${EXPORTS_BUCKET}/*\"
        ]
      },
      {
        \"Effect\": \"Allow\",
        \"Action\": [\"s3:ListBucket\"],
        \"Resource\": [
          \"arn:aws:s3:::${RECEIPTS_BUCKET}\",
          \"arn:aws:s3:::${EXPORTS_BUCKET}\"
        ]
      }
    ]
  }" >/dev/null
ok "タスクロールに S3 権限を付与（対象バケットのみ）"

EXEC_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${TASK_EXEC_ROLE_NAME}"
TASK_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${TASK_ROLE_NAME}"

# ------------------------------------------------------------
# CloudWatch ロググループ
# ------------------------------------------------------------
if [[ -n "$(aws_text logs describe-log-groups --log-group-name-prefix "$LOG_GROUP_NAME" \
      --query "logGroups[?logGroupName=='$LOG_GROUP_NAME'].logGroupName | [0]")" ]]; then
  skip "ロググループ既存: $LOG_GROUP_NAME"
else
  aws logs create-log-group --region "$AWS_REGION" --log-group-name "$LOG_GROUP_NAME" >/dev/null
  ok "ロググループ作成: $LOG_GROUP_NAME"
fi
aws logs put-retention-policy --region "$AWS_REGION" \
  --log-group-name "$LOG_GROUP_NAME" --retention-in-days "$LOG_RETENTION_DAYS" >/dev/null
ok "ログ保持期間: ${LOG_RETENTION_DAYS} 日"

# ------------------------------------------------------------
# ECS クラスタ（共有）
# ------------------------------------------------------------
if [[ -n "$(aws_text ecs describe-clusters --clusters "$ECS_CLUSTER_NAME" \
      --query 'clusters[?status==`ACTIVE`].clusterName | [0]')" ]]; then
  skip "ECS クラスタ既存: $ECS_CLUSTER_NAME"
else
  aws ecs create-cluster --region "$AWS_REGION" --cluster-name "$ECS_CLUSTER_NAME" \
    --capacity-providers FARGATE \
    --tags "key=Project,value=${PROJECT}" "key=ManagedBy,value=infra-cli" >/dev/null
  ok "ECS クラスタ作成: $ECS_CLUSTER_NAME"
fi
# Container Insights は追加課金のため有効にしない（インフラ設計書 §3.12）

# ------------------------------------------------------------
# ALB（共有）
# ------------------------------------------------------------
ALB_ARN="$(find_alb)"
if [[ -n "$ALB_ARN" ]]; then
  skip "ALB 既存"
else
  ALB_ARN="$(aws_text elbv2 create-load-balancer \
    --name "$ALB_NAME" --type application --scheme internet-facing --ip-address-type ipv4 \
    --subnets "$SUBNET_A" "$SUBNET_C" --security-groups "$ALB_SG" \
    --tags "Key=Project,Value=${PROJECT}" "Key=ManagedBy,Value=infra-cli" \
    --query 'LoadBalancers[0].LoadBalancerArn')"
  [[ -n "$ALB_ARN" ]] || die "ALB の作成に失敗しました"
  ok "ALB 作成"
fi
ALB_DNS="$(aws_text elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" --query 'LoadBalancers[0].DNSName')"

# ------------------------------------------------------------
# ターゲットグループ
#   ヘルスチェックは /api/health（浅い）を使う。
#   /api/health/deep（DB 込み）を使うと、DB 障害時に全タスクが
#   unhealthy 判定されて再起動ループに陥る。
# ------------------------------------------------------------
TG_ARN="$(find_target_group "$TARGET_GROUP_NAME")"
if [[ -n "$TG_ARN" ]]; then
  skip "ターゲットグループ既存: $TARGET_GROUP_NAME"
else
  TG_ARN="$(aws_text elbv2 create-target-group \
    --name "$TARGET_GROUP_NAME" --protocol HTTP --port "$CONTAINER_PORT" \
    --vpc-id "$VPC_ID" --target-type ip \
    --health-check-protocol HTTP --health-check-path "/api/health" \
    --health-check-interval-seconds 30 --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 --unhealthy-threshold-count 2 \
    --matcher "HttpCode=200" \
    --tags "Key=Project,Value=${PROJECT}" "Key=Env,Value=${ENV_NAME}" \
    --query 'TargetGroups[0].TargetGroupArn')"
  [[ -n "$TG_ARN" ]] || die "ターゲットグループの作成に失敗しました"
  ok "ターゲットグループ作成: $TARGET_GROUP_NAME（ヘルスチェック /api/health）"
fi
# デプロイ時の切り替えを速くする（既定 300 秒は 1 タスク運用では長すぎる）。
# なお standalone の server.js は SIGTERM で即 exit するため、
# 実質この登録解除待ちが唯一のドレイン時間になる（サーバー仕様書 §7.3）。
aws elbv2 modify-target-group-attributes --region "$AWS_REGION" \
  --target-group-arn "$TG_ARN" \
  --attributes Key=deregistration_delay.timeout_seconds,Value=30 >/dev/null

# ALB のアイドルタイムアウト。
# コンテナ側の KEEP_ALIVE_TIMEOUT_MS はこの値より必ず長くすること。
# 逆転すると、ALB が再利用しようとした接続を Node 側が先に閉じ、
# 散発的な 502 Bad Gateway が発生する（サーバー仕様書 §7.2）。
aws elbv2 modify-load-balancer-attributes --region "$AWS_REGION" \
  --load-balancer-arn "$ALB_ARN" \
  --attributes "Key=idle_timeout.timeout_seconds,Value=${ALB_IDLE_TIMEOUT_SEC}" >/dev/null
ok "ALB アイドルタイムアウト: ${ALB_IDLE_TIMEOUT_SEC}s（コンテナ keep-alive: ${KEEP_ALIVE_TIMEOUT_MS}ms）"

# ------------------------------------------------------------
# リスナー
#   DOMAIN_NAME あり : 443(HTTPS) にホストベースルールを追加、80 は 443 へリダイレクト
#   DOMAIN_NAME なし : 環境ごとの HTTP ポートで直接受ける（ドメイン取得前の動作確認用）
# ------------------------------------------------------------
listener_on_port() {
  aws_text elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" \
    --query "Listeners[?Port==\`$1\`].ListenerArn | [0]"
}

if [[ -n "${DOMAIN_NAME:-}" && -n "${ACM_CERTIFICATE_ARN:-}" ]]; then
  HTTPS_LISTENER="$(listener_on_port 443)"
  if [[ -z "$HTTPS_LISTENER" ]]; then
    HTTPS_LISTENER="$(aws_text elbv2 create-listener --load-balancer-arn "$ALB_ARN" \
      --protocol HTTPS --port 443 --certificates "CertificateArn=$ACM_CERTIFICATE_ARN" \
      --ssl-policy ELBSecurityPolicy-TLS13-1-2-2021-06 \
      --default-actions "Type=fixed-response,FixedResponseConfig={StatusCode=404,ContentType=text/plain,MessageBody=Not Found}" \
      --query 'Listeners[0].ListenerArn')"
    ok "HTTPS リスナー作成 (443)"
  else
    skip "HTTPS リスナー既存 (443)"
  fi

  HOST_HEADER="$DOMAIN_NAME"
  [[ "$ENV_NAME" == "staging" ]] && HOST_HEADER="staging.${DOMAIN_NAME}"
  RULE_PRIORITY=$([[ "$ENV_NAME" == "prod" ]] && echo 100 || echo 200)

  EXISTING_RULE="$(aws_text elbv2 describe-rules --listener-arn "$HTTPS_LISTENER" \
    --query "Rules[?Priority=='$RULE_PRIORITY'].RuleArn | [0]")"
  if [[ -n "$EXISTING_RULE" ]]; then
    aws elbv2 modify-rule --region "$AWS_REGION" --rule-arn "$EXISTING_RULE" \
      --conditions "Field=host-header,Values=$HOST_HEADER" \
      --actions "Type=forward,TargetGroupArn=$TG_ARN" >/dev/null
    skip "リスナールール更新: $HOST_HEADER"
  else
    aws elbv2 create-rule --region "$AWS_REGION" --listener-arn "$HTTPS_LISTENER" \
      --priority "$RULE_PRIORITY" \
      --conditions "Field=host-header,Values=$HOST_HEADER" \
      --actions "Type=forward,TargetGroupArn=$TG_ARN" >/dev/null
    ok "リスナールール作成: $HOST_HEADER → $TARGET_GROUP_NAME"
  fi

  # 80 → 443 リダイレクト
  if [[ -z "$(listener_on_port 80)" ]]; then
    aws elbv2 create-listener --region "$AWS_REGION" --load-balancer-arn "$ALB_ARN" \
      --protocol HTTP --port 80 \
      --default-actions '{"Type":"redirect","RedirectConfig":{"Protocol":"HTTPS","Port":"443","StatusCode":"HTTP_301"}}' >/dev/null
    ok "HTTP(80) → HTTPS リダイレクトを作成"
  fi
  PUBLIC_URL="https://${HOST_HEADER}"
else
  LISTENER="$(listener_on_port "$HTTP_LISTENER_PORT")"
  if [[ -n "$LISTENER" ]]; then
    aws elbv2 modify-listener --region "$AWS_REGION" --listener-arn "$LISTENER" \
      --default-actions "Type=forward,TargetGroupArn=$TG_ARN" >/dev/null
    skip "リスナー更新 (:$HTTP_LISTENER_PORT)"
  else
    aws elbv2 create-listener --region "$AWS_REGION" --load-balancer-arn "$ALB_ARN" \
      --protocol HTTP --port "$HTTP_LISTENER_PORT" \
      --default-actions "Type=forward,TargetGroupArn=$TG_ARN" >/dev/null
    ok "HTTP リスナー作成 (:$HTTP_LISTENER_PORT)"
  fi
  PUBLIC_URL="http://${ALB_DNS}:${HTTP_LISTENER_PORT}"
  warn "ドメイン未設定のため HTTP で公開されます。本番運用前に必ず HTTPS 化してください。"
fi

# ------------------------------------------------------------
# タスク定義
# ------------------------------------------------------------
log "タスク定義を登録中"
cat > /tmp/taskdef.json <<JSON
{
  "family": "${TASK_FAMILY}",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "${TASK_CPU}",
  "memory": "${TASK_MEMORY}",
  "runtimePlatform": { "cpuArchitecture": "X86_64", "operatingSystemFamily": "LINUX" },
  "executionRoleArn": "${EXEC_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "containerDefinitions": [
    {
      "name": "${CONTAINER_NAME}",
      "image": "${IMAGE_URI}",
      "essential": true,
      "portMappings": [{ "containerPort": ${CONTAINER_PORT}, "protocol": "tcp" }],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT", "value": "${CONTAINER_PORT}" },
        { "name": "HOSTNAME", "value": "0.0.0.0" },
        { "name": "APP_ENV", "value": "${ENV_NAME}" },
        { "name": "TZ", "value": "UTC" },
        { "name": "KEEP_ALIVE_TIMEOUT", "value": "${KEEP_ALIVE_TIMEOUT_MS}" },
        { "name": "NODE_OPTIONS", "value": "--max-old-space-size=${NODE_MAX_OLD_SPACE_MB}" },
        { "name": "AWS_REGION", "value": "${AWS_REGION}" },
        { "name": "S3_RECEIPTS_BUCKET", "value": "${RECEIPTS_BUCKET}" },
        { "name": "S3_EXPORTS_BUCKET", "value": "${EXPORTS_BUCKET}" }
      ],
      "secrets": [
        { "name": "DATABASE_URL", "valueFrom": "arn:aws:ssm:${AWS_REGION}:${ACCOUNT_ID}:parameter${SSM_PREFIX}/DATABASE_URL" },
        { "name": "AUTH_SECRET", "valueFrom": "arn:aws:ssm:${AWS_REGION}:${ACCOUNT_ID}:parameter${SSM_PREFIX}/AUTH_SECRET" },
        { "name": "GOOGLE_GEMINI_API_KEY", "valueFrom": "arn:aws:ssm:${AWS_REGION}:${ACCOUNT_ID}:parameter${SSM_PREFIX}/GOOGLE_GEMINI_API_KEY" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "${LOG_GROUP_NAME}",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "stopTimeout": 30
    }
  ],
  "tags": [
    { "key": "Project", "value": "${PROJECT}" },
    { "key": "Env", "value": "${ENV_NAME}" },
    { "key": "ManagedBy", "value": "infra-cli" }
  ]
}
JSON

TD_ARN="$(aws_text ecs register-task-definition --cli-input-json file:///tmp/taskdef.json \
  --query 'taskDefinition.taskDefinitionArn')"
rm -f /tmp/taskdef.json
[[ -n "$TD_ARN" ]] || die "タスク定義の登録に失敗しました"
ok "タスク定義: $TD_ARN"

# ------------------------------------------------------------
# ECS サービス
# ------------------------------------------------------------
SERVICE_STATUS="$(aws_text ecs describe-services --cluster "$ECS_CLUSTER_NAME" --services "$ECS_SERVICE_NAME" \
  --query 'services[0].status')"

if [[ "$SERVICE_STATUS" == "ACTIVE" ]]; then
  log "ECS サービスを更新中"
  aws ecs update-service --region "$AWS_REGION" \
    --cluster "$ECS_CLUSTER_NAME" --service "$ECS_SERVICE_NAME" \
    --task-definition "$TD_ARN" --desired-count "$ECS_DESIRED_COUNT" >/dev/null
  ok "ECS サービス更新"
else
  log "ECS サービスを作成中"
  aws ecs create-service --region "$AWS_REGION" \
    --cluster "$ECS_CLUSTER_NAME" \
    --service-name "$ECS_SERVICE_NAME" \
    --task-definition "$TD_ARN" \
    --desired-count "$ECS_DESIRED_COUNT" \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_A],securityGroups=[$APP_SG],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=$TG_ARN,containerName=$CONTAINER_NAME,containerPort=$CONTAINER_PORT" \
    --health-check-grace-period-seconds 60 \
    --deployment-configuration "minimumHealthyPercent=100,maximumPercent=200,deploymentCircuitBreaker={enable=true,rollback=true}" \
    --tags "key=Project,value=${PROJECT}" "key=Env,value=${ENV_NAME}" "key=ManagedBy,value=infra-cli" >/dev/null
  ok "ECS サービス作成（サーキットブレーカー＋自動ロールバック有効）"
fi

# サブネットは AZ_A のみ指定している ＝ 実質シングル AZ 運用。
# AZ 冗長化する際は subnets=[$SUBNET_A,$SUBNET_C] と desired-count=2 に変える（月 +3,450 円）

aws ssm put-parameter --region "$AWS_REGION" --name "${SSM_PREFIX}/alb/targetGroupArn" \
  --value "$TG_ARN" --type String --overwrite >/dev/null
aws ssm put-parameter --region "$AWS_REGION" --name "${SSM_PREFIX}/alb/dnsName" \
  --value "$ALB_DNS" --type String --overwrite >/dev/null

section "完了"
cat <<EOF
  クラスタ    : $ECS_CLUSTER_NAME
  サービス    : $ECS_SERVICE_NAME (desired=$ECS_DESIRED_COUNT, AZ=$AZ_A のみ)
  ALB DNS     : $ALB_DNS
  公開 URL    : $PUBLIC_URL
  ヘルス      : ${PUBLIC_URL}/api/health

状態確認:
  aws ecs describe-services --region $AWS_REGION --cluster $ECS_CLUSTER_NAME --services $ECS_SERVICE_NAME --query 'services[0].{running:runningCount,desired:desiredCount}'
  aws logs tail $LOG_GROUP_NAME --region $AWS_REGION --follow

次: ./infra/50-observability.sh $ENV_NAME
EOF

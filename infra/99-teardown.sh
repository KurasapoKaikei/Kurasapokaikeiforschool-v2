#!/usr/bin/env bash
# ============================================================
# 99 環境の削除
#
# 構築と逆順に削除する。実行前に必ず確認を求める。
#
# 既定では **S3 バケットと RDS の最終スナップショットは残す**。
# 会計データを不可逆に失う操作は、明示的なフラグがない限り行わない。
#
#   ./infra/99-teardown.sh staging
#   DELETE_BUCKETS=1 ./infra/99-teardown.sh staging   # バケットも消す
#   KEEP_NETWORK=1   ./infra/99-teardown.sh staging   # VPC は残す（本番と共有のため通常はこちら）
# ============================================================

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
load_config "${1:-}"
require_aws

section "環境の削除（${ENV_NAME}）"

warn "アカウント $ACCOUNT_ID / リージョン $AWS_REGION の ${ENV_NAME} 環境を削除します。"
if [[ "$ENV_NAME" == "prod" ]]; then
  warn "★ これは本番環境です ★"
fi
confirm "本当に削除しますか？"

get_param() { aws_text ssm get-parameter --name "$1" --query 'Parameter.Value'; }

# ------------------------------------------------------------
# ECS サービス
# ------------------------------------------------------------
if [[ -n "$(aws_text ecs describe-services --cluster "$ECS_CLUSTER_NAME" --services "$ECS_SERVICE_NAME" --query 'services[?status==`ACTIVE`].serviceName | [0]')" ]]; then
  log "ECS サービスを 0 台にして削除中"
  aws ecs update-service --region "$AWS_REGION" --cluster "$ECS_CLUSTER_NAME" \
    --service "$ECS_SERVICE_NAME" --desired-count 0 >/dev/null
  aws ecs delete-service --region "$AWS_REGION" --cluster "$ECS_CLUSTER_NAME" \
    --service "$ECS_SERVICE_NAME" --force >/dev/null
  ok "ECS サービス削除"
else
  skip "ECS サービスなし"
fi

# ------------------------------------------------------------
# ALB リスナー / ルール / ターゲットグループ
# ------------------------------------------------------------
ALB_ARN="$(find_alb)"
TG_ARN="$(find_target_group "$TARGET_GROUP_NAME")"

if [[ -n "$ALB_ARN" && -n "$TG_ARN" ]]; then
  for L in $(aws_text elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --query 'Listeners[].ListenerArn'); do
    # この環境の TG を指すルールを削除
    for R in $(aws_text elbv2 describe-rules --listener-arn "$L" \
        --query "Rules[?!(IsDefault) && Actions[?TargetGroupArn=='$TG_ARN']].RuleArn"); do
      aws elbv2 delete-rule --region "$AWS_REGION" --rule-arn "$R" >/dev/null && ok "リスナールール削除"
    done
    # デフォルトアクションがこの環境の TG を指すリスナーごと削除
    DEFAULT_TG="$(aws_text elbv2 describe-listeners --listener-arns "$L" --query 'Listeners[0].DefaultActions[0].TargetGroupArn')"
    if [[ "$DEFAULT_TG" == "$TG_ARN" ]]; then
      aws elbv2 delete-listener --region "$AWS_REGION" --listener-arn "$L" >/dev/null && ok "リスナー削除"
    fi
  done
fi

if [[ -n "$TG_ARN" ]]; then
  aws elbv2 delete-target-group --region "$AWS_REGION" --target-group-arn "$TG_ARN" >/dev/null 2>&1 \
    && ok "ターゲットグループ削除" || warn "ターゲットグループの削除に失敗（リスナーが残っている可能性）"
fi

# ALB とクラスタは共有。もう一方の環境が使っていなければ削除する
OTHER_ENV=$([[ "$ENV_NAME" == "prod" ]] && echo "staging" || echo "prod")
OTHER_TG="$(aws_text elbv2 describe-target-groups --names "${PROJECT}-${OTHER_ENV}-tg" --query 'TargetGroups[0].TargetGroupArn')"
if [[ -z "$OTHER_TG" && -n "$ALB_ARN" ]]; then
  log "もう一方の環境が存在しないため ALB を削除中"
  aws elbv2 delete-load-balancer --region "$AWS_REGION" --load-balancer-arn "$ALB_ARN" >/dev/null
  ok "ALB 削除"
else
  skip "ALB は ${OTHER_ENV} が使用中のため残します"
fi

# ------------------------------------------------------------
# RDS
# ------------------------------------------------------------
if [[ -n "$(find_db)" ]]; then
  log "RDS を削除中（最終スナップショットを取得）"
  aws rds modify-db-instance --region "$AWS_REGION" \
    --db-instance-identifier "$DB_IDENTIFIER" --no-deletion-protection --apply-immediately >/dev/null 2>&1 || true
  SNAP="${DB_IDENTIFIER}-final-$(date +%Y%m%d%H%M%S)"
  aws rds delete-db-instance --region "$AWS_REGION" \
    --db-instance-identifier "$DB_IDENTIFIER" \
    --final-db-snapshot-identifier "$SNAP" >/dev/null
  ok "RDS 削除を開始（最終スナップショット: $SNAP）"
  warn "スナップショットは残ります。不要なら明示的に削除してください:"
  warn "  aws rds delete-db-snapshot --region $AWS_REGION --db-snapshot-identifier $SNAP"
else
  skip "RDS なし"
fi

# ------------------------------------------------------------
# S3（既定では残す）
# ------------------------------------------------------------
if [[ "${DELETE_BUCKETS:-0}" == "1" ]]; then
  warn "S3 バケットを削除します。証憑データは復元できません。"
  confirm "証憑を含む S3 バケットを完全に削除しますか？"
  for B in "$(get_param "${SSM_PREFIX}/s3/receiptsBucket")" "$(get_param "${SSM_PREFIX}/s3/exportsBucket")"; do
    [[ -n "$B" ]] || continue
    aws s3 rb "s3://$B" --force --region "$AWS_REGION" >/dev/null 2>&1 \
      && ok "バケット削除: $B" || warn "バケット削除に失敗: $B（バージョンが残っている可能性）"
  done
else
  skip "S3 バケットは残します（削除するには DELETE_BUCKETS=1）"
fi

# ------------------------------------------------------------
# ロググループ / アラーム / SNS / IAM
# ------------------------------------------------------------
aws logs delete-log-group --region "$AWS_REGION" --log-group-name "$LOG_GROUP_NAME" >/dev/null 2>&1 \
  && ok "ロググループ削除" || skip "ロググループなし"

ALARMS="$(aws_text cloudwatch describe-alarms --alarm-name-prefix "${PROJECT}-${ENV_NAME}-" --query 'MetricAlarms[].AlarmName')"
if [[ -n "$ALARMS" ]]; then
  # shellcheck disable=SC2086
  aws cloudwatch delete-alarms --region "$AWS_REGION" --alarm-names $ALARMS >/dev/null && ok "アラーム削除"
fi

TOPIC="$(aws_text sns list-topics --query "Topics[?contains(TopicArn, '${SNS_TOPIC_NAME}')].TopicArn | [0]")"
[[ -n "$TOPIC" ]] && aws sns delete-topic --region "$AWS_REGION" --topic-arn "$TOPIC" >/dev/null && ok "SNS トピック削除"

for ROLE in "$TASK_EXEC_ROLE_NAME" "$TASK_ROLE_NAME"; do
  if [[ -n "$(aws_text iam get-role --role-name "$ROLE" --query 'Role.RoleName')" ]]; then
    for P in $(aws_text iam list-role-policies --role-name "$ROLE" --query 'PolicyNames[]'); do
      aws iam delete-role-policy --role-name "$ROLE" --policy-name "$P" >/dev/null
    done
    for A in $(aws_text iam list-attached-role-policies --role-name "$ROLE" --query 'AttachedPolicies[].PolicyArn'); do
      aws iam detach-role-policy --role-name "$ROLE" --policy-arn "$A" >/dev/null
    done
    aws iam delete-role --role-name "$ROLE" >/dev/null && ok "IAM ロール削除: $ROLE"
  fi
done

# ------------------------------------------------------------
# ネットワーク（共有のため既定では残す）
# ------------------------------------------------------------
if [[ "${KEEP_NETWORK:-1}" == "0" && -z "$OTHER_TG" ]]; then
  warn "VPC の削除は依存関係が多く、CLI での完全削除は不安定です。"
  warn "コンソールの VPC ウィザードから削除するか、以下を手動で順に削除してください:"
  warn "  ECS サービス → ENI → SG → サブネット → ルートテーブル → IGW → VPC"
else
  skip "VPC は残します（prod / staging 共有のため）"
fi

section "削除完了"
echo "SSM パラメータは残しています。完全に消す場合:"
echo "  aws ssm get-parameters-by-path --region $AWS_REGION --path $SSM_PREFIX --recursive --query 'Parameters[].Name' --output text | xargs -n1 aws ssm delete-parameter --region $AWS_REGION --name"

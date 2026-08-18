#!/usr/bin/env bash
# ============================================================
# 50 監視
#
# 作るもの:
#   SNS トピック（+ メール購読）
#   CloudWatch アラーム（インフラ設計書 §3.12 の主要アラーム）
#
# 有料の監視サービスは使わない。CloudWatch の基本機能のみ。
# 外形監視は UptimeRobot 無料枠（手動設定・下部に案内を出力）。
#
#   ALERT_EMAIL=ops@example.com ./infra/50-observability.sh prod
# ============================================================

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
load_config "${1:-}"
require_aws

section "監視構築（${ENV_NAME}）"

get_param() { aws_text ssm get-parameter --name "$1" --query 'Parameter.Value'; }

# ------------------------------------------------------------
# SNS トピック
# ------------------------------------------------------------
TOPIC_ARN="$(aws_text sns create-topic --name "$SNS_TOPIC_NAME" \
  --tags "Key=Project,Value=${PROJECT}" "Key=Env,Value=${ENV_NAME}" --query 'TopicArn')"
[[ -n "$TOPIC_ARN" ]] || die "SNS トピックの作成に失敗しました"
ok "SNS トピック: $TOPIC_ARN"

if [[ -n "${ALERT_EMAIL:-}" ]]; then
  EXISTING_SUB="$(aws_text sns list-subscriptions-by-topic --topic-arn "$TOPIC_ARN" \
    --query "Subscriptions[?Endpoint=='$ALERT_EMAIL'].SubscriptionArn | [0]")"
  if [[ -n "$EXISTING_SUB" ]]; then
    skip "メール購読は既存: $ALERT_EMAIL"
  else
    aws sns subscribe --region "$AWS_REGION" --topic-arn "$TOPIC_ARN" \
      --protocol email --notification-endpoint "$ALERT_EMAIL" >/dev/null
    ok "メール購読を追加: $ALERT_EMAIL"
    warn "確認メールが届きます。リンクをクリックするまで通知は届きません。"
  fi
else
  warn "ALERT_EMAIL が未設定のため通知先がありません。"
  warn "  ALERT_EMAIL=ops@example.com ./infra/50-observability.sh $ENV_NAME"
fi

# ------------------------------------------------------------
# アラーム
# ------------------------------------------------------------
put_alarm() {
  local name="$1"; shift
  aws cloudwatch put-metric-alarm --region "$AWS_REGION" \
    --alarm-name "${PROJECT}-${ENV_NAME}-${name}" \
    --alarm-actions "$TOPIC_ARN" \
    --ok-actions "$TOPIC_ARN" \
    --treat-missing-data notBreaching \
    --tags "Key=Project,Value=${PROJECT}" "Key=Env,Value=${ENV_NAME}" \
    "$@" >/dev/null
  ok "アラーム: ${PROJECT}-${ENV_NAME}-${name}"
}

TG_ARN="$(get_param "${SSM_PREFIX}/alb/targetGroupArn")"
ALB_ARN="$(find_alb)"

if [[ -n "$ALB_ARN" && -n "$TG_ARN" ]]; then
  # ARN 末尾のディメンション表記に変換
  ALB_DIM="${ALB_ARN#*:loadbalancer/}"
  TG_DIM="${TG_ARN#*:}"

  put_alarm "alb-5xx" \
    --alarm-description "ALB の 5xx が 5 分平均で 1% を超えた" \
    --namespace AWS/ApplicationELB --metric-name HTTPCode_Target_5XX_Count \
    --dimensions "Name=LoadBalancer,Value=${ALB_DIM}" "Name=TargetGroup,Value=${TG_DIM}" \
    --statistic Sum --period 300 --evaluation-periods 1 \
    --threshold 10 --comparison-operator GreaterThanThreshold

  put_alarm "alb-latency" \
    --alarm-description "ALB の p95 レイテンシが 3 秒を超えた状態が 5 分継続" \
    --namespace AWS/ApplicationELB --metric-name TargetResponseTime \
    --dimensions "Name=LoadBalancer,Value=${ALB_DIM}" "Name=TargetGroup,Value=${TG_DIM}" \
    --extended-statistic p95 --period 300 --evaluation-periods 1 \
    --threshold 3 --comparison-operator GreaterThanThreshold

  put_alarm "alb-unhealthy-hosts" \
    --alarm-description "正常なターゲットが 0 になった（1 タスク運用のためサービス断と等価）" \
    --namespace AWS/ApplicationELB --metric-name HealthyHostCount \
    --dimensions "Name=LoadBalancer,Value=${ALB_DIM}" "Name=TargetGroup,Value=${TG_DIM}" \
    --statistic Minimum --period 60 --evaluation-periods 3 \
    --threshold 1 --comparison-operator LessThanThreshold \
    --treat-missing-data breaching
else
  warn "ALB / ターゲットグループが未作成のため、ALB 系アラームをスキップします"
fi

# --- ECS -----------------------------------------------------
put_alarm "ecs-running-tasks" \
  --alarm-description "実行中タスク数が想定を下回った" \
  --namespace AWS/ECS --metric-name CPUUtilization \
  --dimensions "Name=ClusterName,Value=${ECS_CLUSTER_NAME}" "Name=ServiceName,Value=${ECS_SERVICE_NAME}" \
  --statistic SampleCount --period 300 --evaluation-periods 1 \
  --threshold 1 --comparison-operator LessThanThreshold \
  --treat-missing-data breaching

put_alarm "ecs-cpu-high" \
  --alarm-description "ECS の CPU が 80% を 10 分継続" \
  --namespace AWS/ECS --metric-name CPUUtilization \
  --dimensions "Name=ClusterName,Value=${ECS_CLUSTER_NAME}" "Name=ServiceName,Value=${ECS_SERVICE_NAME}" \
  --statistic Average --period 300 --evaluation-periods 2 \
  --threshold 80 --comparison-operator GreaterThanThreshold

# --- RDS -----------------------------------------------------
# db.t4g.micro はバースト型かつメモリ 1GB。この 2 つは最小構成では必須（§3.12）
put_alarm "rds-cpu-credit-low" \
  --alarm-description "RDS の CPU バーストクレジットが枯渇しかけている（性能急落の前兆）" \
  --namespace AWS/RDS --metric-name CPUCreditBalance \
  --dimensions "Name=DBInstanceIdentifier,Value=${DB_IDENTIFIER}" \
  --statistic Average --period 300 --evaluation-periods 2 \
  --threshold 30 --comparison-operator LessThanThreshold

put_alarm "rds-freeable-memory-low" \
  --alarm-description "RDS の空きメモリが 100MB を切った（接続断の恐れ）" \
  --namespace AWS/RDS --metric-name FreeableMemory \
  --dimensions "Name=DBInstanceIdentifier,Value=${DB_IDENTIFIER}" \
  --statistic Average --period 300 --evaluation-periods 2 \
  --threshold 104857600 --comparison-operator LessThanThreshold

put_alarm "rds-cpu-high" \
  --alarm-description "RDS の CPU が 80% を 10 分継続" \
  --namespace AWS/RDS --metric-name CPUUtilization \
  --dimensions "Name=DBInstanceIdentifier,Value=${DB_IDENTIFIER}" \
  --statistic Average --period 300 --evaluation-periods 2 \
  --threshold 80 --comparison-operator GreaterThanThreshold

put_alarm "rds-storage-low" \
  --alarm-description "RDS の空きストレージが 4GB を切った" \
  --namespace AWS/RDS --metric-name FreeStorageSpace \
  --dimensions "Name=DBInstanceIdentifier,Value=${DB_IDENTIFIER}" \
  --statistic Average --period 300 --evaluation-periods 1 \
  --threshold 4294967296 --comparison-operator LessThanThreshold

# ------------------------------------------------------------
# コスト異常検知（無料）
#   節約手段ではなく「異常検知手段」として置く（§3.12）
# ------------------------------------------------------------
log "Cost Anomaly Detection を確認中"
if [[ -n "$(aws_text ce get-anomaly-monitors --query "AnomalyMonitors[?MonitorName=='${PROJECT}-cost-monitor'].MonitorName | [0]")" ]]; then
  skip "コストモニタ既存"
else
  aws ce create-anomaly-monitor --region us-east-1 \
    --anomaly-monitor "{\"MonitorName\":\"${PROJECT}-cost-monitor\",\"MonitorType\":\"DIMENSIONAL\",\"MonitorDimension\":\"SERVICE\"}" >/dev/null 2>&1 \
    && ok "コストモニタ作成" \
    || warn "コストモニタの作成に失敗（Cost Explorer が未有効の可能性。コンソールで有効化してください）"
fi

section "完了"
cat <<EOF
  SNS トピック : $TOPIC_ARN
  アラーム     : $(aws_text cloudwatch describe-alarms --alarm-name-prefix "${PROJECT}-${ENV_NAME}-" --query 'length(MetricAlarms)') 件

外形監視（手動設定・無料）:
  UptimeRobot（https://uptimerobot.com/）で以下を 5 分間隔で登録してください。
    1. $(get_param "${SSM_PREFIX}/alb/dnsName" >/dev/null 2>&1 && echo "http://$(get_param "${SSM_PREFIX}/alb/dnsName"):${HTTP_LISTENER_PORT}/api/health" || echo "<ALB DNS>/api/health")
    2. 同 /api/health/deep  （DB 込み。503 で通知されるよう設定）

  CloudWatch Synthetics は 1 カナリアで月 1,500 円かかるため使いません（§6.6）。
EOF

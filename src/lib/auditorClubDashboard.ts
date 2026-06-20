import type { AuditorAuditStatus } from "@/lib/schoolAuditors"
import type { ClubSettlementStatus } from "@/lib/schoolClubSettlement"

export { getClubMemberCount } from "@/lib/clubMembers"

/** 当期の決算提出状況（監査人向け表示） */
export function getClubSettlementSubmissionLabel(
  status: ClubSettlementStatus
): string {
  if (status === "submitted" || status === "approved") return "監査中"
  return "未提出"
}

/** 決算ステータスから監査ステータスバッジ用の値へ（学校側と同ラベル） */
export function auditStatusFromSettlement(
  status: ClubSettlementStatus
): AuditorAuditStatus {
  if (status === "approved") return "completed"
  if (status === "submitted") return "in_progress"
  return "before"
}

/**
 * 学校ポータル：監査人の担当クラブ単位の監査進捗集計
 */

import { classifyClubAuditProgress } from "@/lib/schoolAuditProgressSummary"

export type AuditorAssignedClubProgressCounts = {
  total: number
  preparing: number
  inAudit: number
  approved: number
  rejected: number
}

/** 担当クラブ ID ごとに classifyClubAuditProgress で分類し件数を返す */
export function aggregateAssignedClubAuditProgress(
  assignedClubIds: string[],
): AuditorAssignedClubProgressCounts {
  const counts: AuditorAssignedClubProgressCounts = {
    total: assignedClubIds.length,
    preparing: 0,
    inAudit: 0,
    approved: 0,
    rejected: 0,
  }

  for (const clubId of assignedClubIds) {
    if (!clubId) continue
    const bucket = classifyClubAuditProgress(clubId)
    if (bucket === "preparing") counts.preparing += 1
    else if (bucket === "in_audit") counts.inAudit += 1
    else if (bucket === "approved") counts.approved += 1
    else counts.rejected += 1
  }

  return counts
}

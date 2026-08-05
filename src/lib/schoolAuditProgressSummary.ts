/**
 * 学校管理者ポータル：全クラブの監査ステータス集計（localStorage スキャン）
 */

import {
  CLUB_AUDITOR_AUDIT_STATUS_KEY,
  CLUB_SETTLEMENT_LOCK_KEY,
  getAuditorAuditStatus,
  readClubSettlementLocked,
  type AuditorAuditStatusValue,
} from "@/lib/clubSettlementPortalSync"

export type SchoolAuditProgressBucket =
  | "preparing"
  | "in_audit"
  | "approved"
  | "rejected"

export type SchoolAuditProgressCounts = {
  total: number
  preparing: number
  inAudit: number
  approved: number
  rejected: number
}

export type SchoolAuditProgressSummary = SchoolAuditProgressCounts & {
  byClubId: Record<string, SchoolAuditProgressBucket>
}

/** 1クラブの集計バケット（相互排他） */
export function classifyClubAuditProgress(
  clubId: string,
): SchoolAuditProgressBucket {
  const auditStatus = getAuditorAuditStatus(clubId)
  const locked = readClubSettlementLocked(clubId)
  return classifyFromState(auditStatus, locked)
}

export function classifyFromState(
  auditStatus: AuditorAuditStatusValue,
  locked: boolean,
): SchoolAuditProgressBucket {
  if (auditStatus === "rejected") return "rejected"
  if (auditStatus === "approved") return "approved"
  if (
    locked ||
    auditStatus === "in_review" ||
    auditStatus === "awaiting_manager_approval"
  ) {
    return "in_audit"
  }
  return "preparing"
}

/** localStorage から決算ロックキー末尾の clubId を列挙（登録外の孤立キー検出用） */
export function scanClubIdsFromSettlementStorage(): string[] {
  if (typeof window === "undefined") return []
  const ids = new Set<string>()
  const lockPrefix = `${CLUB_SETTLEMENT_LOCK_KEY}_`
  const auditPrefix = `${CLUB_AUDITOR_AUDIT_STATUS_KEY}_`
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (key.startsWith(lockPrefix)) {
        ids.add(key.slice(lockPrefix.length))
      } else if (key.startsWith(auditPrefix)) {
        ids.add(key.slice(auditPrefix.length))
      }
    }
  } catch {
    // ignore
  }
  return Array.from(ids)
}

/** 登録クラブ ID を正本とし、ストレージ上の孤立 ID もマージして集計 */
export function aggregateSchoolAuditProgress(
  registeredClubIds: string[],
): SchoolAuditProgressSummary {
  const scanned = scanClubIdsFromSettlementStorage()
  const allIds = Array.from(
    new Set([...registeredClubIds, ...scanned].filter(Boolean)),
  )
  const byClubId: Record<string, SchoolAuditProgressBucket> = {}
  const counts: SchoolAuditProgressCounts = {
    total: registeredClubIds.length > 0 ? registeredClubIds.length : allIds.length,
    preparing: 0,
    inAudit: 0,
    approved: 0,
    rejected: 0,
  }

  const idsToClassify =
    registeredClubIds.length > 0 ? registeredClubIds : allIds

  for (const clubId of idsToClassify) {
    const bucket = classifyClubAuditProgress(clubId)
    byClubId[clubId] = bucket
    if (bucket === "preparing") counts.preparing += 1
    else if (bucket === "in_audit") counts.inAudit += 1
    else if (bucket === "approved") counts.approved += 1
    else counts.rejected += 1
  }

  if (registeredClubIds.length > 0) {
    counts.total = registeredClubIds.length
  }

  return { ...counts, byClubId }
}

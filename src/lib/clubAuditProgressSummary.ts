/**
 * 監査人ダッシュボード向け：クラブ単位の監査進捗サマリー（提出日時・指摘件数等）
 */

import {
  getAuditorAuditStatus,
  getAuditorAuditStatusBadgeVariant,
  loadSettlementHistoryFlow,
  readClubSettlementLocked,
  type AuditorAuditBadgeVariant,
} from "@/lib/clubSettlementPortalSync"
import {
  classifyClubAuditProgress,
  type SchoolAuditProgressBucket,
} from "@/lib/schoolAuditProgressSummary"
import { getSettlementRejectReason } from "@/lib/schoolClubSettlement"
import { getSchoolHeaderDisplay } from "@/lib/schoolHeaderDisplay"

export type ClubAuditProgressSummary = {
  clubId: string
  clubName: string
  fiscalPeriod: string
  /** 決算書・証憑の提出日時（未提出なら null） */
  submittedAt: string | null
  isSubmitted: boolean
  auditStatusLabel: string
  auditBadgeVariant: AuditorAuditBadgeVariant
  progressBucket: SchoolAuditProgressBucket
  findingCount: number
}

function parseStepTimestamp(stepId: string): number | null {
  const match = /^step-(\d+)-/.exec(stepId)
  if (!match) return null
  const ts = Number(match[1])
  return Number.isFinite(ts) ? ts : null
}

function formatSubmissionDateTime(ms: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms))
}

/** 履歴フローから最終提出（SUBMITTED）ステップの日時を推定 */
function resolveLatestSubmissionTimestamp(clubId: string): string | null {
  const flow = loadSettlementHistoryFlow(clubId)
  let latestMs: number | null = null

  for (let i = 0; i <= flow.currentIndex; i++) {
    const step = flow.steps[i]
    if (step?.status !== "SUBMITTED") continue
    const ts = parseStepTimestamp(step.id)
    if (ts != null && (latestMs == null || ts > latestMs)) {
      latestMs = ts
    }
  }

  if (latestMs != null) return formatSubmissionDateTime(latestMs)
  if (readClubSettlementLocked(clubId)) {
    return "提出済（日時未記録）"
  }
  return null
}

/** 差戻し履歴ステップ＋現行差戻し理由から指摘件数を集計 */
function countAuditFindings(clubId: string): number {
  const flow = loadSettlementHistoryFlow(clubId)
  const rejectedInHistory = flow.steps.filter((s) => s.status === "REJECTED").length
  const activeReason = getSettlementRejectReason(clubId)?.trim()
  const auditStatus = getAuditorAuditStatus(clubId)
  const extra =
    activeReason && auditStatus === "rejected" && rejectedInHistory === 0 ? 1 : 0
  return rejectedInHistory + extra
}

function auditStatusLabelForBucket(bucket: SchoolAuditProgressBucket): string {
  switch (bucket) {
    case "preparing":
      return "未着手"
    case "in_audit":
      return "監査中"
    case "approved":
      return "承認済"
    case "rejected":
      return "差戻"
    default:
      return "未着手"
  }
}

/** クラブ ID から監査進捗サマリー（監査人ダッシュボードカード用）を組み立てる */
export function getClubAuditProgressSummary(
  clubId: string,
  clubName: string
): ClubAuditProgressSummary {
  const bucket = classifyClubAuditProgress(clubId)
  const locked = readClubSettlementLocked(clubId)
  const auditStatus = getAuditorAuditStatus(clubId)
  const submittedAt = resolveLatestSubmissionTimestamp(clubId)
  const isSubmitted = locked || bucket !== "preparing"

  return {
    clubId,
    clubName: clubName.trim() || "（名称未設定）",
    fiscalPeriod: getSchoolHeaderDisplay().fiscalPeriod,
    submittedAt,
    isSubmitted,
    auditStatusLabel: auditStatusLabelForBucket(bucket),
    auditBadgeVariant: getAuditorAuditStatusBadgeVariant(auditStatus, locked),
    progressBucket: bucket,
    findingCount: countAuditFindings(clubId),
  }
}

/**
 * 学校管理者が発行した「決算・監査期間」の表示用状態（デモ・localStorage）
 */

import type { SettlementDeadlineNoticePeriod } from "@/lib/portalMessages"

export const SCHOOL_SETTLEMENT_NOTICE_WINDOW_KEY =
  "kurasaokaikei-school-settlement-notice-window"

export const SCHOOL_SETTLEMENT_NOTICE_WINDOW_CHANGED_EVENT =
  "kurasaokaikei-school-settlement-notice-window-changed"

export type SchoolSettlementNoticeWindow = {
  period: SettlementDeadlineNoticePeriod
  /** 決算データ提出期限 YYYY-MM-DD */
  deadlineDate: string
  /** 監査完了期限 YYYY-MM-DD */
  auditCompletionDate: string
  notifiedAt: string
}

export type SchoolAuditPeriodStatus = "in_audit_period" | "out_of_audit_period"

function dispatchChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SCHOOL_SETTLEMENT_NOTICE_WINDOW_CHANGED_EVENT))
}

function todayIsoLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function loadSchoolSettlementNoticeWindow(): SchoolSettlementNoticeWindow | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(SCHOOL_SETTLEMENT_NOTICE_WINDOW_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SchoolSettlementNoticeWindow>
    if (
      (parsed.period !== "mid_term" && parsed.period !== "year_end") ||
      typeof parsed.deadlineDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(parsed.deadlineDate)
    ) {
      return null
    }
    // 旧データ互換: 監査完了期限未設定なら提出期限を仮置き（期間外判定は厳密にしない）
    const auditCompletionDate =
      typeof parsed.auditCompletionDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsed.auditCompletionDate)
        ? parsed.auditCompletionDate
        : parsed.deadlineDate
    return {
      period: parsed.period,
      deadlineDate: parsed.deadlineDate,
      auditCompletionDate,
      notifiedAt:
        typeof parsed.notifiedAt === "string"
          ? parsed.notifiedAt
          : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function saveSchoolSettlementNoticeWindow(
  period: SettlementDeadlineNoticePeriod,
  deadlineDate: string,
  auditCompletionDate: string
): SchoolSettlementNoticeWindow {
  const next: SchoolSettlementNoticeWindow = {
    period,
    deadlineDate,
    auditCompletionDate,
    notifiedAt: new Date().toISOString(),
  }
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SCHOOL_SETTLEMENT_NOTICE_WINDOW_KEY, JSON.stringify(next))
      dispatchChanged()
    } catch {
      // ignore
    }
  }
  return next
}

export function clearSchoolSettlementNoticeWindow(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(SCHOOL_SETTLEMENT_NOTICE_WINDOW_KEY)
    dispatchChanged()
  } catch {
    // ignore
  }
}

/** 通知があり、本日が監査完了期限以前なら監査期間中 */
export function resolveSchoolAuditPeriodStatus(
  windowState: SchoolSettlementNoticeWindow | null,
  today: string = todayIsoLocal()
): SchoolAuditPeriodStatus {
  if (!windowState) return "out_of_audit_period"
  if (today <= windowState.auditCompletionDate) return "in_audit_period"
  return "out_of_audit_period"
}

export function formatMonthDayJa(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return isoDate
  return `${Number(m[2])}月${Number(m[3])}日`
}

export function formatFullDateJa(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return isoDate
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`
}

export function settlementPeriodShortLabel(
  period: SettlementDeadlineNoticePeriod
): string {
  return period === "mid_term" ? "半期決算" : "年度末決算"
}

/** 例: 半期決算提出期間中　提出期限9月30日 */
export function formatSettlementNoticeWindowBanner(
  windowState: SchoolSettlementNoticeWindow
): string {
  const periodText =
    windowState.period === "mid_term"
      ? "半期決算提出期間中"
      : "年度末決算提出期間中"
  return `${periodText}　提出期限${formatMonthDayJa(windowState.deadlineDate)}`
}

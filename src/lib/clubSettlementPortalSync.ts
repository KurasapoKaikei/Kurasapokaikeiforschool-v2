/**
 * クラブ決算提出ロック・監査ステータス・双六UI履歴の localStorage 正本（デモ）
 * ロックは期間ベース（H1=上期 / FULL=年度全体 / NONE=解除）
 */

import {
  approveClubSettlement,
  getClubSettlementStatus,
  rejectClubSettlement,
  setClubSettlementStatus,
  SETTLEMENT_CHANGED_EVENT,
} from "@/lib/schoolClubSettlement"
import { getClubById } from "@/lib/schoolClubs"
import { loadCurrentAuditor } from "@/lib/currentAuditor"
import { sendAuditPortalMessage } from "@/lib/portalMessages"
import {
  DEFAULT_PORTAL_FISCAL_YEAR,
} from "@/lib/portalBrand"
import {
  getFiscalYearDateRange,
  parsePortalFiscalYearLabel,
} from "@/lib/schoolCategoryUsage"

export const CLUB_SETTLEMENT_LOCK_KEY = "is_club_settlement_locked"
/** ロック種別: H1（上期） / FULL（年度全体） / NONE（解除） */
export const CLUB_LOCKED_PERIOD_KEY = "locked_period"
export const CLUB_LOCKED_START_DATE_KEY = "locked_start_date"
export const CLUB_LOCKED_END_DATE_KEY = "locked_end_date"
export const CLUB_LOCKED_FISCAL_YEAR_KEY = "locked_fiscal_year"
export const CLUB_SETTLEMENT_HISTORY_KEY = "club_settlement_history_flow"
export const CLUB_AUDITOR_AUDIT_STATUS_KEY = "club_auditor_audit_status"

/** 期間ロック種別 */
export type SettlementLockPeriodKind = "NONE" | "H1" | "FULL"

export const CLUB_SETTLEMENT_LOCK_CHANGED_EVENT =
  "kurasaokaikei-club-settlement-lock-changed"
export const CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT =
  "kurasaokaikei-club-auditor-audit-status-changed"

export type AuditorAuditStatusValue =
  | "not_started"
  | "awaiting_manager_approval"
  | "in_review"
  | "approved"
  | "rejected"

export type HistoryStatus =
  | "PREPARING"
  | "AWAITING_MANAGER"
  | "IN_REVIEW"
  | "SUBMITTED" // 旧データ互換（読込時に正規化）
  | "REJECTED"
  | "APPROVED"

export type SettlementHistoryStep = {
  id: string
  label: string
  status: HistoryStatus
}

export type SettlementHistoryFlow = {
  steps: SettlementHistoryStep[]
  currentIndex: number
}

/** 双六 UI: 作成中 → 部内承認待ち → 監査中 → 承認済（差戻しは挿入） */
const DEFAULT_FLOW: SettlementHistoryStep[] = [
  { id: "1", label: "作成中", status: "PREPARING" },
  { id: "2", label: "部内承認待ち", status: "AWAITING_MANAGER" },
  { id: "3", label: "監査中", status: "IN_REVIEW" },
  { id: "4", label: "承認済", status: "APPROVED" },
]

/** 決算提出区分（半期＝中間 / 年度末） */
export type ClubSettlementPeriodKind = "mid_term" | "year_end"

export const CLUB_SETTLEMENT_PERIOD_KEY = "club_settlement_period"

export function makeClubSettlementPeriodKey(clubId: string): string {
  return `${CLUB_SETTLEMENT_PERIOD_KEY}_${clubId}`
}

export function getClubSettlementPeriod(
  clubId: string
): ClubSettlementPeriodKind | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(makeClubSettlementPeriodKey(clubId))
    if (raw === "mid_term" || raw === "year_end") return raw
    return null
  } catch {
    return null
  }
}

export function setClubSettlementPeriod(
  clubId: string,
  period: ClubSettlementPeriodKind | null
): void {
  if (typeof window === "undefined") return
  try {
    const key = makeClubSettlementPeriodKey(clubId)
    if (!period) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, period)
    }
  } catch {
    // ignore
  }
}

export function getClubSettlementPeriodLabel(
  period: ClubSettlementPeriodKind | null
): string {
  if (period === "mid_term") return "半期決算（中間）"
  if (period === "year_end") return "年度末決算"
  return "—"
}

/** 保存済み双六を新フロー（部内承認待ち）へ正規化 */
function normalizeHistoryStepLabels(
  steps: SettlementHistoryStep[]
): SettlementHistoryStep[] {
  const mapped = steps.map((s) => {
    if (s.status === "PREPARING" && (s.label === "未提出" || !s.label)) {
      return { ...s, label: "作成中", status: "PREPARING" as const }
    }
    if (s.status === "SUBMITTED") {
      if (s.label === "監査中") {
        return { ...s, label: "監査中", status: "IN_REVIEW" as const }
      }
      return { ...s, label: "部内承認待ち", status: "AWAITING_MANAGER" as const }
    }
    if (s.status === "AWAITING_MANAGER") {
      return { ...s, label: "部内承認待ち" }
    }
    if (s.status === "IN_REVIEW") {
      return { ...s, label: "監査中" }
    }
    return s
  })
  const hasAwaiting = mapped.some((s) => s.status === "AWAITING_MANAGER")
  const hasInReview = mapped.some((s) => s.status === "IN_REVIEW")
  const hasReject = mapped.some((s) => s.status === "REJECTED")
  // 旧デフォルト3ステップのみを4ステップへ置換（差戻履歴は維持）
  if (!hasAwaiting && !hasInReview && !hasReject && mapped.length <= 3) {
    return [...DEFAULT_FLOW]
  }
  return mapped
}

function dispatchLockChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT))
}

function dispatchAuditStatusChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT))
}

function dispatchSettlementChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SETTLEMENT_CHANGED_EVENT))
}

function genStepId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function makeClubSettlementLockKey(clubId: string): string {
  return `${CLUB_SETTLEMENT_LOCK_KEY}_${clubId}`
}

export function makeClubLockedPeriodKey(clubId: string): string {
  return `${CLUB_LOCKED_PERIOD_KEY}_${clubId}`
}

export function makeClubLockedStartDateKey(clubId: string): string {
  return `${CLUB_LOCKED_START_DATE_KEY}_${clubId}`
}

export function makeClubLockedEndDateKey(clubId: string): string {
  return `${CLUB_LOCKED_END_DATE_KEY}_${clubId}`
}

export function makeClubLockedFiscalYearKey(clubId: string): string {
  return `${CLUB_LOCKED_FISCAL_YEAR_KEY}_${clubId}`
}

export function makeClubSettlementHistoryKey(clubId: string): string {
  return `${CLUB_SETTLEMENT_HISTORY_KEY}_${clubId}`
}

export function makeClubAuditorAuditStatusKey(clubId: string): string {
  return `${CLUB_AUDITOR_AUDIT_STATUS_KEY}_${clubId}`
}

/** 上期（H1）または年度全体（FULL）の日付範囲 */
export function resolveSettlementLockDateRange(
  kind: "H1" | "FULL",
  fiscalYear: number
): { startDate: string; endDate: string } {
  if (kind === "H1") {
    return {
      startDate: `${fiscalYear}-04-01`,
      endDate: `${fiscalYear}-09-30`,
    }
  }
  const { start, end } = getFiscalYearDateRange(fiscalYear)
  return { startDate: start, endDate: end }
}

function writeLegacyBooleanLock(clubId: string, locked: boolean): void {
  localStorage.setItem(
    makeClubSettlementLockKey(clubId),
    locked ? "true" : "false"
  )
}

/**
 * 旧 boolean ロックのみのデータを期間ロックへ移行する。
 * mid_term → H1 / それ以外 → FULL
 */
function migrateLegacyBooleanLock(clubId: string): void {
  if (typeof window === "undefined") return
  try {
    const kindRaw = localStorage.getItem(makeClubLockedPeriodKey(clubId))
    if (kindRaw === "H1" || kindRaw === "FULL" || kindRaw === "NONE") return
    const legacyLocked =
      localStorage.getItem(makeClubSettlementLockKey(clubId)) === "true"
    if (!legacyLocked) {
      localStorage.setItem(makeClubLockedPeriodKey(clubId), "NONE")
      return
    }
    const submitPeriod = getClubSettlementPeriod(clubId)
    const kind: "H1" | "FULL" =
      submitPeriod === "mid_term" ? "H1" : "FULL"
    const fiscalYear = parsePortalFiscalYearLabel(DEFAULT_PORTAL_FISCAL_YEAR)
    const range = resolveSettlementLockDateRange(kind, fiscalYear)
    localStorage.setItem(makeClubLockedPeriodKey(clubId), kind)
    localStorage.setItem(makeClubLockedStartDateKey(clubId), range.startDate)
    localStorage.setItem(makeClubLockedEndDateKey(clubId), range.endDate)
    localStorage.setItem(
      makeClubLockedFiscalYearKey(clubId),
      String(fiscalYear)
    )
  } catch {
    // ignore
  }
}

export type SettlementPeriodLockInfo = {
  kind: SettlementLockPeriodKind
  startDate: string | null
  endDate: string | null
  fiscalYear: number | null
}

export function getSettlementPeriodLockInfo(
  clubId: string
): SettlementPeriodLockInfo {
  if (typeof window === "undefined") {
    return { kind: "NONE", startDate: null, endDate: null, fiscalYear: null }
  }
  try {
    migrateLegacyBooleanLock(clubId)
    const kindRaw = localStorage.getItem(makeClubLockedPeriodKey(clubId))
    const kind: SettlementLockPeriodKind =
      kindRaw === "H1" || kindRaw === "FULL" || kindRaw === "NONE"
        ? kindRaw
        : "NONE"
    if (kind === "NONE") {
      return { kind, startDate: null, endDate: null, fiscalYear: null }
    }
    const startDate = localStorage.getItem(makeClubLockedStartDateKey(clubId))
    const endDate = localStorage.getItem(makeClubLockedEndDateKey(clubId))
    const fyRaw = localStorage.getItem(makeClubLockedFiscalYearKey(clubId))
    const fiscalYear = fyRaw ? Number(fyRaw) : null
    return {
      kind,
      startDate: startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : null,
      endDate: endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : null,
      fiscalYear:
        fiscalYear != null && Number.isFinite(fiscalYear) ? fiscalYear : null,
    }
  } catch {
    return { kind: "NONE", startDate: null, endDate: null, fiscalYear: null }
  }
}

/** 期間ロックを設定（H1 / FULL）または解除（NONE） */
export function setSettlementPeriodLock(
  clubId: string,
  kind: SettlementLockPeriodKind,
  fiscalYear?: number
): void {
  if (typeof window === "undefined") return
  try {
    if (kind === "NONE") {
      localStorage.setItem(makeClubLockedPeriodKey(clubId), "NONE")
      localStorage.removeItem(makeClubLockedStartDateKey(clubId))
      localStorage.removeItem(makeClubLockedEndDateKey(clubId))
      localStorage.removeItem(makeClubLockedFiscalYearKey(clubId))
      writeLegacyBooleanLock(clubId, false)
      dispatchLockChanged()
      return
    }
    const fy =
      fiscalYear ??
      getSettlementPeriodLockInfo(clubId).fiscalYear ??
      parsePortalFiscalYearLabel(DEFAULT_PORTAL_FISCAL_YEAR)
    const range = resolveSettlementLockDateRange(kind, fy)
    localStorage.setItem(makeClubLockedPeriodKey(clubId), kind)
    localStorage.setItem(makeClubLockedStartDateKey(clubId), range.startDate)
    localStorage.setItem(makeClubLockedEndDateKey(clubId), range.endDate)
    localStorage.setItem(makeClubLockedFiscalYearKey(clubId), String(fy))
    writeLegacyBooleanLock(clubId, true)
    dispatchLockChanged()
  } catch {
    // ignore
  }
}

/** 取引日付がロック期間内か（H1 / FULL） */
export function isTransactionDateLocked(
  clubId: string,
  dateStr: string
): boolean {
  const info = getSettlementPeriodLockInfo(clubId)
  if (info.kind === "NONE" || !info.startDate || !info.endDate) return false
  const d = String(dateStr ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
  return d >= info.startDate && d <= info.endDate
}

/** 年度全体ロック（FULL）か。H1 のときは false（下期入力可） */
export function isFullSettlementLock(clubId: string): boolean {
  return getSettlementPeriodLockInfo(clubId).kind === "FULL"
}

/** 何らかの期間ロックが有効か（監査バッジ・提出状態判定用） */
export function readClubSettlementLocked(clubId: string): boolean {
  if (typeof window === "undefined") return false
  try {
    migrateLegacyBooleanLock(clubId)
    const kind = getSettlementPeriodLockInfo(clubId).kind
    if (kind === "H1" || kind === "FULL") return true
    return localStorage.getItem(makeClubSettlementLockKey(clubId)) === "true"
  } catch {
    return false
  }
}

/**
 * 互換 API。
 * locked=false → 期間ロック解除。
 * locked=true → 既存の H1/FULL を維持。未設定時は提出区分から推定して設定。
 */
export function setClubSettlementLocked(
  clubId: string,
  locked: boolean,
): void {
  if (typeof window === "undefined") return
  if (!locked) {
    setSettlementPeriodLock(clubId, "NONE")
    return
  }
  const current = getSettlementPeriodLockInfo(clubId)
  if (current.kind === "H1" || current.kind === "FULL") {
    writeLegacyBooleanLock(clubId, true)
    dispatchLockChanged()
    return
  }
  const submitPeriod = getClubSettlementPeriod(clubId)
  const kind: "H1" | "FULL" = submitPeriod === "mid_term" ? "H1" : "FULL"
  setSettlementPeriodLock(clubId, kind)
}

function formatLockDateJa(iso: string): string {
  return iso.replace(/-/g, "/")
}

/** 画面上部アラート用メッセージ */
export function getSettlementPeriodLockAlertMessage(clubId: string): string {
  const info = getSettlementPeriodLockInfo(clubId)
  const status = getAuditorAuditStatus(clubId)
  if (info.kind === "H1" && info.startDate && info.endDate) {
    const range = `${formatLockDateJa(info.startDate)}〜${formatLockDateJa(info.endDate)}`
    if (status === "awaiting_manager_approval") {
      return `上期（${range}）の決算データは提出済（部内承認待ち）のため、該当期間の登録・編集・削除はできません。下期データは引き続き入力可能です。`
    }
    if (status === "approved") {
      return `上期（${range}）の決算は承認済のため、該当期間の登録・編集・削除はできません。下期データは引き続き入力可能です。`
    }
    if (status === "in_review") {
      return `上期（${range}）の決算データは提出済（監査中）のため、該当期間の登録・編集・削除はできません。下期データは引き続き入力可能です。`
    }
    return `上期（${range}）の決算データは提出済のため、該当期間の登録・編集・削除はできません。下期データは引き続き入力可能です。`
  }
  if (status === "awaiting_manager_approval") {
    return "当年度の決算データは提出済（部内承認待ち）のため、登録、編集、削除はできません。クラブ責任者の部内承認後、監査人の査読へ進みます。"
  }
  if (status === "approved") {
    return "当年度の決算は承認済のため、登録、編集、削除はできません。"
  }
  return "当年度の決算は提出済のため、登録、編集、削除はできません。ロックを解除するには監査人から差戻しをしてもらう必要があります。"
}

export function getSettlementPeriodLockErrorMessage(clubId: string): string {
  const info = getSettlementPeriodLockInfo(clubId)
  if (info.kind === "H1" && info.startDate && info.endDate) {
    return `上期（${formatLockDateJa(info.startDate)}〜${formatLockDateJa(info.endDate)}）は決算提出済のため、該当期間の日付では登録・編集・削除できません。`
  }
  if (info.kind === "FULL") {
    return "当年度の決算は提出済のため、登録・編集・削除はできません。"
  }
  return "決算ロック中のため、この操作はできません。"
}

export function getAuditorAuditStatus(
  clubId: string,
): AuditorAuditStatusValue {
  if (typeof window === "undefined") return "not_started"
  try {
    const raw = localStorage.getItem(makeClubAuditorAuditStatusKey(clubId))
    if (
      raw === "awaiting_manager_approval" ||
      raw === "in_review" ||
      raw === "approved" ||
      raw === "rejected" ||
      raw === "not_started"
    ) {
      return raw
    }
    // 旧データ: ロック中かつステータス未設定は監査中扱い
    if (readClubSettlementLocked(clubId)) return "in_review"
    return "not_started"
  } catch {
    return "not_started"
  }
}

export function setAuditorAuditStatus(
  clubId: string,
  status: AuditorAuditStatusValue,
): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(makeClubAuditorAuditStatusKey(clubId), status)
    dispatchAuditStatusChanged()
  } catch {
    // ignore
  }
}

/** 監査人が承認・差戻できるか（部内承認後の監査中のみ） */
export function canAuditorActOnSettlement(clubId: string): boolean {
  return (
    readClubSettlementLocked(clubId) &&
    getAuditorAuditStatus(clubId) === "in_review"
  )
}

/** クラブ責任者が部内承認できるか（部内承認待ちかつロック中） */
export function canManagerApproveSettlement(clubId: string): boolean {
  return (
    readClubSettlementLocked(clubId) &&
    getAuditorAuditStatus(clubId) === "awaiting_manager_approval"
  )
}

export function loadSettlementHistoryFlow(clubId: string): SettlementHistoryFlow {
  if (typeof window === "undefined") {
    return { steps: [...DEFAULT_FLOW], currentIndex: 0 }
  }
  try {
    const raw = localStorage.getItem(makeClubSettlementHistoryKey(clubId))
    if (!raw) {
      const currentIndex = readClubSettlementLocked(clubId) ? 1 : 0
      return { steps: [...DEFAULT_FLOW], currentIndex }
    }
    const parsed = JSON.parse(raw) as {
      steps?: SettlementHistoryStep[]
      currentIndex?: number
    }
    const steps = normalizeHistoryStepLabels(
      Array.isArray(parsed.steps) && parsed.steps.length > 0
        ? parsed.steps
        : [...DEFAULT_FLOW]
    )
    const currentIndex =
      typeof parsed.currentIndex === "number"
        ? Math.min(Math.max(0, parsed.currentIndex), steps.length - 1)
        : 0
    return { steps, currentIndex }
  } catch {
    return { steps: [...DEFAULT_FLOW], currentIndex: 0 }
  }
}

export function saveSettlementHistoryFlow(
  clubId: string,
  flow: SettlementHistoryFlow,
): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(
      makeClubSettlementHistoryKey(clubId),
      JSON.stringify(flow),
    )
  } catch {
    // ignore
  }
}

/**
 * 作業者：決算提出（半期／年度末共通）
 * → 期間ロック設定・部内承認待ち・双六を部内承認待ちへ
 * mid_term → H1（上期日付のみロック） / year_end → FULL（年度全体）
 */
export function applyClubSettlementSubmit(
  clubId: string,
  period: ClubSettlementPeriodKind = "year_end",
  fiscalYear?: number
): void {
  setClubSettlementPeriod(clubId, period)
  const flow = loadSettlementHistoryFlow(clubId)
  const steps = normalizeHistoryStepLabels(flow.steps)
  const awaitingIdx = steps.findIndex((s) => s.status === "AWAITING_MANAGER")
  const nextIndex = awaitingIdx >= 0 ? awaitingIdx : Math.min(1, steps.length - 1)
  saveSettlementHistoryFlow(clubId, { steps, currentIndex: nextIndex })
  const fy =
    fiscalYear ?? parsePortalFiscalYearLabel(DEFAULT_PORTAL_FISCAL_YEAR)
  const lockKind: "H1" | "FULL" = period === "mid_term" ? "H1" : "FULL"
  setSettlementPeriodLock(clubId, lockKind, fy)
  setAuditorAuditStatus(clubId, "awaiting_manager_approval")
}

/**
 * クラブ責任者：部内承認
 * → 監査中へ移行・期間ロック継続（監査人の承認・差戻が活性化）
 */
export function applyManagerApproveSettlement(clubId: string): boolean {
  if (!canManagerApproveSettlement(clubId)) return false
  const flow = loadSettlementHistoryFlow(clubId)
  const steps = normalizeHistoryStepLabels(flow.steps)
  const reviewIdx = steps.findIndex((s) => s.status === "IN_REVIEW")
  const nextIndex =
    reviewIdx >= 0 ? reviewIdx : Math.min(2, steps.length - 1)
  saveSettlementHistoryFlow(clubId, { steps, currentIndex: nextIndex })
  // 期間ロック（H1/FULL）は維持したまま監査中へ
  setClubSettlementLocked(clubId, true)
  setAuditorAuditStatus(clubId, "in_review")
  dispatchSettlementChanged()
  return true
}

/** 監査人差戻：ロック解除・差戻しステップを履歴に挿入 */
export function applyAuditorRejectToHistory(clubId: string): void {
  const flow = loadSettlementHistoryFlow(clubId)
  const { steps, currentIndex } = flow
  const current = steps[currentIndex]
  if (
    !current ||
    (current.status !== "IN_REVIEW" &&
      current.status !== "AWAITING_MANAGER" &&
      current.status !== "SUBMITTED")
  ) {
    return
  }

  const base = steps.slice(0, currentIndex + 1)
  const rejectStep: SettlementHistoryStep = {
    id: genStepId(),
    label: "差戻し",
    status: "REJECTED",
  }
  const awaitingStep: SettlementHistoryStep = {
    id: genStepId(),
    label: "部内承認待ち",
    status: "AWAITING_MANAGER",
  }
  const reviewStep: SettlementHistoryStep = {
    id: genStepId(),
    label: "監査中",
    status: "IN_REVIEW",
  }
  const approvedStep: SettlementHistoryStep = {
    id: genStepId(),
    label: "承認済",
    status: "APPROVED",
  }

  const nextSteps = [
    ...base,
    rejectStep,
    awaitingStep,
    reviewStep,
    approvedStep,
  ]

  saveSettlementHistoryFlow(clubId, {
    steps: nextSteps,
    currentIndex: currentIndex + 1,
  })
}

/** 監査人承認：履歴の次の「承認済」へ、または末尾に追加 */
export function applyAuditorApproveToHistory(clubId: string): void {
  const flow = loadSettlementHistoryFlow(clubId)
  const { steps, currentIndex } = flow
  const nextApproved = steps.findIndex(
    (s, i) => i > currentIndex && s.status === "APPROVED"
  )
  if (nextApproved >= 0) {
    saveSettlementHistoryFlow(clubId, { steps, currentIndex: nextApproved })
    return
  }
  const approvedStep: SettlementHistoryStep = {
    id: genStepId(),
    label: "承認済",
    status: "APPROVED",
  }
  saveSettlementHistoryFlow(clubId, {
    steps: [...steps, approvedStep],
    currentIndex: steps.length,
  })
}

/**
 * 監査人：承認（提出ロック中のみ）
 * ロックは維持。監査ステータスは承認済。
 */
export function auditorApproveSettlement(clubId: string): boolean {
  if (!canAuditorActOnSettlement(clubId)) return false
  applyAuditorApproveToHistory(clubId)
  setAuditorAuditStatus(clubId, "approved")
  // 承認後も期間ロックを維持（差戻しまで）
  setClubSettlementLocked(clubId, true)
  const current = getClubSettlementStatus(clubId)
  if (current !== "submitted") {
    setClubSettlementStatus(clubId, "submitted")
  }
  if (!approveClubSettlement(clubId)) {
    setClubSettlementStatus(clubId, "approved")
  }
  dispatchSettlementChanged()
  return true
}

/**
 * 監査人：差戻（提出ロック中のみ）
 * ロック解除・編集可能化・履歴に差戻し追加。
 */
export function auditorRejectSettlement(
  clubId: string,
  reason: string
): boolean {
  if (!canAuditorActOnSettlement(clubId)) return false
  const trimmed = reason.trim()
  if (!trimmed) return false

  applyAuditorRejectToHistory(clubId)
  // 差戻：対象期間（H1/FULL）のロックを解除し再編集可能に
  setSettlementPeriodLock(clubId, "NONE")
  setAuditorAuditStatus(clubId, "rejected")
  const current = getClubSettlementStatus(clubId)
  if (current !== "submitted") {
    setClubSettlementStatus(clubId, "submitted")
  }
  if (!rejectClubSettlement(clubId, trimmed)) {
    setClubSettlementStatus(clubId, "rejected")
  }
  const clubName = getClubById(clubId)?.name ?? clubId
  const currentAuditorId = loadCurrentAuditor()?.id ?? ""
  sendAuditPortalMessage({
    subject: "決算差戻し理由",
    body: trimmed,
    targetClubId: clubId,
    targetClubName: clubName,
    auditorId: currentAuditorId,
  })
  dispatchSettlementChanged()
  return true
}

/** 差戻後の再提出用：部内承認待ちへ（クラブ提出ハンドラから呼ぶ） */
export function onClubResubmitAfterReject(clubId: string): void {
  setAuditorAuditStatus(clubId, "awaiting_manager_approval")
}

export function getAuditorAuditStatusLabel(
  status: AuditorAuditStatusValue,
  isSubmitted: boolean
): string {
  if (status === "approved") return "承認済"
  if (status === "rejected") return "差戻"
  if (status === "awaiting_manager_approval") return "部内承認待ち"
  if (status === "in_review") return "監査中"
  if (isSubmitted) return "部内承認待ち"
  return "未提出"
}

export type AuditorAuditBadgeVariant =
  | "muted"
  | "navy"
  | "amber"
  | "rejected"
  | "approved"

/** 部内承認待ちバッジ */
export const SETTLEMENT_AWAITING_MANAGER_BADGE_CLASSES =
  "border-amber-600/30 bg-amber-500 text-white"

/** 監査進捗バケット「未提出」（双六の「作成中」に対応） */
export const SETTLEMENT_NOT_SUBMITTED_BADGE_CLASSES =
  "border-red-600/30 bg-red-500 text-white"

/** 監査進捗バケット「監査中」（双六の「提出済」＋ロック中に対応） */
export const SETTLEMENT_IN_AUDIT_BADGE_CLASSES =
  "border-green-600/30 bg-green-600 text-white"

/** 差戻 */
export const SETTLEMENT_REJECTED_BADGE_CLASSES =
  "border-amber-200 bg-amber-100 text-amber-800"

/** 監査人ダッシュボード：承認済バッジ（承認ボタンと同色の青） */
export const AUDITOR_APPROVED_BADGE_CLASSES =
  "border-blue-600/30 bg-blue-600 text-white"

/** 監査人ダッシュボード：承認済カード背景（文字・バッジの opacity は下げない） */
export const AUDITOR_APPROVED_CARD_CLASSES = "bg-gray-50"

export function getAuditorAuditStatusBadgeVariant(
  status: AuditorAuditStatusValue,
  isSubmitted: boolean
): AuditorAuditBadgeVariant {
  if (status === "approved") return "approved"
  if (status === "rejected") return "rejected"
  if (status === "awaiting_manager_approval") return "amber"
  if (status === "in_review") return "navy"
  if (isSubmitted) return "amber"
  return "muted"
}

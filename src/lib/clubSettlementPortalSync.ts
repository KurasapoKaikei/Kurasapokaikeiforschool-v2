/**
 * クラブ決算提出ロック・監査ステータス・双六UI履歴の localStorage 正本（デモ）
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

export const CLUB_SETTLEMENT_LOCK_KEY = "is_club_settlement_locked"
export const CLUB_SETTLEMENT_HISTORY_KEY = "club_settlement_history_flow"
export const CLUB_AUDITOR_AUDIT_STATUS_KEY = "club_auditor_audit_status"

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

export function makeClubSettlementHistoryKey(clubId: string): string {
  return `${CLUB_SETTLEMENT_HISTORY_KEY}_${clubId}`
}

export function makeClubAuditorAuditStatusKey(clubId: string): string {
  return `${CLUB_AUDITOR_AUDIT_STATUS_KEY}_${clubId}`
}

export function readClubSettlementLocked(clubId: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(makeClubSettlementLockKey(clubId)) === "true"
  } catch {
    return false
  }
}

export function setClubSettlementLocked(
  clubId: string,
  locked: boolean,
): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(
      makeClubSettlementLockKey(clubId),
      locked ? "true" : "false",
    )
    dispatchLockChanged()
  } catch {
    // ignore
  }
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
 * → 全域ロック ON・部内承認待ち・双六を部内承認待ちへ
 */
export function applyClubSettlementSubmit(
  clubId: string,
  period: ClubSettlementPeriodKind = "year_end"
): void {
  setClubSettlementPeriod(clubId, period)
  const flow = loadSettlementHistoryFlow(clubId)
  const steps = normalizeHistoryStepLabels(flow.steps)
  const awaitingIdx = steps.findIndex((s) => s.status === "AWAITING_MANAGER")
  const nextIndex = awaitingIdx >= 0 ? awaitingIdx : Math.min(1, steps.length - 1)
  saveSettlementHistoryFlow(clubId, { steps, currentIndex: nextIndex })
  setClubSettlementLocked(clubId, true)
  setAuditorAuditStatus(clubId, "awaiting_manager_approval")
}

/**
 * クラブ責任者：部内承認
 * → 監査中へ移行・ロック継続（監査人の承認・差戻が活性化）
 */
export function applyManagerApproveSettlement(clubId: string): boolean {
  if (!canManagerApproveSettlement(clubId)) return false
  const flow = loadSettlementHistoryFlow(clubId)
  const steps = normalizeHistoryStepLabels(flow.steps)
  const reviewIdx = steps.findIndex((s) => s.status === "IN_REVIEW")
  const nextIndex =
    reviewIdx >= 0 ? reviewIdx : Math.min(2, steps.length - 1)
  saveSettlementHistoryFlow(clubId, { steps, currentIndex: nextIndex })
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
  // 承認後も編集ロックを完全維持（差戻しまで true 固定）
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
  setClubSettlementLocked(clubId, false)
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

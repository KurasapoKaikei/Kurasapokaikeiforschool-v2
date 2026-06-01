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
  | "in_review"
  | "approved"
  | "rejected"

export type HistoryStatus = "PREPARING" | "SUBMITTED" | "REJECTED" | "APPROVED"

export type SettlementHistoryStep = {
  id: string
  label: string
  status: HistoryStatus
}

export type SettlementHistoryFlow = {
  steps: SettlementHistoryStep[]
  currentIndex: number
}

const DEFAULT_FLOW: SettlementHistoryStep[] = [
  { id: "1", label: "未提出", status: "PREPARING" },
  { id: "2", label: "監査中", status: "SUBMITTED" },
  { id: "3", label: "承認済", status: "APPROVED" },
]

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
      raw === "in_review" ||
      raw === "approved" ||
      raw === "rejected" ||
      raw === "not_started"
    ) {
      return raw
    }
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

/** 監査人が承認・差戻できるか（提出ロック中かつ監査中） */
export function canAuditorActOnSettlement(clubId: string): boolean {
  return (
    readClubSettlementLocked(clubId) &&
    getAuditorAuditStatus(clubId) === "in_review"
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
    const steps =
      Array.isArray(parsed.steps) && parsed.steps.length > 0
        ? parsed.steps
        : [...DEFAULT_FLOW]
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

/** クラブ提出時：ロック＋監査中＋履歴を提出済へ */
export function applyClubSettlementSubmit(clubId: string): void {
  const flow = loadSettlementHistoryFlow(clubId)
  let nextIndex = flow.currentIndex + 1
  if (nextIndex > flow.steps.length - 1) nextIndex = flow.steps.length - 1
  saveSettlementHistoryFlow(clubId, { steps: flow.steps, currentIndex: nextIndex })
  setClubSettlementLocked(clubId, true)
  setAuditorAuditStatus(clubId, "in_review")
}

/** 監査人差戻：ロック解除・差戻しステップを履歴末尾付近に追加 */
export function applyAuditorRejectToHistory(clubId: string): void {
  const flow = loadSettlementHistoryFlow(clubId)
  const { steps, currentIndex } = flow
  const current = steps[currentIndex]
  if (!current || current.status !== "SUBMITTED") return

  const tail = steps.slice(currentIndex + 1)
  const hasApprovedTail = tail.some((s) => s.status === "APPROVED")
  const base = steps.slice(0, currentIndex + 1)
  const rejectStep: SettlementHistoryStep = {
    id: genStepId(),
    label: "差戻し",
    status: "REJECTED",
  }
  const resubmitStep: SettlementHistoryStep = {
    id: genStepId(),
    label: "監査中",
    status: "SUBMITTED",
  }
  const approvedStep: SettlementHistoryStep = {
    id: genStepId(),
    label: "承認済",
    status: "APPROVED",
  }

  let nextSteps: SettlementHistoryStep[]
  if (hasApprovedTail) {
    nextSteps = [...base, rejectStep, resubmitStep, approvedStep]
  } else {
    nextSteps = [...base, rejectStep, resubmitStep, approvedStep]
  }

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

/** 差戻後の再提出用：監査中へ戻す（クラブ提出ハンドラから呼ぶ） */
export function onClubResubmitAfterReject(clubId: string): void {
  setAuditorAuditStatus(clubId, "in_review")
}

export function getAuditorAuditStatusLabel(
  status: AuditorAuditStatusValue,
  isSubmitted: boolean
): string {
  if (status === "approved") return "承認済"
  if (status === "rejected") return "差戻"
  if (status === "in_review" || isSubmitted) return "監査中"
  return "未提出"
}

export type AuditorAuditBadgeVariant = "muted" | "navy" | "rejected" | "approved"

/** 未提出（旧作成中） */
export const SETTLEMENT_NOT_SUBMITTED_BADGE_CLASSES =
  "border-red-600/30 bg-red-500 text-white"

/** 監査中（旧提出済） */
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
  if (status === "in_review" || isSubmitted) return "navy"
  return "muted"
}

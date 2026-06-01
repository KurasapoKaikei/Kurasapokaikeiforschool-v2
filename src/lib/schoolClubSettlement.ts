/** 学校ポータル：クラブ決算提出ステータス（5/27デモ・localStorage） */

import { loadSchoolClubs } from "@/lib/schoolClubs"
import {
  getOperationalSchoolId,
  readScopedWorkspace,
  writeScopedWorkspace,
} from "@/lib/schoolWorkspace"

export type ClubSettlementStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"

const STATUS_STORAGE_KEY = "kurasaokaikei-school-club-settlement-status"
const REJECT_REASON_KEY = "kurasaokaikei-school-club-settlement-reject-reason"
const ROLLOVER_STORAGE_KEY = "kurasaokaikei-school-fiscal-rollover-2026"

export const SETTLEMENT_CHANGED_EVENT = "kurasaokaikei-school-settlement-changed"

export const CLUB_SETTLEMENT_STATUS_META: Record<
  ClubSettlementStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "未提出",
    className: "border-red-600/30 bg-red-500 text-white",
  },
  submitted: {
    label: "監査中",
    className: "border-green-600/30 bg-green-600 text-white",
  },
  approved: {
    label: "承認済",
    className: "border-blue-600/30 bg-blue-600 text-white",
  },
  rejected: {
    label: "差戻し",
    className: "border-amber-200 bg-amber-100 text-amber-800",
  },
}

function dispatchChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SETTLEMENT_CHANGED_EVENT))
}

function normalizeStatus(raw: string): ClubSettlementStatus {
  if (raw === "auditing") return "submitted"
  if (
    raw === "draft" ||
    raw === "submitted" ||
    raw === "approved" ||
    raw === "rejected"
  ) {
    return raw
  }
  return "draft"
}

function parseStatusMap(parsed: unknown): Record<string, ClubSettlementStatus> {
  if (!parsed || typeof parsed !== "object") return {}
  const out: Record<string, ClubSettlementStatus> = {}
  for (const [id, status] of Object.entries(parsed as Record<string, string>)) {
    out[id] = normalizeStatus(status)
  }
  return out
}

function loadAllFromGlobal(): Record<string, ClubSettlementStatus> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STATUS_STORAGE_KEY)
    if (!raw) return {}
    return parseStatusMap(JSON.parse(raw) as unknown)
  } catch {
    return {}
  }
}

function loadAll(): Record<string, ClubSettlementStatus> {
  const schoolId = getOperationalSchoolId()
  return readScopedWorkspace(
    schoolId,
    (ws) => ({ ...ws.settlementStatus }),
    loadAllFromGlobal
  )
}

function saveAllToGlobal(map: Record<string, ClubSettlementStatus>): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(map))
  dispatchChanged()
}

function saveAll(map: Record<string, ClubSettlementStatus>): void {
  const schoolId = getOperationalSchoolId()
  writeScopedWorkspace(
    schoolId,
    (ws) => ({ ...ws, settlementStatus: map }),
    () => saveAllToGlobal(map)
  )
}

function loadRejectReasonsFromGlobal(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(REJECT_REASON_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}

function loadRejectReasons(): Record<string, string> {
  const schoolId = getOperationalSchoolId()
  return readScopedWorkspace(
    schoolId,
    (ws) => ({ ...ws.settlementRejectReasons }),
    loadRejectReasonsFromGlobal
  )
}

function saveRejectReasonsToGlobal(map: Record<string, string>): void {
  if (typeof window === "undefined") return
  localStorage.setItem(REJECT_REASON_KEY, JSON.stringify(map))
  dispatchChanged()
}

function saveRejectReasons(map: Record<string, string>): void {
  const schoolId = getOperationalSchoolId()
  writeScopedWorkspace(
    schoolId,
    (ws) => ({ ...ws, settlementRejectReasons: map }),
    () => saveRejectReasonsToGlobal(map)
  )
}

function mockStatusForClubId(clubId: string): ClubSettlementStatus {
  const options: ClubSettlementStatus[] = [
    "draft",
    "submitted",
    "approved",
  ]
  const sum = clubId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return options[sum % options.length]!
}

function isSchoolRegisteredClubId(clubId: string): boolean {
  return loadSchoolClubs().some((c) => c.id === clubId)
}

export function ensureClubSettlementStatuses(
  clubIds: string[]
): Record<string, ClubSettlementStatus> {
  const current = loadAll()
  let changed = false
  for (const id of clubIds) {
    if (!current[id]) {
      current[id] = isSchoolRegisteredClubId(id) ? "draft" : mockStatusForClubId(id)
      changed = true
    } else {
      const normalized = normalizeStatus(current[id]!)
      if (normalized !== current[id]) {
        current[id] = normalized
        changed = true
      }
    }
  }
  if (changed) saveAll(current)
  return current
}

export function getClubSettlementStatus(clubId: string): ClubSettlementStatus {
  const map = loadAll()
  if (map[clubId]) return map[clubId]!
  if (isSchoolRegisteredClubId(clubId)) return "draft"
  return mockStatusForClubId(clubId)
}

export function setClubSettlementStatus(
  clubId: string,
  status: ClubSettlementStatus
): void {
  const map = loadAll()
  map[clubId] = status
  saveAll(map)
  if (status !== "rejected") {
    const reasons = loadRejectReasons()
    if (reasons[clubId]) {
      delete reasons[clubId]
      saveRejectReasons(reasons)
    }
  }
}

export function getSettlementRejectReason(clubId: string): string | null {
  return loadRejectReasons()[clubId] ?? null
}

/** クラブ：未提出・差戻しのみ提出可能 */
export function submitClubSettlement(clubId: string): boolean {
  const current = getClubSettlementStatus(clubId)
  if (current !== "draft" && current !== "rejected") return false
  setClubSettlementStatus(clubId, "submitted")
  return true
}

export function approveClubSettlement(clubId: string): boolean {
  if (getClubSettlementStatus(clubId) !== "submitted") return false
  setClubSettlementStatus(clubId, "approved")
  return true
}

export function rejectClubSettlement(clubId: string, reason: string): boolean {
  if (getClubSettlementStatus(clubId) !== "submitted") return false
  const trimmed = reason.trim()
  if (!trimmed) return false
  setClubSettlementStatus(clubId, "rejected")
  const reasons = loadRejectReasons()
  reasons[clubId] = trimmed
  saveRejectReasons(reasons)
  return true
}

export function canSubmitSettlement(clubId: string): boolean {
  const s = getClubSettlementStatus(clubId)
  return s === "draft" || s === "rejected"
}

export type FiscalRolloverCheck = {
  canExecute: boolean
  reason: string
  pendingCount: number
  totalClubs: number
}

export function checkFiscalRollover(clubIds: string[]): FiscalRolloverCheck {
  if (clubIds.length === 0) {
    return {
      canExecute: false,
      reason: "登録クラブがありません。クラブ登録後に実行できます。",
      pendingCount: 0,
      totalClubs: 0,
    }
  }
  ensureClubSettlementStatuses(clubIds)
  const pending = clubIds.filter((id) => getClubSettlementStatus(id) !== "approved")
  if (pending.length > 0) {
    return {
      canExecute: false,
      reason: `未承認のクラブが ${pending.length} 件あります。すべて「承認済」になるまで年度繰越はできません。`,
      pendingCount: pending.length,
      totalClubs: clubIds.length,
    }
  }
  return {
    canExecute: true,
    reason: "",
    pendingCount: 0,
    totalClubs: clubIds.length,
  }
}

function isFiscalRolloverCompletedGlobal(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(ROLLOVER_STORAGE_KEY) === "done"
}

export function isFiscalRolloverCompleted(): boolean {
  const schoolId = getOperationalSchoolId()
  return readScopedWorkspace(
    schoolId,
    (ws) => ws.fiscalRolloverDone === true,
    isFiscalRolloverCompletedGlobal
  )
}

export function executeFiscalRollover(clubIds: string[]): boolean {
  const check = checkFiscalRollover(clubIds)
  if (!check.canExecute) return false
  if (typeof window === "undefined") return false
  const schoolId = getOperationalSchoolId()
  writeScopedWorkspace(
    schoolId,
    (ws) => ({ ...ws, fiscalRolloverDone: true }),
    () => {
      localStorage.setItem(ROLLOVER_STORAGE_KEY, "done")
      dispatchChanged()
    }
  )
  return true
}

export function resetFiscalRolloverDemo(): void {
  if (typeof window === "undefined") return
  const schoolId = getOperationalSchoolId()
  writeScopedWorkspace(
    schoolId,
    (ws) => ({ ...ws, fiscalRolloverDone: false }),
    () => {
      localStorage.removeItem(ROLLOVER_STORAGE_KEY)
      dispatchChanged()
    }
  )
}

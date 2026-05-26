/**
 * 学校ごとの運用データ（クラブ・監査人・メッセージ等）
 * - デモ校（SCH-79268）: 従来のグローバル localStorage キーをそのまま利用
 * - 新規登録校: ワークスペースに空データを生成し、デモデータと分離
 */

import { loadCurrentSchool } from "@/lib/currentSchool"
import { DEMO_SCHOOL_MASTER_ID } from "@/lib/schoolMasters"
import type { SchoolClub } from "@/lib/schoolClubs"
import type { SchoolClubGroup } from "@/lib/schoolClubGroups"
import type { SchoolAuditor } from "@/lib/schoolAuditors"
import type { PortalMessage } from "@/lib/portalMessages"
import type { SchoolMessageDraft } from "@/lib/portalDraftMessages"
import type { ClubSettlementStatus } from "@/lib/schoolClubSettlement"

export const SCHOOL_WORKSPACES_STORAGE_KEY = "kurasaokaikei-school-workspaces"

export const SCHOOL_WORKSPACE_CHANGED_EVENT =
  "kurasaokaikei-school-workspace-changed"

export type SchoolWorkspaceData = {
  clubs: SchoolClub[]
  clubGroups: SchoolClubGroup[]
  auditors: SchoolAuditor[]
  portalMessages: PortalMessage[]
  draftMessages: SchoolMessageDraft[]
  settlementStatus: Record<string, ClubSettlementStatus>
  settlementRejectReasons: Record<string, string>
  fiscalRolloverDone: boolean
}

export function createEmptySchoolWorkspace(): SchoolWorkspaceData {
  return {
    clubs: [],
    clubGroups: [],
    auditors: [],
    portalMessages: [],
    draftMessages: [],
    settlementStatus: {},
    settlementRejectReasons: {},
    fiscalRolloverDone: false,
  }
}

function dispatchWorkspaceChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SCHOOL_WORKSPACE_CHANGED_EVENT))
}

export function isDemoSchoolId(schoolId: string | null | undefined): boolean {
  return schoolId?.trim() === DEMO_SCHOOL_MASTER_ID
}

/** ログイン中学校 ID（未ログイン時は null） */
export function getOperationalSchoolId(): string | null {
  const school = loadCurrentSchool()
  const id = school?.schoolId?.trim()
  return id || null
}

export function usesLegacyGlobalSchoolStorage(
  schoolId?: string | null
): boolean {
  const id = schoolId ?? getOperationalSchoolId()
  return isDemoSchoolId(id)
}

function loadAllWorkspaces(): Record<string, SchoolWorkspaceData> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(SCHOOL_WORKSPACES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, SchoolWorkspaceData>
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function saveAllWorkspaces(map: Record<string, SchoolWorkspaceData>): void {
  if (typeof window === "undefined") return
  localStorage.setItem(SCHOOL_WORKSPACES_STORAGE_KEY, JSON.stringify(map))
  dispatchWorkspaceChanged()
}

export function getSchoolWorkspace(schoolId: string): SchoolWorkspaceData | null {
  const id = schoolId.trim()
  if (!id) return null
  return loadAllWorkspaces()[id] ?? null
}

export function saveSchoolWorkspace(
  schoolId: string,
  data: SchoolWorkspaceData
): void {
  const id = schoolId.trim()
  if (!id) return
  const all = loadAllWorkspaces()
  all[id] = data
  saveAllWorkspaces(all)
}

/** 新規本登録時：空のワークスペースを作成（既存は上書きしない） */
export function initializeCleanSchoolWorkspace(schoolId: string): void {
  if (typeof window === "undefined") return
  const id = schoolId.trim()
  if (!id || isDemoSchoolId(id)) return
  const all = loadAllWorkspaces()
  if (all[id]) return
  all[id] = createEmptySchoolWorkspace()
  saveAllWorkspaces(all)
}

export function readScopedWorkspace<T>(
  schoolId: string | null,
  pick: (ws: SchoolWorkspaceData) => T,
  legacyRead: () => T
): T {
  if (!schoolId || usesLegacyGlobalSchoolStorage(schoolId)) {
    return legacyRead()
  }
  const ws = getSchoolWorkspace(schoolId)
  if (!ws) return pick(createEmptySchoolWorkspace())
  return pick(ws)
}

export function writeScopedWorkspace(
  schoolId: string | null,
  updater: (ws: SchoolWorkspaceData) => SchoolWorkspaceData,
  legacyWrite: () => void
): void {
  if (!schoolId || usesLegacyGlobalSchoolStorage(schoolId)) {
    legacyWrite()
    return
  }
  const current = getSchoolWorkspace(schoolId) ?? createEmptySchoolWorkspace()
  saveSchoolWorkspace(schoolId, updater(current))
}

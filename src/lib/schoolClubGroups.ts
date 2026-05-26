/** 学校ポータル：クラブ所属グループ（グループ作成画面で管理） */

import {
  getOperationalSchoolId,
  readScopedWorkspace,
  writeScopedWorkspace,
} from "@/lib/schoolWorkspace"

export type SchoolClubGroup = {
  id: string
  name: string
  order: number
}

const STORAGE_KEY = "kurasaokaikei-school-club-groups"

function normalizeOrders(groups: SchoolClubGroup[]): SchoolClubGroup[] {
  return [...groups]
    .sort((a, b) => a.order - b.order)
    .map((g, idx) => ({ ...g, order: idx + 1 }))
}

function parseGroups(parsed: unknown): SchoolClubGroup[] {
  if (!Array.isArray(parsed)) return []
  return normalizeOrders(
    parsed.filter(
      (g) =>
        g &&
        typeof g.id === "string" &&
        typeof g.name === "string" &&
        typeof g.order === "number"
    )
  )
}

function loadGroupsFromGlobal(): SchoolClubGroup[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return parseGroups(JSON.parse(raw) as unknown)
  } catch {
    return []
  }
}

function saveGroupsToGlobal(groups: SchoolClubGroup[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeOrders(groups)))
}

export function loadSchoolClubGroups(): SchoolClubGroup[] {
  const schoolId = getOperationalSchoolId()
  return readScopedWorkspace(
    schoolId,
    (ws) => parseGroups(ws.clubGroups),
    loadGroupsFromGlobal
  )
}

export function saveSchoolClubGroups(groups: SchoolClubGroup[]): void {
  const schoolId = getOperationalSchoolId()
  const normalized = normalizeOrders(groups)
  writeScopedWorkspace(
    schoolId,
    (ws) => ({ ...ws, clubGroups: normalized }),
    () => saveGroupsToGlobal(normalized)
  )
}

export function isDuplicateGroupName(
  name: string,
  groups: SchoolClubGroup[],
  excludeId?: string
): boolean {
  const trimmed = name.trim()
  return groups.some(
    (g) => g.id !== excludeId && g.name.trim() === trimmed
  )
}

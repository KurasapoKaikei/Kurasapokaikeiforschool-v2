/** 学校ポータル：クラブ所属グループ（グループ作成画面で管理） */

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

export function loadSchoolClubGroups(): SchoolClubGroup[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SchoolClubGroup[]
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
  } catch {
    return []
  }
}

export function saveSchoolClubGroups(groups: SchoolClubGroup[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeOrders(groups)))
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

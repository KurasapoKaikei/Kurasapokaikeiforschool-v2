/** 学校マスタ（プラン・監査フロー等）— localStorage 正本 */

import { loadCurrentSchool } from "@/lib/currentSchool"

export const SCHOOL_MASTERS_STORAGE_KEY = "kurasaokaikei-school-masters"

export const SCHOOL_MASTER_CHANGED_EVENT = "kurasaokaikei-school-master-changed"

/** デモ正本：クラサポ大学 */
export const DEMO_SCHOOL_MASTER_ID = "SCH-79268"

export type SchoolMasterRecord = {
  schoolId: string
  schoolName: string
  /** 監査フロー（監査人管理・監査メッセージ等）を利用するか */
  useAuditFlow: boolean
}

const SEED_MASTERS: SchoolMasterRecord[] = [
  {
    schoolId: DEMO_SCHOOL_MASTER_ID,
    schoolName: "クラサポ大学",
    useAuditFlow: true,
  },
]

function dispatchChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SCHOOL_MASTER_CHANGED_EVENT))
}

function loadAllMasters(): SchoolMasterRecord[] {
  if (typeof window === "undefined") return [...SEED_MASTERS]
  try {
    const raw = localStorage.getItem(SCHOOL_MASTERS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeMaster)
      .filter((m): m is SchoolMasterRecord => m != null)
  } catch {
    return []
  }
}

function normalizeMaster(raw: unknown): SchoolMasterRecord | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Partial<SchoolMasterRecord>
  const schoolId = typeof item.schoolId === "string" ? item.schoolId.trim() : ""
  const schoolName =
    typeof item.schoolName === "string" ? item.schoolName.trim() : ""
  if (!schoolId || !schoolName) return null
  return {
    schoolId,
    schoolName,
    useAuditFlow: item.useAuditFlow === true,
  }
}

function saveAllMasters(masters: SchoolMasterRecord[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(SCHOOL_MASTERS_STORAGE_KEY, JSON.stringify(masters))
    dispatchChanged()
  } catch {
    /* ignore */
  }
}

/** 初回起動時にシードデータをマージ（既存は上書きしない） */
export function ensureSchoolMastersSeeded(): void {
  if (typeof window === "undefined") return
  try {
    const existing = loadAllMasters()
    const byId = new Map(existing.map((m) => [m.schoolId, m]))
    let changed = false
    for (const seed of SEED_MASTERS) {
      if (!byId.has(seed.schoolId)) {
        byId.set(seed.schoolId, seed)
        changed = true
      }
    }
    if (existing.length === 0 || changed) {
      saveAllMasters(Array.from(byId.values()))
    }
  } catch {
    /* ignore */
  }
}

export function getSchoolMaster(schoolId: string): SchoolMasterRecord | null {
  ensureSchoolMastersSeeded()
  const id = schoolId.trim()
  if (!id) return null
  return loadAllMasters().find((m) => m.schoolId === id) ?? null
}

export function loadSchoolUseAuditFlowForSchool(
  schoolId: string | null | undefined
): boolean {
  ensureSchoolMastersSeeded()
  const id = schoolId?.trim()
  if (!id) return true
  const master = getSchoolMaster(id)
  return master?.useAuditFlow ?? false
}

/** ログイン中の学校アカウントに紐づく監査フロー可否 */
export function loadCurrentSchoolUseAuditFlow(): boolean {
  const school = loadCurrentSchool()
  const schoolId =
    school?.schoolId?.trim() ||
    school?.contract?.schoolId?.trim() ||
    DEMO_SCHOOL_MASTER_ID
  return loadSchoolUseAuditFlowForSchool(schoolId)
}

/** 本登録時など：学校マスタを追加・更新 */
export function upsertSchoolMaster(record: SchoolMasterRecord): void {
  if (typeof window === "undefined") return
  ensureSchoolMastersSeeded()
  const masters = loadAllMasters()
  const idx = masters.findIndex((m) => m.schoolId === record.schoolId)
  const normalized: SchoolMasterRecord = {
    schoolId: record.schoolId.trim(),
    schoolName: record.schoolName.trim(),
    useAuditFlow: record.useAuditFlow === true,
  }
  if (idx >= 0) {
    masters[idx] = normalized
  } else {
    masters.push(normalized)
  }
  saveAllMasters(masters)
}

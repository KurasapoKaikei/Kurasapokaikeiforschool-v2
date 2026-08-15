/** 監査人ログインセッション（localStorage） */

import { DEMO_SCHOOL_MASTER_ID } from "@/lib/schoolMasters"
import {
  getSchoolAuditorById,
  formatAuditorDisplayName,
  loadSchoolAuditors,
  type SchoolAuditor,
} from "@/lib/schoolAuditors"
import {
  findSchoolIdForAuditorId,
  getOperationalSchoolId,
} from "@/lib/schoolWorkspace"

export const CURRENT_AUDITOR_KEY = "kurasaokaikei-current-auditor"

export const AUDITOR_SESSION_CHANGED_EVENT =
  "kurasaokaikei-auditor-session-changed"

export type CurrentAuditorSession = {
  id: string
  name: string
  department: string
  email: string
  assignedClubIds: string[]
  schoolId: string
  /** 学校管理者が監査人として操作している場合 */
  simulatedBySchool?: boolean
}

function dispatchChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(AUDITOR_SESSION_CHANGED_EVENT))
}

export function loadCurrentAuditor(): CurrentAuditorSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CURRENT_AUDITOR_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CurrentAuditorSession
    if (!parsed?.id || !parsed?.name) return null
    return {
      ...parsed,
      department:
        typeof parsed.department === "string" ? parsed.department.trim() : "",
      assignedClubIds: Array.isArray(parsed.assignedClubIds)
        ? parsed.assignedClubIds
        : [],
      schoolId: parsed.schoolId?.trim() || DEMO_SCHOOL_MASTER_ID,
    }
  } catch {
    return null
  }
}

export function establishAuditorSession(
  auditor: SchoolAuditor,
  options?: { simulatedBySchool?: boolean }
): void {
  if (typeof window === "undefined") return
  const schoolId =
    getOperationalSchoolId() ||
    findSchoolIdForAuditorId(auditor.id) ||
    DEMO_SCHOOL_MASTER_ID
  const session: CurrentAuditorSession = {
    id: auditor.id,
    name: formatAuditorDisplayName(auditor),
    department: (auditor.department ?? "").trim(),
    email: auditor.email ?? "",
    assignedClubIds: [...(auditor.assignedClubIds ?? [])],
    schoolId,
    simulatedBySchool: options?.simulatedBySchool === true,
  }
  localStorage.setItem(CURRENT_AUDITOR_KEY, JSON.stringify(session))
  dispatchChanged()
}

export function clearCurrentAuditor(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(CURRENT_AUDITOR_KEY)
  dispatchChanged()
}

/** メール＋初期パスワードで監査人を照合 */
export function authenticateAuditor(
  email: string,
  password: string
): SchoolAuditor | null {
  const normalizedEmail = email.trim().toLowerCase()
  const pw = password
  if (!normalizedEmail || !pw) return null
  const auditor = loadSchoolAuditors().find(
    (a) => a.email.trim().toLowerCase() === normalizedEmail
  )
  if (!auditor || auditor.initialPassword !== pw) return null
  return auditor
}

/** 監査人ID（AUD-XXXX）＋初期パスワードで照合 */
export function authenticateAuditorById(
  auditorId: string,
  password: string
): SchoolAuditor | null {
  const id = auditorId.trim().toUpperCase()
  const pw = password
  if (!id || !pw || !/^AUD-\d+$/.test(id)) return null
  const auditor = loadSchoolAuditors().find(
    (a) => a.id.trim().toUpperCase() === id
  )
  if (!auditor || auditor.initialPassword !== pw) return null
  return auditor
}

export function establishAuditorLogin(email: string, password: string): boolean {
  const auditor = authenticateAuditor(email, password)
  if (!auditor) return false
  establishAuditorSession(auditor)
  return true
}

/** 学校ログイン画面から：AUD-ID で監査人ポータルへ */
export function establishAuditorLoginById(
  auditorId: string,
  password: string
): boolean {
  const auditor = authenticateAuditorById(auditorId, password)
  if (!auditor) return false
  establishAuditorSession(auditor)
  return true
}

export function establishAuditorSessionById(
  auditorId: string,
  options?: { simulatedBySchool?: boolean }
): boolean {
  const auditor = getSchoolAuditorById(auditorId)
  if (!auditor) return false
  establishAuditorSession(auditor, options)
  return true
}

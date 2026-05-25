/**
 * ログイン中の学校ポータル表示用（localStorage: current_school_user）
 * @deprecated 表示用は current_school を優先。書き込みは persistCurrentSchool を使用。
 */

import { loadCurrentSchool, persistCurrentSchool } from "@/lib/currentSchool"

export const CURRENT_SCHOOL_USER_KEY = "current_school_user"

export type CurrentSchoolUser = {
  loginId: string
  schoolId: string
  schoolName: string
  fiscalPeriod: string
}

export function loadCurrentSchoolUser(): CurrentSchoolUser | null {
  const school = loadCurrentSchool()
  if (school) {
    return {
      loginId: school.loginId,
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      fiscalPeriod: school.fiscalPeriod,
    }
  }
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CURRENT_SCHOOL_USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CurrentSchoolUser
    if (parsed?.schoolName && parsed?.loginId) return parsed
    return null
  } catch {
    return null
  }
}

/** @deprecated persistCurrentSchool を使用 */
export function syncCurrentSchoolUser(loginId: string): void {
  persistCurrentSchool(loginId)
}

export function clearCurrentSchoolUser(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(CURRENT_SCHOOL_USER_KEY)
}

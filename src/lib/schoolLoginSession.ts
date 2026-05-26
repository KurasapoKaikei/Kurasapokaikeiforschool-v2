/** 学校管理者ログイン（デモ用） */

import { clearCurrentAuditor } from "@/lib/currentAuditor"
import { clearCurrentSchool, persistCurrentSchool } from "@/lib/currentSchool"
import { getActiveRegistrationByCredentials } from "@/lib/schoolRegistration"

const STORAGE_KEY = "kurasaokaikei-school-admin-session"

export type SchoolAdminSession = {
  loginId: string
  loggedInAt: string
}

/** admin/admin、空欄、または本登録済み学校ID＋管理者パスワードで成功 */
export function authenticateSchool(loginId: string, password: string): boolean {
  const id = loginId.trim()
  const pw = password
  if (!id && !pw.trim()) return true
  if (id === "admin" && pw === "admin") return true
  if (getActiveRegistrationByCredentials(id, pw)) return true
  return false
}

export function establishSchoolLogin(loginId: string): void {
  if (typeof window === "undefined") return
  clearCurrentAuditor()
  const session: SchoolAdminSession = {
    loginId: loginId.trim() || "admin",
    loggedInAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  persistCurrentSchool(loginId)
}

export function getSchoolAdminSession(): SchoolAdminSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SchoolAdminSession
    return parsed?.loggedInAt ? parsed : null
  } catch {
    return null
  }
}

export function clearSchoolAdminSession(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
  clearCurrentSchool()
}

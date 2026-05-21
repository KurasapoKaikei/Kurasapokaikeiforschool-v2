/** 学校管理者ログイン（デモ用） */

const STORAGE_KEY = "kurasaokaikei-school-admin-session"

export type SchoolAdminSession = {
  loginId: string
  loggedInAt: string
}

/** admin/admin、または ID・PW とも空欄で成功 */
export function authenticateSchool(loginId: string, password: string): boolean {
  const id = loginId.trim()
  const pw = password.trim()
  if (!id && !pw) return true
  return id === "admin" && pw === "admin"
}

export function establishSchoolLogin(loginId: string): void {
  if (typeof window === "undefined") return
  const session: SchoolAdminSession = {
    loginId: loginId.trim() || "admin",
    loggedInAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
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
}

/** クラブログインセッション（トップページ認証後） */

import { notifyClubPortalSessionChanged } from "@/lib/clubPortalSessionEvents"
import { clearCurrentWorkers } from "@/lib/currentWorkersSession"
import { loadSchoolClubs } from "@/lib/schoolClubs"
import { clearImpersonatedClub } from "@/lib/schoolClubSession"

export type CurrentClubSession = {
  id: string
  name: string
  groupNames: string[]
}

const STORAGE_KEY = "kurasaokaikei-current-club"

export function setCurrentClub(club: CurrentClubSession): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(club))
}

export function getCurrentClub(): CurrentClubSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CurrentClubSession
    if (parsed?.id && parsed?.name) {
      return {
        id: parsed.id,
        name: parsed.name,
        groupNames: Array.isArray(parsed.groupNames) ? parsed.groupNames : [],
      }
    }
    return null
  } catch {
    return null
  }
}

export function clearCurrentClub(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
  notifyClubPortalSessionChanged()
}

/** クラブID・パスワードを照合し、成功時はセッション情報を返す */
export function authenticateClub(
  clubId: string,
  password: string
): CurrentClubSession | null {
  const trimmedId = clubId.trim()
  const trimmedPassword = password
  if (!trimmedId || !trimmedPassword) return null

  const club = loadSchoolClubs().find((c) => c.id === trimmedId)
  if (!club || club.password !== trimmedPassword) return null

  return {
    id: club.id,
    name: club.name,
    groupNames: club.groupNames,
  }
}

/** ログイン成功時：管理者なりすましを解除し、クラブセッションを保存 */
export function establishClubLogin(session: CurrentClubSession): void {
  clearImpersonatedClub()
  clearCurrentWorkers(session.id)
  setCurrentClub(session)
  notifyClubPortalSessionChanged()
}

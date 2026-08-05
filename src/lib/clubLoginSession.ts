/** クラブログインセッション（トップページ認証後） */

import { notifyClubPortalSessionChanged } from "@/lib/clubPortalSessionEvents"
import { clearCurrentWorkers } from "@/lib/currentWorkersSession"
import { loadSchoolClubs, verifyClubLoginPassword } from "@/lib/schoolClubs"
import { clearImpersonatedClub } from "@/lib/schoolClubSession"

/** 作業者＝入力編集 / 責任者＝閲覧＋部内承認 */
export type ClubLoginRole = "worker" | "manager"

export type CurrentClubSession = {
  id: string
  name: string
  groupNames: string[]
  /** ログイン権限（未設定の旧セッションは worker 扱い） */
  role: ClubLoginRole
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
    const parsed = JSON.parse(raw) as Partial<CurrentClubSession>
    if (parsed?.id && parsed?.name) {
      const role: ClubLoginRole =
        parsed.role === "manager" ? "manager" : "worker"
      return {
        id: parsed.id,
        name: parsed.name,
        groupNames: Array.isArray(parsed.groupNames) ? parsed.groupNames : [],
        role,
      }
    }
    return null
  } catch {
    return null
  }
}

export function getClubLoginRole(): ClubLoginRole | null {
  return getCurrentClub()?.role ?? null
}

export function clearCurrentClub(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
  notifyClubPortalSessionChanged()
}

/**
 * クラブID・パスワードを照合。
 * 作業者PW → role worker / 責任者PW → role manager
 */
export function authenticateClub(
  clubId: string,
  password: string
): CurrentClubSession | null {
  const trimmedId = clubId.trim()
  const trimmedPassword = password
  if (!trimmedId || !trimmedPassword) return null

  const role = verifyClubLoginPassword(trimmedId, trimmedPassword)
  if (!role) return null

  const club = loadSchoolClubs().find((c) => c.id === trimmedId)
  if (!club) return null

  return {
    id: club.id,
    name: club.name,
    groupNames: club.groupNames,
    role,
  }
}

/** ログイン成功時：管理者なりすましを解除し、クラブセッションを保存 */
export function establishClubLogin(session: CurrentClubSession): void {
  clearImpersonatedClub()
  clearCurrentWorkers(session.id)
  setCurrentClub(session)
  notifyClubPortalSessionChanged()
}

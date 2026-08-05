/** 現在操作中のクラブ（なりすまし > クラブログイン） */

import { getCurrentClub, type CurrentClubSession } from "@/lib/clubLoginSession"
import { getImpersonatedClub } from "@/lib/schoolClubSession"

export type ActiveClubSession = CurrentClubSession
const LAST_ACTIVE_CLUB_KEY = "kurasaokaikei-last-active-club-session"

function writeLastActiveClub(session: ActiveClubSession): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(LAST_ACTIVE_CLUB_KEY, JSON.stringify(session))
  } catch {
    // ignore
  }
}

function readLastActiveClub(): ActiveClubSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_CLUB_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ActiveClubSession>
    if (!parsed?.id || !parsed?.name) return null
    return {
      id: parsed.id,
      name: parsed.name,
      groupNames: Array.isArray(parsed.groupNames) ? parsed.groupNames : [],
      role: parsed.role === "manager" ? "manager" : "worker",
    }
  } catch {
    return null
  }
}

export function clearLastActiveClubSession(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(LAST_ACTIVE_CLUB_KEY)
}

export function resolveActiveClubSession(): ActiveClubSession | null {
  const loggedIn = getCurrentClub()
  if (loggedIn) {
    writeLastActiveClub(loggedIn)
    return loggedIn
  }

  const impersonated = getImpersonatedClub()
  if (impersonated) {
    const session = {
      id: impersonated.id,
      name: impersonated.name,
      groupNames: [] as string[],
      role: "worker" as const,
    }
    writeLastActiveClub(session)
    return session
  }

  // リロード直後にログインセッション読込が空でも、直前の有効クラブを復元する。
  return readLastActiveClub()
}

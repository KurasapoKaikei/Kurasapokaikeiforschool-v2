/** 学校管理者によるクラブポータルなりすまし（デモ用） */

import { notifyClubPortalSessionChanged } from "@/lib/clubPortalSessionEvents"

export type ImpersonatedClub = {
  id: string
  name: string
}

const SESSION_KEY = "kurasaokaikei-school-impersonate-club"

export function setImpersonatedClub(club: ImpersonatedClub): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(club))
}

export function getImpersonatedClub(): ImpersonatedClub | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ImpersonatedClub
    if (parsed?.id && parsed?.name) return parsed
    return null
  } catch {
    return null
  }
}

export function clearImpersonatedClub(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(SESSION_KEY)
  notifyClubPortalSessionChanged()
}

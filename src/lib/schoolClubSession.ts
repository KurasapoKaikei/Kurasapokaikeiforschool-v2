/** 学校管理者・監査人によるクラブポータルなりすまし（デモ用） */

import { notifyClubPortalSessionChanged } from "@/lib/clubPortalSessionEvents"

export type ImpersonationViewer = "school" | "auditor"

export type ImpersonatedClub = {
  id: string
  name: string
  viewer?: ImpersonationViewer
}

const SESSION_KEY = "kurasaokaikei-school-impersonate-club"

export function setImpersonatedClub(club: ImpersonatedClub): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(club))
}

export function getImpersonationViewer(): ImpersonationViewer {
  return getImpersonatedClub()?.viewer ?? "school"
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

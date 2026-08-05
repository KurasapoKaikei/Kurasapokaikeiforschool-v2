"use client"

import { useEffect, useState } from "react"
import { getClubLoginRole, type ClubLoginRole } from "@/lib/clubLoginSession"
import { CLUB_PORTAL_SESSION_CHANGED_EVENT } from "@/lib/clubPortalSessionEvents"
import { useClubSettlementLock } from "@/hooks/useClubSettlementLock"

/**
 * 書き込み不可か。
 * - 決算ロック中（作業者・責任者とも）
 * - 責任者ログイン（閲覧＋部内承認のみ）
 */
export function useClubWriteDisabled(): boolean {
  const isSettlementLocked = useClubSettlementLock()
  const [role, setRole] = useState<ClubLoginRole | null>(null)

  useEffect(() => {
    const sync = () => setRole(getClubLoginRole())
    sync()
    window.addEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, sync)
    window.addEventListener("storage", sync)
    window.addEventListener("focus", sync)
    return () => {
      window.removeEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, sync)
      window.removeEventListener("storage", sync)
      window.removeEventListener("focus", sync)
    }
  }, [])

  return isSettlementLocked || role === "manager"
}

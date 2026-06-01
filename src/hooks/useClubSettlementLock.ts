"use client"

import { useCallback, useEffect, useState } from "react"
import { useClubSession } from "@/contexts/ClubSessionContext"
import {
  CLUB_SETTLEMENT_LOCK_CHANGED_EVENT,
  makeClubSettlementLockKey,
  readClubSettlementLocked,
} from "@/lib/clubSettlementPortalSync"

/** クラブ各画面：決算提出ロック状態（同一タブ内の差戻解除も即時反映） */
export function useClubSettlementLock(): boolean {
  const { activeClub } = useClubSession()
  const clubId = activeClub?.id
  const [isLocked, setIsLocked] = useState(false)

  const sync = useCallback(() => {
    if (!clubId) {
      setIsLocked(false)
      return
    }
    setIsLocked(readClubSettlementLocked(clubId))
  }, [clubId])

  useEffect(() => {
    sync()
    const onLock = () => sync()
    const onStorage = (e: StorageEvent) => {
      if (!clubId) return
      const lockKey = makeClubSettlementLockKey(clubId)
      if (e.key === null || e.key === lockKey) sync()
    }
    window.addEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, onLock)
    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", sync)
    return () => {
      window.removeEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, onLock)
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", sync)
    }
  }, [sync, clubId])

  return isLocked
}

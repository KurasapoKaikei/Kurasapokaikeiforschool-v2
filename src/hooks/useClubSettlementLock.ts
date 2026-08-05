"use client"

import { useCallback, useEffect, useState } from "react"
import { useClubSession } from "@/contexts/ClubSessionContext"
import { getClubLoginRole, type ClubLoginRole } from "@/lib/clubLoginSession"
import { CLUB_PORTAL_SESSION_CHANGED_EVENT } from "@/lib/clubPortalSessionEvents"
import {
  CLUB_SETTLEMENT_LOCK_CHANGED_EVENT,
  makeClubSettlementLockKey,
  readClubSettlementLocked,
} from "@/lib/clubSettlementPortalSync"

/**
 * 書き込みを止めるか（決算ロック中、または責任者ログイン）。
 * アラート表示には `useClubSettlementLockedOnly` を使う。
 */
export function useClubSettlementLock(): boolean {
  const { activeClub } = useClubSession()
  const clubId = activeClub?.id
  const [isSettlementLocked, setIsSettlementLocked] = useState(false)
  const [role, setRole] = useState<ClubLoginRole | null>(null)

  const sync = useCallback(() => {
    if (!clubId) {
      setIsSettlementLocked(false)
    } else {
      setIsSettlementLocked(readClubSettlementLocked(clubId))
    }
    setRole(getClubLoginRole())
  }, [clubId])

  useEffect(() => {
    sync()
    const onLock = () => sync()
    const onStorage = (e: StorageEvent) => {
      if (!clubId) {
        sync()
        return
      }
      const lockKey = makeClubSettlementLockKey(clubId)
      if (e.key === null || e.key === lockKey) sync()
    }
    window.addEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, onLock)
    window.addEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, onLock)
    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", sync)
    return () => {
      window.removeEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, onLock)
      window.removeEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, onLock)
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", sync)
    }
  }, [sync, clubId])

  return isSettlementLocked || role === "manager"
}

/** 決算提出による全域ロックのみ（責任者モードでは false のまま） */
export function useClubSettlementLockedOnly(): boolean {
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

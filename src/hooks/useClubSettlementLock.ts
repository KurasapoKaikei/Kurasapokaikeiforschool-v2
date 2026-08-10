"use client"

import { useCallback, useEffect, useState } from "react"
import { useClubSession } from "@/contexts/ClubSessionContext"
import { getClubLoginRole, type ClubLoginRole } from "@/lib/clubLoginSession"
import { CLUB_PORTAL_SESSION_CHANGED_EVENT } from "@/lib/clubPortalSessionEvents"
import {
  CLUB_SETTLEMENT_LOCK_CHANGED_EVENT,
  getSettlementPeriodLockInfo,
  isFullSettlementLock,
  isTransactionDateLocked,
  makeClubLockedPeriodKey,
  makeClubSettlementLockKey,
  readClubSettlementLocked,
  type SettlementLockPeriodKind,
  type SettlementPeriodLockInfo,
} from "@/lib/clubSettlementPortalSync"

/**
 * 全域的に書き込み不可か。
 * - FULL（年度末提出）ロック中
 * - 責任者ログイン
 * H1（上期）期間ロックでは false（日付ベース制御を使う）
 */
export function useClubSettlementLock(): boolean {
  const { activeClub } = useClubSession()
  const clubId = activeClub?.id
  const [isFullyLocked, setIsFullyLocked] = useState(false)
  const [role, setRole] = useState<ClubLoginRole | null>(null)

  const sync = useCallback(() => {
    if (!clubId) {
      setIsFullyLocked(false)
    } else {
      setIsFullyLocked(isFullSettlementLock(clubId))
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
      const periodKey = makeClubLockedPeriodKey(clubId)
      if (e.key === null || e.key === lockKey || e.key === periodKey) sync()
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

  return isFullyLocked || role === "manager"
}

/** 期間ロック（H1/FULL）が有効か（アラート・決算画面用。責任者モードではロック有無のみ） */
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
      const periodKey = makeClubLockedPeriodKey(clubId)
      if (e.key === null || e.key === lockKey || e.key === periodKey) sync()
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

export type SettlementDateLockState = SettlementPeriodLockInfo & {
  /** 何らかの期間ロック中 */
  isPeriodLocked: boolean
  /** 年度全体ロック */
  isFullyLocked: boolean
  /** 上期のみロック */
  isH1Locked: boolean
  isDateLocked: (dateStr: string) => boolean
}

/** 取引日付ベースの期間ロック状態 */
export function useSettlementDateLock(): SettlementDateLockState {
  const { activeClub } = useClubSession()
  const clubId = activeClub?.id
  const [info, setInfo] = useState<SettlementPeriodLockInfo>({
    kind: "NONE",
    startDate: null,
    endDate: null,
    fiscalYear: null,
  })

  const sync = useCallback(() => {
    if (!clubId) {
      setInfo({ kind: "NONE", startDate: null, endDate: null, fiscalYear: null })
      return
    }
    setInfo(getSettlementPeriodLockInfo(clubId))
  }, [clubId])

  useEffect(() => {
    sync()
    const onLock = () => sync()
    const onStorage = (e: StorageEvent) => {
      if (!clubId) return
      const lockKey = makeClubSettlementLockKey(clubId)
      const periodKey = makeClubLockedPeriodKey(clubId)
      if (e.key === null || e.key === lockKey || e.key === periodKey) sync()
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

  const kind: SettlementLockPeriodKind = info.kind

  return {
    ...info,
    isPeriodLocked: kind === "H1" || kind === "FULL",
    isFullyLocked: kind === "FULL",
    isH1Locked: kind === "H1",
    isDateLocked: (dateStr: string) =>
      clubId ? isTransactionDateLocked(clubId, dateStr) : false,
  }
}

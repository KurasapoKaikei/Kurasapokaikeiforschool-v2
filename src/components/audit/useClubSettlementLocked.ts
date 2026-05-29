"use client"

import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "is_club_settlement_locked"

function readClubSettlementLocked(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

/** クラブ決算ページが保存した提出（ロック）フラグを監査人画面で参照する */
export function useClubSettlementLocked() {
  const [isClubSubmitted, setIsClubSubmitted] = useState(false)

  const sync = useCallback(() => {
    setIsClubSubmitted(readClubSettlementLocked())
  }, [])

  useEffect(() => {
    sync()
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === STORAGE_KEY) sync()
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") sync()
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", sync)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", sync)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [sync])

  return isClubSubmitted
}

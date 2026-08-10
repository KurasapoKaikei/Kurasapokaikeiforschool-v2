"use client"

import { AlertTriangle } from "lucide-react"
import { useEffect, useState } from "react"
import { useClubSession } from "@/contexts/ClubSessionContext"
import {
  CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT,
  CLUB_SETTLEMENT_LOCK_CHANGED_EVENT,
  getSettlementPeriodLockAlertMessage,
  readClubSettlementLocked,
} from "@/lib/clubSettlementPortalSync"

type SettlementLockAlertProps = {
  /** 互換用（表示判定はストレージの期間ロックを正とする） */
  isLocked?: boolean
  className?: string
}

/** 決算期間ロック中に表示する警告バナー（H1=上期 / FULL=年度全体） */
export function SettlementLockAlert({ className = "" }: SettlementLockAlertProps) {
  const { activeClub } = useClubSession()
  const clubId = activeClub?.id
  const [locked, setLocked] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    const sync = () => {
      setLocked(clubId ? readClubSettlementLocked(clubId) : false)
      setMessage(
        clubId
          ? getSettlementPeriodLockAlertMessage(clubId)
          : "決算データは提出済のため、登録、編集、削除はできません。"
      )
    }
    sync()
    window.addEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, sync)
    window.addEventListener(CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, sync)
      window.removeEventListener(CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [clubId])

  if (!locked) return null

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm ${className}`}
    >
      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
      <p>{message}</p>
    </div>
  )
}

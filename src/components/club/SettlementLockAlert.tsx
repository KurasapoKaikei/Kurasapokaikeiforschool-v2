"use client"

import { AlertTriangle } from "lucide-react"
import { useEffect, useState } from "react"
import { useClubSession } from "@/contexts/ClubSessionContext"
import {
  CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT,
  CLUB_SETTLEMENT_LOCK_CHANGED_EVENT,
  getAuditorAuditStatus,
  readClubSettlementLocked,
} from "@/lib/clubSettlementPortalSync"

type SettlementLockAlertProps = {
  /** 互換用（表示判定はストレージの決算ロックを正とする） */
  isLocked?: boolean
  className?: string
}

function resolveMessage(clubId: string | undefined): string {
  if (!clubId) {
    return "当年度の決算は提出済のため、登録、編集、削除はできません。ロックを解除するには監査人から差戻しをしてもらう必要があります。"
  }
  const status = getAuditorAuditStatus(clubId)
  if (status === "awaiting_manager_approval") {
    return "決算データは提出済（部内承認待ち）のため、登録、編集、削除はできません。クラブ責任者の部内承認後、監査人の査読へ進みます。"
  }
  if (status === "approved") {
    return "当年度の決算は承認済のため、登録、編集、削除はできません。"
  }
  return "当年度の決算は提出済のため、登録、編集、削除はできません。ロックを解除するには監査人から差戻しをしてもらう必要があります。"
}

/** 決算提出ロック中に表示する警告バナー */
export function SettlementLockAlert({ className = "" }: SettlementLockAlertProps) {
  const { activeClub } = useClubSession()
  const clubId = activeClub?.id
  const [locked, setLocked] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    const sync = () => {
      setLocked(clubId ? readClubSettlementLocked(clubId) : false)
      setMessage(resolveMessage(clubId))
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

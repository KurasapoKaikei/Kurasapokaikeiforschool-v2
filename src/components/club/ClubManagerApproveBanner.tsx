"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { getClubLoginRole } from "@/lib/clubLoginSession"
import { canActAsClubManager } from "@/lib/clubPortalAccess"
import { CLUB_PORTAL_SESSION_CHANGED_EVENT } from "@/lib/clubPortalSessionEvents"
import {
  applyManagerApproveSettlement,
  canManagerApproveSettlement,
  CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT,
  CLUB_SETTLEMENT_LOCK_CHANGED_EVENT,
} from "@/lib/clubSettlementPortalSync"

type ClubManagerApproveBannerProps = {
  clubId: string | undefined
  className?: string
}

/**
 * 責任者（閲覧モード）向け：部内承認アクション＋閲覧のみの案内
 */
export function ClubManagerApproveBanner({
  clubId,
  className = "",
}: ClubManagerApproveBannerProps) {
  const [visible, setVisible] = useState(false)
  const [canApprove, setCanApprove] = useState(false)

  const sync = useCallback(() => {
    setVisible(getClubLoginRole() === "manager")
    setCanApprove(
      Boolean(clubId) &&
        canManagerApproveSettlement(clubId!) &&
        canActAsClubManager()
    )
  }, [clubId])

  useEffect(() => {
    sync()
    const onSync = () => sync()
    window.addEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, onSync)
    window.addEventListener(CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT, onSync)
    window.addEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, onSync)
    window.addEventListener("storage", onSync)
    window.addEventListener("focus", onSync)
    return () => {
      window.removeEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, onSync)
      window.removeEventListener(CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT, onSync)
      window.removeEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, onSync)
      window.removeEventListener("storage", onSync)
      window.removeEventListener("focus", onSync)
    }
  }, [sync])

  if (!visible) return null

  const handleApprove = () => {
    if (!clubId) return
    if (
      !confirm(
        "決算を承認しますか？承認と同時に監査人に決算データが提出されます。"
      )
    ) {
      return
    }
    if (!applyManagerApproveSettlement(clubId)) {
      alert("現在のステータスでは承認できません。作業者の提出をお待ちください。")
      return
    }
    alert("承認しました。監査人に決算データが提出されました。")
    sync()
  }

  return (
    <div
      data-manager-action="approve"
      className={`shrink-0 border-b border-[#005088]/20 bg-[#005088]/5 px-6 py-3 ${className}`}
    >
      <p className="mb-1 text-sm font-medium text-[#005088]">
        責任者閲覧モード
      </p>
      <p className="mb-3 text-sm text-[#374151]">
        登録・編集・削除はできません。閲覧と決算承認のみ可能です。承認と同時に監査人に決算データが提出されます。
      </p>
      <Button
        type="button"
        data-manager-action="approve"
        onClick={handleApprove}
        disabled={!canApprove}
        className={`px-6 py-2.5 text-sm font-medium rounded-lg ${
          canApprove
            ? "bg-[#005088] text-white hover:opacity-90"
            : "bg-gray-300 text-gray-600 cursor-not-allowed disabled:opacity-100"
        }`}
      >
        決算を承認する
      </Button>
      {!canApprove && (
        <p className="mt-2 text-xs text-[#6B7280]">
          作業者が決算データを提出すると、このボタンが有効になります。
        </p>
      )}
    </div>
  )
}

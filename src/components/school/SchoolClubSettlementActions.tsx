"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import { sendSettlementDeadlineNotice } from "@/lib/portalMessages"
import {
  checkFiscalRollover,
  executeFiscalRollover,
  isFiscalRolloverCompleted,
  SETTLEMENT_CHANGED_EVENT,
} from "@/lib/schoolClubSettlement"
import { SCHOOL_BRAND_NAVY } from "@/lib/schoolTheme"

/** 決算期限通知・年度繰越（クラブ一覧上部） */
export function SchoolClubSettlementActions() {
  const { sortedClubs, isLoaded } = useSchoolClubs()
  const [notice, setNotice] = useState<string | null>(null)
  const [rolloverDone, setRolloverDone] = useState(false)
  const [rolloverCheck, setRolloverCheck] = useState(() =>
    checkFiscalRollover([])
  )

  const refresh = useCallback(() => {
    const ids = sortedClubs.map((c) => c.id)
    setRolloverCheck(checkFiscalRollover(ids))
    setRolloverDone(isFiscalRolloverCompleted())
  }, [sortedClubs])

  useEffect(() => {
    refresh()
    const onChange = () => refresh()
    window.addEventListener(SETTLEMENT_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(SETTLEMENT_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [refresh])

  const handleDeadlineNotice = () => {
    sendSettlementDeadlineNotice()
    setNotice(
      "全クラブへ決算提出期限の通知をメッセージBOXに送信しました。各クラブの受信箱で確認できます。"
    )
  }

  const handleRollover = () => {
    const ids = sortedClubs.map((c) => c.id)
    if (!executeFiscalRollover(ids)) return
    window.alert("繰越が完了しました")
    refresh()
  }

  const rolloverDisabled =
    !isLoaded || !rolloverCheck.canExecute || rolloverDone

  return (
    <div className="mb-6 rounded-lg border border-[#005088]/20 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-[#374151]">決算・年度繰越</h3>
      <p className="mt-1 text-xs text-[#6B7280]">
        全クラブの決算承認が揃うまで年度繰越はロックされます（localStorage管理）
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={!isLoaded}
          className="rounded-lg text-sm"
          onClick={handleDeadlineNotice}
        >
          全クラブへ決算提出期限の通知を発行
        </Button>
        <span className="relative inline-block">
          <Button
            type="button"
            disabled={rolloverDisabled}
            title={
              rolloverDone
                ? "年度繰越は実行済みです"
                : rolloverCheck.reason || "2026年度へ繰越を実行"
            }
            className="rounded-lg text-sm text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              backgroundColor: rolloverDisabled ? "#9CA3AF" : SCHOOL_BRAND_NAVY,
            }}
            onClick={handleRollover}
          >
            2026年度への年度繰越処理を実行
          </Button>
        </span>
      </div>
      {!rolloverCheck.canExecute && isLoaded && sortedClubs.length > 0 && !rolloverDone ? (
        <p className="mt-2 text-xs text-[#92400E]">{rolloverCheck.reason}</p>
      ) : null}
      {rolloverDone ? (
        <p className="mt-2 text-xs text-[#059669]">2026年度への繰越処理は完了しています。</p>
      ) : null}
      {notice ? (
        <p className="mt-2 text-xs text-[#059669]" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  )
}

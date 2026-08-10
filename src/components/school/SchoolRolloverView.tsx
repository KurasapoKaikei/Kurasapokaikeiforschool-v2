"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { SchoolContentPanel } from "@/components/layout/school/SchoolContentPanel"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import {
  checkFiscalRollover,
  executeFiscalRollover,
  isFiscalRolloverCompleted,
  SETTLEMENT_CHANGED_EVENT,
} from "@/lib/schoolClubSettlement"
import { SCHOOL_BRAND_NAVY, SCHOOL_PAGE_TITLES } from "@/lib/schoolTheme"

/** 繰越: 年度繰越処理 */
export function SchoolRolloverView() {
  const { sortedClubs, isLoaded } = useSchoolClubs()
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

  const handleRollover = () => {
    const ids = sortedClubs.map((c) => c.id)
    if (!executeFiscalRollover(ids)) return
    window.alert("繰越が完了しました")
    refresh()
  }

  const rolloverDisabled =
    !isLoaded || !rolloverCheck.canExecute || rolloverDone

  return (
    <SchoolContentPanel
      title={SCHOOL_PAGE_TITLES.rollover}
      description="全クラブの年度末決算が承認済みのとき、次年度への繰越処理を実行できます。"
    >
      <div className="space-y-4 text-[#374151]">
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

        {!rolloverCheck.canExecute &&
        isLoaded &&
        sortedClubs.length > 0 &&
        !rolloverDone ? (
          <p className="text-xs text-[#92400E]">{rolloverCheck.reason}</p>
        ) : null}
        {rolloverDone ? (
          <p className="text-xs text-[#059669]">
            2026年度への繰越処理は完了しています。
          </p>
        ) : null}
      </div>
    </SchoolContentPanel>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import {
  formatMonthDayJa,
  formatSettlementNoticeWindowBanner,
  loadSchoolSettlementNoticeWindow,
  resolveSchoolAuditPeriodStatus,
  SCHOOL_SETTLEMENT_NOTICE_WINDOW_CHANGED_EVENT,
  settlementPeriodShortLabel,
  type SchoolSettlementNoticeWindow,
} from "@/lib/schoolSettlementNoticeWindow"
import { cn } from "@/lib/utils"

type SchoolAuditPeriodStatusCardProps = {
  className?: string
  /** 監査期間外のとき表示する説明文（省略可） */
  idleHint?: string
}

/** 監査期間の「現在のステータス」表示（トップ・監査ページ共通） */
export function SchoolAuditPeriodStatusCard({
  className,
  idleHint = "提出区分と期限を設定して通知すると、ここに監査期間中のステータスが表示されます。",
}: SchoolAuditPeriodStatusCardProps) {
  const [activeWindow, setActiveWindow] =
    useState<SchoolSettlementNoticeWindow | null>(null)

  const refresh = useCallback(() => {
    setActiveWindow(loadSchoolSettlementNoticeWindow())
  }, [])

  useEffect(() => {
    refresh()
    const onChange = () => refresh()
    window.addEventListener(SCHOOL_SETTLEMENT_NOTICE_WINDOW_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(
        SCHOOL_SETTLEMENT_NOTICE_WINDOW_CHANGED_EVENT,
        onChange
      )
      window.removeEventListener("storage", onChange)
    }
  }, [refresh])

  const isInAuditPeriod =
    resolveSchoolAuditPeriodStatus(activeWindow) === "in_audit_period"

  return (
    <div
      role="status"
      aria-label="監査期間ステータス"
      className={cn(
        "flex min-h-[11rem] flex-col justify-center rounded-xl border-2 px-5 py-5",
        isInAuditPeriod
          ? "border-[#001e43] bg-[#001e43] text-white shadow-md"
          : "border-gray-200 bg-gray-50 text-[#6B7280]",
        className
      )}
    >
      <p
        className={cn(
          "text-[11px] font-medium tracking-wider uppercase",
          isInAuditPeriod ? "text-white/70" : "text-[#9CA3AF]"
        )}
      >
        現在のステータス
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tracking-wide sm:text-3xl",
          isInAuditPeriod ? "text-white" : "text-[#9CA3AF]"
        )}
      >
        {isInAuditPeriod ? "監査期間中" : "監査期間外"}
      </p>

      {isInAuditPeriod && activeWindow ? (
        <div className="mt-4 space-y-2 border-t border-white/25 pt-4 text-sm">
          <p className="text-base font-semibold leading-snug text-white">
            {formatSettlementNoticeWindowBanner(activeWindow)}
          </p>
          <dl className="mt-2 space-y-1.5 text-sm text-white/95">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-white/70">提出区分</dt>
              <dd className="font-medium">
                {settlementPeriodShortLabel(activeWindow.period)}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-white/70">決算データ提出期限</dt>
              <dd className="font-semibold">
                {formatMonthDayJa(activeWindow.deadlineDate)}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-white/70">監査完了期限</dt>
              <dd className="font-semibold">
                {formatMonthDayJa(activeWindow.auditCompletionDate)}
              </dd>
            </div>
          </dl>
        </div>
      ) : idleHint ? (
        <p className="mt-3 text-sm leading-relaxed text-[#9CA3AF]">{idleHint}</p>
      ) : null}
    </div>
  )
}

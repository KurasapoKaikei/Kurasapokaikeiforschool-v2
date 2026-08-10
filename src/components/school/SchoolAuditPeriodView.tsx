"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { DatePickerField } from "@/components/ui/date-picker-field"
import { SchoolContentPanel } from "@/components/layout/school/SchoolContentPanel"
import { SchoolAuditPeriodStatusCard } from "@/components/school/SchoolAuditPeriodStatusCard"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import { usePortalFiscalYearOptional } from "@/contexts/PortalFiscalYearContext"
import {
  sendSettlementDeadlineNotice,
  type SettlementDeadlineNoticePeriod,
} from "@/lib/portalMessages"
import {
  clearSchoolSettlementNoticeWindow,
  formatFullDateJa,
  loadSchoolSettlementNoticeWindow,
  saveSchoolSettlementNoticeWindow,
  SCHOOL_SETTLEMENT_NOTICE_WINDOW_CHANGED_EVENT,
  type SchoolSettlementNoticeWindow,
} from "@/lib/schoolSettlementNoticeWindow"
import { resolveFiscalDateBounds } from "@/lib/fiscalDateBounds"
import { SCHOOL_BRAND_NAVY, SCHOOL_PAGE_TITLES } from "@/lib/schoolTheme"

function periodLabel(period: SettlementDeadlineNoticePeriod): string {
  return period === "mid_term" ? "半期決算（中間）" : "年度末決算"
}

/** 監査: 提出区分・期限設定、全クラブ・全監査人通知、監査期間解除 */
export function SchoolAuditPeriodView() {
  const { isLoaded } = useSchoolClubs()
  const portalFiscalYear = usePortalFiscalYearOptional()
  const fiscalBounds = useMemo(
    () => resolveFiscalDateBounds(portalFiscalYear?.selectedYear),
    [portalFiscalYear?.selectedYear]
  )
  const [periodKind, setPeriodKind] =
    useState<SettlementDeadlineNoticePeriod>("mid_term")
  const [deadlineDate, setDeadlineDate] = useState("")
  const [auditCompletionDate, setAuditCompletionDate] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
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

  const handleDeadlineNotice = () => {
    if (!periodKind) {
      window.alert("半期決算または年度末決算を選択してください。")
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineDate)) {
      window.alert("決算データ提出期限を指定してください。")
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(auditCompletionDate)) {
      window.alert("監査完了期限を指定してください。")
      return
    }
    if (auditCompletionDate < deadlineDate) {
      window.alert(
        "監査完了期限は決算データ提出期限以降の日付を指定してください。"
      )
      return
    }
    sendSettlementDeadlineNotice(periodKind, deadlineDate, auditCompletionDate)
    const saved = saveSchoolSettlementNoticeWindow(
      periodKind,
      deadlineDate,
      auditCompletionDate
    )
    setActiveWindow(saved)
    setNotice(
      `全クラブ・全監査人へ「${periodLabel(periodKind)}」の通知を送信しました（提出期限 ${formatFullDateJa(deadlineDate)}／監査完了期限 ${formatFullDateJa(auditCompletionDate)}）。`
    )
  }

  const handleClearAuditPeriod = () => {
    if (!activeWindow) return
    if (
      !confirm(
        "監査期間を解除しますか？ステータスは「監査期間外」になり、期間表示はクリアされます。"
      )
    ) {
      return
    }
    clearSchoolSettlementNoticeWindow()
    setActiveWindow(null)
    setNotice("監査期間を解除しました。")
  }

  const noticeDisabled =
    !isLoaded ||
    !/^\d{4}-\d{2}-\d{2}$/.test(deadlineDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(auditCompletionDate)

  return (
    <SchoolContentPanel
      title={SCHOOL_PAGE_TITLES.audit}
      description="提出区分と期限を設定し、全クラブ・全監査人へ通知します。上部のステータスで現在の監査期間を確認できます。"
    >
      <div className="flex flex-col gap-6">
        <SchoolAuditPeriodStatusCard />

        <div className="flex flex-col space-y-4 text-[#374151]">
          <div>
            <p className="mb-1.5 text-xs font-medium text-[#6B7280]">提出区分</p>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="settlementNoticePeriod"
                  value="mid_term"
                  checked={periodKind === "mid_term"}
                  onChange={() => setPeriodKind("mid_term")}
                  className="accent-[#001e43]"
                />
                半期決算（中間）
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="settlementNoticePeriod"
                  value="year_end"
                  checked={periodKind === "year_end"}
                  onChange={() => setPeriodKind("year_end")}
                  className="accent-[#001e43]"
                />
                年度末決算
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label
                htmlFor="settlement-deadline-date"
                className="mb-1 block text-xs font-medium text-[#6B7280]"
              >
                決算データ提出期限
              </label>
              <DatePickerField
                id="settlement-deadline-date"
                value={deadlineDate}
                onChange={setDeadlineDate}
                themeColor={SCHOOL_BRAND_NAVY}
                minDate={fiscalBounds.minDate}
                maxDate={fiscalBounds.maxDate}
                aria-label="決算データ提出期限"
              />
            </div>
            <div className="min-w-0">
              <label
                htmlFor="settlement-audit-completion-date"
                className="mb-1 block text-xs font-medium text-[#6B7280]"
              >
                監査完了期限
              </label>
              <DatePickerField
                id="settlement-audit-completion-date"
                value={auditCompletionDate}
                onChange={setAuditCompletionDate}
                themeColor={SCHOOL_BRAND_NAVY}
                minDate={deadlineDate || fiscalBounds.minDate}
                maxDate={fiscalBounds.maxDate}
                aria-label="監査完了期限"
              />
            </div>
          </div>

          <div className="flex flex-col items-start gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={noticeDisabled}
              className="rounded-lg text-sm"
              onClick={handleDeadlineNotice}
            >
              全クラブ・全監査人に通知
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!activeWindow}
              className="rounded-lg border-amber-300 text-sm text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleClearAuditPeriod}
              title={
                activeWindow
                  ? "監査期間の表示を解除し、監査期間外に戻します"
                  : "解除できる監査期間がありません"
              }
            >
              監査期間を解除
            </Button>
          </div>

          {notice ? (
            <p className="text-xs text-[#059669]" role="status">
              {notice}
            </p>
          ) : null}
        </div>
      </div>
    </SchoolContentPanel>
  )
}

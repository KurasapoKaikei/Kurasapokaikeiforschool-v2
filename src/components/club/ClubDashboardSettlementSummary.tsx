"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, RotateCcw } from "lucide-react"
import { SettlementAuditStatusBadge } from "@/components/school/SettlementAuditStatusBadge"
import { useClubSession } from "@/contexts/ClubSessionContext"
import {
  CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT,
  CLUB_SETTLEMENT_LOCK_CHANGED_EVENT,
  getAuditorAuditStatus,
  getAuditorAuditStatusBadgeVariant,
  getAuditorAuditStatusLabel,
  loadSettlementHistoryFlow,
  readClubSettlementLocked,
  type SettlementHistoryStep,
} from "@/lib/clubSettlementPortalSync"
import { clubPath } from "@/lib/routes"
import { SETTLEMENT_CHANGED_EVENT } from "@/lib/schoolClubSettlement"

function stepColor(
  status: SettlementHistoryStep["status"],
  isCurrent: boolean,
  isPassed: boolean,
): string {
  if (isCurrent) {
    switch (status) {
      case "PREPARING":
        return "bg-red-500 text-white border-transparent"
      case "SUBMITTED":
        return "bg-green-600 text-white border-transparent"
      case "APPROVED":
        return "bg-blue-600 text-white border-transparent"
      case "REJECTED":
        return "bg-amber-100 text-amber-800 border-amber-200"
    }
  }
  if (isPassed) {
    switch (status) {
      case "PREPARING":
        return "bg-red-50 text-red-600 border-red-200"
      case "SUBMITTED":
        return "bg-green-50 text-green-700 border-green-200"
      case "APPROVED":
        return "bg-blue-50 text-blue-700 border-blue-200"
      case "REJECTED":
        return "bg-amber-50 text-amber-700 border-amber-200"
    }
  }
  return "bg-gray-100 text-gray-400 border-gray-200"
}

/** クラブダッシュボード：決算ステータス（右列・上段） */
export function ClubDashboardSettlementSummary() {
  const { activeClub } = useClubSession()
  const clubId = activeClub?.id
  const [flowSteps, setFlowSteps] = useState<SettlementHistoryStep[]>([])
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [badgeLabel, setBadgeLabel] = useState("未提出")
  const [badgeVariant, setBadgeVariant] = useState<
    "muted" | "navy" | "rejected" | "approved"
  >("muted")

  const syncFromStorage = useCallback(() => {
    if (!clubId) {
      setFlowSteps([])
      setCurrentStepIndex(0)
      setBadgeLabel("未提出")
      setBadgeVariant("muted")
      return
    }
    const flow = loadSettlementHistoryFlow(clubId)
    setFlowSteps(flow.steps)
    setCurrentStepIndex(flow.currentIndex)
    const locked = readClubSettlementLocked(clubId)
    const audit = getAuditorAuditStatus(clubId)
    setBadgeLabel(getAuditorAuditStatusLabel(audit, locked))
    setBadgeVariant(getAuditorAuditStatusBadgeVariant(audit, locked))
  }, [clubId])

  useEffect(() => {
    syncFromStorage()
    const onSync = () => syncFromStorage()
    window.addEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, onSync)
    window.addEventListener(CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT, onSync)
    window.addEventListener(SETTLEMENT_CHANGED_EVENT, onSync)
    window.addEventListener("storage", onSync)
    return () => {
      window.removeEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, onSync)
      window.removeEventListener(CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT, onSync)
      window.removeEventListener(SETTLEMENT_CHANGED_EVENT, onSync)
      window.removeEventListener("storage", onSync)
    }
  }, [syncFromStorage])

  const currentStep = flowSteps[currentStepIndex]

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 border-l-[5px] border-l-[#005088] bg-white p-3 shadow-sm">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <h2 className="border-b-2 border-[#005088] pb-1 text-base font-semibold text-[#005088]">
          決算ステータス
        </h2>
        <Link
          href={clubPath("/settlement")}
          className="shrink-0 text-xs font-medium text-[#005088] transition-colors hover:underline"
        >
          詳細 ➔
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-between gap-2">
        <div>
          {currentStep ? (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-[#6B7280]">現在</span>
              <SettlementAuditStatusBadge label={badgeLabel} variant={badgeVariant} />
            </div>
          ) : null}

          {flowSteps.length > 0 ? (
            <div className="flex flex-wrap items-center gap-y-2 gap-x-1.5">
              {flowSteps.map((step, index) => {
                const isCurrent = index === currentStepIndex
                const isPassed = index < currentStepIndex
                const badgeStyle = stepColor(step.status, isCurrent, isPassed)

                return (
                  <div key={step.id} className="flex items-center gap-1">
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badgeStyle}`}
                    >
                      {isPassed && step.status !== "REJECTED" ? (
                        <CheckCircle2 className="h-2.5 w-2.5" />
                      ) : null}
                      {step.status === "REJECTED" ? (
                        <RotateCcw className="h-2.5 w-2.5" />
                      ) : null}
                      {step.label}
                    </span>
                    {index < flowSteps.length - 1 ? (
                      <ArrowRight className="h-2.5 w-2.5 shrink-0 text-gray-300" />
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-[#6B7280]">クラブでログインすると表示されます</p>
          )}
        </div>

        <p className="shrink-0 text-[10px] text-[#9CA3AF]">
          提出期限などはメッセージBOXで確認できます
        </p>
      </div>
    </div>
  )
}

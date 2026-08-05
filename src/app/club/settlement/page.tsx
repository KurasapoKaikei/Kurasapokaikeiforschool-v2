"use client"

import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { ArrowRight, RotateCcw, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  applyClubSettlementSubmit,
  applyManagerApproveSettlement,
  canManagerApproveSettlement,
  CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT,
  CLUB_SETTLEMENT_LOCK_CHANGED_EVENT,
  getAuditorAuditStatus,
  getClubSettlementPeriod,
  getClubSettlementPeriodLabel,
  loadSettlementHistoryFlow,
  type ClubSettlementPeriodKind,
  type SettlementHistoryStep,
} from "@/lib/clubSettlementPortalSync"
import { useClubSession } from "@/contexts/ClubSessionContext"
import { useClubSettlementLockedOnly } from "@/hooks/useClubSettlementLock"
import { setClubSettlementStatus, submitClubSettlement } from "@/lib/schoolClubSettlement"
import { clubPath } from "@/lib/routes"
import { canActAsClubManager } from "@/lib/clubPortalAccess"
import { getClubLoginRole } from "@/lib/clubLoginSession"

export default function ClubSettlementPage() {
  const { activeClub } = useClubSession()
  const clubId = activeClub?.id
  const [flowSteps, setFlowSteps] = useState<SettlementHistoryStep[]>([])
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [submittedPeriod, setSubmittedPeriod] =
    useState<ClubSettlementPeriodKind | null>(null)
  const [periodKind, setPeriodKind] = useState<ClubSettlementPeriodKind>("year_end")
  const [auditStatus, setAuditStatus] =
    useState<ReturnType<typeof getAuditorAuditStatus>>("not_started")
  const [role, setRole] = useState(getClubLoginRole())
  const isSettlementLocked = useClubSettlementLockedOnly()

  const syncFromStorage = useCallback(() => {
    if (!clubId) return
    const flow = loadSettlementHistoryFlow(clubId)
    setFlowSteps(flow.steps)
    setCurrentStepIndex(flow.currentIndex)
    setSubmittedPeriod(getClubSettlementPeriod(clubId))
    setAuditStatus(getAuditorAuditStatus(clubId))
    setRole(getClubLoginRole())
  }, [clubId])

  useEffect(() => {
    syncFromStorage()
    const onSync = () => syncFromStorage()
    window.addEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, onSync)
    window.addEventListener(CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT, onSync)
    window.addEventListener("storage", onSync)
    return () => {
      window.removeEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, onSync)
      window.removeEventListener(CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT, onSync)
      window.removeEventListener("storage", onSync)
    }
  }, [syncFromStorage])

  const canSubmitWorker =
    !isSettlementLocked &&
    (auditStatus === "not_started" || auditStatus === "rejected") &&
    role !== "manager"

  const canManagerApprove =
    Boolean(clubId) &&
    canManagerApproveSettlement(clubId!) &&
    canActAsClubManager()

  const handleSubmit = () => {
    const periodLabel = getClubSettlementPeriodLabel(periodKind)
    if (
      !confirm(
        `${periodLabel}のデータを提出しますか？提出後は全域ロックされ、クラブ責任者の部内承認待ちになります。`
      )
    ) {
      return
    }
    try {
      if (activeClub) {
        if (!submitClubSettlement(activeClub.id)) {
          setClubSettlementStatus(activeClub.id, "submitted")
        }
        applyClubSettlementSubmit(activeClub.id, periodKind)
      }
      alert(
        `${periodLabel}を提出しました。責任者の部内承認をお待ちください（この間、登録・編集・削除はできません）。`
      )
      syncFromStorage()
    } catch {
      if (activeClub) {
        applyClubSettlementSubmit(activeClub.id, periodKind)
      }
      syncFromStorage()
    }
  }

  const handleManagerApprove = () => {
    if (!clubId) return
    if (!confirm("部内承認して監査人の査読（監査中）へ進みますか？")) return
    if (!applyManagerApproveSettlement(clubId)) {
      alert("現在のステータスでは部内承認できません。")
      return
    }
    alert("部内承認しました。監査人の承認・差戻しが可能になります。")
    syncFromStorage()
  }

  const stepColor = (
    status: SettlementHistoryStep["status"],
    isCurrent: boolean,
    isPassed: boolean
  ) => {
    if (isCurrent) {
      switch (status) {
        case "PREPARING":
          return "bg-red-500 text-white border-transparent"
        case "AWAITING_MANAGER":
        case "SUBMITTED":
          return "bg-amber-500 text-white border-transparent"
        case "IN_REVIEW":
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
        case "AWAITING_MANAGER":
        case "SUBMITTED":
          return "bg-amber-50 text-amber-800 border-amber-200"
        case "IN_REVIEW":
          return "bg-green-50 text-green-700 border-green-200"
        case "APPROVED":
          return "bg-blue-50 text-blue-700 border-blue-200"
        case "REJECTED":
          return "bg-amber-50 text-amber-700 border-amber-200"
      }
    }
    return "bg-gray-100 text-gray-400 border-gray-200"
  }

  const loginRoleLabel =
    role === "manager" ? "クラブ責任者" : role === "worker" ? "作業者" : "—"

  return (
    <div className="w-full p-6 space-y-8 text-left bg-white rounded-xl">
      <div className="border-l-4 pl-4 border-[#001e43]">
        <h1 className="text-xl font-semibold text-gray-800">決算</h1>
        <p className="text-sm text-gray-500 mt-1">
          作業者が提出 → クラブ責任者が部内承認 → 監査人が承認／差戻し、の順で進みます。現在のログイン:{" "}
          <span className="font-medium text-gray-700">{loginRoleLabel}</span>
        </p>
      </div>

      <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">■ 担当監査人</h2>
        <div className="pl-4 text-sm text-gray-600">財務部 山田太郎 様</div>
      </div>

      <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">■ 決算ステータス</h2>
        <div className="flex flex-wrap items-center gap-y-4 gap-x-2">
          {flowSteps.map((step, index) => {
            const isCurrent = index === currentStepIndex
            const isPassed = index < currentStepIndex
            const badgeStyle = stepColor(step.status, isCurrent, isPassed)

            return (
              <div key={step.id} className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border ${badgeStyle}`}
                >
                  {isPassed && step.status !== "REJECTED" && (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                  {step.status === "REJECTED" && (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  {step.label}
                </span>
                {index < flowSteps.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-gray-300 mx-0.5 shrink-0" />
                )}
              </div>
            )
          })}
        </div>
        {(isSettlementLocked || submittedPeriod) && (
          <p className="text-xs text-[#6B7280] pl-1">
            提出区分: {getClubSettlementPeriodLabel(submittedPeriod)}
          </p>
        )}
        <div className="pt-1">
          <Link
            href={clubPath("/messages")}
            className="inline-flex items-center text-sm font-medium text-sky-500 transition-colors hover:text-sky-600"
          >
            メッセージBOXへ ➔
          </Link>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 space-y-4">
        {auditStatus === "awaiting_manager_approval" && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            責任者の部内承認待ちです。作業者の提出ボタンは非活性です。クラブ責任者アカウント（または学校・監査人のなりすまし）で「決算を承認する」を実行してください。
          </p>
        )}

        {canSubmitWorker && (
          <>
            <p className="text-sm text-gray-600">
              半期または年度末の確認が完了したら提出してください。
              <br />
              <span className="text-red-500 font-medium">
                ※提出後は全域ロックされ、責任者の部内承認待ちになります。
              </span>
            </p>
            <div className="mb-2 space-y-2">
              <p className="text-sm font-medium text-gray-700">提出区分</p>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="settlementPeriod"
                    value="mid_term"
                    checked={periodKind === "mid_term"}
                    onChange={() => setPeriodKind("mid_term")}
                    className="accent-[#001e43]"
                  />
                  半期決算（中間）
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="settlementPeriod"
                    value="year_end"
                    checked={periodKind === "year_end"}
                    onChange={() => setPeriodKind("year_end")}
                    className="accent-[#001e43]"
                  />
                  年度末決算
                </label>
              </div>
            </div>
            <Button
              onClick={handleSubmit}
              className="px-6 py-2.5 font-medium rounded-lg text-sm bg-[#001e43] text-white hover:opacity-90"
            >
              決算データを提出する
            </Button>
          </>
        )}

        {!canSubmitWorker && role === "worker" && isSettlementLocked && (
          <Button
            disabled
            className="px-6 py-2.5 font-medium rounded-lg text-sm bg-gray-300 text-gray-600 cursor-not-allowed disabled:opacity-100"
          >
            {auditStatus === "awaiting_manager_approval"
              ? "責任者の部内承認待ち"
              : auditStatus === "in_review"
                ? "決算データ提出済み（監査中）"
                : auditStatus === "approved"
                  ? "決算データ承認済み"
                  : "決算データ提出済み"}
          </Button>
        )}

        {(canManagerApprove ||
          (role === "manager" &&
            auditStatus === "awaiting_manager_approval")) && (
          <div className="space-y-2">
            <Button
              data-manager-action="approve"
              onClick={handleManagerApprove}
              disabled={!canManagerApprove}
              className={`px-6 py-2.5 font-medium rounded-lg text-sm ${
                canManagerApprove
                  ? "bg-[#005088] text-white hover:opacity-90"
                  : "bg-gray-300 text-gray-600 cursor-not-allowed"
              }`}
            >
              決算を承認する（部内承認）
            </Button>
            {!canManagerApprove && (
              <p className="text-xs text-[#6B7280]">
                部内承認待ちの提出があるときのみ操作できます。
              </p>
            )}
          </div>
        )}

        {role === "manager" && auditStatus === "not_started" && (
          <p className="text-sm text-[#6B7280]">
            責任者モードでは閲覧と部内承認のみ可能です。決算の提出は作業者アカウントで行ってください。
          </p>
        )}

        {!isSettlementLocked &&
          flowSteps.some((s) => s.status === "REJECTED") &&
          role === "worker" && (
            <span className="inline-block text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
              ※差し戻し中です。修正のうえ再提出できます
            </span>
          )}
      </div>
    </div>
  )
}

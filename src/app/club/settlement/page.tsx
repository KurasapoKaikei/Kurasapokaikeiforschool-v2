"use client"

import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { ArrowRight, RotateCcw, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  applyClubSettlementSubmit,
  CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT,
  CLUB_SETTLEMENT_LOCK_CHANGED_EVENT,
  loadSettlementHistoryFlow,
  type SettlementHistoryStep,
} from "@/lib/clubSettlementPortalSync"
import { useClubSession } from "@/contexts/ClubSessionContext"
import { useClubSettlementLock } from "@/hooks/useClubSettlementLock"
import { setClubSettlementStatus, submitClubSettlement } from "@/lib/schoolClubSettlement"
import { clubPath } from "@/lib/routes"

export default function ClubSettlementPage() {
  const { activeClub } = useClubSession()
  const clubId = activeClub?.id
  const [flowSteps, setFlowSteps] = useState<SettlementHistoryStep[]>([])
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const isLocked = useClubSettlementLock()
  const [auditorInfo] = useState("財務部 山田太郎 様")

  const syncFromStorage = useCallback(() => {
    if (!clubId) return
    const flow = loadSettlementHistoryFlow(clubId)
    setFlowSteps(flow.steps)
    setCurrentStepIndex(flow.currentIndex)
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

  const handleSubmit = () => {
    if (
      !confirm(
        "決算データを学校へ提出しますか？提出後はすべての操作がロックされます。"
      )
    ) {
      return
    }
    try {
      if (activeClub) {
        if (!submitClubSettlement(activeClub.id)) {
          setClubSettlementStatus(activeClub.id, "submitted")
        }
      }
      if (activeClub) {
        applyClubSettlementSubmit(activeClub.id)
      }
      alert("決算データを提出しました。各機能にロックがかかります。")
      syncFromStorage()
    } catch {
      if (activeClub) {
        applyClubSettlementSubmit(activeClub.id)
      }
      syncFromStorage()
    }
  }

  const stepColor = (status: SettlementHistoryStep["status"], isCurrent: boolean, isPassed: boolean) => {
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

  return (
    <div className="w-full p-6 space-y-8 text-left bg-white rounded-xl">
      {/* 小タイトル（ネイビーの縦ライン） */}
      <div className="border-l-4 pl-4 border-[#001e43]">
        <h1 className="text-xl font-semibold text-gray-800">決算</h1>
        <p className="text-sm text-gray-500 mt-1">
          年度末の決算データの確認と学校への提出を行います。
        </p>
      </div>

      {/* 担当監査人 */}
      <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">■ 担当監査人</h2>
        <div className="pl-4 text-sm text-gray-600">{auditorInfo}</div>
      </div>

      {/* 決算ステータス（ステップフロー） */}
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
        <div className="pt-1">
          <Link
            href={clubPath("/messages")}
            className="inline-flex items-center text-sm font-medium text-sky-500 transition-colors hover:text-sky-600"
          >
            メッセージBOXへ ➔
          </Link>
        </div>
      </div>

      {/* 決算データを提出する ボタン */}
      <div className="pt-4 border-t border-gray-100">
        <p className="text-sm text-gray-600 mb-4">
          すべての確認が完了したら、学校管理者へ提出してください。
          <br />
          <span className="text-red-500 font-medium">
            ※提出後は、データの登録・編集・削除が一切できなくなります。
          </span>
        </p>

        <div className="flex items-center gap-4 flex-wrap">
          <Button
            onClick={handleSubmit}
            disabled={isLocked}
            className={`px-6 py-2.5 font-medium rounded-lg text-sm transition-opacity hover:opacity-90 ${
              isLocked
                ? "bg-gray-300 text-gray-600 cursor-not-allowed disabled:opacity-100"
                : "bg-[#001e43] text-white"
            }`}
          >
            {isLocked ? "決算データ提出済み（監査中）" : "決算データを提出する"}
          </Button>

          {!isLocked && flowSteps.length > 3 && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
              ※現在、差し戻し中（修正可能状態）です
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

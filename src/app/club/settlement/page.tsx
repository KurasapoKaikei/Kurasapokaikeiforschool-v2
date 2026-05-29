"use client"

import { useState, useEffect } from "react"
import { ArrowRight, RotateCcw, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"

// ステータスの型定義
type HistoryStatus = "PREPARING" | "SUBMITTED" | "REJECTED" | "APPROVED"

interface StepItem {
  id: string
  label: string
  status: HistoryStatus
}

const DEFAULT_FLOW: StepItem[] = [
  { id: "1", label: "作成中", status: "PREPARING" },
  { id: "2", label: "提出済", status: "SUBMITTED" },
  { id: "3", label: "承認済", status: "APPROVED" },
]

export default function ClubSettlementPage() {
  const [flowSteps, setFlowSteps] = useState<StepItem[]>(DEFAULT_FLOW)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isLocked, setIsLocked] = useState(false)
  const [auditorInfo] = useState("財務部 山田太郎 様")

  useEffect(() => {
    try {
      const savedLocked = localStorage.getItem("is_club_settlement_locked")
      const savedHistory = localStorage.getItem("club_settlement_history_flow")

      if (savedHistory) {
        const parsed = JSON.parse(savedHistory) as {
          steps: StepItem[]
          currentIndex: number
        }
        if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          setFlowSteps(parsed.steps)
          setCurrentStepIndex(
            typeof parsed.currentIndex === "number" ? parsed.currentIndex : 0
          )
        }
      } else if (savedLocked === "true") {
        setCurrentStepIndex(1)
      }

      setIsLocked(savedLocked === "true")
    } catch {
      // エラー時は初期フローを維持
    }
  }, [])

  const handleSubmit = () => {
    if (
      confirm(
        "決算データを学校へ提出しますか？提出後はすべての操作がロックされます。"
      )
    ) {
      try {
        let nextIndex = currentStepIndex + 1
        if (nextIndex > flowSteps.length - 1) nextIndex = flowSteps.length - 1

        setCurrentStepIndex(nextIndex)
        setIsLocked(true)

        localStorage.setItem("is_club_settlement_locked", "true")

        const historyData = {
          steps: flowSteps,
          currentIndex: nextIndex,
        }
        localStorage.setItem(
          "club_settlement_history_flow",
          JSON.stringify(historyData)
        )

        alert("決算データを提出しました。各機能にロックがかかります。")
        window.location.reload()
      } catch {
        setCurrentStepIndex(1)
        setIsLocked(true)
      }
    }
  }

  const handleSimulateReject = () => {
    try {
      const newSteps: StepItem[] = [
        ...flowSteps.slice(0, flowSteps.length - 1),
        { id: `rej-${Date.now()}`, label: "差戻し", status: "REJECTED" },
        { id: `sub-${Date.now()}`, label: "提出済", status: "SUBMITTED" },
        { id: "approved-end", label: "承認済", status: "APPROVED" },
      ]

      const rejectIndex = newSteps.length - 3

      setFlowSteps(newSteps)
      setCurrentStepIndex(rejectIndex)
      setIsLocked(false)
      localStorage.setItem("is_club_settlement_locked", "false")

      const historyData = { steps: newSteps, currentIndex: rejectIndex }
      localStorage.setItem(
        "club_settlement_history_flow",
        JSON.stringify(historyData)
      )
      alert(
        "【デモ機能】監査人から差し戻されました。フローに歴史が追加され、ロックが解除されました。"
      )
    } catch {
      // エラー時は状態を維持
    }
  }

  const navyColor = "#001e43"

  return (
    <div className="w-full p-6 space-y-8 text-left bg-white rounded-xl">
      {/* 小タイトル（ネイビーの縦ライン） */}
      <div className="border-l-4 pl-4" style={{ borderColor: navyColor }}>
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

            let badgeStyle = "bg-gray-100 text-gray-400 border-gray-200"
            if (isCurrent) {
              badgeStyle = "text-white border-transparent"
            } else if (isPassed) {
              if (step.status === "REJECTED") {
                badgeStyle = "bg-red-50 text-red-600 border-red-200"
              } else {
                badgeStyle = "bg-blue-50 text-blue-700 border-blue-200"
              }
            }

            return (
              <div key={step.id} className="flex items-center gap-2">
                <span
                  style={isCurrent ? { backgroundColor: navyColor } : {}}
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
            style={!isLocked ? { backgroundColor: navyColor, color: "white" } : {}}
            className={`px-6 py-2.5 font-medium rounded-lg text-sm transition-opacity hover:opacity-90 ${
              isLocked ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""
            }`}
          >
            {isLocked ? "決算データ提出済み" : "決算データを提出する"}
          </Button>

          {!isLocked && flowSteps.length > 3 && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
              ※現在、差し戻し中（修正可能状態）です
            </span>
          )}
          {isLocked && (
            <Button
              variant="outline"
              onClick={handleSimulateReject}
              className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              【デモ】監査人から差し戻しを受ける
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

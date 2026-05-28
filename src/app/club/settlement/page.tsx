"use client"

import { useState, useEffect } from "react"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ClubSettlementPage() {
  const [isLocked, setIsLocked] = useState(false)
  const [auditorInfo, setAuditorInfo] = useState("財務部 山田太郎 様")

  useEffect(() => {
    // 外部ファイルに依存せず、ブラウザのストレージで安全に状態を管理
    try {
      const savedStatus = localStorage.getItem("club_settlement_status_isolated")
      if (savedStatus === "SUBMITTED") {
        setIsLocked(true)
      }
    } catch {
      // エラー時は初期状態を維持
    }
  }, [])

  const handleSubmit = () => {
    if (confirm("決算データを提出しますか？提出後はすべての操作がロックされます。")) {
      localStorage.setItem("club_settlement_status_isolated", "SUBMITTED")
      setIsLocked(true)
      window.location.reload()
    }
  }

  // ネイビーのカラーコード: #001e43 (または blue-950)
  const navyColor = "#001e43"

  return (
    <div className="w-full p-6 space-y-8 text-left bg-white rounded-xl">
      {/* ネイビーの縦ライン */}
      <div className="border-l-4 pl-4" style={{ borderColor: navyColor }}>
        <h1 className="text-2xl font-bold text-gray-900">決算</h1>
        <p className="text-sm text-gray-500 mt-1">
          年度末の決算データの確認と学校への提出を行います。
        </p>
      </div>

      {/* 1. 担当監査人 */}
      <div className="space-y-1">
        <h2 className="text-sm font-medium text-gray-500">担当監査人</h2>
        <p className="text-base font-semibold text-gray-900">{auditorInfo}</p>
      </div>

      {/* 2. 決算ステータス */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-gray-500">決算ステータス</h2>
        <div>
          {isLocked ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-50 text-amber-800 border border-amber-200">
              <Lock className="h-4 w-4" />
              提出済 (編集ロック中)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-800 border border-blue-200">
              作成中
            </span>
          )}
        </div>
      </div>

      {/* 3. 決算データを提出する ボタン */}
      <div className="pt-4 border-t border-gray-100">
        <p className="text-sm text-gray-600 mb-4">
          すべての確認が完了したら、学校管理者へ提出してください。
          <br />
          <span className="text-red-500 font-medium">
            ※提出後は、データの登録・編集・削除が一切できなくなります。
          </span>
        </p>

        <Button
          onClick={handleSubmit}
          disabled={isLocked}
          style={!isLocked ? { backgroundColor: navyColor, color: "white" } : {}}
          className={`px-6 py-2.5 font-medium rounded-lg text-sm transition-colors ${
            isLocked
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "hover:opacity-90"
          }`}
        >
          {isLocked ? "決算データ提出済み" : "決算データを提出する"}
        </Button>
      </div>
    </div>
  )
}

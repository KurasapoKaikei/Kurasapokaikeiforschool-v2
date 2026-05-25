"use client"

import { useCallback, useEffect, useState } from "react"
import { getCurrentOperator } from "@/utils/localStorage"

const FISCAL_YEARS = ["2024年度", "2025年度", "2026年度"] as const

type ClubPortalYearBarProps = {
  selectedYear?: string
  onYearChange?: (year: string) => void
}

/** 年度切替・作業者（クラブポータル共通サブヘッダー） */
export function ClubPortalYearBar({
  selectedYear: controlledYear,
  onYearChange,
}: ClubPortalYearBarProps) {
  const [internalYear, setInternalYear] = useState("2026年度")
  const [operatorLabel, setOperatorLabel] = useState<string | null>(null)

  const selectedYear = controlledYear ?? internalYear
  const setSelectedYear = onYearChange ?? setInternalYear

  const refreshOperator = useCallback(() => {
    setOperatorLabel(getCurrentOperator())
  }, [])

  const operatorDisplay = operatorLabel ?? "未選択"

  useEffect(() => {
    refreshOperator()
    const interval = setInterval(refreshOperator, 500)
    return () => clearInterval(interval)
  }, [refreshOperator])

  return (
    <div className="border-b border-gray-200 bg-white px-6 py-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-xs text-[#6B7280]">年度切替:</span>
          {FISCAL_YEARS.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => setSelectedYear(year)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                selectedYear === year
                  ? "bg-[#E66A84] text-white"
                  : "bg-gray-100 text-[#374151] hover:bg-gray-200"
              }`}
            >
              {year}
            </button>
          ))}
        </div>
        <p className="text-xs text-[#6B7280]" role="status">
          <span>現在の作業者:</span>{" "}
          <span className="font-medium text-[#374151]">
            [{operatorDisplay}]
          </span>
          <span className="ml-1.5 hidden text-[#9CA3AF] sm:inline">
            ※チェックインは今後対応（表示のみ）
          </span>
        </p>
      </div>
    </div>
  )
}

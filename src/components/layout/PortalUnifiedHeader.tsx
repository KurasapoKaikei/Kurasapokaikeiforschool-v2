"use client"

import { useCallback, useLayoutEffect, useState } from "react"
import { LogOut } from "lucide-react"
import { usePortalFiscalYear } from "@/contexts/PortalFiscalYearContext"
import { getSchoolHeaderDisplay } from "@/lib/schoolHeaderDisplay"
import { SCHOOL_SESSION_CHANGED_EVENT } from "@/lib/currentSchool"
import { PORTAL_BRAND, type PortalKind } from "@/lib/portalBrand"
import { cn } from "@/lib/utils"

export type PortalUnifiedHeaderProps = {
  portal: PortalKind
  /** 第2段左：ポータル名（クラブは `{name}ポータル` を渡す） */
  portalTitle: string
  onLogout: () => void
}

/**
 * 3段構造の統一ポータルヘッダー
 * 1. 学校コンテキスト / 2. ポータル・アイデンティティ帯 / 3. 年度切替
 */
export function PortalUnifiedHeader({
  portal,
  portalTitle,
  onLogout,
}: PortalUnifiedHeaderProps) {
  const brandColor = PORTAL_BRAND[portal]
  const { selectedYear, setSelectedYear, fiscalYears } = usePortalFiscalYear()

  const [schoolName, setSchoolName] = useState("")
  const [fiscalPeriod, setFiscalPeriod] = useState("")
  const [hydrated, setHydrated] = useState(false)

  const refreshSchoolContext = useCallback(() => {
    const { schoolName: name, fiscalPeriod: period } = getSchoolHeaderDisplay()
    setSchoolName(name)
    setFiscalPeriod(period)
    setHydrated(true)
  }, [])

  useLayoutEffect(() => {
    refreshSchoolContext()
    window.addEventListener("storage", refreshSchoolContext)
    window.addEventListener(SCHOOL_SESSION_CHANGED_EVENT, refreshSchoolContext)
    return () => {
      window.removeEventListener("storage", refreshSchoolContext)
      window.removeEventListener(SCHOOL_SESSION_CHANGED_EVENT, refreshSchoolContext)
    }
  }, [refreshSchoolContext])

  return (
    <header className="sticky top-0 z-50 shadow-sm">
      {/* 第1段：学校コンテキスト */}
      <div className="border-b border-gray-100 bg-[#FAFAFA] px-6 py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="text-xl font-bold tracking-tight text-[#4B5563]">
            {hydrated ? schoolName : "\u00a0"}
          </span>
          <span className="text-xs text-[#9CA3AF]">
            {hydrated ? fiscalPeriod : "\u00a0"}
          </span>
        </div>
      </div>

      {/* 第2段：ポータル・アイデンティティ帯 */}
      <div style={{ backgroundColor: brandColor }}>
        <div className="flex h-12 items-center justify-between gap-4 px-6">
          <h1 className="truncate text-base font-semibold text-white sm:text-lg">
            {portalTitle}
          </h1>

          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            <span className="hidden whitespace-nowrap text-sm text-white/95 sm:inline">
              会計期間 : {hydrated ? fiscalPeriod : "\u00a0"}
            </span>
            <span className="whitespace-nowrap text-xs text-white/95 sm:hidden">
              {hydrated ? fiscalPeriod : "\u00a0"}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-md border border-white px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
              aria-label="ログアウト"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              <span>ログアウト</span>
            </button>
          </div>
        </div>
      </div>

      {/* 第3段：年度切替 */}
      <div className="border-b border-gray-200 bg-white px-6 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs text-[#6B7280]">年度切替:</span>
          {fiscalYears.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => setSelectedYear(year)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                selectedYear === year
                  ? "text-white shadow-sm"
                  : "bg-gray-100 text-[#374151] hover:bg-gray-200"
              )}
              style={
                selectedYear === year ? { backgroundColor: brandColor } : undefined
              }
            >
              {year}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}

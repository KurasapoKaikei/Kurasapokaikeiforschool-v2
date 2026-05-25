"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import { cn } from "@/lib/utils"
import {
  SCHOOL_FISCAL_YEARS,
  SCHOOL_PAGE_TITLES,
  SCHOOL_ROUTES,
  SCHOOL_THEME,
  type SchoolFiscalYearLabel,
} from "@/lib/schoolTheme"
import {
  BookOpen,
  Building2,
  FileText,
  Mail,
  Plus,
  Users,
} from "lucide-react"

const CURRENT_YEAR: SchoolFiscalYearLabel = "2026年度"

type SummaryCard = {
  title: string
  icon: typeof Users
  href: string
  accent: string
  lines?: string[]
  /** クラブ一覧カードなど：ラベル＋強調数字 */
  metric?: { label: string; value: number | null }
}

export function SchoolMypageView() {
  const { clubs, isLoaded } = useSchoolClubs()
  const [selectedYear, setSelectedYear] = useState<SchoolFiscalYearLabel>(CURRENT_YEAR)
  const isCurrentYear = selectedYear === CURRENT_YEAR

  const registeredClubCount = clubs.length

  const summaryCards: SummaryCard[] = useMemo(
    () => [
      {
        title: SCHOOL_PAGE_TITLES.clubList,
        icon: Users,
        href: SCHOOL_ROUTES.clubList,
        accent: SCHOOL_THEME.navy,
        metric: {
          label: "登録クラブ数",
          value: isLoaded ? registeredClubCount : null,
        },
      },
      {
        title: SCHOOL_PAGE_TITLES.clubRegister,
        icon: Plus,
        href: SCHOOL_ROUTES.clubRegister,
        accent: SCHOOL_THEME.navyLight,
      },
      {
        title: SCHOOL_PAGE_TITLES.messages,
        icon: Mail,
        href: SCHOOL_ROUTES.messages,
        accent: "#2563eb",
      },
      {
        title: SCHOOL_PAGE_TITLES.contract,
        icon: FileText,
        href: SCHOOL_ROUTES.contract,
        accent: "#1e40af",
        lines: [
          "現在のプラン: クラサポ会計 for school スタンダードプラン",
          "次回更新日: 2027.7.31",
        ],
      },
      {
        title: SCHOOL_PAGE_TITLES.guide,
        icon: BookOpen,
        href: SCHOOL_ROUTES.guide,
        accent: SCHOOL_THEME.navyLight,
      },
    ],
    [isLoaded, registeredClubCount]
  )

  return (
    <div className="min-h-full bg-[#F5F5F0]">
      <div className="border-b border-gray-200 bg-white px-6 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-xs text-[#6B7280]">年度切替:</span>
          {SCHOOL_FISCAL_YEARS.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => setSelectedYear(year)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                selectedYear === year
                  ? "bg-blue-950 text-white shadow-sm"
                  : "bg-gray-100 text-[#374151] hover:bg-gray-200"
              )}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6">
        {!isCurrentYear ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-16 text-center shadow-sm">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-400" strokeWidth={1.5} />
            <p className="text-sm font-medium text-[#374151]">
              （過去年度のデータはありません）
            </p>
            <p className="mt-1 text-xs text-[#6B7280]">{selectedYear}の表示はデモでは未対応です</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summaryCards.map((card) => {
              const Icon = card.icon
              return (
                <Link
                  key={card.title}
                  href={card.href}
                  className="group flex flex-col rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
                  style={{ borderLeftWidth: 5, borderLeftColor: card.accent }}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Icon
                      className="h-5 w-5 flex-shrink-0"
                      style={{ color: card.accent, strokeWidth: 2.5 }}
                    />
                    <h3 className="text-lg font-semibold text-indigo-950 group-hover:text-blue-950">
                      {card.title}
                    </h3>
                  </div>
                  {card.metric ? (
                    <div className="mt-auto pt-1">
                      <p className="text-xs font-medium tracking-wide text-[#6B7280]">
                        {card.metric.label}
                      </p>
                      <p
                        className="mt-1 text-4xl font-bold leading-none tabular-nums tracking-tight md:text-5xl"
                        style={{ color: card.accent }}
                        aria-live="polite"
                      >
                        {card.metric.value === null ? "—" : card.metric.value}
                      </p>
                    </div>
                  ) : card.lines && card.lines.length > 0 ? (
                    <ul className="mt-auto space-y-2">
                      {card.lines.map((line) => (
                        <li
                          key={line}
                          className="text-sm text-[#6B7280] leading-relaxed"
                        >
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

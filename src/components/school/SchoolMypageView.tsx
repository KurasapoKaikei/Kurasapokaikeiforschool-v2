"use client"

import Link from "next/link"
import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  SCHOOL_FISCAL_YEARS,
  SCHOOL_PAGE_TITLES,
  SCHOOL_ROUTES,
  SCHOOL_THEME,
  type SchoolFiscalYearLabel,
} from "@/lib/schoolTheme"
import { BookOpen, Building2, FileText, MessageSquare, Users } from "lucide-react"

const CURRENT_YEAR: SchoolFiscalYearLabel = "2026年度"

type SummaryCard = {
  title: string
  icon: typeof Users
  href: string
  accent: string
  lines: string[]
}

const summaryCards: SummaryCard[] = [
  {
    title: "クラブ一覧",
    icon: Users,
    href: SCHOOL_ROUTES.clubList,
    accent: SCHOOL_THEME.navy,
    lines: [
      "登録クラブ数: 0個",
      "（ここからクラブの新規登録やID発行ができます）",
    ],
  },
  {
    title: "契約状況",
    icon: FileText,
    href: SCHOOL_ROUTES.contract,
    accent: "#1e40af",
    lines: [
      "現在のプラン: クラサポ会計 for school スタンダードプラン",
      "次回更新日: 2027.7.31",
    ],
  },
  {
    title: SCHOOL_PAGE_TITLES.messages,
    icon: MessageSquare,
    href: SCHOOL_ROUTES.messages,
    accent: "#2563eb",
    lines: [
      "未読のお知らせ: 0件",
      "（学校全体・各クラブへの通知を一覧で管理）",
    ],
  },
  {
    title: SCHOOL_PAGE_TITLES.guide,
    icon: BookOpen,
    href: SCHOOL_ROUTES.guide,
    accent: SCHOOL_THEME.navyLight,
    lines: [
      "操作ガイド・マニュアル",
      "（5/27デモ用ヘルプページへ一発で遷移できます）",
    ],
  },
]

export function SchoolMypageView() {
  const [selectedYear, setSelectedYear] = useState<SchoolFiscalYearLabel>(CURRENT_YEAR)
  const isCurrentYear = selectedYear === CURRENT_YEAR

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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  <ul className="mt-auto space-y-2">
                    {card.lines.map((line) => (
                      <li key={line} className="text-sm text-[#6B7280] leading-relaxed">
                        {line}
                      </li>
                    ))}
                  </ul>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

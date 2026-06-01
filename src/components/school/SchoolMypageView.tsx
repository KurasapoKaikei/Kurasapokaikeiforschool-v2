"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { SchoolAuditProgressSummary } from "@/components/school/SchoolAuditProgressSummary"
import { usePortalFiscalYear } from "@/contexts/PortalFiscalYearContext"
import { cn } from "@/lib/utils"
import {
  loadSchoolUseAuditFlow,
  SCHOOL_AUDIT_FLOW_CHANGED_EVENT,
} from "@/lib/schoolAuditFlow"
import {
  SCHOOL_PAGE_TITLES,
  SCHOOL_ROUTES,
  SCHOOL_THEME,
} from "@/lib/schoolTheme"
import { DEFAULT_PORTAL_FISCAL_YEAR } from "@/lib/portalBrand"
import {
  BookOpen,
  Building2,
  ClipboardCheck,
  FileText,
  Mail,
  Plus,
  Users,
  type LucideIcon,
} from "lucide-react"

type PortalCard = {
  title: string
  icon: LucideIcon
  href: string
  accent: string
  lines?: string[]
  requiresAuditFlow?: boolean
}

export function SchoolMypageView() {
  const { selectedYear } = usePortalFiscalYear()
  const isCurrentYear = selectedYear === DEFAULT_PORTAL_FISCAL_YEAR
  const [auditFlowEnabled, setAuditFlowEnabled] = useState(true)

  useEffect(() => {
    const sync = () => {
      try {
        setAuditFlowEnabled(loadSchoolUseAuditFlow())
      } catch {
        setAuditFlowEnabled(true)
      }
    }
    sync()
    window.addEventListener(SCHOOL_AUDIT_FLOW_CHANGED_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(SCHOOL_AUDIT_FLOW_CHANGED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  const portalCards: PortalCard[] = useMemo(
    () => [
      {
        title: SCHOOL_PAGE_TITLES.clubList,
        icon: Users,
        href: SCHOOL_ROUTES.clubList,
        accent: SCHOOL_THEME.navy,
        lines: ["全クラブの決算状況の確認、メッセージ、ポータル閲覧"],
      },
      {
        title: SCHOOL_PAGE_TITLES.auditors,
        icon: ClipboardCheck,
        href: SCHOOL_ROUTES.auditors,
        accent: "#ea580c",
        lines: [
          "監査人アカウントの一覧",
          "担当クラブの紐付け状況を俯瞰",
        ],
        requiresAuditFlow: true,
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
    [],
  )

  const visibleCards = portalCards.filter(
    (card) => !card.requiresAuditFlow || auditFlowEnabled,
  )

  return (
    <div className="min-h-full bg-[#F5F5F0]">
      <div className="px-6 py-6">
        {!isCurrentYear ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-16 text-center shadow-sm">
            <Building2
              className="mx-auto mb-3 h-10 w-10 text-slate-400"
              strokeWidth={1.5}
            />
            <p className="text-sm font-medium text-[#374151]">
              （過去年度のデータはありません）
            </p>
            <p className="mt-1 text-xs text-[#6B7280]">
              {selectedYear}の表示はデモでは未対応です
            </p>
          </div>
        ) : (
          <>
            <SchoolAuditProgressSummary />

            <h2 className="mb-3 text-sm font-semibold text-[#6B7280]">
              メインメニュー
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCards.map((card) => {
                const Icon = card.icon
                return (
                  <Link
                    key={card.title}
                    href={card.href}
                    className={cn(
                      "group flex flex-col rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md",
                    )}
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
                    {card.lines && card.lines.length > 0 ? (
                      <ul className="mt-auto space-y-2">
                        {card.lines.map((line) => (
                          <li
                            key={line}
                            className="text-sm leading-relaxed text-[#6B7280]"
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
          </>
        )}
      </div>
    </div>
  )
}

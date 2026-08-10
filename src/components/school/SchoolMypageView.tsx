"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { SchoolAuditPeriodStatusCard } from "@/components/school/SchoolAuditPeriodStatusCard"
import { SchoolAuditProgressSummary } from "@/components/school/SchoolAuditProgressSummary"
import { SchoolContractStatusSummaryCard } from "@/components/school/SchoolContractStatusSummaryCard"
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
  Building2,
  ClipboardCheck,
  Mail,
  Users,
  type LucideIcon,
} from "lucide-react"

type PortalCard = {
  title: string
  icon: LucideIcon
  href: string
  accent: string
  lines?: string[]
}

function PortalMenuCard({
  card,
  className,
}: {
  card: PortalCard
  className?: string
}) {
  const Icon = card.icon
  return (
    <Link
      href={card.href}
      className={cn(
        "group flex min-h-0 flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md",
        className,
      )}
      style={{
        borderLeftWidth: 5,
        borderLeftColor: card.accent,
      }}
    >
      <div className="mb-2 flex shrink-0 items-center gap-2">
        <Icon
          className="h-5 w-5 flex-shrink-0"
          style={{ color: card.accent, strokeWidth: 2.5 }}
        />
        <h3 className="text-lg font-semibold text-indigo-950 group-hover:text-blue-950">
          {card.title}
        </h3>
      </div>
      {card.lines && card.lines.length > 0 ? (
        <ul className="mt-auto space-y-1 overflow-hidden">
          {card.lines.map((line) => (
            <li key={line} className="text-sm leading-relaxed text-[#6B7280]">
              {line}
            </li>
          ))}
        </ul>
      ) : null}
    </Link>
  )
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

  const { auditorCard, clubCard, messagesCard } = useMemo(
    () => ({
      auditorCard: {
        title: SCHOOL_PAGE_TITLES.auditors,
        icon: ClipboardCheck,
        href: SCHOOL_ROUTES.auditors,
        accent: "#ea580c",
        lines: [
          "監査人アカウントの一覧",
          "担当クラブの紐付け状況を俯瞰",
        ],
      } satisfies PortalCard,
      clubCard: {
        title: SCHOOL_PAGE_TITLES.clubList,
        icon: Users,
        href: SCHOOL_ROUTES.clubList,
        accent: SCHOOL_THEME.navy,
        lines: ["全クラブの決算状況の確認、メッセージ、ポータル閲覧"],
      } satisfies PortalCard,
      messagesCard: {
        title: SCHOOL_PAGE_TITLES.messages,
        icon: Mail,
        href: SCHOOL_ROUTES.messages,
        accent: "#2563eb",
        lines: ["学校・クラブ間のメッセージ送受信"],
      } satisfies PortalCard,
    }),
    [],
  )

  const menuCards = useMemo(
    () =>
      [
        ...(auditFlowEnabled ? [auditorCard] : []),
        clubCard,
        messagesCard,
      ] as PortalCard[],
    [auditFlowEnabled, auditorCard, clubCard, messagesCard],
  )

  return (
    <div className="min-h-full bg-[#F5F5F0]">
      <div className="px-6 py-6">
        {!isCurrentYear ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center shadow-sm">
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
            <SchoolAuditPeriodStatusCard
              className="mb-6"
              idleHint="サイドメニュー「監査」で提出区分と期限を設定して通知すると、ここに監査期間中のステータスが表示されます。"
            />
            <SchoolAuditProgressSummary />

            <div className="mt-6 flex flex-col gap-6">
              <h2 className="text-sm font-semibold text-[#6B7280]">
                メインメニュー
              </h2>

              <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
                <div
                  className={cn(
                    "flex min-h-0 flex-col gap-4",
                    menuCards.length === 3
                      ? "lg:grid lg:h-full lg:grid-rows-3"
                      : "lg:grid lg:h-full lg:grid-rows-2",
                  )}
                >
                  {menuCards.map((card) => (
                    <PortalMenuCard
                      key={card.title}
                      card={card}
                      className="h-full min-h-0 lg:min-h-0"
                    />
                  ))}
                </div>

                <aside className="flex min-h-0 flex-col">
                  <SchoolContractStatusSummaryCard />
                </aside>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

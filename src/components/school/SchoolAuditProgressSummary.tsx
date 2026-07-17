"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import { SettlementAuditStatusBadge } from "@/components/school/SettlementAuditStatusBadge"
import {
  CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT,
  CLUB_SETTLEMENT_LOCK_CHANGED_EVENT,
  type AuditorAuditBadgeVariant,
} from "@/lib/clubSettlementPortalSync"
import {
  aggregateSchoolAuditProgress,
  type SchoolAuditProgressCounts,
} from "@/lib/schoolAuditProgressSummary"
import { SETTLEMENT_CHANGED_EVENT } from "@/lib/schoolClubSettlement"
import { cn } from "@/lib/utils"
import { Building2 } from "lucide-react"

type StatCardConfig = {
  key: keyof SchoolAuditProgressCounts
  label: string
  badgeVariant: AuditorAuditBadgeVariant
  cardClass: string
  valueClass: string
  barClass: string
}

const STAT_CARDS: StatCardConfig[] = [
  {
    key: "preparing",
    label: "未提出",
    badgeVariant: "muted",
    cardClass: "border-red-200 bg-red-50",
    valueClass: "text-red-700",
    barClass: "bg-red-500",
  },
  {
    key: "inAudit",
    label: "監査中",
    badgeVariant: "navy",
    cardClass: "border-green-200 bg-green-50",
    valueClass: "text-green-700",
    barClass: "bg-green-600",
  },
  {
    key: "rejected",
    label: "差戻し",
    badgeVariant: "rejected",
    cardClass: "border-amber-200 bg-amber-50",
    valueClass: "text-amber-800",
    barClass: "bg-amber-400",
  },
  {
    key: "approved",
    label: "承認済",
    badgeVariant: "approved",
    cardClass: "border-blue-600/25 bg-blue-50",
    valueClass: "text-blue-700",
    barClass: "bg-blue-600",
  },
]

function ProgressBar({
  value,
  total,
  barClass,
}: {
  value: number
  total: number
  barClass: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div
      className="mt-3 h-1.5 w-full self-stretch overflow-hidden rounded-full bg-black/5"
      role="presentation"
    >
      <div
        className={cn("h-full rounded-full transition-all duration-300", barClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function SchoolAuditProgressSummary() {
  const { clubs, isLoaded } = useSchoolClubs()
  const clubIds = useMemo(() => clubs.map((c) => c.id), [clubs])
  const [refreshKey, setRefreshKey] = useState(0)

  const bump = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    const onChange = () => bump()
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === null ||
        e.key.startsWith("is_club_settlement_locked_") ||
        e.key.startsWith("club_auditor_audit_status_")
      ) {
        bump()
      }
    }
    window.addEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, onChange)
    window.addEventListener(CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT, onChange)
    window.addEventListener(SETTLEMENT_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", onChange)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onChange()
    })
    return () => {
      window.removeEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, onChange)
      window.removeEventListener(CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT, onChange)
      window.removeEventListener(SETTLEMENT_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", onChange)
    }
  }, [bump])

  const summary = useMemo(() => {
    void refreshKey
    return aggregateSchoolAuditProgress(clubIds)
  }, [clubIds, refreshKey])

  const counts = isLoaded ? summary : null
  const barTotal = counts && counts.total > 0 ? counts.total : 1

  return (
    <section
      className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      aria-label="監査進捗サマリー"
    >
      <div className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="text-lg font-semibold text-indigo-950">
            監査進捗サマリー
          </h2>
          <p
            className="ml-auto shrink-0 text-right tabular-nums"
            aria-live="polite"
          >
            <span className="text-sm font-medium text-gray-500">総クラブ数: </span>
            {counts !== null ? (
              <>
                <span className="text-3xl font-extrabold text-gray-800">
                  {counts.total}
                </span>
                <span className="ml-1 text-lg font-semibold text-gray-500">
                  クラブ
                </span>
              </>
            ) : (
              <span className="text-3xl font-extrabold text-gray-800">—</span>
            )}
          </p>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[#6B7280]">
            全クラブの監査ステータス
          </p>
          <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
            <Building2 className="h-3.5 w-3.5" aria-hidden />
            <span aria-live="polite">
              {isLoaded ? "最新" : "読み込み中…"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {STAT_CARDS.map((card) => {
          const value = counts ? counts[card.key] : "—"
          const numeric = typeof value === "number" ? value : 0
          const showBar = counts !== null

          return (
            <div
              key={card.key}
              className={cn(
                "flex w-full flex-col items-start rounded-lg border px-4 py-4 sm:px-5 sm:py-5",
                card.cardClass,
              )}
            >
              <SettlementAuditStatusBadge
                label={card.label}
                variant={card.badgeVariant}
              />

              <p
                className={cn(
                  "mt-3 w-full text-left text-3xl font-extrabold tabular-nums leading-none sm:text-4xl",
                  card.valueClass,
                )}
                aria-label={`${card.label}: ${value}クラブ`}
              >
                {value}
                {isLoaded ? (
                  <span className="ml-1.5 text-lg font-semibold text-[#9CA3AF] sm:text-xl">
                    クラブ
                  </span>
                ) : null}
              </p>

              {showBar ? (
                <ProgressBar
                  value={numeric}
                  total={barTotal}
                  barClass={card.barClass}
                />
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

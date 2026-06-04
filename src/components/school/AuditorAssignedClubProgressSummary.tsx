"use client"

import type { AuditorAssignedClubProgressCounts } from "@/lib/auditorAssignedClubProgress"
import { cn } from "@/lib/utils"

type StatCardConfig = {
  key: keyof Pick<
    AuditorAssignedClubProgressCounts,
    "preparing" | "inAudit" | "approved" | "rejected"
  >
  label: string
  description: string
  cardClass: string
  valueClass: string
  barClass: string
}

const STAT_CARDS: StatCardConfig[] = [
  {
    key: "preparing",
    label: "未提出",
    description: "未提出・ロックなし",
    cardClass: "border-red-200 bg-red-50",
    valueClass: "text-red-700",
    barClass: "bg-red-500",
  },
  {
    key: "inAudit",
    label: "監査中",
    description: "監査中かつ未承認",
    cardClass: "border-green-200 bg-green-50",
    valueClass: "text-green-700",
    barClass: "bg-green-600",
  },
  {
    key: "rejected",
    label: "差戻し",
    description: "監査人差戻し中",
    cardClass: "border-amber-200 bg-amber-50",
    valueClass: "text-amber-800",
    barClass: "bg-amber-400",
  },
  {
    key: "approved",
    label: "承認済",
    description: "監査人承認・完全ロック",
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
      className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/5"
      role="presentation"
    >
      <div
        className={cn("h-full rounded-full transition-all duration-300", barClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

type AuditorAssignedClubProgressSummaryProps = {
  counts: AuditorAssignedClubProgressCounts
}

/** 監査人カード内：担当クラブの4色進捗サマリー（トップページサマリーのミニ版） */
export function AuditorAssignedClubProgressSummary({
  counts,
}: AuditorAssignedClubProgressSummaryProps) {
  const barTotal = counts.total > 0 ? counts.total : 1

  if (counts.total === 0) {
    return (
      <section aria-label="監査進捗サマリー">
        <h4 className="mb-2 text-sm font-semibold text-indigo-950">
          監査進捗サマリー
        </h4>
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-3 py-2.5">
          <p className="text-xs text-[#9CA3AF]">担当クラブ未割当</p>
        </div>
      </section>
    )
  }

  return (
    <section aria-label="監査進捗サマリー">
      <h4 className="mb-2 text-sm font-semibold text-indigo-950">
        監査進捗サマリー
      </h4>
      <div className="grid grid-cols-4 gap-2">
        {STAT_CARDS.map((card) => {
          const value = counts[card.key]
          return (
            <div
              key={card.key}
              className={cn(
                "flex min-w-0 flex-col rounded-lg border px-2 py-2 transition-shadow",
                card.cardClass,
              )}
            >
              <p className="text-[10px] font-medium text-[#6B7280]">{card.label}</p>
              <p
                className={cn(
                  "mt-0.5 text-lg font-bold tabular-nums leading-none",
                  card.valueClass,
                )}
              >
                {value}
                <span className="ml-0.5 text-[10px] font-semibold text-[#9CA3AF]">
                  クラブ
                </span>
              </p>
              <p className="mt-1 text-[9px] leading-snug text-[#9CA3AF]">
                {card.description}
              </p>
              <ProgressBar
                value={value}
                total={barTotal}
                barClass={card.barClass}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}

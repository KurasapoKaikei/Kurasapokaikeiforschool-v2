"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { useClubSettlementLocked } from "@/components/audit/useClubSettlementLocked"
import { getClubMemberCount } from "@/lib/auditorClubDashboard"
import type { SchoolClub } from "@/lib/schoolClubs"
import { cn } from "@/lib/utils"

type AuditorClubDashboardCardProps = {
  club: SchoolClub
  onReview: () => void
}

function DataRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 py-2.5 last:border-0">
      <span className="shrink-0 text-sm text-[#6B7280]">{label}</span>
      <span className="min-w-0 text-right text-sm">{children}</span>
    </div>
  )
}

function StatusBadge({
  label,
  variant,
}: {
  label: string
  variant: "muted" | "navy"
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[3.5rem] justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variant === "navy"
          ? "border-[#001e43]/25 bg-[#E6ECF5] text-[#001e43]"
          : "border-gray-200 bg-gray-100 text-[#6B7280]"
      )}
    >
      {label}
    </span>
  )
}

export function AuditorClubDashboardCard({
  club,
  onReview,
}: AuditorClubDashboardCardProps) {
  const isClubSubmitted = useClubSettlementLocked()
  const canReview = isClubSubmitted
  const memberCount = getClubMemberCount(club?.id ?? "")
  const clubName = club?.name?.trim() || "（名称未設定）"
  const clubId = club?.id ?? "—"

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-md",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-xl"
      )}
    >
      <header className="mb-4 border-b border-orange-100 pb-4">
        <h3 className="text-lg font-bold leading-snug text-[#374151]">
          {clubName}
        </h3>
        <p className="mt-1 font-mono text-xs text-[#9CA3AF]">{clubId}</p>
      </header>

      <div className="flex-1">
        <DataRow label="部員数">
          <span className="font-semibold tabular-nums text-[#374151]">
            {memberCount}名
          </span>
        </DataRow>
        <DataRow label="当期の決算提出状況">
          <StatusBadge
            label={isClubSubmitted ? "提出済" : "未提出"}
            variant={isClubSubmitted ? "navy" : "muted"}
          />
        </DataRow>
        <DataRow label="監査ステータス">
          <StatusBadge
            label={isClubSubmitted ? "監査中" : "未着手"}
            variant={isClubSubmitted ? "navy" : "muted"}
          />
        </DataRow>
      </div>

      <div className="mt-5 border-t border-gray-100 pt-4">
        <Button
          type="button"
          disabled={!canReview}
          className={cn(
            "h-11 w-full rounded-lg text-sm font-semibold text-white",
            canReview
              ? "bg-orange-500 hover:bg-orange-600"
              : "cursor-not-allowed bg-orange-500/40 text-white/90"
          )}
          onClick={onReview}
        >
          決算データを確認・承認・差戻し
        </Button>
        <p className="mt-2 text-center text-xs leading-relaxed text-[#9CA3AF]">
          クラブから決算が「提出済」になると、承認・差戻しが可能になります。
        </p>
      </div>
    </article>
  )
}

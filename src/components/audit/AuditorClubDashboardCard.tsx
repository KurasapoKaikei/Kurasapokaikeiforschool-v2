"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { AuditorAuditStatusBadge } from "@/components/school/AuditorAuditStatusBadge"
import { SchoolClubSettlementBadge } from "@/components/school/SchoolClubSettlementBadge"
import {
  auditStatusFromSettlement,
  getClubMemberCount,
  getClubSettlementSubmissionLabel,
} from "@/lib/auditorClubDashboard"
import type { ClubSettlementStatus } from "@/lib/schoolClubSettlement"
import type { SchoolClub } from "@/lib/schoolClubs"
import { cn } from "@/lib/utils"

type AuditorClubDashboardCardProps = {
  club: SchoolClub
  settlementStatus: ClubSettlementStatus
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

export function AuditorClubDashboardCard({
  club,
  settlementStatus,
  onReview,
}: AuditorClubDashboardCardProps) {
  const submissionLabel = getClubSettlementSubmissionLabel(settlementStatus)
  const auditStatus = auditStatusFromSettlement(settlementStatus)
  const canReview = settlementStatus === "submitted"
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
          <span
            className={cn(
              "font-semibold",
              submissionLabel === "提出済"
                ? "text-emerald-600"
                : "text-red-600"
            )}
          >
            {submissionLabel}
          </span>
        </DataRow>
        <DataRow label="決算ワークフロー">
          <SchoolClubSettlementBadge status={settlementStatus} />
        </DataRow>
        <DataRow label="監査ステータス">
          <AuditorAuditStatusBadge status={auditStatus} />
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

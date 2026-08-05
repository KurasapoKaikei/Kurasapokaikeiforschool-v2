"use client"

import type { ReactNode } from "react"
import { useAuditorSettlementState } from "@/components/audit/useAuditorSettlementState"
import { SettlementAuditStatusBadge } from "@/components/school/SettlementAuditStatusBadge"
import {
  AUDITOR_APPROVED_CARD_CLASSES,
  type AuditorAuditBadgeVariant,
} from "@/lib/clubSettlementPortalSync"
import { useClubMemberCount } from "@/hooks/useClubMemberCount"
import type { SchoolClub } from "@/lib/schoolClubs"
import { cn } from "@/lib/utils"

type SchoolUnassignedClubDashboardCardProps = {
  club: SchoolClub
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

/** 監査人未割当クラブのダッシュボードカード */
export function SchoolUnassignedClubDashboardCard({
  club,
}: SchoolUnassignedClubDashboardCardProps) {
  const { auditLabel, auditBadgeVariant, isApproved } = useAuditorSettlementState(
    club?.id ?? "",
  )
  const memberCount = useClubMemberCount(club?.id ?? "")
  const clubName = club?.name?.trim() || "（名称未設定）"
  const clubId = club?.id ?? "—"

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-xl border border-dashed border-amber-200 p-5 shadow-md",
        isApproved ? AUDITOR_APPROVED_CARD_CLASSES : "bg-white",
        !isApproved &&
          "transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-xl",
      )}
    >
      <header className="mb-4 border-b border-amber-100 pb-4">
        <h3 className="text-lg font-bold leading-snug text-[#374151]">
          {clubName}
        </h3>
        <p className="mt-1 font-mono text-xs text-[#9CA3AF]">{clubId}</p>
      </header>

      <div
        className="mb-4 rounded-lg border border-gray-200 bg-[#FAFAF8] px-4 py-3.5"
        aria-label={`監査ステータス: ${auditLabel}`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-[#374151]">
            監査ステータス
          </span>
          <SettlementAuditStatusBadge
            label={auditLabel}
            variant={auditBadgeVariant as AuditorAuditBadgeVariant}
          />
        </div>
      </div>

      <div className="flex-1">
        <DataRow label="担当監査人">
          <span className="inline-flex min-w-[3.5rem] justify-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            未割当
          </span>
        </DataRow>
        <DataRow label="役職">
          <span className="font-medium text-[#374151]">
            {club?.managerTitle?.trim() || "—"}
          </span>
        </DataRow>
        <DataRow label="氏名">
          <span className="font-medium text-[#374151]">
            {club?.managerName?.trim() || "—"}
          </span>
        </DataRow>
        <DataRow label="部員数">
          <span className="font-semibold tabular-nums text-[#374151]">
            {memberCount}名
          </span>
        </DataRow>
      </div>

      <p className="mt-4 border-t border-gray-100 pt-3 text-xs leading-relaxed text-[#9CA3AF]">
        監査人登録画面から担当監査人を割り当ててください。
      </p>
    </article>
  )
}

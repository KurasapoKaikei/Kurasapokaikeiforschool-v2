"use client"

import type { ReactNode } from "react"
import { useAuditorSettlementState } from "@/components/audit/useAuditorSettlementState"
import {
  AUDITOR_APPROVED_BADGE_CLASSES,
  AUDITOR_APPROVED_CARD_CLASSES,
  SETTLEMENT_IN_AUDIT_BADGE_CLASSES,
  SETTLEMENT_NOT_SUBMITTED_BADGE_CLASSES,
  SETTLEMENT_REJECTED_BADGE_CLASSES,
  type AuditorAuditBadgeVariant,
} from "@/lib/clubSettlementPortalSync"
import { getClubMemberCount } from "@/lib/auditorClubDashboard"
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

function StatusBadge({
  label,
  variant,
}: {
  label: string
  variant: "muted" | "navy" | "rejected" | "approved" | "unassigned"
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[3.5rem] justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variant === "navy" && SETTLEMENT_IN_AUDIT_BADGE_CLASSES,
        variant === "approved" && AUDITOR_APPROVED_BADGE_CLASSES,
        variant === "rejected" && SETTLEMENT_REJECTED_BADGE_CLASSES,
        variant === "muted" && SETTLEMENT_NOT_SUBMITTED_BADGE_CLASSES,
        variant === "unassigned" &&
          "border-amber-200 bg-amber-50 text-amber-800"
      )}
    >
      {label}
    </span>
  )
}

/** 監査人未割当クラブのダッシュボードカード */
export function SchoolUnassignedClubDashboardCard({
  club,
}: SchoolUnassignedClubDashboardCardProps) {
  const {
    isClubSubmitted,
    auditLabel,
    auditBadgeVariant,
    isApproved,
  } = useAuditorSettlementState(club?.id ?? "")
  const memberCount = getClubMemberCount(club?.id ?? "")
  const clubName = club?.name?.trim() || "（名称未設定）"
  const clubId = club?.id ?? "—"

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-xl border border-dashed border-amber-200 p-5 shadow-md",
        isApproved ? AUDITOR_APPROVED_CARD_CLASSES : "bg-white",
        !isApproved &&
          "transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-xl"
      )}
    >
      <header className="mb-4 border-b border-amber-100 pb-4">
        <h3 className="text-lg font-bold leading-snug text-[#374151]">
          {clubName}
        </h3>
        <p className="mt-1 font-mono text-xs text-[#9CA3AF]">{clubId}</p>
      </header>

      <div className="flex-1">
        <DataRow label="担当監査人">
          <StatusBadge label="未割当" variant="unassigned" />
        </DataRow>
        <DataRow label="部員数">
          <span className="font-semibold tabular-nums text-[#374151]">
            {memberCount}名
          </span>
        </DataRow>
        <DataRow label="当期の決算提出状況">
          <StatusBadge
            label={isClubSubmitted ? "監査中" : "未提出"}
            variant={isClubSubmitted ? "navy" : "muted"}
          />
        </DataRow>
        <DataRow label="監査ステータス">
          <StatusBadge
            label={auditLabel}
            variant={auditBadgeVariant as AuditorAuditBadgeVariant}
          />
        </DataRow>
      </div>

      <p className="mt-4 border-t border-gray-100 pt-3 text-xs leading-relaxed text-[#9CA3AF]">
        監査人登録画面から担当監査人を割り当ててください。
      </p>
    </article>
  )
}

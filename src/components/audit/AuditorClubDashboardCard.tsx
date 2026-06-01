"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useAuditorSettlementState } from "@/components/audit/useAuditorSettlementState"
import type { AuditorAuditBadgeVariant } from "@/lib/clubSettlementPortalSync"
import { getClubMemberCount } from "@/lib/auditorClubDashboard"
import { clearCurrentClub } from "@/lib/clubLoginSession"
import type { SchoolClub } from "@/lib/schoolClubs"
import { setImpersonatedClub } from "@/lib/schoolClubSession"
import { CLUB_BRAND_PINK, CLUB_PORTAL_DASHBOARD } from "@/lib/schoolTheme"
import { cn } from "@/lib/utils"

type AuditorClubDashboardCardProps = {
  club: SchoolClub
  onApprove: () => void
  onReject: () => void
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
  variant: "muted" | "navy" | "rejected" | "approved"
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[3.5rem] justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variant === "navy" &&
          "border-[#001e43]/25 bg-[#E6ECF5] text-[#001e43]",
        variant === "approved" &&
          "border-[#001e43]/25 bg-[#E6ECF5] text-[#001e43]",
        variant === "rejected" &&
          "border-amber-200 bg-amber-100 text-amber-800",
        variant === "muted" && "border-gray-200 bg-gray-100 text-[#6B7280]"
      )}
    >
      {label}
    </span>
  )
}

export function AuditorClubDashboardCard({
  club,
  onApprove,
  onReject,
}: AuditorClubDashboardCardProps) {
  const router = useRouter()
  const {
    isClubSubmitted,
    auditLabel,
    auditBadgeVariant,
    canReview,
    isApproved,
  } = useAuditorSettlementState(club?.id ?? "")
  const memberCount = getClubMemberCount(club?.id ?? "")
  const clubName = club?.name?.trim() || "（名称未設定）"
  const clubId = club?.id ?? "—"

  const handleNavigateToClub = () => {
    if (!club?.id) return
    clearCurrentClub()
    setImpersonatedClub({ id: club.id, name: clubName, viewer: "auditor" })
    router.push(CLUB_PORTAL_DASHBOARD)
  }

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-xl border border-gray-200 p-5 shadow-md",
        isApproved ? "bg-gray-50" : "bg-white",
        !isApproved &&
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
            label={auditLabel}
            variant={auditBadgeVariant as AuditorAuditBadgeVariant}
          />
        </DataRow>
      </div>

      <div className="mt-5 border-t border-gray-100 pt-4">
        <div className="flex gap-2">
          <Button
            type="button"
            className="h-11 min-w-0 flex-[2] rounded-lg border-0 text-sm font-semibold text-white shadow-none hover:opacity-90"
            style={{ backgroundColor: CLUB_BRAND_PINK }}
            onClick={handleNavigateToClub}
          >
            クラブページへ
          </Button>
          <Button
            type="button"
            disabled={!canReview}
            className={cn(
              "h-11 min-w-0 flex-1 rounded-lg text-sm font-semibold text-white",
              canReview
                ? "bg-blue-600 hover:bg-blue-700"
                : "cursor-not-allowed bg-blue-600/40 text-white/90"
            )}
            onClick={onApprove}
          >
            承認
          </Button>
          <Button
            type="button"
            disabled={!canReview}
            className={cn(
              "h-11 min-w-0 flex-1 rounded-lg border text-sm font-semibold",
              canReview
                ? "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200"
                : "cursor-not-allowed border-amber-200/60 bg-amber-50 text-amber-800/50"
            )}
            onClick={onReject}
          >
            差戻
          </Button>
        </div>
        <p className="mt-2 text-center text-xs leading-relaxed text-[#9CA3AF]">
          クラブから決算が「提出済」になると、承認・差戻しが可能になります。
        </p>
      </div>
    </article>
  )
}

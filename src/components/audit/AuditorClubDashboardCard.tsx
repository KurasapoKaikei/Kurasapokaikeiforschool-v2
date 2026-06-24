"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useAuditorSettlementState } from "@/components/audit/useAuditorSettlementState"
import { SettlementAuditStatusBadge } from "@/components/school/SettlementAuditStatusBadge"
import {
  AUDITOR_APPROVED_CARD_CLASSES,
  type AuditorAuditBadgeVariant,
} from "@/lib/clubSettlementPortalSync"
import { useClubMemberCount } from "@/hooks/useClubMemberCount"
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

export function AuditorClubDashboardCard({
  club,
  onApprove,
  onReject,
}: AuditorClubDashboardCardProps) {
  const router = useRouter()
  const {
    auditLabel,
    auditBadgeVariant,
    canReview,
    isApproved,
  } = useAuditorSettlementState(club?.id ?? "")
  const memberCount = useClubMemberCount(club?.id ?? "")
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
        isApproved ? AUDITOR_APPROVED_CARD_CLASSES : "bg-white",
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
        <DataRow label="部員数">
          <span className="font-semibold tabular-nums text-[#374151]">
            {memberCount}名
          </span>
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
          クラブから決算が「監査中」になると、承認・差戻しが可能になります。
        </p>
      </div>
    </article>
  )
}

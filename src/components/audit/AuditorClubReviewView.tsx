"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useAuditorSettlementState } from "@/components/audit/useAuditorSettlementState"
import { SchoolSettlementReviewDialog } from "@/components/school/SchoolSettlementReviewDialog"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import { useClubMemberCount } from "@/hooks/useClubMemberCount"
import { clearCurrentClub } from "@/lib/clubLoginSession"
import {
  AUDITOR_APPROVED_BADGE_CLASSES,
  AUDITOR_APPROVED_CARD_CLASSES,
  SETTLEMENT_IN_AUDIT_BADGE_CLASSES,
  SETTLEMENT_NOT_SUBMITTED_BADGE_CLASSES,
  SETTLEMENT_REJECTED_BADGE_CLASSES,
} from "@/lib/clubSettlementPortalSync"
import { cn } from "@/lib/utils"
import { loadCurrentAuditor } from "@/lib/currentAuditor"
import { AUDIT_ROUTES } from "@/lib/auditorTheme"
import { setImpersonatedClub } from "@/lib/schoolClubSession"
import { CLUB_BRAND_PINK, CLUB_PORTAL_DASHBOARD } from "@/lib/schoolTheme"

type AuditorClubReviewViewProps = {
  clubId: string
}

export function AuditorClubReviewView({ clubId }: AuditorClubReviewViewProps) {
  const router = useRouter()
  const { sortedClubs, isLoaded } = useSchoolClubs()
  const [reviewMode, setReviewMode] = useState<"approve" | "reject" | null>(
    null
  )
  const {
    isClubSubmitted,
    auditLabel,
    auditBadgeVariant,
    canReview,
    isApproved,
  } = useAuditorSettlementState(clubId)
  const memberCount = useClubMemberCount(clubId)

  const session = loadCurrentAuditor()
  const club = sortedClubs.find((c) => c.id === clubId)
  const isAssigned = session?.assignedClubIds.includes(clubId) ?? false

  if (!session) {
    return (
      <div className="px-6 py-8 text-sm text-[#6B7280]">
        ログイン情報がありません。
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="px-6 py-8 text-sm text-[#9CA3AF]">読み込み中…</div>
    )
  }

  if (!club || !isAssigned) {
    return (
      <div className="mx-6 my-8 max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-[#374151]">
          このクラブは担当外のため表示できません。
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={AUDIT_ROUTES.home}>ポータルトップへ戻る</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-full px-6 py-8">
      <SchoolSettlementReviewDialog
        clubId={club.id}
        clubName={club.name}
        mode={reviewMode ?? "approve"}
        reviewSource="auditor"
        open={reviewMode != null}
        onClose={() => setReviewMode(null)}
      />
      <div className="mb-4">
        <Button asChild variant="outline" size="sm">
          <Link href={AUDIT_ROUTES.home}>← ポータルトップへ戻る</Link>
        </Button>
      </div>
      <div
        className={cn(
          "max-w-2xl rounded-lg border border-gray-200 p-6 shadow-sm",
          isApproved ? AUDITOR_APPROVED_CARD_CLASSES : "bg-white"
        )}
      >
        <h2 className="text-xl font-semibold text-[#374151]">{club.name}</h2>
        <p className="mt-1 text-sm text-[#6B7280]">クラブID: {club.id}</p>
        <dl className="mt-6 space-y-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <dt className="text-[#6B7280]">部員数</dt>
            <dd className="font-medium tabular-nums text-[#374151]">
              {memberCount}名
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <dt className="text-[#6B7280]">当期の決算提出状況</dt>
            <dd>
              <span
                className={cn(
                  "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  isClubSubmitted
                    ? SETTLEMENT_IN_AUDIT_BADGE_CLASSES
                    : SETTLEMENT_NOT_SUBMITTED_BADGE_CLASSES
                )}
              >
                {isClubSubmitted ? "監査中" : "未提出"}
              </span>
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-[#6B7280]">監査ステータス</dt>
            <dd>
              <span
                className={cn(
                  "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  auditBadgeVariant === "navy" && SETTLEMENT_IN_AUDIT_BADGE_CLASSES,
                  auditBadgeVariant === "approved" && AUDITOR_APPROVED_BADGE_CLASSES,
                  auditBadgeVariant === "rejected" && SETTLEMENT_REJECTED_BADGE_CLASSES,
                  auditBadgeVariant === "muted" && SETTLEMENT_NOT_SUBMITTED_BADGE_CLASSES
                )}
              >
                {auditLabel}
              </span>
            </dd>
          </div>
        </dl>
        <div className="mt-8">
          <div className="flex gap-2">
            <Button
              type="button"
              className="h-11 min-w-0 flex-[2] rounded-lg border-0 text-sm font-semibold text-white shadow-none hover:opacity-90"
              style={{ backgroundColor: CLUB_BRAND_PINK }}
              onClick={() => {
                clearCurrentClub()
                setImpersonatedClub({ id: club.id, name: club.name, viewer: "auditor" })
                router.push(CLUB_PORTAL_DASHBOARD)
              }}
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
              onClick={() => setReviewMode("approve")}
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
              onClick={() => setReviewMode("reject")}
            >
              差戻
            </Button>
          </div>
          {!canReview ? (
            <p className="mt-2 text-xs text-[#6B7280]">
              クラブ責任者が部内承認し「監査中」になると、承認・差戻しが可能になります。
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

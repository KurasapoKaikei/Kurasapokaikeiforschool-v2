"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useClubSettlementLocked } from "@/components/audit/useClubSettlementLocked"
import { SchoolSettlementReviewDialog } from "@/components/school/SchoolSettlementReviewDialog"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import { getClubMemberCount } from "@/lib/auditorClubDashboard"
import { cn } from "@/lib/utils"
import { loadCurrentAuditor } from "@/lib/currentAuditor"
import { AUDIT_BRAND_ORANGE, AUDIT_ROUTES } from "@/lib/auditorTheme"

type AuditorClubReviewViewProps = {
  clubId: string
}

export function AuditorClubReviewView({ clubId }: AuditorClubReviewViewProps) {
  const { sortedClubs, isLoaded } = useSchoolClubs()
  const [reviewOpen, setReviewOpen] = useState(false)
  const isClubSubmitted = useClubSettlementLocked()

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
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
      />
      <div className="mb-4">
        <Button asChild variant="outline" size="sm">
          <Link href={AUDIT_ROUTES.home}>← ポータルトップへ戻る</Link>
        </Button>
      </div>
      <div className="max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-[#374151]">{club.name}</h2>
        <p className="mt-1 text-sm text-[#6B7280]">クラブID: {club.id}</p>
        <dl className="mt-6 space-y-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <dt className="text-[#6B7280]">部員数</dt>
            <dd className="font-medium tabular-nums text-[#374151]">
              {getClubMemberCount(club.id)}名
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <dt className="text-[#6B7280]">当期の決算提出状況</dt>
            <dd>
              <span
                className={cn(
                  "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  isClubSubmitted
                    ? "border-[#001e43]/25 bg-[#E6ECF5] text-[#001e43]"
                    : "border-gray-200 bg-gray-100 text-[#6B7280]"
                )}
              >
                {isClubSubmitted ? "提出済" : "未提出"}
              </span>
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-[#6B7280]">監査ステータス</dt>
            <dd>
              <span
                className={cn(
                  "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  isClubSubmitted
                    ? "border-[#001e43]/25 bg-[#E6ECF5] text-[#001e43]"
                    : "border-gray-200 bg-gray-100 text-[#6B7280]"
                )}
              >
                {isClubSubmitted ? "監査中" : "未着手"}
              </span>
            </dd>
          </div>
        </dl>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            type="button"
            className="rounded-lg text-white hover:opacity-90"
            style={{ backgroundColor: AUDIT_BRAND_ORANGE }}
            onClick={() => setReviewOpen(true)}
            disabled={!isClubSubmitted}
          >
            決算データを確認・承認・差戻し
          </Button>
          {!isClubSubmitted ? (
            <p className="w-full text-xs text-[#6B7280]">
              クラブから決算が「提出済」になると、承認・差戻しが可能になります。
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

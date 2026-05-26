"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { AuditorAuditStatusBadge } from "@/components/school/AuditorAuditStatusBadge"
import { SchoolClubSettlementBadge } from "@/components/school/SchoolClubSettlementBadge"
import { SchoolSettlementReviewDialog } from "@/components/school/SchoolSettlementReviewDialog"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import {
  auditStatusFromSettlement,
  getClubMemberCount,
  getClubSettlementSubmissionLabel,
} from "@/lib/auditorClubDashboard"
import { loadCurrentAuditor } from "@/lib/currentAuditor"
import {
  getClubSettlementStatus,
  SETTLEMENT_CHANGED_EVENT,
} from "@/lib/schoolClubSettlement"
import { AUDIT_BRAND_ORANGE, AUDIT_ROUTES } from "@/lib/auditorTheme"

type AuditorClubReviewViewProps = {
  clubId: string
}

export function AuditorClubReviewView({ clubId }: AuditorClubReviewViewProps) {
  const { sortedClubs, isLoaded } = useSchoolClubs()
  const [reviewOpen, setReviewOpen] = useState(false)
  const [status, setStatus] = useState(getClubSettlementStatus(clubId))

  const session = loadCurrentAuditor()
  const club = sortedClubs.find((c) => c.id === clubId)
  const isAssigned = session?.assignedClubIds.includes(clubId) ?? false

  useEffect(() => {
    const sync = () => setStatus(getClubSettlementStatus(clubId))
    sync()
    window.addEventListener(SETTLEMENT_CHANGED_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(SETTLEMENT_CHANGED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [clubId])

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

  const auditStatus = auditStatusFromSettlement(status)

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
            <dd className="font-medium text-[#374151]">
              {getClubSettlementSubmissionLabel(status)}
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <dt className="text-[#6B7280]">決算ワークフロー</dt>
            <dd>
              <SchoolClubSettlementBadge status={status} />
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-[#6B7280]">監査ステータス</dt>
            <dd>
              <AuditorAuditStatusBadge status={auditStatus} />
            </dd>
          </div>
        </dl>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            type="button"
            className="rounded-lg text-white hover:opacity-90"
            style={{ backgroundColor: AUDIT_BRAND_ORANGE }}
            onClick={() => setReviewOpen(true)}
            disabled={status !== "submitted"}
          >
            決算データを確認・承認・差戻し
          </Button>
          {status !== "submitted" ? (
            <p className="w-full text-xs text-[#6B7280]">
              クラブから決算が「提出済」になると、承認・差戻しが可能になります。
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

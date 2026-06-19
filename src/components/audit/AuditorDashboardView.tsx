"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AuditorAuditProgressSummary } from "@/components/audit/AuditorAuditProgressSummary"
import { SchoolSettlementReviewDialog } from "@/components/school/SchoolSettlementReviewDialog"
import { AuditorClubDashboardCard } from "@/components/audit/AuditorClubDashboardCard"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import {
  AUDITOR_SESSION_CHANGED_EVENT,
  loadCurrentAuditor,
  type CurrentAuditorSession,
} from "@/lib/currentAuditor"
import {
  getSchoolAuditorById,
  SCHOOL_AUDITORS_CHANGED_EVENT,
} from "@/lib/schoolAuditors"

export function AuditorDashboardView() {
  const { sortedClubs, isLoaded: clubsLoaded } = useSchoolClubs()
  const [session, setSession] = useState<CurrentAuditorSession | null>(null)
  const [auditorsRevision, setAuditorsRevision] = useState(0)
  const [reviewClub, setReviewClub] = useState<{
    id: string
    name: string
    mode: "approve" | "reject"
  } | null>(null)

  const refreshSession = useCallback(() => {
    setSession(loadCurrentAuditor())
  }, [])

  useEffect(() => {
    refreshSession()
    const onSession = () => refreshSession()
    const onAuditorsChanged = () => setAuditorsRevision((k) => k + 1)
    window.addEventListener(AUDITOR_SESSION_CHANGED_EVENT, onSession)
    window.addEventListener(SCHOOL_AUDITORS_CHANGED_EVENT, onAuditorsChanged)
    window.addEventListener("storage", onSession)
    window.addEventListener("storage", onAuditorsChanged)
    return () => {
      window.removeEventListener(AUDITOR_SESSION_CHANGED_EVENT, onSession)
      window.removeEventListener(SCHOOL_AUDITORS_CHANGED_EVENT, onAuditorsChanged)
      window.removeEventListener("storage", onSession)
      window.removeEventListener("storage", onAuditorsChanged)
    }
  }, [refreshSession])

  const clubList = sortedClubs ?? []

  const assignedClubIds = useMemo(() => {
    void auditorsRevision
    if (!session?.id) return session?.assignedClubIds ?? []
    return (
      getSchoolAuditorById(session.id)?.assignedClubIds ??
      session.assignedClubIds ??
      []
    )
  }, [session, auditorsRevision])

  const assignedClubs = useMemo(() => {
    if (assignedClubIds.length === 0) return []
    const byId = new Map(clubList.map((c) => [c.id, c]))
    return assignedClubIds
      .map((id) => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c?.id))
  }, [assignedClubIds, clubList])

  const auditorMaster = session?.id
    ? getSchoolAuditorById(session.id)
    : null
  const department =
    auditorMaster?.department?.trim() ||
    session?.department?.trim() ||
    "—"

  if (!session) {
    return (
      <div className="px-6 py-8">
        <p className="text-sm text-[#6B7280]">ログイン情報を読み込み中…</p>
      </div>
    )
  }

  const displayName = session.name ?? "監査人"
  const displayId = session.id ?? "—"

  return (
    <div className="min-h-full w-full max-w-none px-6 py-8">
      {reviewClub ? (
        <SchoolSettlementReviewDialog
          clubId={reviewClub.id}
          clubName={reviewClub.name}
          mode={reviewClub.mode}
          reviewSource="auditor"
          open
          onClose={() => setReviewClub(null)}
        />
      ) : null}

      <div className="mb-8 rounded-xl border border-orange-200 bg-orange-50 px-5 py-4 shadow-sm">
        <p className="text-base font-medium text-[#374151]">
          <span className="text-orange-700">{displayName}</span>
          <span className="mx-1">様</span>
          <span className="text-sm font-normal text-[#6B7280]">
            （{department}）
          </span>
          <span className="text-sm font-normal text-[#6B7280]">
            としてログイン中
          </span>
        </p>
        <p className="mt-1 text-xs text-[#6B7280]">
          監査人ID: {displayId} ／ 担当クラブ {assignedClubs.length}件
        </p>
      </div>

      <AuditorAuditProgressSummary />

      {!clubsLoaded ? (
        <p className="py-16 text-center text-sm text-[#9CA3AF]">読み込み中…</p>
      ) : assignedClubs.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <p className="text-sm text-[#6B7280]">
            担当クラブが割り当てられていません。学校管理者にお問い合わせください。
          </p>
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {(assignedClubs ?? []).map((club) => {
            if (!club?.id) return null
            return (
              <AuditorClubDashboardCard
                key={club.id}
                club={club}
                onApprove={() =>
                  setReviewClub({
                    id: club.id,
                    name: club.name ?? club.id,
                    mode: "approve",
                  })
                }
                onReject={() =>
                  setReviewClub({
                    id: club.id,
                    name: club.name ?? club.id,
                    mode: "reject",
                  })
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export default AuditorDashboardView

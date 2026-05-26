"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { SchoolSettlementReviewDialog } from "@/components/school/SchoolSettlementReviewDialog"
import { AuditorClubDashboardCard } from "@/components/audit/AuditorClubDashboardCard"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import {
  AUDITOR_SESSION_CHANGED_EVENT,
  loadCurrentAuditor,
  type CurrentAuditorSession,
} from "@/lib/currentAuditor"
import { getSchoolAuditorById } from "@/lib/schoolAuditors"
import {
  ensureClubSettlementStatuses,
  getClubSettlementStatus,
  SETTLEMENT_CHANGED_EVENT,
} from "@/lib/schoolClubSettlement"
import { SCHOOL_AUDITORS_CHANGED_EVENT } from "@/lib/schoolAuditors"

export function AuditorDashboardView() {
  const { sortedClubs, isLoaded: clubsLoaded } = useSchoolClubs()
  const [session, setSession] = useState<CurrentAuditorSession | null>(null)
  const [statusMap, setStatusMap] = useState<
    Record<string, ReturnType<typeof getClubSettlementStatus>>
  >({})
  const [reviewClub, setReviewClub] = useState<{
    id: string
    name: string
  } | null>(null)

  const refreshSession = useCallback(() => {
    setSession(loadCurrentAuditor())
  }, [])

  useEffect(() => {
    refreshSession()
    const onSession = () => refreshSession()
    window.addEventListener(AUDITOR_SESSION_CHANGED_EVENT, onSession)
    window.addEventListener("storage", onSession)
    return () => {
      window.removeEventListener(AUDITOR_SESSION_CHANGED_EVENT, onSession)
      window.removeEventListener("storage", onSession)
    }
  }, [refreshSession])

  const clubList = sortedClubs ?? []

  const assignedClubIds = useMemo(
    () => session?.assignedClubIds ?? [],
    [session]
  )

  const assignedClubs = useMemo(() => {
    if (assignedClubIds.length === 0) return []
    const idSet = new Set(assignedClubIds)
    return clubList.filter((c) => c?.id && idSet.has(c.id))
  }, [assignedClubIds, clubList])

  const syncStatuses = useCallback(() => {
    const clubs = assignedClubs ?? []
    if (clubs.length === 0) {
      setStatusMap({})
      return
    }
    try {
      setStatusMap(ensureClubSettlementStatuses(clubs.map((c) => c.id)))
    } catch {
      setStatusMap({})
    }
  }, [assignedClubs])

  useEffect(() => {
    syncStatuses()
    const onChange = () => syncStatuses()
    window.addEventListener(SETTLEMENT_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    window.addEventListener(SCHOOL_AUDITORS_CHANGED_EVENT, onChange)
    return () => {
      window.removeEventListener(SETTLEMENT_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
      window.removeEventListener(SCHOOL_AUDITORS_CHANGED_EVENT, onChange)
    }
  }, [syncStatuses])

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
          open
          onClose={() => {
            setReviewClub(null)
            syncStatuses()
          }}
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
            const settlementStatus =
              statusMap[club.id] ?? getClubSettlementStatus(club.id)
            return (
              <AuditorClubDashboardCard
                key={club.id}
                club={club}
                settlementStatus={settlementStatus}
                onReview={() =>
                  setReviewClub({
                    id: club.id,
                    name: club.name ?? club.id,
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

"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Mail } from "lucide-react"
import { useSchoolClubGroups } from "@/contexts/SchoolClubGroupsContext"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import { SchoolClubSettlementBadge } from "@/components/school/SchoolClubSettlementBadge"
import { SchoolSettlementReviewDialog } from "@/components/school/SchoolSettlementReviewDialog"
import { SchoolPortalSegmentTabs } from "@/components/school/SchoolPortalSegmentTabs"
import {
  ensureClubSettlementStatuses,
  getClubSettlementStatus,
  SETTLEMENT_CHANGED_EVENT,
  type ClubSettlementStatus,
} from "@/lib/schoolClubSettlement"
import { clearCurrentClub } from "@/lib/clubLoginSession"
import { setImpersonatedClub } from "@/lib/schoolClubSession"
import {
  CLUB_BRAND_PINK,
  CLUB_PORTAL_DASHBOARD,
  schoolClubMessagesPath,
} from "@/lib/schoolTheme"

/** 順序｜クラブ名｜所属グループ｜決算状況｜アクション */
const DASHBOARD_GRID =
  "sm:[grid-template-columns:minmax(2.5rem,0.35fr)_minmax(0,1.75fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(8.5rem,auto)]"

/** クラブ一覧：監視ダッシュボード用テーブル */
export function SchoolClubDashboardListSection() {
  const router = useRouter()
  const { sortedGroups, isLoaded: groupsLoaded } = useSchoolClubGroups()
  const { sortedClubs, isLoaded: clubsLoaded } = useSchoolClubs()
  const [activeTab, setActiveTab] = useState<string>("all")
  const [statusMap, setStatusMap] = useState<Record<string, ClubSettlementStatus>>(
    {}
  )
  const [reviewClub, setReviewClub] = useState<{
    id: string
    name: string
  } | null>(null)

  const isLoaded = groupsLoaded && clubsLoaded

  const syncStatuses = () => {
    if (!clubsLoaded || sortedClubs.length === 0) {
      setStatusMap({})
      return
    }
    setStatusMap(ensureClubSettlementStatuses(sortedClubs.map((c) => c.id)))
  }

  useEffect(() => {
    syncStatuses()
    const onChange = () => syncStatuses()
    window.addEventListener(SETTLEMENT_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(SETTLEMENT_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [clubsLoaded, sortedClubs])

  const filteredClubs = useMemo(() => {
    if (activeTab === "all") return sortedClubs
    return sortedClubs.filter((c) => c.groupIds.includes(activeTab))
  }, [sortedClubs, activeTab])

  const handlePortal = (club: { id: string; name: string }) => {
    clearCurrentClub()
    setImpersonatedClub({ id: club.id, name: club.name, viewer: "school" })
    router.push(CLUB_PORTAL_DASHBOARD)
  }

  return (
    <>
    <div className="w-full max-w-none rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <SchoolPortalSegmentTabs
          ariaLabel="グループ"
          tabs={[
            { id: "all", label: "すべて" },
            ...sortedGroups.map((group) => ({
              id: group.id,
              label: group.name,
            })),
          ]}
          activeId={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {!isLoaded ? (
        <p className="py-12 text-center text-sm text-[#9CA3AF]">読み込み中...</p>
      ) : filteredClubs.length === 0 ? (
        <p className="py-12 text-center text-sm text-[#6B7280]">
          {activeTab === "all"
            ? "登録されたクラブはありません。「クラブ登録」から追加してください。"
            : "このグループに登録されたクラブはありません。"}
        </p>
      ) : (
        <>
          <div
            className={`mb-2 hidden items-center gap-x-2 border-b border-gray-200 pb-2 text-xs font-semibold text-[#6B7280] sm:grid ${DASHBOARD_GRID}`}
          >
            <span className="pl-2 text-left">順序</span>
            <span className="text-left">クラブ名</span>
            <span className="text-left">所属グループ</span>
            <span className="text-left">決算状況</span>
            <span className="pr-4 text-right">アクション</span>
          </div>

          <div className="space-y-2">
            {filteredClubs.map((club, index) => {
              const status =
                statusMap[club.id] ?? getClubSettlementStatus(club.id)
              return (
                <div
                  key={club.id}
                  className="rounded-lg border border-gray-200 transition-colors hover:bg-gray-50/80"
                >
                  <div
                    className={`grid grid-cols-1 gap-3 p-3 sm:items-center sm:gap-x-2 ${DASHBOARD_GRID}`}
                  >
                    <div className="min-w-0 pl-2 text-sm font-medium tabular-nums text-[#374151]">
                      <span className="mb-0.5 block text-xs text-[#6B7280] sm:hidden">
                        順序
                      </span>
                      {index + 1}
                    </div>

                    <div className="min-w-0">
                      <span className="mb-0.5 block text-xs text-[#6B7280] sm:hidden">
                        クラブ名
                      </span>
                      <span className="text-base font-semibold text-[#374151]">
                        {club.name}
                      </span>
                    </div>

                    <div className="min-w-0 text-sm text-[#6B7280]">
                      <span className="mb-0.5 block text-xs text-[#6B7280] sm:hidden">
                        所属グループ
                      </span>
                      {club.groupNames.join("、") || "—"}
                    </div>

                    <div className="min-w-0">
                      <span className="mb-0.5 block text-xs text-[#6B7280] sm:hidden">
                        決算状況
                      </span>
                      <SchoolClubSettlementBadge status={status} />
                    </div>

                    <div className="flex min-w-0 items-center justify-end gap-3 pr-4 max-sm:col-span-full max-sm:border-t max-sm:border-gray-100 max-sm:pt-3">
                      <span className="mr-auto text-xs text-[#6B7280] sm:hidden">
                        アクション
                      </span>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        {status === "submitted" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 shrink-0 text-xs"
                            onClick={() =>
                              setReviewClub({ id: club.id, name: club.name })
                            }
                          >
                            確認・審査
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 shrink-0 p-0"
                          asChild
                          title="メッセージ"
                        >
                          <Link
                            href={schoolClubMessagesPath(club.id)}
                            aria-label={`${club.name}へのメッセージ`}
                          >
                            <Mail className="h-4 w-4 text-[#005088]" />
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 shrink-0 rounded-lg border-0 px-3 text-xs font-medium text-white shadow-none hover:opacity-90"
                          style={{ backgroundColor: CLUB_BRAND_PINK }}
                          onClick={() => handlePortal(club)}
                        >
                          クラブページへ
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
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
    </>
  )
}

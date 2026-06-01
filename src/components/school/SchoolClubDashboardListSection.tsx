"use client"

import { useMemo, useState } from "react"
import { SchoolClubDashboardCard } from "@/components/school/SchoolClubDashboardCard"
import { SchoolPortalSegmentTabs } from "@/components/school/SchoolPortalSegmentTabs"
import { useSchoolClubGroups } from "@/contexts/SchoolClubGroupsContext"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"

/** クラブ一覧：監視ダッシュボード（カード形式） */
export function SchoolClubDashboardListSection() {
  const { sortedGroups, isLoaded: groupsLoaded } = useSchoolClubGroups()
  const { sortedClubs, isLoaded: clubsLoaded } = useSchoolClubs()
  const [activeTab, setActiveTab] = useState<string>("all")

  const isLoaded = groupsLoaded && clubsLoaded

  const filteredClubs = useMemo(() => {
    if (activeTab === "all") return sortedClubs
    return sortedClubs.filter((c) => c.groupIds.includes(activeTab))
  }, [sortedClubs, activeTab])

  return (
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
        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredClubs.map((club) => (
            <SchoolClubDashboardCard key={club.id} club={club} />
          ))}
        </div>
      )}
    </div>
  )
}

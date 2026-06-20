"use client"

import { SchoolClubAuditProgressSummaryCard } from "@/components/school/SchoolClubAuditProgressSummaryCard"
import type { SchoolClub } from "@/lib/schoolClubs"

type SchoolUnassignedClubDashboardCardProps = {
  club: SchoolClub
}

/** 監査人ダッシュボード：未割当クラブ向け監査進捗サマリーカード */
export function SchoolUnassignedClubDashboardCard({
  club,
}: SchoolUnassignedClubDashboardCardProps) {
  return (
    <SchoolClubAuditProgressSummaryCard
      club={club}
      variant="unassigned"
      footerNote="監査人登録画面から担当監査人を割り当ててください。"
    />
  )
}

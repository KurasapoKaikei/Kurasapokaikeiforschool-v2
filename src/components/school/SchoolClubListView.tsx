"use client"

import Link from "next/link"
import { SchoolClubDashboardListSection } from "@/components/school/SchoolClubDashboardListSection"
import { SCHOOL_BRAND_NAVY, SCHOOL_ROUTES } from "@/lib/schoolTheme"
import { Button } from "@/components/ui/button"

/** クラブ一覧：活動・決算状況の監視ダッシュボード */
export function SchoolClubListView() {
  return (
    <div className="min-h-full bg-[#F5F5F0] px-6 py-8">
      <div className="w-full max-w-none">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[#374151]">クラブ一覧</h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              全クラブの決算状況の確認、メッセージ、ポータル閲覧
            </p>
          </div>
          <Button
            asChild
            className="rounded-lg text-white hover:opacity-90"
            style={{ backgroundColor: SCHOOL_BRAND_NAVY }}
          >
            <Link href={SCHOOL_ROUTES.clubRegister}>クラブを登録する</Link>
          </Button>
        </div>
        <SchoolClubDashboardListSection />
      </div>
    </div>
  )
}

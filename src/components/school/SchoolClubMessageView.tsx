"use client"

import Link from "next/link"
import { useMemo } from "react"
import { ArrowLeft } from "lucide-react"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import { SCHOOL_BRAND_NAVY, SCHOOL_ROUTES } from "@/lib/schoolTheme"

type SchoolClubMessageViewProps = {
  clubId: string
}

/** クラブとの個別メッセージ（デモ用プレースホルダ） */
export function SchoolClubMessageView({ clubId }: SchoolClubMessageViewProps) {
  const { sortedClubs, isLoaded } = useSchoolClubs()
  const club = useMemo(
    () => sortedClubs.find((c) => c.id === clubId),
    [sortedClubs, clubId]
  )

  return (
    <div className="min-h-full bg-[#F5F5F0] px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href={SCHOOL_ROUTES.clubList}
          className="mb-4 inline-flex items-center gap-1 text-sm text-[#005088] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          クラブ一覧に戻る
        </Link>

        <div
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
          style={{ borderLeftWidth: 5, borderLeftColor: SCHOOL_BRAND_NAVY }}
        >
          {!isLoaded ? (
            <p className="text-sm text-[#9CA3AF]">読み込み中...</p>
          ) : !club ? (
            <p className="text-sm text-[#6B7280]">
              クラブ（ID: {clubId}）が見つかりません。
            </p>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-[#374151]">
                メッセージ：{club.name}
              </h2>
              <p className="mt-1 font-mono text-xs text-[#6B7280]">{club.id}</p>
              <div className="mt-6 min-h-[240px] rounded-lg border border-dashed border-gray-200 bg-[#F9FAFB] p-6">
                <p className="text-sm text-[#6B7280]">
                  （ここにクラブ「{club.name}」との個別メッセージBOXが入ります。学校管理者とクラブ担当者のやり取りを表示します。）
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

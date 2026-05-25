"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { isSchoolImpersonatingClub } from "@/lib/clubPortalAccess"
import { CLUB_PORTAL_SESSION_CHANGED_EVENT } from "@/lib/clubPortalSessionEvents"
import {
  clearImpersonatedClub,
  getImpersonatedClub,
  type ImpersonatedClub,
} from "@/lib/schoolClubSession"
import { SCHOOL_ROUTES } from "@/lib/schoolTheme"

/** 学校管理者がクラブポータルを閲覧中のバナー（通常のクラブログイン時は非表示） */
export function ClubImpersonationBanner() {
  const [club, setClub] = useState<ImpersonatedClub | null>(null)

  useEffect(() => {
    const refresh = () => {
      setClub(isSchoolImpersonatingClub() ? getImpersonatedClub() : null)
    }
    refresh()
    window.addEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [])

  if (!club) return null

  const handleEnd = () => {
    clearImpersonatedClub()
    setClub(null)
    window.location.href = SCHOOL_ROUTES.clubList
  }

  return (
    <div className="border-b border-[#005088]/30 bg-[#005088]/10 px-6 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#374151]">
        <p>
          <span className="font-medium text-[#005088]">管理者閲覧モード</span>
          <span className="mx-2 text-[#9CA3AF]">|</span>
          クラブ「{club.name}」（{club.id}）のポータルを表示中
        </p>
        <div className="flex items-center gap-3">
          <Link
            href={SCHOOL_ROUTES.clubList}
            className="font-medium text-[#005088] hover:underline"
          >
            クラブ一覧に戻る
          </Link>
          <button
            type="button"
            onClick={handleEnd}
            className="inline-flex items-center gap-1 text-[#6B7280] hover:text-[#374151]"
            aria-label="閲覧モードを終了"
          >
            <X className="h-4 w-4" />
            終了
          </button>
        </div>
      </div>
    </div>
  )
}

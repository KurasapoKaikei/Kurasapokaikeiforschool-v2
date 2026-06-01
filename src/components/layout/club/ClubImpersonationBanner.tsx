"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  isSchoolImpersonatingClub,
  resolveClubPortalDashboardBackHref,
} from "@/lib/clubPortalAccess"
import { CLUB_PORTAL_SESSION_CHANGED_EVENT } from "@/lib/clubPortalSessionEvents"
import {
  getImpersonatedClub,
  type ImpersonatedClub,
} from "@/lib/schoolClubSession"
import { SCHOOL_PAGE_TITLES } from "@/lib/schoolTheme"

/** 学校管理者・監査人がクラブポータルを閲覧中のバナー（通常のクラブログイン時は非表示） */
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

  const isAuditor = club.viewer === "auditor"
  const backHref = resolveClubPortalDashboardBackHref()
  const backLabel = isAuditor
    ? "ダッシュボードへ戻る"
    : `${SCHOOL_PAGE_TITLES.clubList}に戻る`

  return (
    <div
      className={
        isAuditor
          ? "shrink-0 border-b border-orange-200 bg-orange-50 px-6 py-2.5"
          : "shrink-0 border-b border-[#005088]/30 bg-[#005088]/10 px-6 py-2.5"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#374151]">
        <p>
          <span
            className={
              isAuditor
                ? "font-medium text-orange-700"
                : "font-medium text-[#005088]"
            }
          >
            {isAuditor ? "監査人閲覧モード" : "管理者閲覧モード"}
          </span>
          <span className="mx-2 text-[#9CA3AF]">|</span>
          クラブ「{club.name}」（{club.id}）のポータルを表示中
        </p>
        <Link
          href={backHref}
          className={
            isAuditor
              ? "font-medium text-orange-700 hover:underline"
              : "font-medium text-[#005088] hover:underline"
          }
        >
          {backLabel}
        </Link>
      </div>
    </div>
  )
}

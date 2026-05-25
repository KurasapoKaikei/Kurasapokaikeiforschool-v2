"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { useClubSession } from "@/contexts/ClubSessionContext"
import { useUserInfo } from "@/contexts/UserInfoContext"
import { logoutClubSession } from "@/lib/clubLogout"
import { CLUB_BRAND_PINK } from "@/lib/schoolTheme"
import { mockUserInfo } from "@/constants/userInfo"

const FALLBACK_TITLE = "クラブ ポータル"

/** クラブポータル共通ヘッダー（ピンク1行・sticky） */
export function ClubPortalHeader() {
  const router = useRouter()
  const { activeClub, isHydrated } = useClubSession()
  const { userInfo } = useUserInfo()
  const [titleText, setTitleText] = useState(FALLBACK_TITLE)
  const [fiscalPeriod, setFiscalPeriod] = useState(mockUserInfo.fiscalPeriod)

  useEffect(() => {
    if (!isHydrated) return
    const name =
      activeClub?.name ?? userInfo.organizationName ?? mockUserInfo.organizationName
    setTitleText(name ? `${name} ポータル` : FALLBACK_TITLE)
    setFiscalPeriod(userInfo.fiscalPeriod)
  }, [isHydrated, activeClub, userInfo.organizationName, userInfo.fiscalPeriod])

  const handleLogout = () => {
    logoutClubSession()
    router.push("/")
  }

  return (
    <header className="sticky top-0 z-50 shadow-sm" style={{ backgroundColor: CLUB_BRAND_PINK }}>
      <div className="flex h-14 items-center justify-between gap-4 px-6">
        <h1 className="truncate text-lg font-semibold text-white sm:text-xl">
          {titleText}
        </h1>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <span className="hidden whitespace-nowrap text-sm text-white/95 sm:inline">
            会計期間：{fiscalPeriod}
          </span>
          <span className="whitespace-nowrap text-xs text-white/95 sm:hidden">
            {fiscalPeriod}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/90"
            style={{ color: CLUB_BRAND_PINK }}
            aria-label="ログアウト"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            <span>ログアウト</span>
          </button>
        </div>
      </div>
    </header>
  )
}

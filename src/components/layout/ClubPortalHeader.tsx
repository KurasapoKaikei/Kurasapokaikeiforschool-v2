"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PortalUnifiedHeader } from "@/components/layout/PortalUnifiedHeader"
import { useClubSession } from "@/contexts/ClubSessionContext"
import { useUserInfo } from "@/contexts/UserInfoContext"
import { logoutClubSession } from "@/lib/clubLogout"
import { mockUserInfo } from "@/constants/userInfo"

const FALLBACK_PORTAL_TITLE = "クラブポータル"

/** クラブポータル共通ヘッダー（3段・ピンク帯） */
export function ClubPortalHeader() {
  const router = useRouter()
  const { activeClub, isHydrated } = useClubSession()
  const { userInfo } = useUserInfo()
  const [portalTitle, setPortalTitle] = useState(FALLBACK_PORTAL_TITLE)

  useEffect(() => {
    if (!isHydrated) return
    const name =
      activeClub?.name ?? userInfo.organizationName ?? mockUserInfo.organizationName
    setPortalTitle(name ? `${name}ポータル` : FALLBACK_PORTAL_TITLE)
  }, [isHydrated, activeClub, userInfo.organizationName])

  const handleLogout = () => {
    logoutClubSession()
    router.push("/")
  }

  return (
    <PortalUnifiedHeader
      portal="club"
      portalTitle={portalTitle}
      onLogout={handleLogout}
    />
  )
}

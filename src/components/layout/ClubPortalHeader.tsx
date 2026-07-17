"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { PortalUnifiedHeader } from "@/components/layout/PortalUnifiedHeader"
import { useClubSession } from "@/contexts/ClubSessionContext"
import { useUserInfo } from "@/contexts/UserInfoContext"
import { logoutClubSession } from "@/lib/clubLogout"
import { formatWorkersLabel } from "@/lib/currentWorkersSession"
import { mockUserInfo } from "@/constants/userInfo"

const FALLBACK_PORTAL_TITLE = "クラブ"

/** クラブポータル共通ヘッダー（3段・ピンク帯） */
export function ClubPortalHeader() {
  const router = useRouter()
  const { activeClub, isHydrated } = useClubSession()
  const { userInfo, currentWorkers } = useUserInfo()
  const [portalTitle, setPortalTitle] = useState(FALLBACK_PORTAL_TITLE)

  useEffect(() => {
    if (!isHydrated) return
    const name =
      activeClub?.name ?? userInfo.organizationName ?? mockUserInfo.organizationName
    setPortalTitle(name?.trim() || FALLBACK_PORTAL_TITLE)
  }, [isHydrated, activeClub, userInfo.organizationName])

  const currentWorkerLabel = useMemo(
    () =>
      currentWorkers.length > 0
        ? formatWorkersLabel(currentWorkers)
        : "未選択",
    [currentWorkers]
  )

  const handleLogout = () => {
    logoutClubSession()
    router.push("/")
  }

  return (
    <PortalUnifiedHeader
      portal="club"
      portalTitle={portalTitle}
      onLogout={handleLogout}
      currentWorkerLabel={currentWorkerLabel}
    />
  )
}

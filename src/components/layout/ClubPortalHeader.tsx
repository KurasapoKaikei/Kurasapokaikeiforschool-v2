"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { PortalUnifiedHeader } from "@/components/layout/PortalUnifiedHeader"
import { useClubSession } from "@/contexts/ClubSessionContext"
import { useUserInfo } from "@/contexts/UserInfoContext"
import {
  getClubLoginRole,
  type ClubLoginRole,
} from "@/lib/clubLoginSession"
import { logoutClubSession } from "@/lib/clubLogout"
import { formatWorkersLabel } from "@/lib/currentWorkersSession"
import { CLUB_PORTAL_SESSION_CHANGED_EVENT } from "@/lib/clubPortalSessionEvents"
import { getClubById } from "@/lib/schoolClubs"
import { mockUserInfo } from "@/constants/userInfo"

const FALLBACK_PORTAL_TITLE = "クラブ"

/** クラブポータル共通ヘッダー（3段・ピンク帯） */
export function ClubPortalHeader() {
  const router = useRouter()
  const { activeClub, isHydrated } = useClubSession()
  const { userInfo, currentWorkers } = useUserInfo()
  const [portalTitle, setPortalTitle] = useState(FALLBACK_PORTAL_TITLE)
  /** SSR と一致させるため、マウント後にのみ localStorage 由来の role / 作業者を反映 */
  const [mounted, setMounted] = useState(false)
  const [loginRole, setLoginRole] = useState<ClubLoginRole | null>(null)
  const [managerIdentity, setManagerIdentity] = useState<{
    title: string
    name: string
  } | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    const name =
      activeClub?.name ?? userInfo.organizationName ?? mockUserInfo.organizationName
    setPortalTitle(name?.trim() || FALLBACK_PORTAL_TITLE)
  }, [isHydrated, activeClub, userInfo.organizationName])

  useEffect(() => {
    setMounted(true)
    const sync = () => {
      const role = getClubLoginRole()
      setLoginRole(role)
      if (role === "manager") {
        const clubId = activeClub?.id
        const club = clubId ? getClubById(clubId) : undefined
        setManagerIdentity({
          title: club?.managerTitle?.trim() || "",
          name: club?.managerName?.trim() || "",
        })
      } else {
        setManagerIdentity(null)
      }
    }
    sync()
    window.addEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [activeClub?.id])

  const currentWorkerLabel = useMemo(() => {
    if (!mounted) return undefined
    if (loginRole === "manager") return undefined
    return currentWorkers.length > 0
      ? formatWorkersLabel(currentWorkers)
      : "未選択"
  }, [mounted, currentWorkers, loginRole])

  const clubManagerIdentity = useMemo(() => {
    if (!mounted || loginRole !== "manager") return null
    return managerIdentity
  }, [mounted, loginRole, managerIdentity])

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
      clubManagerIdentity={clubManagerIdentity}
    />
  )
}

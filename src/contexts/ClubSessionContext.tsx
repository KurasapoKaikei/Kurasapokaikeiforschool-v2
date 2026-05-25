"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { getCurrentClub } from "@/lib/clubLoginSession"
import { resolveActiveClubSession, type ActiveClubSession } from "@/lib/activeClubSession"
import { isEmptyPortalForClub, isLegacyGlobalPortal } from "@/lib/clubPortalData"
import { clearImpersonatedClub } from "@/lib/schoolClubSession"
import { useUserInfo } from "@/contexts/UserInfoContext"
import { mockUserInfo } from "@/constants/userInfo"

type ClubSessionContextValue = {
  activeClub: ActiveClubSession | null
  isEmptyPortal: boolean
  isLegacyGlobalPortal: boolean
  /** localStorage 反映後に true（ハイドレーション整合用） */
  isHydrated: boolean
  refresh: () => void
}

const ClubSessionContext = createContext<ClubSessionContextValue | undefined>(
  undefined
)

export function ClubSessionProvider({ children }: { children: ReactNode }) {
  const { updateOrganizationName } = useUserInfo()
  const [activeClub, setActiveClub] = useState<ActiveClubSession | null>(null)
  const [isEmptyPortal, setIsEmptyPortal] = useState(false)
  const [isLegacy, setIsLegacy] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  const refresh = useCallback(() => {
    const active = resolveActiveClubSession()
    setActiveClub((prev) => {
      if (prev?.id === active?.id && prev?.name === active?.name) return prev
      return active
    })
    const empty = isEmptyPortalForClub(active)
    const legacy = isLegacyGlobalPortal(active)
    setIsEmptyPortal((prev) => (prev === empty ? prev : empty))
    setIsLegacy((prev) => (prev === legacy ? prev : legacy))
    updateOrganizationName(
      active ? active.name : mockUserInfo.organizationName
    )
  }, [updateOrganizationName])

  useEffect(() => {
    if (getCurrentClub()) {
      clearImpersonatedClub()
    }
    refresh()
    setIsHydrated(true)
    const interval = setInterval(refresh, 400)
    return () => clearInterval(interval)
  }, [refresh])

  const value = useMemo(
    () => ({
      activeClub,
      isEmptyPortal,
      isLegacyGlobalPortal: isLegacy,
      isHydrated,
      refresh,
    }),
    [activeClub, isEmptyPortal, isLegacy, isHydrated, refresh]
  )

  return (
    <ClubSessionContext.Provider value={value}>
      {children}
    </ClubSessionContext.Provider>
  )
}

export function useClubSession() {
  const ctx = useContext(ClubSessionContext)
  if (!ctx) {
    throw new Error("useClubSession must be used within ClubSessionProvider")
  }
  return ctx
}

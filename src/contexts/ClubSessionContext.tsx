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
import { resolveActiveClubSession, type ActiveClubSession } from "@/lib/activeClubSession"
import { isEmptyPortalForClub, isLegacyGlobalPortal } from "@/lib/clubPortalData"
import { useUserInfo } from "@/contexts/UserInfoContext"
import { mockUserInfo } from "@/constants/userInfo"

type ClubSessionContextValue = {
  activeClub: ActiveClubSession | null
  isEmptyPortal: boolean
  isLegacyGlobalPortal: boolean
  refresh: () => void
}

const ClubSessionContext = createContext<ClubSessionContextValue | undefined>(
  undefined
)

function readInitialSession() {
  if (typeof window === "undefined") {
    return { active: null as ActiveClubSession | null, empty: false, legacy: true }
  }
  const active = resolveActiveClubSession()
  return {
    active,
    empty: isEmptyPortalForClub(active),
    legacy: isLegacyGlobalPortal(active),
  }
}

export function ClubSessionProvider({ children }: { children: ReactNode }) {
  const { updateOrganizationName } = useUserInfo()
  const initial = readInitialSession()
  const [activeClub, setActiveClub] = useState<ActiveClubSession | null>(
    initial.active
  )
  const [isEmptyPortal, setIsEmptyPortal] = useState(initial.empty)
  const [isLegacy, setIsLegacy] = useState(initial.legacy)

  const refresh = useCallback(() => {
    const active = resolveActiveClubSession()
    setActiveClub(active)
    setIsEmptyPortal(isEmptyPortalForClub(active))
    setIsLegacy(isLegacyGlobalPortal(active))
    if (active) {
      updateOrganizationName(active.name)
    } else {
      updateOrganizationName(mockUserInfo.organizationName)
    }
  }, [updateOrganizationName])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 400)
    return () => clearInterval(interval)
  }, [refresh])

  const value = useMemo(
    () => ({
      activeClub,
      isEmptyPortal,
      isLegacyGlobalPortal: isLegacy,
      refresh,
    }),
    [activeClub, isEmptyPortal, isLegacy, refresh]
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

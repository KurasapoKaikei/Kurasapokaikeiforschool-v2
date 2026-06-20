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
import { resolveActiveClubSession } from "@/lib/activeClubSession"
import { getCurrentClub } from "@/lib/clubLoginSession"
import { CLUB_PORTAL_SESSION_CHANGED_EVENT } from "@/lib/clubPortalSessionEvents"
import {
  CURRENT_WORKERS_CHANGED_EVENT,
  formatWorkersLabel,
  getCurrentWorkers,
  resolveWorkerLabelForClub,
} from "@/lib/currentWorkersSession"
import { getClubProfile, saveClubProfile } from "@/utils/localStorage"

export interface UserInfo {
  isForSchool: boolean
  organizationName: string
  fiscalPeriod: string
  /** 担当者設定で保存した氏名（最大5名・Club.staffNames と対応） */
  staffNames: string[]
}

interface UserInfoContextType {
  userInfo: UserInfo
  /** 今回の作業セッションで宣言した担当者名（clubId 単位） */
  currentWorkers: string[]
  /** 入出金登録・編集時に記録する作業者ラベル（例: 山田太郎、佐藤花子） */
  currentOperatorName: string
  refreshCurrentWorkers: () => void
  updateOrganizationName: (name: string) => void
  updateStaffNames: (names: string[]) => void
}

const defaultUserInfo: UserInfo = {
  isForSchool: false,
  organizationName: "",
  fiscalPeriod: "2026.4.1～2027.3.31",
  staffNames: [],
}

const UserInfoContext = createContext<UserInfoContextType | undefined>(undefined)

export function UserInfoProvider({ children }: { children: ReactNode }) {
  const [userInfo, setUserInfo] = useState<UserInfo>(defaultUserInfo)
  const [currentWorkers, setCurrentWorkersState] = useState<string[]>([])

  const refreshCurrentWorkers = useCallback(() => {
    const clubId =
      resolveActiveClubSession()?.id ?? getCurrentClub()?.id ?? null
    if (!clubId) {
      setCurrentWorkersState([])
      return
    }
    setCurrentWorkersState(getCurrentWorkers(clubId))
  }, [])

  useEffect(() => {
    const profile = getClubProfile()
    setUserInfo((prev) => ({ ...prev, staffNames: profile.staffNames }))
    refreshCurrentWorkers()
  }, [refreshCurrentWorkers])

  useEffect(() => {
    const onSessionChange = () => refreshCurrentWorkers()
    window.addEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, onSessionChange)
    window.addEventListener(CURRENT_WORKERS_CHANGED_EVENT, onSessionChange)
    window.addEventListener("storage", onSessionChange)
    return () => {
      window.removeEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, onSessionChange)
      window.removeEventListener(CURRENT_WORKERS_CHANGED_EVENT, onSessionChange)
      window.removeEventListener("storage", onSessionChange)
    }
  }, [refreshCurrentWorkers])

  const updateOrganizationName = useCallback((name: string) => {
    setUserInfo((prev) =>
      prev.organizationName === name ? prev : { ...prev, organizationName: name }
    )
  }, [])

  const updateStaffNames = useCallback((names: string[]) => {
    const trimmed = names.map((s) => s.trim()).filter(Boolean).slice(0, 5)
    saveClubProfile({ staffNames: trimmed })
    setUserInfo((prev) => ({ ...prev, staffNames: trimmed }))
  }, [])

  const currentOperatorName = useMemo(() => {
    if (currentWorkers.length > 0) {
      return formatWorkersLabel(currentWorkers)
    }
    const clubId =
      resolveActiveClubSession()?.id ?? getCurrentClub()?.id ?? ""
    return resolveWorkerLabelForClub(clubId, userInfo.staffNames)
  }, [currentWorkers, userInfo.staffNames])

  const value = useMemo(
    () => ({
      userInfo,
      currentWorkers,
      currentOperatorName,
      refreshCurrentWorkers,
      updateOrganizationName,
      updateStaffNames,
    }),
    [
      userInfo,
      currentWorkers,
      currentOperatorName,
      refreshCurrentWorkers,
      updateOrganizationName,
      updateStaffNames,
    ]
  )

  return <UserInfoContext.Provider value={value}>{children}</UserInfoContext.Provider>
}

export function useUserInfo() {
  const context = useContext(UserInfoContext)
  if (context === undefined) {
    throw new Error("useUserInfo must be used within a UserInfoProvider")
  }
  return context
}

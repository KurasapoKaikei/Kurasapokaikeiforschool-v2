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
  /** 現在ログイン中の作業者名（担当者設定の先頭をフォールバック。未設定なら "未設定"） */
  currentOperatorName: string
  updateOrganizationName: (name: string) => void
  updateStaffNames: (names: string[]) => void
}

const defaultUserInfo: UserInfo = {
  isForSchool: false,
  organizationName: "ラグビー部",
  fiscalPeriod: "2026.4.1～2027.3.31",
  staffNames: [],
}

const UserInfoContext = createContext<UserInfoContextType | undefined>(undefined)

export function UserInfoProvider({ children }: { children: ReactNode }) {
  const [userInfo, setUserInfo] = useState<UserInfo>(defaultUserInfo)

  useEffect(() => {
    const profile = getClubProfile()
    setUserInfo((prev) => ({ ...prev, staffNames: profile.staffNames }))
  }, [])

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
    const first = userInfo.staffNames.find((s) => s && s.trim())
    return first ? first.trim() : "未設定"
  }, [userInfo.staffNames])

  const value = useMemo(
    () => ({
      userInfo,
      currentOperatorName,
      updateOrganizationName,
      updateStaffNames,
    }),
    [userInfo, currentOperatorName, updateOrganizationName, updateStaffNames]
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

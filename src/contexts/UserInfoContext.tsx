"use client"

import { createContext, useContext, useState, ReactNode } from "react"

interface UserInfo {
  isForSchool: boolean
  organizationName: string
  fiscalPeriod: string
}

interface UserInfoContextType {
  userInfo: UserInfo
  updateOrganizationName: (name: string) => void
}

const defaultUserInfo: UserInfo = {
  isForSchool: false,
  organizationName: "ラグビー部",
  fiscalPeriod: "2025.4.1～2026.3.31",
}

const UserInfoContext = createContext<UserInfoContextType | undefined>(undefined)

export function UserInfoProvider({ children }: { children: ReactNode }) {
  const [userInfo, setUserInfo] = useState<UserInfo>(defaultUserInfo)

  const updateOrganizationName = (name: string) => {
    setUserInfo((prev) => ({ ...prev, organizationName: name }))
  }

  return (
    <UserInfoContext.Provider value={{ userInfo, updateOrganizationName }}>
      {children}
    </UserInfoContext.Provider>
  )
}

export function useUserInfo() {
  const context = useContext(UserInfoContext)
  if (context === undefined) {
    throw new Error("useUserInfo must be used within a UserInfoProvider")
  }
  return context
}

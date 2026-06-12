"use client"

import { ReactNode, useEffect, useState } from "react"
import {
  ensureCurrentSchoolSynced,
  SCHOOL_SESSION_CHANGED_EVENT,
} from "@/lib/currentSchool"
import { ensureSchoolMastersSeeded } from "@/lib/schoolMasters"
import { getSchoolAdminSession } from "@/lib/schoolLoginSession"
import { SchoolClubGroupsProvider } from "@/contexts/SchoolClubGroupsContext"
import { SchoolClubsProvider } from "@/contexts/SchoolClubsContext"
import { SchoolSidebar } from "@/components/layout/school/SchoolSidebar"
import { SchoolHeader } from "@/components/layout/school/SchoolHeader"
import { PortalFiscalYearProvider } from "@/contexts/PortalFiscalYearContext"

/** 学校管理者向け（/school 配下）のサイドバー＋ヘッダー枠 */
export function SchoolAppShell({ children }: { children: ReactNode }) {
  const [headerKey, setHeaderKey] = useState("init")

  useEffect(() => {
    ensureSchoolMastersSeeded()
    ensureCurrentSchoolSynced()
  }, [])

  useEffect(() => {
    const syncKey = () => {
      const id = getSchoolAdminSession()?.loginId ?? "guest"
      setHeaderKey(`${id}-${Date.now()}`)
    }
    syncKey()
    const bump = () => syncKey()
    window.addEventListener(SCHOOL_SESSION_CHANGED_EVENT, bump)
    window.addEventListener("storage", bump)
    return () => {
      window.removeEventListener(SCHOOL_SESSION_CHANGED_EVENT, bump)
      window.removeEventListener("storage", bump)
    }
  }, [])

  return (
    <PortalFiscalYearProvider>
    <SchoolClubGroupsProvider>
      <SchoolClubsProvider>
        <div className="flex min-h-screen bg-[#F5F5F0]">
          <SchoolSidebar />
          <main className="flex-1 ml-64">
            <SchoolHeader key={headerKey} />
            {children}
          </main>
        </div>
      </SchoolClubsProvider>
    </SchoolClubGroupsProvider>
    </PortalFiscalYearProvider>
  )
}

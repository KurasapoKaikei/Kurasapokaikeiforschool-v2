"use client"

import { ReactNode } from "react"
import { SchoolClubGroupsProvider } from "@/contexts/SchoolClubGroupsContext"
import { SchoolClubsProvider } from "@/contexts/SchoolClubsContext"
import { SchoolSidebar } from "@/components/layout/school/SchoolSidebar"
import { SchoolHeader } from "@/components/layout/school/SchoolHeader"

/** 学校管理者向け（/school 配下）のサイドバー＋ヘッダー枠 */
export function SchoolAppShell({ children }: { children: ReactNode }) {
  return (
    <SchoolClubGroupsProvider>
      <SchoolClubsProvider>
        <div className="flex min-h-screen bg-[#F5F5F0]">
          <SchoolSidebar />
          <main className="flex-1 ml-64">
            <SchoolHeader />
            {children}
          </main>
        </div>
      </SchoolClubsProvider>
    </SchoolClubGroupsProvider>
  )
}

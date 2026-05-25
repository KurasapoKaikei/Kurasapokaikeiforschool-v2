"use client"

import { ReactNode, useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { AppShellHeader } from "@/components/layout/AppShellHeader"
import { isSchoolImpersonatingClub } from "@/lib/clubPortalAccess"
import { CLUB_PORTAL_SESSION_CHANGED_EVENT } from "@/lib/clubPortalSessionEvents"

/**
 * クラブポータル用シェル。
 * - 通常のクラブログイン: サイドバー・コンテンツともフル操作可
 * - 学校管理者閲覧: メイン領域のみ閲覧制限（サイドバーは遷移可能）
 */
export function ClubAppShell({ children }: { children: ReactNode }) {
  const [readOnlyMain, setReadOnlyMain] = useState(false)

  useEffect(() => {
    const sync = () => setReadOnlyMain(isSchoolImpersonatingClub())
    sync()
    window.addEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#F5F5F0]">
      {/* サイドバー：メイン領域より前面に固定し、リンククリックを確実に通す */}
      <Sidebar />
      <main className="relative z-0 flex min-h-screen min-w-0 flex-1 flex-col">
        <AppShellHeader />
        <div className="relative flex min-h-0 flex-1 flex-col pt-3">
          <div className="club-portal-main-content relative min-h-0 flex-1">
            {children}
            {readOnlyMain ? (
              <div
                className="absolute inset-0 z-10 cursor-not-allowed bg-transparent pointer-events-auto"
                aria-hidden
                title="管理者閲覧モードのため、この領域の操作は制限されています"
              />
            ) : null}
          </div>
        </div>
      </main>
    </div>
  )
}

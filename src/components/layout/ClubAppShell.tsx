"use client"

import { ReactNode, useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { AppShellHeader } from "@/components/layout/AppShellHeader"
import { PortalFiscalYearProvider } from "@/contexts/PortalFiscalYearContext"
import { isAuditorImpersonatingClub, isSchoolImpersonatingClub } from "@/lib/clubPortalAccess"
import { ClubCurrentWorkersGate } from "@/components/club/ClubCurrentWorkersGate"
import { ClubImpersonationBanner } from "@/components/layout/club/ClubImpersonationBanner"
import { CLUB_PORTAL_SESSION_CHANGED_EVENT } from "@/lib/clubPortalSessionEvents"

/**
 * クラブポータル用シェル。
 * - 通常のクラブログイン: サイドバー・コンテンツともフル操作可
 * - 学校管理者・監査人閲覧: メイン領域のみ閲覧制限（サイドバーは遷移可能）
 */
export function ClubAppShell({ children }: { children: ReactNode }) {
  const [readOnlyMain, setReadOnlyMain] = useState(false)
  const [readOnlyTitle, setReadOnlyTitle] = useState(
    "管理者閲覧モードのため、この領域の操作は制限されています"
  )

  useEffect(() => {
    const sync = () => {
      const impersonating = isSchoolImpersonatingClub()
      setReadOnlyMain(impersonating)
      setReadOnlyTitle(
        isAuditorImpersonatingClub()
          ? "監査人閲覧モードのため、この領域の操作は制限されています"
          : "管理者閲覧モードのため、この領域の操作は制限されています"
      )
    }
    sync()
    window.addEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  return (
    <PortalFiscalYearProvider>
    <ClubCurrentWorkersGate />
    <div className="flex min-h-screen items-stretch overflow-x-hidden bg-[#F5F5F0]">
      {/* サイドバー：メインと同じ列高（本体が長いときも途中で切れない） */}
      <Sidebar />
      <main className="relative z-0 flex min-h-screen min-w-0 flex-1 flex-col">
        <AppShellHeader />
        <div className="relative flex min-h-0 flex-1 flex-col pt-3">
          <ClubImpersonationBanner />
          <div className="club-portal-main-content relative min-h-0 flex-1">
            {children}
            {readOnlyMain ? (
              <div
                className="absolute inset-0 z-10 cursor-not-allowed bg-transparent pointer-events-auto"
                aria-hidden
                title={readOnlyTitle}
              />
            ) : null}
          </div>
        </div>
      </main>
    </div>
    </PortalFiscalYearProvider>
  )
}

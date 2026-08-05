"use client"

import { ReactNode, useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { AppShellHeader } from "@/components/layout/AppShellHeader"
import { PortalFiscalYearProvider } from "@/contexts/PortalFiscalYearContext"
import {
  isAuditorImpersonatingClub,
  isSchoolImpersonatingClub,
} from "@/lib/clubPortalAccess"
import { ClubCurrentWorkersGate } from "@/components/club/ClubCurrentWorkersGate"
import { ClubManagerApproveBanner } from "@/components/club/ClubManagerApproveBanner"
import { ClubManagerReadOnlyShield } from "@/components/club/ClubManagerReadOnlyShield"
import { ClubImpersonationBanner } from "@/components/layout/club/ClubImpersonationBanner"
import { getClubLoginRole, getCurrentClub } from "@/lib/clubLoginSession"
import { CLUB_PORTAL_SESSION_CHANGED_EVENT } from "@/lib/clubPortalSessionEvents"

/**
 * クラブポータル用シェル。
 * - 作業者ログイン: サイドバー・コンテンツとも操作可
 * - 責任者ログイン: 閲覧＋決算承認のみ（書き込み操作を抑止）
 * - 学校管理者・監査人閲覧: メイン領域のみ閲覧制限（サイドバーは遷移可能）
 */
export function ClubAppShell({ children }: { children: ReactNode }) {
  const [readOnlyMain, setReadOnlyMain] = useState(false)
  const [readOnlyTitle, setReadOnlyTitle] = useState(
    "管理者閲覧モードのため、この領域の操作は制限されています"
  )
  const [managerClubId, setManagerClubId] = useState<string | undefined>()

  useEffect(() => {
    const sync = () => {
      const isManager = getClubLoginRole() === "manager"
      const impersonating = isSchoolImpersonatingClub()
      setManagerClubId(isManager ? getCurrentClub()?.id : undefined)
      // 責任者はシールドで操作抑止（閲覧・スクロール可）。全面オーバーレイはなりすましのみ。
      setReadOnlyMain(impersonating)
      if (isAuditorImpersonatingClub()) {
        setReadOnlyTitle(
          "監査人閲覧モードのため、この領域の操作は制限されています"
        )
      } else {
        setReadOnlyTitle(
          "管理者閲覧モードのため、この領域の操作は制限されています"
        )
      }
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
      <ClubManagerReadOnlyShield />
      <div className="flex min-h-screen items-stretch overflow-x-hidden bg-[#F5F5F0]">
        <Sidebar />
        <main className="relative z-0 flex min-h-screen min-w-0 flex-1 flex-col">
          <AppShellHeader />
          <div className="relative flex min-h-0 flex-1 flex-col pt-3">
            <ClubImpersonationBanner />
            <ClubManagerApproveBanner clubId={managerClubId} />
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

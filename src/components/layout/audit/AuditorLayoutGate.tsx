"use client"

import { ReactNode, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AuditorAppShell } from "@/components/layout/audit/AuditorAppShell"
import { SchoolClubsProvider } from "@/contexts/SchoolClubsContext"
import { loadCurrentAuditor } from "@/lib/currentAuditor"
import { ensureSchoolMastersSeeded } from "@/lib/schoolMasters"
import { AUDIT_ROUTES, safeAuditPathname } from "@/lib/auditorTheme"

/** 監査人ポータル：ログイン以外はセッション必須 */
export function AuditorLayoutGate({ children }: { children: ReactNode }) {
  const pathname = safeAuditPathname(usePathname())
  const router = useRouter()
  const isLogin = pathname === AUDIT_ROUTES.login
  const [hydrated, setHydrated] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    setHydrated(true)
    try {
      ensureSchoolMastersSeeded()
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const session = loadCurrentAuditor()
    setHasSession(session != null)
    if (!isLogin && !session) {
      router.replace(AUDIT_ROUTES.login)
    }
  }, [hydrated, isLogin, pathname, router])

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F0] text-sm text-[#6B7280]">
        読み込み中…
      </div>
    )
  }

  if (isLogin) {
    return <>{children}</>
  }

  if (!hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F0] text-sm text-[#6B7280]">
        ログイン画面へ移動しています…
      </div>
    )
  }

  return (
    <SchoolClubsProvider>
      <AuditorAppShell>{children}</AuditorAppShell>
    </SchoolClubsProvider>
  )
}

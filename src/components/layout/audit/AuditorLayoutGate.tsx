"use client"

import { ReactNode, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { SchoolClubsProvider } from "@/contexts/SchoolClubsContext"
import { loadCurrentAuditor } from "@/lib/currentAuditor"
import { ensureSchoolMastersSeeded } from "@/lib/schoolMasters"
import { AUDIT_ROUTES } from "@/lib/auditorTheme"

/** 監査人ポータル：ログイン以外はセッション必須 */
export function AuditorLayoutGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    ensureSchoolMastersSeeded()
  }, [])

  useEffect(() => {
    if (pathname === AUDIT_ROUTES.login) return
    if (!loadCurrentAuditor()) {
      router.replace(AUDIT_ROUTES.login)
    }
  }, [pathname, router])

  if (pathname === AUDIT_ROUTES.login) {
    return <>{children}</>
  }

  return <SchoolClubsProvider>{children}</SchoolClubsProvider>
}

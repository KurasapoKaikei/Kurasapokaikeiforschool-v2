"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import {
  AUDITOR_SESSION_CHANGED_EVENT,
  loadCurrentAuditor,
} from "@/lib/currentAuditor"
import {
  AUDIT_PAGE_TITLES,
  AUDIT_ROUTES,
  isAuditMessagesPath,
  safeAuditPathname,
} from "@/lib/auditorTheme"

function resolveTitle(pathname: string | null): string {
  const path = safeAuditPathname(pathname)
  if (path.startsWith(AUDIT_ROUTES.guide)) return AUDIT_PAGE_TITLES.guide
  if (path.startsWith("/audit/clubs/")) return AUDIT_PAGE_TITLES.clubReview
  if (path === AUDIT_ROUTES.messagesDrafts) {
    return AUDIT_PAGE_TITLES.messagesDrafts
  }
  if (path === AUDIT_ROUTES.messages || isAuditMessagesPath(path)) {
    return AUDIT_PAGE_TITLES.messagesList
  }
  if (path === AUDIT_ROUTES.home) return AUDIT_PAGE_TITLES.home
  return AUDIT_PAGE_TITLES.home
}

export function AuditorHeader() {
  const pathname = usePathname()
  const [auditorName, setAuditorName] = useState("")

  useEffect(() => {
    const sync = () => {
      const session = loadCurrentAuditor()
      setAuditorName(session?.name ?? "")
    }
    sync()
    window.addEventListener(AUDITOR_SESSION_CHANGED_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(AUDITOR_SESSION_CHANGED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-[#374151]">
          {resolveTitle(pathname)}
        </h1>
        {auditorName ? (
          <p className="text-sm text-[#6B7280]">{auditorName}</p>
        ) : null}
      </div>
    </header>
  )
}

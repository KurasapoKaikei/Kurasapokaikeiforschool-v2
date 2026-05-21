"use client"

import { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { SchoolAppShell } from "@/components/layout/school/SchoolAppShell"
import { SCHOOL_ROUTES } from "@/lib/schoolTheme"

/** ログイン画面はシェルなし、それ以外は管理者シェル */
export function SchoolLayoutGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (pathname === SCHOOL_ROUTES.login) {
    return <>{children}</>
  }
  return <SchoolAppShell>{children}</SchoolAppShell>
}

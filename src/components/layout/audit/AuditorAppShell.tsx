"use client"

import { ReactNode } from "react"
import { AuditorHeader } from "@/components/layout/audit/AuditorHeader"
import { AuditorSidebar } from "@/components/layout/audit/AuditorSidebar"
import { PortalFiscalYearProvider } from "@/contexts/PortalFiscalYearContext"

export function AuditorAppShell({ children }: { children: ReactNode }) {
  return (
    <PortalFiscalYearProvider>
    <div className="flex min-h-screen bg-[#F5F5F0]">
      <AuditorSidebar />
      <main className="ml-64 flex min-h-screen flex-1 flex-col">
        <AuditorHeader />
        {children}
      </main>
    </div>
    </PortalFiscalYearProvider>
  )
}

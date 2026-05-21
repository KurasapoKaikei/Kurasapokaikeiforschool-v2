import { ReactNode } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { ClubImpersonationBanner } from "@/components/layout/club/ClubImpersonationBanner"
import { ClubSessionProvider } from "@/contexts/ClubSessionContext"

export default function DashboardGroupLayout({ children }: { children: ReactNode }) {
  return (
    <ClubSessionProvider>
      <AppShell>
        <ClubImpersonationBanner />
        {children}
      </AppShell>
    </ClubSessionProvider>
  )
}

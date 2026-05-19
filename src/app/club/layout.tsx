import { ReactNode } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { ClubImpersonationBanner } from "@/components/layout/club/ClubImpersonationBanner"

export default function DashboardGroupLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <ClubImpersonationBanner />
      {children}
    </AppShell>
  )
}

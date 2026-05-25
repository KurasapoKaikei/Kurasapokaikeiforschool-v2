import { ReactNode } from "react"
import { ClubAppShell } from "@/components/layout/ClubAppShell"
import { ClubImpersonationBanner } from "@/components/layout/club/ClubImpersonationBanner"
import { ClubSessionProvider } from "@/contexts/ClubSessionContext"

export default function DashboardGroupLayout({ children }: { children: ReactNode }) {
  return (
    <ClubSessionProvider>
      <ClubAppShell>
        <ClubImpersonationBanner />
        {children}
      </ClubAppShell>
    </ClubSessionProvider>
  )
}

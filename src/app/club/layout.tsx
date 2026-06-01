import { ReactNode } from "react"
import { ClubAppShell } from "@/components/layout/ClubAppShell"
import { ClubSessionProvider } from "@/contexts/ClubSessionContext"

export default function DashboardGroupLayout({ children }: { children: ReactNode }) {
  return (
    <ClubSessionProvider>
      <ClubAppShell>{children}</ClubAppShell>
    </ClubSessionProvider>
  )
}

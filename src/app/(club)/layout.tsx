import { ReactNode } from "react"
import { AppShell } from "@/components/layout/AppShell"

export default function ClubGroupLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}

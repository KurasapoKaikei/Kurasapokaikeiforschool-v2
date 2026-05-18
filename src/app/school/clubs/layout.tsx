import { ReactNode } from "react"
import { AppShell } from "@/components/layout/AppShell"

export default function SchoolGroupLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}

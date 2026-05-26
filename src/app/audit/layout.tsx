import { ReactNode } from "react"
import { AuditorLayoutGate } from "@/components/layout/audit/AuditorLayoutGate"

export default function AuditLayout({ children }: { children: ReactNode }) {
  return <AuditorLayoutGate>{children}</AuditorLayoutGate>
}

import { ReactNode } from "react"
import { SchoolAppShell } from "@/components/layout/school/SchoolAppShell"

export default function SchoolLayout({ children }: { children: ReactNode }) {
  return <SchoolAppShell>{children}</SchoolAppShell>
}

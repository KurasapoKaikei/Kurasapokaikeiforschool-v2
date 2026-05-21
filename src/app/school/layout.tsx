import { ReactNode } from "react"
import { SchoolLayoutGate } from "@/components/layout/school/SchoolLayoutGate"

export default function SchoolLayout({ children }: { children: ReactNode }) {
  return <SchoolLayoutGate>{children}</SchoolLayoutGate>
}

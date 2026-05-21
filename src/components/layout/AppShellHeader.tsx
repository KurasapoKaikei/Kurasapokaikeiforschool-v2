"use client"

import { usePathname } from "next/navigation"
import { ClubPortalHeader } from "@/components/layout/ClubPortalHeader"
import { LegacyAppHeader } from "@/components/layout/LegacyAppHeader"
import { isClubPath } from "@/lib/routes"

interface AppShellHeaderProps {
  title?: string
}

export function AppShellHeader({ title }: AppShellHeaderProps) {
  const pathname = usePathname()
  if (isClubPath(pathname)) {
    return <ClubPortalHeader />
  }
  return <LegacyAppHeader title={title} />
}

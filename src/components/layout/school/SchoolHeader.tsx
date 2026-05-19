"use client"

import { usePathname } from "next/navigation"
import {
  isSchoolClubPath,
  isSchoolSettingsPath,
  SCHOOL_DISPLAY_NAME,
  SCHOOL_FISCAL_PERIOD,
  SCHOOL_PAGE_TITLES,
  SCHOOL_ROUTES,
} from "@/lib/schoolTheme"

function resolveTitle(pathname: string): string {
  if (pathname.startsWith(SCHOOL_ROUTES.guide)) return SCHOOL_PAGE_TITLES.guide
  if (pathname.startsWith(SCHOOL_ROUTES.contract)) return SCHOOL_PAGE_TITLES.contract
  if (pathname.startsWith(SCHOOL_ROUTES.settingsStaff)) {
    return SCHOOL_PAGE_TITLES.settingsStaff
  }
  if (pathname.startsWith(SCHOOL_ROUTES.settingsAccountTitles)) {
    return SCHOOL_PAGE_TITLES.settingsAccountTitles
  }
  if (
    pathname === SCHOOL_ROUTES.settingsCategory ||
    pathname === SCHOOL_ROUTES.settingsBase
  ) {
    return SCHOOL_PAGE_TITLES.settingsCategory
  }
  if (isSchoolSettingsPath(pathname)) return SCHOOL_PAGE_TITLES.settings
  if (pathname.startsWith(SCHOOL_ROUTES.messages)) return SCHOOL_PAGE_TITLES.messages
  if (pathname.startsWith(SCHOOL_ROUTES.clubRegister)) {
    return SCHOOL_PAGE_TITLES.clubRegister
  }
  if (pathname === SCHOOL_ROUTES.clubList) return SCHOOL_PAGE_TITLES.clubList
  if (isSchoolClubPath(pathname)) return SCHOOL_PAGE_TITLES.clubs
  return SCHOOL_PAGE_TITLES.home
}

export function SchoolHeader() {
  const pathname = usePathname()
  const displayTitle = resolveTitle(pathname)

  return (
    <header className="sticky top-0 z-50">
      <div className="bg-[#F5F5F0] px-6 py-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold text-[#374151]">{SCHOOL_DISPLAY_NAME}</h1>
          <span className="rounded-md bg-white/80 px-2 py-0.5 text-sm text-[#6B7280] ring-1 ring-gray-200/80">
            {SCHOOL_FISCAL_PERIOD}
          </span>
        </div>
      </div>
      <div className="bg-blue-950 text-white">
        <div className="flex h-12 items-center px-6">
          <h2 className="text-lg font-semibold">{displayTitle}</h2>
        </div>
      </div>
    </header>
  )
}

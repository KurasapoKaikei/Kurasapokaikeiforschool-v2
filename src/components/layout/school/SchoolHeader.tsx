"use client"



import { useCallback, useLayoutEffect, useState } from "react"

import { usePathname } from "next/navigation"

import { SCHOOL_SESSION_CHANGED_EVENT } from "@/lib/currentSchool"

import { getSchoolHeaderDisplay } from "@/lib/schoolHeaderDisplay"

import {

  isSchoolClubPath,

  isSchoolMessagesPath,

  isSchoolSettingsPath,

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

  if (pathname === SCHOOL_ROUTES.messagesDrafts) {
    return SCHOOL_PAGE_TITLES.messagesDrafts
  }

  if (pathname === SCHOOL_ROUTES.messages) return SCHOOL_PAGE_TITLES.messagesList

  if (isSchoolMessagesPath(pathname)) return SCHOOL_PAGE_TITLES.messages

  if (/\/school\/clubs\/[^/]+\/messages/.test(pathname)) return "メッセージ"

  if (pathname.startsWith(SCHOOL_ROUTES.clubRegister)) {

    return SCHOOL_PAGE_TITLES.clubRegister

  }

  if (pathname.startsWith(SCHOOL_ROUTES.clubGroups)) {

    return SCHOOL_PAGE_TITLES.clubGroups

  }

  if (pathname === SCHOOL_ROUTES.clubList) return SCHOOL_PAGE_TITLES.clubList

  if (isSchoolClubPath(pathname)) return SCHOOL_PAGE_TITLES.clubs

  return SCHOOL_PAGE_TITLES.home

}



export function SchoolHeader() {

  const pathname = usePathname()

  const displayTitle = resolveTitle(pathname)

  const [schoolName, setSchoolName] = useState("")

  const [fiscalPeriod, setFiscalPeriod] = useState("")

  const [hydrated, setHydrated] = useState(false)



  const refresh = useCallback(() => {

    const { schoolName: name, fiscalPeriod: period } = getSchoolHeaderDisplay()

    setSchoolName(name)

    setFiscalPeriod(period)

    setHydrated(true)

  }, [])



  useLayoutEffect(() => {

    refresh()

    window.addEventListener("storage", refresh)

    window.addEventListener(SCHOOL_SESSION_CHANGED_EVENT, refresh)

    return () => {

      window.removeEventListener("storage", refresh)

      window.removeEventListener(SCHOOL_SESSION_CHANGED_EVENT, refresh)

    }

  }, [refresh, pathname])



  return (

    <header className="sticky top-0 z-50">

      <div className="bg-[#F5F5F0] px-6 py-2">

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">

          <h1 className="text-xl font-semibold text-[#374151]">

            {hydrated ? schoolName : "\u00a0"}

          </h1>

          <span className="rounded-md bg-white/80 px-2 py-0.5 text-sm text-[#6B7280] ring-1 ring-gray-200/80">

            {hydrated ? fiscalPeriod : "\u00a0"}

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



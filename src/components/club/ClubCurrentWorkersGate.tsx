"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { ClubCurrentWorkersDialog } from "@/components/club/ClubCurrentWorkersDialog"
import { useClubSession } from "@/contexts/ClubSessionContext"
import { useUserInfo } from "@/contexts/UserInfoContext"
import { getCurrentClub } from "@/lib/clubLoginSession"
import { hasAuthenticatedClubLogin } from "@/lib/clubPortalAccess"
import { CLUB_PORTAL_SESSION_CHANGED_EVENT } from "@/lib/clubPortalSessionEvents"
import {
  CURRENT_WORKERS_CHANGED_EVENT,
  hasCurrentWorkersSession,
  setCurrentWorkers,
} from "@/lib/currentWorkersSession"

/** クラブログイン後、作業者未宣言なら担当者選択モーダルを表示する */
export function ClubCurrentWorkersGate() {
  const pathname = usePathname()
  const { activeClub, isHydrated } = useClubSession()
  const { userInfo, refreshCurrentWorkers } = useUserInfo()
  const [open, setOpen] = useState(false)
  const [selectedNames, setSelectedNames] = useState<string[]>([])

  const clubId = activeClub?.id ?? getCurrentClub()?.id ?? null

  const staffNames = useMemo(
    () => userInfo.staffNames.map((s) => s.trim()).filter(Boolean),
    [userInfo.staffNames]
  )

  const evaluateGate = useCallback(() => {
    if (!isHydrated) return
    if (!hasAuthenticatedClubLogin()) {
      setOpen(false)
      return
    }
    if (pathname === "/club/login") {
      setOpen(false)
      return
    }
    if (!clubId) {
      setOpen(false)
      return
    }
    if (staffNames.length === 0) {
      setOpen(false)
      return
    }
    if (hasCurrentWorkersSession(clubId)) {
      setOpen(false)
      return
    }
    setSelectedNames([])
    setOpen(true)
  }, [clubId, isHydrated, pathname, staffNames.length])

  useEffect(() => {
    evaluateGate()
  }, [evaluateGate])

  useEffect(() => {
    const onChange = () => evaluateGate()
    window.addEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, onChange)
    window.addEventListener(CURRENT_WORKERS_CHANGED_EVENT, onChange)
    return () => {
      window.removeEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, onChange)
      window.removeEventListener(CURRENT_WORKERS_CHANGED_EVENT, onChange)
    }
  }, [evaluateGate])

  const handleToggleName = (name: string) => {
    setSelectedNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  const handleConfirm = () => {
    if (!clubId || selectedNames.length === 0) return
    setCurrentWorkers(clubId, selectedNames)
    refreshCurrentWorkers()
    setOpen(false)
  }

  return (
    <ClubCurrentWorkersDialog
      open={open}
      staffNames={staffNames}
      selectedNames={selectedNames}
      onToggleName={handleToggleName}
      onConfirm={handleConfirm}
    />
  )
}

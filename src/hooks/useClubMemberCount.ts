"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CLUB_MEMBERS_CHANGED_EVENT,
  getClubMemberCount,
  isClubMembersChangedForClub,
} from "@/lib/clubMembers"

/** クラブ ID ごとの部員数（localStorage 同期・カスタムイベント対応） */
export function useClubMemberCount(clubId: string): number {
  const [count, setCount] = useState(0)

  const refresh = useCallback(() => {
    setCount(clubId ? getClubMemberCount(clubId) : 0)
  }, [clubId])

  useEffect(() => {
    refresh()
    const onChange = (e: Event) => {
      if (isClubMembersChangedForClub(clubId, e)) refresh()
    }
    window.addEventListener(CLUB_MEMBERS_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refresh()
    })
    return () => {
      window.removeEventListener(CLUB_MEMBERS_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
      window.removeEventListener("focus", refresh)
    }
  }, [clubId, refresh])

  return count
}

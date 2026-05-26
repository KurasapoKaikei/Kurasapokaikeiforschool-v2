"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { SCHOOL_SESSION_CHANGED_EVENT } from "@/lib/currentSchool"
import {
  isDuplicateGroupName,
  loadSchoolClubGroups,
  saveSchoolClubGroups,
  type SchoolClubGroup,
} from "@/lib/schoolClubGroups"
import { SCHOOL_WORKSPACE_CHANGED_EVENT } from "@/lib/schoolWorkspace"

type SchoolClubGroupsContextValue = {
  groups: SchoolClubGroup[]
  sortedGroups: SchoolClubGroup[]
  isLoaded: boolean
  addGroup: (name: string) => boolean
  updateGroup: (id: string, name: string) => boolean
  deleteGroup: (id: string) => void
  setGroupsOrder: (ordered: SchoolClubGroup[]) => void
}

const SchoolClubGroupsContext = createContext<SchoolClubGroupsContextValue | null>(
  null
)

export function SchoolClubGroupsProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<SchoolClubGroup[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  const reloadFromStorage = useCallback(() => {
    setGroups(loadSchoolClubGroups())
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    reloadFromStorage()
  }, [reloadFromStorage])

  useEffect(() => {
    const onReload = () => reloadFromStorage()
    window.addEventListener(SCHOOL_SESSION_CHANGED_EVENT, onReload)
    window.addEventListener(SCHOOL_WORKSPACE_CHANGED_EVENT, onReload)
    window.addEventListener("storage", onReload)
    return () => {
      window.removeEventListener(SCHOOL_SESSION_CHANGED_EVENT, onReload)
      window.removeEventListener(SCHOOL_WORKSPACE_CHANGED_EVENT, onReload)
      window.removeEventListener("storage", onReload)
    }
  }, [reloadFromStorage])

  useEffect(() => {
    if (!isLoaded) return
    saveSchoolClubGroups(groups)
  }, [groups, isLoaded])

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.order - b.order),
    [groups]
  )

  const addGroup = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return false
    let added = false
    setGroups((prev) => {
      if (isDuplicateGroupName(trimmed, prev)) return prev
      added = true
      return [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: trimmed,
          order: prev.length + 1,
        },
      ]
    })
    return added
  }, [])

  const updateGroup = useCallback((id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return false
    let ok = false
    setGroups((prev) => {
      if (isDuplicateGroupName(trimmed, prev, id)) return prev
      ok = true
      return prev.map((g) => (g.id === id ? { ...g, name: trimmed } : g))
    })
    return ok
  }, [])

  const deleteGroup = useCallback((id: string) => {
    setGroups((prev) =>
      prev
        .filter((g) => g.id !== id)
        .map((g, idx) => ({ ...g, order: idx + 1 }))
    )
  }, [])

  const setGroupsOrder = useCallback((ordered: SchoolClubGroup[]) => {
    setGroups(ordered.map((g, idx) => ({ ...g, order: idx + 1 })))
  }, [])

  const value = useMemo(
    () => ({
      groups,
      sortedGroups,
      isLoaded,
      addGroup,
      updateGroup,
      deleteGroup,
      setGroupsOrder,
    }),
    [
      groups,
      sortedGroups,
      isLoaded,
      addGroup,
      updateGroup,
      deleteGroup,
      setGroupsOrder,
    ]
  )

  return (
    <SchoolClubGroupsContext.Provider value={value}>
      {children}
    </SchoolClubGroupsContext.Provider>
  )
}

export function useSchoolClubGroups() {
  const ctx = useContext(SchoolClubGroupsContext)
  if (!ctx) {
    throw new Error("useSchoolClubGroups must be used within SchoolClubGroupsProvider")
  }
  return ctx
}

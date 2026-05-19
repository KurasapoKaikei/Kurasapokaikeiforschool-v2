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
import {
  generateInitialPassword,
  generateUniqueClubId,
  loadSchoolClubs,
  saveSchoolClubs,
  type SchoolClub,
} from "@/lib/schoolClubs"

type RegisterClubInput = {
  name: string
  groupId: string
  groupName: string
}

type UpdateClubInput = {
  name?: string
  groupId?: string
  groupName?: string
}

type SchoolClubsContextValue = {
  clubs: SchoolClub[]
  sortedClubs: SchoolClub[]
  isLoaded: boolean
  registerClub: (input: RegisterClubInput) => SchoolClub
  updateClub: (id: string, input: UpdateClubInput) => boolean
  deleteClub: (id: string) => void
  setClubsOrder: (ordered: SchoolClub[]) => void
}

const SchoolClubsContext = createContext<SchoolClubsContextValue | null>(null)

export function SchoolClubsProvider({ children }: { children: ReactNode }) {
  const [clubs, setClubs] = useState<SchoolClub[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setClubs(loadSchoolClubs())
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (!isLoaded) return
    saveSchoolClubs(clubs)
  }, [clubs, isLoaded])

  const sortedClubs = useMemo(
    () => [...clubs].sort((a, b) => a.order - b.order),
    [clubs]
  )

  const registerClub = useCallback((input: RegisterClubInput) => {
    const trimmedName = input.name.trim()
    let created: SchoolClub = {
      id: "",
      name: trimmedName,
      groupIds: [input.groupId],
      groupNames: [input.groupName],
      registeredAt: new Date().toISOString(),
      order: 0,
      initialPassword: "",
      password: "",
    }
    setClubs((prev) => {
      const id = generateUniqueClubId(prev)
      const order = prev.length > 0 ? Math.max(...prev.map((c) => c.order)) + 1 : 1
      const initialPassword = generateInitialPassword()
      created = {
        ...created,
        id,
        order,
        initialPassword,
        password: initialPassword,
      }
      const next = [...prev, created]
      saveSchoolClubs(next)
      return next
    })
    return created
  }, [])

  const updateClub = useCallback((id: string, input: UpdateClubInput) => {
    let ok = false
    setClubs((prev) => {
      const target = prev.find((c) => c.id === id)
      if (!target) return prev
      const name = input.name !== undefined ? input.name.trim() : target.name
      if (!name) return prev
      const groupId = input.groupId ?? target.groupIds[0]
      const groupName =
        input.groupName ?? target.groupNames[0] ?? ""
      ok = true
      const next = prev.map((c) =>
        c.id === id
          ? {
              ...c,
              name,
              groupIds: groupId ? [groupId] : [],
              groupNames: groupName ? [groupName] : [],
            }
          : c
      )
      saveSchoolClubs(next)
      return next
    })
    return ok
  }, [])

  const deleteClub = useCallback((id: string) => {
    setClubs((prev) => {
      const next = prev
        .filter((c) => c.id !== id)
        .map((c, idx) => ({ ...c, order: idx + 1 }))
      saveSchoolClubs(next)
      return next
    })
  }, [])

  const setClubsOrder = useCallback((ordered: SchoolClub[]) => {
    setClubs(() => {
      const next = ordered.map((c, idx) => ({ ...c, order: idx + 1 }))
      saveSchoolClubs(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      clubs,
      sortedClubs,
      isLoaded,
      registerClub,
      updateClub,
      deleteClub,
      setClubsOrder,
    }),
    [
      clubs,
      sortedClubs,
      isLoaded,
      registerClub,
      updateClub,
      deleteClub,
      setClubsOrder,
    ]
  )

  return (
    <SchoolClubsContext.Provider value={value}>
      {children}
    </SchoolClubsContext.Provider>
  )
}

export function useSchoolClubs() {
  const ctx = useContext(SchoolClubsContext)
  if (!ctx) {
    throw new Error("useSchoolClubs must be used within SchoolClubsProvider")
  }
  return ctx
}

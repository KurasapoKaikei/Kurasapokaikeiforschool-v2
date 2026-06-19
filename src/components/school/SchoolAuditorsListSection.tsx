"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { GripVertical } from "lucide-react"
import { SchoolAuditorDashboardCard } from "@/components/school/SchoolAuditorDashboardCard"
import { SchoolUnassignedClubDashboardCard } from "@/components/school/SchoolUnassignedClubDashboardCard"
import { ActionConfirmDialog } from "@/components/shared/ActionConfirmDialog"
import { useActionConfirmDialog } from "@/hooks/useActionConfirmDialog"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import {
  deleteSchoolAuditor,
  filterUnassignedClubs,
  loadSchoolAuditors,
  setSchoolAuditorsOrder,
  SCHOOL_AUDITORS_CHANGED_EVENT,
  type SchoolAuditor,
} from "@/lib/schoolAuditors"
import { SCHOOL_WORKSPACE_CHANGED_EVENT } from "@/lib/schoolWorkspace"
import { schoolAuditorComposeMessagePath, SCHOOL_ROUTES } from "@/lib/schoolTheme"
import { cn } from "@/lib/utils"

const EMPTY_TEXT = "監査人が登録されていません"

function clubNamesByIds(
  clubIds: string[],
  clubs: { id: string; name: string }[]
): string[] {
  return clubIds
    .map((id) => clubs.find((c) => c.id === id)?.name)
    .filter((n): n is string => Boolean(n))
}

type SchoolAuditorsListSectionProps = {
  onEdit: (auditor: SchoolAuditor) => void
  onDeleted?: () => void
  listRefreshKey?: number
}

export function SchoolAuditorsListSection({
  onEdit,
  onDeleted,
  listRefreshKey = 0,
}: SchoolAuditorsListSectionProps) {
  const router = useRouter()
  const { sortedClubs, isLoaded: clubsLoaded } = useSchoolClubs()
  const [auditors, setAuditors] = useState<SchoolAuditor[]>([])
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const { requestConfirm, confirmProps } = useActionConfirmDialog()

  const refresh = useCallback(() => {
    try {
      setAuditors(loadSchoolAuditors())
    } catch {
      setAuditors([])
    }
  }, [])

  useEffect(() => {
    refresh()
    const onChange = () => refresh()
    window.addEventListener(SCHOOL_AUDITORS_CHANGED_EVENT, onChange)
    window.addEventListener(SCHOOL_WORKSPACE_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(SCHOOL_AUDITORS_CHANGED_EVENT, onChange)
      window.removeEventListener(SCHOOL_WORKSPACE_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [refresh, listRefreshKey])

  const handleDelete = (auditor: SchoolAuditor) => {
    requestConfirm("delete", () => {
      deleteSchoolAuditor(auditor.id)
      refresh()
      onDeleted?.()
    })
  }

  const openComposeMessage = (auditor: SchoolAuditor) => {
    router.push(schoolAuditorComposeMessagePath(auditor.id))
  }

  const handleDragStart = (id: string) => setDraggedId(id)

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (draggedId && draggedId !== id) setDragOverId(id)
  }

  const handleDrop = (e: React.DragEvent, dropId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === dropId) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }

    const from = auditors.findIndex((a) => a.id === draggedId)
    const to = auditors.findIndex((a) => a.id === dropId)
    if (from === -1 || to === -1) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }

    const reordered = [...auditors]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)

    if (setSchoolAuditorsOrder(reordered)) {
      refresh()
    }

    setDraggedId(null)
    setDragOverId(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  const unassignedClubs = useMemo(
    () => filterUnassignedClubs(sortedClubs, auditors),
    [sortedClubs, auditors]
  )

  const hasAuditors = auditors.length > 0
  const hasUnassignedClubs = unassignedClubs.length > 0
  const isEmpty = !hasAuditors && !hasUnassignedClubs

  return (
    <div className="w-full max-w-none space-y-8">
      <ActionConfirmDialog {...confirmProps} />

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {!clubsLoaded ? (
          <p className="py-12 text-center text-sm text-[#9CA3AF]">読み込み中…</p>
        ) : isEmpty ? (
          <p className="py-12 text-center text-sm text-[#6B7280]">{EMPTY_TEXT}</p>
        ) : !hasAuditors ? (
          <p className="pb-6 text-center text-sm text-[#6B7280]">{EMPTY_TEXT}</p>
        ) : (
          <>
            <p className="mb-4 text-xs text-[#9CA3AF]">
              カードをドラッグして監査人の表示順を変更できます
            </p>
            <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {auditors.map((auditor, index) => {
                const isDragged = draggedId === auditor.id
                const isDragOver =
                  dragOverId === auditor.id && draggedId !== auditor.id

                return (
                  <div
                    key={auditor.id}
                    draggable
                    onDragStart={() => handleDragStart(auditor.id)}
                    onDragOver={(e) => handleDragOver(e, auditor.id)}
                    onDrop={(e) => handleDrop(e, auditor.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "relative cursor-move rounded-xl transition-colors",
                      isDragged && "opacity-50",
                      isDragOver && "ring-2 ring-[#4A90E2] ring-offset-2"
                    )}
                  >
                    <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5 shadow-sm">
                      <GripVertical
                        className="h-4 w-4 text-[#6B7280]"
                        aria-hidden
                      />
                      <span className="text-xs font-medium tabular-nums text-[#6B7280]">
                        {index + 1}
                      </span>
                    </div>
                    <SchoolAuditorDashboardCard
                      auditor={auditor}
                      clubNames={clubNamesByIds(
                        auditor.assignedClubIds,
                        sortedClubs
                      )}
                      onEdit={() => onEdit(auditor)}
                      onDelete={() => handleDelete(auditor)}
                      onMessage={() => openComposeMessage(auditor)}
                    />
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {clubsLoaded && hasUnassignedClubs ? (
        <section aria-label="未割当クラブ">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-[#374151]">
                未割当クラブ
              </h3>
              <p className="mt-1 text-sm text-[#6B7280]">
                どの監査人にも割り当てられていないクラブです
              </p>
            </div>
            <p className="shrink-0 text-sm tabular-nums text-[#9CA3AF]">
              <span className="font-semibold text-amber-800">
                {unassignedClubs.length}
              </span>
              クラブ
            </p>
          </div>
          <div className="rounded-lg border border-amber-200/80 bg-white p-6 shadow-sm">
            <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {unassignedClubs.map((club) => (
                <SchoolUnassignedClubDashboardCard key={club.id} club={club} />
              ))}
            </div>
            <p className="mt-5 text-center text-xs text-[#9CA3AF]">
              <Link
                href={SCHOOL_ROUTES.auditorsRegister}
                className="font-medium text-[#4A90E2] hover:underline"
              >
                監査人登録
              </Link>
              から担当監査人を割り当てられます
            </p>
          </div>
        </section>
      ) : null}
    </div>
  )
}

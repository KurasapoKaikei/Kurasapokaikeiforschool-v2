"use client"

import { Edit2, GripVertical, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ActionConfirmDialog } from "@/components/shared/ActionConfirmDialog"
import { useActionConfirmDialog } from "@/hooks/useActionConfirmDialog"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import {
  formatAuditorDisplayName,
  deleteSchoolAuditor,
  loadSchoolAuditors,
  setSchoolAuditorsOrder,
  SCHOOL_AUDITORS_CHANGED_EVENT,
  type SchoolAuditor,
} from "@/lib/schoolAuditors"
import { SCHOOL_WORKSPACE_CHANGED_EVENT } from "@/lib/schoolWorkspace"
import { cn } from "@/lib/utils"

/** 順序｜氏名｜部署｜ID｜初期PW｜電話｜メール｜担当クラブ｜担当クラブ数｜操作 */
const BACKUP_TABLE_GRID =
  "grid w-full min-w-[82rem] grid-cols-[2rem_minmax(0,0.5fr)_minmax(0,0.48fr)_8.5rem_6.5rem_5.5rem_minmax(0,0.65fr)_minmax(12rem,2.2fr)_3.25rem_5.5rem] items-center gap-x-2"

const EMPTY_TEXT = "登録済の監査人はありません"

function clubNamesByIds(
  clubIds: string[],
  clubs: { id: string; name: string }[]
): string[] {
  return clubIds
    .map((id) => clubs.find((c) => c.id === id)?.name)
    .filter((n): n is string => Boolean(n))
}

type SchoolAuditorsAccountBackupSectionProps = {
  listRefreshKey?: number
  editingId?: string | null
  onEdit: (auditor: SchoolAuditor) => void
  onDeleted?: () => void
}

/** 監査人登録画面：ID・初期PW付きフルスペック控え一覧 */
export function SchoolAuditorsAccountBackupSection({
  listRefreshKey = 0,
  editingId = null,
  onEdit,
  onDeleted,
}: SchoolAuditorsAccountBackupSectionProps) {
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

  return (
    <div className="mt-8 w-full max-w-none">
      <ActionConfirmDialog {...confirmProps} />
      <h3 className="mb-1 text-lg font-semibold text-[#374151]">
        登録済の監査人
      </h3>
      {auditors.length > 0 ? (
        <p className="mb-4 text-xs text-[#9CA3AF]">
          行をドラッグして監査人の表示順を変更できます
        </p>
      ) : null}
      <div className="flex min-h-[200px] w-full flex-col overflow-hidden rounded-lg border border-gray-200 border-l-[5px] border-l-[#4A90E2] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <div
            className={cn(
              BACKUP_TABLE_GRID,
              "sticky top-0 z-10 shrink-0 border-b border-gray-300 bg-[#EFF6FF] px-4 py-2.5 text-center text-xs font-semibold text-[#374151]"
            )}
            role="row"
          >
            <span role="columnheader">順序</span>
            <span role="columnheader">氏名</span>
            <span role="columnheader">部署</span>
            <span role="columnheader">ID</span>
            <span role="columnheader">初期PW</span>
            <span role="columnheader">電話番号</span>
            <span role="columnheader">メールアドレス</span>
            <span role="columnheader">担当クラブ</span>
            <span role="columnheader">担当クラブ数</span>
            <span role="columnheader">操作</span>
          </div>

          {!clubsLoaded ? (
            <p className="px-4 py-10 text-center text-sm text-[#9CA3AF]">
              読み込み中…
            </p>
          ) : auditors.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-[#6B7280]">
              {EMPTY_TEXT}
            </p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {auditors.map((auditor, index) => {
                const names = clubNamesByIds(
                  auditor.assignedClubIds,
                  sortedClubs
                )
                const isEditingRow = editingId === auditor.id
                const isDragged = draggedId === auditor.id
                const isDragOver =
                  dragOverId === auditor.id && draggedId !== auditor.id
                return (
                  <li
                    key={auditor.id}
                    draggable={!isEditingRow}
                    onDragStart={() => handleDragStart(auditor.id)}
                    onDragOver={(e) => handleDragOver(e, auditor.id)}
                    onDrop={(e) => handleDrop(e, auditor.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "cursor-move transition-colors hover:bg-blue-50/40",
                      isEditingRow && "bg-[#EFF6FF]/60",
                      isDragged && "opacity-50",
                      isDragOver && "bg-[#EFF6FF]"
                    )}
                  >
                    <div
                      className={cn(BACKUP_TABLE_GRID, "px-4 py-3 text-sm")}
                      role="row"
                    >
                      <span className="flex items-center justify-center gap-1 tabular-nums text-[#6B7280]">
                        <GripVertical
                          className="h-4 w-4 shrink-0 text-[#9CA3AF]"
                          aria-hidden
                        />
                        {index + 1}
                      </span>
                      <span className="font-medium text-[#374151]">
                        {formatAuditorDisplayName(auditor)}
                      </span>
                      <span
                        className="truncate text-[#374151]"
                        title={auditor.department}
                      >
                        {auditor.department}
                      </span>
                      <span className="font-mono text-xs text-[#374151]">
                        {auditor.id}
                      </span>
                      <span className="font-mono text-xs text-[#6B7280]">
                        {auditor.initialPassword}
                      </span>
                      <span className="tabular-nums text-[#374151]">
                        {auditor.phone}
                      </span>
                      <span
                        className="truncate text-[#374151]"
                        title={auditor.email}
                      >
                        {auditor.email}
                      </span>
                      <span className="flex min-w-0 flex-wrap gap-1.5">
                        {names.length > 0 ? (
                          names.map((n) => (
                            <span
                              key={`${auditor.id}-${n}`}
                              className="inline-flex rounded bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-medium leading-snug text-[#1E40AF]"
                              title={n}
                            >
                              {n}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[#9CA3AF]">未割当</span>
                        )}
                      </span>
                      <span className="text-center tabular-nums text-[#374151]">
                        {names.length}
                      </span>
                      <span className="flex items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 shrink-0 p-0"
                          onClick={() => onEdit(auditor)}
                          aria-label="編集"
                          title="監査人を編集"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 shrink-0 p-0 text-[#EF4444] hover:text-[#EF4444]"
                          onClick={() => handleDelete(auditor)}
                          aria-label="削除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

"use client"

import { useRouter } from "next/navigation"
import { Edit2, Mail, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { AuditorAuditStatusBadge } from "@/components/school/AuditorAuditStatusBadge"
import { ActionConfirmDialog } from "@/components/shared/ActionConfirmDialog"
import { useActionConfirmDialog } from "@/hooks/useActionConfirmDialog"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import {
  deleteSchoolAuditor,
  loadSchoolAuditors,
  SCHOOL_AUDITORS_CHANGED_EVENT,
  type SchoolAuditor,
} from "@/lib/schoolAuditors"
import { schoolAuditorComposeMessagePath } from "@/lib/schoolTheme"
import { cn } from "@/lib/utils"

/** 順序｜氏名｜部署｜電話｜メール｜担当クラブ｜担当クラブ数｜監査ステータス｜操作 */
const AUDITOR_TABLE_GRID =
  "grid w-full min-w-[68rem] grid-cols-[2rem_minmax(0,0.55fr)_minmax(0,0.5fr)_6rem_minmax(0,0.7fr)_minmax(14rem,3fr)_3.75rem_8.5rem_7.75rem] items-center gap-x-2"

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
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(SCHOOL_AUDITORS_CHANGED_EVENT, onChange)
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

  return (
    <div className="w-full max-w-none rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <ActionConfirmDialog {...confirmProps} />
      <div
        className="flex min-h-[280px] w-full flex-col overflow-hidden rounded-lg border border-gray-200 border-l-[5px] border-l-[#4A90E2] bg-white shadow-sm"
      >
        <div className="overflow-x-auto">
          <div
            className={cn(
              AUDITOR_TABLE_GRID,
              "sticky top-0 z-10 shrink-0 border-b border-gray-300 bg-[#EFF6FF] px-4 py-2.5 text-center text-xs font-semibold text-[#374151]"
            )}
            role="row"
          >
            <span role="columnheader">順序</span>
            <span role="columnheader">氏名</span>
            <span role="columnheader">部署</span>
            <span role="columnheader">電話番号</span>
            <span role="columnheader">メールアドレス</span>
            <span role="columnheader">担当クラブ</span>
            <span role="columnheader">担当クラブ数</span>
            <span role="columnheader">監査ステータス</span>
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
                return (
                  <li
                    key={auditor.id}
                    className="transition-colors hover:bg-blue-50/40"
                  >
                    <div
                      className={cn(AUDITOR_TABLE_GRID, "px-4 py-3 text-sm")}
                      role="row"
                    >
                      <span className="text-center tabular-nums text-[#6B7280]">
                        {index + 1}
                      </span>
                      <span className="font-medium text-[#374151]">
                        {auditor.name}
                      </span>
                      <span
                        className="truncate text-[#374151]"
                        title={auditor.department}
                      >
                        {auditor.department}
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
                      <span className="flex justify-center">
                        <AuditorAuditStatusBadge status={auditor.auditStatus} />
                      </span>
                      <span className="flex items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 shrink-0 p-0"
                          onClick={() => openComposeMessage(auditor)}
                          aria-label="メッセージを送信"
                          title="監査人宛てメッセージを作成"
                        >
                          <Mail className="h-4 w-4 text-[#EA580C]" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 shrink-0 p-0"
                          onClick={() => onEdit(auditor)}
                          aria-label="編集"
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

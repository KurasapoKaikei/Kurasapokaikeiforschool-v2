"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { SchoolAuditorDashboardCard } from "@/components/school/SchoolAuditorDashboardCard"
import { ActionConfirmDialog } from "@/components/shared/ActionConfirmDialog"
import { useActionConfirmDialog } from "@/hooks/useActionConfirmDialog"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import {
  deleteSchoolAuditor,
  loadSchoolAuditors,
  SCHOOL_AUDITORS_CHANGED_EVENT,
  type SchoolAuditor,
} from "@/lib/schoolAuditors"
import { SCHOOL_WORKSPACE_CHANGED_EVENT } from "@/lib/schoolWorkspace"
import { schoolAuditorComposeMessagePath } from "@/lib/schoolTheme"

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

  return (
    <div className="w-full max-w-none rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <ActionConfirmDialog {...confirmProps} />

      {!clubsLoaded ? (
        <p className="py-12 text-center text-sm text-[#9CA3AF]">読み込み中…</p>
      ) : auditors.length === 0 ? (
        <p className="py-12 text-center text-sm text-[#6B7280]">{EMPTY_TEXT}</p>
      ) : (
        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {auditors.map((auditor) => (
            <SchoolAuditorDashboardCard
              key={auditor.id}
              auditor={auditor}
              clubNames={clubNamesByIds(auditor.assignedClubIds, sortedClubs)}
              onEdit={() => onEdit(auditor)}
              onDelete={() => handleDelete(auditor)}
              onMessage={() => openComposeMessage(auditor)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

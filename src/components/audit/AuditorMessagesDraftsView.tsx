"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  MessageBoxTitleBand,
} from "@/components/shared/MessageBoxTitleBand"
import {
  auditorDraftToHistoryRow,
  loadAuditorDraftMessages,
  AUDITOR_DRAFTS_CHANGED_EVENT,
} from "@/lib/auditorDraftMessages"
import {
  AUDIT_MESSAGE_BOX_ACCENT,
  AUDIT_ROUTES,
} from "@/lib/auditorTheme"
import {
  loadCurrentAuditor,
  AUDITOR_SESSION_CHANGED_EVENT,
  type CurrentAuditorSession,
} from "@/lib/currentAuditor"
import {
  SCHOOL_MESSAGE_PAGE_CONTENT_CLASS,
  SchoolMessageHistoryList,
} from "@/components/school/SchoolMessageHistoryUi"
import {
  formatSchoolClubOutboundTargetLabel,
  type PortalMessage,
} from "@/lib/portalMessages"

const DRAFT_LIST_EMPTY_TEXT = "下書きはありません"

function draftsToTableRows(
  drafts: ReturnType<typeof loadAuditorDraftMessages>
): PortalMessage[] {
  return (drafts ?? []).map((d) => {
    const row = auditorDraftToHistoryRow(d)
    return {
      id: row.id,
      subject: row.subject,
      body: d.body,
      sentAt: row.sentAt,
      targetClubId: d.targetId,
      targetClubName: row.targetClubName,
      readByClubIds: [],
      confirmedByClubIds: [],
      kind: "general",
      sender: "audit",
    }
  })
}

/** 監査人：メッセージ下書き一覧 */
export function AuditorMessagesDraftsView() {
  const router = useRouter()
  const [auditor, setAuditor] = useState<CurrentAuditorSession | null>(null)
  const [drafts, setDrafts] = useState<
    ReturnType<typeof loadAuditorDraftMessages>
  >([])

  const refresh = useCallback(() => {
    const session = loadCurrentAuditor()
    setAuditor(session)
    if (!session) return
    try {
      setDrafts(loadAuditorDraftMessages(session.id) ?? [])
    } catch {
      setDrafts([])
    }
  }, [])

  useEffect(() => {
    refresh()
    const onChange = () => refresh()
    window.addEventListener(AUDITOR_SESSION_CHANGED_EVENT, onChange)
    window.addEventListener(AUDITOR_DRAFTS_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(AUDITOR_SESSION_CHANGED_EVENT, onChange)
      window.removeEventListener(AUDITOR_DRAFTS_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [refresh])

  const tableRows = useMemo(() => draftsToTableRows(drafts), [drafts])

  if (!auditor) {
    return (
      <div className="px-6 py-8 text-sm text-[#6B7280]">
        ログイン情報を読み込み中…
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col bg-[#F5F5F0]">
      <MessageBoxTitleBand
        title="下書き"
        accentColor={AUDIT_MESSAGE_BOX_ACCENT}
        description="保存した下書きをクリックすると編集・送信できます"
      />

      <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
        <div className={SCHOOL_MESSAGE_PAGE_CONTENT_CLASS}>
          <div
            className="flex min-h-[320px] w-full flex-col overflow-hidden rounded-lg border border-gray-200 border-l-[5px] bg-white shadow-sm"
            style={{ borderLeftColor: AUDIT_MESSAGE_BOX_ACCENT }}
          >
            <SchoolMessageHistoryList
              history={tableRows}
              emptyText={DRAFT_LIST_EMPTY_TEXT}
              formatTargetLabel={formatSchoolClubOutboundTargetLabel}
              onSelect={(id) => {
                router.push(
                  `${AUDIT_ROUTES.messages}?draft=${encodeURIComponent(id)}`
                )
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

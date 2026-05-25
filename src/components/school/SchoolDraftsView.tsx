"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  SCHOOL_MESSAGE_BOX_ACCENT,
  SCHOOL_MESSAGE_PAGE_CONTENT_CLASS,
  SchoolMessageHistoryList,
} from "@/components/school/SchoolMessageHistoryUi"
import {
  MessageBoxTitleBand,
  SCHOOL_MESSAGE_BOX_BAND_COLOR,
} from "@/components/shared/MessageBoxTitleBand"
import {
  draftToHistoryRow,
  loadSchoolDraftMessages,
  PORTAL_DRAFTS_CHANGED_EVENT,
  type SchoolMessageDraft,
} from "@/lib/portalDraftMessages"
import { SCHOOL_ROUTES } from "@/lib/schoolTheme"
import type { PortalMessage } from "@/lib/portalMessages"

const DRAFT_LIST_EMPTY_TEXT = "下書きはありません"

function draftsToTableRows(drafts: SchoolMessageDraft[]): PortalMessage[] {
  return drafts.map((d) => {
    const row = draftToHistoryRow(d)
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
      audience: d.audience,
    }
  })
}

/** 学校：メッセージ下書き一覧 */
export function SchoolDraftsView() {
  const router = useRouter()
  const [drafts, setDrafts] = useState<SchoolMessageDraft[]>([])

  const refresh = useCallback(() => {
    setDrafts(loadSchoolDraftMessages())
  }, [])

  useEffect(() => {
    refresh()
    const onChange = () => refresh()
    window.addEventListener(PORTAL_DRAFTS_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(PORTAL_DRAFTS_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [refresh])

  const tableRows = useMemo(() => draftsToTableRows(drafts), [drafts])

  const handleSelectDraft = (id: string) => {
    router.push(`${SCHOOL_ROUTES.messages}?draft=${encodeURIComponent(id)}`)
  }

  return (
    <div className="flex min-h-full flex-col bg-[#F5F5F0]">
      <MessageBoxTitleBand
        accentColor={SCHOOL_MESSAGE_BOX_BAND_COLOR}
        description="保存した下書きをクリックすると編集・送信できます"
      />

      <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
        <div className={SCHOOL_MESSAGE_PAGE_CONTENT_CLASS}>
          <div
            className="flex min-h-[320px] w-full flex-col overflow-hidden rounded-lg border border-gray-200 border-l-[5px] bg-white shadow-sm"
            style={{ borderLeftColor: SCHOOL_MESSAGE_BOX_ACCENT }}
          >
            <div
              className="shrink-0 border-b-2 px-4 py-2"
              style={{ borderColor: SCHOOL_MESSAGE_BOX_ACCENT }}
            >
              <h2
                className="text-base font-semibold"
                style={{ color: SCHOOL_MESSAGE_BOX_ACCENT }}
              >
                下書き一覧
              </h2>
            </div>
            <SchoolMessageHistoryList
              history={tableRows}
              emptyText={DRAFT_LIST_EMPTY_TEXT}
              onSelect={handleSelectDraft}
              formatTargetLabel={(m) => m.targetClubName}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

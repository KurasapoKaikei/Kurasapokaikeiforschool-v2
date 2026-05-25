"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  MessageBoxTitleBand,
  SCHOOL_MESSAGE_BOX_BAND_COLOR,
} from "@/components/shared/MessageBoxTitleBand"
import {
  SchoolClubComposeForm,
  type SchoolClubComposeInitial,
} from "@/components/school/SchoolClubComposeForm"
import {
  SchoolStaffComposeForm,
  type SchoolStaffComposeInitial,
} from "@/components/school/SchoolStaffComposeForm"
import { getSchoolDraftById } from "@/lib/portalDraftMessages"
import { SCHOOL_ROUTES } from "@/lib/schoolTheme"
import {
  SCHOOL_MESSAGE_BOX_ACCENT,
  SCHOOL_MESSAGE_LIST_EMPTY_TEXT,
  SCHOOL_MESSAGE_PAGE_CONTENT_CLASS,
  SchoolMessageDetailPanel,
  SchoolMessageHistoryList,
} from "@/components/school/SchoolMessageHistoryUi"
import {
  formatSchoolClubOutboundTargetLabel,
  loadSchoolClubOutboundMessages,
  loadSchoolStaffOutboundMessages,
  PORTAL_MESSAGES_CHANGED_EVENT,
  type PortalMessage,
} from "@/lib/portalMessages"
export { SCHOOL_MESSAGE_LIST_EMPTY_TEXT } from "@/components/school/SchoolMessageHistoryUi"

const MESSAGE_BOX_ACCENT = SCHOOL_MESSAGE_BOX_ACCENT
const MESSAGE_PAGE_CONTENT_CLASS = SCHOOL_MESSAGE_PAGE_CONTENT_CLASS

type MessageTab = "club" | "staff"
type ComposeMode = MessageTab | null

type SchoolMessageListViewProps = {
  activeTab: MessageTab
  onTabChange: (tab: MessageTab) => void
  clubHistory: PortalMessage[]
  staffHistory: PortalMessage[]
  listNotice: string | null
  createButtonLabel: string
  onCreate: () => void
  selectedDetailId: string | null
  onSelectDetail: (id: string) => void
  onBackFromDetail: () => void
}

/** 学校：送信済みメッセージ一覧（タブ切替） */
function SchoolMessageListView({
  activeTab,
  onTabChange,
  clubHistory,
  staffHistory,
  listNotice,
  createButtonLabel,
  onCreate,
  selectedDetailId,
  onSelectDetail,
  onBackFromDetail,
}: SchoolMessageListViewProps) {
  const displayedHistory = activeTab === "club" ? clubHistory : staffHistory
  const listTitle = activeTab === "club" ? "クラブ宛て送信履歴" : "管理担当者宛て送信履歴"
  const selectedMessage =
    selectedDetailId != null
      ? displayedHistory.find((m) => m.id === selectedDetailId) ?? null
      : null

  if (selectedMessage) {
    return (
      <SchoolMessageDetailPanel message={selectedMessage} onBack={onBackFromDetail} />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-gray-200 bg-white px-6">
        <div className={cn(MESSAGE_PAGE_CONTENT_CLASS, "flex gap-1")} role="tablist" aria-label="メッセージ送信先">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "club"}
            onClick={() => onTabChange("club")}
            className={cn(
              "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "club"
                ? "border-[#4A90E2] text-[#4A90E2]"
                : "border-transparent text-[#6B7280] hover:text-[#374151]"
            )}
          >
            クラブ宛て
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "staff"}
            onClick={() => onTabChange("staff")}
            className={cn(
              "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "staff"
                ? "border-[#4A90E2] text-[#4A90E2]"
                : "border-transparent text-[#6B7280] hover:text-[#374151]"
            )}
          >
            管理担当者宛て
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
        <div className={MESSAGE_PAGE_CONTENT_CLASS}>
          <div className="mb-4 flex shrink-0 flex-wrap items-center justify-start gap-2">
            <Button
              type="button"
              onClick={onCreate}
              className="h-auto min-h-10 max-w-full shrink-0 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium leading-snug text-white shadow-sm hover:opacity-90"
              style={{ backgroundColor: MESSAGE_BOX_ACCENT }}
            >
              {createButtonLabel}
            </Button>
          </div>

          {listNotice ? (
            <p
              className="mb-4 rounded-md border border-[#6EE7B7] bg-[#D1FAE5]/50 px-4 py-2.5 text-sm text-[#065F46]"
              role="status"
            >
              {listNotice}
            </p>
          ) : null}

          <div
            className="flex min-h-[320px] w-full flex-col overflow-hidden rounded-lg border border-gray-200 border-l-[5px] bg-white shadow-sm"
            style={{ borderLeftColor: MESSAGE_BOX_ACCENT }}
          >
            <div
              className="shrink-0 border-b-2 px-4 py-2"
              style={{ borderColor: MESSAGE_BOX_ACCENT }}
            >
              <h2 className="text-base font-semibold" style={{ color: MESSAGE_BOX_ACCENT }}>
                {listTitle}
              </h2>
            </div>
            <SchoolMessageHistoryList
              history={displayedHistory}
              onSelect={onSelectDetail}
              formatTargetLabel={
                activeTab === "staff"
                  ? (m) => m.targetClubName
                  : formatSchoolClubOutboundTargetLabel
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function clearComposeQuery(router: ReturnType<typeof useRouter>) {
  router.replace(SCHOOL_ROUTES.messages)
}

/** 学校：メッセージBOX（一覧タブ → 作成） */
export function SchoolMessagesView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<MessageTab>("club")
  const [composeMode, setComposeMode] = useState<ComposeMode>(null)
  const [listNotice, setListNotice] = useState<string | null>(null)
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null)
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [clubComposeInitial, setClubComposeInitial] = useState<
    SchoolClubComposeInitial | undefined
  >(undefined)
  const [staffComposeInitial, setStaffComposeInitial] = useState<
    SchoolStaffComposeInitial | undefined
  >(undefined)
  const [clubHistory, setClubHistory] = useState<PortalMessage[]>([])
  const [staffHistory, setStaffHistory] = useState<PortalMessage[]>([])

  const refreshHistory = useCallback(() => {
    try {
      setClubHistory(loadSchoolClubOutboundMessages())
      setStaffHistory(loadSchoolStaffOutboundMessages())
    } catch {
      setClubHistory([])
      setStaffHistory([])
    }
  }, [])

  useEffect(() => {
    refreshHistory()
    const onChange = () => refreshHistory()
    window.addEventListener(PORTAL_MESSAGES_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(PORTAL_MESSAGES_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [refreshHistory])

  useEffect(() => {
    const draftId = searchParams.get("draft")
    if (!draftId) return
    const draft = getSchoolDraftById(draftId)
    if (!draft) return
    setEditingDraftId(draft.id)
    setListNotice(null)
    setSelectedDetailId(null)
    if (draft.audience === "staff") {
      setActiveTab("staff")
      setComposeMode("staff")
      setStaffComposeInitial({
        targetStaffId: draft.targetId,
        subject: draft.subject,
        body: draft.body,
      })
    } else {
      setActiveTab("club")
      setComposeMode("club")
      setClubComposeInitial({
        targetClubId: draft.targetId,
        subject: draft.subject,
        body: draft.body,
      })
    }
  }, [searchParams])

  const exitCompose = () => {
    setComposeMode(null)
    setListNotice(null)
    setEditingDraftId(null)
    setClubComposeInitial(undefined)
    setStaffComposeInitial(undefined)
    if (searchParams.get("draft")) clearComposeQuery(router)
  }

  const createButtonLabel =
    activeTab === "club" ? "クラブへ新規作成" : "管理担当者へ新規作成"

  const handleSent = () => {
    refreshHistory()
    setListNotice("メッセージを送信しました。一覧に反映されています。")
    exitCompose()
  }

  return (
    <div className="flex min-h-full flex-col bg-[#F5F5F0]">
      <MessageBoxTitleBand
        accentColor={SCHOOL_MESSAGE_BOX_BAND_COLOR}
        description={
          composeMode == null
            ? "クラブ・管理担当者へお知らせを配信します"
            : undefined
        }
      />

      {composeMode === "club" ? (
        <SchoolClubComposeForm
          key={editingDraftId ?? "club-new"}
          initialValues={clubComposeInitial}
          editingDraftId={editingDraftId}
          onBack={exitCompose}
          onSent={handleSent}
        />
      ) : composeMode === "staff" ? (
        <SchoolStaffComposeForm
          key={editingDraftId ?? "staff-new"}
          initialValues={staffComposeInitial}
          editingDraftId={editingDraftId}
          onBack={exitCompose}
          onSent={handleSent}
        />
      ) : (
        <SchoolMessageListView
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab)
            setListNotice(null)
            setSelectedDetailId(null)
          }}
          clubHistory={clubHistory}
          staffHistory={staffHistory}
          listNotice={listNotice}
          createButtonLabel={createButtonLabel}
          selectedDetailId={selectedDetailId}
          onSelectDetail={setSelectedDetailId}
          onBackFromDetail={() => setSelectedDetailId(null)}
          onCreate={() => {
            setListNotice(null)
            setSelectedDetailId(null)
            setEditingDraftId(null)
            setClubComposeInitial(undefined)
            setStaffComposeInitial(undefined)
            if (searchParams.get("draft")) clearComposeQuery(router)
            setComposeMode(activeTab)
          }}
        />
      )}
    </div>
  )
}

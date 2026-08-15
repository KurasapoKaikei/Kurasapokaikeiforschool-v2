"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SchoolPortalSegmentTabs } from "@/components/school/SchoolPortalSegmentTabs"
import { AuditorClubComposeForm } from "@/components/audit/AuditorClubComposeForm"
import { AuditorSchoolComposeForm } from "@/components/audit/AuditorSchoolComposeForm"
import { MessageBoxTitleBand } from "@/components/shared/MessageBoxTitleBand"
import {
  getAuditorDraftById,
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
import { SCHOOL_ROUTES } from "@/lib/schoolTheme"
import {
  SCHOOL_MESSAGE_LIST_EMPTY_TEXT,
  SCHOOL_MESSAGE_PAGE_CONTENT_CLASS,
  SchoolMessageDetailPanel,
  SchoolMessageHistoryList,
} from "@/components/school/SchoolMessageHistoryUi"
import {
  formatAuditorSchoolConversationLabel,
  formatSchoolClubOutboundTargetLabel,
  isSchoolAdminTarget,
  loadAuditorOutboundMessages,
  loadAuditorSchoolConversationMessages,
  PORTAL_MESSAGES_CHANGED_EVENT,
  type PortalMessage,
} from "@/lib/portalMessages"

const MESSAGE_BOX_ACCENT = AUDIT_MESSAGE_BOX_ACCENT
const MESSAGE_PAGE_CONTENT_CLASS = SCHOOL_MESSAGE_PAGE_CONTENT_CLASS

type MessageTab = "club" | "school"
type ComposeMode = "club" | "school" | null

type ClubComposeInitial = {
  targetClubId: string
  subject: string
  body: string
}

type SchoolComposeInitial = {
  subject: string
  body: string
}

/** 監査人：メッセージBOX（クラブ宛て / 学校管理者宛てタブ） */
export function AuditorMessagesListView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [auditor, setAuditor] = useState<CurrentAuditorSession | null>(null)
  const [activeTab, setActiveTab] = useState<MessageTab>("club")
  const [clubHistory, setClubHistory] = useState<PortalMessage[]>([])
  const [schoolHistory, setSchoolHistory] = useState<PortalMessage[]>([])
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null)
  const [listNotice, setListNotice] = useState<string | null>(null)
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [composeMode, setComposeMode] = useState<ComposeMode>(null)
  const [clubComposeInitial, setClubComposeInitial] = useState<
    ClubComposeInitial | undefined
  >(undefined)
  const [schoolComposeInitial, setSchoolComposeInitial] = useState<
    SchoolComposeInitial | undefined
  >(undefined)

  const assignedClubIds = auditor?.assignedClubIds ?? []
  const didAutoOpenSchoolTab = useRef(false)

  const refresh = useCallback(() => {
    const session = loadCurrentAuditor()
    setAuditor(session)
    if (!session) return

    try {
      setClubHistory(
        loadAuditorOutboundMessages(session.id, session.assignedClubIds ?? [])
      )
    } catch {
      setClubHistory([])
    }

    try {
      setSchoolHistory(loadAuditorSchoolConversationMessages(session.id))
    } catch {
      setSchoolHistory([])
    }
  }, [])

  useEffect(() => {
    refresh()
    const onChange = () => refresh()
    window.addEventListener(AUDITOR_SESSION_CHANGED_EVENT, onChange)
    window.addEventListener(PORTAL_MESSAGES_CHANGED_EVENT, onChange)
    window.addEventListener(AUDITOR_DRAFTS_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(AUDITOR_SESSION_CHANGED_EVENT, onChange)
      window.removeEventListener(PORTAL_MESSAGES_CHANGED_EVENT, onChange)
      window.removeEventListener(AUDITOR_DRAFTS_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [refresh])

  // 学校からの受信があるときは「学校管理者」タブを初期表示（1回のみ）
  useEffect(() => {
    if (!auditor) {
      didAutoOpenSchoolTab.current = false
      return
    }
    if (didAutoOpenSchoolTab.current) return
    if (searchParams.get("compose") || searchParams.get("draft")) return
    const hasSchoolInbound = schoolHistory.some(
      (m) => m.sender === "school" || m.sender === "system" || !m.sender
    )
    if (!hasSchoolInbound) return
    setActiveTab("school")
    didAutoOpenSchoolTab.current = true
  }, [auditor, schoolHistory, searchParams])

  useEffect(() => {
    if (!auditor) return

    const draftId = searchParams.get("draft")
    if (draftId) {
      const draft = getAuditorDraftById(draftId, auditor.id)
      if (!draft) return
      setEditingDraftId(draft.id)
      setListNotice(null)
      setSelectedDetailId(null)
      if (isSchoolAdminTarget(draft.targetId)) {
        setActiveTab("school")
        setComposeMode("school")
        setSchoolComposeInitial({
          subject: draft.subject,
          body: draft.body,
        })
        setClubComposeInitial(undefined)
      } else {
        setActiveTab("club")
        setComposeMode("club")
        setClubComposeInitial({
          targetClubId: draft.targetId,
          subject: draft.subject,
          body: draft.body,
        })
        setSchoolComposeInitial(undefined)
      }
      return
    }

    setEditingDraftId(null)
    const compose = searchParams.get("compose")
    const toClubId = searchParams.get("to")?.trim()

    if (compose === "school") {
      setActiveTab("school")
      setComposeMode("school")
      setSchoolComposeInitial({ subject: "", body: "" })
      setClubComposeInitial(undefined)
      return
    }

    if (compose === "1") {
      setActiveTab("club")
      setComposeMode("club")
      const target =
        toClubId && assignedClubIds.includes(toClubId)
          ? toClubId
          : assignedClubIds[0]
      if (target) {
        setClubComposeInitial({
          targetClubId: target,
          subject: "",
          body: "",
        })
      }
      setSchoolComposeInitial(undefined)
      return
    }

    setComposeMode(null)
    if (!draftId) {
      setClubComposeInitial(undefined)
      setSchoolComposeInitial(undefined)
    }
  }, [searchParams, auditor, assignedClubIds])

  const displayedHistory = activeTab === "club" ? clubHistory : schoolHistory
  const selectedMessage =
    selectedDetailId != null
      ? displayedHistory.find((m) => m.id === selectedDetailId) ?? null
      : null

  const schoolInboxCount = schoolHistory.filter(
    (m) => m.sender === "school" || m.sender === "system" || !m.sender
  ).length

  const listTitle =
    activeTab === "club"
      ? "クラブ宛て送信履歴"
      : "学校管理者とのメッセージ（受信・送信）"

  const createButtonLabel =
    activeTab === "club" ? "クラブへ新規作成" : "学校管理者へ新規作成"

  const formatLabel =
    activeTab === "club"
      ? formatSchoolClubOutboundTargetLabel
      : formatAuditorSchoolConversationLabel

  const clearComposeQuery = () => {
    router.replace(AUDIT_ROUTES.messages)
  }

  const exitCompose = () => {
    setComposeMode(null)
    setEditingDraftId(null)
    setClubComposeInitial(undefined)
    setSchoolComposeInitial(undefined)
    clearComposeQuery()
  }

  const handleTabChange = (tab: MessageTab) => {
    setActiveTab(tab)
    setListNotice(null)
    setSelectedDetailId(null)
    setComposeMode(null)
    setEditingDraftId(null)
    setClubComposeInitial(undefined)
    setSchoolComposeInitial(undefined)
    if (searchParams.get("compose") || searchParams.get("draft")) {
      clearComposeQuery()
    }
  }

  const openCompose = () => {
    setListNotice(null)
    setSelectedDetailId(null)
    setEditingDraftId(null)
    if (activeTab === "club") {
      const target = assignedClubIds[0]
      if (!target) return
      setComposeMode("club")
      setClubComposeInitial({
        targetClubId: target,
        subject: "",
        body: "",
      })
      router.push(`${AUDIT_ROUTES.messages}?compose=1&to=${encodeURIComponent(target)}`)
      return
    }
    setComposeMode("school")
    setSchoolComposeInitial({ subject: "", body: "" })
    router.push(`${AUDIT_ROUTES.messages}?compose=school`)
  }

  if (!auditor) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6">
        <p className="text-sm text-[#374151]">
          監査人としてログインしてください。
        </p>
        <Link
          href={AUDIT_ROUTES.login}
          className="ml-2 text-sm font-medium text-[#EA580C] hover:underline"
        >
          ログイン画面へ
        </Link>
      </div>
    )
  }

  if (composeMode === "club" && clubComposeInitial) {
    return (
      <div className="flex min-h-full flex-col bg-[#F5F5F0]">
        <MessageBoxTitleBand
          title="メッセージ作成"
          accentColor={MESSAGE_BOX_ACCENT}
        />
        <AuditorClubComposeForm
          key={editingDraftId ?? clubComposeInitial.targetClubId}
          auditorId={auditor.id}
          assignedClubIds={assignedClubIds}
          editingDraftId={editingDraftId}
          initialValues={clubComposeInitial}
          onBack={exitCompose}
          onSent={() => {
            setListNotice("メッセージを送信しました。一覧に反映されています。")
            exitCompose()
            refresh()
          }}
          onDraftSaved={refresh}
        />
      </div>
    )
  }

  if (composeMode === "school" && schoolComposeInitial) {
    return (
      <div className="flex min-h-full flex-col bg-[#F5F5F0]">
        <MessageBoxTitleBand
          title="メッセージ作成"
          accentColor={MESSAGE_BOX_ACCENT}
        />
        <AuditorSchoolComposeForm
          key={editingDraftId ?? "school-new"}
          auditorId={auditor.id}
          editingDraftId={editingDraftId}
          initialValues={schoolComposeInitial}
          onBack={exitCompose}
          onSent={() => {
            setListNotice("メッセージを送信しました。一覧に反映されています。")
            exitCompose()
            refresh()
          }}
          onDraftSaved={refresh}
        />
      </div>
    )
  }

  if (selectedMessage) {
    return (
      <div className="flex min-h-full flex-col bg-[#F5F5F0]">
        {auditor.simulatedBySchool ? (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-900">
            学校管理者による監査人シミュレーション中です。
            <Link
              href={SCHOOL_ROUTES.auditors}
              className="ml-2 font-medium text-[#EA580C] hover:underline"
            >
              監査人管理に戻る
            </Link>
          </div>
        ) : null}
        <SchoolMessageDetailPanel
          message={selectedMessage}
          onBack={() => setSelectedDetailId(null)}
          formatTargetLabel={formatLabel}
          counterpartyFieldLabel={
            selectedMessage.sender === "audit" ? "送信先" : "送信元"
          }
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col bg-[#F5F5F0]">
      <MessageBoxTitleBand
        title="メッセージBOX"
        accentColor={MESSAGE_BOX_ACCENT}
        description={`${auditor.name}（${auditor.id}）`}
      />
      {auditor.simulatedBySchool ? (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-900">
          学校管理者による監査人シミュレーション中です。
          <Link
            href={SCHOOL_ROUTES.auditors}
            className="ml-2 font-medium text-[#EA580C] hover:underline"
          >
            監査人管理に戻る
          </Link>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 bg-white px-6 pt-3">
          <SchoolPortalSegmentTabs
            className={MESSAGE_PAGE_CONTENT_CLASS}
            ariaLabel="メッセージ送受信先"
            tabs={[
              { id: "club", label: "クラブ宛て" },
              {
                id: "school",
                label:
                  schoolInboxCount > 0
                    ? `学校管理者（${schoolInboxCount}）`
                    : "学校管理者",
              },
            ]}
            activeId={activeTab}
            onChange={(id) => handleTabChange(id as MessageTab)}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
          <div className={MESSAGE_PAGE_CONTENT_CLASS}>
            <div className="mb-4 flex shrink-0 flex-wrap items-center justify-start gap-2">
              <Button
                type="button"
                onClick={openCompose}
                disabled={activeTab === "club" && assignedClubIds.length === 0}
                className="h-auto min-h-10 max-w-full shrink-0 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium leading-snug text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: MESSAGE_BOX_ACCENT }}
              >
                {createButtonLabel}
              </Button>
            </div>

            {activeTab === "club" && schoolInboxCount > 0 ? (
              <p
                className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900"
                role="status"
              >
                学校管理者からのお知らせが {schoolInboxCount}{" "}
                件あります。「学校管理者」タブで確認できます。
              </p>
            ) : null}

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
                <h2
                  className="text-base font-semibold"
                  style={{ color: MESSAGE_BOX_ACCENT }}
                >
                  {listTitle}
                </h2>
              </div>
              <SchoolMessageHistoryList
                history={displayedHistory}
                onSelect={setSelectedDetailId}
                emptyText={SCHOOL_MESSAGE_LIST_EMPTY_TEXT}
                formatTargetLabel={formatLabel}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

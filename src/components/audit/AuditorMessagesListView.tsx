"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SchoolPortalSegmentTabs } from "@/components/school/SchoolPortalSegmentTabs"
import { AuditorClubComposeForm } from "@/components/audit/AuditorClubComposeForm"
import {
  MessageBoxTitleBand,
} from "@/components/shared/MessageBoxTitleBand"
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
  formatSchoolClubOutboundTargetLabel,
  getMessagesForAuditor,
  loadAuditorOutboundMessages,
  PORTAL_MESSAGES_CHANGED_EVENT,
  type PortalMessage,
} from "@/lib/portalMessages"

type ListTab = "inbox" | "sent"

function formatAuditorInboundLabel(m: PortalMessage): string {
  if (m.sender === "school") return "学校"
  if (m.sender === "system") return "クラサポ"
  return "受信"
}

/** 監査人：メッセージ一覧（受信 / 送信済） */
export function AuditorMessagesListView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [auditor, setAuditor] = useState<CurrentAuditorSession | null>(null)
  const [listTab, setListTab] = useState<ListTab>("inbox")
  const [inbox, setInbox] = useState<PortalMessage[]>([])
  const [sent, setSent] = useState<PortalMessage[]>([])
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null)
  const [listNotice, setListNotice] = useState<string | null>(null)
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [composeInitial, setComposeInitial] = useState<
    | { targetClubId: string; subject: string; body: string }
    | undefined
  >(undefined)

  const refresh = useCallback(() => {
    const session = loadCurrentAuditor()
    setAuditor(session)
    if (!session) return
    try {
      setInbox(getMessagesForAuditor(session.id) ?? [])
    } catch {
      setInbox([])
    }
    try {
      setSent(
        loadAuditorOutboundMessages(
          session.id,
          session.assignedClubIds ?? []
        ) ?? []
      )
    } catch {
      setSent([])
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

  useEffect(() => {
    if (!auditor) return
    const draftId = searchParams.get("draft")
    if (draftId) {
      const draft = getAuditorDraftById(draftId, auditor.id)
      if (!draft) return
      setEditingDraftId(draft.id)
      setComposeInitial({
        targetClubId: draft.targetId,
        subject: draft.subject,
        body: draft.body,
      })
      return
    }
    setEditingDraftId(null)
    const compose = searchParams.get("compose")
    const toClubId = searchParams.get("to")?.trim()
    if (compose === "1") {
      const target =
        toClubId && (auditor.assignedClubIds ?? []).includes(toClubId)
          ? toClubId
          : (auditor.assignedClubIds ?? [])[0]
      if (target) {
        setComposeInitial({
          targetClubId: target,
          subject: "",
          body: "",
        })
      }
      return
    }
    if (!draftId) {
      setComposeInitial(undefined)
    }
  }, [searchParams, auditor])

  const displayedHistory = listTab === "inbox" ? inbox ?? [] : sent ?? []
  const selectedMessage =
    selectedDetailId != null
      ? displayedHistory.find((m) => m.id === selectedDetailId) ?? null
      : null

  const clearComposeQuery = () => {
    router.replace(AUDIT_ROUTES.messages)
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

  if (composeInitial) {
    return (
      <AuditorClubComposeForm
        key={editingDraftId ?? composeInitial.targetClubId}
        auditorId={auditor.id}
        assignedClubIds={auditor.assignedClubIds ?? []}
        editingDraftId={editingDraftId}
        initialValues={composeInitial}
        onBack={() => {
          setComposeInitial(undefined)
          setEditingDraftId(null)
          clearComposeQuery()
        }}
        onSent={() => {
          setListNotice("メッセージを送信しました。担当クラブに届きます。")
          setComposeInitial(undefined)
          setEditingDraftId(null)
          setListTab("sent")
          refresh()
          clearComposeQuery()
        }}
        onDraftSaved={refresh}
      />
    )
  }

  if (selectedMessage) {
    return (
      <div className="flex min-h-full flex-col bg-[#F5F5F0]">
        <MessageBoxTitleBand
          title="メッセージ詳細"
          accentColor={AUDIT_MESSAGE_BOX_ACCENT}
        />
        <div className="px-6 py-6">
          <div className={SCHOOL_MESSAGE_PAGE_CONTENT_CLASS}>
            <SchoolMessageDetailPanel
              message={selectedMessage}
              onBack={() => setSelectedDetailId(null)}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col bg-[#F5F5F0]">
      <MessageBoxTitleBand
        title="メッセージBOX"
        accentColor={AUDIT_MESSAGE_BOX_ACCENT}
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
            className={SCHOOL_MESSAGE_PAGE_CONTENT_CLASS}
            ariaLabel="メッセージの種類"
            tabs={[
              { id: "inbox", label: "受信一覧" },
              { id: "sent", label: "送信済一覧" },
            ]}
            activeId={listTab}
            onChange={(id) => {
              setListTab(id as ListTab)
              setSelectedDetailId(null)
            }}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
          <div className={SCHOOL_MESSAGE_PAGE_CONTENT_CLASS}>
            <div className="mb-4 flex flex-wrap items-center justify-start gap-2">
              <Button
                type="button"
                onClick={() => {
                  setEditingDraftId(null)
                  setComposeInitial({
                    targetClubId: (auditor.assignedClubIds ?? [])[0] ?? "",
                    subject: "",
                    body: "",
                  })
                  router.push(`${AUDIT_ROUTES.messages}?compose=1`)
                }}
                disabled={(auditor.assignedClubIds ?? []).length === 0}
                className="h-auto min-h-10 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: AUDIT_MESSAGE_BOX_ACCENT }}
              >
                担当クラブへメッセージ作成
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
              style={{ borderLeftColor: AUDIT_MESSAGE_BOX_ACCENT }}
            >
              <h3 className="border-b border-gray-100 px-4 py-3 text-base font-semibold text-[#374151]">
                {listTab === "inbox" ? "受信メッセージ" : "送信済メッセージ"}
              </h3>
              <SchoolMessageHistoryList
                history={displayedHistory}
                emptyText={SCHOOL_MESSAGE_LIST_EMPTY_TEXT}
                formatTargetLabel={
                  listTab === "inbox"
                    ? formatAuditorInboundLabel
                    : formatSchoolClubOutboundTargetLabel
                }
                onSelect={(id) => setSelectedDetailId(id)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

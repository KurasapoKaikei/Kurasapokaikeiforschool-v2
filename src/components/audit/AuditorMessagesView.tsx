"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  MessageBoxTitleBand,
} from "@/components/shared/MessageBoxTitleBand"
import { AuditorClubComposeForm } from "@/components/audit/AuditorClubComposeForm"
import {
  auditorDraftToHistoryRow,
  getAuditorDraftById,
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
import { SCHOOL_ROUTES } from "@/lib/schoolTheme"
import {
  SCHOOL_MESSAGE_LIST_EMPTY_TEXT,
  SCHOOL_MESSAGE_PAGE_CONTENT_CLASS,
  SchoolMessageDetailPanel,
  SchoolMessageHistoryList,
} from "@/components/school/SchoolMessageHistoryUi"
import {
  formatSchoolClubOutboundTargetLabel,
  loadAuditorOutboundMessages,
  PORTAL_MESSAGES_CHANGED_EVENT,
  type PortalMessage,
} from "@/lib/portalMessages"

type ViewMode = "list" | "compose" | "drafts"

function draftsToTableRows(
  drafts: ReturnType<typeof loadAuditorDraftMessages>
): PortalMessage[] {
  return drafts.map((d) => {
    const row = auditorDraftToHistoryRow(d)
    return {
      id: row.id,
      subject: row.subject,
      body: "",
      sentAt: row.sentAt,
      targetClubId: d.targetId,
      targetClubName: row.targetClubName,
      readByClubIds: [],
      confirmedByClubIds: [],
      kind: "general" as const,
      sender: "audit" as const,
    }
  })
}

/** 監査人：メッセージBOX（送信・下書き・履歴） */
export function AuditorMessagesView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [auditor, setAuditor] = useState<CurrentAuditorSession | null>(null)
  const [mode, setMode] = useState<ViewMode>("list")
  const [history, setHistory] = useState<PortalMessage[]>([])
  const [drafts, setDrafts] = useState<ReturnType<typeof loadAuditorDraftMessages>>(
    []
  )
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null)
  const [listNotice, setListNotice] = useState<string | null>(null)
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [composeInitial, setComposeInitial] = useState<
    | {
        targetClubId: string
        subject: string
        body: string
      }
    | undefined
  >(undefined)

  const refresh = useCallback(() => {
    const session = loadCurrentAuditor()
    setAuditor(session)
    if (!session) return
    setHistory(
      loadAuditorOutboundMessages(session.id, session.assignedClubIds)
    )
    setDrafts(loadAuditorDraftMessages(session.id))
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
    if (!draftId) return
    const draft = getAuditorDraftById(draftId, auditor.id)
    if (!draft) return
    setEditingDraftId(draft.id)
    setComposeInitial({
      targetClubId: draft.targetId,
      subject: draft.subject,
      body: draft.body,
    })
    setMode("compose")
  }, [searchParams, auditor])

  const draftRows = useMemo(() => draftsToTableRows(drafts), [drafts])

  const displayedHistory = mode === "drafts" ? draftRows : history

  const selectedMessage =
    selectedDetailId != null && mode !== "compose"
      ? displayedHistory.find((m) => m.id === selectedDetailId) ?? null
      : null

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

  if (mode === "compose") {
    return (
      <AuditorClubComposeForm
        key={editingDraftId ?? "new"}
        auditorId={auditor.id}
        assignedClubIds={auditor.assignedClubIds}
        editingDraftId={editingDraftId}
        initialValues={composeInitial}
        onBack={() => {
          setMode("list")
          setEditingDraftId(null)
          setComposeInitial(undefined)
          if (searchParams.get("draft")) {
            router.replace(AUDIT_ROUTES.messages)
          }
        }}
        onSent={() => {
          setListNotice("メッセージを送信しました。クラブ側に「監査」バッジ付きで届きます。")
          setMode("list")
          setEditingDraftId(null)
          setComposeInitial(undefined)
          refresh()
          router.replace(AUDIT_ROUTES.messages)
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
        title="監査人メッセージBOX"
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
        <div className="shrink-0 border-b border-gray-200 bg-white px-6">
          <div
            className={`${SCHOOL_MESSAGE_PAGE_CONTENT_CLASS} flex flex-wrap items-center justify-between gap-3 py-3`}
          >
            <div className="flex gap-1" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "list"}
                onClick={() => {
                  setMode("list")
                  setSelectedDetailId(null)
                }}
                className={
                  mode === "list"
                    ? "border-b-2 border-[#EA580C] px-4 py-2 text-sm font-medium text-[#EA580C]"
                    : "border-b-2 border-transparent px-4 py-2 text-sm text-[#6B7280]"
                }
              >
                送信履歴
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "drafts"}
                onClick={() => {
                  setMode("drafts")
                  setSelectedDetailId(null)
                }}
                className={
                  mode === "drafts"
                    ? "border-b-2 border-[#EA580C] px-4 py-2 text-sm font-medium text-[#EA580C]"
                    : "border-b-2 border-transparent px-4 py-2 text-sm text-[#6B7280]"
                }
              >
                下書き
              </button>
            </div>
            <Button
              type="button"
              className="text-white hover:opacity-90"
              style={{ backgroundColor: AUDIT_MESSAGE_BOX_ACCENT }}
              onClick={() => {
                setEditingDraftId(null)
                setComposeInitial(undefined)
                setMode("compose")
              }}
            >
              新規作成
            </Button>
          </div>
        </div>
        <div className="flex-1 px-6 py-6">
          <div className={SCHOOL_MESSAGE_PAGE_CONTENT_CLASS}>
            {listNotice ? (
              <p
                className="mb-4 rounded-md border border-[#6EE7B7] bg-[#D1FAE5]/50 px-4 py-2.5 text-sm text-[#065F46]"
                role="status"
              >
                {listNotice}
              </p>
            ) : null}
            <h3 className="mb-3 text-base font-semibold text-[#374151]">
              {mode === "drafts" ? "下書き一覧" : "担当クラブへの送信履歴"}
            </h3>
            <SchoolMessageHistoryList
              history={displayedHistory}
              emptyText={SCHOOL_MESSAGE_LIST_EMPTY_TEXT}
              formatTargetLabel={formatSchoolClubOutboundTargetLabel}
              onSelect={(id) => {
                if (mode === "drafts") {
                  router.push(`${AUDIT_ROUTES.messages}?draft=${encodeURIComponent(id)}`)
                  return
                }
                setSelectedDetailId(id)
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

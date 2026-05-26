"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SchoolClubComposeForm } from "@/components/school/SchoolClubComposeForm"
import {
  SCHOOL_MESSAGE_BOX_ACCENT,
  SCHOOL_MESSAGE_LIST_EMPTY_TEXT,
  SCHOOL_MESSAGE_PAGE_CONTENT_CLASS,
  SchoolMessageDetailPanel,
  SchoolMessageHistoryList,
} from "@/components/school/SchoolMessageHistoryUi"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import {
  loadSchoolClubMessagesForClub,
  PORTAL_MESSAGES_CHANGED_EVENT,
  type PortalMessage,
} from "@/lib/portalMessages"
import { SCHOOL_PAGE_TITLES, SCHOOL_ROUTES } from "@/lib/schoolTheme"

type SchoolClubMessageViewProps = {
  clubId: string
}

type ViewMode = "list" | "compose" | "detail"

/** クラブ一覧の✉から：当該クラブ関連の送信履歴・作成 */
export function SchoolClubMessageView({ clubId }: SchoolClubMessageViewProps) {
  const { sortedClubs, isLoaded } = useSchoolClubs()
  const club = useMemo(
    () => sortedClubs.find((c) => c.id === clubId),
    [sortedClubs, clubId]
  )

  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null)
  const [history, setHistory] = useState<PortalMessage[]>([])
  const [listNotice, setListNotice] = useState<string | null>(null)

  const refreshHistory = useCallback(() => {
    try {
      setHistory(loadSchoolClubMessagesForClub(clubId))
    } catch {
      setHistory([])
    }
  }, [clubId])

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

  const selectedMessage =
    selectedDetailId != null
      ? history.find((m) => m.id === selectedDetailId) ?? null
      : null

  const handleSent = () => {
    refreshHistory()
    setListNotice("メッセージを送信しました。一覧に反映されています。")
    setViewMode("list")
  }

  if (!isLoaded) {
    return (
      <div className="min-h-full bg-[#F5F5F0] px-6 py-8">
        <p className="text-sm text-[#9CA3AF]">読み込み中...</p>
      </div>
    )
  }

  if (!club) {
    return (
      <div className="min-h-full bg-[#F5F5F0] px-6 py-8">
        <div className={SCHOOL_MESSAGE_PAGE_CONTENT_CLASS}>
          <Link
            href={SCHOOL_ROUTES.clubList}
            className="mb-4 inline-flex items-center gap-1 text-sm text-[#005088] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            {SCHOOL_PAGE_TITLES.clubList}に戻る
          </Link>
          <p className="text-sm text-[#6B7280]">
            クラブ（ID: {clubId}）が見つかりません。
          </p>
        </div>
      </div>
    )
  }

  if (viewMode === "compose") {
    return (
      <div className="min-h-full bg-[#F5F5F0]">
        <div className="border-b border-gray-200 bg-white px-6 py-3">
          <div className={SCHOOL_MESSAGE_PAGE_CONTENT_CLASS}>
            <Link
              href={SCHOOL_ROUTES.clubList}
              className="inline-flex items-center gap-1 text-sm text-[#005088] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              {SCHOOL_PAGE_TITLES.clubList}に戻る
            </Link>
            <h1 className="mt-2 text-lg font-semibold text-[#374151]">
              {club.name} へのメッセージ
            </h1>
          </div>
        </div>
        <SchoolClubComposeForm
          fixedTargetClub={{ id: club.id, name: club.name }}
          title={`${club.name} へメッセージを送る`}
          backLabel="履歴一覧に戻る"
          onBack={() => {
            setViewMode("list")
            setListNotice(null)
          }}
          onSent={handleSent}
        />
      </div>
    )
  }

  if (viewMode === "detail" && selectedMessage) {
    return (
      <div className="min-h-full flex-col bg-[#F5F5F0]">
        <div className="border-b border-gray-200 bg-white px-6 py-3">
          <div className={SCHOOL_MESSAGE_PAGE_CONTENT_CLASS}>
            <Link
              href={SCHOOL_ROUTES.clubList}
              className="inline-flex items-center gap-1 text-sm text-[#005088] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              {SCHOOL_PAGE_TITLES.clubList}に戻る
            </Link>
            <h1 className="mt-2 text-lg font-semibold text-[#374151]">
              {club.name} へのメッセージ履歴
            </h1>
          </div>
        </div>
        <SchoolMessageDetailPanel
          message={selectedMessage}
          backLabel="履歴一覧に戻る"
          onBack={() => {
            setSelectedDetailId(null)
            setViewMode("list")
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col bg-[#F5F5F0]">
      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <div className={SCHOOL_MESSAGE_PAGE_CONTENT_CLASS}>
          <Link
            href={SCHOOL_ROUTES.clubList}
            className="inline-flex items-center gap-1 text-sm text-[#005088] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            {SCHOOL_PAGE_TITLES.clubList}に戻る
          </Link>
          <h1 className="mt-2 text-lg font-semibold text-[#374151]">
            {club.name} へのメッセージ履歴
          </h1>
          <p className="mt-0.5 text-xs text-[#6B7280]">
            全クラブ宛てと、このクラブへの個別送信のみ表示しています
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
        <div className={SCHOOL_MESSAGE_PAGE_CONTENT_CLASS}>
          <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-[#6B7280]">{club.id}</span>
            <Button
              type="button"
              onClick={() => {
                setListNotice(null)
                setSelectedDetailId(null)
                setViewMode("compose")
              }}
              className="h-auto min-h-10 shrink-0 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
              style={{ backgroundColor: SCHOOL_MESSAGE_BOX_ACCENT }}
            >
              クラブへ新規作成
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
                送信履歴（{club.name}）
              </h2>
            </div>
            <SchoolMessageHistoryList
              history={history}
              emptyText={SCHOOL_MESSAGE_LIST_EMPTY_TEXT}
              confirmStatusClubId={club.id}
              onSelect={(id) => {
                setSelectedDetailId(id)
                setViewMode("detail")
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ClubMessageDetailPanel } from "@/components/club/ClubMessageDetailPanel"
import {
  CLUB_MESSAGE_BOX_BAND_COLOR,
  MessageBoxTitleBand,
} from "@/components/shared/MessageBoxTitleBand"
import { ClubMessageInboxList } from "@/components/club/ClubMessageInboxList"
import { useClubSession } from "@/contexts/ClubSessionContext"
import { getPortalMessages, LEGACY_INBOX_CLUB_ID } from "@/lib/clubPortalData"
import {
  markPortalMessageRead,
  PORTAL_MESSAGES_CHANGED_EVENT,
  type ClubPortalMessageView,
} from "@/lib/portalMessages"
/** 集金実績などクラブ画面と同じ左右余白・幅 */
const CLUB_PAGE_CONTENT_CLASS = "px-6 py-4 pb-8"

/** クラブ：メッセージBOX（ダッシュボードと同一データ） */
export function ClubMessagesView() {
  const searchParams = useSearchParams()
  const { activeClub, isHydrated, isLegacyGlobalPortal } = useClubSession()
  const [messages, setMessages] = useState<ClubPortalMessageView[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const clubId =
    activeClub?.id ?? (isLegacyGlobalPortal ? LEGACY_INBOX_CLUB_ID : "")

  const refresh = useCallback(() => {
    setMessages(getPortalMessages(activeClub))
  }, [activeClub])

  useEffect(() => {
    refresh()
    const onChange = () => refresh()
    window.addEventListener(PORTAL_MESSAGES_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    const interval = setInterval(refresh, 800)
    return () => {
      window.removeEventListener(PORTAL_MESSAGES_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
      clearInterval(interval)
    }
  }, [refresh])

  // ダッシュボード等から ?id= で遷移したとき詳細を開く
  useEffect(() => {
    const id = searchParams.get("id")?.trim()
    if (id) setSelectedId(id)
  }, [searchParams])

  const selected =
    messages.find((m) => m.id === selectedId) ?? null

  useEffect(() => {
    if (!selected || !clubId || selected.isRead) return
    markPortalMessageRead(selected.id, clubId)
    refresh()
  }, [selected, clubId, refresh])

  const handleSelect = (message: ClubPortalMessageView) => {
    setSelectedId(message.id)
  }

  if (!isHydrated) {
    return <div className="min-h-[12rem] bg-[#F5F5F0]" aria-busy />
  }

  const canShowInbox = activeClub != null || isLegacyGlobalPortal

  if (!canShowInbox) {
    return (
      <div className="bg-[#F5F5F0] px-6 py-8">
        <p className="text-sm text-[#6B7280]">
          クラブでログインするとメッセージを表示できます。{" "}
          <Link href="/" className="text-[#E66A84] underline">
            ログイン画面へ
          </Link>
        </p>
      </div>
    )
  }

  const clubLabel =
    activeClub?.name ?? "デモ（従来データ）"
  const clubIdLabel = activeClub?.id ?? "—"

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F5F0]">
      <div className={`flex min-h-0 flex-1 flex-col ${CLUB_PAGE_CONTENT_CLASS}`}>
        <MessageBoxTitleBand
          accentColor={CLUB_MESSAGE_BOX_BAND_COLOR}
          description={`${clubLabel}（${clubIdLabel}）宛て`}
          className="!px-0 !pt-0"
        />

        <div
          className="grid min-h-[320px] flex-1 grid-cols-1 overflow-hidden rounded-b-lg border border-t-0 border-gray-200 bg-white lg:min-h-0 lg:grid-cols-2"
          style={{
            borderLeftWidth: 5,
            borderLeftColor: CLUB_MESSAGE_BOX_BAND_COLOR,
          }}
        >
          <div className="flex min-h-0 flex-col border-gray-200 lg:border-r">
            <ClubMessageInboxList
              messages={messages}
              variant="default"
              selectedId={selectedId}
              onSelect={handleSelect}
              className="min-h-[320px] lg:min-h-0"
            />
          </div>

          <div className="flex min-h-0 flex-col bg-[#F5F5F0] p-6">
            {selected ? (
              <ClubMessageDetailPanel
                message={selected}
                clubId={clubId}
                onConfirmed={refresh}
              />
            ) : messages.length > 0 ? (
              <p className="py-12 text-center text-sm text-[#6B7280]">
                左の一覧からメッセージを選択してください
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

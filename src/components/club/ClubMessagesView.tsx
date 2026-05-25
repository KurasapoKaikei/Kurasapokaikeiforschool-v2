"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ClubMessageInboxList } from "@/components/club/ClubMessageInboxList"
import { ClubMessageSenderBadge } from "@/components/club/ClubMessageSenderBadge"
import { ClubPortalYearBar } from "@/components/club/ClubPortalYearBar"
import { useClubSession } from "@/contexts/ClubSessionContext"
import { getPortalMessages } from "@/lib/clubPortalData"
import {
  markPortalMessageRead,
  PORTAL_MESSAGES_CHANGED_EVENT,
  type ClubPortalMessageView,
} from "@/lib/portalMessages"
import { clubPath } from "@/lib/routes"

/** クラブ：メッセージBOX（ダッシュボードと同一データ） */
export function ClubMessagesView() {
  const { activeClub, isHydrated, isLegacyGlobalPortal } = useClubSession()
  const [selectedYear, setSelectedYear] = useState("2026年度")
  const [messages, setMessages] = useState<ClubPortalMessageView[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const clubId = activeClub?.id ?? ""

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

  const selected =
    messages.find((m) => m.id === selectedId) ?? null

  const handleSelect = (message: ClubPortalMessageView) => {
    setSelectedId(message.id)
    if (clubId && !message.isRead) {
      markPortalMessageRead(message.id, clubId)
      refresh()
    }
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
      <ClubPortalYearBar
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
      />

      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <Link
          href={clubPath("/dashboard")}
          className="text-sm text-[#6B7280] hover:text-[#E66A84] hover:underline"
        >
          ← クラブポータルへ
        </Link>
        <h1 className="mt-2 text-xl font-bold text-[#374151]">メッセージBOX</h1>
        <p className="text-sm text-[#6B7280]">
          {clubLabel}（{clubIdLabel}）宛て
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col border-r border-gray-200 bg-white">
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
            <article className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {!selected.isRead ? (
                  <span
                    className="h-2 w-2 rounded-full bg-[#EF4444]"
                    aria-label="未読"
                  />
                ) : null}
                <ClubMessageSenderBadge
                  sender={selected.sender}
                  label={selected.senderLabel}
                />
                <span className="text-xs text-[#9CA3AF]">{selected.date}</span>
              </div>
              <h2 className="text-lg font-semibold text-[#374151]">
                {selected.subject}
              </h2>
              <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#374151]">
                {selected.body}
              </pre>
            </article>
          ) : messages.length > 0 ? (
            <p className="py-12 text-center text-sm text-[#6B7280]">
              左の一覧からメッセージを選択してください
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

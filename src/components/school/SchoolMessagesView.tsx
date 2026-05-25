"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import {
  formatPortalMessageDate,
  loadPortalMessages,
  PORTAL_MESSAGES_CHANGED_EVENT,
  sendPortalMessage,
  type PortalMessage,
} from "@/lib/portalMessages"
import { SCHOOL_BRAND_NAVY } from "@/lib/schoolTheme"

const ALL_TARGET = "all"

/** 学校：メッセージ作成・送信 */
export function SchoolMessagesView() {
  const { sortedClubs, isLoaded: clubsLoaded } = useSchoolClubs()
  const [targetClubId, setTargetClubId] = useState(ALL_TARGET)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sentNotice, setSentNotice] = useState<string | null>(null)
  const [history, setHistory] = useState<PortalMessage[]>([])

  const refreshHistory = () => setHistory(loadPortalMessages())

  useEffect(() => {
    refreshHistory()
    const onChange = () => refreshHistory()
    window.addEventListener(PORTAL_MESSAGES_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(PORTAL_MESSAGES_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [])

  const targetLabel = useMemo(() => {
    if (targetClubId === ALL_TARGET) return "全クラブ"
    return sortedClubs.find((c) => c.id === targetClubId)?.name ?? targetClubId
  }, [targetClubId, sortedClubs])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSentNotice(null)
    const trimmedSubject = subject.trim()
    const trimmedBody = body.trim()
    if (!trimmedSubject) {
      setError("件名を入力してください。")
      return
    }
    if (!trimmedBody) {
      setError("本文を入力してください。")
      return
    }
    if (targetClubId !== ALL_TARGET && !sortedClubs.some((c) => c.id === targetClubId)) {
      setError("送信先クラブを選択してください。")
      return
    }

    sendPortalMessage({
      subject: trimmedSubject,
      body: trimmedBody,
      targetClubId,
      targetClubName: targetLabel,
    })
    setSubject("")
    setBody("")
    setSentNotice(`「${targetLabel}」宛てにメッセージを送信しました。`)
    refreshHistory()
  }

  return (
    <div className="min-h-full bg-[#F5F5F0] px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-xl font-semibold text-[#374151]">メッセージBOX</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          クラブポータルへお知らせを配信します（localStorage: portal_messages）
        </p>

        <form
          onSubmit={handleSend}
          noValidate
          className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h3 className="mb-4 text-lg font-semibold text-[#374151]">新規送信</h3>

          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#374151]">
                送信先クラブ
              </label>
              {!clubsLoaded ? (
                <p className="text-sm text-[#9CA3AF]">読み込み中...</p>
              ) : (
                <select
                  value={targetClubId}
                  onChange={(e) => setTargetClubId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#005088]/40"
                >
                  <option value={ALL_TARGET}>すべて（全クラブ）</option>
                  {sortedClubs.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}（{club.id}）
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label
                htmlFor="msgSubject"
                className="mb-1.5 block text-sm font-medium text-[#374151]"
              >
                件名
              </label>
              <input
                id="msgSubject"
                type="text"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value)
                  setError(null)
                }}
                placeholder="例：決算提出期限のお知らせ"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#005088]/40"
              />
            </div>

            <div>
              <label
                htmlFor="msgBody"
                className="mb-1.5 block text-sm font-medium text-[#374151]"
              >
                本文
              </label>
              <textarea
                id="msgBody"
                value={body}
                onChange={(e) => {
                  setBody(e.target.value)
                  setError(null)
                }}
                rows={6}
                placeholder="クラブ担当者への連絡内容を入力"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#005088]/40"
              />
            </div>

            {error ? (
              <p className="text-sm text-[#EF4444]" role="alert">
                {error}
              </p>
            ) : null}
            {sentNotice ? (
              <p className="text-sm text-[#059669]" role="status">
                {sentNotice}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={!clubsLoaded}
              className="rounded-lg px-6 text-white hover:opacity-90"
              style={{ backgroundColor: SCHOOL_BRAND_NAVY }}
            >
              送信
            </Button>
          </div>
        </form>

        <section className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-[#374151]">送信履歴</h3>
          {history.length === 0 ? (
            <p className="text-sm text-[#6B7280]">まだメッセージはありません。</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {history.map((m) => (
                <li key={m.id} className="py-3 first:pt-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium text-[#374151]">{m.subject}</p>
                    <span className="text-xs text-[#9CA3AF]">
                      {formatPortalMessageDate(m.sentAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#6B7280]">
                    宛先: {m.targetClubName}
                    {m.kind === "settlement_deadline" ? "（決算期限通知）" : ""}
                  </p>
                  <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-[#6B7280]">
                    {m.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

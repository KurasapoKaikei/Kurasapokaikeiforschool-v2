"use client"

import { ClubMessageSenderBadge } from "@/components/club/ClubMessageSenderBadge"
import { Button } from "@/components/ui/button"
import {
  markPortalMessageConfirmed,
  type ClubPortalMessageView,
} from "@/lib/portalMessages"

type ClubMessageDetailPanelProps = {
  message: ClubPortalMessageView
  clubId: string
  onConfirmed: () => void
}

/** クラブ：メッセージ詳細＋受領確認 */
export function ClubMessageDetailPanel({
  message,
  clubId,
  onConfirmed,
}: ClubMessageDetailPanelProps) {
  const handleConfirm = () => {
    if (!clubId || message.isConfirmed) return
    markPortalMessageConfirmed(message.id, clubId)
    onConfirmed()
  }

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!message.isRead ? (
          <span
            className="h-2 w-2 rounded-full bg-[#EF4444]"
            aria-label="未読"
          />
        ) : null}
        <ClubMessageSenderBadge
          sender={message.sender}
          label={message.senderLabel}
        />
        <span className="text-xs tabular-nums text-[#9CA3AF]">
          {message.date} {message.time}
        </span>
      </div>
      <h2 className="text-lg font-semibold text-[#374151]">{message.subject}</h2>
      <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#374151]">
        {message.body}
      </pre>

      <div className="mt-6 border-t border-gray-100 pt-4">
        {message.isConfirmed ? (
          <span
            className="inline-flex items-center rounded-md bg-[#E5E7EB] px-3 py-2 text-sm font-medium text-[#6B7280]"
            aria-label="確認済"
          >
            確認済
          </span>
        ) : (
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!clubId}
            data-manager-action="message"
            className="rounded-lg bg-[#E66A84] px-5 text-sm font-medium text-white hover:opacity-90"
          >
            メッセージを確認しました
          </Button>
        )}
      </div>
    </article>
  )
}

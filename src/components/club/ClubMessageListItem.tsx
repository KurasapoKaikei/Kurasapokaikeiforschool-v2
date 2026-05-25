"use client"

import { ClubMessageSenderBadge } from "@/components/club/ClubMessageSenderBadge"
import type { ClubPortalMessageView } from "@/lib/portalMessages"

type ClubMessageListItemProps = {
  message: ClubPortalMessageView
  variant?: "compact" | "default"
  selected?: boolean
  onClick?: () => void
  as?: "div" | "button"
}

/** 未読赤丸 → 送信元バッジ → 件名（＋日付） */
export function ClubMessageListItem({
  message,
  variant = "default",
  selected = false,
  onClick,
  as = "div",
}: ClubMessageListItemProps) {
  const isCompact = variant === "compact"
  const interactive = as === "button" && onClick

  const rowClass = [
    "flex w-full min-w-0 items-center gap-2 text-left",
    isCompact ? "px-2 py-1.5" : "px-4 py-3",
    interactive ? "transition-colors hover:bg-[#FDF2F5]" : "",
    selected ? "bg-[#FCE7F3]" : interactive ? "" : "",
  ]
    .filter(Boolean)
    .join(" ")

  const content = (
    <>
      {!message.isRead ? (
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-[#EF4444]"
          aria-hidden
        />
      ) : (
        <span className="h-2 w-2 shrink-0" aria-hidden />
      )}
      <ClubMessageSenderBadge
        sender={message.sender}
        label={message.senderLabel}
      />
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          !message.isRead
            ? "font-semibold text-[#374151]"
            : "text-[#6B7280]"
        }`}
      >
        {message.subject}
      </span>
      <span
        className={`shrink-0 text-[#9CA3AF] tabular-nums ${
          isCompact ? "text-[10px]" : "text-xs"
        }`}
      >
        {message.date}
      </span>
    </>
  )

  if (as === "button" && onClick) {
    return (
      <button type="button" onClick={onClick} className={rowClass}>
        {content}
      </button>
    )
  }

  return <div className={rowClass}>{content}</div>
}

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

/** 未読● → 送信元バッジ → 日付 → 時間 → 件名 */
export function ClubMessageListItem({
  message,
  variant = "default",
  selected = false,
  onClick,
  as = "div",
}: ClubMessageListItemProps) {
  const isCompact = variant === "compact"
  const interactive = as === "button" && onClick
  const textSize = isCompact ? "text-xs" : "text-sm"
  const metaSize = isCompact ? "text-[10px]" : "text-xs"

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
          className="w-3 shrink-0 text-center text-sm leading-none text-[#EF4444]"
          aria-label="未読"
        >
          ●
        </span>
      ) : null}
      <ClubMessageSenderBadge
        sender={message.sender}
        label={message.senderLabel}
      />
      <span
        className={`shrink-0 tabular-nums text-[#9CA3AF] ${metaSize}`}
      >
        {message.date}
      </span>
      <span
        className={`shrink-0 tabular-nums text-[#9CA3AF] ${metaSize}`}
      >
        {message.time}
      </span>
      <span
        className={`min-w-0 flex-1 truncate ${textSize} ${
          !message.isRead
            ? "font-semibold text-[#374151]"
            : "text-[#6B7280]"
        }`}
      >
        {message.subject}
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

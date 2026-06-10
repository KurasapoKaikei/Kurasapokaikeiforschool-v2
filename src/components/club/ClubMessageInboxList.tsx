"use client"

import Link from "next/link"
import { ClubMessageListItem } from "@/components/club/ClubMessageListItem"
import {
  CLUB_MESSAGE_EMPTY_TEXT,
  type ClubPortalMessageView,
} from "@/lib/portalMessages"
import { clubPath } from "@/lib/routes"

type ClubMessageInboxListProps = {
  messages: ClubPortalMessageView[]
  variant?: "compact" | "default"
  maxItems?: number
  selectedId?: string | null
  onSelect?: (message: ClubPortalMessageView) => void
  showUnreadSummary?: boolean
  showOpenLink?: boolean
  className?: string
}

/** メッセージBOX一覧（ダッシュボード／専用ページ共通） */
export function ClubMessageInboxList({
  messages,
  variant = "default",
  maxItems,
  selectedId = null,
  onSelect,
  showUnreadSummary = false,
  showOpenLink = false,
  className = "",
}: ClubMessageInboxListProps) {
  const unreadCount = messages.filter((m) => !m.isRead).length
  const isCompact = variant === "compact"
  const displayMessages =
    maxItems != null ? messages.slice(0, maxItems) : messages

  if (messages.length === 0) {
    return (
      <div
        className={`flex flex-1 flex-col items-center justify-center px-4 py-8 text-center ${className}`}
      >
        <p className="text-sm text-[#6B7280]">{CLUB_MESSAGE_EMPTY_TEXT}</p>
      </div>
    )
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      <ul
        className={
          isCompact
            ? "min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain"
            : "min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto"
        }
      >
        {displayMessages.map((message) => (
          <li key={message.id}>
            {onSelect ? (
              <ClubMessageListItem
                as="button"
                message={message}
                variant={variant}
                selected={selectedId === message.id}
                onClick={() => onSelect(message)}
              />
            ) : (
              <ClubMessageListItem message={message} variant={variant} />
            )}
          </li>
        ))}
      </ul>
      {(showUnreadSummary && unreadCount > 0) || showOpenLink ? (
        <div className="mt-2 shrink-0 border-t border-gray-200 pt-2 px-2 flex flex-wrap items-center justify-between gap-2">
          {showUnreadSummary && unreadCount > 0 ? (
            <p className="text-xs text-[#6B7280]">
              未読:{" "}
              <span className="font-semibold text-[#EF4444]">{unreadCount}件</span>
            </p>
          ) : (
            <span />
          )}
          {showOpenLink ? (
            <Link
              href={clubPath("/messages")}
              className="text-xs font-medium text-[#4A90E2] hover:underline"
            >
              一覧を開く
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

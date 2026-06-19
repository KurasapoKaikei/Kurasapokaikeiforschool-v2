"use client"

import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  formatPortalMessageDate,
  formatPortalMessageDateTime,
  formatPortalMessageTime,
  formatSchoolClubOutboundTargetLabel,
  isMessageConfirmedByClub,
  type PortalMessage,
} from "@/lib/portalMessages"

export const SCHOOL_MESSAGE_BOX_ACCENT = "#4A90E2"

/** 一覧・作成画面で揃えるコンテンツ幅（左寄せ） */
export const SCHOOL_MESSAGE_PAGE_CONTENT_CLASS = "mx-0 w-full max-w-3xl"

/** 送信履歴テーブル：日付｜時間｜送信先｜件名（ヘッダー・データ行で共通） */
export const SCHOOL_MESSAGE_HISTORY_ROW_GRID =
  "grid w-full grid-cols-[6.5rem_3.5rem_8.5rem_minmax(0,1fr)] items-center gap-x-3"

/** 個別メッセージBOX：ステータス列あり */
export const SCHOOL_MESSAGE_HISTORY_ROW_GRID_WITH_STATUS =
  "grid w-full grid-cols-[6.5rem_3.5rem_8.5rem_minmax(0,1fr)_5.5rem] items-center gap-x-3"

function SchoolClubConfirmStatusBadge({
  confirmed,
}: {
  confirmed: boolean
}) {
  if (confirmed) {
    return (
      <span className="inline-flex shrink-0 items-center justify-center rounded px-2 py-0.5 text-[10px] font-semibold leading-none bg-[#D1FAE5] text-[#047857]">
        確認済
      </span>
    )
  }
  return (
    <span className="text-xs text-[#9CA3AF]">未確認</span>
  )
}

export const SCHOOL_MESSAGE_LIST_EMPTY_TEXT = "メッセージがありません"

export function SchoolMessageHistoryTableHeader({
  showConfirmStatus = false,
}: {
  showConfirmStatus?: boolean
}) {
  const gridClass = showConfirmStatus
    ? SCHOOL_MESSAGE_HISTORY_ROW_GRID_WITH_STATUS
    : SCHOOL_MESSAGE_HISTORY_ROW_GRID

  return (
    <div
      className={cn(
        gridClass,
        "sticky top-0 z-10 shrink-0 border-b border-gray-200 bg-[#EFF6FF] px-4 py-2.5 text-center text-xs font-semibold text-[#374151]"
      )}
      role="row"
    >
      <span role="columnheader" className="tabular-nums text-center">
        日付
      </span>
      <span role="columnheader" className="tabular-nums text-center">
        時間
      </span>
      <span role="columnheader" className="text-center">
        送信先
      </span>
      <span role="columnheader" className="text-center">
        件名
      </span>
      {showConfirmStatus ? (
        <span role="columnheader" className="text-center">
          ステータス
        </span>
      ) : null}
    </div>
  )
}

type SchoolMessageHistoryListProps = {
  history: PortalMessage[]
  onSelect: (id: string) => void
  formatTargetLabel?: (message: PortalMessage) => string
  emptyText?: string
  /** クラブ個別メッセージBOX：当該クラブの確認済ステータス列 */
  confirmStatusClubId?: string
}

export function SchoolMessageHistoryList({
  history,
  onSelect,
  formatTargetLabel = formatSchoolClubOutboundTargetLabel,
  emptyText = SCHOOL_MESSAGE_LIST_EMPTY_TEXT,
  confirmStatusClubId,
}: SchoolMessageHistoryListProps) {
  const showConfirmStatus = confirmStatusClubId != null && confirmStatusClubId !== ""
  const gridClass = showConfirmStatus
    ? SCHOOL_MESSAGE_HISTORY_ROW_GRID_WITH_STATUS
    : SCHOOL_MESSAGE_HISTORY_ROW_GRID
  if (history.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-start justify-center px-4 py-16">
        <p className="text-sm text-[#6B7280]">{emptyText}</p>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      role="table"
      aria-label="送信履歴"
    >
      <SchoolMessageHistoryTableHeader showConfirmStatus={showConfirmStatus} />
      <ul className="min-h-0 flex-1" role="rowgroup">
        {history.map((m) => {
          const targetLabel = formatTargetLabel(m)
          const confirmed =
            showConfirmStatus &&
            isMessageConfirmedByClub(m, confirmStatusClubId!)
          return (
            <li key={m.id} role="row" className="border-b border-gray-100 last:border-b-0">
              <button
                type="button"
                onClick={() => onSelect(m.id)}
                className={cn(
                  gridClass,
                  "px-4 py-3 text-left transition-colors hover:bg-[#4A90E2]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4A90E2]/40"
                )}
              >
                <span className="truncate text-sm tabular-nums text-[#6B7280]">
                  {formatPortalMessageDate(m.sentAt)}
                </span>
                <span className="truncate text-sm tabular-nums text-[#6B7280]">
                  {formatPortalMessageTime(m.sentAt)}
                </span>
                <span className="truncate text-sm text-[#6B7280]" title={targetLabel}>
                  {targetLabel}
                </span>
                <span
                  className="truncate text-sm font-medium text-[#374151]"
                  title={m.subject}
                >
                  {m.subject}
                </span>
                {showConfirmStatus ? (
                  <span className="flex justify-start">
                    <SchoolClubConfirmStatusBadge confirmed={confirmed} />
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

type SchoolMessageDetailPanelProps = {
  message: PortalMessage
  onBack: () => void
  backLabel?: string
  formatTargetLabel?: (message: PortalMessage) => string
  /** 既定は「送信先」。受信メッセージ表示時は「送信元」などに変更 */
  counterpartyFieldLabel?: string
}

export function SchoolMessageDetailPanel({
  message,
  onBack,
  backLabel = "一覧に戻る",
  formatTargetLabel = formatSchoolClubOutboundTargetLabel,
  counterpartyFieldLabel = "送信先",
}: SchoolMessageDetailPanelProps) {
  const targetLabel = formatTargetLabel(message)

  return (
    <div className="px-6 py-6">
      <div className={SCHOOL_MESSAGE_PAGE_CONTENT_CLASS}>
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#6B7280] transition-colors hover:text-[#4A90E2] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {backLabel}
        </button>

        <article
          className="rounded-lg border border-gray-200 border-l-[5px] bg-white p-6 shadow-sm"
          style={{ borderLeftColor: SCHOOL_MESSAGE_BOX_ACCENT }}
        >
          <p className="text-sm tabular-nums text-[#6B7280]">
            {formatPortalMessageDateTime(message.sentAt)}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[#374151]">{message.subject}</h2>
          <p className="mt-2 text-sm text-[#6B7280]">
            {counterpartyFieldLabel}:{" "}
            <span className="font-medium text-[#374151]">{targetLabel}</span>
          </p>
          <pre className="mt-6 whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#374151]">
            {message.body}
          </pre>
        </article>
      </div>
    </div>
  )
}

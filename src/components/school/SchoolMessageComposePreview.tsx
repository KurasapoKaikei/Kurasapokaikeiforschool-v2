"use client"

import { SCHOOL_MESSAGE_BOX_ACCENT } from "@/components/school/SchoolMessageHistoryUi"

type SchoolMessageComposePreviewProps = {
  title: string
  targetLabel: string
  targetFieldLabel?: string
  subject: string
  body: string
}

/** 送信前確認：入力内容のプレビュー */
export function SchoolMessageComposePreview({
  title,
  targetLabel,
  targetFieldLabel = "送信先",
  subject,
  body,
}: SchoolMessageComposePreviewProps) {
  return (
    <div
      className="rounded-lg border border-gray-200 border-l-[5px] bg-white p-6 shadow-sm"
      style={{ borderLeftColor: SCHOOL_MESSAGE_BOX_ACCENT }}
    >
      <h2 className="mb-4 text-lg font-semibold text-[#374151]">{title}</h2>
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="font-medium text-[#6B7280]">{targetFieldLabel}</dt>
          <dd className="mt-1 text-[#374151]">{targetLabel}</dd>
        </div>
        <div>
          <dt className="font-medium text-[#6B7280]">件名</dt>
          <dd className="mt-1 font-medium text-[#374151]">{subject}</dd>
        </div>
        <div>
          <dt className="font-medium text-[#6B7280]">本文</dt>
          <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-[#374151]">
            {body}
          </dd>
        </div>
      </dl>
    </div>
  )
}

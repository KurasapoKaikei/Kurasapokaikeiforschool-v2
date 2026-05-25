"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  approveClubSettlement,
  getClubSettlementStatus,
  getSettlementRejectReason,
  rejectClubSettlement,
  SETTLEMENT_CHANGED_EVENT,
} from "@/lib/schoolClubSettlement"
import { SchoolClubSettlementBadge } from "@/components/school/SchoolClubSettlementBadge"
import { SCHOOL_BRAND_NAVY } from "@/lib/schoolTheme"

type SchoolSettlementReviewDialogProps = {
  clubId: string
  clubName: string
  open: boolean
  onClose: () => void
}

/** 提出済クラブの承認・差戻し */
export function SchoolSettlementReviewDialog({
  clubId,
  clubName,
  open,
  onClose,
}: SchoolSettlementReviewDialogProps) {
  const [rejectReason, setRejectReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const status = getClubSettlementStatus(clubId)
  const existingReason = getSettlementRejectReason(clubId)

  const notifyChange = () => {
    window.dispatchEvent(new Event(SETTLEMENT_CHANGED_EVENT))
  }

  const handleApprove = () => {
    if (!approveClubSettlement(clubId)) {
      setError("承認できません。ステータスが「提出済」であることを確認してください。")
      return
    }
    notifyChange()
    onClose()
  }

  const handleReject = () => {
    const trimmed = rejectReason.trim()
    if (!trimmed) {
      setError("差戻し理由を入力してください。")
      return
    }
    if (!rejectClubSettlement(clubId, trimmed)) {
      setError("差戻しできません。ステータスが「提出済」であることを確認してください。")
      return
    }
    notifyChange()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settlement-review-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2
          id="settlement-review-title"
          className="text-lg font-semibold text-[#374151]"
        >
          決算データの確認・審査
        </h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          {clubName}（{clubId}）
        </p>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-[#6B7280]">現在のステータス:</span>
          <SchoolClubSettlementBadge status={status} />
        </div>

        {status === "submitted" ? (
          <>
            <p className="mt-4 text-sm text-[#374151]">
              クラブから決算データが提出されています。内容を確認のうえ、承認または差戻しを選択してください。
            </p>
            <div className="mt-4">
              <label
                htmlFor="rejectReason"
                className="mb-1.5 block text-sm font-medium text-[#374151]"
              >
                差戻し理由（差戻し時のみ必須）
              </label>
              <textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value)
                  setError(null)
                }}
                rows={3}
                placeholder="例：領収書の添付漏れがあります。修正のうえ再提出してください。"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#005088]/40"
              />
            </div>
            {error ? (
              <p className="mt-2 text-sm text-[#EF4444]" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={handleApprove}
                className="rounded-lg text-white hover:opacity-90"
                style={{ backgroundColor: SCHOOL_BRAND_NAVY }}
              >
                承認
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleReject}
                className="rounded-lg border-[#EF4444] text-[#EF4444] hover:bg-[#FEE2E2]"
              >
                差戻し
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                閉じる
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm text-[#6B7280]">
              {status === "approved"
                ? "このクラブは承認済みです。"
                : status === "rejected"
                  ? "差戻し済みです。クラブ側で再提出を待っています。"
                  : "提出済のクラブのみ審査できます。"}
            </p>
            {existingReason ? (
              <div className="mt-3 rounded-lg bg-[#FEE2E2]/50 px-3 py-2 text-sm text-[#991B1B]">
                <span className="font-medium">差戻し理由:</span> {existingReason}
              </div>
            ) : null}
            <Button type="button" variant="outline" className="mt-6" onClick={onClose}>
              閉じる
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

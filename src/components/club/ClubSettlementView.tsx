"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ClipboardCheck } from "lucide-react"
import { useClubSession } from "@/contexts/ClubSessionContext"
import { usePortalFiscalYear } from "@/contexts/PortalFiscalYearContext"
import { SchoolClubSettlementBadge } from "@/components/school/SchoolClubSettlementBadge"
import { getPortalMessages } from "@/lib/clubPortalData"
import { PORTAL_MESSAGES_CHANGED_EVENT } from "@/lib/portalMessages"
import { clubPath } from "@/lib/routes"
import {
  canSubmitSettlement,
  getClubSettlementStatus,
  getSettlementRejectReason,
  SETTLEMENT_CHANGED_EVENT,
  submitClubSettlement,
  type ClubSettlementStatus,
} from "@/lib/schoolClubSettlement"

const STATUS_HINT: Record<ClubSettlementStatus, string> = {
  draft: "入出金・帳簿の確認が終わったら、下のボタンから学校へ提出してください。",
  submitted: "学校（学生課）での審査・承認をお待ちください。",
  approved:
    "学校による承認が完了しています。次年度への繰越は学校側の操作で行われます。",
  rejected: "差戻し内容を確認し、修正のうえ再提出してください。",
}

/** クラブ：決算提出・ステータス管理 */
export function ClubSettlementView() {
  const { activeClub, isHydrated, isLegacyGlobalPortal } = useClubSession()
  const { selectedYear } = usePortalFiscalYear()
  const [settlementStatus, setSettlementStatus] = useState<ClubSettlementStatus | null>(
    null
  )
  const [rejectReason, setRejectReason] = useState<string | null>(null)
  const [submitNotice, setSubmitNotice] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  const refresh = useCallback(() => {
    if (!activeClub) {
      setSettlementStatus(null)
      setRejectReason(null)
      setUnreadCount(0)
      return
    }
    setSettlementStatus(getClubSettlementStatus(activeClub.id))
    setRejectReason(getSettlementRejectReason(activeClub.id))
    setUnreadCount(getPortalMessages(activeClub).filter((m) => !m.isRead).length)
  }, [activeClub])

  useEffect(() => {
    refresh()
    const onChange = () => refresh()
    window.addEventListener(SETTLEMENT_CHANGED_EVENT, onChange)
    window.addEventListener(PORTAL_MESSAGES_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    const interval = setInterval(refresh, 800)
    return () => {
      window.removeEventListener(SETTLEMENT_CHANGED_EVENT, onChange)
      window.removeEventListener(PORTAL_MESSAGES_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
      clearInterval(interval)
    }
  }, [refresh])

  const handleSubmit = () => {
    if (!activeClub) return
    if (!submitClubSettlement(activeClub.id)) {
      setSubmitNotice("現在のステータスでは提出できません。")
      return
    }
    setSubmitNotice("決算データを学校へ提出しました。承認をお待ちください。")
    refresh()
  }

  const canSubmit =
    activeClub && settlementStatus
      ? canSubmitSettlement(activeClub.id)
      : false

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="px-6 py-6">
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: "#005088" }}
          >
            <ClipboardCheck className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#374151]">決算</h2>
            <p className="text-sm text-[#6B7280]">
              {selectedYear}の決算提出・承認状況（{activeClub?.name ?? "—"}）
            </p>
          </div>
        </div>

        {!isHydrated ? (
          <p className="text-sm text-[#9CA3AF]" aria-busy>
            読み込み中…
          </p>
        ) : !activeClub && !isLegacyGlobalPortal ? (
          <p className="text-sm text-[#6B7280]">
            クラブでログインすると決算ステータスを表示できます。
          </p>
        ) : !activeClub && isLegacyGlobalPortal ? (
          <p className="text-sm text-[#6B7280]">
            デモ環境（従来データ）では決算提出は利用できません。学校登録クラブでログインしてください。
          </p>
        ) : settlementStatus ? (
          <div className="max-w-2xl space-y-5">
            <section className="rounded-lg border border-gray-200 bg-white px-5 py-5">
              <p className="text-sm font-medium text-[#374151]">
                現在のステータス
              </p>
              <div className="mt-3">
                <SchoolClubSettlementBadge status={settlementStatus} />
              </div>
              <p className="mt-3 text-sm text-[#6B7280]">
                {STATUS_HINT[settlementStatus]}
              </p>

              {rejectReason && settlementStatus === "rejected" ? (
                <div className="mt-4 rounded-md border border-[#FCA5A5] bg-[#FEE2E2]/40 px-3 py-2.5 text-sm text-[#991B1B]">
                  <span className="font-medium">差戻し理由:</span> {rejectReason}
                </div>
              ) : null}

              {canSubmit ? (
                <div className="mt-5 border-t border-gray-100 pt-5">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="rounded-lg bg-[#005088] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                  >
                    決算データを学校へ提出する
                  </button>
                  <p className="mt-2 text-xs text-[#6B7280]">
                    「未提出」または「差戻し」のときのみ提出できます
                  </p>
                </div>
              ) : null}

              {submitNotice ? (
                <p className="mt-3 text-sm text-[#059669]" role="status">
                  {submitNotice}
                </p>
              ) : null}
            </section>

            <section className="rounded-lg border border-gray-200 bg-white px-5 py-4">
              <p className="text-sm text-[#374151]">
                学校からのお知らせ（提出期限など）はメッセージBOXで確認できます。
              </p>
              <Link
                href={clubPath("/messages")}
                className="mt-2 inline-block text-sm font-medium text-[#4A90E2] hover:underline"
              >
                メッセージBOXを開く
                {unreadCount > 0 ? `（未読 ${unreadCount}件）` : ""}
              </Link>
            </section>

            <p className="text-xs text-[#9CA3AF]">
              クラブID: {activeClub.id} · デモ用 localStorage 連動
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

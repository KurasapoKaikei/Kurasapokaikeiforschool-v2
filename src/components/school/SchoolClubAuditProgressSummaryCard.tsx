"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useState } from "react"
import { SettlementAuditStatusBadge } from "@/components/school/SettlementAuditStatusBadge"
import {
  CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT,
  CLUB_SETTLEMENT_LOCK_CHANGED_EVENT,
} from "@/lib/clubSettlementPortalSync"
import {
  getClubAuditProgressSummary,
  type ClubAuditProgressSummary,
} from "@/lib/clubAuditProgressSummary"
import type { SchoolClub } from "@/lib/schoolClubs"
import { SETTLEMENT_CHANGED_EVENT } from "@/lib/schoolClubSettlement"
import { cn } from "@/lib/utils"

type SchoolClubAuditProgressSummaryCardProps = {
  club: SchoolClub
  /** 未割当クラブ向けの琥珀色アクセント */
  variant?: "default" | "unassigned"
  footerNote?: ReactNode
}

function SummaryRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-100 py-2.5 last:border-0">
      <span className="shrink-0 text-sm text-[#6B7280]">{label}</span>
      <span className="min-w-0 text-right text-sm">{children}</span>
    </div>
  )
}

/** 監査人ダッシュボード専用：クラブ単位の監査進捗サマリーカード */
export function SchoolClubAuditProgressSummaryCard({
  club,
  variant = "default",
  footerNote,
}: SchoolClubAuditProgressSummaryCardProps) {
  const clubId = club?.id ?? ""
  const [summary, setSummary] = useState<ClubAuditProgressSummary | null>(null)

  const refresh = useCallback(() => {
    if (!clubId) {
      setSummary(null)
      return
    }
    setSummary(
      getClubAuditProgressSummary(clubId, club?.name ?? "")
    )
  }, [club?.name, clubId])

  useEffect(() => {
    refresh()
    const onChange = () => refresh()
    window.addEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, onChange)
    window.addEventListener(CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT, onChange)
    window.addEventListener(SETTLEMENT_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    window.addEventListener("focus", onChange)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onChange()
    })
    return () => {
      window.removeEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, onChange)
      window.removeEventListener(CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT, onChange)
      window.removeEventListener(SETTLEMENT_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
      window.removeEventListener("focus", onChange)
    }
  }, [refresh])

  if (!summary) {
    return (
      <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-[#9CA3AF]">読み込み中…</p>
      </article>
    )
  }

  const isUnassigned = variant === "unassigned"

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-xl border p-5 shadow-md",
        isUnassigned
          ? "border-dashed border-amber-200 bg-white"
          : "border-gray-200 bg-white",
        summary.progressBucket === "approved" && "bg-gray-50",
        !isUnassigned &&
          summary.progressBucket !== "approved" &&
          "transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl"
      )}
    >
      <header
        className={cn(
          "mb-4 border-b pb-4",
          isUnassigned ? "border-amber-100" : "border-blue-100"
        )}
      >
        <h3 className="text-lg font-bold leading-snug text-[#374151]">
          {summary.clubName}
        </h3>
        <p className="mt-1 text-xs text-[#6B7280]">
          当期　{summary.fiscalPeriod}
        </p>
        <p className="mt-0.5 font-mono text-xs text-[#9CA3AF]">{summary.clubId}</p>
      </header>

      <div className="flex-1 space-y-0">
        <SummaryRow label="決算書・証憑の提出">
          {summary.isSubmitted && summary.submittedAt ? (
            <span className="tabular-nums text-[#374151]">{summary.submittedAt}</span>
          ) : (
            <SettlementAuditStatusBadge label="未提出" variant="muted" />
          )}
        </SummaryRow>

        <SummaryRow label="監査ステータス">
          <SettlementAuditStatusBadge
            label={summary.auditStatusLabel}
            variant={summary.auditBadgeVariant}
          />
        </SummaryRow>

        <SummaryRow label="指摘事項・メモ">
          {summary.findingCount > 0 ? (
            <span className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
              指摘あり: {summary.findingCount}件
            </span>
          ) : (
            <span className="text-[#9CA3AF]">指摘なし</span>
          )}
        </SummaryRow>

        {isUnassigned ? (
          <SummaryRow label="担当監査人">
            <span className="inline-flex min-w-[3.5rem] justify-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              未割当
            </span>
          </SummaryRow>
        ) : null}
      </div>

      {footerNote ? (
        <p className="mt-4 border-t border-gray-100 pt-3 text-xs leading-relaxed text-[#9CA3AF]">
          {footerNote}
        </p>
      ) : null}
    </article>
  )
}

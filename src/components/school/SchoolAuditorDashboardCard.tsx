"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { AuditorAssignedClubProgressSummary } from "@/components/school/AuditorAssignedClubProgressSummary"
import {
  CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT,
  CLUB_SETTLEMENT_LOCK_CHANGED_EVENT,
} from "@/lib/clubSettlementPortalSync"
import { aggregateAssignedClubAuditProgress } from "@/lib/auditorAssignedClubProgress"
import { SETTLEMENT_CHANGED_EVENT } from "@/lib/schoolClubSettlement"
import type { SchoolAuditor } from "@/lib/schoolAuditors"
import { cn } from "@/lib/utils"

type SchoolAuditorDashboardCardProps = {
  auditor: SchoolAuditor
  /** 担当クラブ名（表示順は assignedClubIds に合わせる想定） */
  clubNames: string[]
  onEdit: () => void
  onDelete: () => void
  onMessage: () => void
}

export function SchoolAuditorDashboardCard({
  auditor,
  clubNames,
  onEdit,
  onDelete,
  onMessage,
}: SchoolAuditorDashboardCardProps) {
  const [refreshKey, setRefreshKey] = useState(0)
  const bump = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    const onChange = () => bump()
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === null ||
        e.key.startsWith("is_club_settlement_locked_") ||
        e.key.startsWith("club_auditor_audit_status_")
      ) {
        bump()
      }
    }
    window.addEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, onChange)
    window.addEventListener(CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT, onChange)
    window.addEventListener(SETTLEMENT_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", onChange)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onChange()
    })
    return () => {
      window.removeEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, onChange)
      window.removeEventListener(CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT, onChange)
      window.removeEventListener(SETTLEMENT_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", onChange)
    }
  }, [bump])

  const progressCounts = useMemo(() => {
    void refreshKey
    return aggregateAssignedClubAuditProgress(auditor.assignedClubIds)
  }, [auditor.assignedClubIds, refreshKey])

  const department = auditor.department?.trim() || "—"
  const clubCount = clubNames.length

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-md",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl",
      )}
    >
      {/* 1. ヘッダー：氏名・監査人ID・担当クラブ数 */}
      <header className="border-b border-blue-100 pb-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold leading-snug text-[#374151]">
              {auditor.name}
            </h3>
            <span className="mt-0.5 block shrink-0 font-mono text-xs text-[#9CA3AF]">
              {auditor.id}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-center text-center">
            <span className="text-xs text-[#9CA3AF]">担当クラブ数</span>
            <span
              className="text-lg font-bold tabular-nums leading-snug text-[#374151]"
              aria-label={`担当クラブ数: ${clubCount}`}
            >
              {clubCount}
            </span>
          </div>
        </div>
      </header>

      {/* 2. 基本情報：部署・電話・メール */}
      <div className="mb-3 mt-3 space-y-1.5 border-b border-gray-100 pb-3 text-sm">
        <div className="flex min-w-0 gap-2">
          <span className="shrink-0 text-[#6B7280]">部署</span>
          <span className="min-w-0 text-[#374151]">{department}</span>
        </div>
        <div className="flex min-w-0 gap-2">
          <span className="shrink-0 text-[#6B7280]">電話番号</span>
          <span className="min-w-0 tabular-nums text-[#374151]">
            {auditor.phone?.trim() || "—"}
          </span>
        </div>
        <div className="flex min-w-0 gap-2">
          <span className="shrink-0 text-[#6B7280]">メールアドレス</span>
          <span
            className="min-w-0 truncate text-[#374151]"
            title={auditor.email}
          >
            {auditor.email?.trim() || "—"}
          </span>
        </div>
      </div>

      {/* 3. 監査進捗サマリー */}
      <div className="mb-4">
        <AuditorAssignedClubProgressSummary counts={progressCounts} />
      </div>

      {/* 4. 担当クラブ */}
      <div className="flex-1">
        <h4 className="text-sm font-medium text-[#6B7280]">担当クラブ</h4>
        {clubNames.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {clubNames.map((name) => (
              <span
                key={`${auditor.id}-${name}`}
                className="inline-flex max-w-full truncate rounded bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-medium leading-snug text-[#1E40AF]"
                title={name}
              >
                {name}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-[#9CA3AF]">未割当</p>
        )}
      </div>

      {/* 5. フッター：操作ボタン（左50% メッセージBOX / 右50% 編集・削除） */}
      <div className="mt-5 border-t border-gray-100 pt-4">
        <div className="flex w-full items-center gap-2">
          <Button
            type="button"
            className="h-9 min-w-0 w-1/2 rounded-lg border-0 bg-sky-500 px-3 py-1 text-center text-sm font-medium text-white shadow-none hover:bg-sky-600"
            onClick={onMessage}
            aria-label="メッセージを送信"
            title="監査人宛てメッセージを作成"
          >
            メッセージBOX
          </Button>
          <div className="flex w-1/2 gap-2">
            <Button
              type="button"
              className="h-9 min-w-0 w-1/2 rounded border-0 bg-gray-100 px-2 py-1 text-center text-sm font-medium text-gray-700 shadow-none hover:bg-gray-200"
              onClick={onEdit}
              aria-label="編集"
            >
              編集
            </Button>
            <Button
              type="button"
              className="h-9 min-w-0 w-1/2 rounded border border-red-200 bg-red-50 px-2 py-1 text-center text-sm font-medium text-red-600 shadow-none hover:bg-red-100"
              onClick={onDelete}
              aria-label="削除"
            >
              削除
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}

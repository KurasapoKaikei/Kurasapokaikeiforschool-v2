"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useUserInfo } from "@/contexts/UserInfoContext"
import {
  getCollectionSchedules,
  deleteCollectionSchedule,
  getMembers,
  type CollectionSchedule,
} from "@/utils/localStorage"
import { SettlementLockAlert } from "@/components/club/SettlementLockAlert"
import { useClubSettlementLock } from "@/hooks/useClubSettlementLock"

const THEME_COLOR = "#D99529"
const FISCAL_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const

function fiscalIndex(month: number): number {
  const idx = FISCAL_ORDER.indexOf(month as (typeof FISCAL_ORDER)[number])
  return idx >= 0 ? idx : 99
}

interface ScheduleRow {
  id: string
  monthNum: number
  monthLabel: string
  name: string
  categoryName: string
  accountTitleName: string
  counterpartyName: string
  amount: number
  memberCount: number
  lineTotal: number
  memo: string
}

type DisplayRow =
  | { kind: "data"; row: ScheduleRow; stripe: number }
  | { kind: "subtotal"; monthLabel: string; total: number; key: string }

function toMonthNum(yyyymm: string): number {
  const parts = yyyymm.split("-")
  return parts.length === 2 ? Number(parts[1]) : 0
}

const fmt = (n: number): string => n.toLocaleString()

export default function CollectionSchedulePage() {
  const { userInfo } = useUserInfo()
  const router = useRouter()
  const [schedules, setSchedules] = useState<CollectionSchedule[]>([])
  const isLocked = useClubSettlementLock()

  const loadData = useCallback(() => {
    setSchedules(getCollectionSchedules())
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const activeMemberCount = useMemo(() => {
    return getMembers().filter((m) => m.status === "active").length
  }, [schedules])

  const rows = useMemo<ScheduleRow[]>(() => {
    return schedules
      .map((s): ScheduleRow => {
        const monthNum = toMonthNum(s.targetMonth)
        const count = s.memberIds?.length ?? s.memberCount ?? 0
        return {
          id: s.id,
          monthNum,
          monthLabel: monthNum > 0 ? `${monthNum}月` : "-",
          name: s.name,
          categoryName: s.categoryName || "-",
          accountTitleName: s.accountTitleName || "-",
          counterpartyName: s.counterpartyName || "-",
          amount: s.amount,
          memberCount: count,
          lineTotal: s.amount * count,
          memo: s.memo || "",
        }
      })
      .sort((a, b) => {
        const diff = fiscalIndex(a.monthNum) - fiscalIndex(b.monthNum)
        if (diff !== 0) return diff
        return a.name.localeCompare(b.name, "ja")
      })
  }, [schedules])

  const displayRows = useMemo<DisplayRow[]>(() => {
    if (rows.length === 0) return []
    const out: DisplayRow[] = []
    let prevMonth = -1
    let monthSum = 0
    let stripe = 0

    for (const r of rows) {
      if (prevMonth !== -1 && r.monthNum !== prevMonth) {
        out.push({
          kind: "subtotal",
          monthLabel: prevMonth > 0 ? `${prevMonth}月` : "-",
          total: monthSum,
          key: `sub-${prevMonth}`,
        })
        monthSum = 0
      }
      prevMonth = r.monthNum
      monthSum += r.lineTotal
      out.push({ kind: "data", row: r, stripe })
      stripe++
    }
    if (prevMonth !== -1) {
      out.push({
        kind: "subtotal",
        monthLabel: prevMonth > 0 ? `${prevMonth}月` : "-",
        total: monthSum,
        key: `sub-${prevMonth}`,
      })
    }
    return out
  }, [rows])

  const grandTotal = useMemo(() => rows.reduce((s, r) => s + r.lineTotal, 0), [rows])

  const handleDelete = useCallback((row: ScheduleRow) => {
    if (isLocked) return
    if (!window.confirm(`「${row.name}」（${row.monthLabel}）の集金予定を削除しますか？\n関連する集金実績データも削除されます。`)) {
      return
    }
    deleteCollectionSchedule(row.id)
    setSchedules(getCollectionSchedules())
  }, [isLocked])

  const handleEdit = useCallback((row: ScheduleRow) => {
    if (isLocked) return
    router.push(`/club/collection/settings?edit=${row.id}`)
  }, [router, isLocked])

  return (
    <div className="px-6 py-8 min-h-screen bg-[#F5F5F0]">
      {/* ヘッダー */}
      <div
        className="rounded-t-lg border border-b-0 border-gray-200 px-6 py-4"
        style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR, backgroundColor: "white" }}
      >
        <h2 className="text-xl font-semibold" style={{ color: THEME_COLOR }}>
          集金予定一覧
        </h2>
        <p className="text-sm text-[#6B7280] mt-0.5">
          {userInfo.organizationName}　{userInfo.fiscalPeriod}
        </p>
        <SettlementLockAlert isLocked={isLocked} className="mt-3" />
      </div>

      {/* 操作バー */}
      <div className="bg-white border-x border-gray-200 px-6 py-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#6B7280]">
          集金設定から登録された予定の一覧（月別明細）
          <span className="ml-3 text-xs text-[#9CA3AF]">在籍部員：{activeMemberCount}名</span>
        </p>
        <span className="text-xs text-[#9CA3AF]">（単位：円）</span>
      </div>

      {/* テーブル */}
      <div className="bg-white border border-gray-200 rounded-b-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm table-fixed">
            <colgroup>
              <col style={{ width: "6.06%" }} />
              <col style={{ width: "12.12%" }} />
              <col style={{ width: "9.09%" }} />
              <col style={{ width: "9.09%" }} />
              <col style={{ width: "12.12%" }} />
              <col style={{ width: "12.12%" }} />
              <col style={{ width: "6.06%" }} />
              <col style={{ width: "12.12%" }} />
              <col style={{ width: "15.15%" }} />
              <col style={{ width: "6.06%" }} />
            </colgroup>
            <thead>
              <tr className="bg-gray-50">
                <th className="px-2 py-3 text-center font-semibold text-[#374151] border-b border-r border-gray-200 whitespace-nowrap">集金月</th>
                <th className="px-3 py-3 text-center font-semibold text-[#374151] border-b border-r border-gray-200">集金名</th>
                <th className="px-2 py-3 text-center font-semibold text-[#374151] border-b border-r border-gray-200 whitespace-nowrap">カテゴリー</th>
                <th className="px-2 py-3 text-center font-semibold text-[#374151] border-b border-r border-gray-200">科目</th>
                <th className="px-2 py-3 text-center font-semibold text-[#374151] border-b border-r border-gray-200">入金先</th>
                <th className="px-3 py-3 text-center font-semibold text-[#374151] border-b border-r border-gray-200 whitespace-nowrap">一人あたりの集金額</th>
                <th className="px-1 py-3 text-center font-semibold text-[#374151] border-b border-r border-gray-200 whitespace-nowrap text-xs">対象部員</th>
                <th className="px-3 py-3 text-center font-semibold text-[#374151] border-b border-r border-gray-200">集金総額</th>
                <th className="px-3 py-3 text-center font-semibold text-[#374151] border-b border-r border-gray-200">メモ</th>
                <th className="px-1 py-3 text-center font-semibold text-[#374151] border-b border-gray-200">操作</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-[#9CA3AF]">
                    集金予定がありません。「集金設定」から登録してください。
                  </td>
                </tr>
              ) : (
                displayRows.map((dr, i) => {
                  if (dr.kind === "subtotal") {
                    return (
                      <tr key={dr.key} className="bg-[#FEF3C7] border-b border-[#D99529]/30">
                        <td colSpan={7} className="px-3 py-2.5 text-left font-bold text-[#374151] text-xs">
                          {dr.monthLabel} 合計
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#374151]">
                          {fmt(dr.total)}
                        </td>
                        <td colSpan={2} className="bg-[#FEF3C7]" />
                      </tr>
                    )
                  }

                  const r = dr.row
                  const bg = dr.stripe % 2 === 0 ? "bg-white" : "bg-gray-50/70"
                  return (
                    <tr key={r.id} className={`border-b border-gray-100 ${bg} hover:bg-gray-50`}>
                      <td className="px-2 py-3 text-left text-[#374151] whitespace-nowrap">{r.monthLabel}</td>
                      <td className="px-3 py-3 text-left text-[#374151] font-medium truncate overflow-hidden" title={r.name}>{r.name}</td>
                      <td className="px-2 py-3 text-left text-[#374151] truncate overflow-hidden" title={r.categoryName}>{r.categoryName}</td>
                      <td className="px-2 py-3 text-left text-[#374151] truncate overflow-hidden" title={r.accountTitleName}>{r.accountTitleName}</td>
                      <td className="px-2 py-3 text-left text-[#374151] truncate overflow-hidden" title={r.counterpartyName}>{r.counterpartyName}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-[#374151]">{fmt(r.amount)}</td>
                      <td className="px-1 py-3 text-right tabular-nums text-[#374151] whitespace-nowrap">{r.memberCount}名</td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold text-[#374151]">{fmt(r.lineTotal)}</td>
                      <td className="px-3 py-3 text-left text-[#6B7280] text-xs truncate overflow-hidden" title={r.memo}>{r.memo || "-"}</td>
                      <td className="px-0 py-2 text-center overflow-visible">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            title="編集"
                            disabled={isLocked}
                            className="relative z-10 p-1.5 rounded hover:bg-gray-100 text-[#6B7280] hover:text-[#D99529] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[#6B7280] disabled:hover:bg-transparent"
                            onClick={() => handleEdit(r)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="削除"
                            disabled={isLocked}
                            className="relative z-10 p-1.5 rounded hover:bg-red-50 text-[#6B7280] hover:text-red-600 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[#6B7280] disabled:hover:bg-transparent"
                            onClick={() => handleDelete(r)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr
                  className="border-t-2"
                  style={{ borderColor: THEME_COLOR, backgroundColor: THEME_COLOR + "18" }}
                >
                  <td colSpan={7} className="px-3 py-3 text-center font-bold text-[#374151]">年間集金総額</td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold text-[#374151]">{fmt(grandTotal)}</td>
                  <td colSpan={2} style={{ backgroundColor: THEME_COLOR + "18" }} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

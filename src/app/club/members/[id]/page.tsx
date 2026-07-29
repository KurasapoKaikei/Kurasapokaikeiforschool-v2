"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import {
  getMembers,
  getCollectionSchedules,
  getCollectionRecords,
  getTransactions,
  syncAllCollectionRecords,
  sumCollectionRecordNetPaid,
  type Member,
  type CollectionSchedule,
  type CollectionRecord,
  type Transaction,
} from "@/utils/localStorage"
import { COLLECTION_STATUS_BADGE, getCollectionPaymentStatus } from "@/types"

const THEME_COLOR = "#D99529"
const FISCAL_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const
const FISCAL_START_MONTH = 4

const fmt = (n: number): string => n.toLocaleString()

/** 会計年度の期首年（4月始まり）。例: 2026-07 → 2026、2027-03 → 2026 */
function getFiscalStartYear(date: Date = new Date()): number {
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  return month >= FISCAL_START_MONTH ? year : year - 1
}

function normalizeTargetMonth(schedule: CollectionSchedule): string {
  const ym = (schedule.targetMonth || "").trim()
  const fromTarget = ym.match(/(\d{4})[-/.年](\d{1,2})/)
  if (fromTarget) {
    return `${fromTarget[1]}-${String(Number(fromTarget[2])).padStart(2, "0")}`
  }
  const due = (schedule.dueDate || "").trim()
  const fromDue = due.match(/(\d{4})[-/.年](\d{1,2})/)
  if (fromDue) {
    return `${fromDue[1]}-${String(Number(fromDue[2])).padStart(2, "0")}`
  }
  return ""
}

function toMonthNum(yyyymm: string): number {
  const m = Number((yyyymm || "").split("-")[1] || 0)
  return Number.isFinite(m) ? m : 0
}

function fiscalOrderIndex(month: number): number {
  const idx = FISCAL_ORDER.indexOf(month as (typeof FISCAL_ORDER)[number])
  return idx >= 0 ? idx : 99
}

function ymToNumber(ym: string): number | null {
  const m = ym.trim().match(/^(\d{4})[-/.年](\d{1,2})/)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null
  return year * 100 + month
}

type DetailRow = {
  scheduleId: string
  targetMonth: string
  month: number
  category: string
  subject: string
  expected: number
  monthTotal: number
  paid: number
  status: ReturnType<typeof getCollectionPaymentStatus>
  payments: { amount: number; date: string; memo: string; transactionId: string }[]
  memo: string
}

export default function MemberDetailPage() {
  const params = useParams<{ id: string }>()
  const memberId = decodeURIComponent(params?.id ?? "")

  const [members, setMembers] = useState<Member[]>([])
  const [schedules, setSchedules] = useState<CollectionSchedule[]>([])
  const [records, setRecords] = useState<CollectionRecord[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])

  const reload = useCallback(() => {
    syncAllCollectionRecords()
    setMembers(getMembers())
    setSchedules(getCollectionSchedules())
    setRecords(getCollectionRecords())
    setTransactions(getTransactions())
  }, [])

  useEffect(() => {
    reload()
    const interval = setInterval(reload, 500)
    return () => clearInterval(interval)
  }, [reload])

  const member = useMemo(() => members.find((m) => m.id === memberId) ?? null, [members, memberId])

  const recordMap = useMemo(() => {
    const map = new Map<string, CollectionRecord>()
    records.forEach((r) => map.set(`${r.scheduleId}_${r.memberId}`, r))
    return map
  }, [records])

  const memberRecordScheduleIds = useMemo(() => {
    const set = new Set<string>()
    for (const r of records) {
      if (r.memberId === memberId) set.add(r.scheduleId)
    }
    return set
  }, [records, memberId])

  const transactionMap = useMemo(() => {
    const map = new Map<string, Transaction>()
    transactions.forEach((t) => map.set(t.id, t))
    return map
  }, [transactions])

  const targetSchedules = useMemo(
    () =>
      schedules.filter((s) => {
      if (memberRecordScheduleIds.has(s.id)) return true
      if (!s.memberIds || s.memberIds.length === 0) return true
      return s.memberIds.includes(memberId)
      }),
    [schedules, memberRecordScheduleIds, memberId]
  )

  const rows = useMemo<DetailRow[]>(() => {

    const monthTotals = new Map<number, number>()
    for (const s of targetSchedules) {
      const targetMonth = normalizeTargetMonth(s)
      const month = toMonthNum(targetMonth)
      monthTotals.set(month, (monthTotals.get(month) ?? 0) + s.amount)
    }

    return targetSchedules
      .map((s) => {
        const rec = recordMap.get(`${s.id}_${memberId}`)
        const paid = rec ? sumCollectionRecordNetPaid(rec, transactions) : 0
        const targetMonth = normalizeTargetMonth(s)
        const month = toMonthNum(targetMonth)
        const status = getCollectionPaymentStatus(paid, s.amount)
        const payments = (rec?.paymentHistory ?? []).map((h) => ({
          amount: h.amount,
          date: h.date,
          memo: h.memo,
          transactionId: h.transactionId,
        }))
        const memoFromHistory = payments.map((p) => p.memo).filter((m) => m && m.trim() !== "").join(" / ")
        return {
          scheduleId: s.id,
          targetMonth,
          month,
          category: s.categoryName ?? "-",
          subject: s.accountTitleName ?? s.name,
          expected: s.amount,
          monthTotal: monthTotals.get(month) ?? s.amount,
          paid,
          status,
          payments,
          memo: memoFromHistory || s.memo || "-",
        }
      })
      .sort((a, b) => {
        const mo = fiscalOrderIndex(a.month) - fiscalOrderIndex(b.month)
        if (mo !== 0) return mo
        return a.subject.localeCompare(b.subject, "ja")
      })
  }, [memberId, targetSchedules, recordMap, transactions])

  const totals = useMemo(() => {
    const expected = rows.reduce((s, r) => s + r.expected, 0)
    const paid = rows.reduce((s, r) => s + r.paid, 0)
    return { expected, paid, unpaid: expected - paid }
  }, [rows])

  const monthProgress = useMemo(() => {
    const map = new Map<number, { expected: number; paid: number }>()
    for (const r of rows) {
      const current = map.get(r.month) ?? { expected: 0, paid: 0 }
      current.expected += r.expected
      current.paid += r.paid
      map.set(r.month, current)
    }
    return map
  }, [rows])

  const monthGroups = useMemo(() => {
    const grouped = new Map<string, DetailRow[]>()
    for (const row of rows) {
      const list = grouped.get(row.targetMonth) ?? []
      list.push(row)
      grouped.set(row.targetMonth, list)
    }

    const groups = Array.from(grouped.entries()).map(([targetMonth, items]) => {
      const month = items[0]?.month ?? 0
      const expected = items.reduce((s, r) => s + r.expected, 0)
      const paid = items.reduce((s, r) => s + r.paid, 0)
      const status = getCollectionPaymentStatus(paid, expected)
      // 同一transactionIdを1回の入金アクションとして扱い、表示は実取引額を優先
      const paymentMap = new Map<string, { amount: number; date: string; memo: string; transactionId: string }>()
      for (const p of items.flatMap((r) => r.payments)) {
        const key = p.transactionId || `${p.date}_${p.amount}_${p.memo}`
        const prev = paymentMap.get(key)
        if (prev) {
          paymentMap.set(key, { ...prev, amount: prev.amount + p.amount })
        } else {
          paymentMap.set(key, p)
        }
      }
      const payments = Array.from(paymentMap.values())
        .map((p) => {
          const tx = transactionMap.get(p.transactionId)
          if (!tx) return p
          return {
            ...p,
            amount: tx.amount, // 1回ごとの実入金額（入力値）を表示
            date: tx.date || p.date,
          }
        })
        .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return a.transactionId.localeCompare(b.transactionId)
      })
      const memo = payments
        .map((p) => p.memo?.trim())
        .filter((m): m is string => !!m)
        .join(" / ") || "-"

      return { targetMonth, month, items, expected, paid, status, payments, memo }
    })

    return groups.sort((a, b) => {
      const mo = fiscalOrderIndex(a.month) - fiscalOrderIndex(b.month)
      if (mo !== 0) return mo
      return a.targetMonth.localeCompare(b.targetMonth)
    })
  }, [rows, transactionMap])

  // ラベル・集計終端は「今日の年月」（例: 2026-07-21 → 2026年7月時点）
  const asOfDate = new Date()
  const displayYear = asOfDate.getFullYear()
  const currentMonth = asOfDate.getMonth() + 1
  const asOfLabel = `${displayYear}年${currentMonth}月時点の未収入金総額`
  const currentYm = `${displayYear}-${String(currentMonth).padStart(2, "0")}`
  const currentYmNum = ymToNumber(currentYm) ?? 0
  const currentFiscalStartYear = getFiscalStartYear(asOfDate)
  const fiscalStartYmNum = currentFiscalStartYear * 100 + FISCAL_START_MONTH
  const effectiveEndYmNum = currentYmNum
  const fiscalStartYm = `${currentFiscalStartYear}-${String(FISCAL_START_MONTH).padStart(2, "0")}`

  const overdueTotals = useMemo(() => {
    const inRange = rows.filter((r) => {
      const normalizedYmNum = ymToNumber(r.targetMonth)
      return normalizedYmNum !== null && normalizedYmNum >= fiscalStartYmNum && normalizedYmNum <= effectiveEndYmNum
    })
    const expected = inRange.reduce((s, r) => s + r.expected, 0)
    const paid = inRange.reduce((s, r) => s + r.paid, 0)
    return { expected, paid, unpaid: expected - paid }
  }, [rows, fiscalStartYmNum, effectiveEndYmNum])

  const inRangeRowCount = useMemo(
    () =>
      rows.filter((r) => {
        const normalizedYmNum = ymToNumber(r.targetMonth)
        return normalizedYmNum !== null && normalizedYmNum >= fiscalStartYmNum && normalizedYmNum <= effectiveEndYmNum
      }).length,
    [rows, fiscalStartYmNum, effectiveEndYmNum]
  )

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return
    const monthValues = targetSchedules.map((s) => ({
      scheduleId: s.id,
      rawTargetMonth: s.targetMonth,
      rawDueDate: s.dueDate,
      normalizedYm: normalizeTargetMonth(s),
      normalizedYmNum: ymToNumber(normalizeTargetMonth(s)),
    }))
    console.log("[MemberDetailMonthCheck] current_month", {
      currentYm,
      currentYmNum,
      fiscalStartYm,
      fiscalStartYmNum,
      effectiveEndYmNum,
      currentFiscalStartYear,
    })
    console.log("[MemberDetailMonthCheck] month_values", monthValues)
    console.log(
      "[MemberDetailMonthCheck] month_values_with_type",
      monthValues.map((v) => ({
        scheduleId: v.scheduleId,
        normalizedYm: v.normalizedYm,
        normalizedYmNum: v.normalizedYmNum,
        normalizedYmNumType: typeof v.normalizedYmNum,
      }))
    )
    console.debug("[MemberDetailSummary]", {
      memberId,
      schedulesTotal: schedules.length,
      targetSchedules: targetSchedules.length,
      recordsTotal: records.length,
      rowsTotal: rows.length,
      inRangeRowCount,
      expected: overdueTotals.expected,
      paid: overdueTotals.paid,
      unpaid: overdueTotals.unpaid,
      fiscalStartYm,
      currentYm,
      effectiveEndYmNum,
      inRangeMonths: rows
        .filter((r) => {
          const normalizedYmNum = ymToNumber(r.targetMonth)
          return normalizedYmNum !== null && normalizedYmNum >= fiscalStartYmNum && normalizedYmNum <= effectiveEndYmNum
        })
        .map((r) => r.targetMonth),
      monthProbe: targetSchedules.slice(0, 10).map((s) => ({
        scheduleId: s.id,
        rawTargetMonth: s.targetMonth,
        rawDueDate: s.dueDate,
        normalizedYm: normalizeTargetMonth(s),
      })),
    })
  }, [
    memberId,
    schedules.length,
    targetSchedules.length,
    records.length,
    rows.length,
    inRangeRowCount,
    overdueTotals.expected,
    overdueTotals.paid,
    overdueTotals.unpaid,
    fiscalStartYm,
    currentYm,
    currentFiscalStartYear,
    effectiveEndYmNum,
    fiscalStartYmNum,
    targetSchedules,
    rows,
  ])

  if (!member) {
    return (
      <div className="px-6 py-8 min-h-screen bg-[#F5F5F0]">
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-[#6B7280]">
          対象の部員が見つかりません。
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-8 min-h-screen bg-[#F5F5F0]">
      <div
        className="rounded-t-lg border border-b-0 border-gray-200 px-6 py-4 bg-white"
        style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR }}
      >
        <h2 className="text-xl font-semibold" style={{ color: THEME_COLOR }}>
          部員別 集金詳細
        </h2>
      </div>

      <div className="bg-white border-x border-t border-gray-200 px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-left">
          <div className="lg:col-span-1 rounded-lg border border-gray-200 p-4">
            <p className="text-2xl md:text-3xl font-bold text-[#374151] tracking-wide">
              {member.name} 様
            </p>
            <div className="mt-3 space-y-2 text-sm text-[#4B5563]">
              <p>
                <span className="text-[#6B7280]">学年:</span> {member.grade}年生
              </p>
              <p>
                <span className="text-[#6B7280]">メール:</span> {member.email || "-"}
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-lg border border-[#F59E0B]/30 bg-[#FFFBEB] p-4">
            <p className="text-xs text-[#92400E]">{asOfLabel}</p>
            <p className={`mt-1 text-3xl font-bold ${overdueTotals.unpaid > 0 ? "text-[#DC2626]" : "text-[#B45309]"}`}>
              {fmt(overdueTotals.unpaid)}
            </p>
            <p className="mt-1 text-[11px] text-[#92400E]">
              対象期間の集金設定件数: {inRangeRowCount}件
            </p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-md border border-amber-100 bg-white/70 p-3">
                <p className="text-[11px] font-medium text-[#6B7280]">現時点実績（{FISCAL_START_MONTH}月〜当月）</p>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-[#6B7280]">集金予定合計</p>
                  <p className="text-xl md:text-2xl font-bold text-[#111827]">{fmt(overdueTotals.expected)}</p>
                  <p className="text-xs text-[#6B7280]">入金実績合計</p>
                  <p className="text-xl md:text-2xl font-bold text-[#111827]">{fmt(overdueTotals.paid)}</p>
                </div>
              </div>

              <div className="rounded-md border border-gray-200 bg-white/70 p-3">
                <p className="text-[11px] font-medium text-[#6B7280]">全期間参考（年度全体）</p>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-[#6B7280]">集金予定合計</p>
                  <p className="text-base font-semibold text-[#111827]">{fmt(totals.expected)}</p>
                  <p className="text-xs text-[#6B7280]">入金実績合計</p>
                  <p className="text-base font-semibold text-[#111827]">{fmt(totals.paid)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-b-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-fixed text-sm" style={{ minWidth: 980 }}>
            <colgroup>
              <col style={{ width: "7%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "8%" }} />
              <col />
            </colgroup>
            <thead>
              <tr className="bg-[#D99529]/10">
                <th className="px-3 py-2 text-center border-b border-r border-gray-200">集金月</th>
                <th className="px-3 py-2 text-center border-b border-r border-gray-200">カテゴリー</th>
                <th className="px-3 py-2 text-center border-b border-r border-gray-200">科目</th>
                <th className="px-3 py-2 text-center border-b border-r border-gray-200">集金予定額</th>
                <th className="px-3 py-2 text-center border-b border-r border-gray-200">集金月合計</th>
                <th className="px-3 py-2 text-center border-b border-r border-gray-200">入金実績（入金日）</th>
                <th className="px-3 py-2 text-center border-b border-r border-gray-200">ステータス</th>
                <th className="px-3 py-2 text-center border-b border-gray-200">メモ</th>
              </tr>
            </thead>
            <tbody>
              {monthGroups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[#9CA3AF] border-b border-gray-200">
                    集金設定がまだされていません。
                  </td>
                </tr>
              ) : (
                monthGroups.flatMap((group) => {
                  const rowSpan = group.items.length
                  const monthState = monthProgress.get(group.month) ?? { expected: 0, paid: 0 }
                  const isMonthCompleted = monthState.expected > 0 && monthState.paid === monthState.expected
                  const bg = isMonthCompleted ? "bg-[#D99529]/25" : "bg-[#D99529]/10"
                  const badge = COLLECTION_STATUS_BADGE[group.status]
                  const diff = group.expected - group.paid
                  const autoMemo =
                    group.status === "PARTIALLY_PAID" && diff > 0
                      ? { text: `（${fmt(diff)} 未入金）`, cls: "text-red-600" }
                      : group.status === "OVERPAID" && diff < 0
                      ? { text: `（${fmt(Math.abs(diff))} 過入金）`, cls: "text-[#374151]" }
                      : null

                  return group.items.map((row, idx) => (
                    <tr key={row.scheduleId} className={`${bg} border-b border-gray-200`}>
                      {idx === 0 && (
                        <td rowSpan={rowSpan} className="px-3 py-2 text-center border-r border-gray-200 align-middle">
                          {group.month}月
                        </td>
                      )}
                      <td className="px-3 py-2 text-center border-r border-gray-200 text-[#374151]">{row.category}</td>
                      <td className="px-3 py-2 text-center border-r border-gray-200 text-[#374151]">{row.subject}</td>
                      <td className="px-3 py-2 text-center tabular-nums border-r border-gray-200">{fmt(row.expected)}</td>
                      {idx === 0 && (
                        <>
                          <td rowSpan={rowSpan} className="px-3 py-2 text-center tabular-nums border-r border-gray-200 font-semibold align-middle">
                            {fmt(group.expected)}
                          </td>
                          <td rowSpan={rowSpan} className="px-3 py-2 text-left border-r border-gray-200 align-middle">
                            {group.payments.length > 0 ? (
                              <div className="space-y-1">
                                {group.payments.map((p, i) => (
                                  <div key={`${group.targetMonth}_${p.transactionId}_${i}`} className="text-xs text-[#374151]">
                                    {fmt(p.amount)} ({(p.date || "-").replaceAll("-", "/")})
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-[#9CA3AF]">-</span>
                            )}
                          </td>
                          <td rowSpan={rowSpan} className="px-3 py-2 text-center border-r border-gray-200 align-middle">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${badge.className}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td rowSpan={rowSpan} className="px-3 py-2 pl-2 text-left align-middle">
                            {autoMemo ? (
                              <span className={`text-xs font-medium ${autoMemo.cls}`}>{autoMemo.text}</span>
                            ) : (
                              <span className="text-xs text-transparent">-</span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                })
              )}
            </tbody>
            {monthGroups.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-400">
                  <td colSpan={3} className="px-3 py-2 text-center font-bold text-[#374151] border-r border-gray-200">
                    総合計
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums font-bold text-[#374151] border-r border-gray-200">
                    {fmt(totals.expected)}
                  </td>
                  <td className="px-3 py-2 text-center font-bold border-r border-gray-200" />
                  <td className="px-3 py-2 text-center tabular-nums font-bold text-[#374151] border-r border-gray-200">
                    {fmt(totals.paid)}
                  </td>
                  <td colSpan={2} className="px-3 py-2 text-center font-bold" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}


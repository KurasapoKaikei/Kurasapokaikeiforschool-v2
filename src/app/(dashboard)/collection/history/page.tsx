"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { useUserInfo } from "@/contexts/UserInfoContext"
import {
  getMembers,
  getCollectionSchedules,
  getCollectionRecords,
  syncAllCollectionRecords,
  sumCollectionRecordNetPaid,
  type Member,
  type CollectionSchedule,
  type CollectionRecord,
} from "@/utils/localStorage"
import { COLLECTION_STATUS_BADGE, getCollectionPaymentStatus } from "@/types"

const THEME_COLOR = "#D99529"
const GRADES = [4, 3, 2, 1] as const
const GRADE_LABELS: Record<number, string> = { 1: "1年生", 2: "2年生", 3: "3年生", 4: "4年生" }
const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const

function parseFiscalStartYear(fiscalPeriod: string): number {
  const match = fiscalPeriod.match(/(\d{4})/)
  return match ? Number(match[1]) : new Date().getFullYear()
}

function monthToYYYYMM(fiscalStartYear: number, month: number): string {
  const year = month >= 4 ? fiscalStartYear : fiscalStartYear + 1
  return `${year}-${String(month).padStart(2, "0")}`
}

const fmt = (n: number): string => n.toLocaleString()

export default function CollectionHistoryPage() {
  const { userInfo } = useUserInfo()
  const fiscalStartYear = parseFiscalStartYear(userInfo.fiscalPeriod)

  const [members, setMembers] = useState<Member[]>([])
  const [schedules, setSchedules] = useState<CollectionSchedule[]>([])
  const [records, setRecords] = useState<CollectionRecord[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  const [gradeFilter, setGradeFilter] = useState<number | "all">("all")
  const [scheduleFilter, setScheduleFilter] = useState<string>("all")

  const reload = useCallback(() => {
    syncAllCollectionRecords()
    setMembers(getMembers())
    setSchedules(getCollectionSchedules())
    setRecords(getCollectionRecords())
  }, [])

  useEffect(() => {
    reload()
    setIsLoaded(true)
  }, [reload])

  useEffect(() => {
    if (!isLoaded) return
    const interval = setInterval(reload, 500)
    return () => clearInterval(interval)
  }, [isLoaded, reload])

  const schedulesByMonth = useMemo(() => {
    const map = new Map<string, CollectionSchedule[]>()
    const filtered =
      scheduleFilter === "all"
        ? schedules
        : schedules.filter((s) => s.id === scheduleFilter)
    for (const s of filtered) {
      if (!s.targetMonth) continue
      const list = map.get(s.targetMonth) ?? []
      list.push(s)
      map.set(s.targetMonth, list)
    }
    return map
  }, [schedules, scheduleFilter])

  const recordMap = useMemo(() => {
    const map = new Map<string, CollectionRecord>()
    records.forEach((r) => map.set(`${r.scheduleId}_${r.memberId}`, r))
    return map
  }, [records])

  const filteredMembers = useMemo(() => {
    let list = [...members]
    if (gradeFilter !== "all") {
      list = list.filter((m) => m.grade === gradeFilter)
    }
    return list.sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1
      if (a.grade !== b.grade) return b.grade - a.grade
      return a.name.localeCompare(b.name, "ja")
    })
  }, [members, gradeFilter])

  const getCellData = useCallback(
    (memberId: string, month: number) => {
      const yyyymm = monthToYYYYMM(fiscalStartYear, month)
      const allMonthSchedules = schedulesByMonth.get(yyyymm) ?? []
      const monthSchedules = allMonthSchedules.filter((s) => {
        if (s.memberIds && s.memberIds.length > 0) return s.memberIds.includes(memberId)
        return true
      })
      if (monthSchedules.length === 0) return { hasSchedule: false, paid: 0, total: 0, status: "UNPAID" as const }

      let paid = 0
      let total = 0
      for (const s of monthSchedules) {
        total += s.amount
        const record = recordMap.get(`${s.id}_${memberId}`)
        if (record) paid += sumCollectionRecordNetPaid(record)
      }

      const status = getCollectionPaymentStatus(paid, total)

      return { hasSchedule: true, paid, total, status }
    },
    [fiscalStartYear, schedulesByMonth, recordMap]
  )

  const monthTotals = useMemo(() => {
    return FISCAL_MONTHS.map((month) => {
      let paid = 0
      let total = 0
      for (const m of filteredMembers) {
        const cell = getCellData(m.id, month)
        paid += cell.paid
        total += cell.total
      }
      return { paid, total }
    })
  }, [filteredMembers, getCellData])

  const annualTotalPaid = monthTotals.reduce((s, t) => s + t.paid, 0)
  const annualTotalExpected = monthTotals.reduce((s, t) => s + t.total, 0)

  const getMemberAnnualTotal = useCallback(
    (memberId: string) => {
      let paid = 0
      let total = 0
      for (const month of FISCAL_MONTHS) {
        const cell = getCellData(memberId, month)
        paid += cell.paid
        total += cell.total
      }
      return { paid, total }
    },
    [getCellData]
  )

  const hasSchedules = schedules.length > 0
  const hasMembers = members.length > 0

  return (
    <div className="px-6 py-8 min-h-screen bg-[#F5F5F0]">
      {/* ページタイトル */}
      <div
        className="rounded-t-lg border border-b-0 border-gray-200 px-6 py-4"
        style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR, backgroundColor: "white" }}
      >
        <h2 className="text-xl font-semibold" style={{ color: THEME_COLOR }}>
          集金実績
        </h2>
        <p className="text-sm text-[#6B7280] mt-0.5">
          {userInfo.organizationName}　{userInfo.fiscalPeriod}
        </p>
      </div>

      {/* フィルタ・操作バー */}
      <div
        className="bg-white border-x border-t border-gray-200 px-6 py-3 flex flex-wrap items-end gap-5"
        style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR }}
      >
        <div>
          <label className="block text-xs font-medium text-[#6B7280] mb-1">学年</label>
          <div className="flex gap-1">
            <button
              onClick={() => setGradeFilter("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                gradeFilter === "all" ? "text-white" : "bg-gray-100 text-[#374151] hover:bg-gray-200"
              }`}
              style={gradeFilter === "all" ? { backgroundColor: THEME_COLOR } : {}}
            >
              すべて
            </button>
            {GRADES.map((g) => (
              <button
                key={g}
                onClick={() => setGradeFilter(g)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  gradeFilter === g ? "text-white" : "bg-gray-100 text-[#374151] hover:bg-gray-200"
                }`}
                style={gradeFilter === g ? { backgroundColor: THEME_COLOR } : {}}
              >
                {GRADE_LABELS[g]}
              </button>
            ))}
          </div>
        </div>

        {hasSchedules && (
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">集金項目</label>
            <select
              value={scheduleFilter}
              onChange={(e) => setScheduleFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#D99529] min-w-[160px]"
            >
              <option value="all">すべて</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}（{fmt(s.amount)}円）
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="ml-auto flex items-end gap-4">
          {hasMembers && (
            <span className="text-xs text-[#374151]">
              部員数：
              <span className="font-bold" style={{ color: THEME_COLOR }}>
                {filteredMembers.filter((m) => m.status === "active").length}名
              </span>
            </span>
          )}
          {hasSchedules && annualTotalExpected > 0 && (
            <span className="text-xs text-[#374151]">
              集金率：
              <span className="font-bold" style={{ color: THEME_COLOR }}>
                {Math.round((annualTotalPaid / annualTotalExpected) * 100)}%
              </span>
            </span>
          )}
          <span className="text-xs text-[#9CA3AF]">（単位：円）</span>
        </div>
      </div>

      {/* テーブルエリア */}
      <div className="bg-white border border-gray-200 rounded-b-lg overflow-hidden">
        <div
          className="px-6 py-2.5 text-sm font-semibold text-white"
          style={{ backgroundColor: THEME_COLOR }}
        >
          集金実績
          {scheduleFilter !== "all" && (
            <span className="ml-2 font-normal opacity-80">
              — {schedules.find((s) => s.id === scheduleFilter)?.name}
            </span>
          )}
        </div>

        {!hasMembers ? (
          <div className="px-6 py-16 text-center">
            <p className="text-[#9CA3AF] text-sm">
              部員を登録すると、ここに集金実績が表示されます。
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs table-fixed" style={{ minWidth: 1140 }}>
              <colgroup>
                <col style={{ width: 170 }} />
                <col style={{ width: 80 }} />
                {FISCAL_MONTHS.map((m) => (
                  <col key={m} style={{ width: 72 }} />
                ))}
                <col />
              </colgroup>
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2.5 text-center font-semibold text-[#374151] border-b border-r border-gray-200 sticky left-0 bg-gray-50 z-10">
                    氏名
                  </th>
                  <th className="px-1 py-2.5 text-center font-semibold text-[#374151] border-b border-r border-gray-200 whitespace-nowrap">
                    学年
                  </th>
                  {FISCAL_MONTHS.map((month) => {
                    const yyyymm = monthToYYYYMM(fiscalStartYear, month)
                    const hasData = schedulesByMonth.has(yyyymm)
                    return (
                      <th
                        key={month}
                        className={`px-1 py-2.5 text-center font-semibold border-b border-r border-gray-200 whitespace-nowrap ${
                          hasData ? "text-[#374151]" : "text-[#D1D5DB]"
                        }`}
                      >
                        {month}月
                      </th>
                    )
                  })}
                  <th className="px-2 py-2.5 text-center font-semibold text-[#374151] border-b border-l border-gray-200 bg-[#FEF3C7] whitespace-nowrap">
                    <div className="leading-tight">年間合計</div>
                    <div className="text-[9px] font-normal text-[#9CA3AF]">入金済 / 予定額</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member, idx) => {
                  const isRetired = member.status === "retired"
                  const isEven = idx % 2 === 0
                  const rowBg = isRetired
                    ? "bg-gray-100"
                    : isEven
                    ? "bg-white"
                    : "bg-gray-50/70"
                  const annual = getMemberAnnualTotal(member.id)

                  return (
                    <tr
                      key={member.id}
                      className={`border-b border-gray-200 ${rowBg} ${isRetired ? "opacity-50" : ""}`}
                    >
                      <td className={`px-3 py-2 text-center font-medium text-[#374151] border-r border-gray-200 sticky left-0 z-10 whitespace-nowrap overflow-hidden text-ellipsis ${rowBg}`}>
                        <Link
                          href={`/members/${encodeURIComponent(member.id)}`}
                          className="inline-block hover:underline underline-offset-2 decoration-[#D99529]"
                          title={`${member.name} の詳細ページへ`}
                        >
                          {member.name}
                        </Link>
                        {isRetired && (
                          <span className="ml-1.5 inline-block px-1.5 py-0 rounded text-[10px] bg-gray-300 text-gray-600">退部</span>
                        )}
                      </td>
                      <td className="px-1 py-2 text-center text-[#374151] border-r border-gray-200 whitespace-nowrap">
                        {GRADE_LABELS[member.grade] ?? `${member.grade}年`}
                      </td>
                      {FISCAL_MONTHS.map((month) => {
                        const cell = getCellData(member.id, month)

                        if (!cell.hasSchedule) {
                          return (
                            <td
                              key={month}
                              className="px-1 py-2 text-center text-[#D1D5DB] border-r border-gray-200"
                            >
                              -
                            </td>
                          )
                        }

                        const badge = COLLECTION_STATUS_BADGE[cell.status]
                        const detailHref = `/accounting/register/new?tab=collection&memberId=${encodeURIComponent(member.id)}&month=${month}`

                        return (
                          <td
                            key={month}
                            className="px-1 py-1.5 border-r border-gray-200"
                          >
                            <Link
                              href={detailHref}
                              className="group flex flex-col items-center gap-0.5 rounded px-1 py-0.5 transition-colors hover:bg-[#67a384]/10"
                              title={`${member.name} の ${month}月 集金入力へ移動`}
                            >
                              <span className="tabular-nums font-medium text-[#374151] text-[11px] leading-tight group-hover:underline underline-offset-2 decoration-[#67a384]">
                                {fmt(cell.total)}
                              </span>
                              {badge && (
                                <span className={`inline-block px-1.5 py-0 rounded text-[9px] font-bold leading-relaxed ${badge.className}`}>
                                  {badge.label}
                                </span>
                              )}
                            </Link>
                          </td>
                        )
                      })}
                      <td className="px-2 py-1.5 bg-[#FEF3C7]/60 border-l border-gray-200">
                        {annual.total > 0 ? (
                          <div className="flex flex-col items-center gap-0">
                            <span className="tabular-nums font-bold text-[#374151] text-[11px] leading-tight">
                              {fmt(annual.paid)}
                            </span>
                            <span className="tabular-nums text-[10px] text-[#9CA3AF] leading-tight">
                              / {fmt(annual.total)}
                            </span>
                          </div>
                        ) : (
                          <span className="block text-center text-[#D1D5DB]">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#D99529]" style={{ backgroundColor: "#D99529" + "18" }}>
                  <td
                    colSpan={2}
                    className="px-3 py-2.5 text-center font-bold text-[#374151] border-r border-gray-200 sticky left-0 z-10"
                    style={{ backgroundColor: "#D99529" + "18" }}
                  >
                    集金実績合計
                  </td>
                  {monthTotals.map((t, i) => (
                    <td
                      key={i}
                      className="px-1 py-2.5 border-r border-gray-200"
                    >
                      {t.total > 0 ? (
                        <div className="flex flex-col items-center gap-0">
                          <span className="tabular-nums font-bold text-[#374151] text-[11px]">
                            {fmt(t.paid)}
                          </span>
                          <span className="tabular-nums text-[10px] text-[#9CA3AF]">
                            / {fmt(t.total)}
                          </span>
                        </div>
                      ) : (
                        <span className="block text-center text-[#D1D5DB]">-</span>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-2.5 bg-[#FDE68A]/40 border-l border-gray-200">
                    <div className="flex flex-col items-center gap-0">
                      <span className="tabular-nums font-bold text-[#374151] text-[11px]">
                        {fmt(annualTotalPaid)}
                      </span>
                      <span className="tabular-nums text-[10px] text-[#9CA3AF]">
                        / {fmt(annualTotalExpected)}
                      </span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

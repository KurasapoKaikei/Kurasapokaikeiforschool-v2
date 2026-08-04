"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { DatePickerField } from "@/components/ui/date-picker-field"
import {
  getCollectionRecords,
  getCollectionSchedules,
  getMembers,
  sumCollectionRecordNetPaid,
  type CollectionRecord,
  type CollectionSchedule,
  type Member,
} from "@/utils/localStorage"
import { COLLECTION_STATUS_BADGE, getCollectionPaymentStatus } from "@/types"
import {
  learnMemberFromCsvMemo,
  suggestMembersFromCsvMemo,
  type MemberSuggestion,
} from "@/utils/csvMemberKanaHints"

const THEME = "#67a384"
const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const

export type CollectionIndividualLine = {
  category: string
  accountTitle: string
  amount: number
  date: string
  memo: string
  memberId: string
  memberName: string
  scheduleId: string
}

export type CollectionIndividualEntryProps = {
  /** csv-draft: 金額固定・保存のみ。direct: 割当入力で親が即時本登録（今回の入金額なし） */
  variant: "csv-draft" | "direct"
  /** csv-draft 用（direct では不要） */
  cashAccountName?: string
  /** direct 時の現金・預金選択（未指定なら非表示） */
  cashAccountOptions?: { id: string; name: string }[]
  onCashAccountChange?: (name: string) => void
  initialDate?: string
  /** 会計期間の選択下限（yyyy-MM-dd） */
  minDate?: string
  /** 会計期間の選択上限（yyyy-MM-dd） */
  maxDate?: string
  /** csv-draft では CSV 入金額（必須一致） */
  depositAmount?: number
  csvMemo?: string
  disabled?: boolean
  submitLabel: string
  cancelLabel?: string
  onSubmit: (lines: CollectionIndividualLine[]) => void
  onCancel?: () => void
  showHeader?: boolean
  title?: string
}

function parseMonthFromTargetMonth(targetMonth?: string): number | null {
  if (!targetMonth) return null
  const m = Number(targetMonth.split("-")[1])
  if (!Number.isFinite(m) || m < 1 || m > 12) return null
  return m
}

export function formatCollectionIndividualMemo(
  memberName: string,
  targetMonth?: string,
  subjectName?: string
): string {
  const month = parseMonthFromTargetMonth(targetMonth)
  const subject = (subjectName ?? "").trim()
  const label = subject ? `${memberName} - ${subject}` : memberName
  if (month == null) return `集金（${label}）`
  return `[${month}月分] 集金（${label}）`
}

function getFiscalStartYear(dateStr?: string): number {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const y = Number(dateStr.slice(0, 4))
    const m = Number(dateStr.slice(5, 7))
    return m >= 4 ? y : y - 1
  }
  const now = new Date()
  return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1
}

function monthToYYYYMM(fiscalStartYear: number, month: number): string {
  const y = month >= 4 ? fiscalStartYear : fiscalStartYear + 1
  return `${y}-${String(month).padStart(2, "0")}`
}

type SchedulePayment = { amount: string; date: string; memo: string }

function paymentKey(month: number, scheduleId: string) {
  return `${month}__${scheduleId}`
}

export function CollectionIndividualEntry({
  variant,
  cashAccountName = "",
  cashAccountOptions,
  onCashAccountChange,
  initialDate = "",
  minDate,
  maxDate,
  depositAmount,
  csvMemo = "",
  disabled = false,
  submitLabel,
  cancelLabel = "キャンセル",
  onSubmit,
  onCancel,
  showHeader = false,
  title = "集金の個別登録",
}: CollectionIndividualEntryProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [schedules, setSchedules] = useState<CollectionSchedule[]>([])
  const [records, setRecords] = useState<CollectionRecord[]>([])
  const [memberId, setMemberId] = useState("")
  const [colMonth, setColMonth] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [payments, setPayments] = useState<Record<string, SchedulePayment>>({})
  const [error, setError] = useState<string | null>(null)
  const [bulkDate, setBulkDate] = useState(initialDate || "")
  /** direct: 割当表の科目左チェック（複数科目で1つ） */
  const [monthChecked, setMonthChecked] = useState(false)

  const fiscalStartYear = useMemo(() => getFiscalStartYear(initialDate), [initialDate])
  /** csv-draft のみ。direct では割当合計の一致チェックはしない */
  const csvAmount = Math.trunc(Number(depositAmount) || 0)
  const isDirect = variant === "direct"

  const reload = useCallback(() => {
    setMembers(getMembers().filter((m) => m.status === "active"))
    setSchedules(getCollectionSchedules())
    setRecords(getCollectionRecords())
  }, [])

  useEffect(() => {
    reload()
    setError(null)
    setMemberId("")
    setColMonth(null)
    setSearch("")
    setPayments({})
    setBulkDate(initialDate || "")
    setMonthChecked(false)
  }, [reload, variant, initialDate, depositAmount, csvMemo])

  const suggestions: MemberSuggestion[] = useMemo(
    () => suggestMembersFromCsvMemo(csvMemo, members),
    [csvMemo, members]
  )

  const filteredMembers = useMemo(() => {
    const q = search.trim()
    let list = [...members]
    if (q) {
      const nfkc = q.normalize("NFKC")
      list = list.filter(
        (m) => m.name.includes(q) || m.name.normalize("NFKC").includes(nfkc)
      )
    }
    return list.sort(
      (a, b) => a.grade - b.grade || a.name.localeCompare(b.name, "ja")
    )
  }, [members, search])

  const selectedMember = members.find((m) => m.id === memberId) ?? null

  const memberMonthSummaries = useMemo(() => {
    if (!selectedMember) return []
    return FISCAL_MONTHS.map((month) => {
      const ym = monthToYYYYMM(fiscalStartYear, month)
      const monthSchedules = schedules
        .filter((s) => {
          const tm = (s.targetMonth || "").trim()
          if (tm !== ym && !tm.startsWith(ym)) return false
          return s.memberIds && s.memberIds.length > 0
            ? s.memberIds.includes(selectedMember.id)
            : true
        })
        .sort((a, b) =>
          (a.accountTitleName || a.name).localeCompare(b.accountTitleName || b.name, "ja")
        )
      let expected = 0
      let paid = 0
      for (const s of monthSchedules) {
        expected += s.amount
        const rec = records.find(
          (r) => r.memberId === selectedMember.id && r.scheduleId === s.id
        )
        paid += sumCollectionRecordNetPaid(rec)
      }
      const status = expected > 0 ? getCollectionPaymentStatus(paid, expected) : null
      return { month, ym, schedules: monthSchedules, expected, paid, status }
    }).filter((x) => x.schedules.length > 0)
  }, [selectedMember, schedules, records, fiscalStartYear])

  useEffect(() => {
    if (!memberId) {
      setColMonth(null)
      return
    }
    const member = members.find((m) => m.id === memberId)
    if (!member) return
    let firstMonth: number | null = null
    let firstUnpaid: number | null = null
    for (const month of FISCAL_MONTHS) {
      const ym = monthToYYYYMM(fiscalStartYear, month)
      const monthSchedules = schedules.filter((s) => {
        const tm = (s.targetMonth || "").trim()
        if (tm !== ym && !tm.startsWith(ym)) return false
        return s.memberIds && s.memberIds.length > 0 ? s.memberIds.includes(member.id) : true
      })
      if (monthSchedules.length === 0) continue
      if (firstMonth == null) firstMonth = month
      let expected = 0
      let paid = 0
      for (const s of monthSchedules) {
        expected += s.amount
        const rec = records.find((r) => r.memberId === member.id && r.scheduleId === s.id)
        paid += sumCollectionRecordNetPaid(rec)
      }
      const status = expected > 0 ? getCollectionPaymentStatus(paid, expected) : null
      if (
        firstUnpaid == null &&
        (status === "UNPAID" || status === "PARTIALLY_PAID")
      ) {
        firstUnpaid = month
      }
    }
    setColMonth(firstUnpaid ?? firstMonth)
  }, [memberId, members, schedules, records, fiscalStartYear])

  const selectedMonthSummary = memberMonthSummaries.find((m) => m.month === colMonth) ?? null

  useEffect(() => {
    if (!selectedMember || !selectedMonthSummary) return
    const defaultDate = isDirect ? bulkDate || initialDate || "" : initialDate || ""
    setPayments((prev) => {
      let changed = false
      const next = { ...prev }
      for (const s of selectedMonthSummary.schedules) {
        const key = paymentKey(selectedMonthSummary.month, s.id)
        if (!next[key]) {
          next[key] = { amount: "", date: defaultDate, memo: "" }
          changed = true
        }
      }
      return changed ? next : prev
    })
    // bulkDate は新規行の初期値にのみ使う（変更時は applyBulkDate が行を更新）
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bulkDate 変更で再初期化しない
  }, [selectedMember?.id, selectedMonthSummary?.month, selectedMonthSummary?.schedules, initialDate, isDirect])

  useEffect(() => {
    setMonthChecked(false)
  }, [memberId, colMonth])

  const applyBulkDate = (v: string) => {
    setBulkDate(v)
    if (!selectedMonthSummary) return
    setPayments((prev) => {
      const next = { ...prev }
      for (const s of selectedMonthSummary.schedules) {
        const key = paymentKey(selectedMonthSummary.month, s.id)
        next[key] = {
          amount: next[key]?.amount ?? "",
          date: v,
          memo: next[key]?.memo ?? "",
        }
      }
      return next
    })
  }

  const isMonthCheckboxLocked = (summary: { expected: number; paid: number } | null) => {
    if (!summary) return false
    return summary.expected > 0 && summary.paid > 0
  }

  /** 割当表チェック ON: 予定額・入金日・メモを一括入力。OFF: クリア */
  const handleMonthSchedulesCheckbox = (checked: boolean) => {
    if (!selectedMember || !selectedMonthSummary || disabled) return
    if (isMonthCheckboxLocked(selectedMonthSummary)) return
    setMonthChecked(checked)
    const date = (bulkDate || initialDate || "").trim()
    setPayments((prev) => {
      const next = { ...prev }
      for (const s of selectedMonthSummary.schedules) {
        const key = paymentKey(selectedMonthSummary.month, s.id)
        const subjectName = s.accountTitleName || s.name || ""
        if (checked) {
          next[key] = {
            amount: String(s.amount),
            date,
            memo: formatCollectionIndividualMemo(
              selectedMember.name,
              s.targetMonth,
              subjectName
            ),
          }
        } else {
          next[key] = { amount: "0", date: "", memo: "" }
        }
      }
      return next
    })
  }

  const enteredTotal = useMemo(() => {
    let sum = 0
    for (const v of Object.values(payments)) {
      const n = Number(String(v.amount).replace(/,/g, "").trim())
      if (Number.isFinite(n) && n !== 0) sum += Math.trunc(n)
    }
    return sum
  }, [payments])

  const amountMatches = isDirect
    ? enteredTotal !== 0
    : enteredTotal === csvAmount && csvAmount !== 0
  const amountDiff = enteredTotal - csvAmount

  const selectMember = (m: Member) => {
    setMemberId(m.id)
    setSearch("")
    setPayments({})
    setMonthChecked(false)
    setError(null)
  }

  const handleSubmit = () => {
    setError(null)
    if (disabled) return
    if (!selectedMember) {
      setError("部員を選択してください")
      return
    }
    if (!isDirect && !cashAccountName.trim()) {
      setError("現金・預金口座を選択してください")
      return
    }
    if (!isDirect) {
      if (csvAmount === 0) {
        setError("今回の入金額を入力してください")
        return
      }
      if (!amountMatches) {
        setError(
          `入力合計（${enteredTotal.toLocaleString()}円）が今回の入金額（${csvAmount.toLocaleString()}円）と一致していません`
        )
        return
      }
    } else if (enteredTotal === 0) {
      setError("入金額を入力してください")
      return
    }

    const pending: { schedule: CollectionSchedule; amount: number; date: string; memo: string }[] =
      []

    for (const summary of memberMonthSummaries) {
      for (const schedule of summary.schedules) {
        const key = paymentKey(summary.month, schedule.id)
        const row = payments[key]
        if (!row) continue
        const amount = Number(String(row.amount).replace(/,/g, "").trim())
        if (!Number.isFinite(amount) || amount === 0) continue
        const date = (row.date || "").trim()
        if (!date) {
          setError(`${summary.month}月の入金日を入力してください`)
          return
        }
        if (minDate && date < minDate) {
          setError(
            `日付は会計期間（${minDate.replace(/-/g, "/")}〜${(maxDate ?? "").replace(/-/g, "/")}）の範囲内で入力してください`
          )
          return
        }
        if (maxDate && date > maxDate) {
          setError(
            `日付は会計期間（${(minDate ?? "").replace(/-/g, "/")}〜${maxDate.replace(/-/g, "/")}）の範囲内で入力してください`
          )
          return
        }
        const rec = records.find(
          (r) => r.memberId === selectedMember.id && r.scheduleId === schedule.id
        )
        if (!rec) {
          setError(
            `集金実績レコードが見つかりません（${schedule.accountTitleName || schedule.name}）`
          )
          return
        }
        pending.push({
          schedule,
          amount: Math.trunc(amount),
          date,
          memo: (row.memo || "").trim(),
        })
      }
    }

    if (pending.length === 0) {
      setError("入金額を入力してください")
      return
    }

    if (!isDirect) {
      const pendingSum = pending.reduce((s, p) => s + p.amount, 0)
      if (pendingSum !== csvAmount) {
        setError(
          `入力合計（${pendingSum.toLocaleString()}円）が今回の入金額（${csvAmount.toLocaleString()}円）と一致していません`
        )
        return
      }
    }

    const results: CollectionIndividualLine[] = pending.map(({ schedule, amount, date, memo }) => {
      const subjectName = schedule.accountTitleName || schedule.name || "会費収入"
      return {
        category: schedule.categoryName || "集金",
        accountTitle: subjectName,
        amount,
        date,
        memo:
          memo ||
          formatCollectionIndividualMemo(
            selectedMember.name,
            schedule.targetMonth,
            subjectName
          ),
        memberId: selectedMember.id,
        memberName: selectedMember.name,
        scheduleId: schedule.id,
      }
    })

    if (csvMemo.trim()) {
      learnMemberFromCsvMemo(csvMemo, selectedMember)
    }

    onSubmit(results)
  }

  const formBody = (
    <div className="space-y-5">
      {showHeader && (
        <div>
          <h3 className="text-base font-semibold text-[#374151]">{title}</h3>
          {!isDirect && (
            <p className="text-xs text-[#6B7280] mt-1">
              部員 → 集金月 → 割当の順で入力します。入力合計が今回の入金額と一致する必要があります。
            </p>
          )}
        </div>
      )}

      {cashAccountOptions &&
        cashAccountOptions.length > 0 &&
        onCashAccountChange &&
        !isDirect && (
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">
            現金・預金口座 <span className="text-[#EF4444]">*</span>
          </label>
          <select
            value={cashAccountName}
            onChange={(e) => onCashAccountChange(e.target.value)}
            disabled={disabled}
            className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">選択してください</option>
            {cashAccountOptions.map((a) => (
              <option key={a.id} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 今回の入金額（CSV 下書きのみ） */}
      {!isDirect && (
        <div className="rounded-lg border border-[#67a384]/40 bg-[#ECF8F2] px-4 py-3">
          <p className="text-xs font-medium text-[#3d6b54]">今回の入金額（CSV）</p>
          <p className="text-2xl font-bold tabular-nums text-[#1F2937] mt-0.5">
            {csvAmount.toLocaleString()}
            <span className="text-sm font-medium text-[#6B7280] ml-1">円</span>
          </p>
          <p className="text-[11px] text-[#6B7280] mt-1">
            下の割当合計がこの金額と一致したときだけ保存できます（一部入金・過入金も可）。
          </p>
        </div>
      )}

      {csvMemo.trim() && (
        <p className="text-xs text-[#6B7280] truncate" title={csvMemo}>
          摘要: {csvMemo}
        </p>
      )}

      {/* 部員 */}
      <div>
        <p className="text-sm font-semibold text-[#374151] mb-2">
          {isDirect ? "部員を選択" : "① 部員を選択"}
        </p>
        {suggestions.length > 0 && (
          <div className="mb-3">
            <p className="text-[11px] text-[#6B7280] mb-1.5">摘要からの候補（クリックで選択）</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.member.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectMember(s.member)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    memberId === s.member.id
                      ? "text-white border-transparent"
                      : "bg-white text-[#374151] border-[#67a384]/50 hover:bg-[#ECF8F2]"
                  }`}
                  style={memberId === s.member.id ? { backgroundColor: THEME } : undefined}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={disabled}
          placeholder="氏名で絞り込み"
          className="w-full mb-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <select
          value={memberId}
          disabled={disabled}
          onChange={(e) => {
            const m = members.find((x) => x.id === e.target.value)
            if (m) selectMember(m)
            else {
              setMemberId("")
              setPayments({})
              setMonthChecked(false)
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">選択してください</option>
          {filteredMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.grade}年 {m.name}
            </option>
          ))}
        </select>
      </div>

      {/* ② 月 */}
      {selectedMember && (
        <div>
          <p className="text-sm font-semibold text-[#374151] mb-2">
            {isDirect
              ? `${selectedMember.grade}年 ${selectedMember.name} の集金月を選択`
              : `② ${selectedMember.grade}年 ${selectedMember.name} の集金月を選択`}
          </p>
          <p className="text-[11px] text-[#6B7280] mb-2">
            4月から順に、未入金・一部入金のバッジが付いた月を確認してください。
          </p>
          {memberMonthSummaries.length === 0 ? (
            <p className="text-xs text-[#9CA3AF]">この部員の集金予定がありません</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {memberMonthSummaries.map((m) => {
                const badge = m.status ? COLLECTION_STATUS_BADGE[m.status] : null
                const selected = colMonth === m.month
                return (
                  <button
                    key={m.month}
                    type="button"
                    disabled={disabled}
                    onClick={() => setColMonth(m.month)}
                    className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-md text-xs border min-w-[3.25rem] ${
                      selected
                        ? "text-white border-transparent"
                        : "bg-white text-[#374151] border-gray-200 hover:bg-gray-50"
                    }`}
                    style={selected ? { backgroundColor: THEME } : undefined}
                  >
                    <span className="font-semibold">{m.month}月</span>
                    {badge && (
                      <span
                        className={`px-1 py-0 rounded text-[9px] font-bold leading-tight ${
                          selected ? "bg-white/25 text-white" : badge.className
                        }`}
                      >
                        {badge.label}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ③ 割当 */}
      {selectedMember && selectedMonthSummary && (
        <div>
          <p className="text-sm font-semibold text-[#374151] mb-2">
            {isDirect
              ? `${selectedMonthSummary.month}月の集金内容に今回分を割り当て`
              : `③ ${selectedMonthSummary.month}月の集金内容に今回分を割り当て`}
          </p>
          {isDirect && (
            <div className="mb-3">
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                入金日（一括）
              </label>
              <div className="w-44">
                <DatePickerField
                  value={bulkDate}
                  onChange={applyBulkDate}
                  themeColor={THEME}
                  disabled={disabled}
                  minDate={minDate}
                  maxDate={maxDate}
                  aria-label="入金日（一括）"
                />
              </div>
              <p className="text-[11px] text-[#6B7280] mt-1">
                集金設定が複数ある場合は、ここで入金日を一括指定できます。
              </p>
            </div>
          )}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#EEF6F1] text-[#374151]">
                  {isDirect && <th className="px-1 py-2 border-b w-8" aria-label="選択" />}
                  <th className="px-2 py-2 text-left border-b">科目</th>
                  <th className="px-2 py-2 text-right border-b whitespace-nowrap">予定/入済</th>
                  <th className="px-2 py-2 text-left border-b">
                    {isDirect ? "入金額" : "今回の割当額"}
                  </th>
                  <th className="px-2 py-2 text-left border-b">入金日</th>
                  {isDirect && <th className="px-2 py-2 text-left border-b">メモ</th>}
                </tr>
              </thead>
              <tbody>
                {selectedMonthSummary.schedules.map((s, scheduleIndex) => {
                  const rec = records.find(
                    (r) => r.memberId === selectedMember.id && r.scheduleId === s.id
                  )
                  const paid = sumCollectionRecordNetPaid(rec)
                  const status = getCollectionPaymentStatus(paid, s.amount)
                  const badge = COLLECTION_STATUS_BADGE[status]
                  const key = paymentKey(selectedMonthSummary.month, s.id)
                  const row = payments[key] ?? {
                    amount: "",
                    date: initialDate || "",
                    memo: "",
                  }
                  const scheduleCount = selectedMonthSummary.schedules.length
                  const checkboxLocked = isMonthCheckboxLocked(selectedMonthSummary)
                  return (
                    <tr key={s.id} className="border-b border-gray-200">
                      {isDirect && scheduleIndex === 0 && (
                        <td
                          rowSpan={scheduleCount}
                          className="px-1 py-2 text-center align-middle border-r border-gray-200"
                        >
                          <input
                            type="checkbox"
                            checked={monthChecked}
                            disabled={disabled || checkboxLocked}
                            title={
                              checkboxLocked
                                ? "登録済みのため一括入力は利用できません"
                                : "チェックすると予定額・入金日・メモを一括入力します"
                            }
                            onChange={(e) => handleMonthSchedulesCheckbox(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-[#67a384] focus:ring-[#67a384] disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label={`${selectedMonthSummary.month}月の集金を一括入力`}
                          />
                        </td>
                      )}
                      <td className="px-2 py-2 align-top">
                        <div>{s.accountTitleName || s.name}</div>
                        <div className="text-[10px] text-[#9CA3AF]">{s.categoryName || "—"}</div>
                        <span
                          className={`inline-block mt-0.5 px-1.5 py-0 rounded text-[9px] font-bold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums align-top whitespace-nowrap">
                        {s.amount.toLocaleString()}
                        <br />
                        <span className="text-[10px] text-[#6B7280]">済 {paid.toLocaleString()}</span>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <input
                          type="number"
                          value={row.amount}
                          disabled={disabled}
                          onChange={(e) => {
                            const amount = e.target.value
                            setPayments((prev) => ({
                              ...prev,
                              [key]:
                                amount.trim() === ""
                                  ? { amount: "", date: "", memo: "" }
                                  : { ...row, amount },
                            }))
                          }}
                          className="w-full min-w-[5rem] px-2 py-1.5 border border-gray-300 rounded text-right text-sm"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-2 py-2 align-top min-w-[8rem]">
                        <DatePickerField
                          value={row.date}
                          onChange={(v) =>
                            setPayments((prev) => ({
                              ...prev,
                              [key]: { ...row, date: v },
                            }))
                          }
                          themeColor={THEME}
                          compact
                          disabled={disabled}
                          minDate={minDate}
                          maxDate={maxDate}
                        />
                      </td>
                      {isDirect && (
                        <td className="px-2 py-2 align-top min-w-[10rem]">
                          <input
                            type="text"
                            value={row.memo}
                            disabled={disabled}
                            onChange={(e) =>
                              setPayments((prev) => ({
                                ...prev,
                                [key]: { ...row, memo: e.target.value },
                              }))
                            }
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                            aria-label="メモ"
                          />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-[#6B7280] mt-2">
            {isDirect
              ? "他の月にも割り当てる場合は、上の月ボタンを切り替えて同様に入力してください。"
              : "他の月にも割り当てる場合は、上の月ボタンを切り替えて同様に入力してください（合計が今回の入金額と一致すること）。"}
          </p>
        </div>
      )}

      {selectedMember && isDirect && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-sm text-[#374151]">
            入金額合計：
            <span className="font-bold tabular-nums text-lg ml-1">
              {enteredTotal.toLocaleString()}円
            </span>
          </p>
        </div>
      )}

      {selectedMember && !isDirect && (
        <div
          className={`rounded-lg border px-4 py-3 ${
            amountMatches ? "border-green-300 bg-green-50" : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-[#374151]">
              入力合計:{" "}
              <span className="font-bold tabular-nums text-lg">
                {enteredTotal.toLocaleString()}円
              </span>
            </p>
            <p className="text-sm text-[#374151]">
              今回の入金額:{" "}
              <span className="font-bold tabular-nums">{csvAmount.toLocaleString()}円</span>
            </p>
          </div>
          {!amountMatches && (
            <p className="text-xs text-amber-800 mt-1">
              {csvAmount === 0
                ? "今回の入金額を入力してください"
                : enteredTotal === 0
                  ? "割当額を手入力してください"
                  : amountDiff > 0
                    ? `今回の入金額より ${amountDiff.toLocaleString()}円 多いです`
                    : `今回の入金額より ${Math.abs(amountDiff).toLocaleString()}円 不足しています`}
            </p>
          )}
          {amountMatches && (
            <p className="text-xs text-green-800 mt-1">金額が一致しています。</p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={disabled}>
            {cancelLabel}
          </Button>
        )}
        <Button
          type="button"
          className="text-white disabled:opacity-40"
          style={{ backgroundColor: THEME }}
          disabled={
            disabled ||
            !selectedMember ||
            !amountMatches ||
            (!isDirect && !cashAccountName.trim())
          }
          onClick={handleSubmit}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  )

  return formBody
}

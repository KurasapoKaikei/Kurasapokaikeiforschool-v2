"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  getAccountTitles,
  getCategories,
  getCollectionRecords,
  getCollectionSchedules,
  getSystemSettings,
  getTransactions,
  isTransferLeg,
  type AccountTitle,
  type Category,
  type CollectionRecord,
  type CollectionSchedule,
  type Transaction,
} from "@/utils/localStorage"

const THEME_COLOR = "#68A384"
const REPORT_REMARKS_STORAGE_KEY = "classapo_report_remarks"

type CategoryTotal = {
  id: string
  name: string
  amount: number
}

type AccountBalance = {
  id: string
  name: string
  amount: number
}

const formatAmount = (n: number) => n.toLocaleString()

export default function ReportPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [collectionSchedules, setCollectionSchedules] = useState<CollectionSchedule[]>([])
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([])
  const [openingCarryover, setOpeningCarryover] = useState(0)
  const [remarks, setRemarks] = useState<Record<string, string>>({})

  const refreshAll = useCallback(() => {
    setCategories(getCategories())
    setAccountTitles(getAccountTitles())
    setTransactions(getTransactions())
    setCollectionSchedules(getCollectionSchedules())
    setCollectionRecords(getCollectionRecords())
    setOpeningCarryover(getSystemSettings().openingCarryover ?? 0)
  }, [])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  useEffect(() => {
    const interval = setInterval(refreshAll, 500)
    const onStorage = () => refreshAll()
    window.addEventListener("storage", onStorage)
    return () => {
      clearInterval(interval)
      window.removeEventListener("storage", onStorage)
    }
  }, [refreshAll])

  useEffect(() => {
    if (typeof window === "undefined") return
    const raw = localStorage.getItem(REPORT_REMARKS_STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Record<string, string>
      setRemarks(parsed)
    } catch {
      setRemarks({})
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    localStorage.setItem(REPORT_REMARKS_STORAGE_KEY, JSON.stringify(remarks))
  }, [remarks])

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  )

  // 既存の集計画面と同様に、集金履歴のみ存在する旧データを収入へ補完する
  const collectionIncomeEntries = useMemo(() => {
    const scheduleMap = new Map(collectionSchedules.map((s) => [s.id, s]))
    const existingCollectionTxIds = new Set(
      transactions.filter((t) => t.type === "collection").map((t) => t.id)
    )
    const list: Array<{ amount: number; category: string; counterparty: string }> = []

    collectionRecords.forEach((record) => {
      const schedule = scheduleMap.get(record.scheduleId)
      if (!schedule) return
      const category = schedule.categoryName || "集金"
      const counterparty = schedule.counterpartyName || "現金"
      const history = record.paymentHistory ?? []

      if (history.length > 0) {
        history.forEach((h) => {
          if (h.transactionId && existingCollectionTxIds.has(h.transactionId)) return
          list.push({ amount: h.amount, category, counterparty })
        })
        return
      }

      if (record.status !== "UNPAID" && (record.paidAmount ?? 0) !== 0 && record.paidAt) {
        if (record.linkedTransactionId && existingCollectionTxIds.has(record.linkedTransactionId)) return
        list.push({
          amount: record.paidAmount ?? 0,
          category,
          counterparty,
        })
      }
    })

    return list
  }, [collectionSchedules, collectionRecords, transactions])

  const incomeByCategory = useMemo(() => {
    const totals = new Map<string, number>(sortedCategories.map((c) => [c.name, 0]))

    transactions
      .filter((t) => (t.type === "income" || t.type === "collection") && !isTransferLeg(t))
      .forEach((t) => {
        totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount)
      })

    collectionIncomeEntries.forEach((entry) => {
      totals.set(entry.category, (totals.get(entry.category) ?? 0) + entry.amount)
    })

    return sortedCategories.map(
      (c): CategoryTotal => ({
        id: c.id,
        name: c.name,
        amount: totals.get(c.name) ?? 0,
      })
    )
  }, [sortedCategories, transactions, collectionIncomeEntries])

  const expenseByCategory = useMemo(() => {
    const totals = new Map<string, number>(sortedCategories.map((c) => [c.name, 0]))

    transactions
      .filter((t) => t.type === "expense" && !isTransferLeg(t))
      .forEach((t) => {
        totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount)
      })

    return sortedCategories.map(
      (c): CategoryTotal => ({
        id: c.id,
        name: c.name,
        amount: totals.get(c.name) ?? 0,
      })
    )
  }, [sortedCategories, transactions])

  const incomeCategoryTotal = useMemo(
    () => incomeByCategory.reduce((sum, row) => sum + row.amount, 0),
    [incomeByCategory]
  )
  const incomeSectionTotal = openingCarryover + incomeCategoryTotal
  const expenseSectionTotal = useMemo(
    () => expenseByCategory.reduce((sum, row) => sum + row.amount, 0),
    [expenseByCategory]
  )
  const nextCarryover = incomeSectionTotal - expenseSectionTotal

  const accountBalances = useMemo(() => {
    const cashAccounts = accountTitles
      .filter((a) => a.group === "cash")
      .sort((a, b) => a.order - b.order)

    const rows: AccountBalance[] = cashAccounts.map((account) => {
      const base = account.balance ?? 0
      const txDelta = transactions
        .filter((t) => t.counterparty === account.name)
        .reduce((sum, t) => {
          if (t.type === "income" || t.type === "collection") return sum + t.amount
          if (t.type === "expense" || t.type === "transfer" || t.type === "deferred") return sum - t.amount
          return sum
        }, 0)
      const fallbackCollectionDelta = collectionIncomeEntries
        .filter((entry) => entry.counterparty === account.name)
        .reduce((sum, entry) => sum + entry.amount, 0)

      return {
        id: account.id,
        name: account.name,
        amount: base + txDelta + fallbackCollectionDelta,
      }
    })

    const total = rows.reduce((sum, row) => sum + row.amount, 0)
    const diff = nextCarryover - total
    if (diff !== 0) {
      rows.push({
        id: "reconcile",
        name: "残高調整",
        amount: diff,
      })
    }
    return rows
  }, [accountTitles, transactions, collectionIncomeEntries, nextCarryover])

  const accountBalanceTotal = useMemo(
    () => accountBalances.reduce((sum, row) => sum + row.amount, 0),
    [accountBalances]
  )
  const getRemark = (key: string) => remarks[key] ?? ""
  const setRemark = (key: string, value: string) => {
    setRemarks((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="px-6 py-8 min-h-screen bg-[#F5F5F0]">
      <div
        className="rounded-t-lg border border-b-0 border-gray-300 px-6 py-4 bg-white"
        style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR }}
      >
        <h2 className="text-xl font-semibold text-[#374151]">収支報告書</h2>
        <p className="text-xs text-[#6B7280] mt-1">（単位：円）</p>
      </div>

      <div className="bg-white border border-gray-300 rounded-b-lg overflow-hidden">
        <table className="w-full border-collapse text-sm table-fixed">
          <colgroup>
            <col style={{ width: "25%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "50%" }} />
          </colgroup>
          <tbody>
            <tr style={{ backgroundColor: "#e6fffa" }}>
              <td colSpan={3} className="px-4 py-2 font-semibold text-[#374151] border border-gray-300">
                【収入の部】
              </td>
            </tr>
            <tr className="bg-gray-50">
              <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-300">項目</td>
              <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-300">金額</td>
              <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-300">備考</td>
            </tr>
            <tr>
              <td className="px-4 py-2 border border-gray-300 font-semibold text-[#374151]">前期繰越金</td>
              <td className="px-4 py-2 border border-gray-300 text-right tabular-nums font-semibold">
                {formatAmount(openingCarryover)}
              </td>
              <td className="px-4 py-2 border border-gray-300 text-left">
                <textarea
                  value={getRemark("income-opening-carryover")}
                  onChange={(e) => setRemark("income-opening-carryover", e.target.value)}
                  className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                  rows={1}
                />
              </td>
            </tr>
            {incomeByCategory.map((row) => (
              <tr key={`income-${row.id}`}>
                <td className="px-4 py-2 border border-gray-300 text-[#374151]">{row.name} 収入合計</td>
                <td className="px-4 py-2 border border-gray-300 text-right tabular-nums">
                  {formatAmount(row.amount)}
                </td>
                <td className="px-4 py-2 border border-gray-300 text-left">
                  <textarea
                    value={getRemark(`income-category-${row.id}`)}
                    onChange={(e) => setRemark(`income-category-${row.id}`, e.target.value)}
                    className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                    rows={1}
                  />
                </td>
              </tr>
            ))}
            <tr style={{ backgroundColor: "#f4f4f4" }}>
              <td className="px-4 py-2 border border-gray-300 font-bold text-[#374151]">収入の部合計</td>
              <td className="px-4 py-2 border border-gray-300 text-right tabular-nums font-bold text-[#374151]">
                {formatAmount(incomeSectionTotal)}
              </td>
              <td className="px-4 py-2 border border-gray-300 text-left">
                <textarea
                  value={getRemark("income-total")}
                  onChange={(e) => setRemark("income-total", e.target.value)}
                  className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                  rows={1}
                />
              </td>
            </tr>

            <tr style={{ backgroundColor: "#e6fffa" }}>
              <td colSpan={3} className="px-4 py-2 font-semibold text-[#374151] border border-gray-300">
                【支出の部】
              </td>
            </tr>
            <tr className="bg-gray-50">
              <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-300">項目</td>
              <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-300">金額</td>
              <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-300">備考</td>
            </tr>
            {expenseByCategory.map((row) => (
              <tr key={`expense-${row.id}`}>
                <td className="px-4 py-2 border border-gray-300 text-[#374151]">{row.name} 支出合計</td>
                <td className="px-4 py-2 border border-gray-300 text-right tabular-nums">
                  {formatAmount(row.amount)}
                </td>
                <td className="px-4 py-2 border border-gray-300 text-left">
                  <textarea
                    value={getRemark(`expense-category-${row.id}`)}
                    onChange={(e) => setRemark(`expense-category-${row.id}`, e.target.value)}
                    className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                    rows={1}
                  />
                </td>
              </tr>
            ))}
            <tr style={{ backgroundColor: "#f4f4f4" }}>
              <td className="px-4 py-2 border border-gray-300 font-bold text-[#374151]">支出の部合計</td>
              <td className="px-4 py-2 border border-gray-300 text-right tabular-nums font-bold text-[#374151]">
                {formatAmount(expenseSectionTotal)}
              </td>
              <td className="px-4 py-2 border border-gray-300 text-left">
                <textarea
                  value={getRemark("expense-total")}
                  onChange={(e) => setRemark("expense-total", e.target.value)}
                  className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                  rows={1}
                />
              </td>
            </tr>

            <tr>
              <td colSpan={3} className="h-5 border-x border-gray-300 bg-white"></td>
            </tr>

            <tr style={{ backgroundColor: "#fffde7" }}>
              <td className="px-4 py-2.5 border border-gray-300 font-extrabold text-base text-[#374151]">
                収支合計（次期繰越金）
              </td>
              <td className="px-4 py-2.5 border border-gray-300 text-right tabular-nums font-extrabold text-base text-[#374151]">
                {formatAmount(nextCarryover)}
              </td>
              <td className="px-4 py-2.5 border border-gray-300 text-left">
                <textarea
                  value={getRemark("next-carryover-total")}
                  onChange={(e) => setRemark("next-carryover-total", e.target.value)}
                  className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                  rows={1}
                />
              </td>
            </tr>

            <tr>
              <td colSpan={3} className="h-5 border-x border-gray-300 bg-white"></td>
            </tr>
            <tr>
              <td colSpan={3} className="h-5 border-x border-gray-300 bg-white"></td>
            </tr>

            <tr style={{ backgroundColor: "#e6fffa" }}>
              <td colSpan={3} className="px-4 py-2 font-semibold text-[#374151] border border-gray-300">
                【資産・負債残高】
              </td>
            </tr>
            <tr className="bg-gray-50">
              <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-300">項目</td>
              <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-300">金額</td>
              <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-300">備考</td>
            </tr>
            {accountBalances.map((row) => (
              <tr key={`asset-${row.id}`}>
                <td className="px-4 py-2 border border-gray-300 text-[#374151]">{row.name}</td>
                <td className="px-4 py-2 border border-gray-300 text-right tabular-nums">
                  {formatAmount(row.amount)}
                </td>
                <td className="px-4 py-2 border border-gray-300 text-left">
                  <textarea
                    value={getRemark(`asset-row-${row.id}`)}
                    onChange={(e) => setRemark(`asset-row-${row.id}`, e.target.value)}
                    className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                    rows={1}
                  />
                </td>
              </tr>
            ))}
            <tr style={{ backgroundColor: "#f4f4f4" }}>
              <td className="px-4 py-2 border border-gray-300 font-bold text-[#374151]">資産・負債残高 合計</td>
              <td className="px-4 py-2 border border-gray-300 text-right tabular-nums font-bold text-[#374151]">
                {formatAmount(accountBalanceTotal)}
              </td>
              <td className="px-4 py-2 border border-gray-300 text-left">
                <textarea
                  value={getRemark("asset-total")}
                  onChange={(e) => setRemark("asset-total", e.target.value)}
                  className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                  rows={1}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

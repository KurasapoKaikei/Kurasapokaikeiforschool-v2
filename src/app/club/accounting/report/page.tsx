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
import {
  getDeferredRecordPlAdjustment,
  isDeferredRecord,
  isDeferredSettlement,
  normalizeDeferredAccountName,
} from "@/lib/deferredAccounting"
import { computeCashAccountCurrentBalance } from "@/lib/cashAccountBalance"
import { buildCollectionIncomeFallbackEntries } from "@/lib/collectionIncomeFallback"
import { formatAmountDisplay } from "@/utils/formatAmountDisplay"

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

type SubjectTotal = {
  id: string
  name: string
  amount: number
}

const formatAmount = (n: number) => formatAmountDisplay(n)

export default function ReportPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [collectionSchedules, setCollectionSchedules] = useState<CollectionSchedule[]>([])
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([])
  const [openingCarryover, setOpeningCarryover] = useState(0)
  const [remarks, setRemarks] = useState<Record<string, string>>({})
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | "all">("all")

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

  const isAllCategory = selectedCategoryId === "all"
  const selectedCategoryName = useMemo(() => {
    if (selectedCategoryId === "all") return null
    return categories.find((c) => c.id === selectedCategoryId)?.name ?? null
  }, [selectedCategoryId, categories])

  const collectionScheduleById = useMemo(
    () => new Map(collectionSchedules.map((s) => [s.id, s])),
    [collectionSchedules]
  )

  // 旧データのみ補完。台帳で削除した集金は加算しない（正本は collection 取引）
  const collectionIncomeEntries = useMemo(
    () =>
      buildCollectionIncomeFallbackEntries(
        collectionRecords,
        collectionSchedules,
        transactions
      ),
    [collectionRecords, collectionSchedules, transactions]
  )

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

    transactions.forEach((t) => {
      const adj = getDeferredRecordPlAdjustment(t)
      if (!adj || adj.side !== "income" || !adj.categoryName) return
      totals.set(adj.categoryName, (totals.get(adj.categoryName) ?? 0) + adj.signedAmount)
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

    transactions.forEach((t) => {
      const adj = getDeferredRecordPlAdjustment(t)
      if (!adj || adj.side !== "expense" || !adj.categoryName) return
      totals.set(adj.categoryName, (totals.get(adj.categoryName) ?? 0) + adj.signedAmount)
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

  const cashBalances = useMemo(() => {
    const cashAccounts = accountTitles
      .filter((a) => a.group === "cash")
      .sort((a, b) => a.order - b.order)

    return cashAccounts.map(
      (account): AccountBalance => ({
        id: account.id,
        name: account.name,
        amount: computeCashAccountCurrentBalance(
          account.balance,
          account.name,
          transactions,
          collectionScheduleById
        ),
      })
    )
  }, [accountTitles, transactions, collectionScheduleById])

  const cashBalanceTotal = useMemo(
    () => cashBalances.reduce((sum, row) => sum + row.amount, 0),
    [cashBalances]
  )

  /** 繰延4科目の残高（計上＋／精算−） */
  const deferredAmountByName = useMemo(() => {
    const amounts: Record<string, number> = {
      未収入金: 0,
      未払金: 0,
      預り金: 0,
      前払費用: 0,
    }

    transactions.forEach((t) => {
      if (t.type !== "deferred") return
      const name = normalizeDeferredAccountName(t.accountTitle)
      if (!(name in amounts)) return
      if (isDeferredRecord(t)) {
        amounts[name] += t.amount
      } else if (isDeferredSettlement(t)) {
        amounts[name] -= t.amount
      }
    })

    return amounts
  }, [transactions])

  const deferredAssetRows = useMemo(
    (): AccountBalance[] =>
      (["未収入金", "前払費用"] as const).map((name) => ({
        id: name,
        name,
        amount: deferredAmountByName[name] ?? 0,
      })),
    [deferredAmountByName]
  )

  const deferredLiabilityRows = useMemo(
    (): AccountBalance[] =>
      (["未払金", "預り金"] as const).map((name) => ({
        id: name,
        name,
        amount: deferredAmountByName[name] ?? 0,
      })),
    [deferredAmountByName]
  )

  const deferredAssetTotal = useMemo(
    () => deferredAssetRows.reduce((sum, row) => sum + row.amount, 0),
    [deferredAssetRows]
  )

  const deferredLiabilityTotal = useMemo(
    () => deferredLiabilityRows.reduce((sum, row) => sum + row.amount, 0),
    [deferredLiabilityRows]
  )

  /** カテゴリー別: 収入科目ごとの合計 */
  const incomeBySubject = useMemo((): SubjectTotal[] => {
    if (!selectedCategoryId || selectedCategoryId === "all" || !selectedCategoryName) {
      return []
    }

    const titles = accountTitles
      .filter((a) => a.group === "income" && a.categoryIds.includes(selectedCategoryId))
      .sort((a, b) => a.order - b.order)

    const amounts = new Map<string, number>()
    titles.forEach((t) => amounts.set(t.name, 0))

    transactions
      .filter((t) => (t.type === "income" || t.type === "collection") && !isTransferLeg(t))
      .filter((t) => t.category === selectedCategoryName)
      .forEach((t) => {
        if (!amounts.has(t.accountTitle)) return
        amounts.set(t.accountTitle, (amounts.get(t.accountTitle) ?? 0) + t.amount)
      })

    collectionIncomeEntries
      .filter((e) => e.category === selectedCategoryName)
      .forEach((e) => {
        if (!amounts.has(e.accountTitle)) return
        amounts.set(e.accountTitle, (amounts.get(e.accountTitle) ?? 0) + e.amount)
      })

    transactions.forEach((t) => {
      const adj = getDeferredRecordPlAdjustment(t)
      if (!adj || adj.side !== "income") return
      if (adj.categoryName !== selectedCategoryName) return
      if (!amounts.has(adj.subjectName)) return
      amounts.set(adj.subjectName, (amounts.get(adj.subjectName) ?? 0) + adj.signedAmount)
    })

    return titles.map((t) => ({
      id: t.id,
      name: t.name,
      amount: amounts.get(t.name) ?? 0,
    }))
  }, [
    selectedCategoryId,
    selectedCategoryName,
    accountTitles,
    transactions,
    collectionIncomeEntries,
  ])

  /** カテゴリー別: 支出科目ごとの合計 */
  const expenseBySubject = useMemo((): SubjectTotal[] => {
    if (!selectedCategoryId || selectedCategoryId === "all" || !selectedCategoryName) {
      return []
    }

    const titles = accountTitles
      .filter((a) => a.group === "expense" && a.categoryIds.includes(selectedCategoryId))
      .sort((a, b) => a.order - b.order)

    const amounts = new Map<string, number>()
    titles.forEach((t) => amounts.set(t.name, 0))

    transactions
      .filter((t) => t.type === "expense" && !isTransferLeg(t))
      .filter((t) => t.category === selectedCategoryName)
      .forEach((t) => {
        if (!amounts.has(t.accountTitle)) return
        amounts.set(t.accountTitle, (amounts.get(t.accountTitle) ?? 0) + t.amount)
      })

    transactions.forEach((t) => {
      const adj = getDeferredRecordPlAdjustment(t)
      if (!adj || adj.side !== "expense") return
      if (adj.categoryName !== selectedCategoryName) return
      if (!amounts.has(adj.subjectName)) return
      amounts.set(adj.subjectName, (amounts.get(adj.subjectName) ?? 0) + adj.signedAmount)
    })

    return titles.map((t) => ({
      id: t.id,
      name: t.name,
      amount: amounts.get(t.name) ?? 0,
    }))
  }, [selectedCategoryId, selectedCategoryName, accountTitles, transactions])

  const categoryIncomeTotal = useMemo(
    () => incomeBySubject.reduce((sum, row) => sum + row.amount, 0),
    [incomeBySubject]
  )
  const categoryExpenseTotal = useMemo(
    () => expenseBySubject.reduce((sum, row) => sum + row.amount, 0),
    [expenseBySubject]
  )
  const categoryNetTotal = categoryIncomeTotal - categoryExpenseTotal

  const getRemark = (key: string) => remarks[key] ?? ""
  const setRemark = (key: string, value: string) => {
    setRemarks((prev) => ({ ...prev, [key]: value }))
  }

  const remarkPrefix = isAllCategory ? "all" : `cat-${selectedCategoryId}`

  return (
    <div className="px-6 py-8 min-h-screen bg-[#F5F5F0]">
      <div
        className="rounded-t-lg border border-b-0 border-gray-200 px-6 py-4 bg-white"
        style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR }}
      >
        <h2 className="text-xl font-semibold" style={{ color: THEME_COLOR }}>
          収支報告書
        </h2>
        <p className="text-xs text-[#6B7280] mt-1">（単位：円）</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategoryId("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedCategoryId === "all"
                ? "text-white"
                : "bg-gray-100 text-[#374151] hover:bg-gray-200"
            }`}
            style={selectedCategoryId === "all" ? { backgroundColor: THEME_COLOR } : undefined}
          >
            すべて
          </button>
          {sortedCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedCategoryId === cat.id
                  ? "text-white"
                  : "bg-gray-100 text-[#374151] hover:bg-gray-200"
              }`}
              style={
                selectedCategoryId === cat.id ? { backgroundColor: THEME_COLOR } : undefined
              }
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-b-lg overflow-hidden">
        <table className="w-full border-collapse text-sm table-fixed">
          <colgroup>
            <col style={{ width: "25%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "50%" }} />
          </colgroup>
          <tbody>
            {isAllCategory ? (
              <>
                <tr className="bg-blue-50">
                  <td
                    colSpan={3}
                    className="px-4 py-2 font-semibold text-[#374151] border border-gray-200"
                  >
                    【収入の部】
                  </td>
                </tr>
                <tr className="bg-blue-50/50">
                  <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-200">
                    項目
                  </td>
                  <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-200">
                    金額
                  </td>
                  <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-200">
                    備考
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 border border-gray-200 font-semibold text-[#374151]">
                    前期繰越金
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-right tabular-nums font-semibold">
                    {formatAmount(openingCarryover)}
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-left">
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
                    <td className="px-4 py-2 border border-gray-200 text-[#374151]">
                      {row.name} 収入合計
                    </td>
                    <td className="px-4 py-2 border border-gray-200 text-right tabular-nums">
                      {formatAmount(row.amount)}
                    </td>
                    <td className="px-4 py-2 border border-gray-200 text-left">
                      <textarea
                        value={getRemark(`income-category-${row.id}`)}
                        onChange={(e) => setRemark(`income-category-${row.id}`, e.target.value)}
                        className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                        rows={1}
                      />
                    </td>
                  </tr>
                ))}
                <tr className="bg-green-200/80">
                  <td className="px-4 py-2 border border-gray-200 font-bold text-[#374151]">
                    収入の部合計
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-right tabular-nums font-bold text-[#374151]">
                    {formatAmount(incomeSectionTotal)}
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-left bg-green-200/80">
                    <textarea
                      value={getRemark("income-total")}
                      onChange={(e) => setRemark("income-total", e.target.value)}
                      className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                      rows={1}
                    />
                  </td>
                </tr>

                <tr className="bg-red-50">
                  <td
                    colSpan={3}
                    className="px-4 py-2 font-semibold text-[#374151] border border-gray-200"
                  >
                    【支出の部】
                  </td>
                </tr>
                <tr className="bg-red-50/50">
                  <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-200">
                    項目
                  </td>
                  <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-200">
                    金額
                  </td>
                  <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-200">
                    備考
                  </td>
                </tr>
                {expenseByCategory.map((row) => (
                  <tr key={`expense-${row.id}`}>
                    <td className="px-4 py-2 border border-gray-200 text-[#374151]">
                      {row.name} 支出合計
                    </td>
                    <td className="px-4 py-2 border border-gray-200 text-right tabular-nums">
                      {formatAmount(row.amount)}
                    </td>
                    <td className="px-4 py-2 border border-gray-200 text-left">
                      <textarea
                        value={getRemark(`expense-category-${row.id}`)}
                        onChange={(e) => setRemark(`expense-category-${row.id}`, e.target.value)}
                        className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                        rows={1}
                      />
                    </td>
                  </tr>
                ))}
                <tr className="bg-amber-200/80">
                  <td className="px-4 py-2 border border-gray-200 font-bold text-[#374151]">
                    支出の部合計
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-right tabular-nums font-bold text-[#374151]">
                    {formatAmount(expenseSectionTotal)}
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-left bg-amber-200/80">
                    <textarea
                      value={getRemark("expense-total")}
                      onChange={(e) => setRemark("expense-total", e.target.value)}
                      className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                      rows={1}
                    />
                  </td>
                </tr>

                <tr>
                  <td colSpan={3} className="h-5 border-x border-gray-200 bg-white"></td>
                </tr>

                <tr className="font-bold">
                  <td
                    className="px-4 py-2.5 border border-gray-200 font-extrabold text-base text-white"
                    style={{ backgroundColor: THEME_COLOR }}
                  >
                    収支合計（次期繰越金）
                  </td>
                  <td
                    className="px-4 py-2.5 border border-gray-200 text-right tabular-nums font-extrabold text-base text-white"
                    style={{ backgroundColor: THEME_COLOR }}
                  >
                    {formatAmount(nextCarryover)}
                  </td>
                  <td
                    className="px-4 py-2.5 border border-gray-200 text-left"
                    style={{ backgroundColor: THEME_COLOR }}
                  >
                    <textarea
                      value={getRemark("next-carryover-total")}
                      onChange={(e) => setRemark("next-carryover-total", e.target.value)}
                      className="w-full text-sm text-white bg-transparent border border-white/40 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left placeholder:text-white/70"
                      rows={1}
                    />
                  </td>
                </tr>

                <tr>
                  <td colSpan={3} className="h-5 border-x border-gray-200 bg-white"></td>
                </tr>
                <tr>
                  <td colSpan={3} className="h-5 border-x border-gray-200 bg-white"></td>
                </tr>

                <tr className="bg-slate-100/80">
                  <td
                    colSpan={3}
                    className="px-4 py-2 font-semibold text-[#374151] border border-gray-200"
                  >
                    【現金・預金残高】
                  </td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-200">
                    項目
                  </td>
                  <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-200">
                    金額
                  </td>
                  <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-200">
                    備考
                  </td>
                </tr>
                {cashBalances.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-[#6B7280] border border-gray-200"
                    >
                      現金・預金科目が登録されていません
                    </td>
                  </tr>
                ) : (
                  cashBalances.map((row) => (
                    <tr key={`cash-${row.id}`}>
                      <td className="px-4 py-2 border border-gray-200 text-[#374151]">{row.name}</td>
                      <td className="px-4 py-2 border border-gray-200 text-right tabular-nums">
                        {formatAmount(row.amount)}
                      </td>
                      <td className="px-4 py-2 border border-gray-200 text-left">
                        <textarea
                          value={getRemark(`cash-row-${row.id}`)}
                          onChange={(e) => setRemark(`cash-row-${row.id}`, e.target.value)}
                          className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                          rows={1}
                        />
                      </td>
                    </tr>
                  ))
                )}
                <tr className="bg-slate-200/80">
                  <td className="px-4 py-2 border border-gray-200 font-bold text-[#374151]">
                    現金・預金残高 合計
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-right tabular-nums font-bold text-[#374151]">
                    {formatAmount(cashBalanceTotal)}
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-left bg-slate-200/80">
                    <textarea
                      value={getRemark("cash-total")}
                      onChange={(e) => setRemark("cash-total", e.target.value)}
                      className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                      rows={1}
                    />
                  </td>
                </tr>

                <tr>
                  <td colSpan={3} className="h-5 border-x border-gray-200 bg-white"></td>
                </tr>

                <tr className="bg-slate-100/80">
                  <td
                    colSpan={3}
                    className="px-4 py-2 font-semibold text-[#374151] border border-gray-200"
                  >
                    【資産・負債残高】
                  </td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-200">
                    項目
                  </td>
                  <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-200">
                    金額
                  </td>
                  <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-200">
                    備考
                  </td>
                </tr>
                {deferredAssetRows.map((row) => (
                  <tr key={`deferred-asset-${row.id}`}>
                    <td className="px-4 py-2 border border-gray-200 text-[#374151]">{row.name}</td>
                    <td className="px-4 py-2 border border-gray-200 text-right tabular-nums">
                      {formatAmount(row.amount)}
                    </td>
                    <td className="px-4 py-2 border border-gray-200 text-left">
                      <textarea
                        value={getRemark(`deferred-row-${row.id}`)}
                        onChange={(e) => setRemark(`deferred-row-${row.id}`, e.target.value)}
                        className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                        rows={1}
                      />
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-200/80">
                  <td className="px-4 py-2 border border-gray-200 font-bold text-[#374151]">
                    資産合計（回収待ち・立替）
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-right tabular-nums font-bold text-[#374151]">
                    {formatAmount(deferredAssetTotal)}
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-left bg-slate-200/80">
                    <textarea
                      value={getRemark("deferred-asset-total")}
                      onChange={(e) => setRemark("deferred-asset-total", e.target.value)}
                      className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                      rows={1}
                    />
                  </td>
                </tr>
                {deferredLiabilityRows.map((row) => (
                  <tr key={`deferred-liability-${row.id}`}>
                    <td className="px-4 py-2 border border-gray-200 text-[#374151]">{row.name}</td>
                    <td className="px-4 py-2 border border-gray-200 text-right tabular-nums">
                      {formatAmount(row.amount)}
                    </td>
                    <td className="px-4 py-2 border border-gray-200 text-left">
                      <textarea
                        value={getRemark(`deferred-row-${row.id}`)}
                        onChange={(e) => setRemark(`deferred-row-${row.id}`, e.target.value)}
                        className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                        rows={1}
                      />
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-200/80">
                  <td className="px-4 py-2 border border-gray-200 font-bold text-[#374151]">
                    負債合計（未払い・お預かり）
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-right tabular-nums font-bold text-[#374151]">
                    {formatAmount(deferredLiabilityTotal)}
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-left bg-slate-200/80">
                    <textarea
                      value={getRemark("deferred-liability-total")}
                      onChange={(e) => setRemark("deferred-liability-total", e.target.value)}
                      className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                      rows={1}
                    />
                  </td>
                </tr>
              </>
            ) : (
              <>
                <tr className="bg-blue-50">
                  <td
                    colSpan={3}
                    className="px-4 py-2 font-semibold text-[#374151] border border-gray-200"
                  >
                    【収入の部】
                    {selectedCategoryName ? `（${selectedCategoryName}）` : ""}
                  </td>
                </tr>
                <tr className="bg-blue-50/50">
                  <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-200">
                    項目
                  </td>
                  <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-200">
                    金額
                  </td>
                  <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-200">
                    備考
                  </td>
                </tr>
                {incomeBySubject.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-[#6B7280] border border-gray-200"
                    >
                      このカテゴリーに紐づく収入科目がありません
                    </td>
                  </tr>
                ) : (
                  incomeBySubject.map((row) => (
                    <tr key={`cat-income-${row.id}`}>
                      <td className="px-4 py-2 border border-gray-200 text-[#374151]">{row.name}</td>
                      <td className="px-4 py-2 border border-gray-200 text-right tabular-nums">
                        {formatAmount(row.amount)}
                      </td>
                      <td className="px-4 py-2 border border-gray-200 text-left">
                        <textarea
                          value={getRemark(`${remarkPrefix}-income-subject-${row.id}`)}
                          onChange={(e) =>
                            setRemark(`${remarkPrefix}-income-subject-${row.id}`, e.target.value)
                          }
                          className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                          rows={1}
                        />
                      </td>
                    </tr>
                  ))
                )}
                <tr className="bg-green-200/80">
                  <td className="px-4 py-2 border border-gray-200 font-bold text-[#374151]">
                    収入の部合計
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-right tabular-nums font-bold text-[#374151]">
                    {formatAmount(categoryIncomeTotal)}
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-left bg-green-200/80">
                    <textarea
                      value={getRemark(`${remarkPrefix}-income-total`)}
                      onChange={(e) => setRemark(`${remarkPrefix}-income-total`, e.target.value)}
                      className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                      rows={1}
                    />
                  </td>
                </tr>

                <tr className="bg-red-50">
                  <td
                    colSpan={3}
                    className="px-4 py-2 font-semibold text-[#374151] border border-gray-200"
                  >
                    【支出の部】
                    {selectedCategoryName ? `（${selectedCategoryName}）` : ""}
                  </td>
                </tr>
                <tr className="bg-red-50/50">
                  <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-200">
                    項目
                  </td>
                  <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-200">
                    金額
                  </td>
                  <td className="px-4 py-2 text-center font-semibold text-[#374151] border border-gray-200">
                    備考
                  </td>
                </tr>
                {expenseBySubject.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-[#6B7280] border border-gray-200"
                    >
                      このカテゴリーに紐づく支出科目がありません
                    </td>
                  </tr>
                ) : (
                  expenseBySubject.map((row) => (
                    <tr key={`cat-expense-${row.id}`}>
                      <td className="px-4 py-2 border border-gray-200 text-[#374151]">{row.name}</td>
                      <td className="px-4 py-2 border border-gray-200 text-right tabular-nums">
                        {formatAmount(row.amount)}
                      </td>
                      <td className="px-4 py-2 border border-gray-200 text-left">
                        <textarea
                          value={getRemark(`${remarkPrefix}-expense-subject-${row.id}`)}
                          onChange={(e) =>
                            setRemark(`${remarkPrefix}-expense-subject-${row.id}`, e.target.value)
                          }
                          className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                          rows={1}
                        />
                      </td>
                    </tr>
                  ))
                )}
                <tr className="bg-amber-200/80">
                  <td className="px-4 py-2 border border-gray-200 font-bold text-[#374151]">
                    支出の部合計
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-right tabular-nums font-bold text-[#374151]">
                    {formatAmount(categoryExpenseTotal)}
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-left bg-amber-200/80">
                    <textarea
                      value={getRemark(`${remarkPrefix}-expense-total`)}
                      onChange={(e) => setRemark(`${remarkPrefix}-expense-total`, e.target.value)}
                      className="w-full text-sm text-[#374151] bg-transparent border border-gray-200 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left"
                      rows={1}
                    />
                  </td>
                </tr>

                <tr>
                  <td colSpan={3} className="h-5 border-x border-gray-200 bg-white"></td>
                </tr>

                <tr className="font-bold">
                  <td
                    className="px-4 py-2.5 border border-gray-200 font-extrabold text-base text-white"
                    style={{ backgroundColor: THEME_COLOR }}
                  >
                    収支合計
                  </td>
                  <td
                    className="px-4 py-2.5 border border-gray-200 text-right tabular-nums font-extrabold text-base text-white"
                    style={{ backgroundColor: THEME_COLOR }}
                  >
                    {formatAmount(categoryNetTotal)}
                  </td>
                  <td
                    className="px-4 py-2.5 border border-gray-200 text-left"
                    style={{ backgroundColor: THEME_COLOR }}
                  >
                    <textarea
                      value={getRemark(`${remarkPrefix}-net-total`)}
                      onChange={(e) => setRemark(`${remarkPrefix}-net-total`, e.target.value)}
                      className="w-full text-sm text-white bg-transparent border border-white/40 rounded px-2 py-1.5 resize-y whitespace-normal break-words text-left placeholder:text-white/70"
                      rows={1}
                    />
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

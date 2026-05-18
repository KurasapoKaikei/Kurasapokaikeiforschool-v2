"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  getCategories,
  getAccountTitles,
  getTransactions,
  getSystemSettings,
  getCollectionSchedules,
  getCollectionRecords,
  isTransferLeg,
  type Category,
  type AccountTitle,
  type Transaction,
  type CollectionSchedule,
  type CollectionRecord,
} from "@/utils/localStorage"

const THEME_COLOR = "#68A384" // 集計・帳簿（青緑）

// 会計年度の月順（4月〜翌3月）
const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const

/** 指定会計年度の月の開始日・終了日を返す */
function getFiscalMonthRange(fiscalYear: number, month: number): { start: Date; end: Date } {
  const year = month >= 4 ? fiscalYear : fiscalYear + 1
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0) // 月末
  return { start, end }
}

/** 日付文字列が範囲内か */
function isDateInRange(dateStr: string, start: Date, end: Date): boolean {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  const s = new Date(start)
  s.setHours(0, 0, 0, 0)
  const e = new Date(end)
  e.setHours(23, 59, 59, 999)
  return d >= s && d <= e
}

/** 現在の会計年度を取得（4月始まり） */
function getCurrentFiscalYear(): number {
  const now = new Date()
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
}

export default function SummaryAnnualPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [collectionSchedules, setCollectionSchedules] = useState<CollectionSchedule[]>([])
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | "all">("all")
  const [openingCarryover, setOpeningCarryover] = useState(0)
  const fiscalYear = getCurrentFiscalYear()
  const categoryOrderMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.order])),
    [categories]
  )
  const getMinCategoryOrder = useCallback(
    (categoryIds: string[]) => {
      if (!categoryIds || categoryIds.length === 0) return Number.MAX_SAFE_INTEGER
      return Math.min(...categoryIds.map((id) => categoryOrderMap.get(id) ?? Number.MAX_SAFE_INTEGER))
    },
    [categoryOrderMap]
  )

  /** 科目別台帳へ遷移（科目名クリック＝全期間） */
  const handleSubjectClick = (subjectId?: string) => {
    if (!subjectId) return
    const params = new URLSearchParams()
    params.set("category", selectedCategoryId)
    params.set("subject", subjectId)
    router.push(`/accounting/ledger/subject?${params.toString()}`)
  }

  /** 科目別台帳へ遷移（月次金額クリック＝該当月でフィルター） */
  const handleMonthAmountClick = (subjectId: string | undefined, month: number) => {
    if (!subjectId) return
    const { start, end } = getFiscalMonthRange(fiscalYear, month)
    const params = new URLSearchParams()
    params.set("category", selectedCategoryId)
    params.set("subject", subjectId)
    params.set("start", format(start, "yyyy-MM-dd"))
    params.set("end", format(end, "yyyy-MM-dd"))
    router.push(`/accounting/ledger/subject?${params.toString()}`)
  }

  const refreshAll = useCallback(() => {
    setCategories(getCategories())
    setAccountTitles(getAccountTitles())
    setTransactions(getTransactions())
    setOpeningCarryover(getSystemSettings().openingCarryover ?? 0)
    setCollectionSchedules(getCollectionSchedules())
    setCollectionRecords(getCollectionRecords())
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

  const selectedCategoryName = useMemo(() => {
    if (selectedCategoryId === "all") return null
    return categories.find((c) => c.id === selectedCategoryId)?.name ?? null
  }, [selectedCategoryId, categories])

  /**
   * 集金実績（records）から収入エントリを補完生成する。
   * 既に同じ transactionId の collection 取引がある場合は二重計上を避けるため除外する。
   */
  const collectionIncomeEntries = useMemo(() => {
    const scheduleMap = new Map(collectionSchedules.map((s) => [s.id, s]))
    const existingCollectionTxIds = new Set(
      transactions.filter((t) => t.type === "collection").map((t) => t.id)
    )
    const list: Array<{ date: string; amount: number; accountTitle: string; category: string }> = []

    collectionRecords.forEach((record) => {
      const schedule = scheduleMap.get(record.scheduleId)
      if (!schedule) return
      const accountTitle = schedule.accountTitleName || schedule.name || "会費収入"
      const category = schedule.categoryName || "集金"

      const history = record.paymentHistory ?? []
      if (history.length > 0) {
        history.forEach((h) => {
          // 既存 collection 取引と重複する履歴は補完対象から除外
          if (h.transactionId && existingCollectionTxIds.has(h.transactionId)) return
          list.push({
            date: h.date,
            amount: h.amount,
            accountTitle,
            category,
          })
        })
        return
      }

      // 履歴未保存の旧データ向けフォールバック
      if (record.status !== "UNPAID" && (record.paidAmount ?? 0) !== 0 && record.paidAt) {
        if (record.linkedTransactionId && existingCollectionTxIds.has(record.linkedTransactionId)) return
        list.push({
          date: record.paidAt,
          amount: record.paidAmount ?? 0,
          accountTitle,
          category,
        })
      }
    })

    return list
  }, [collectionSchedules, collectionRecords, transactions])

  // 現金・預金科目名（口座名）を集計表の項目から除外するための集合
  const cashAccountNameSet = useMemo(
    () => new Set(accountTitles.filter((a) => a.group === "cash").map((a) => a.name)),
    [accountTitles]
  )

  // カテゴリーでフィルタした収入・支出科目（マスタ + 実取引）
  const incomeTitles = useMemo(() => {
    let list = accountTitles.filter((a) => a.group === "income")
    if (selectedCategoryId !== "all") {
      list = list.filter((a) => a.categoryIds.includes(selectedCategoryId))
    }
    const map = new Map<string, { id?: string; name: string; order: number; categoryOrder: number }>()
    ;[...list].sort((a, b) => a.order - b.order).forEach((t) => {
      if (!map.has(t.name)) {
        map.set(t.name, {
          id: t.id,
          name: t.name,
          order: t.order,
          categoryOrder: getMinCategoryOrder(t.categoryIds),
        })
      }
    })
    const incomeSources = [
      ...transactions
        .filter((t) => (t.type === "income" || t.type === "collection") && !isTransferLeg(t))
        .map((t) => ({ accountTitle: t.accountTitle, category: t.category })),
      ...collectionIncomeEntries.map((c) => ({
        accountTitle: c.accountTitle,
        category: c.category,
      })),
    ]
    incomeSources
      .filter((t) => !cashAccountNameSet.has(t.accountTitle))
      .filter((t) => selectedCategoryName === null || t.category === selectedCategoryName)
      .forEach((t) => {
        if (!map.has(t.accountTitle)) {
          const byName = accountTitles.find((a) => a.group === "income" && a.name === t.accountTitle)
          if (!byName) return
          map.set(t.accountTitle, {
            id: byName.id,
            name: t.accountTitle,
            order: byName.order,
            categoryOrder: getMinCategoryOrder(byName.categoryIds),
          })
        }
      })
    return Array.from(map.values()).sort(
      (a, b) =>
        a.categoryOrder - b.categoryOrder ||
        a.order - b.order ||
        a.name.localeCompare(b.name, "ja")
    )
  }, [accountTitles, selectedCategoryId, selectedCategoryName, transactions, collectionIncomeEntries, getMinCategoryOrder, cashAccountNameSet])

  const expenseTitles = useMemo(() => {
    let list = accountTitles.filter((a) => a.group === "expense")
    if (selectedCategoryId !== "all") {
      list = list.filter((a) => a.categoryIds.includes(selectedCategoryId))
    }
    const map = new Map<string, { id?: string; name: string; order: number; categoryOrder: number }>()
    ;[...list].sort((a, b) => a.order - b.order).forEach((t) => {
      if (!map.has(t.name)) {
        map.set(t.name, {
          id: t.id,
          name: t.name,
          order: t.order,
          categoryOrder: getMinCategoryOrder(t.categoryIds),
        })
      }
    })
    transactions
      // 振替（=出金元/入金先の2レコード）と現金・預金口座名を支出集計から除外
      .filter((t) => t.type === "expense" && !isTransferLeg(t))
      .filter((t) => !cashAccountNameSet.has(t.accountTitle))
      .filter((t) => selectedCategoryName === null || t.category === selectedCategoryName)
      .forEach((t) => {
        if (!map.has(t.accountTitle)) {
          const byName = accountTitles.find(
            (a) => a.group === "expense" && a.name === t.accountTitle
          )
          if (!byName) return
          map.set(t.accountTitle, {
            id: byName.id,
            name: t.accountTitle,
            order: byName.order,
            categoryOrder: getMinCategoryOrder(byName.categoryIds),
          })
        }
      })
    return Array.from(map.values()).sort(
      (a, b) =>
        a.categoryOrder - b.categoryOrder ||
        a.order - b.order ||
        a.name.localeCompare(b.name, "ja")
    )
  }, [accountTitles, selectedCategoryId, selectedCategoryName, transactions, getMinCategoryOrder, cashAccountNameSet])

  // 月別・科目別集計（収入）
  const incomeByMonthAndTitle = useMemo(() => {
    const map: Record<number, Record<string, number>> = {}
    FISCAL_MONTHS.forEach((m) => {
      map[m] = {}
      incomeTitles.forEach((t) => {
        map[m][t.name] = 0
      })
    })

    const incomeSources = [
      ...transactions
        .filter((t) => (t.type === "income" || t.type === "collection") && !isTransferLeg(t))
        .map((t) => ({
          date: t.date,
          amount: t.amount,
          accountTitle: t.accountTitle,
          category: t.category,
        })),
      ...collectionIncomeEntries,
    ]

    incomeSources
      .filter((t) => selectedCategoryName === null || t.category === selectedCategoryName)
      .forEach((t) => {
        for (const month of FISCAL_MONTHS) {
          const { start, end } = getFiscalMonthRange(fiscalYear, month)
          if (isDateInRange(t.date, start, end) && incomeTitles.some((a) => a.name === t.accountTitle)) {
            map[month][t.accountTitle] = (map[month][t.accountTitle] ?? 0) + t.amount
            break
          }
        }
      })

    return map
  }, [transactions, collectionIncomeEntries, fiscalYear, selectedCategoryName, incomeTitles])

  // 月別・科目別集計（支出）
  const expenseByMonthAndTitle = useMemo(() => {
    const map: Record<number, Record<string, number>> = {}
    FISCAL_MONTHS.forEach((m) => {
      map[m] = {}
      expenseTitles.forEach((t) => {
        map[m][t.name] = 0
      })
    })

    transactions
      .filter((t) => t.type === "expense" && !isTransferLeg(t))
      .filter((t) => selectedCategoryName === null || t.category === selectedCategoryName)
      .forEach((t) => {
        for (const month of FISCAL_MONTHS) {
          const { start, end } = getFiscalMonthRange(fiscalYear, month)
          if (isDateInRange(t.date, start, end) && expenseTitles.some((a) => a.name === t.accountTitle)) {
            map[month][t.accountTitle] = (map[month][t.accountTitle] ?? 0) + t.amount
            break
          }
        }
      })

    return map
  }, [transactions, fiscalYear, selectedCategoryName, expenseTitles])

  // 月別合計（収入・支出）
  const incomeTotalByMonth = useMemo(() => {
    const totals: Record<number, number> = {}
    FISCAL_MONTHS.forEach((m) => {
      totals[m] = Object.values(incomeByMonthAndTitle[m] ?? {}).reduce((s, v) => s + v, 0)
    })
    return totals
  }, [incomeByMonthAndTitle])

  const expenseTotalByMonth = useMemo(() => {
    const totals: Record<number, number> = {}
    FISCAL_MONTHS.forEach((m) => {
      totals[m] = Object.values(expenseByMonthAndTitle[m] ?? {}).reduce((s, v) => s + v, 0)
    })
    return totals
  }, [expenseByMonthAndTitle])

  const yearTotalIncome = useMemo(
    () => FISCAL_MONTHS.reduce((s, m) => s + (incomeTotalByMonth[m] ?? 0), 0),
    [incomeTotalByMonth]
  )
  const yearTotalExpense = useMemo(
    () => FISCAL_MONTHS.reduce((s, m) => s + (expenseTotalByMonth[m] ?? 0), 0),
    [expenseTotalByMonth]
  )
  const balanceTotal = yearTotalIncome - yearTotalExpense
  const isAllCategory = selectedCategoryId === "all"
  const nextCarryoverTotal = openingCarryover + yearTotalIncome - yearTotalExpense

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  )

  // 数値のみ表示（カンマ区切り、¥なし）
  const formatAmount = (n: number) => (n === 0 ? "-" : n.toLocaleString())

  return (
    <div className="px-6 py-8 min-h-screen bg-[#F5F5F0]">
      {/* ヘッダー（テーマカラー） */}
      <div
        className="rounded-t-lg border border-b-0 border-gray-200 px-6 py-4"
        style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR, backgroundColor: "white" }}
      >
        <h2 className="text-xl font-semibold" style={{ color: THEME_COLOR }}>
          収支集計表（年間）
        </h2>
      </div>

      {/* カテゴリー選択バー（左詰め） + 単位表示 */}
      <div className="bg-white border-x border-gray-200 px-6 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#6B7280]">カテゴリー:</span>
        <button
          onClick={() => setSelectedCategoryId("all")}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            selectedCategoryId === "all" ? "text-white" : "bg-gray-100 text-[#374151] hover:bg-gray-200"
          }`}
          style={selectedCategoryId === "all" ? { backgroundColor: THEME_COLOR } : {}}
        >
          すべて
        </button>
        {sortedCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoryId(cat.id)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              selectedCategoryId === cat.id ? "text-white" : "bg-gray-100 text-[#374151] hover:bg-gray-200"
            }`}
            style={selectedCategoryId === cat.id ? { backgroundColor: THEME_COLOR } : {}}
          >
            {cat.name}
          </button>
        ))}
        </div>
        <span className="text-xs text-[#9CA3AF]">（単位：円）</span>
      </div>

      {/* テーブル（横スクロール・科目列・年間合計列固定・ゼブラ・縦線） */}
      <div className="bg-white border border-gray-200 rounded-b-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th
                  className="px-4 py-3 text-center font-semibold text-[#374151] border-b border-r border-gray-200 bg-gray-50 sticky left-0 z-20 min-w-[160px]"
                  style={{ boxShadow: "2px 0 4px -2px rgba(0,0,0,0.1)" }}
                >
                  科目
                </th>
                {FISCAL_MONTHS.map((m) => (
                  <th
                    key={m}
                    className="px-3 py-3 text-center font-semibold text-[#374151] border-b border-r border-gray-200 min-w-[90px]"
                  >
                    {m}月度
                  </th>
                ))}
                <th
                  className="px-3 py-3 text-center font-semibold text-[#374151] border-b border-gray-200 bg-gray-50 sticky right-0 z-20 min-w-[100px]"
                  style={{ boxShadow: "-2px 0 4px -2px rgba(0,0,0,0.1)" }}
                >
                  年間合計
                </th>
              </tr>
            </thead>
            <tbody>
              {/* セクション見出し: 収入 */}
              <tr className="bg-gray-100 border-b border-r border-gray-200">
                <td
                  colSpan={14}
                  className="px-4 py-2 text-left font-semibold text-[#374151] border-r border-gray-200"
                >
                  【収入】
                </td>
              </tr>
              {incomeTitles.map((title, idx) => (
                <tr
                  key={title.name}
                  className={`border-b border-gray-200 ${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"
                  } hover:bg-gray-100/50`}
                >
                  <td
                    className={`px-4 py-2.5 text-[#374151] border-r border-gray-200 font-medium sticky left-0 z-10 cursor-pointer hover:underline hover:text-[#68A384] ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"
                    }`}
                    style={{ boxShadow: "2px 0 4px -2px rgba(0,0,0,0.08)" }}
                    onClick={() => handleSubjectClick(title.id)}
                  >
                    {title.name}
                  </td>
                  {FISCAL_MONTHS.map((m) => {
                    const amt = incomeByMonthAndTitle[m]?.[title.name] ?? 0
                    return (
                      <td
                        key={m}
                        className={`px-3 py-2.5 text-right text-[#374151] tabular-nums border-r border-gray-200 cursor-pointer hover:underline hover:text-[#68A384] ${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"
                        }`}
                        onClick={() => handleMonthAmountClick(title.id, m)}
                      >
                        {formatAmount(amt)}
                      </td>
                    )
                  })}
                  <td
                    className={`px-3 py-2.5 text-right font-semibold text-[#374151] tabular-nums border-r border-gray-200 sticky right-0 z-10 ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"
                    }`}
                    style={{ boxShadow: "-2px 0 4px -2px rgba(0,0,0,0.08)" }}
                  >
                    {formatAmount(
                      FISCAL_MONTHS.reduce((s, m) => s + (incomeByMonthAndTitle[m]?.[title.name] ?? 0), 0)
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-b-2 border-gray-300 bg-green-200/80">
                <td
                  className="px-4 py-2.5 font-semibold text-[#374151] border-r border-gray-200 sticky left-0 z-10 bg-green-200/80"
                  style={{ boxShadow: "2px 0 4px -2px rgba(0,0,0,0.08)" }}
                >
                  収入合計
                </td>
                {FISCAL_MONTHS.map((m) => (
                  <td
                    key={m}
                    className="px-3 py-2.5 text-right font-semibold text-[#374151] tabular-nums border-r border-gray-200 bg-green-200/80"
                  >
                    {formatAmount(incomeTotalByMonth[m] ?? 0)}
                  </td>
                ))}
                <td
                  className="px-3 py-2.5 text-right font-bold text-[#374151] tabular-nums border-r border-gray-200 bg-green-300/90 sticky right-0 z-10"
                  style={{ boxShadow: "-2px 0 4px -2px rgba(0,0,0,0.08)" }}
                >
                  {formatAmount(yearTotalIncome)}
                </td>
              </tr>

              {/* セクション見出し: 支出 */}
              <tr className="bg-gray-100 border-b border-gray-200">
                <td
                  colSpan={14}
                  className="px-4 py-2 text-left font-semibold text-[#374151] border-r border-gray-200"
                >
                  【支出】
                </td>
              </tr>
              {expenseTitles.map((title, idx) => (
                <tr
                  key={title.name}
                  className={`border-b border-gray-200 ${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"
                  } hover:bg-gray-100/50`}
                >
                  <td
                    className={`px-4 py-2.5 text-[#374151] border-r border-gray-200 font-medium sticky left-0 z-10 cursor-pointer hover:underline hover:text-[#68A384] ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"
                    }`}
                    style={{ boxShadow: "2px 0 4px -2px rgba(0,0,0,0.08)" }}
                    onClick={() => handleSubjectClick(title.id)}
                  >
                    {title.name}
                  </td>
                  {FISCAL_MONTHS.map((m) => {
                    const amt = expenseByMonthAndTitle[m]?.[title.name] ?? 0
                    return (
                      <td
                        key={m}
                        className={`px-3 py-2.5 text-right text-[#374151] tabular-nums border-r border-gray-200 cursor-pointer hover:underline hover:text-[#68A384] ${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"
                        }`}
                        onClick={() => handleMonthAmountClick(title.id, m)}
                      >
                        {formatAmount(amt)}
                      </td>
                    )
                  })}
                  <td
                    className={`px-3 py-2.5 text-right font-semibold text-[#374151] tabular-nums border-r border-gray-200 sticky right-0 z-10 ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"
                    }`}
                    style={{ boxShadow: "-2px 0 4px -2px rgba(0,0,0,0.08)" }}
                  >
                    {formatAmount(
                      FISCAL_MONTHS.reduce((s, m) => s + (expenseByMonthAndTitle[m]?.[title.name] ?? 0), 0)
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-b-2 border-gray-300 bg-amber-200/80">
                <td
                  className="px-4 py-2.5 font-semibold text-[#374151] border-r border-gray-200 sticky left-0 z-10 bg-amber-200/80"
                  style={{ boxShadow: "2px 0 4px -2px rgba(0,0,0,0.08)" }}
                >
                  支出合計
                </td>
                {FISCAL_MONTHS.map((m) => (
                  <td
                    key={m}
                    className="px-3 py-2.5 text-right font-semibold text-[#374151] tabular-nums border-r border-gray-200 bg-amber-200/80"
                  >
                    {formatAmount(expenseTotalByMonth[m] ?? 0)}
                  </td>
                ))}
                <td
                  className="px-3 py-2.5 text-right font-bold text-[#374151] tabular-nums border-r border-gray-200 bg-amber-300/90 sticky right-0 z-10"
                  style={{ boxShadow: "-2px 0 4px -2px rgba(0,0,0,0.08)" }}
                >
                  {formatAmount(yearTotalExpense)}
                </td>
              </tr>

              {/* 収支合計（2行表示: ラベル + 計算式） */}
              <tr className="font-bold">
                <td
                  className="px-4 py-3 border-r border-gray-200 sticky left-0 z-10 text-white"
                  style={{ backgroundColor: THEME_COLOR, boxShadow: "2px 0 4px -2px rgba(0,0,0,0.08)" }}
                >
                  <div>収支合計</div>
                  <div className="text-xs font-normal opacity-90 mt-0.5">（収入合計 − 支出合計）</div>
                </td>
                {FISCAL_MONTHS.map((m) => (
                  <td
                    key={m}
                    className="px-3 py-3 text-right tabular-nums text-[#374151] bg-gray-50 border-r border-gray-200"
                  >
                    {formatAmount((incomeTotalByMonth[m] ?? 0) - (expenseTotalByMonth[m] ?? 0))}
                  </td>
                ))}
                <td
                  className="px-3 py-3 text-right tabular-nums font-bold text-white border-r border-gray-200 sticky right-0 z-10"
                  style={{ backgroundColor: THEME_COLOR, boxShadow: "-2px 0 4px -2px rgba(0,0,0,0.08)" }}
                >
                  {formatAmount(balanceTotal)}
                </td>
              </tr>
              {isAllCategory && (
                <>
                  <tr className="font-bold border-t-2 border-gray-300 bg-slate-100/80">
                    <td colSpan={13} className="px-4 py-3 text-left text-[#374151] border-r border-gray-200">
                      前期繰越金
                    </td>
                    <td
                      className="px-3 py-3 text-right tabular-nums font-bold text-[#374151] border-r border-gray-200 sticky right-0 z-10 bg-slate-100/80"
                      style={{ boxShadow: "-2px 0 4px -2px rgba(0,0,0,0.08)" }}
                    >
                      {formatAmount(openingCarryover)}
                    </td>
                  </tr>
                  <tr className="font-bold bg-slate-200/80">
                    <td colSpan={13} className="px-4 py-3 text-left text-[#374151] border-r border-gray-200">
                      次期繰越金
                    </td>
                    <td
                      className="px-3 py-3 text-right tabular-nums font-bold text-[#374151] border-r border-gray-200 sticky right-0 z-10 bg-slate-200/80"
                      style={{ boxShadow: "-2px 0 4px -2px rgba(0,0,0,0.08)" }}
                    >
                      {formatAmount(nextCarryoverTotal)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

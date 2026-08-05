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
  getMonthlyNote,
  saveMonthlyNote,
  isTransferLeg,
  type Category,
  type AccountTitle,
  type Transaction,
  type CollectionSchedule,
  type CollectionRecord,
} from "@/utils/localStorage"
import { SettlementLockAlert } from "@/components/club/SettlementLockAlert"
import { useClubSettlementLock } from "@/hooks/useClubSettlementLock"
import {
  FISCAL_OPENING_MONTH,
  getSubjectOpeningForSummary,
} from "@/lib/accountTitleBalances"
import { getDeferredRecordPlAdjustment } from "@/lib/deferredAccounting"
import { buildCollectionIncomeFallbackEntries } from "@/lib/collectionIncomeFallback"
import { formatAmountDisplay } from "@/utils/formatAmountDisplay"

const THEME_COLOR = "#68A384" // 集計・帳簿（青緑）

// 会計年度の月順（4月〜翌3月）
const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const

// 月次用カラム幅比率（合計20）: 科目5, 金額5, メモ10
const MONTHLY_COL_RATIOS = [5, 5, 10] as const
const MONTHLY_COL_WIDTHS = MONTHLY_COL_RATIOS.map((r) => `${(r / 20) * 100}%`)

// 年次: 科目11 + 月12×6 + 決算6 + 合計11 = 100（横スクロールなしで収める）
const ANNUAL_COL_WIDTHS = ["11%", ...Array(12).fill("6%"), "6%", "11%"] as const

/** 現在の会計年度を取得（4月始まり） */
function getCurrentFiscalYear(): number {
  const now = new Date()
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
}

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

/** 現在の月を取得 */
function getCurrentMonth(): number {
  return new Date().getMonth() + 1
}

interface SummaryRow {
  subjectId?: string
  subjectName: string
  amount: number
  type: "income" | "expense"
}

/** メモ欄セルコンポーネント（プレースホルダーなし・中央寄せ） */
function MemoCell({
  subjectId,
  year,
  month,
  isLocked,
}: {
  subjectId?: string
  year: number
  month: number
  isLocked: boolean
}) {
  const [memo, setMemo] = useState("")
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (!subjectId) {
      setMemo("")
      return
    }
    const saved = getMonthlyNote(subjectId, year, month)
    setMemo(saved)
  }, [subjectId, year, month])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
    if (!subjectId || isLocked) return
    saveMonthlyNote(subjectId, year, month, memo)
  }, [subjectId, year, month, memo, isLocked])

  return (
    <input
      type="text"
      value={memo}
      onChange={(e) => setMemo(e.target.value)}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      disabled={!subjectId || isLocked}
      lang="ja"
      autoComplete="off"
      className={`w-full px-2 py-1.5 text-sm text-center text-[#374151] bg-transparent border rounded focus:outline-none focus:ring-1 focus:ring-[#68A384] ${
        !subjectId ? "border-transparent text-[#9CA3AF] cursor-not-allowed" : isFocused ? "border-[#68A384]" : "border-transparent hover:border-gray-300"
      }`}
    />
  )
}

type ViewMode = "annual" | "monthly"
/** 月次の選択: 会計月（4〜3）または決算（繰延計上） */
type MonthlySelection = number | "closing"

export default function SummaryPage() {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>("annual")
  const [categories, setCategories] = useState<Category[]>([])
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [collectionSchedules, setCollectionSchedules] = useState<CollectionSchedule[]>([])
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | "all">("all")
  const [openingCarryover, setOpeningCarryover] = useState(0)
  const fiscalYear = getCurrentFiscalYear()
  const [selectedMonth, setSelectedMonth] = useState<MonthlySelection>(getCurrentMonth())
  const isLocked = useClubSettlementLock()
  const isClosingView = selectedMonth === "closing"
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

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  )

  const selectedCategoryName = useMemo(() => {
    if (selectedCategoryId === "all") return null
    return categories.find((c) => c.id === selectedCategoryId)?.name ?? null
  }, [selectedCategoryId, categories])

  const collectionIncomeEntries = useMemo(
    () =>
      buildCollectionIncomeFallbackEntries(
        collectionRecords,
        collectionSchedules,
        transactions
      ),
    [collectionSchedules, collectionRecords, transactions]
  )

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
      ...collectionIncomeEntries.map((c) => ({ accountTitle: c.accountTitle, category: c.category })),
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
          // マスタに「支出科目」として登録されていない名前は表に出さない
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

  // ===== 年間集計用 =====
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
        .map((t) => ({ date: t.date, amount: t.amount, accountTitle: t.accountTitle, category: t.category })),
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

    // 科目別台帳と同じ初期残高を期首月（4月）に加算
    const categoryTab = selectedCategoryId === "all" ? "all" : selectedCategoryId
    incomeTitles.forEach((t) => {
      const full = accountTitles.find((a) => a.group === "income" && a.name === t.name)
      const opening = getSubjectOpeningForSummary(full, categoryTab)
      if (opening !== 0) {
        map[FISCAL_OPENING_MONTH][t.name] =
          (map[FISCAL_OPENING_MONTH][t.name] ?? 0) + opening
      }
    })

    return map
  }, [
    transactions,
    collectionIncomeEntries,
    fiscalYear,
    selectedCategoryName,
    selectedCategoryId,
    incomeTitles,
    accountTitles,
  ])

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

    const categoryTab = selectedCategoryId === "all" ? "all" : selectedCategoryId
    expenseTitles.forEach((t) => {
      const full = accountTitles.find((a) => a.group === "expense" && a.name === t.name)
      const opening = getSubjectOpeningForSummary(full, categoryTab)
      if (opening !== 0) {
        map[FISCAL_OPENING_MONTH][t.name] =
          (map[FISCAL_OPENING_MONTH][t.name] ?? 0) + opening
      }
    })

    return map
  }, [
    transactions,
    fiscalYear,
    selectedCategoryName,
    selectedCategoryId,
    expenseTitles,
    accountTitles,
  ])

  /** 繰延計上のみ（年次「決算」列・月次「決算」用）。会計年度内の計上を対象 */
  const { incomeClosingByTitle, expenseClosingByTitle } = useMemo(() => {
    const incomeMap: Record<string, number> = {}
    const expenseMap: Record<string, number> = {}
    incomeTitles.forEach((t) => {
      incomeMap[t.name] = 0
    })
    expenseTitles.forEach((t) => {
      expenseMap[t.name] = 0
    })

    const fyStart = getFiscalMonthRange(fiscalYear, 4).start
    const fyEnd = getFiscalMonthRange(fiscalYear, 3).end

    transactions.forEach((t) => {
      const adj = getDeferredRecordPlAdjustment(t)
      if (!adj) return
      if (!isDateInRange(adj.transaction.date, fyStart, fyEnd)) return
      if (selectedCategoryName !== null && adj.categoryName !== selectedCategoryName) return

      if (adj.side === "income") {
        if (!incomeTitles.some((a) => a.name === adj.subjectName)) return
        incomeMap[adj.subjectName] = (incomeMap[adj.subjectName] ?? 0) + adj.signedAmount
      } else {
        if (!expenseTitles.some((a) => a.name === adj.subjectName)) return
        expenseMap[adj.subjectName] = (expenseMap[adj.subjectName] ?? 0) + adj.signedAmount
      }
    })

    return { incomeClosingByTitle: incomeMap, expenseClosingByTitle: expenseMap }
  }, [
    transactions,
    fiscalYear,
    selectedCategoryName,
    incomeTitles,
    expenseTitles,
  ])

  const incomeClosingTotal = useMemo(
    () => Object.values(incomeClosingByTitle).reduce((s, v) => s + v, 0),
    [incomeClosingByTitle]
  )
  const expenseClosingTotal = useMemo(
    () => Object.values(expenseClosingByTitle).reduce((s, v) => s + v, 0),
    [expenseClosingByTitle]
  )

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
    () =>
      FISCAL_MONTHS.reduce((s, m) => s + (incomeTotalByMonth[m] ?? 0), 0) + incomeClosingTotal,
    [incomeTotalByMonth, incomeClosingTotal]
  )
  const yearTotalExpense = useMemo(
    () =>
      FISCAL_MONTHS.reduce((s, m) => s + (expenseTotalByMonth[m] ?? 0), 0) + expenseClosingTotal,
    [expenseTotalByMonth, expenseClosingTotal]
  )
  const yearBalanceTotal = yearTotalIncome - yearTotalExpense
  const isAllCategory = selectedCategoryId === "all"
  const nextCarryoverTotal = openingCarryover + yearTotalIncome - yearTotalExpense

  // ===== 月次集計用 =====
  const fiscalYearEndDateStr = useMemo(
    () => format(getFiscalMonthRange(fiscalYear, 3).end, "yyyy-MM-dd"),
    [fiscalYear]
  )

  const { start: monthStart, end: monthEnd } = useMemo(() => {
    if (selectedMonth === "closing") {
      const end = getFiscalMonthRange(fiscalYear, 3).end
      // 決算表示のドリルダウン用に期末日を範囲とする
      return { start: end, end }
    }
    return getFiscalMonthRange(fiscalYear, selectedMonth)
  }, [fiscalYear, selectedMonth])

  const displayYear = useMemo(() => {
    if (selectedMonth === "closing") return fiscalYear + 1
    return selectedMonth >= 4 ? fiscalYear : fiscalYear + 1
  }, [fiscalYear, selectedMonth])

  const filteredTransactionsMonthly = useMemo(() => {
    if (selectedMonth === "closing") return []
    return transactions.filter((t) => {
      if (!t.date) return false
      if (!isDateInRange(t.date, monthStart, monthEnd)) return false
      if (selectedCategoryName !== null && t.category !== selectedCategoryName) return false
      return true
    })
  }, [transactions, monthStart, monthEnd, selectedCategoryName, selectedMonth])

  const filteredCollectionIncomeEntries = useMemo(() => {
    if (selectedMonth === "closing") return []
    return collectionIncomeEntries.filter((t) => {
      if (!t.date) return false
      if (!isDateInRange(t.date, monthStart, monthEnd)) return false
      if (selectedCategoryName !== null && t.category !== selectedCategoryName) return false
      return true
    })
  }, [collectionIncomeEntries, monthStart, monthEnd, selectedCategoryName, selectedMonth])

  const incomeRowsMonthly = useMemo((): SummaryRow[] => {
    const categoryTab = selectedCategoryId === "all" ? "all" : selectedCategoryId
    const includeOpening = selectedMonth === FISCAL_OPENING_MONTH
    return incomeTitles.map((title) => {
      if (selectedMonth === "closing") {
        return {
          subjectId: title.id,
          subjectName: title.name,
          amount: incomeClosingByTitle[title.name] ?? 0,
          type: "income",
        }
      }
      const txs = filteredTransactionsMonthly.filter(
        (t) => (t.type === "income" || t.type === "collection") && !isTransferLeg(t) && t.accountTitle === title.name
      )
      const fallbackCollections = filteredCollectionIncomeEntries.filter(
        (t) => t.accountTitle === title.name
      )
      const full = accountTitles.find((a) => a.group === "income" && a.name === title.name)
      const opening = includeOpening
        ? getSubjectOpeningForSummary(full, categoryTab)
        : 0
      const totalAmount =
        txs.reduce((s, t) => s + t.amount, 0) +
        fallbackCollections.reduce((s, t) => s + t.amount, 0) +
        opening
      return {
        subjectId: title.id,
        subjectName: title.name,
        amount: totalAmount,
        type: "income",
      }
    })
  }, [
    incomeTitles,
    filteredTransactionsMonthly,
    filteredCollectionIncomeEntries,
    incomeClosingByTitle,
    selectedMonth,
    selectedCategoryId,
    accountTitles,
  ])

  const expenseRowsMonthly = useMemo((): SummaryRow[] => {
    const categoryTab = selectedCategoryId === "all" ? "all" : selectedCategoryId
    const includeOpening = selectedMonth === FISCAL_OPENING_MONTH
    return expenseTitles.map((title) => {
      if (selectedMonth === "closing") {
        return {
          subjectId: title.id,
          subjectName: title.name,
          amount: expenseClosingByTitle[title.name] ?? 0,
          type: "expense",
        }
      }
      const txs = filteredTransactionsMonthly.filter(
        (t) => t.type === "expense" && !isTransferLeg(t) && t.accountTitle === title.name
      )
      const full = accountTitles.find((a) => a.group === "expense" && a.name === title.name)
      const opening = includeOpening
        ? getSubjectOpeningForSummary(full, categoryTab)
        : 0
      const totalAmount = txs.reduce((s, t) => s + t.amount, 0) + opening
      return {
        subjectId: title.id,
        subjectName: title.name,
        amount: totalAmount,
        type: "expense",
      }
    })
  }, [
    expenseTitles,
    filteredTransactionsMonthly,
    expenseClosingByTitle,
    selectedMonth,
    selectedCategoryId,
    accountTitles,
  ])

  const monthlyTotalIncome = useMemo(
    () => incomeRowsMonthly.reduce((s, r) => s + r.amount, 0),
    [incomeRowsMonthly]
  )
  const monthlyTotalExpense = useMemo(
    () => expenseRowsMonthly.reduce((s, r) => s + r.amount, 0),
    [expenseRowsMonthly]
  )
  const monthlyBalance = monthlyTotalIncome - monthlyTotalExpense

  // 数値のみ表示（カンマ区切り、¥なし）
  const formatAmount = (n: number) => formatAmountDisplay(n, { zeroAsDash: true })
  const formatAmountMonthly = (n: number) => formatAmountDisplay(n)

  /** 科目別台帳へ遷移（年間：科目名クリック＝全期間） */
  const handleSubjectClickAnnual = (subjectId?: string) => {
    if (!subjectId) return
    const params = new URLSearchParams()
    params.set("category", selectedCategoryId)
    params.set("subject", subjectId)
    router.push(`/club/accounting/ledger/subject?${params.toString()}`)
  }

  /** 科目別台帳へ遷移（年間：月次金額クリック＝該当月でフィルター） */
  const handleMonthAmountClick = (subjectId: string | undefined, month: number) => {
    if (!subjectId) return
    const { start, end } = getFiscalMonthRange(fiscalYear, month)
    const params = new URLSearchParams()
    params.set("category", selectedCategoryId)
    params.set("subject", subjectId)
    params.set("start", format(start, "yyyy-MM-dd"))
    params.set("end", format(end, "yyyy-MM-dd"))
    router.push(`/club/accounting/ledger/subject?${params.toString()}`)
  }

  /** 科目別台帳へ遷移（年間：決算列クリック＝期末日） */
  const handleClosingAmountClick = (subjectId: string | undefined) => {
    if (!subjectId) return
    const params = new URLSearchParams()
    params.set("category", selectedCategoryId)
    params.set("subject", subjectId)
    params.set("start", fiscalYearEndDateStr)
    params.set("end", fiscalYearEndDateStr)
    router.push(`/club/accounting/ledger/subject?${params.toString()}`)
  }

  /** 科目別台帳へ遷移（月次：該当月または決算フィルター済み） */
  const handleSubjectClickMonthly = (subjectId?: string) => {
    if (!subjectId) return
    const params = new URLSearchParams()
    params.set("category", selectedCategoryId)
    params.set("subject", subjectId)
    if (selectedMonth === "closing") {
      params.set("start", fiscalYearEndDateStr)
      params.set("end", fiscalYearEndDateStr)
    } else {
      params.set("start", format(monthStart, "yyyy-MM-dd"))
      params.set("end", format(monthEnd, "yyyy-MM-dd"))
    }
    router.push(`/club/accounting/ledger/subject?${params.toString()}`)
  }

  const memoKey =
    selectedMonth === "closing"
      ? `${fiscalYear}-closing`
      : `${displayYear}-${selectedMonth}`
  const monthlyHeading =
    selectedMonth === "closing"
      ? `${fiscalYear}年度 決算の収支集計`
      : `${displayYear}年${selectedMonth}月の収支集計`

  return (
    <div className="px-6 py-8 min-h-screen bg-[#F5F5F0] w-full">
      {/* ヘッダー（テーマカラー） */}
      <div
        className="rounded-t-lg border border-b-0 border-gray-200 px-6 py-4"
        style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR, backgroundColor: "white" }}
      >
        <h2 className="text-xl font-semibold" style={{ color: THEME_COLOR }}>
          収支集計表
        </h2>
        <SettlementLockAlert isLocked={isLocked} className="mt-3" />
      </div>

      {/* 年次/月次 切替タブ */}
      <div
        className="bg-white border-x border-t border-gray-200 px-6 py-3"
        style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR }}
      >
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("annual")}
            className={`px-6 py-2.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "annual"
                ? "text-white shadow-sm"
                : "bg-gray-100 text-[#374151] hover:bg-gray-200"
            }`}
            style={viewMode === "annual" ? { backgroundColor: THEME_COLOR } : {}}
          >
            年次
          </button>
          <button
            onClick={() => setViewMode("monthly")}
            className={`px-6 py-2.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "monthly"
                ? "text-white shadow-sm"
                : "bg-gray-100 text-[#374151] hover:bg-gray-200"
            }`}
            style={viewMode === "monthly" ? { backgroundColor: THEME_COLOR } : {}}
          >
            月次
          </button>
        </div>
      </div>

      {/* 月度選択（月次のみ表示） */}
      {viewMode === "monthly" && (
        <div
          className="bg-white border-x border-t border-gray-200 px-6 py-4"
          style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-[#6B7280]">月度選択:</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {FISCAL_MONTHS.map((month) => {
              const isSelected = selectedMonth === month
              const monthYear = month >= 4 ? fiscalYear : fiscalYear + 1
              return (
                <button
                  key={month}
                  onClick={() => setSelectedMonth(month)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors min-w-[50px] ${
                    isSelected
                      ? "text-white shadow-sm"
                      : "bg-gray-100 text-[#374151] hover:bg-gray-200"
                  }`}
                  style={isSelected ? { backgroundColor: THEME_COLOR } : {}}
                  title={`${monthYear}年${month}月`}
                >
                  {month}
                </button>
              )
            })}
            <button
              onClick={() => setSelectedMonth("closing")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors min-w-[50px] ${
                isClosingView
                  ? "text-white shadow-sm"
                  : "bg-gray-100 text-[#374151] hover:bg-gray-200"
              }`}
              style={isClosingView ? { backgroundColor: THEME_COLOR } : {}}
              title={`${fiscalYear}年度 決算（繰延計上）`}
            >
              決算
            </button>
          </div>
        </div>
      )}

      {/* カテゴリー選択バー + 単位表示 */}
      <div
        className="bg-white border-x border-t border-gray-200 px-6 py-3 flex flex-wrap items-center justify-between gap-2"
        style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR }}
      >
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

      {/* ===== 年次集計テーブル ===== */}
      {viewMode === "annual" && (
        <div className="bg-white border border-gray-200 rounded-b-lg overflow-hidden">
          <table className="w-full border-collapse table-fixed text-[10px] [&_td]:break-all [&_th]:break-words">
              <colgroup>
                {ANNUAL_COL_WIDTHS.map((w, i) => (
                  <col key={i} style={{ width: w }} />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-0.5 py-1.5 text-center font-semibold text-[#374151] border-b border-r border-gray-200 bg-gray-50 text-[10px] leading-tight">
                    科目
                  </th>
                  {FISCAL_MONTHS.map((m) => (
                    <th
                      key={m}
                      className="px-0.5 py-1.5 text-center font-semibold text-[#374151] border-b border-r border-gray-200 text-[10px] leading-tight"
                    >
                      {m}月
                    </th>
                  ))}
                  <th className="px-0.5 py-1.5 text-center font-semibold text-[#374151] border-b border-r border-gray-200 bg-[#EEF6F1] text-[10px] leading-tight">
                    決算
                  </th>
                  <th className="px-0.5 py-1.5 text-center font-semibold text-[#374151] border-b border-gray-200 bg-gray-50 text-[10px] leading-tight">
                    合計
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* セクション見出し: 収入 */}
                <tr className="bg-gray-100 border-b border-r border-gray-200">
                  <td
                    colSpan={15}
                    className="px-1 py-1.5 text-left font-semibold text-[#374151] border-r border-gray-200"
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
                      className={`px-1 py-1.5 text-[#374151] border-r border-gray-200 font-medium break-words cursor-pointer hover:underline hover:text-[#68A384] ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"
                      }`}
                      onClick={() => handleSubjectClickAnnual(title.id)}
                    >
                      {title.name}
                    </td>
                    {FISCAL_MONTHS.map((m) => {
                      const amt = incomeByMonthAndTitle[m]?.[title.name] ?? 0
                      return (
                        <td
                          key={m}
                          className={`px-0.5 py-1.5 text-right text-[#374151] tabular-nums border-r border-gray-200 cursor-pointer hover:underline hover:text-[#68A384] ${
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"
                          }`}
                          onClick={() => handleMonthAmountClick(title.id, m)}
                        >
                          {formatAmount(amt)}
                        </td>
                      )
                    })}
                    <td
                      className={`px-0.5 py-1.5 text-right text-[#374151] tabular-nums border-r border-gray-200 cursor-pointer hover:underline hover:text-[#68A384] bg-[#EEF6F1]/70 ${
                        idx % 2 === 0 ? "" : ""
                      }`}
                      onClick={() => handleClosingAmountClick(title.id)}
                    >
                      {formatAmount(incomeClosingByTitle[title.name] ?? 0)}
                    </td>
                    <td
                      className={`px-0.5 py-1.5 text-right font-semibold text-[#374151] tabular-nums border-r border-gray-200 ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"
                      }`}
                    >
                      {formatAmount(
                        FISCAL_MONTHS.reduce(
                          (s, m) => s + (incomeByMonthAndTitle[m]?.[title.name] ?? 0),
                          0
                        ) + (incomeClosingByTitle[title.name] ?? 0)
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="border-b-2 border-gray-300 bg-green-200/80">
                  <td
                    className="px-1 py-1.5 font-semibold text-[#374151] border-r border-gray-200 bg-green-200/80"
                  >
                    収入合計
                  </td>
                  {FISCAL_MONTHS.map((m) => (
                    <td
                      key={m}
                      className="px-0.5 py-1.5 text-right font-semibold text-[#374151] tabular-nums border-r border-gray-200 bg-green-200/80"
                    >
                      {formatAmount(incomeTotalByMonth[m] ?? 0)}
                    </td>
                  ))}
                  <td className="px-0.5 py-1.5 text-right font-semibold text-[#374151] tabular-nums border-r border-gray-200 bg-green-200/80">
                    {formatAmount(incomeClosingTotal)}
                  </td>
                  <td
                    className="px-0.5 py-1.5 text-right font-bold text-[#374151] tabular-nums border-r border-gray-200 bg-green-300/90"
                  >
                    {formatAmount(yearTotalIncome)}
                  </td>
                </tr>

                {/* セクション見出し: 支出 */}
                <tr className="bg-gray-100 border-b border-gray-200">
                  <td
                    colSpan={15}
                    className="px-1 py-1.5 text-left font-semibold text-[#374151] border-r border-gray-200"
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
                      className={`px-1 py-1.5 text-[#374151] border-r border-gray-200 font-medium break-words cursor-pointer hover:underline hover:text-[#68A384] ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"
                      }`}
                      onClick={() => handleSubjectClickAnnual(title.id)}
                    >
                      {title.name}
                    </td>
                    {FISCAL_MONTHS.map((m) => {
                      const amt = expenseByMonthAndTitle[m]?.[title.name] ?? 0
                      return (
                        <td
                          key={m}
                          className={`px-0.5 py-1.5 text-right text-[#374151] tabular-nums border-r border-gray-200 cursor-pointer hover:underline hover:text-[#68A384] ${
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"
                          }`}
                          onClick={() => handleMonthAmountClick(title.id, m)}
                        >
                          {formatAmount(amt)}
                        </td>
                      )
                    })}
                    <td
                      className="px-0.5 py-1.5 text-right text-[#374151] tabular-nums border-r border-gray-200 cursor-pointer hover:underline hover:text-[#68A384] bg-[#EEF6F1]/70"
                      onClick={() => handleClosingAmountClick(title.id)}
                    >
                      {formatAmount(expenseClosingByTitle[title.name] ?? 0)}
                    </td>
                    <td
                      className={`px-0.5 py-1.5 text-right font-semibold text-[#374151] tabular-nums border-r border-gray-200 ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"
                      }`}
                    >
                      {formatAmount(
                        FISCAL_MONTHS.reduce(
                          (s, m) => s + (expenseByMonthAndTitle[m]?.[title.name] ?? 0),
                          0
                        ) + (expenseClosingByTitle[title.name] ?? 0)
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="border-b-2 border-gray-300 bg-amber-200/80">
                  <td
                    className="px-1 py-1.5 font-semibold text-[#374151] border-r border-gray-200 bg-amber-200/80"
                  >
                    支出合計
                  </td>
                  {FISCAL_MONTHS.map((m) => (
                    <td
                      key={m}
                      className="px-0.5 py-1.5 text-right font-semibold text-[#374151] tabular-nums border-r border-gray-200 bg-amber-200/80"
                    >
                      {formatAmount(expenseTotalByMonth[m] ?? 0)}
                    </td>
                  ))}
                  <td className="px-0.5 py-1.5 text-right font-semibold text-[#374151] tabular-nums border-r border-gray-200 bg-amber-200/80">
                    {formatAmount(expenseClosingTotal)}
                  </td>
                  <td
                    className="px-0.5 py-1.5 text-right font-bold text-[#374151] tabular-nums border-r border-gray-200 bg-amber-300/90"
                  >
                    {formatAmount(yearTotalExpense)}
                  </td>
                </tr>

                {/* 収支合計 */}
                <tr className="font-bold">
                  <td
                    className="px-1 py-1.5 border-r border-gray-200 text-white"
                    style={{ backgroundColor: THEME_COLOR }}
                  >
                    <div>収支合計</div>
                    <div className="text-[9px] font-normal opacity-90 mt-0.5">（収入合計 − 支出合計）</div>
                  </td>
                  {FISCAL_MONTHS.map((m) => (
                    <td
                      key={m}
                      className="px-0.5 py-1.5 text-right tabular-nums text-[#374151] bg-gray-50 border-r border-gray-200"
                    >
                      {formatAmount((incomeTotalByMonth[m] ?? 0) - (expenseTotalByMonth[m] ?? 0))}
                    </td>
                  ))}
                  <td className="px-0.5 py-1.5 text-right tabular-nums text-[#374151] bg-gray-50 border-r border-gray-200">
                    {formatAmount(incomeClosingTotal - expenseClosingTotal)}
                  </td>
                  <td
                    className="px-0.5 py-1.5 text-right tabular-nums font-bold text-white border-r border-gray-200"
                    style={{ backgroundColor: THEME_COLOR }}
                  >
                    {formatAmount(yearBalanceTotal)}
                  </td>
                </tr>
                {isAllCategory && (
                  <>
                    <tr className="font-bold border-t-2 border-gray-300 bg-slate-100/80">
                      <td
                        colSpan={14}
                        className="px-1 py-1.5 text-left text-[#334155] font-extrabold border-r border-gray-200 bg-slate-100/80"
                      >
                        前期繰越金
                      </td>
                      <td
                        className="px-0.5 py-1.5 text-right tabular-nums font-extrabold text-[#334155] border-r border-gray-200 bg-slate-100/80"
                      >
                        {formatAmount(openingCarryover)}
                      </td>
                    </tr>
                    <tr className="font-bold bg-slate-200/80">
                      <td
                        colSpan={14}
                        className="px-1 py-1.5 text-left text-[#374151] border-r border-gray-200 bg-slate-200/80"
                      >
                        次期繰越金
                      </td>
                      <td
                        className="px-0.5 py-1.5 text-right tabular-nums font-bold text-[#374151] border-r border-gray-200 bg-slate-200/80"
                      >
                        {formatAmount(nextCarryoverTotal)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
        </div>
      )}

      {/* ===== 月次集計テーブル ===== */}
      {viewMode === "monthly" && (
        <div className="bg-white border border-gray-200 rounded-b-lg overflow-hidden">
          <div
            className="px-6 py-3 text-base font-semibold text-white text-center border-b border-gray-200"
            style={{ backgroundColor: THEME_COLOR }}
          >
            {monthlyHeading}
          </div>

          <div className="p-4">
            <table className="w-full border-collapse text-sm table-fixed">
              <colgroup>
                {MONTHLY_COL_WIDTHS.map((w, i) => (
                  <col key={i} style={{ width: w }} />
                ))}
              </colgroup>
              <tbody>
                {/* ===== 収入セクション ===== */}
                <tr className="bg-blue-50 border-b border-gray-200">
                  <td colSpan={3} className="px-4 py-2 text-left font-semibold text-[#374151] border border-gray-200">
                    【収入】
                  </td>
                </tr>
                <tr className="bg-blue-50/50">
                  <td className="px-4 py-1.5 text-center text-xs font-semibold text-[#374151] border border-gray-200">
                    科目
                  </td>
                  <td className="px-3 py-1.5 text-center text-xs font-semibold text-[#374151] border border-gray-200">
                    収入金額
                  </td>
                  <td className="px-3 py-1.5 text-center text-xs font-semibold text-[#374151] border border-gray-200">
                    メモ
                  </td>
                </tr>
                {incomeTitles.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-[#6B7280] border border-gray-200">
                      収入科目が登録されていません
                    </td>
                  </tr>
                ) : (
                  incomeRowsMonthly.map((row, idx) => (
                    <tr
                      key={row.subjectName}
                      className={`hover:bg-gray-100/50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"}`}
                    >
                      <td
                        className="px-4 py-2.5 text-left text-[#374151] border border-gray-200 font-medium cursor-pointer hover:underline hover:text-[#68A384]"
                        onClick={() => handleSubjectClickMonthly(row.subjectId)}
                      >
                        {row.subjectName}
                      </td>
                      <td
                        className="px-3 py-2.5 text-right tabular-nums text-[#374151] border border-gray-200 cursor-pointer hover:underline hover:text-[#68A384]"
                        onClick={() => handleSubjectClickMonthly(row.subjectId)}
                      >
                        {formatAmountMonthly(row.amount)}
                      </td>
                      <td className="px-2 py-1 text-center border border-gray-200">
                        <MemoCell
                          key={`${memoKey}-${row.subjectName}`}
                          subjectId={row.subjectId}
                          year={selectedMonth === "closing" ? fiscalYear : displayYear}
                          month={selectedMonth === "closing" ? 0 : selectedMonth}
                          isLocked={isLocked}
                        />
                      </td>
                    </tr>
                  ))
                )}
                <tr className="bg-green-200/80">
                  <td className="px-4 py-2.5 text-left font-semibold text-[#374151] border border-gray-200">
                    収入合計
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-[#374151] tabular-nums border border-gray-200">
                    {formatAmountMonthly(monthlyTotalIncome)}
                  </td>
                  <td className="px-3 py-2.5 border border-gray-200 bg-green-200/80"></td>
                </tr>

                {/* ===== 支出セクション ===== */}
                <tr className="bg-red-50 border-b border-gray-200">
                  <td colSpan={3} className="px-4 py-2 text-left font-semibold text-[#374151] border border-gray-200">
                    【支出】
                  </td>
                </tr>
                <tr className="bg-red-50/50">
                  <td className="px-4 py-1.5 text-center text-xs font-semibold text-[#374151] border border-gray-200">
                    科目
                  </td>
                  <td className="px-3 py-1.5 text-center text-xs font-semibold text-[#374151] border border-gray-200">
                    支出金額
                  </td>
                  <td className="px-3 py-1.5 text-center text-xs font-semibold text-[#374151] border border-gray-200">
                    メモ
                  </td>
                </tr>
                {expenseTitles.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-[#6B7280] border border-gray-200">
                      支出科目が登録されていません
                    </td>
                  </tr>
                ) : (
                  expenseRowsMonthly.map((row, idx) => (
                    <tr
                      key={row.subjectName}
                      className={`hover:bg-gray-100/50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"}`}
                    >
                      <td
                        className="px-4 py-2.5 text-left text-[#374151] border border-gray-200 font-medium cursor-pointer hover:underline hover:text-[#68A384]"
                        onClick={() => handleSubjectClickMonthly(row.subjectId)}
                      >
                        {row.subjectName}
                      </td>
                      <td
                        className="px-3 py-2.5 text-right tabular-nums text-[#374151] border border-gray-200 cursor-pointer hover:underline hover:text-[#68A384]"
                        onClick={() => handleSubjectClickMonthly(row.subjectId)}
                      >
                        {formatAmountMonthly(row.amount)}
                      </td>
                      <td className="px-2 py-1 text-center border border-gray-200">
                        <MemoCell
                          key={`${memoKey}-${row.subjectName}`}
                          subjectId={row.subjectId}
                          year={selectedMonth === "closing" ? fiscalYear : displayYear}
                          month={selectedMonth === "closing" ? 0 : selectedMonth}
                          isLocked={isLocked}
                        />
                      </td>
                    </tr>
                  ))
                )}
                <tr className="bg-amber-200/80">
                  <td className="px-4 py-2.5 text-left font-semibold text-[#374151] border border-gray-200">
                    支出合計
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-[#374151] tabular-nums border border-gray-200">
                    {formatAmountMonthly(monthlyTotalExpense)}
                  </td>
                  <td className="px-3 py-2.5 border border-gray-200 bg-amber-200/80"></td>
                </tr>

                {/* ===== 収支合計 ===== */}
                <tr className="font-bold">
                  <td
                    className="px-4 py-3 text-left text-white border border-gray-200"
                    style={{ backgroundColor: THEME_COLOR }}
                  >
                    <div>収支合計</div>
                    <div className="text-xs font-normal opacity-90 mt-0.5">（収入 − 支出）</div>
                  </td>
                  <td
                    className="px-3 py-3 text-right tabular-nums font-bold text-white border border-gray-200"
                    style={{ backgroundColor: THEME_COLOR }}
                  >
                    {formatAmountMonthly(monthlyBalance)}
                  </td>
                  <td
                    className="px-3 py-3 text-center border border-gray-200"
                    style={{ backgroundColor: THEME_COLOR }}
                  ></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

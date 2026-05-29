"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  getAccountTitles,
  getBudgetSettings,
  getCategories,
  getCollectionRecords,
  getCollectionSchedules,
  getTransactions,
  saveBudgetSettings,
  upsertBudgetSetting,
  type AccountTitle,
  type BudgetSetting,
  type Category,
  type CollectionRecord,
  type CollectionSchedule,
  type Transaction,
} from "@/utils/localStorage"
import { SettlementLockAlert } from "@/components/club/SettlementLockAlert"

const AUTO_COL_BG = "bg-gray-50"

type ViewMode = "book" | "year-over-year"
type SectionType = "income" | "expense"

type BudgetRowMetric = {
  budget: number
  actual: number
  diff: number
}

type YoYRowMetric = {
  prev: number
  current: number
  diff: number
}

function getCurrentFiscalYear(): number {
  const now = new Date()
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
}

function isDateInFiscalYear(dateStr: string, fiscalYear: number): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return false
  const start = new Date(fiscalYear, 3, 1)
  const end = new Date(fiscalYear + 1, 2, 31, 23, 59, 59, 999)
  return d >= start && d <= end
}

const formatAmount = (n: number) => n.toLocaleString()
const makeBudgetKey = (fiscalYear: number, categoryId: string, accountTitleId: string) =>
  `${fiscalYear}_${categoryId}_${accountTitleId}`
const makeActualKey = (categoryName: string, accountTitle: string) => `${categoryName}_${accountTitle}`

const formatRate = (base: number, current: number) => {
  if (base <= 0) return current > 0 ? "100%+" : "-"
  return `${((current / base) * 100).toFixed(1)}%`
}

export function BudgetManagementView({ mode }: { mode: ViewMode }) {
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    try {
      const savedLocked = localStorage.getItem("is_club_settlement_locked")
      if (savedLocked === "true") {
        setIsLocked(true)
      }
    } catch (e) {}
  }, [])

  const canEditBudgetFields = !isLocked

  const [categories, setCategories] = useState<Category[]>([])
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])
  const [budgetSettings, setBudgetSettings] = useState<BudgetSetting[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [collectionSchedules, setCollectionSchedules] = useState<CollectionSchedule[]>([])
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([])
  const [activeTab, setActiveTab] = useState<string>("all")
  const [draftAmounts, setDraftAmounts] = useState<Record<string, string>>({})
  const fiscalYear = getCurrentFiscalYear()
  /** カテゴリタブ切替直後に前タブの input が blur して別カテゴリに保存されるのを防ぐ */
  const activeCategoryTabRef = useRef(activeTab)
  activeCategoryTabRef.current = activeTab

  const refreshAll = useCallback(() => {
    setCategories(getCategories())
    setAccountTitles(getAccountTitles())
    setBudgetSettings(getBudgetSettings())
    setTransactions(getTransactions())
    setCollectionSchedules(getCollectionSchedules())
    setCollectionRecords(getCollectionRecords())
  }, [])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  /** DB から当年度の予算を読み込み、localStorage と画面状態へ反映 */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/budget?fiscalYear=${fiscalYear}`)
        if (!res.ok) return
        const data = (await res.json()) as {
          items?: Array<{
            categoryId: string
            accountTitleId: string
            amount: number
            updatedAt?: string
          }>
        }
        if (cancelled || !Array.isArray(data.items)) return
        const local = getBudgetSettings()
        const others = local.filter((b) => b.fiscalYear !== fiscalYear)
        const fromDb: BudgetSetting[] = data.items.map((i) => ({
          id: `db_${fiscalYear}_${i.categoryId}_${i.accountTitleId}`,
          fiscalYear,
          categoryId: i.categoryId,
          accountTitleId: i.accountTitleId,
          amount: Number(i.amount),
          updatedAt: i.updatedAt ?? new Date().toISOString(),
        }))
        const dbKeys = new Set(
          fromDb.map((b) => makeBudgetKey(b.fiscalYear, b.categoryId, b.accountTitleId))
        )
        const localSameYear = local.filter(
          (b) =>
            b.fiscalYear === fiscalYear &&
            !dbKeys.has(makeBudgetKey(b.fiscalYear, b.categoryId, b.accountTitleId))
        )
        const merged = [...others, ...fromDb, ...localSameYear]
        saveBudgetSettings(merged)
        if (!cancelled) {
          setBudgetSettings(merged)
          setDraftAmounts({})
        }
      } catch {
        // DATABASE_URL 未設定などは localStorage のみ
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fiscalYear])

  useEffect(() => {
    const onStorage = () => refreshAll()
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener("storage", onStorage)
    }
  }, [refreshAll])

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  )
  const categoryNameById = useMemo(
    () => new Map(sortedCategories.map((c) => [c.id, c.name])),
    [sortedCategories]
  )
  const allCategoryIds = useMemo(() => sortedCategories.map((c) => c.id), [sortedCategories])

  const budgetMap = useMemo(() => {
    const map = new Map<string, number>()
    budgetSettings
      .filter((b) => b.fiscalYear === fiscalYear)
      .forEach((b) => {
        map.set(makeBudgetKey(fiscalYear, b.categoryId, b.accountTitleId), b.amount)
      })
    return map
  }, [budgetSettings, fiscalYear])

  const incomeTitles = useMemo(
    () => accountTitles.filter((t) => t.group === "income").sort((a, b) => a.order - b.order),
    [accountTitles]
  )
  const expenseTitles = useMemo(
    () => accountTitles.filter((t) => t.group === "expense").sort((a, b) => a.order - b.order),
    [accountTitles]
  )

  const selectedCategory = useMemo(
    () => sortedCategories.find((c) => c.id === activeTab) ?? null,
    [sortedCategories, activeTab]
  )

  const visibleIncomeTitles = useMemo(
    () =>
      activeTab === "all"
        ? incomeTitles
        : selectedCategory
          ? incomeTitles.filter((t) => t.categoryIds.includes(selectedCategory.id))
          : [],
    [activeTab, incomeTitles, selectedCategory]
  )
  const visibleExpenseTitles = useMemo(
    () =>
      activeTab === "all"
        ? expenseTitles
        : selectedCategory
          ? expenseTitles.filter((t) => t.categoryIds.includes(selectedCategory.id))
          : [],
    [activeTab, expenseTitles, selectedCategory]
  )

  const getStoredBudget = useCallback(
    (categoryId: string, accountTitleId: string) =>
      budgetMap.get(makeBudgetKey(fiscalYear, categoryId, accountTitleId)) ?? 0,
    [budgetMap, fiscalYear]
  )

  const getAllTabBudgetByTitle = useCallback(
    (accountTitleId: string) =>
      sortedCategories.reduce((sum, cat) => sum + getStoredBudget(cat.id, accountTitleId), 0),
    [sortedCategories, getStoredBudget]
  )

  const handleDraftChange = (key: string, raw: string) => {
    if (!canEditBudgetFields) return
    const cleaned = raw.replace(/[^\d,]/g, "").replace(/,/g, "")
    if (cleaned === "") {
      setDraftAmounts((prev) => ({ ...prev, [key]: "" }))
      return
    }
    setDraftAmounts((prev) => ({ ...prev, [key]: Number(cleaned).toLocaleString() }))
  }

  const handleBudgetBlur = async (categoryId: string, accountTitleId: string) => {
    if (!canEditBudgetFields) return
    if (activeCategoryTabRef.current !== categoryId) {
      return
    }
    const key = makeBudgetKey(fiscalYear, categoryId, accountTitleId)
    const raw = (draftAmounts[key] ?? formatAmount(getStoredBudget(categoryId, accountTitleId)))
      .replace(/,/g, "")
      .trim()
    const amount = raw === "" ? 0 : Number(raw)
    if (!Number.isFinite(amount) || amount < 0) {
      setDraftAmounts((prev) => ({ ...prev, [key]: formatAmount(getStoredBudget(categoryId, accountTitleId)) }))
      return
    }
    const truncated = Math.trunc(amount)
    upsertBudgetSetting({
      fiscalYear,
      categoryId,
      accountTitleId,
      amount: truncated,
    })
    setBudgetSettings(getBudgetSettings())
    setDraftAmounts((prev) => ({ ...prev, [key]: formatAmount(truncated) }))
    try {
      await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fiscalYear,
          categoryId,
          accountTitleId,
          amount: truncated,
        }),
      })
    } catch (e) {
      console.error("[budget POST]", e)
    }
  }

  const selectCategoryTab = useCallback((tab: string) => {
    setDraftAmounts({})
    setActiveTab(tab)
  }, [])

  const collectionIncomeEntries = useMemo(() => {
    const scheduleMap = new Map(collectionSchedules.map((s) => [s.id, s]))
    const existingCollectionTxIds = new Set(
      transactions.filter((t) => t.type === "collection").map((t) => t.id)
    )
    const list: Array<{ date: string; amount: number; category: string; accountTitle: string }> = []

    collectionRecords.forEach((record) => {
      const schedule = scheduleMap.get(record.scheduleId)
      if (!schedule) return
      const accountTitle = schedule.accountTitleName || schedule.name || "会費収入"
      const category = schedule.categoryName || "集金"
      const history = record.paymentHistory ?? []

      if (history.length > 0) {
        history.forEach((h) => {
          if (h.transactionId && existingCollectionTxIds.has(h.transactionId)) return
          list.push({ date: h.date, amount: h.amount, category, accountTitle })
        })
        return
      }

      if (record.status !== "UNPAID" && (record.paidAmount ?? 0) !== 0 && record.paidAt) {
        if (record.linkedTransactionId && existingCollectionTxIds.has(record.linkedTransactionId)) return
        list.push({
          date: record.paidAt,
          amount: record.paidAmount ?? 0,
          category,
          accountTitle,
        })
      }
    })

    return list
  }, [collectionSchedules, collectionRecords, transactions])

  const buildActualMaps = useCallback(
    (targetFiscalYear: number) => {
      const incomeMap = new Map<string, number>()
      const expenseMap = new Map<string, number>()
      let hasData = false

      transactions
        .filter((t) => isDateInFiscalYear(t.date, targetFiscalYear))
        .forEach((t) => {
          const key = makeActualKey(t.category, t.accountTitle)
          if (t.type === "income" || t.type === "collection") {
            incomeMap.set(key, (incomeMap.get(key) ?? 0) + t.amount)
            hasData = true
          } else if (t.type === "expense" || t.type === "transfer") {
            expenseMap.set(key, (expenseMap.get(key) ?? 0) + t.amount)
            hasData = true
          }
        })

      collectionIncomeEntries
        .filter((entry) => isDateInFiscalYear(entry.date, targetFiscalYear))
        .forEach((entry) => {
          const key = makeActualKey(entry.category, entry.accountTitle)
          incomeMap.set(key, (incomeMap.get(key) ?? 0) + entry.amount)
          hasData = true
        })

      return { incomeMap, expenseMap, hasData }
    },
    [transactions, collectionIncomeEntries]
  )

  const currentYearActualMaps = useMemo(
    () => buildActualMaps(fiscalYear),
    [buildActualMaps, fiscalYear]
  )
  const prevYearActualMaps = useMemo(
    () => buildActualMaps(fiscalYear - 1),
    [buildActualMaps, fiscalYear]
  )

  const getActual = useCallback(
    (categoryIds: string[], titleName: string, section: SectionType) => {
      const map = section === "income" ? currentYearActualMaps.incomeMap : currentYearActualMaps.expenseMap
      return categoryIds.reduce((sum, categoryId) => {
        const categoryName = categoryNameById.get(categoryId)
        if (!categoryName) return sum
        return sum + (map.get(makeActualKey(categoryName, titleName)) ?? 0)
      }, 0)
    },
    [currentYearActualMaps, categoryNameById]
  )

  const getBudgetMetric = useCallback(
    (section: SectionType, title: AccountTitle): BudgetRowMetric => {
      const targetCategoryIds =
        activeTab === "all"
          ? title.categoryIds
          : selectedCategory
            ? [selectedCategory.id]
            : []
      const budget =
        activeTab === "all"
          ? getAllTabBudgetByTitle(title.id)
          : selectedCategory
            ? getStoredBudget(selectedCategory.id, title.id)
            : 0
      const actual = getActual(targetCategoryIds, title.name, section)
      const diff = section === "income" ? actual - budget : budget - actual
      return { budget, actual, diff }
    },
    [activeTab, selectedCategory, getAllTabBudgetByTitle, getStoredBudget, getActual]
  )

  const getYoYMetric = useCallback(
    (section: SectionType, title: AccountTitle): YoYRowMetric => {
      const targetCategoryIds =
        activeTab === "all" ? allCategoryIds : selectedCategory ? [selectedCategory.id] : []
      const prevMap = section === "income" ? prevYearActualMaps.incomeMap : prevYearActualMaps.expenseMap
      const currentMap = section === "income" ? currentYearActualMaps.incomeMap : currentYearActualMaps.expenseMap
      const prev = targetCategoryIds.reduce((sum, categoryId) => {
        const categoryName = categoryNameById.get(categoryId)
        if (!categoryName) return sum
        return sum + (prevMap.get(makeActualKey(categoryName, title.name)) ?? 0)
      }, 0)
      const current = targetCategoryIds.reduce((sum, categoryId) => {
        const categoryName = categoryNameById.get(categoryId)
        if (!categoryName) return sum
        return sum + (currentMap.get(makeActualKey(categoryName, title.name)) ?? 0)
      }, 0)
      return { prev, current, diff: current - prev }
    },
    [activeTab, allCategoryIds, selectedCategory, prevYearActualMaps, currentYearActualMaps, categoryNameById]
  )

  const incomeBudgetRows = useMemo(
    () => visibleIncomeTitles.map((title) => ({ title, metric: getBudgetMetric("income", title) })),
    [visibleIncomeTitles, getBudgetMetric]
  )
  const expenseBudgetRows = useMemo(
    () => visibleExpenseTitles.map((title) => ({ title, metric: getBudgetMetric("expense", title) })),
    [visibleExpenseTitles, getBudgetMetric]
  )

  const incomeYoYRows = useMemo(
    () => visibleIncomeTitles.map((title) => ({ title, metric: getYoYMetric("income", title) })),
    [visibleIncomeTitles, getYoYMetric]
  )
  const expenseYoYRows = useMemo(
    () => visibleExpenseTitles.map((title) => ({ title, metric: getYoYMetric("expense", title) })),
    [visibleExpenseTitles, getYoYMetric]
  )

  const incomeBudgetTotals = useMemo(
    () =>
      incomeBudgetRows.reduce(
        (acc, row) => ({
          budget: acc.budget + row.metric.budget,
          actual: acc.actual + row.metric.actual,
          diff: acc.diff + row.metric.diff,
        }),
        { budget: 0, actual: 0, diff: 0 }
      ),
    [incomeBudgetRows]
  )
  const expenseBudgetTotals = useMemo(
    () =>
      expenseBudgetRows.reduce(
        (acc, row) => ({
          budget: acc.budget + row.metric.budget,
          actual: acc.actual + row.metric.actual,
          diff: acc.diff + row.metric.diff,
        }),
        { budget: 0, actual: 0, diff: 0 }
      ),
    [expenseBudgetRows]
  )
  const balanceBudgetTotals = useMemo(() => {
    const budget = incomeBudgetTotals.budget - expenseBudgetTotals.budget
    const actual = incomeBudgetTotals.actual - expenseBudgetTotals.actual
    return { budget, actual, diff: actual - budget }
  }, [incomeBudgetTotals, expenseBudgetTotals])

  const incomeYoYTotals = useMemo(
    () =>
      incomeYoYRows.reduce(
        (acc, row) => ({
          prev: acc.prev + row.metric.prev,
          current: acc.current + row.metric.current,
          diff: acc.diff + row.metric.diff,
        }),
        { prev: 0, current: 0, diff: 0 }
      ),
    [incomeYoYRows]
  )
  const expenseYoYTotals = useMemo(
    () =>
      expenseYoYRows.reduce(
        (acc, row) => ({
          prev: acc.prev + row.metric.prev,
          current: acc.current + row.metric.current,
          diff: acc.diff + row.metric.diff,
        }),
        { prev: 0, current: 0, diff: 0 }
      ),
    [expenseYoYRows]
  )
  const balanceYoYTotals = useMemo(() => {
    const prev = incomeYoYTotals.prev - expenseYoYTotals.prev
    const current = incomeYoYTotals.current - expenseYoYTotals.current
    return { prev, current, diff: current - prev }
  }, [incomeYoYTotals, expenseYoYTotals])

  const renderExpenseDiffClass = (diff: number) => (diff < 0 ? "text-red-600 font-semibold" : "text-[#374151]")

  const renderBudgetCell = (title: AccountTitle) => {
    if (activeTab === "all") {
      return (
        <td className="px-4 py-2 border border-gray-200 text-right tabular-nums">
          {formatAmount(getAllTabBudgetByTitle(title.id))}
        </td>
      )
    }
    const categoryId = selectedCategory?.id
    if (!categoryId) {
      return <td className="px-4 py-2 border border-gray-200 text-right tabular-nums">-</td>
    }
    const key = makeBudgetKey(fiscalYear, categoryId, title.id)
    const stored = formatAmount(getStoredBudget(categoryId, title.id))
    const displayValue =
      draftAmounts[key] !== undefined ? draftAmounts[key] : stored

    if (!canEditBudgetFields) {
      return (
        <td className="px-4 py-2 border border-gray-200 text-right tabular-nums bg-gray-50 text-[#374151]">
          {stored}
        </td>
      )
    }

    return (
      <td className="border border-gray-200 bg-white p-1.5 align-middle ring-1 ring-inset ring-[#1A237E]/20">
        <input
          key={`${fiscalYear}-${activeTab}-${categoryId}-${title.id}`}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={(e) => handleDraftChange(key, e.target.value)}
          onBlur={() => void handleBudgetBlur(categoryId, title.id)}
          className="w-full min-h-[2.5rem] px-3 py-2 bg-white border-2 border-[#1A237E]/45 rounded-md text-right tabular-nums text-[#374151] shadow-sm focus:outline-none focus:border-budget focus:ring-2 focus:ring-budget/25"
          aria-label={`${title.name}の年度予算額`}
        />
      </td>
    )
  }

  const sectionNote =
    activeTab === "all"
      ? "全カテゴリー合算（閲覧専用）"
      : `${selectedCategory?.name ?? ""} の設定`
  const pageTitle = mode === "book" ? "予算書" : "前年度比"

  return (
    <div className="px-6 py-8 min-h-screen bg-[#F5F5F0]">
      {/*
        1段目の紺色帯「予実管理」＝全ページ共通の Header（#1A237E）。
        2段目＝帳簿の収支報告書（report/page.tsx）と同じ枠：白＋左5pxアクセント。見出しは仕様どおり紺太字。
      */}
      <div
        className="rounded-t-lg border border-b-0 border-gray-300 bg-white overflow-hidden"
        style={{ borderLeftWidth: 5, borderLeftColor: "#1A237E" }}
      >
        <div className="px-6 py-4">
          <h2 className="text-xl font-bold text-[#1A237E]">{pageTitle}</h2>
          <p className="text-xs text-[#6B7280] mt-1">
            {fiscalYear}年度 · {sectionNote}
            {mode === "book" && activeTab !== "all" ? " · 予算入力可" : ""}
            {mode === "year-over-year"
              ? ` · ${fiscalYear - 1}年度実績と${fiscalYear}年度実績の比較`
              : ""}
            {" · "}
            （単位：円）
          </p>
          <SettlementLockAlert isLocked={isLocked} className="mt-3" />
        </div>
        <div className="border-t border-gray-200 px-6 py-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => selectCategoryTab("all")}
              className={`px-4 py-2 rounded-md text-sm font-semibold border transition-colors ${
                activeTab === "all"
                  ? "border-budget bg-budget text-white shadow-sm"
                  : "border-gray-200 bg-white text-[#374151] hover:bg-gray-50"
              }`}
            >
              すべて
            </button>
            {sortedCategories.map((cat) => (
              <button
                type="button"
                key={cat.id}
                onClick={() => selectCategoryTab(cat.id)}
                className={`px-4 py-2 rounded-md text-sm font-semibold border transition-colors ${
                  activeTab === cat.id
                    ? "border-budget bg-budget text-white shadow-sm"
                    : "border-gray-200 bg-white text-[#374151] hover:bg-gray-50"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-300 rounded-b-lg overflow-hidden border-t-0">
        <div className="p-5 space-y-6">
          {mode === "book" && activeTab !== "all" && (
            <p className="text-xs text-[#6B7280]">年度予算額は入力後にフォーカスを外すと保存されます。</p>
          )}
          {mode === "year-over-year" && !prevYearActualMaps.hasData && (
            <p className="text-sm text-[#6B7280]">前年度データはありません（比較対象は0表示）。</p>
          )}

          <section>
            <h3 className="font-semibold mb-2 text-[#374151]">
              収入科目
            </h3>
            <table className="w-full border-collapse text-sm table-fixed">
              <colgroup>
                <col style={{ width: "20%" }} />
                <col style={{ width: "26.6667%" }} />
                <col style={{ width: "26.6667%" }} />
                <col style={{ width: "13.3333%" }} />
                <col style={{ width: "13.3333%" }} />
              </colgroup>
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-center border border-gray-200">科目</th>
                  {mode === "book" ? (
                    <>
                      <th className="px-4 py-2 text-center border border-gray-200">年度予算額</th>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>年度実績額</th>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>差額</th>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>達成率</th>
                    </>
                  ) : (
                    <>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>前年度実績額</th>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>今年度実績額</th>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>増減額</th>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>増減率</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {mode === "book"
                  ? incomeBudgetRows.map(({ title, metric }) => (
                      <tr key={`income-book-${activeTab}-${title.id}`}>
                        <td className="px-4 py-2 border border-gray-200 text-left">{title.name}</td>
                        {renderBudgetCell(title)}
                        <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums ${AUTO_COL_BG}`}>
                          {formatAmount(metric.actual)}
                        </td>
                        <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums ${AUTO_COL_BG}`}>
                          {formatAmount(metric.diff)}
                        </td>
                        <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums ${AUTO_COL_BG}`}>
                          {formatRate(metric.budget, metric.actual)}
                        </td>
                      </tr>
                    ))
                  : incomeYoYRows.map(({ title, metric }) => (
                      <tr key={`income-yoy-${title.id}`}>
                        <td className="px-4 py-2 border border-gray-200 text-left">{title.name}</td>
                        <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums ${AUTO_COL_BG}`}>
                          {formatAmount(metric.prev)}
                        </td>
                        <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums ${AUTO_COL_BG}`}>
                          {formatAmount(metric.current)}
                        </td>
                        <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums ${AUTO_COL_BG}`}>
                          {formatAmount(metric.diff)}
                        </td>
                        <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums ${AUTO_COL_BG}`}>
                          {formatRate(metric.prev, metric.current)}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="font-semibold mb-2 text-[#374151]">
              支出科目
            </h3>
            <table className="w-full border-collapse text-sm table-fixed">
              <colgroup>
                <col style={{ width: "20%" }} />
                <col style={{ width: "26.6667%" }} />
                <col style={{ width: "26.6667%" }} />
                <col style={{ width: "13.3333%" }} />
                <col style={{ width: "13.3333%" }} />
              </colgroup>
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-center border border-gray-200">科目</th>
                  {mode === "book" ? (
                    <>
                      <th className="px-4 py-2 text-center border border-gray-200">年度予算額</th>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>年度実績額</th>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>差額</th>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>達成率</th>
                    </>
                  ) : (
                    <>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>前年度実績額</th>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>今年度実績額</th>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>増減額</th>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>増減率</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {mode === "book"
                  ? expenseBudgetRows.map(({ title, metric }) => (
                      <tr key={`expense-book-${activeTab}-${title.id}`}>
                        <td className="px-4 py-2 border border-gray-200 text-left">{title.name}</td>
                        {renderBudgetCell(title)}
                        <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums ${AUTO_COL_BG}`}>
                          {formatAmount(metric.actual)}
                        </td>
                        <td
                          className={`px-4 py-2 border border-gray-200 text-right tabular-nums ${AUTO_COL_BG} ${renderExpenseDiffClass(metric.diff)}`}
                        >
                          {formatAmount(metric.diff)}
                        </td>
                        <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums ${AUTO_COL_BG}`}>
                          {formatRate(metric.budget, metric.actual)}
                        </td>
                      </tr>
                    ))
                  : expenseYoYRows.map(({ title, metric }) => (
                      <tr key={`expense-yoy-${title.id}`}>
                        <td className="px-4 py-2 border border-gray-200 text-left">{title.name}</td>
                        <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums ${AUTO_COL_BG}`}>
                          {formatAmount(metric.prev)}
                        </td>
                        <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums ${AUTO_COL_BG}`}>
                          {formatAmount(metric.current)}
                        </td>
                        <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums ${AUTO_COL_BG}`}>
                          {formatAmount(metric.diff)}
                        </td>
                        <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums ${AUTO_COL_BG}`}>
                          {formatRate(metric.prev, metric.current)}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="font-semibold mb-2 text-[#374151]">
              集計
            </h3>
            <table className="w-full border-collapse text-sm table-fixed">
              <colgroup>
                <col style={{ width: "20%" }} />
                <col style={{ width: "26.6667%" }} />
                <col style={{ width: "26.6667%" }} />
                <col style={{ width: "13.3333%" }} />
                <col style={{ width: "13.3333%" }} />
              </colgroup>
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-center border border-gray-200">区分</th>
                  {mode === "book" ? (
                    <>
                      <th className="px-4 py-2 text-center border border-gray-200">予算</th>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>実績</th>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>差額</th>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>達成率</th>
                    </>
                  ) : (
                    <>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>前年度実績</th>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>今年度実績</th>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>増減額</th>
                      <th className={`px-4 py-2 text-center border border-gray-200 ${AUTO_COL_BG}`}>増減率</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {mode === "book" ? (
                  <>
                    <tr className="bg-[#EEF7FF]">
                      <td className="px-4 py-2 border border-gray-200 font-semibold text-left">収入合計</td>
                      <td className="px-4 py-2 border border-gray-200 text-right tabular-nums font-semibold">
                        {formatAmount(incomeBudgetTotals.budget)}
                      </td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-semibold ${AUTO_COL_BG}`}>
                        {formatAmount(incomeBudgetTotals.actual)}
                      </td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-semibold ${AUTO_COL_BG}`}>
                        {formatAmount(incomeBudgetTotals.diff)}
                      </td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-semibold ${AUTO_COL_BG}`}>
                        {formatRate(incomeBudgetTotals.budget, incomeBudgetTotals.actual)}
                      </td>
                    </tr>
                    <tr className="bg-[#EEF7FF]">
                      <td className="px-4 py-2 border border-gray-200 font-semibold text-left">支出合計</td>
                      <td className="px-4 py-2 border border-gray-200 text-right tabular-nums font-semibold">
                        {formatAmount(expenseBudgetTotals.budget)}
                      </td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-semibold ${AUTO_COL_BG}`}>
                        {formatAmount(expenseBudgetTotals.actual)}
                      </td>
                      <td
                        className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-semibold ${AUTO_COL_BG} ${renderExpenseDiffClass(expenseBudgetTotals.diff)}`}
                      >
                        {formatAmount(expenseBudgetTotals.diff)}
                      </td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-semibold ${AUTO_COL_BG}`}>
                        {formatRate(expenseBudgetTotals.budget, expenseBudgetTotals.actual)}
                      </td>
                    </tr>
                    <tr className="bg-[#E8F5E9]">
                      <td className="px-4 py-2 border border-gray-200 font-bold text-left">収支合計</td>
                      <td className="px-4 py-2 border border-gray-200 text-right tabular-nums font-bold">
                        {formatAmount(balanceBudgetTotals.budget)}
                      </td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-bold ${AUTO_COL_BG}`}>
                        {formatAmount(balanceBudgetTotals.actual)}
                      </td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-bold ${AUTO_COL_BG}`}>
                        {formatAmount(balanceBudgetTotals.diff)}
                      </td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-bold ${AUTO_COL_BG}`}>
                        {formatRate(balanceBudgetTotals.budget, balanceBudgetTotals.actual)}
                      </td>
                    </tr>
                  </>
                ) : (
                  <>
                    <tr className="bg-[#EEF7FF]">
                      <td className="px-4 py-2 border border-gray-200 font-semibold text-left">収入合計</td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-semibold ${AUTO_COL_BG}`}>
                        {formatAmount(incomeYoYTotals.prev)}
                      </td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-semibold ${AUTO_COL_BG}`}>
                        {formatAmount(incomeYoYTotals.current)}
                      </td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-semibold ${AUTO_COL_BG}`}>
                        {formatAmount(incomeYoYTotals.diff)}
                      </td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-semibold ${AUTO_COL_BG}`}>
                        {formatRate(incomeYoYTotals.prev, incomeYoYTotals.current)}
                      </td>
                    </tr>
                    <tr className="bg-[#EEF7FF]">
                      <td className="px-4 py-2 border border-gray-200 font-semibold text-left">支出合計</td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-semibold ${AUTO_COL_BG}`}>
                        {formatAmount(expenseYoYTotals.prev)}
                      </td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-semibold ${AUTO_COL_BG}`}>
                        {formatAmount(expenseYoYTotals.current)}
                      </td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-semibold ${AUTO_COL_BG}`}>
                        {formatAmount(expenseYoYTotals.diff)}
                      </td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-semibold ${AUTO_COL_BG}`}>
                        {formatRate(expenseYoYTotals.prev, expenseYoYTotals.current)}
                      </td>
                    </tr>
                    <tr className="bg-[#E8F5E9]">
                      <td className="px-4 py-2 border border-gray-200 font-bold text-left">収支合計</td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-bold ${AUTO_COL_BG}`}>
                        {formatAmount(balanceYoYTotals.prev)}
                      </td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-bold ${AUTO_COL_BG}`}>
                        {formatAmount(balanceYoYTotals.current)}
                      </td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-bold ${AUTO_COL_BG}`}>
                        {formatAmount(balanceYoYTotals.diff)}
                      </td>
                      <td className={`px-4 py-2 border border-gray-200 text-right tabular-nums font-bold ${AUTO_COL_BG}`}>
                        {formatRate(balanceYoYTotals.prev, balanceYoYTotals.current)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  )
}


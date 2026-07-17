"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  getCategories,
  getAccountTitles,
  getTransactions,
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
import {
  FISCAL_OPENING_MONTH,
  getSubjectOpeningForSummary,
} from "@/lib/accountTitleBalances"

const THEME_COLOR = "#68A384" // 集計・帳簿（青緑）

// 会計年度の月順（4月〜翌3月）
const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const

// カラム幅比率（合計20）: 科目5, 金額5, メモ10
const COL_RATIOS = [5, 5, 10] as const
const COL_WIDTHS = COL_RATIOS.map((r) => `${(r / 20) * 100}%`)

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
}: {
  subjectId?: string
  year: number
  month: number
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
    if (!subjectId) return
    saveMonthlyNote(subjectId, year, month, memo)
  }, [subjectId, year, month, memo])

  return (
    <input
      type="text"
      value={memo}
      onChange={(e) => setMemo(e.target.value)}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      disabled={!subjectId}
      lang="ja"
      autoComplete="off"
      className={`w-full px-2 py-1.5 text-sm text-center text-[#374151] bg-transparent border rounded focus:outline-none focus:ring-1 focus:ring-[#68A384] ${
        !subjectId ? "border-transparent text-[#9CA3AF] cursor-not-allowed" : isFocused ? "border-[#68A384]" : "border-transparent hover:border-gray-300"
      }`}
    />
  )
}

export default function SummaryMonthlyPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [collectionSchedules, setCollectionSchedules] = useState<CollectionSchedule[]>([])
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | "all">("all")
  const fiscalYear = getCurrentFiscalYear()
  const [selectedMonth, setSelectedMonth] = useState<number>(getCurrentMonth())
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

  // 選択月の範囲
  const { start: monthStart, end: monthEnd } = useMemo(
    () => getFiscalMonthRange(fiscalYear, selectedMonth),
    [fiscalYear, selectedMonth]
  )

  // 表示用の年を取得
  const displayYear = useMemo(() => {
    return selectedMonth >= 4 ? fiscalYear : fiscalYear + 1
  }, [fiscalYear, selectedMonth])

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

  // 選択月の取引を抽出
  const filteredTransactions = useMemo(() => {
    const txs = transactions.filter((t) => {
      if (!t.date) return false
      if (!isDateInRange(t.date, monthStart, monthEnd)) return false
      if (selectedCategoryName !== null && t.category !== selectedCategoryName) return false
      return true
    })
    return txs
  }, [transactions, monthStart, monthEnd, selectedCategoryName])

  const filteredCollectionIncomeEntries = useMemo(() => {
    return collectionIncomeEntries.filter((t) => {
      if (!t.date) return false
      if (!isDateInRange(t.date, monthStart, monthEnd)) return false
      if (selectedCategoryName !== null && t.category !== selectedCategoryName) return false
      return true
    })
  }, [collectionIncomeEntries, monthStart, monthEnd, selectedCategoryName])

  // 科目別に集計（収入）- 0円の科目も表示。期首月は科目別台帳と同じ初期残高を加算
  const incomeRows = useMemo((): SummaryRow[] => {
    const categoryTab = selectedCategoryId === "all" ? "all" : selectedCategoryId
    const includeOpening = selectedMonth === FISCAL_OPENING_MONTH
    return incomeTitles.map((title) => {
      const txs = filteredTransactions.filter(
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
    filteredTransactions,
    filteredCollectionIncomeEntries,
    selectedMonth,
    selectedCategoryId,
    accountTitles,
  ])

  // 科目別に集計（支出）- 0円の科目も表示
  const expenseRows = useMemo((): SummaryRow[] => {
    const categoryTab = selectedCategoryId === "all" ? "all" : selectedCategoryId
    const includeOpening = selectedMonth === FISCAL_OPENING_MONTH
    return expenseTitles.map((title) => {
      const txs = filteredTransactions.filter(
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
    filteredTransactions,
    selectedMonth,
    selectedCategoryId,
    accountTitles,
  ])

  // 合計
  const totalIncome = useMemo(
    () => incomeRows.reduce((s, r) => s + r.amount, 0),
    [incomeRows]
  )
  const totalExpense = useMemo(
    () => expenseRows.reduce((s, r) => s + r.amount, 0),
    [expenseRows]
  )
  const balance = totalIncome - totalExpense

  // 数値のみ表示（カンマ区切り）
  const formatAmount = (n: number) => n.toLocaleString()

  /** 科目別台帳へ遷移（該当月フィルター済み） */
  const handleSubjectClick = (subjectId?: string) => {
    if (!subjectId) return
    const params = new URLSearchParams()
    params.set("category", selectedCategoryId)
    params.set("subject", subjectId)
    params.set("start", format(monthStart, "yyyy-MM-dd"))
    params.set("end", format(monthEnd, "yyyy-MM-dd"))
    router.push(`/club/accounting/ledger/subject?${params.toString()}`)
  }

  // メモ欄の再マウント用キー（月切り替え時に瞬時にリロード）
  const memoKey = `${displayYear}-${selectedMonth}`

  return (
    <div className="px-6 py-8 min-h-screen bg-[#F5F5F0] w-full">
      {/* ヘッダー（テーマカラー） */}
      <div
        className="rounded-t-lg border border-b-0 border-gray-200 px-6 py-4"
        style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR, backgroundColor: "white" }}
      >
        <h2 className="text-xl font-semibold" style={{ color: THEME_COLOR }}>
          収支集計表（月次）
        </h2>
        <p className="text-sm text-[#6B7280] mt-1">月ごとの科目別収支集計</p>
      </div>

      {/* 月度タブナビゲーション + 単位表示 */}
      <div
        className="bg-white border-x border-t border-gray-200 px-6 py-4"
        style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-[#6B7280]">月度選択:</span>
          <span className="text-xs text-[#9CA3AF]">（単位：円）</span>
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
        </div>
      </div>

      {/* カテゴリー選択 */}
      <div
        className="bg-white border-x border-t border-gray-200 px-6 py-3 flex flex-wrap items-center gap-2"
        style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR }}
      >
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

      {/* テーブル */}
      <div className="bg-white border border-gray-200 rounded-b-lg overflow-hidden">
        <div
          className="px-6 py-3 text-base font-semibold text-white text-center border-b border-gray-200"
          style={{ backgroundColor: THEME_COLOR }}
        >
          {displayYear}年{selectedMonth}月の収支集計
        </div>

        <div className="p-4">
          <table className="w-full border-collapse text-sm table-fixed">
            <colgroup>
              {COL_WIDTHS.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
            <tbody>
              {/* ===== 収入セクション ===== */}
              {/* 見出し行 */}
              <tr className="bg-blue-50 border-b border-gray-200">
                <td colSpan={3} className="px-4 py-2 text-left font-semibold text-[#374151] border border-gray-200">
                  【収入】
                </td>
              </tr>
              {/* 小見出し行（ラベル行） */}
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
              {/* データ行 */}
              {incomeTitles.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-[#6B7280] border border-gray-200">
                    収入科目が登録されていません
                  </td>
                </tr>
              ) : (
                incomeRows.map((row, idx) => (
                  <tr
                    key={row.subjectName}
                    className={`hover:bg-gray-100/50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"}`}
                  >
                    <td
                      className="px-4 py-2.5 text-left text-[#374151] border border-gray-200 font-medium cursor-pointer hover:underline hover:text-[#68A384]"
                      onClick={() => handleSubjectClick(row.subjectId)}
                    >
                      {row.subjectName}
                    </td>
                    <td
                      className="px-3 py-2.5 text-right tabular-nums text-[#374151] border border-gray-200 cursor-pointer hover:underline hover:text-[#68A384]"
                      onClick={() => handleSubjectClick(row.subjectId)}
                    >
                      {formatAmount(row.amount)}
                    </td>
                    <td className="px-2 py-1 text-center border border-gray-200">
                      <MemoCell
                        key={`${memoKey}-${row.subjectName}`}
                        subjectId={row.subjectId}
                        year={displayYear}
                        month={selectedMonth}
                      />
                    </td>
                  </tr>
                ))
              )}
              {/* 収入合計行 */}
              <tr className="bg-green-200/80">
                <td className="px-4 py-2.5 text-left font-semibold text-[#374151] border border-gray-200">
                  収入合計
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-[#374151] tabular-nums border border-gray-200">
                  {formatAmount(totalIncome)}
                </td>
                <td className="px-3 py-2.5 border border-gray-200 bg-green-200/80"></td>
              </tr>

              {/* ===== 支出セクション ===== */}
              {/* 見出し行 */}
              <tr className="bg-red-50 border-b border-gray-200">
                <td colSpan={3} className="px-4 py-2 text-left font-semibold text-[#374151] border border-gray-200">
                  【支出】
                </td>
              </tr>
              {/* 小見出し行（ラベル行） */}
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
              {/* データ行 */}
              {expenseTitles.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-[#6B7280] border border-gray-200">
                    支出科目が登録されていません
                  </td>
                </tr>
              ) : (
                expenseRows.map((row, idx) => (
                  <tr
                    key={row.subjectName}
                    className={`hover:bg-gray-100/50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"}`}
                  >
                    <td
                      className="px-4 py-2.5 text-left text-[#374151] border border-gray-200 font-medium cursor-pointer hover:underline hover:text-[#68A384]"
                      onClick={() => handleSubjectClick(row.subjectId)}
                    >
                      {row.subjectName}
                    </td>
                    <td
                      className="px-3 py-2.5 text-right tabular-nums text-[#374151] border border-gray-200 cursor-pointer hover:underline hover:text-[#68A384]"
                      onClick={() => handleSubjectClick(row.subjectId)}
                    >
                      {formatAmount(row.amount)}
                    </td>
                    <td className="px-2 py-1 text-center border border-gray-200">
                      <MemoCell
                        key={`${memoKey}-${row.subjectName}`}
                        subjectId={row.subjectId}
                        year={displayYear}
                        month={selectedMonth}
                      />
                    </td>
                  </tr>
                ))
              )}
              {/* 支出合計行 */}
              <tr className="bg-amber-200/80">
                <td className="px-4 py-2.5 text-left font-semibold text-[#374151] border border-gray-200">
                  支出合計
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-[#374151] tabular-nums border border-gray-200">
                  {formatAmount(totalExpense)}
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
                  {formatAmount(balance)}
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
    </div>
  )
}

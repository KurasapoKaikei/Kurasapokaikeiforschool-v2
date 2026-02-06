"use client"

import { useState, useMemo, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { DatePickerField } from "@/components/ui/date-picker-field"
import { EditTransactionModal } from "@/components/accounting/EditTransactionModal"
import { Pencil, Trash2 } from "lucide-react"
import {
  getCategories,
  getAccountTitles,
  getTransactions,
  deleteTransaction,
  type Category,
  type AccountTitle,
  type Transaction,
} from "@/utils/localStorage"

const THEME_COLOR = "#68A384" // 集計・帳簿（青緑）
const RECEIPT_ALERT_BG = "#FEE2E2" // 証憑未登録時のアラート色（bg-red-100相当）

// カラム幅比率（合計29）: 日付4, 現金/預金5, 収入3, 支出3, メモ10, 証憑2, 編集1, 削除1
const COL_RATIOS = [4, 5, 3, 3, 10, 2, 1, 1] as const
const COL_WIDTHS = COL_RATIOS.map((r) => `${(r / 29) * 100}%`)

/** 今期の期首（4月1日）を YYYY-MM-DD で返す */
function getFiscalYearStart(): string {
  const d = new Date()
  const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
  return `${year}-04-01`
}

/** 本日を YYYY-MM-DD で返す */
function getTodayString(): string {
  return new Date().toISOString().slice(0, 10)
}

type RowKind = "data" | "subtotal"

interface TableRow {
  kind: RowKind
  key: string
  date?: string
  monthLabel?: string
  counterparty?: string
  memo?: string
  incomeAmount?: number
  expenseAmount?: number
  isSubtotal?: boolean
  transactionId?: string
  receiptUrl?: string | null
  transaction?: Transaction
}

export default function LedgerSubjectPage() {
  const searchParams = useSearchParams()
  const [categories, setCategories] = useState<Category[]>([])
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categoryId, setCategoryId] = useState<string>("all")
  const [subjectId, setSubjectId] = useState<string>("")
  const [startDate, setStartDate] = useState<string>(getFiscalYearStart())
  const [endDate, setEndDate] = useState<string>(getTodayString())
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null)

  const refreshTransactions = () => setTransactions(getTransactions())

  const handleDelete = (id: string) => {
    if (!confirm("この取引を削除しますか？")) return
    if (deleteTransaction(id)) {
      refreshTransactions()
    }
  }

  const handleEdit = (t: Transaction) => setEditTransaction(t)

  // URLパラメータから初期値を反映（収支集計表からのドリルダウン用）
  useEffect(() => {
    const cat = searchParams.get("category")
    const subj = searchParams.get("subject")
    const start = searchParams.get("start")
    const end = searchParams.get("end")
    if (cat) setCategoryId(cat)
    if (subj) setSubjectId(subj)
    if (start) setStartDate(start)
    if (end) setEndDate(end)
  }, [searchParams])

  useEffect(() => {
    setCategories(getCategories())
    setAccountTitles(getAccountTitles())
    setTransactions(getTransactions())
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setCategories(getCategories())
      setAccountTitles(getAccountTitles())
      setTransactions(getTransactions())
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  )

  const sortedAccountTitles = useMemo(
    () => [...accountTitles].sort((a, b) => a.order - b.order),
    [accountTitles]
  )

  // 科目選択肢：カテゴリー連動。現金・預金は除外。選択カテゴリーに紐づく収入・支出のみ
  const filteredSubjectsForSelect = useMemo(() => {
    const incomeExpense = accountTitles.filter((t) => t.group === "income" || t.group === "expense")
    if (categoryId === "all") {
      return incomeExpense.sort((a, b) => a.order - b.order)
    }
    return incomeExpense
      .filter((t) => t.categoryIds.includes(categoryId))
      .sort((a, b) => a.order - b.order)
  }, [accountTitles, categoryId])

  const selectedSubject = useMemo(
    () => accountTitles.find((t) => t.id === subjectId),
    [accountTitles, subjectId]
  )

  // カテゴリー変更時に、選択科目が新しいリストに含まれなければリセット
  useEffect(() => {
    if (subjectId && !filteredSubjectsForSelect.some((t) => t.id === subjectId)) {
      setSubjectId("")
    }
  }, [categoryId, filteredSubjectsForSelect, subjectId])

  const selectedCategory = useMemo(
    () => (categoryId === "all" ? null : categories.find((c) => c.id === categoryId)),
    [categories, categoryId]
  )

  const filteredTransactions = useMemo(() => {
    if (!selectedSubject) return []
    const subjectName = selectedSubject.name
    const list = transactions.filter((t) => {
      if (!t.date) return false
      if (t.date < startDate || t.date > endDate) return false
      if (t.accountTitle !== subjectName) return false
      if (categoryId !== "all") {
        const cat = categories.find((c) => c.id === categoryId)
        if (cat && t.category !== cat.name) return false
      }
      return true
    })
    return list.sort((a, b) => a.date.localeCompare(b.date))
  }, [transactions, startDate, endDate, selectedSubject, categoryId, categories])

  const tableRows = useMemo((): TableRow[] => {
    const rows: TableRow[] = []
    if (filteredTransactions.length === 0) return rows

    const byMonth = new Map<string, Transaction[]>()
    for (const t of filteredTransactions) {
      const monthKey = t.date.slice(0, 7)
      if (!byMonth.has(monthKey)) byMonth.set(monthKey, [])
      byMonth.get(monthKey)!.push(t)
    }

    const sortedMonths = [...byMonth.keys()].sort()
    for (const monthKey of sortedMonths) {
      const monthTx = byMonth.get(monthKey)!.sort((a, b) => a.date.localeCompare(b.date))
      let monthIncome = 0
      let monthExpense = 0
      monthTx.forEach((t, i) => {
        const isIncome = t.type === "income" || t.type === "collection"
        const isExpense = t.type === "expense" || t.type === "transfer" || t.type === "deferred"
        if (isIncome) monthIncome += t.amount
        if (isExpense) monthExpense += t.amount
        rows.push({
          kind: "data",
          key: `data-${monthKey}-${i}-${t.id}`,
          date: t.date,
          counterparty: t.counterparty,
          memo: t.memo,
          incomeAmount: isIncome ? t.amount : undefined,
          expenseAmount: isExpense ? t.amount : undefined,
          transactionId: t.id,
          receiptUrl: t.receiptUrl,
          transaction: t,
        })
      })
      const [, m] = monthKey.split("-").map(Number)
      rows.push({
        kind: "subtotal",
        key: `sub-${monthKey}`,
        monthLabel: `${m}月合計`,
        incomeAmount: monthIncome,
        expenseAmount: monthExpense,
        isSubtotal: true,
      })
    }
    return rows
  }, [filteredTransactions])

  const dynamicTitle = useMemo(() => {
    const subjectName = selectedSubject?.name ?? "科目未選択"
    const categoryLabel = categoryId === "all" ? "すべて" : selectedCategory?.name ?? "すべて"
    return `${subjectName}（${categoryLabel}）`
  }, [selectedSubject, categoryId, selectedCategory])

  /** 日付表示用: YYYY-MM-DD → YYYY/MM/DD */
  const formatDateDisplay = (dateStr: string) => dateStr.replace(/-/g, "/")

  return (
    <div className="px-6 py-8 bg-[#F5F5F0] min-h-screen w-full">
      <div className="w-full">
        {/* ヘッダー（収支集計表と同デザイン：左ボーダー・角丸） */}
        <div
          className="rounded-t-lg border border-b-0 border-gray-200 px-6 py-4"
          style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR, backgroundColor: "white" }}
        >
          <h2 className="text-xl font-semibold" style={{ color: THEME_COLOR }}>
            科目別台帳
          </h2>
          <p className="text-sm text-[#6B7280] mt-1">勘定科目別の取引台帳</p>
        </div>

        {/* 検索・絞り込み */}
        <div
          className="bg-white border-x border-t border-gray-200 px-6 py-4 flex flex-wrap items-end justify-between gap-4"
          style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR }}
        >
          <div className="flex flex-wrap items-end gap-4">
            <span className="text-xs text-[#6B7280]">検索条件:</span>
            <div>
              <label htmlFor="filter-category" className="block text-xs font-medium text-[#6B7280] mb-1">
                カテゴリー
              </label>
              <select
                id="filter-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#68A384] min-w-[140px]"
              >
                <option value="all">すべて</option>
                {sortedCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-subject" className="block text-xs font-medium text-[#6B7280] mb-1">
                科目
              </label>
              <select
                id="filter-subject"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#68A384] min-w-[160px]"
              >
                <option value="">選択してください</option>
                {filteredSubjectsForSelect.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}（{t.group === "income" ? "収入" : "支出"}）
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-start" className="block text-xs font-medium text-[#6B7280] mb-1">
                開始日
              </label>
              <DatePickerField
                id="filter-start"
                value={startDate}
                onChange={setStartDate}
                themeColor={THEME_COLOR}
                className="px-3 py-2 text-sm"
                aria-label="開始日"
              />
            </div>
            <div>
              <label htmlFor="filter-end" className="block text-xs font-medium text-[#6B7280] mb-1">
                終了日
              </label>
              <DatePickerField
                id="filter-end"
                value={endDate}
                onChange={setEndDate}
                themeColor={THEME_COLOR}
                className="px-3 py-2 text-sm"
                aria-label="終了日"
              />
            </div>
          </div>
          <span className="text-xs text-[#9CA3AF]">（単位：円）</span>
        </div>

        {/* 動的タイトル + テーブル（収支集計表と同デザイン：縦線・ゼブラ・月次合計行） */}
        <div className="bg-white border border-gray-200 rounded-b-lg overflow-hidden">
          <div
            className="px-6 py-3 text-base font-semibold text-white border-b border-gray-200"
            style={{ backgroundColor: THEME_COLOR }}
          >
            {dynamicTitle}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-sm table-fixed">
              <colgroup>
                {COL_WIDTHS.map((w, i) => (
                  <col key={i} style={{ width: w }} />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-2 py-2.5 text-center font-semibold text-[#374151] border-b border-r border-gray-200 text-xs whitespace-nowrap">
                    日付
                  </th>
                  <th className="px-2 py-2.5 text-center font-semibold text-[#374151] border-b border-r border-gray-200 text-xs whitespace-nowrap">
                    現金/預金
                  </th>
                  <th className="px-2 py-2.5 text-center font-semibold text-[#374151] border-b border-r border-gray-200 text-xs whitespace-nowrap">
                    収入金額
                  </th>
                  <th className="px-2 py-2.5 text-center font-semibold text-[#374151] border-b border-r border-gray-200 text-xs whitespace-nowrap">
                    支出金額
                  </th>
                  <th className="px-2 py-2.5 text-center font-semibold text-[#374151] border-b border-r border-gray-200 text-xs whitespace-nowrap">
                    メモ
                  </th>
                  <th className="px-2 py-2.5 text-center font-semibold text-[#374151] border-b border-r border-gray-200 text-xs whitespace-nowrap">
                    レシート・証憑
                  </th>
                  <th className="px-2 py-2.5 text-center font-semibold text-[#374151] border-b border-r border-gray-200 text-xs whitespace-nowrap">
                    編集
                  </th>
                  <th className="px-2 py-2.5 text-center font-semibold text-[#374151] border-b border-gray-200 text-xs whitespace-nowrap">
                    削除
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="border-b border-gray-200 px-4 py-16 text-center"
                    >
                      {!subjectId ? (
                        <p
                          className="text-base font-medium"
                          style={{ color: THEME_COLOR }}
                        >
                          カテゴリー・科目を選択すると台帳が表示されます
                        </p>
                      ) : (
                        <p className="text-[#6B7280]">
                          条件に一致する取引はありません
                        </p>
                      )}
                    </td>
                  </tr>
                ) : (
                  tableRows.map((row, index) => (
                    <tr
                      key={row.key}
                      className={`border-b border-gray-200 hover:bg-gray-100/50 ${
                        row.isSubtotal
                          ? "bg-[#68A384]/15 font-semibold"
                          : index % 2 === 0
                            ? "bg-white"
                            : "bg-gray-50/70"
                      }`}
                    >
                      {/* 日付 */}
                      <td className={`px-2 py-2 text-[#374151] border-r border-gray-200 text-xs whitespace-nowrap overflow-hidden ${row.isSubtotal ? "font-medium" : ""} ${index % 2 === 0 && !row.isSubtotal ? "bg-white" : row.isSubtotal ? "" : "bg-gray-50/70"}`}>
                        {row.kind === "data" && row.date ? formatDateDisplay(row.date) : row.monthLabel}
                      </td>
                      {/* 現金/預金 */}
                      <td className={`px-2 py-2 text-[#374151] border-r border-gray-200 text-xs whitespace-nowrap overflow-hidden ${index % 2 === 0 && !row.isSubtotal ? "bg-white" : row.isSubtotal ? "" : "bg-gray-50/70"}`}>
                        {row.kind === "data" ? row.counterparty ?? "-" : ""}
                      </td>
                      {/* 収入金額 */}
                      <td className={`px-2 py-2 text-right tabular-nums text-[#374151] border-r border-gray-200 text-xs whitespace-nowrap overflow-hidden ${index % 2 === 0 && !row.isSubtotal ? "bg-white" : row.isSubtotal ? "" : "bg-gray-50/70"}`}>
                        {row.incomeAmount != null && row.incomeAmount > 0
                          ? row.incomeAmount.toLocaleString()
                          : "-"}
                      </td>
                      {/* 支出金額 */}
                      <td className={`px-2 py-2 text-right tabular-nums text-[#374151] border-r border-gray-200 text-xs whitespace-nowrap overflow-hidden ${index % 2 === 0 && !row.isSubtotal ? "bg-white" : row.isSubtotal ? "" : "bg-gray-50/70"}`}>
                        {row.expenseAmount != null && row.expenseAmount > 0
                          ? row.expenseAmount.toLocaleString()
                          : "-"}
                      </td>
                      {/* メモ */}
                      <td className={`px-2 py-2 text-left text-[#374151] border-r border-gray-200 text-xs overflow-hidden ${index % 2 === 0 && !row.isSubtotal ? "bg-white" : row.isSubtotal ? "" : "bg-gray-50/70"}`} title={row.kind === "data" ? row.memo ?? undefined : undefined}>
                        <span className="block truncate max-w-full">
                          {row.kind === "data" ? row.memo ?? "-" : ""}
                        </span>
                      </td>
                      {/* レシート・証憑 */}
                      <td
                        className={`px-2 py-2 text-center border-r border-gray-200 text-xs ${
                          row.isSubtotal
                            ? ""
                            : row.receiptUrl
                              ? index % 2 === 0
                                ? "bg-white"
                                : "bg-gray-50/70"
                              : ""
                        }`}
                        style={
                          !row.isSubtotal && !row.receiptUrl
                            ? { backgroundColor: RECEIPT_ALERT_BG }
                            : undefined
                        }
                      >
                        {row.isSubtotal ? (
                          ""
                        ) : row.receiptUrl ? (
                          <a
                            href={row.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block"
                            title="証憑を表示"
                          >
                            <img
                              src={row.receiptUrl}
                              alt="証憑"
                              className="w-8 h-8 object-cover rounded border border-gray-200 hover:opacity-80"
                            />
                          </a>
                        ) : (
                          <span className="text-red-600 text-xs">未登録</span>
                        )}
                      </td>
                      {/* 編集 */}
                      <td
                        className={`px-2 py-2 text-center border-r border-gray-200 text-xs whitespace-nowrap ${
                          row.isSubtotal ? "" : index % 2 === 0 ? "bg-white" : "bg-gray-50/70"
                        }`}
                      >
                        {row.isSubtotal ? (
                          ""
                        ) : row.transaction ? (
                          <button
                            type="button"
                            onClick={() => handleEdit(row.transaction!)}
                            className="p-1.5 rounded hover:bg-[#68A384]/20 text-[#68A384]"
                            title="編集"
                            aria-label="編集"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : (
                          ""
                        )}
                      </td>
                      {/* 削除 */}
                      <td
                        className={`px-2 py-2 text-center border-gray-200 text-xs whitespace-nowrap ${
                          row.isSubtotal ? "" : index % 2 === 0 ? "bg-white" : "bg-gray-50/70"
                        }`}
                      >
                        {row.isSubtotal ? (
                          ""
                        ) : row.transaction ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(row.transactionId!)}
                            className="p-1.5 rounded hover:bg-red-100 text-red-600"
                            title="削除"
                            aria-label="削除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          ""
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <EditTransactionModal
        transaction={editTransaction}
        isOpen={!!editTransaction}
        onClose={() => setEditTransaction(null)}
        onSuccess={refreshTransactions}
      />
    </div>
  )
}

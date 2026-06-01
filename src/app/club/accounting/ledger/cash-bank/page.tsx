"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { DatePickerField } from "@/components/ui/date-picker-field"
import { Pencil, Trash2 } from "lucide-react"
import {
  getCategories,
  getAccountTitles,
  getTransactions,
  getCollectionSchedules,
  deleteTransaction,
  isTransferLeg,
  type Category,
  type AccountTitle,
  type Transaction,
  type CollectionSchedule,
} from "@/utils/localStorage"
import { getEditUrl, isCsvLinkedTransaction, withReturnTo } from "@/utils/transactionEditPath"
import { SettlementLockAlert } from "@/components/club/SettlementLockAlert"
import { useClubSettlementLock } from "@/hooks/useClubSettlementLock"

const THEME_COLOR = "#68A384" // 集計・帳簿（青緑）
const RECEIPT_ALERT_BG = "#FEE2E2" // 証憑未登録時のアラート色（bg-red-100相当）

// カラム幅比率（合計32）: 日付3, カテゴリー3, 科目3, 入金3, 出金3, 残高3, メモ6, 証憑3, 編集2, 削除2 (※最後に行追加)
const COL_RATIOS = [3, 3, 3, 3, 3, 3, 6, 3, 2, 2] as const
const TOTAL_RATIO = COL_RATIOS.reduce((a, b) => a + b, 0)
const COL_WIDTHS = COL_RATIOS.map((r) => `${(r / TOTAL_RATIO) * 100}%`)

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

/** 現金・預金出納帳に載せるか（counterparty 一致、または集金設定の入金先口座と一致） */
function transactionMatchesCashAccount(
  t: Transaction,
  cashName: string,
  scheduleById: Map<string, CollectionSchedule>
): boolean {
  if (t.counterparty === cashName) return true
  if (t.type !== "collection" || !t.collectionScheduleId) return false
  const schedule = scheduleById.get(t.collectionScheduleId)
  const scheduleCash = (schedule?.counterpartyName ?? "").trim()
  return scheduleCash === cashName
}

type RowKind = "opening" | "data" | "subtotal"

interface TableRow {
  kind: RowKind
  key: string
  date?: string
  monthLabel?: string
  category?: string
  accountTitle?: string
  memo?: string
  incomeAmount?: number
  expenseAmount?: number
  balance?: number
  isSubtotal?: boolean
  isOpening?: boolean
  transactionId?: string
  receiptUrl?: string | null
  transaction?: Transaction
}

export default function LedgerCashBankPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchQs = searchParams.toString()
  const editReturnTo = useMemo(
    () => pathname + (searchQs ? `?${searchQs}` : ""),
    [pathname, searchQs]
  )
  const [categories, setCategories] = useState<Category[]>([])
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [collectionSchedules, setCollectionSchedules] = useState<CollectionSchedule[]>([])
  const [cashAccountId, setCashAccountId] = useState<string>("")
  const [startDate, setStartDate] = useState<string>(getFiscalYearStart())
  const [endDate, setEndDate] = useState<string>(getTodayString())
  const [isInitialized, setIsInitialized] = useState(false)
  const isLocked = useClubSettlementLock()

  const refreshTransactions = () => setTransactions(getTransactions())

  const handleDelete = (id: string) => {
    if (isLocked) return
    if (!confirm("この取引を削除しますか？")) return
    if (deleteTransaction(id)) {
      refreshTransactions()
    }
  }

  /**
   * 振替片側レコードから対の expense/income を解決する。
   * - `transferGroupId` がある新データは同IDで対を引く
   * - 旧データは memo プレフィックス + 同日付 + 同金額のヒューリスティックで対を推定
   */
  const resolveTransferPair = (t: Transaction): { expenseId: string; incomeId: string } | null => {
    if (t.transferGroupId) {
      const pair = transactions.filter((x) => x.transferGroupId === t.transferGroupId)
      const exp = pair.find((x) => x.type === "expense")
      const inc = pair.find((x) => x.type === "income")
      if (exp && inc) return { expenseId: exp.id, incomeId: inc.id }
    }
    if (t.type === "expense" && /^振替（出金）/.test(t.memo ?? "")) {
      const inc = transactions.find(
        (x) =>
          x.type === "income" &&
          /^振替（入金）/.test(x.memo ?? "") &&
          x.date === t.date &&
          x.amount === t.amount
      )
      if (inc) return { expenseId: t.id, incomeId: inc.id }
    }
    if (t.type === "income" && /^振替（入金）/.test(t.memo ?? "")) {
      const exp = transactions.find(
        (x) =>
          x.type === "expense" &&
          /^振替（出金）/.test(x.memo ?? "") &&
          x.date === t.date &&
          x.amount === t.amount
      )
      if (exp) return { expenseId: exp.id, incomeId: t.id }
    }
    return null
  }

  const handleEdit = (t: Transaction) => {
    if (isLocked) return
    // 振替の片側レコードは登録履歴と同じく「振替専用編集モード」へ遷移する
    if (isTransferLeg(t)) {
      const pair = resolveTransferPair(t)
      if (pair) {
        const url = withReturnTo(
          `/club/accounting/register/new?tab=transfer&editTransfer=${encodeURIComponent(`${pair.expenseId}:${pair.incomeId}`)}`,
          editReturnTo
        )
        router.push(url)
        return
      }
    }
    router.push(getEditUrl(t, editReturnTo))
  }
  const handleOpenCollection = (t: Transaction) => {
    if (isLocked) return
    if (t.type !== "collection" || !t.collectionMemberId) return
    const month = Number(t.date.slice(5, 7))
    const params = new URLSearchParams()
    params.set("tab", "collection")
    params.set("memberId", t.collectionMemberId)
    if (Number.isFinite(month)) params.set("month", String(month))
    params.set("transactionId", t.id)
    router.push(`/club/accounting/register/new?${params.toString()}`)
  }

  // 初期データ読み込み
  useEffect(() => {
    setCategories(getCategories())
    setAccountTitles(getAccountTitles())
    setTransactions(getTransactions())
    setCollectionSchedules(getCollectionSchedules())
  }, [])

  // URLパラメータから科目IDを取得して自動選択
  useEffect(() => {
    if (isInitialized || accountTitles.length === 0) return
    
    const accountIdFromUrl = searchParams.get("account_id")
    if (accountIdFromUrl) {
      // 指定された科目IDが現金・預金グループに存在するか確認
      const matchingAccount = accountTitles.find(
        (t) => t.id === accountIdFromUrl && t.group === "cash"
      )
      if (matchingAccount) {
        setCashAccountId(accountIdFromUrl)
      }
    }
    setIsInitialized(true)
  }, [searchParams, accountTitles, isInitialized])

  useEffect(() => {
    const interval = setInterval(() => {
      setCategories(getCategories())
      setAccountTitles(getAccountTitles())
      setTransactions(getTransactions())
      setCollectionSchedules(getCollectionSchedules())
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const collectionScheduleById = useMemo(
    () => new Map(collectionSchedules.map((s) => [s.id, s])),
    [collectionSchedules]
  )

  // 現金・預金科目のみを選択肢として表示
  const cashAccountTitles = useMemo(
    () => accountTitles.filter((t) => t.group === "cash").sort((a, b) => a.order - b.order),
    [accountTitles]
  )

  const selectedCashAccount = useMemo(
    () => accountTitles.find((t) => t.id === cashAccountId),
    [accountTitles, cashAccountId]
  )

  // 期首残高
  const openingBalance = useMemo(() => {
    return selectedCashAccount?.balance ?? 0
  }, [selectedCashAccount])

  // 期首日付
  const fiscalYearStartDate = useMemo(() => getFiscalYearStart(), [])

  // 選択した現金・預金科目が counterparty（入金先/出金元）として登録されている取引を抽出
  const filteredTransactions = useMemo(() => {
    if (!selectedCashAccount) return []
    const cashName = selectedCashAccount.name
    const list = transactions.filter((t) => {
      if (!t.date) return false
      if (t.date < startDate || t.date > endDate) return false
      return transactionMatchesCashAccount(t, cashName, collectionScheduleById)
    })
    return list.sort((a, b) => {
      const d = a.date.localeCompare(b.date)
      if (d !== 0) return d
      return (a.createdAt ?? "").localeCompare(b.createdAt ?? "")
    })
  }, [transactions, startDate, endDate, selectedCashAccount, collectionScheduleById])

  // 期首から開始日前日までの取引を計算し、表示開始時点の残高を求める
  const startingBalance = useMemo(() => {
    if (!selectedCashAccount) return openingBalance
    const cashName = selectedCashAccount.name
    
    // 期首から開始日の前日までの取引を集計
    let balance = openingBalance
    const priorTransactions = transactions.filter((t) => {
      if (!t.date) return false
      if (t.date < fiscalYearStartDate || t.date >= startDate) return false
      return transactionMatchesCashAccount(t, cashName, collectionScheduleById)
    })
    
    priorTransactions.forEach((t) => {
      const isIncome = t.type === "income" || t.type === "collection"
      const isExpense = t.type === "expense" || t.type === "transfer" || t.type === "deferred"
      if (isIncome) balance += t.amount
      if (isExpense) balance -= t.amount
    })
    
    return balance
  }, [selectedCashAccount, transactions, openingBalance, startDate, fiscalYearStartDate, collectionScheduleById])

  const tableRows = useMemo((): TableRow[] => {
    const rows: TableRow[] = []
    if (!selectedCashAccount) return rows

    // 1行目: 期首残高（または表示開始時点の残高）
    rows.push({
      kind: "opening",
      key: "opening-balance",
      date: startDate,
      category: "",
      accountTitle: "期首残高",
      incomeAmount: startingBalance > 0 ? startingBalance : undefined,
      expenseAmount: undefined,
      balance: startingBalance,
      isOpening: true,
    })

    if (filteredTransactions.length === 0) return rows

    // 累計残高を計算しながらデータ行を作成
    let runningBalance = startingBalance
    const byMonth = new Map<string, Transaction[]>()
    for (const t of filteredTransactions) {
      const monthKey = t.date.slice(0, 7)
      if (!byMonth.has(monthKey)) byMonth.set(monthKey, [])
      byMonth.get(monthKey)!.push(t)
    }

    const sortedMonths = Array.from(byMonth.keys()).sort()
    for (const monthKey of sortedMonths) {
      const monthTx = byMonth.get(monthKey)!.sort((a, b) => {
        const d = a.date.localeCompare(b.date)
        if (d !== 0) return d
        return (a.createdAt ?? "").localeCompare(b.createdAt ?? "")
      })
      let monthIncome = 0
      let monthExpense = 0
      let monthEndBalance = runningBalance

      monthTx.forEach((t, i) => {
        const isIncome = t.type === "income" || t.type === "collection"
        const isExpense = t.type === "expense" || t.type === "transfer" || t.type === "deferred"
        
        const incomeAmt = isIncome ? t.amount : 0
        const expenseAmt = isExpense ? t.amount : 0
        
        if (isIncome) monthIncome += t.amount
        if (isExpense) monthExpense += t.amount
        
        // 残高計算: 前行の残高 + 入金 - 出金
        runningBalance = runningBalance + incomeAmt - expenseAmt
        monthEndBalance = runningBalance
        
        rows.push({
          kind: "data",
          key: `data-${monthKey}-${i}-${t.id}`,
          date: t.date,
          category: t.category,
          accountTitle: t.accountTitle,
          memo: t.memo,
          incomeAmount: isIncome ? t.amount : undefined,
          expenseAmount: isExpense ? t.amount : undefined,
          balance: runningBalance,
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
        balance: monthEndBalance,
        isSubtotal: true,
      })
    }
    return rows
  }, [selectedCashAccount, filteredTransactions, startingBalance, startDate])

  const dynamicTitle = useMemo(() => {
    const accountName = selectedCashAccount?.name ?? "口座未選択"
    return `現金・預金出納帳（${accountName}）`
  }, [selectedCashAccount])

  /** 日付表示用: YYYY-MM-DD → YYYY/MM/DD */
  const formatDateDisplay = (dateStr: string) => dateStr.replace(/-/g, "/")

  /** 金額表示用（￥なし、カンマ区切り） */
  const formatAmount = (n: number | undefined | null): string => {
    if (n == null || n === 0) return "-"
    return n.toLocaleString()
  }

  /** 残高表示用（0も表示、カンマ区切り） */
  const formatBalance = (n: number | undefined | null): string => {
    if (n == null) return "-"
    return n.toLocaleString()
  }

  return (
    <div className="px-6 py-8 bg-[#F5F5F0] min-h-screen w-full">
      <div className="w-full">
        {/* ヘッダー（収支集計表と同デザイン：左ボーダー・角丸） */}
        <div
          className="rounded-t-lg border border-b-0 border-gray-200 px-6 py-4"
          style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR, backgroundColor: "white" }}
        >
          <h2 className="text-xl font-semibold" style={{ color: THEME_COLOR }}>
            現金・預金出納帳
          </h2>
          <p className="text-sm text-[#6B7280] mt-1">現金・預金科目の入出金一覧</p>
          <SettlementLockAlert isLocked={isLocked} className="mt-3" />
        </div>

        {/* 検索・絞り込み */}
        <div
          className="bg-white border-x border-t border-gray-200 px-6 py-4 flex flex-wrap items-end justify-between gap-4"
          style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR }}
        >
          <div className="flex flex-wrap items-end gap-4">
            <span className="text-xs text-[#6B7280]">検索条件:</span>
            <div>
              <label htmlFor="filter-cash-account" className="block text-xs font-medium text-[#6B7280] mb-1">
                現金・預金口座
              </label>
              <select
                id="filter-cash-account"
                value={cashAccountId}
                onChange={(e) => setCashAccountId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#68A384] min-w-[180px]"
              >
                <option value="">選択してください</option>
                {cashAccountTitles.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
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

        {/* 動的タイトル + テーブル */}
        <div className="bg-white border border-gray-200 rounded-b-lg overflow-hidden">
          <div
            className="px-6 py-3 text-base font-semibold text-white border-b border-gray-200"
            style={{ backgroundColor: THEME_COLOR }}
          >
            {dynamicTitle}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm table-fixed">
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
                    カテゴリー
                  </th>
                  <th className="px-2 py-2.5 text-center font-semibold text-[#374151] border-b border-r border-gray-200 text-xs whitespace-nowrap">
                    科目
                  </th>
                  <th className="px-2 py-2.5 text-center font-semibold text-[#374151] border-b border-r border-gray-200 text-xs whitespace-nowrap">
                    入金額
                  </th>
                  <th className="px-2 py-2.5 text-center font-semibold text-[#374151] border-b border-r border-gray-200 text-xs whitespace-nowrap">
                    出金額
                  </th>
                  <th className="px-2 py-2.5 text-center font-semibold text-[#374151] border-b border-r border-gray-200 text-xs whitespace-nowrap">
                    残高
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
                      colSpan={10}
                      className="border-b border-gray-200 px-4 py-16 text-center"
                    >
                      {!cashAccountId ? (
                        <p
                          className="text-base font-medium"
                          style={{ color: THEME_COLOR }}
                        >
                          現金・預金口座を選択すると出納帳が表示されます
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
                          : row.isOpening
                            ? "bg-blue-50 font-medium"
                            : index % 2 === 0
                              ? "bg-white"
                              : "bg-gray-50/70"
                      }`}
                    >
                      {/* 日付 */}
                      <td className={`px-2 py-2 text-[#374151] border-r border-gray-200 text-xs whitespace-nowrap overflow-hidden ${row.isSubtotal ? "font-medium" : ""}`}>
                        {row.isOpening
                          ? formatDateDisplay(row.date ?? "")
                          : row.kind === "data" && row.date
                            ? formatDateDisplay(row.date)
                            : row.monthLabel}
                      </td>
                      {/* カテゴリー */}
                      <td className={`px-2 py-2 text-[#374151] border-r border-gray-200 text-xs whitespace-nowrap overflow-hidden`}>
                        {row.isOpening ? "" : row.kind === "data" ? row.category ?? "-" : ""}
                      </td>
                      {/* 科目 */}
                      <td className={`px-2 py-2 text-left text-[#374151] border-r border-gray-200 text-xs whitespace-nowrap overflow-hidden ${row.isOpening ? "font-semibold" : ""}`}>
                        {row.isOpening ? "期首残高" : row.kind === "data" ? row.accountTitle ?? "-" : ""}
                      </td>
                      {/* 入金額 */}
                      <td className={`px-2 py-2 text-right tabular-nums text-[#374151] border-r border-gray-200 text-xs whitespace-nowrap overflow-hidden`}>
                        {row.isOpening
                          ? formatBalance(row.incomeAmount)
                          : formatAmount(row.incomeAmount)}
                      </td>
                      {/* 出金額 */}
                      <td className={`px-2 py-2 text-right tabular-nums text-[#374151] border-r border-gray-200 text-xs whitespace-nowrap overflow-hidden`}>
                        {row.isOpening ? "-" : formatAmount(row.expenseAmount)}
                      </td>
                      {/* 残高 */}
                      <td className={`px-2 py-2 text-right tabular-nums text-[#374151] border-r border-gray-200 text-xs whitespace-nowrap overflow-hidden font-medium`}>
                        {formatBalance(row.balance)}
                      </td>
                      {/* メモ */}
                      <td className={`px-2 py-2 text-left text-[#374151] border-r border-gray-200 text-xs overflow-hidden`} title={row.kind === "data" ? row.memo ?? undefined : undefined}>
                        <span className="block truncate max-w-full">
                          {row.isOpening || row.isSubtotal ? "" : row.kind === "data" ? row.memo ?? "-" : ""}
                        </span>
                      </td>
                      {/*
                       * レシート・証憑
                       * - 振替（transferGroupId or 振替memo の片側レコード）は証憑を必須としないので一律「ー」
                       * - 集金（collection）は自動生成のため証憑が存在せず、振替と同じく「ー」
                       * - 通常の収入/支出は画像表示 / 未登録（赤字 + 背景アラート）
                       */}
                      {(() => {
                        const isTransferRow =
                          row.transaction != null && isTransferLeg(row.transaction)
                        const isCollectionRow = row.transaction?.type === "collection"
                        const showAlertBg =
                          !row.isSubtotal &&
                          !row.isOpening &&
                          !row.receiptUrl &&
                          !isCollectionRow &&
                          !isTransferRow
                        return (
                          <td
                            className="px-2 py-2 text-center border-r border-gray-200 text-xs whitespace-nowrap"
                            style={showAlertBg ? { backgroundColor: RECEIPT_ALERT_BG } : undefined}
                          >
                            {row.isSubtotal || row.isOpening ? (
                              ""
                            ) : isTransferRow || isCollectionRow ? (
                              <span className="text-[#9CA3AF] text-xs">ー</span>
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
                        )
                      })()}
                      {/* 編集 */}
                      <td className={`px-2 py-2 text-center border-r border-gray-200 text-xs whitespace-nowrap`}>
                        {row.isSubtotal || row.isOpening ? (
                          ""
                        ) : row.transaction ? (
                          row.transaction.type === "collection" ? (
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() => handleOpenCollection(row.transaction!)}
                              className="p-1.5 rounded hover:bg-[#68A384]/20 text-[#68A384] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                              title="集金タブへ移動"
                              aria-label="集金タブへ移動"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() => handleEdit(row.transaction!)}
                              className="p-1.5 rounded hover:bg-[#68A384]/20 text-[#68A384] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                              title={isCsvLinkedTransaction(row.transaction) ? "CSV一括編集へ" : "明細を編集"}
                              aria-label="編集"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )
                        ) : (
                          ""
                        )}
                      </td>
                      {/* 削除 */}
                      <td className={`px-2 py-2 text-center border-gray-200 text-xs whitespace-nowrap`}>
                        {row.isSubtotal || row.isOpening ? (
                          ""
                        ) : row.transaction ? (
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => handleDelete(row.transactionId!)}
                            className="p-1.5 rounded hover:bg-red-100 text-red-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
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

    </div>
  )
}

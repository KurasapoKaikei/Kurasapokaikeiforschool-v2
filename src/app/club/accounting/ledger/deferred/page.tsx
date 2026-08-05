"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Pencil, Trash2 } from "lucide-react"
import {
  deleteTransaction,
  getTransactions,
  type Transaction,
} from "@/utils/localStorage"
import { getEditUrl } from "@/utils/transactionEditPath"
import { SettlementLockAlert } from "@/components/club/SettlementLockAlert"
import { useClubSettlementLock } from "@/hooks/useClubSettlementLock"
import { formatDateDisplay } from "@/utils/dateDisplay"
import {
  DEFERRED_ACCOUNT_ORDER,
  isDeferredRecord,
  isDeferredSettlement,
  normalizeDeferredAccountName,
  parseDeferredMemo,
} from "@/lib/deferredAccounting"
import { formatAmountDisplay } from "@/utils/formatAmountDisplay"

const THEME_COLOR = "#68A384"

/** 精算日表示: YY/MM/DD精算 */
function formatSettlementDateLabel(dateStr: string): string {
  const parts = (dateStr || "").trim().slice(0, 10).split(/[-/]/)
  if (parts.length !== 3) return `${dateStr}精算`
  const yy = parts[0].slice(-2)
  return `${yy}/${parts[1]}/${parts[2]}精算`
}

const DEFERRED_LEDGER_ACCOUNTS = DEFERRED_ACCOUNT_ORDER
type DeferredLedgerAccount = (typeof DEFERRED_LEDGER_ACCOUNTS)[number] | "all"

type DeferredRow = {
  key: string
  /** 主表示の仕訳（計上。未紐付け精算のみの行では精算仕訳） */
  transaction: Transaction
  settlementTransactions: Transaction[]
  date: string
  settlementDate: string | null
  deferredAccount: string
  category: string
  subject: string
  recordedAmount: number | null
  settledAmount: number | null
  balance: number
  memo: string
}

export default function LedgerDeferredPage() {
  const router = useRouter()
  const pathname = usePathname()
  const editReturnTo = pathname
  const isLocked = useClubSettlementLock()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accountFilter, setAccountFilter] = useState<DeferredLedgerAccount>("all")

  const refresh = useCallback(() => {
    setTransactions(getTransactions())
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 500)
    return () => clearInterval(id)
  }, [refresh])

  const rows = useMemo((): DeferredRow[] => {
    const deferred = transactions.filter((t) => {
      if (t.type !== "deferred") return false
      const name = normalizeDeferredAccountName(t.accountTitle)
      if (!DEFERRED_LEDGER_ACCOUNTS.includes(name as (typeof DEFERRED_LEDGER_ACCOUNTS)[number])) {
        return false
      }
      if (accountFilter === "all") return true
      return name === accountFilter
    })

    const recordIds = new Set(
      deferred.filter(isDeferredRecord).map((t) => t.id)
    )

    const settlementsByRecordId = new Map<string, Transaction[]>()
    const unlinkedSettlements: Transaction[] = []

    for (const t of deferred) {
      if (!isDeferredSettlement(t)) continue
      const recordId = t.deferredRecordId?.trim() || ""
      if (recordId && recordIds.has(recordId)) {
        const list = settlementsByRecordId.get(recordId) ?? []
        list.push(t)
        settlementsByRecordId.set(recordId, list)
      } else {
        unlinkedSettlements.push(t)
      }
    }

    const merged: DeferredRow[] = []

    for (const t of deferred.filter(isDeferredRecord)) {
      const parsed = parseDeferredMemo(t.memo || "")
      const linked = (settlementsByRecordId.get(t.id) ?? []).slice().sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return a.createdAt.localeCompare(b.createdAt)
      })
      const settledSum = linked.reduce((s, x) => s + x.amount, 0)
      const lastSettlement = linked.length > 0 ? linked[linked.length - 1] : null
      merged.push({
        key: t.id,
        transaction: t,
        settlementTransactions: linked,
        date: t.date,
        settlementDate: lastSettlement?.date ?? null,
        deferredAccount: normalizeDeferredAccountName(t.accountTitle),
        category: parsed.category || "—",
        subject: parsed.subject || "—",
        recordedAmount: t.amount,
        settledAmount: settledSum > 0 ? settledSum : null,
        balance: 0,
        memo: parsed.userMemo || "—",
      })
    }

    for (const t of unlinkedSettlements) {
      const parsed = parseDeferredMemo(t.memo || "")
      merged.push({
        key: t.id,
        transaction: t,
        settlementTransactions: [],
        date: t.date,
        settlementDate: null,
        deferredAccount: normalizeDeferredAccountName(t.accountTitle),
        category: parsed.category || "—",
        subject: parsed.subject || "—",
        recordedAmount: null,
        settledAmount: t.amount,
        balance: 0,
        memo: parsed.userMemo || "—",
      })
    }

    merged.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.transaction.createdAt.localeCompare(b.transaction.createdAt)
    })

    let balance = 0
    return merged.map((row) => {
      if (row.recordedAmount != null) balance += row.recordedAmount
      if (row.settledAmount != null) balance -= row.settledAmount
      return { ...row, balance }
    })
  }, [transactions, accountFilter])

  const handleDelete = (row: DeferredRow) => {
    if (isLocked) return
    const hasSettlements = row.settlementTransactions.length > 0
    const message = hasSettlements
      ? "この繰延計上と、紐づく精算を削除しますか？"
      : "この繰延取引を削除しますか？"
    if (!confirm(message)) return
    for (const s of row.settlementTransactions) {
      deleteTransaction(s.id)
    }
    if (deleteTransaction(row.transaction.id)) refresh()
  }

  const handleEdit = (t: Transaction) => {
    if (isLocked) return
    router.push(getEditUrl(t, editReturnTo))
  }

  const showBalance = accountFilter !== "all"
  const emptyColSpan = showBalance ? 10 : 9

  return (
    <div className="px-6 py-8 bg-[#F5F5F0] min-h-screen w-full">
      <div className="w-full">
        <div
          className="rounded-t-lg border border-b-0 border-gray-200 px-6 py-4"
          style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR, backgroundColor: "white" }}
        >
          <h2 className="text-xl font-semibold" style={{ color: THEME_COLOR }}>
            繰延（計上・精算）
          </h2>
          <p className="text-sm text-[#6B7280] mt-1">
            未収入金・未払金・預り金・前払費用の計上・精算台帳
          </p>
          <SettlementLockAlert isLocked={isLocked} className="mt-3" />
        </div>

        <div
          className="bg-white border-x border-t border-gray-200 px-6 py-4 flex flex-wrap items-end gap-4"
          style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR }}
        >
          <span className="text-xs text-[#6B7280]">検索条件:</span>
          <div>
            <label htmlFor="filter-deferred-account" className="block text-xs font-medium text-[#6B7280] mb-1">
              繰延科目
            </label>
            <select
              id="filter-deferred-account"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value as DeferredLedgerAccount)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#68A384] min-w-[160px]"
            >
              <option value="all">すべて</option>
              {DEFERRED_LEDGER_ACCOUNTS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          className="bg-white border border-gray-200 rounded-b-lg overflow-x-hidden"
          style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR }}
        >
          <table className="w-full text-xs border-collapse table-fixed">
            <thead>
              <tr className="bg-[#EEF6F1] text-[#374151]">
                <th className="px-3 py-2.5 text-left font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                  日付
                </th>
                <th className="px-3 py-2.5 text-left font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                  繰延科目
                </th>
                <th className="px-3 py-2.5 text-left font-semibold border-b border-r border-gray-200">
                  カテゴリー
                </th>
                <th className="px-3 py-2.5 text-left font-semibold border-b border-r border-gray-200">
                  科目
                </th>
                <th className="px-3 py-2.5 text-right font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                  計上額
                </th>
                <th className="px-3 py-2.5 text-right font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                  精算額
                </th>
                {showBalance && (
                  <th className="px-3 py-2.5 text-right font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                    残高
                  </th>
                )}
                <th className="px-3 py-2.5 text-left font-semibold border-b border-r border-gray-200">
                  メモ
                </th>
                <th className="px-2 py-2.5 text-center font-semibold border-b border-r border-gray-200 w-12">
                  編集
                </th>
                <th className="px-2 py-2.5 text-center font-semibold border-b border-gray-200 w-12">
                  削除
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={emptyColSpan} className="px-3 py-10 text-center text-[#6B7280] border-r border-gray-200">
                    表示できる繰延取引がありません
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.key} className="hover:bg-gray-50/80 border-b border-gray-100">
                    <td className="px-3 py-2.5 whitespace-nowrap text-[#374151] border-r border-gray-200">
                      <div>{formatDateDisplay(row.date)}</div>
                      {row.settlementDate ? (
                        <div className="text-xs text-[#6B7280] mt-0.5">
                          {formatSettlementDateLabel(row.settlementDate)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-[#374151] border-r border-gray-200">
                      {row.deferredAccount}
                    </td>
                    <td className="px-3 py-2.5 text-[#374151] break-words border-r border-gray-200">
                      {row.category}
                    </td>
                    <td className="px-3 py-2.5 text-[#374151] break-words border-r border-gray-200">
                      {row.subject}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#374151] border-r border-gray-200">
                      {row.recordedAmount != null
                        ? formatAmountDisplay(row.recordedAmount)
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#374151] border-r border-gray-200">
                      {row.settledAmount != null
                        ? formatAmountDisplay(row.settledAmount)
                        : "—"}
                    </td>
                    {showBalance && (
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-[#374151] border-r border-gray-200">
                        {formatAmountDisplay(row.balance)}
                      </td>
                    )}
                    <td
                      className="px-3 py-2.5 text-[#374151] break-words max-w-[14rem] border-r border-gray-200"
                      title={row.memo !== "—" ? row.memo : undefined}
                    >
                      {row.memo}
                    </td>
                    <td className="px-2 py-2.5 text-center border-r border-gray-200">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => handleEdit(row.transaction)}
                        className="inline-flex p-1 rounded-md text-[#68A384] hover:bg-[#68A384]/15 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="編集"
                        aria-label="編集"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => handleDelete(row)}
                        className="inline-flex p-1 rounded-md text-[#EF4444] hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="削除"
                        aria-label="削除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

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

const THEME_COLOR = "#68A384"

const DEFERRED_LEDGER_ACCOUNTS = ["未収入金", "仮払金", "預り金", "未払金"] as const
type DeferredLedgerAccount = (typeof DEFERRED_LEDGER_ACCOUNTS)[number] | "all"

function isDeferredRecord(t: Transaction): boolean {
  return t.type === "deferred" && t.counterparty === "record"
}

function isDeferredSettlement(t: Transaction): boolean {
  return t.type === "deferred" && t.counterparty !== "record"
}

function normalizeDeferredAccountName(name: string): string {
  return name === "仮受金" ? "預り金" : name
}

function parseDeferredMemo(memo: string): {
  category: string
  subject: string
  userMemo: string
} {
  const parts = (memo || "")
    .split(" / ")
    .map((p) => p.trim())
    .filter(Boolean)
  let category = ""
  let subject = ""
  const rest: string[] = []
  for (const p of parts) {
    if (p.startsWith("カテゴリー:")) {
      category = p.replace(/^カテゴリー:\s*/, "").trim()
    } else if (p.startsWith("科目:")) {
      subject = p.replace(/^科目:\s*/, "").trim()
    } else if (p.startsWith("区分:")) {
      // 台帳表示では区分列なし（科目の絞り込み用に保持していた情報）
    } else if (p === "精算" || p === "計上") {
      // skip
    } else {
      rest.push(p)
    }
  }
  return { category, subject, userMemo: rest.join(" / ") }
}

type DeferredRow = {
  key: string
  transaction: Transaction
  date: string
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
    const list = transactions
      .filter((t) => t.type === "deferred")
      .filter((t) => {
        const name = normalizeDeferredAccountName(t.accountTitle)
        if (!DEFERRED_LEDGER_ACCOUNTS.includes(name as (typeof DEFERRED_LEDGER_ACCOUNTS)[number])) {
          return false
        }
        if (accountFilter === "all") return true
        return name === accountFilter
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return a.createdAt.localeCompare(b.createdAt)
      })

    let balance = 0
    return list.map((t) => {
      const parsed = parseDeferredMemo(t.memo || "")
      const isRecord = isDeferredRecord(t)
      const isSettlement = isDeferredSettlement(t)
      if (isRecord) balance += t.amount
      else if (isSettlement) balance -= t.amount
      return {
        key: t.id,
        transaction: t,
        date: t.date,
        category: parsed.category || "—",
        subject: parsed.subject || "—",
        recordedAmount: isRecord ? t.amount : null,
        settledAmount: isSettlement ? t.amount : null,
        balance,
        memo: parsed.userMemo || "—",
      }
    })
  }, [transactions, accountFilter])

  const handleDelete = (id: string) => {
    if (isLocked) return
    if (!confirm("この繰延取引を削除しますか？")) return
    if (deleteTransaction(id)) refresh()
  }

  const handleEdit = (t: Transaction) => {
    if (isLocked) return
    router.push(getEditUrl(t, editReturnTo))
  }

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
            未収入金・仮払金・預り金・未払金の計上・精算台帳
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
              資産・負債科目
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
          className="bg-white border border-gray-200 rounded-b-lg overflow-x-auto"
          style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR }}
        >
          <table className="w-full text-sm border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-[#EEF6F1] text-[#374151]">
                <th className="px-3 py-2.5 text-left font-semibold border-b border-gray-200 whitespace-nowrap">
                  日付
                </th>
                <th className="px-3 py-2.5 text-left font-semibold border-b border-gray-200">
                  カテゴリー
                </th>
                <th className="px-3 py-2.5 text-left font-semibold border-b border-gray-200">
                  科目
                </th>
                <th className="px-3 py-2.5 text-right font-semibold border-b border-gray-200 whitespace-nowrap">
                  計上額
                </th>
                <th className="px-3 py-2.5 text-right font-semibold border-b border-gray-200 whitespace-nowrap">
                  精算額
                </th>
                <th className="px-3 py-2.5 text-right font-semibold border-b border-gray-200 whitespace-nowrap">
                  残高
                </th>
                <th className="px-3 py-2.5 text-left font-semibold border-b border-gray-200">
                  メモ
                </th>
                <th className="px-2 py-2.5 text-center font-semibold border-b border-gray-200 w-12">
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
                  <td colSpan={9} className="px-3 py-10 text-center text-[#6B7280]">
                    表示できる繰延取引がありません
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.key} className="hover:bg-gray-50/80 border-b border-gray-100">
                    <td className="px-3 py-2.5 whitespace-nowrap text-[#374151]">
                      {formatDateDisplay(row.date)}
                    </td>
                    <td className="px-3 py-2.5 text-[#374151] break-words">
                      {row.category}
                    </td>
                    <td className="px-3 py-2.5 text-[#374151] break-words">
                      <div>{row.subject}</div>
                      <div className="text-[10px] text-[#9CA3AF] mt-0.5">
                        {normalizeDeferredAccountName(row.transaction.accountTitle)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#374151]">
                      {row.recordedAmount != null
                        ? row.recordedAmount.toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#374151]">
                      {row.settledAmount != null
                        ? row.settledAmount.toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-[#374151]">
                      {row.balance.toLocaleString()}
                    </td>
                    <td
                      className="px-3 py-2.5 text-[#374151] break-words max-w-[14rem]"
                      title={row.memo !== "—" ? row.memo : undefined}
                    >
                      {row.memo}
                    </td>
                    <td className="px-2 py-2.5 text-center">
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
                        onClick={() => handleDelete(row.transaction.id)}
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

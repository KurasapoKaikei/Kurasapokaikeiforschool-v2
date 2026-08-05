"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Pencil } from "lucide-react"
import {
  getTransactions,
  getCsvImportBatches,
  type Transaction,
  type CsvImportBatch,
} from "@/utils/localStorage"
import { getEditUrl, isCsvLinkedTransaction, withReturnTo } from "@/utils/transactionEditPath"
import { formatDateDisplay } from "@/utils/dateDisplay"
import { formatAmountDisplay } from "@/utils/formatAmountDisplay"
import { SettlementLockAlert } from "@/components/club/SettlementLockAlert"
import { useClubSettlementLock } from "@/hooks/useClubSettlementLock"

type Tab = "all" | "csv"

/** 今期の期首（4月1日）を YYYY-MM-DD で返す */
function getFiscalYearStart(): string {
  const d = new Date()
  const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
  return `${year}-04-01`
}

/** createdAt（ISO）→ 日付・時刻に分割（登録日列は2段表示） */
function parseTransactionRegisteredAt(
  iso: string | undefined | null
): { date: string; time: string } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const h = String(d.getHours()).padStart(2, "0")
  const min = String(d.getMinutes()).padStart(2, "0")
  return { date: `${y}/${mo}/${day}`, time: `${h}:${min}` }
}

/** 現金・預金口座列に付ける種別バッジ（振替と同じ pill スタイル） */
const HISTORY_TYPE_BADGE_BASE =
  "inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-semibold flex-shrink-0 leading-relaxed"

const HISTORY_TYPE_BADGE: Record<
  "income" | "expense" | "collection" | "transfer",
  { label: string; className: string }
> = {
  income: { label: "収入", className: "bg-[#3B82F6]/15 text-[#1D4ED8]" },
  expense: { label: "支出", className: "bg-[#F59E0B]/20 text-[#B45309]" },
  collection: { label: "集金", className: "bg-[#67a384]/20 text-[#3d6b54]" },
  transfer: { label: "振替", className: "bg-[#A3BC68]/15 text-[#5C7A3A]" },
}

function historyTypeBadge(type: Transaction["type"] | "transfer") {
  if (type === "income" || type === "expense" || type === "collection" || type === "transfer") {
    return HISTORY_TYPE_BADGE[type]
  }
  return null
}

/** 一覧セル共通（小さめ・枠内折り返し前提） */
const TH_CLASS =
  "sticky top-0 z-20 bg-gray-50 border border-gray-200 px-1.5 py-1.5 text-center text-[11px] font-semibold leading-tight whitespace-normal shadow-[inset_0_-1px_0_0_#e5e7eb]"
const TD_BASE = "border border-gray-200 px-1.5 py-1.5 align-top text-[11px] leading-snug text-[#374151]"
const TD_WRAP = `${TD_BASE} text-left break-words whitespace-normal`
const TD_NUM = `${TD_BASE} text-right tabular-nums whitespace-nowrap`
const TD_CENTER = `${TD_BASE} text-center`

function RegisteredAtBlock({
  createdAt,
  lastEditedAt,
}: {
  createdAt: string | undefined | null
  lastEditedAt?: string | null
}) {
  const created = parseTransactionRegisteredAt(createdAt)
  const edited = parseTransactionRegisteredAt(lastEditedAt)
  if (!created) {
    return <span className="text-[#9CA3AF]">—</span>
  }
  return (
    <div className="flex flex-col items-center leading-tight gap-0.5">
      <span className="whitespace-nowrap">{created.date}</span>
      <span className="text-[10px] text-[#6B7280] whitespace-nowrap">{created.time}</span>
      {edited && (
        <span className="text-[10px] text-[#9CA3AF] whitespace-nowrap mt-0.5">
          {edited.date} {edited.time} 編集
        </span>
      )}
    </div>
  )
}

/** 一覧上の入金額・出金額表示（支出系は出金、収入系は入金） */
function formatWithdrawalDeposit(t: Transaction): { withdrawal: string; deposit: string } {
  const amt = formatAmountDisplay(t.amount)
  if (t.type === "income" || t.type === "collection") {
    return { withdrawal: "—", deposit: amt }
  }
  return { withdrawal: amt, deposit: "—" }
}

/**
 * 振替の対（expense + income）を判定するためのヒューリスティクス。
 * 旧データは `transferGroupId` を持たないため、memo の冒頭で識別する。
 */
function isLegacyTransferExpense(t: Transaction): boolean {
  return t.type === "expense" && /^振替（出金）/.test(t.memo)
}
function isLegacyTransferIncome(t: Transaction): boolean {
  return t.type === "income" && /^振替（入金）/.test(t.memo)
}

/**
 * 振替レコードのメモから、ユーザーが登録時に入力した「メモ本文」のみを抽出する。
 * 保存形式は `振替（出金）→ {to} / {ユーザーメモ}` または `振替（入金）← {from} / {ユーザーメモ}`。
 * `/` 以降がない場合（旧データ／メモ未入力）は空文字を返す。
 */
function extractTransferUserMemo(tx: Transaction | null): string {
  if (!tx) return ""
  const m = tx.memo.match(/\s\/\s(.+)$/)
  return m ? m[1].trim() : ""
}

/** 履歴1行を表す内部モデル: 単独の取引、または振替の対 */
type HistoryRow =
  | { kind: "single"; tx: Transaction }
  | {
      kind: "transfer"
      key: string
      date: string
      createdAt: string
      lastEditedAt: string | null
      createdBy: string
      updatedBy: string | null
      from: string
      to: string
      amount: number
      memo: string
      expenseTx: Transaction | null
      incomeTx: Transaction | null
    }

export default function RegisterHistoryPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchQs = searchParams.toString()
  const editReturnTo = useMemo(
    () => pathname + (searchQs ? `?${searchQs}` : ""),
    [pathname, searchQs]
  )
  const [tab, setTab] = useState<Tab>("all")
  const [isLocked, setIsLocked] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [batches, setBatches] = useState<CsvImportBatch[]>([])

  const refresh = () => {
    setTransactions(getTransactions())
    setBatches(getCsvImportBatches().sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)))
  }

  useEffect(() => {
    refresh()
    const i = setInterval(refresh, 800)
    return () => clearInterval(i)
  }, [])

  /** 2026年度（今会計年度）の取引のみに絞り込む */
  const fiscalStart = useMemo(() => getFiscalYearStart(), [])
  const fiscalScopedTransactions = useMemo(
    () => transactions.filter((t) => t.date && t.date >= fiscalStart),
    [transactions, fiscalStart]
  )

  /**
   * 振替の対を1行に集約した履歴行のリストを生成する。
   * 1) `transferGroupId` を持つレコードを優先で束ねる
   * 2) 旧データは `memo` プレフィックスで「同日付・同金額・出金/入金が1件ずつ」のペアを推定して束ねる
   */
  const allRows = useMemo<HistoryRow[]>(() => {
    const rows: HistoryRow[] = []
    const consumed = new Set<string>()

    // (1) transferGroupId による集約
    const byGroup = new Map<string, Transaction[]>()
    for (const t of fiscalScopedTransactions) {
      const gid = t.transferGroupId
      if (!gid) continue
      const arr = byGroup.get(gid) ?? []
      arr.push(t)
      byGroup.set(gid, arr)
    }
    for (const [gid, txs] of byGroup) {
      const exp = txs.find((t) => t.type === "expense") ?? null
      const inc = txs.find((t) => t.type === "income") ?? null
      const repr = exp ?? inc
      if (!repr) continue
      const fromName = exp?.counterparty || inc?.accountTitle || "—"
      const toName = inc?.counterparty || exp?.accountTitle || "—"
      const userMemo = extractTransferUserMemo(exp) || extractTransferUserMemo(inc)
      const lastEditedAt =
        [exp?.lastEditedAt ?? null, inc?.lastEditedAt ?? null]
          .filter((v): v is string => Boolean(v))
          .sort()
          .pop() ?? null
      const createdBy =
        (exp?.createdBy ?? "").trim() ||
        (inc?.createdBy ?? "").trim() ||
        "—"
      const updatedBy =
        (exp?.updatedBy ?? "").trim() ||
        (inc?.updatedBy ?? "").trim() ||
        null
      rows.push({
        kind: "transfer",
        key: `tg:${gid}`,
        date: repr.date,
        createdAt: repr.createdAt,
        lastEditedAt,
        createdBy,
        updatedBy,
        from: fromName,
        to: toName,
        amount: Math.abs(repr.amount),
        memo: userMemo,
        expenseTx: exp,
        incomeTx: inc,
      })
      txs.forEach((t) => consumed.add(t.id))
    }

    // (2) 旧データのヒューリスティック集約（memo プレフィックス + 同日付 + 同金額）
    const legacyExpense = fiscalScopedTransactions.filter(
      (t) => !consumed.has(t.id) && isLegacyTransferExpense(t)
    )
    const legacyIncome = fiscalScopedTransactions.filter(
      (t) => !consumed.has(t.id) && isLegacyTransferIncome(t)
    )
    const incomeByKey = new Map<string, Transaction[]>()
    for (const t of legacyIncome) {
      const key = `${t.date}_${t.amount}`
      const arr = incomeByKey.get(key) ?? []
      arr.push(t)
      incomeByKey.set(key, arr)
    }
    for (const exp of legacyExpense) {
      const key = `${exp.date}_${exp.amount}`
      const candidates = incomeByKey.get(key)
      if (!candidates || candidates.length === 0) continue
      const inc = candidates.shift()!
      consumed.add(exp.id)
      consumed.add(inc.id)
      const legacyLastEditedAt =
        [exp.lastEditedAt ?? null, inc.lastEditedAt ?? null]
          .filter((v): v is string => Boolean(v))
          .sort()
          .pop() ?? null
      rows.push({
        kind: "transfer",
        key: `legacy:${exp.id}:${inc.id}`,
        date: exp.date,
        createdAt: exp.createdAt > inc.createdAt ? exp.createdAt : inc.createdAt,
        lastEditedAt: legacyLastEditedAt,
        createdBy:
          (exp.createdBy ?? "").trim() || (inc.createdBy ?? "").trim() || "—",
        updatedBy:
          (exp.updatedBy ?? "").trim() || (inc.updatedBy ?? "").trim() || null,
        from: exp.counterparty || inc.accountTitle || "—",
        to: inc.counterparty || exp.accountTitle || "—",
        amount: Math.abs(exp.amount),
        memo: extractTransferUserMemo(exp) || extractTransferUserMemo(inc),
        expenseTx: exp,
        incomeTx: inc,
      })
    }

    // (3) 単独レコード
    for (const t of fiscalScopedTransactions) {
      if (consumed.has(t.id)) continue
      rows.push({ kind: "single", tx: t })
    }

    rows.sort((a, b) => {
      const ad = a.kind === "single" ? a.tx.date : a.date
      const bd = b.kind === "single" ? b.tx.date : b.date
      if (bd !== ad) return bd.localeCompare(ad)
      const ac = a.kind === "single" ? a.tx.createdAt : a.createdAt
      const bc = b.kind === "single" ? b.tx.createdAt : b.createdAt
      return bc.localeCompare(ac)
    })
    return rows
  }, [fiscalScopedTransactions])

  const batchSummaries = useMemo(() => {
    return batches.map((b) => {
      const txs = transactions.filter((t) => t.csvImportId === b.id)
      let depositTotal = 0
      let withdrawalTotal = 0
      for (const t of txs) {
        if (t.type === "income" || t.type === "collection") depositTotal += t.amount
        else if (t.type === "expense") withdrawalTotal += t.amount
        // 振替は口座間移動のため入金・出金合計には含めない
      }
      return { batch: b, count: txs.length, depositTotal, withdrawalTotal }
    })
  }, [batches, transactions])

  const handleRowEdit = (row: HistoryRow) => {
    if (isLocked) return
    if (row.kind === "transfer") {
      const expId = row.expenseTx?.id ?? ""
      const incId = row.incomeTx?.id ?? ""
      if (!expId || !incId) {
        // 片側のみ存在する場合は通常編集にフォールバック
        const fallback = row.expenseTx ?? row.incomeTx
        if (fallback) router.push(getEditUrl(fallback, editReturnTo))
        return
      }
      const url = withReturnTo(
        `/club/accounting/register/new?tab=transfer&editTransfer=${encodeURIComponent(`${expId}:${incId}`)}`,
        editReturnTo
      )
      router.push(url)
      return
    }
    router.push(getEditUrl(row.tx, editReturnTo))
  }

  return (
    <div className="px-6 py-8 bg-[#F5F5F0] min-h-screen">
      <div className="max-w-[min(1600px,100%)] w-full mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-[#374151]">登録履歴</h2>
          <p className="text-sm text-[#6B7280]">
            「すべて」で手動・CSV・その他の取引を一覧します。「CSV」は取込ファイル単位の履歴です。
          </p>
          <SettlementLockAlert isLocked={isLocked} className="mt-4" />
        </div>

        <div className="flex gap-1 mb-4 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border border-b-0 transition-colors ${
              tab === "all"
                ? "bg-white text-[#374151] border-gray-200 -mb-px"
                : "bg-transparent text-[#6B7280] border-transparent hover:bg-white/60"
            }`}
          >
            すべて
          </button>
          <button
            type="button"
            onClick={() => setTab("csv")}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border border-b-0 transition-colors ${
              tab === "csv"
                ? "bg-white text-[#374151] border-gray-200 -mb-px"
                : "bg-transparent text-[#6B7280] border-transparent hover:bg-white/60"
            }`}
          >
            CSV
          </button>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {tab === "all" ? (
            <div className="max-h-[min(75vh,42rem)] overflow-y-auto overflow-x-hidden">
              <table className="w-full text-[10px] border-collapse table-fixed">
                {/*
                 * カラム比率: 日付2 / 口座5 / 入金2 / 出金2 / カテゴリー2.5 / 科目2.5 / メモ3.5 / 登録日2 / 作業者1.5 / 編集1
                 * 指定比率の合計（=24）を分母にして横幅100%を埋める。
                 */}
                <colgroup>
                  <col style={{ width: `${(2 / 24) * 100}%` }} />
                  <col style={{ width: `${(5 / 24) * 100}%` }} />
                  <col style={{ width: `${(2 / 24) * 100}%` }} />
                  <col style={{ width: `${(2 / 24) * 100}%` }} />
                  <col style={{ width: `${(2.5 / 24) * 100}%` }} />
                  <col style={{ width: `${(2.5 / 24) * 100}%` }} />
                  <col style={{ width: `${(3.5 / 24) * 100}%` }} />
                  <col style={{ width: `${(2 / 24) * 100}%` }} />
                  <col style={{ width: `${(1.5 / 24) * 100}%` }} />
                  <col style={{ width: `${(1 / 24) * 100}%` }} />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50 text-[#374151]">
                    <th className={TH_CLASS}>日付</th>
                    <th className={TH_CLASS}>現金・預金口座</th>
                    <th className={TH_CLASS}>入金額</th>
                    <th className={TH_CLASS}>出金額</th>
                    <th className={TH_CLASS}>カテゴリー</th>
                    <th className={TH_CLASS}>科目</th>
                    <th className={TH_CLASS}>メモ</th>
                    <th className={TH_CLASS}>登録日</th>
                    <th className={TH_CLASS}>作業者</th>
                    <th className={TH_CLASS}>編集</th>
                  </tr>
                </thead>
                <tbody>
                  {allRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className={`${TD_BASE} py-10 text-center text-[#6B7280]`}>
                        登録された取引はまだありません。
                      </td>
                    </tr>
                  ) : (
                    allRows.map((row) => {
                      if (row.kind === "transfer") {
                        const amt = formatAmountDisplay(row.amount)
                        const memoText = row.memo.trim()
                        const accountLabel = `振替 ${row.from} → ${row.to}`
                        return (
                          <tr key={row.key} className="hover:bg-gray-50/80">
                            <td className={`${TD_BASE} text-left whitespace-nowrap`}>
                              {formatDateDisplay(row.date)}
                            </td>
                            <td className={TD_WRAP} title={accountLabel}>
                              <div className="flex flex-col items-start gap-0.5 min-w-0">
                                <span
                                  className={`${HISTORY_TYPE_BADGE_BASE} ${HISTORY_TYPE_BADGE.transfer.className}`}
                                >
                                  {HISTORY_TYPE_BADGE.transfer.label}
                                </span>
                                <span className="text-[#374151] break-words">
                                  {row.from} <span className="text-[#9CA3AF]">→</span> {row.to}
                                </span>
                              </div>
                            </td>
                            <td className={TD_NUM}>{amt}</td>
                            <td className={TD_NUM}>{amt}</td>
                            <td className={`${TD_BASE} text-left text-[#9CA3AF]`}>—</td>
                            <td className={`${TD_BASE} text-left text-[#9CA3AF]`}>—</td>
                            <td className={TD_WRAP} title={memoText || undefined}>
                              {memoText ? memoText : <span className="text-[#9CA3AF]">—</span>}
                            </td>
                            <td className={TD_CENTER}>
                              <RegisteredAtBlock
                                createdAt={row.createdAt}
                                lastEditedAt={row.lastEditedAt}
                              />
                            </td>
                            <td
                              className={TD_WRAP}
                              title={`登録: ${row.createdBy}${row.updatedBy ? ` / 編集: ${row.updatedBy}` : ""}`}
                            >
                              <div className="flex flex-col leading-tight min-w-0 gap-0.5">
                                <span className="break-words">{row.createdBy}</span>
                                {row.updatedBy && (
                                  <span className="text-[#9CA3AF] text-[10px] break-words">
                                    {row.updatedBy}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className={TD_CENTER}>
                              <button
                                type="button"
                                disabled={isLocked}
                                onClick={() => handleRowEdit(row)}
                                className="inline-flex p-1 rounded-md text-[#68A384] hover:bg-[#68A384]/15 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                title="振替を編集"
                                aria-label="振替を編集"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        )
                      }
                      const t = row.tx
                      const { withdrawal, deposit } = formatWithdrawalDeposit(t)
                      const createdByLabel = (t.createdBy ?? "").trim() || "—"
                      const updatedByLabel = (t.updatedBy ?? "").trim() || null
                      const typeBadge = historyTypeBadge(t.type)
                      return (
                        <tr key={t.id} className="hover:bg-gray-50/80">
                          <td className={`${TD_BASE} text-left whitespace-nowrap`}>
                            {formatDateDisplay(t.date)}
                          </td>
                          <td className={TD_WRAP} title={t.counterparty}>
                            <div className="flex flex-col items-start gap-0.5 min-w-0">
                              {typeBadge && (
                                <span
                                  className={`${HISTORY_TYPE_BADGE_BASE} ${typeBadge.className}`}
                                >
                                  {typeBadge.label}
                                </span>
                              )}
                              <span className="text-[#374151] break-words">{t.counterparty}</span>
                            </div>
                          </td>
                          <td className={TD_NUM}>{deposit}</td>
                          <td className={TD_NUM}>{withdrawal}</td>
                          <td className={TD_WRAP} title={t.category}>
                            {t.category}
                          </td>
                          <td className={TD_WRAP} title={t.accountTitle}>
                            {t.accountTitle}
                          </td>
                          <td className={TD_WRAP} title={t.memo || undefined}>
                            {t.memo || "—"}
                          </td>
                          <td className={TD_CENTER}>
                            <RegisteredAtBlock
                              createdAt={t.createdAt}
                              lastEditedAt={t.lastEditedAt}
                            />
                          </td>
                          <td
                            className={TD_WRAP}
                            title={`登録: ${createdByLabel}${updatedByLabel ? ` / 編集: ${updatedByLabel}` : ""}`}
                          >
                            <div className="flex flex-col leading-tight min-w-0 gap-0.5">
                              <span className="break-words">{createdByLabel}</span>
                              {updatedByLabel && (
                                <span className="text-[#9CA3AF] text-[10px] break-words">
                                  {updatedByLabel}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={TD_CENTER}>
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() => handleRowEdit(row)}
                              className="inline-flex p-1 rounded-md text-[#68A384] hover:bg-[#68A384]/15 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                              title={isCsvLinkedTransaction(t) ? "CSV一括編集へ" : "明細を編集"}
                              aria-label="編集"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-hidden">
              <table className="w-full text-xs border-collapse table-fixed">
                <thead>
                  <tr className="bg-gray-50 text-[#374151]">
                    <th className="border border-gray-200 px-3 py-2 text-left">ファイル名</th>
                    <th className="border border-gray-200 px-3 py-2 text-right">入金額合計</th>
                    <th className="border border-gray-200 px-3 py-2 text-right">出金額合計</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">取込日</th>
                    <th className="border border-gray-200 px-3 py-2 text-center">編集</th>
                  </tr>
                </thead>
                <tbody>
                  {batchSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-[#6B7280]">
                        CSV取込の履歴はまだありません。
                      </td>
                    </tr>
                  ) : (
                    batchSummaries.map(({ batch, depositTotal, withdrawalTotal }) => {
                      const imported = parseTransactionRegisteredAt(batch.registeredAt)
                      const importDateLabel = imported?.date ?? "—"
                      const editHref = withReturnTo(
                        `/club/accounting/register/csv/${batch.id}`,
                        editReturnTo
                      )
                      return (
                        <tr key={batch.id} className="hover:bg-gray-50/80">
                          <td className="border border-gray-200 px-3 py-2 font-medium text-[#374151]">
                            {batch.fileName}
                          </td>
                          <td className="border border-gray-200 px-3 py-2 text-right tabular-nums font-medium">
                            {formatAmountDisplay(depositTotal)}
                          </td>
                          <td className="border border-gray-200 px-3 py-2 text-right tabular-nums font-medium">
                            {formatAmountDisplay(withdrawalTotal)}
                          </td>
                          <td className="border border-gray-200 px-3 py-2 whitespace-nowrap text-xs">
                            {importDateLabel}
                          </td>
                          <td className="border border-gray-200 px-3 py-2 text-center">
                            {isLocked ? (
                              <span
                                className="inline-flex p-1 rounded-md text-gray-400 opacity-40 cursor-not-allowed"
                                title="決算ロック中のため編集できません"
                                aria-label="編集（ロック中）"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </span>
                            ) : (
                              <Link
                                href={editHref}
                                className="inline-flex p-1 rounded-md text-[#68A384] hover:bg-[#68A384]/15"
                                title="内容確認・一括編集"
                                aria-label="編集"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Link>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

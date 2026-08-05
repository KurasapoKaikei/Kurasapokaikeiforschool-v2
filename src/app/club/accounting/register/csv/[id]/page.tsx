"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DatePickerField } from "@/components/ui/date-picker-field"
import {
  getCategories,
  getAccountTitles,
  getCsvImportBatches,
  getTransactionsByCsvImportId,
  updateTransaction,
  deleteCsvImportBatch,
  syncCsvImportBatchFromTransactions,
  type Category,
  type AccountTitle,
} from "@/utils/localStorage"
import {
  resolveRegisterEditBackHref,
  REGISTER_EDIT_RETURN_QUERY,
} from "@/utils/transactionEditPath"
import { useUserInfo } from "@/contexts/UserInfoContext"
import { usePortalFiscalYearOptional } from "@/contexts/PortalFiscalYearContext"
import {
  formatFiscalBoundsMessage,
  isDateWithinFiscalBounds,
  resolveFiscalDateBounds,
} from "@/lib/fiscalDateBounds"
import { SettlementLockAlert } from "@/components/club/SettlementLockAlert"
import { useClubSettlementLock } from "@/hooks/useClubSettlementLock"

const THEME_COLOR = "#A3BC68"

type DraftRow = {
  id: string
  date: string
  type: "income" | "expense" | "transfer" | "collection"
  counterparty: string
  amount: number
  category: string
  accountTitle: string
  memo: string
}

const TYPE_LABEL: Record<DraftRow["type"], string> = {
  income: "収入",
  expense: "支出",
  transfer: "振替",
  collection: "集金",
}

export default function CsvImportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentOperatorName } = useUserInfo()
  const portalFiscalYear = usePortalFiscalYearOptional()
  const fiscalBounds = useMemo(
    () => resolveFiscalDateBounds(portalFiscalYear?.selectedYear),
    [portalFiscalYear?.selectedYear]
  )
  const returnToParam = searchParams.get(REGISTER_EDIT_RETURN_QUERY)
  const backHref = useMemo(
    () => resolveRegisterEditBackHref(returnToParam),
    [returnToParam]
  )

  const id = typeof params.id === "string" ? params.id : ""

  const [categories, setCategories] = useState<Category[]>([])
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])
  const [batchFileName, setBatchFileName] = useState<string>("")
  const [draftRows, setDraftRows] = useState<DraftRow[]>([])
  const [notFound, setNotFound] = useState(false)
  const [isLocked, setIsLocked] = useState(false)

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  )

  const load = useCallback(() => {
    if (!id) {
      setNotFound(true)
      return
    }
    setCategories(getCategories())
    setAccountTitles(getAccountTitles())
    const batches = getCsvImportBatches()
    const batch = batches.find((b) => b.id === id)
    if (!batch) {
      setNotFound(true)
      setDraftRows([])
      return
    }
    setNotFound(false)
    setBatchFileName(batch.fileName)
    syncCsvImportBatchFromTransactions(id)
    const txs = getTransactionsByCsvImportId(id).filter((t) =>
      t.type === "income" ||
      t.type === "expense" ||
      t.type === "transfer" ||
      t.type === "collection"
    )
    setDraftRows(
      txs.map((t) => ({
        id: t.id,
        date: t.date,
        type: t.type as DraftRow["type"],
        counterparty: t.counterparty,
        amount: t.amount,
        category: t.category,
        accountTitle: t.accountTitle,
        memo: t.memo,
      }))
    )
  }, [id])

  useEffect(() => {
    load()
    const i = setInterval(() => {
      setCategories(getCategories())
      setAccountTitles(getAccountTitles())
    }, 1000)
    return () => clearInterval(i)
  }, [load])

  const titlesForCategory = useCallback(
    (categoryName: string, kind: "income" | "expense") => {
      const cat = sortedCategories.find((c) => c.name === categoryName)
      const group = kind === "income" ? "income" : "expense"
      let list = accountTitles.filter((t) => t.group === group)
      if (cat) list = list.filter((t) => t.categoryIds.includes(cat.id))
      return list.sort((a, b) => a.order - b.order)
    },
    [accountTitles, sortedCategories]
  )

  const setDraft = (rowId: string, patch: Partial<DraftRow>) => {
    setDraftRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)))
  }

  const cashTitles = useMemo(
    () => accountTitles.filter((t) => t.group === "cash").sort((a, b) => a.order - b.order),
    [accountTitles]
  )

  const titlesForDraftRow = useCallback(
    (r: DraftRow) => {
      if (r.type === "transfer") {
        return cashTitles
          .filter((t) => t.name !== r.counterparty)
          .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ja"))
      }
      const kind = r.type === "expense" ? "expense" : "income"
      return titlesForCategory(r.category, kind)
    },
    [cashTitles, titlesForCategory]
  )

  const setRowCategory = (rowId: string, category: string) => {
    setDraftRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId || r.type === "transfer") return r
        const kind = r.type === "expense" ? "expense" : "income"
        const titles = titlesForCategory(category, kind)
        const keep = titles.some((t) => t.name === r.accountTitle)
        return {
          ...r,
          category,
          accountTitle: keep ? r.accountTitle : titles[0]?.name ?? "",
        }
      })
    )
  }

  const canSave = useMemo(() => {
    if (draftRows.length === 0) return false
    return draftRows.every((r) => {
      if (!r.amount || !r.date || !r.accountTitle) return false
      if (r.type === "transfer") return r.accountTitle !== r.counterparty
      return Boolean(r.category)
    })
  }, [draftRows])

  const handleSave = () => {
    if (isLocked) return
    if (!canSave) {
      alert("全行で日付・カテゴリー・科目・金額を確認してください。")
      return
    }
    const outOfBounds = draftRows.find((d) => !isDateWithinFiscalBounds(d.date, fiscalBounds))
    if (outOfBounds) {
      alert(formatFiscalBoundsMessage(fiscalBounds))
      return
    }
    for (const d of draftRows) {
      const subject = accountTitles.find((t) => t.name === d.accountTitle)
      const categoryToSave =
        d.type === "transfer"
          ? "共通"
          : subject?.group === "cash"
            ? "共通"
            : d.category
      updateTransaction(d.id, {
        date: d.date,
        type: d.type,
        amount: Number.isFinite(d.amount) ? Math.trunc(d.amount) : 0,
        counterparty: d.counterparty,
        category: categoryToSave,
        accountTitle: d.accountTitle,
        memo: d.memo || "",
        updatedBy: currentOperatorName,
      })
    }
    syncCsvImportBatchFromTransactions(id)
    alert("このCSVファイル単位で、全明細を帳簿に反映しました。")
    load()
  }

  const handleDeleteBatchAndReupload = () => {
    if (isLocked) return
    if (
      !confirm(
        `「${batchFileName}」に紐づく明細をすべて削除し、新しいCSVをアップロードする画面へ移動します。よろしいですか？\nこの操作は取り消せません。`
      )
    ) {
      return
    }
    if (deleteCsvImportBatch(id)) {
      router.push("/club/accounting/register/new")
    } else {
      alert("削除に失敗しました。画面を再読み込みしてください。")
    }
  }

  const inputClass =
    "w-full px-2 py-1.5 border border-gray-300 rounded text-[#374151] text-sm"

  if (!id) {
    return (
      <div className="px-6 py-8 min-h-screen bg-[#F5F5F0]">
        <p className="text-[#6B7280]">無効なURLです。</p>
        <Link href={backHref} className="text-[#A3BC68] font-semibold mt-2 inline-block">
          戻る
        </Link>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="px-6 py-8 min-h-screen bg-[#F5F5F0]">
        <p className="text-[#6B7280]">指定されたCSV履歴が見つかりません。</p>
        <Link href={backHref} className="text-[#A3BC68] font-semibold mt-2 inline-block">
          戻る
        </Link>
      </div>
    )
  }

  if (draftRows.length === 0) {
    return (
      <div className="px-6 py-8 min-h-screen bg-[#F5F5F0]">
        <p className="text-[#374151] font-medium">{batchFileName}</p>
        <p className="text-[#6B7280] mt-2">
          このCSVに紐づく明細が見つかりません。台帳から個別削除された可能性があります。
        </p>
        <div className="flex gap-3 mt-4">
          <Link
            href={backHref}
            className="text-[#A3BC68] font-semibold hover:underline"
          >
            戻る
          </Link>
          <button
            type="button"
            disabled={isLocked}
            className="text-red-600 font-semibold text-sm hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
            onClick={() => {
              if (isLocked) return
              if (
                confirm(
                  "明細が空のため履歴のみ残っています。履歴を削除し、CSVを取り込み直せる画面へ移動しますか？"
                )
              ) {
                deleteCsvImportBatch(id)
                router.push("/club/accounting/register/new")
              }
            }}
          >
            履歴を削除して再アップロードへ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-6 bg-[#F5F5F0] min-h-screen pb-28">
      <div className="max-w-6xl mx-auto space-y-4">
        <div>
          <Link
            href={backHref}
            className="text-sm text-[#A3BC68] font-semibold hover:underline"
          >
            ← 戻る
          </Link>
          <h1 className="text-xl font-semibold text-[#374151] mt-2">取込み済み明細（CSV一括）</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            ファイル名: <span className="font-medium text-[#374151]">{batchFileName}</span>
          </p>
          <p className="text-xs text-[#6B7280] mt-2 max-w-3xl">
            ここでの変更は常に「このCSVファイル単位」の更新として帳簿に反映されます。CSV由来の明細は単体編集画面では編集できません。
          </p>
          <SettlementLockAlert isLocked={isLocked} className="mt-4" />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white overflow-x-hidden">
          <table className="w-full text-xs border-collapse table-fixed">
            <thead>
              <tr className="bg-gray-50 text-[#374151]">
                <th className="border border-gray-200 px-2 py-2 text-left w-36">日付</th>
                <th className="border border-gray-200 px-2 py-2 text-left">区分</th>
                <th className="border border-gray-200 px-2 py-2 text-left">現金・預金</th>
                <th className="border border-gray-200 px-2 py-2 text-right">金額</th>
                <th className="border border-gray-200 px-2 py-2 text-left ">カテゴリー</th>
                <th className="border border-gray-200 px-2 py-2 text-left ">科目</th>
                <th className="border border-gray-200 px-2 py-2 text-left ">メモ</th>
              </tr>
            </thead>
            <tbody>
              {draftRows.map((r) => {
                const titles = titlesForDraftRow(r)
                const isTransfer = r.type === "transfer"
                return (
                  <tr key={r.id}>
                    <td className="border border-gray-200 px-2 py-2 whitespace-nowrap">
                      <DatePickerField
                        value={r.date}
                        onChange={(v) => setDraft(r.id, { date: v })}
                        themeColor={THEME_COLOR}
                        className={inputClass}
                        minDate={fiscalBounds.minDate}
                        maxDate={fiscalBounds.maxDate}
                        aria-label="日付"
                      />
                    </td>
                    <td className="border border-gray-200 px-2 py-2">{TYPE_LABEL[r.type]}</td>
                    <td className="border border-gray-200 px-2 py-2 text-[#6B7280]">{r.counterparty}</td>
                    <td className="border border-gray-200 px-2 py-2">
                      <input
                        type="number"
                        className={`${inputClass} text-right tabular-nums`}
                        value={r.amount}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === "") {
                            setDraft(r.id, { amount: 0 })
                            return
                          }
                          const n = Number(v)
                          if (Number.isFinite(n)) setDraft(r.id, { amount: Math.trunc(n) })
                        }}
                        aria-label="金額"
                      />
                    </td>
                    <td className="border border-gray-200 px-2 py-2">
                      {isTransfer ? (
                        <div className={`${inputClass} text-center text-xs text-[#6B7280] bg-gray-50`}>
                          選択なし
                        </div>
                      ) : (
                        <select
                          className={inputClass}
                          value={r.category}
                          onChange={(e) => setRowCategory(r.id, e.target.value)}
                          aria-label="カテゴリー"
                        >
                          <option value="">選択</option>
                          {sortedCategories.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="border border-gray-200 px-2 py-2">
                      <select
                        className={inputClass}
                        value={r.accountTitle}
                        onChange={(e) => setDraft(r.id, { accountTitle: e.target.value })}
                        aria-label="科目"
                      >
                        <option value="">選択</option>
                        {titles.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-gray-200 px-2 py-2">
                      <input
                        type="text"
                        className={inputClass}
                        value={r.memo}
                        onChange={(e) => setDraft(r.id, { memo: e.target.value })}
                        aria-label="メモ"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-[#6B7280]">
          現金・預金（相手科目）はCSV取込時の口座のため、この画面では変更できません。変更が必要な場合は一旦CSVバッチを削除し、修正したCSVを取り込み直してください。
        </p>

        <div className="fixed bottom-0 left-0 right-0 ml-64 border-t border-gray-200 bg-white/95 backdrop-blur px-6 py-4 flex flex-wrap gap-3 z-40">
          <Button
            type="button"
            disabled={!canSave || isLocked}
            style={{ backgroundColor: THEME_COLOR }}
            className="text-white disabled:opacity-40"
            onClick={handleSave}
          >
            修正して保存
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isLocked}
            onClick={handleDeleteBatchAndReupload}
          >
            このCSVを削除して再アップロード
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(backHref)}
          >
            キャンセル
          </Button>
        </div>
      </div>
    </div>
  )
}

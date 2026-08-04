"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { DatePickerField } from "@/components/ui/date-picker-field"
import { X, ImageIcon } from "lucide-react"
import {
  getCategories,
  getAccountTitles,
  updateTransaction,
  type Category,
  type AccountTitle,
  type Transaction,
} from "@/utils/localStorage"
import { isCsvLinkedTransaction } from "@/utils/transactionEditPath"
import {
  formatAmountInputDisplay,
  isAllowedSignedIntegerTyping,
  normalizeAmountInputRaw,
  parseSubmitAmount,
} from "@/utils/amountInput"
import { useUserInfo } from "@/contexts/UserInfoContext"

const THEME_COLOR = "#68A384"

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10)
}

interface EditTransactionModalProps {
  transaction: Transaction | null
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function EditTransactionModal({
  transaction,
  isOpen,
  onClose,
  onSuccess,
}: EditTransactionModalProps) {
  const { currentOperatorName } = useUserInfo()
  const [categories, setCategories] = useState<Category[]>([])
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])
  const [formData, setFormData] = useState({
    date: getTodayString(),
    category: "",
    accountTitle: "",
    amount: "",
    counterpartyAccountTitle: "",
    memo: "",
    receiptUrl: null as string | null,
  })

  useEffect(() => {
    if (!isOpen) return
    setCategories(getCategories())
    setAccountTitles(getAccountTitles())
  }, [isOpen])

  useEffect(() => {
    if (transaction && isOpen) {
      setFormData({
        date: transaction.date,
        category: transaction.category,
        accountTitle: transaction.accountTitle,
        amount: String(transaction.amount),
        counterpartyAccountTitle: transaction.counterparty,
        memo: transaction.memo ?? "",
        receiptUrl: transaction.receiptUrl,
      })
    }
  }, [transaction, isOpen])

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  )

  const cashAccountTitles = useMemo(
    () => accountTitles.filter((t) => t.group === "cash").sort((a, b) => a.order - b.order),
    [accountTitles]
  )

  const availableAccountTitles = useMemo(() => {
    if (!transaction) return []
    const group =
      transaction.type === "income" || transaction.type === "collection" ? "income" : "expense"
    let list = accountTitles.filter((t) => t.group === group)
    if (formData.category && formData.category !== "共通") {
      const cat = categories.find((c) => c.name === formData.category)
      if (cat) list = list.filter((t) => t.categoryIds.includes(cat.id))
    }
    const sorted = list.sort((a, b) => a.order - b.order)
    if (formData.accountTitle && !sorted.some((t) => t.name === formData.accountTitle)) {
      const current = accountTitles.find((t) => t.name === formData.accountTitle)
      if (current) return [current, ...sorted.filter((t) => t.id !== current.id)]
    }
    return sorted
  }, [accountTitles, transaction, formData.category, formData.accountTitle, categories])

  const canEdit = transaction && (transaction.type === "income" || transaction.type === "expense")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!transaction || !canEdit || isCsvLinkedTransaction(transaction)) return

    const amount = parseSubmitAmount(formData.amount)
    if (
      !formData.date ||
      !formData.category ||
      !formData.accountTitle ||
      !formData.counterpartyAccountTitle ||
      Number.isNaN(amount) ||
      amount === 0
    ) {
      alert("日付・カテゴリー・科目・入金先/出金元・金額を入力してください")
      return
    }

    const selectedAccount = accountTitles.find((t) => t.name === formData.accountTitle)
    const categoryToSave = selectedAccount?.group === "cash" ? "共通" : formData.category

    updateTransaction(transaction.id, {
      date: formData.date,
      type: transaction.type,
      amount,
      counterparty: formData.counterpartyAccountTitle,
      category: categoryToSave,
      accountTitle: formData.accountTitle,
      memo: formData.memo,
      receiptUrl: formData.receiptUrl,
      updatedBy: currentOperatorName,
    })

    alert("編集を保存しました")
    onSuccess?.()
    onClose()
  }

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, receiptUrl: (reader.result as string) ?? null }))
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  if (!isOpen) return null

  if (transaction && isCsvLinkedTransaction(transaction)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" aria-hidden onClick={onClose} />
        <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
          <p className="text-[#374151] font-medium">CSV取込の明細は個別編集できません</p>
          <p className="text-sm text-[#6B7280] mt-2">
            登録履歴の「CSV」タブ、または帳簿から、該当CSVの一括編集画面を開いてください。
          </p>
          <Button type="button" onClick={onClose} className="mt-4 w-full" variant="outline">
            閉じる
          </Button>
        </div>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" aria-hidden onClick={onClose} />
        <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
          <p className="text-[#6B7280]">
            この取引種別（{transaction?.type}）の編集は、入出金登録画面から行ってください。
          </p>
          <Button
            type="button"
            onClick={onClose}
            className="mt-4 w-full"
            variant="outline"
          >
            閉じる
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" aria-hidden onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-modal-title"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 id="edit-modal-title" className="text-lg font-semibold" style={{ color: THEME_COLOR }}>
            取引を編集
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#6B7280] hover:bg-gray-100 hover:text-[#374151]"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">日付</label>
              <DatePickerField
                value={formData.date}
                onChange={(v) => setFormData((prev) => ({ ...prev, date: v }))}
                themeColor={THEME_COLOR}
                className="w-full px-3 py-2 rounded-md"
                aria-label="日付"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">カテゴリー</label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, category: e.target.value, accountTitle: "" }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#68A384]"
                required
              >
                <option value="">選択してください</option>
                {sortedCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">科目</label>
              <select
                value={formData.accountTitle}
                onChange={(e) => setFormData((prev) => ({ ...prev, accountTitle: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#68A384]"
                required
              >
                <option value="">選択してください</option>
                {availableAccountTitles.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                {transaction?.type === "income" ? "入金先" : "出金元"}（現金・預金）
              </label>
              <select
                value={formData.counterpartyAccountTitle}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, counterpartyAccountTitle: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#68A384]"
                required
              >
                <option value="">選択してください</option>
                {cashAccountTitles.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">金額（円）</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={formatAmountInputDisplay(formData.amount)}
                  onChange={(e) => {
                    const raw = normalizeAmountInputRaw(e.target.value)
                    if (isAllowedSignedIntegerTyping(raw)) {
                      setFormData((prev) => ({ ...prev, amount: raw }))
                    }
                  }}
                  className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#68A384] text-right tabular-nums"
                  placeholder="0"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">メモ</label>
              <textarea
                value={formData.memo}
                onChange={(e) => setFormData((prev) => ({ ...prev, memo: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#68A384]"
                rows={2}
                placeholder="任意"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">レシート・証憑</label>
              <div className="flex items-center gap-3">
                {formData.receiptUrl ? (
                  <div className="flex items-center gap-2">
                    <img
                      src={formData.receiptUrl}
                      alt="証憑"
                      className="w-12 h-12 object-cover rounded border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, receiptUrl: null }))}
                      className="text-xs text-red-600 hover:underline"
                    >
                      削除
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-red-600">未登録</span>
                )}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleReceiptFileChange}
                  />
                  <span className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                    <ImageIcon className="h-4 w-4" />
                    画像を選択
                  </span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                className="flex-1 text-white"
                style={{ backgroundColor: THEME_COLOR }}
              >
                編集を保存する
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

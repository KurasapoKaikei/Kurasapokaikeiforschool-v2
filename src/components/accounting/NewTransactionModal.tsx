"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { DatePickerField } from "@/components/ui/date-picker-field"
import { X, ScanLine } from "lucide-react"
import {
  getCategories,
  getAccountTitles,
  addTransaction,
  type Category,
  type AccountTitle,
} from "@/utils/localStorage"

const THEME_COLOR = "#A3BC68"

type TabType = "income" | "expense"

const tabs: { id: TabType; label: string }[] = [
  { id: "income", label: "収入" },
  { id: "expense", label: "支出" },
]

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10)
}

interface NewTransactionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function NewTransactionModal({ isOpen, onClose, onSuccess }: NewTransactionModalProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])
  const [activeTab, setActiveTab] = useState<TabType>("income")
  const [formData, setFormData] = useState({
    date: getTodayString(),
    category: "",
    accountTitle: "",
    amount: "",
    counterpartyAccountTitle: "",
    memo: "",
  })

  useEffect(() => {
    if (!isOpen) return
    setCategories(getCategories())
    setAccountTitles(getAccountTitles())
    setFormData((prev) => ({ ...prev, date: getTodayString() }))
  }, [isOpen])

  useEffect(() => {
    const interval = setInterval(() => {
      setCategories(getCategories())
      setAccountTitles(getAccountTitles())
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  )

  const cashAccountTitles = useMemo(
    () => accountTitles.filter((t) => t.group === "cash").sort((a, b) => a.order - b.order),
    [accountTitles]
  )

  const availableAccountTitles = useMemo(() => {
    let list = accountTitles.filter((t) => t.group === activeTab)
    if (formData.category) {
      const selectedCat = categories.find((c) => c.name === formData.category)
      if (selectedCat) {
        list = list.filter((t) => t.categoryIds.includes(selectedCat.id))
      }
    }
    return list.sort((a, b) => a.order - b.order)
  }, [accountTitles, activeTab, formData.category, categories])

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setFormData((prev) => ({ ...prev, accountTitle: "", category: prev.category }))
  }

  const handleCategoryChange = (value: string) => {
    setFormData((prev) => ({ ...prev, category: value, accountTitle: "" }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const amount = parseFloat(formData.amount)
    if (!formData.date || !formData.category || !formData.accountTitle || !formData.counterpartyAccountTitle || Number.isNaN(amount) || amount <= 0) {
      alert("日付・カテゴリー・科目・入金先/出金元・金額（0より大きい数値）を入力してください。")
      return
    }

    const selectedAccount = accountTitles.find((t) => t.name === formData.accountTitle)
    const categoryToSave = selectedAccount?.group === "cash" ? "共通" : formData.category

    addTransaction({
      date: formData.date,
      type: activeTab,
      amount,
      counterparty: formData.counterpartyAccountTitle,
      category: categoryToSave,
      accountTitle: formData.accountTitle,
      memo: formData.memo,
      receiptUrl: null,
    })

    alert("登録しました")
    onSuccess?.()
    onClose()
    setFormData({
      date: getTodayString(),
      category: "",
      accountTitle: "",
      amount: "",
      counterpartyAccountTitle: "",
      memo: "",
    })
  }

  const handleClose = () => {
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden
        onClick={handleClose}
      />
      <div
        className="relative w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 id="modal-title" className="text-lg font-semibold text-[#374151]">
            入出金 新規登録
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-[#6B7280] hover:bg-gray-100 hover:text-[#374151]"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* タブ: 収入 / 支出 */}
            <div>
              <span className="block text-sm font-medium text-[#374151] mb-2">種別</span>
              <div className="flex gap-2 border-b border-gray-200">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      activeTab === tab.id
                        ? "border-[#A3BC68] text-[#A3BC68]"
                        : "border-transparent text-[#6B7280] hover:text-[#374151]"
                    }`}
                    style={activeTab === tab.id ? { borderColor: THEME_COLOR, color: THEME_COLOR } : {}}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 日付（デフォルト当日） */}
            <div>
              <label htmlFor="modal-date" className="block text-sm font-medium text-[#374151] mb-2">
                日付 <span className="text-[#EF4444]">*</span>
              </label>
              <DatePickerField
                id="modal-date"
                value={formData.date}
                onChange={(v) => setFormData((prev) => ({ ...prev, date: v }))}
                themeColor={THEME_COLOR}
                className="w-full px-3 py-2 rounded-md"
                aria-label="日付"
              />
            </div>

            {/* カテゴリー（何の） */}
            <div>
              <label htmlFor="modal-category" className="block text-sm font-medium text-[#374151] mb-2">
                カテゴリー（何の） <span className="text-[#EF4444]">*</span>
              </label>
              <select
                id="modal-category"
                value={formData.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#A3BC68] focus:border-transparent"
                required
              >
                <option value="">選択してください</option>
                {sortedCategories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 科目（何） */}
            <div>
              <label htmlFor="modal-accountTitle" className="block text-sm font-medium text-[#374151] mb-2">
                科目（何） <span className="text-[#EF4444]">*</span>
              </label>
              <select
                id="modal-accountTitle"
                value={formData.accountTitle}
                onChange={(e) => setFormData((prev) => ({ ...prev, accountTitle: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#A3BC68] focus:border-transparent"
                required
              >
                <option value="">選択してください</option>
                {availableAccountTitles.map((title) => (
                  <option key={title.id} value={title.name}>
                    {title.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 金額 */}
            <div>
              <label htmlFor="modal-amount" className="block text-sm font-medium text-[#374151] mb-2">
                金額 <span className="text-[#EF4444]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#374151]">¥</span>
                <input
                  type="number"
                  id="modal-amount"
                  value={formData.amount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#A3BC68] focus:border-transparent"
                  placeholder="0"
                  min="1"
                  step="1"
                  required
                />
              </div>
            </div>

            {/* 入金先 / 出金元（どこに/どこから） */}
            <div>
              <label htmlFor="modal-counterparty" className="block text-sm font-medium text-[#374151] mb-2">
                {activeTab === "income" ? "入金先（どこに）" : "出金元（どこから）"} <span className="text-[#EF4444]">*</span>
              </label>
              <select
                id="modal-counterparty"
                value={formData.counterpartyAccountTitle}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, counterpartyAccountTitle: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#A3BC68] focus:border-transparent"
                required
              >
                <option value="">選択してください</option>
                {cashAccountTitles.map((title) => (
                  <option key={title.id} value={title.name}>
                    {title.name}
                  </option>
                ))}
              </select>
            </div>

            {/* メモ */}
            <div>
              <label htmlFor="modal-memo" className="block text-sm font-medium text-[#374151] mb-2">
                メモ
              </label>
              <textarea
                id="modal-memo"
                value={formData.memo}
                onChange={(e) => setFormData((prev) => ({ ...prev, memo: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#A3BC68] focus:border-transparent"
                rows={2}
                placeholder="任意"
              />
            </div>

            {/* レシート読み取り（スペース確保） */}
            <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/50 p-4">
              <p className="text-sm text-[#6B7280] mb-2">レシート・証憑</p>
              <Button
                type="button"
                variant="outline"
                className="w-full border-gray-300 text-[#374151] hover:bg-gray-100"
                disabled
              >
                <ScanLine className="mr-2 h-4 w-4" />
                レシート読み取り（準備中）
              </Button>
            </div>

            {/* 登録ボタン */}
            <div className="pt-2">
              <Button
                type="submit"
                className="w-full text-white"
                style={{ backgroundColor: THEME_COLOR }}
              >
                登録
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

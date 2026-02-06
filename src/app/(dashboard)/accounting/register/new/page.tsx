"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { DatePickerField } from "@/components/ui/date-picker-field"
import { Loader2, Camera } from "lucide-react"
import {
  getCategories,
  getAccountTitles,
  getTransactions,
  addTransaction,
  type Category,
  type AccountTitle,
  type Transaction,
} from "@/utils/localStorage"
import { mockMembers } from "@/constants/mockData"

const THEME_COLOR = "#A3BC68"

type TabType = "income" | "expense" | "transfer" | "collection" | "deferred"

const tabs: { id: TabType; label: string }[] = [
  { id: "income", label: "収入" },
  { id: "expense", label: "支出" },
  { id: "transfer", label: "振替" },
  { id: "collection", label: "集金" },
  { id: "deferred", label: "繰延（計上・消込）" },
]

const DEFERRED_ACCOUNTS = [
  { value: "未収入金", type: "asset" as const },
  { value: "仮払金", type: "asset" as const },
  { value: "未払金", type: "liability" as const },
  { value: "仮受金", type: "liability" as const },
] as const

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function NewRegisterPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [activeTab, setActiveTab] = useState<TabType>("income")
  const [ocrLoading, setOcrLoading] = useState(false)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({
    date: getTodayString(),
    category: "",
    accountTitle: "",
    amount: "",
    counterpartyAccountTitle: "",
    fromAccountTitle: "",
    toAccountTitle: "",
    memberId: "",
    memo: "",
    deferredType: "record" as "record" | "settlement",
    deferredAccount: "",
    deferredSettlementId: "",
    deferredCounterparty: "",
    deferredSettlementAccount: "",
  })

  useEffect(() => {
    setCategories(getCategories())
    setAccountTitles(getAccountTitles())
    setTransactions(getTransactions())
    setFormData((prev) => ({ ...prev, date: getTodayString() }))
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

  const cashAccountTitles = useMemo(
    () => accountTitles.filter((t) => t.group === "cash").sort((a, b) => a.order - b.order),
    [accountTitles]
  )

  const availableAccountTitles = useMemo(() => {
    if (activeTab === "income") {
      let list = accountTitles.filter((t) => t.group === "income")
      if (formData.category) {
        const cat = categories.find((c) => c.name === formData.category)
        if (cat) list = list.filter((t) => t.categoryIds.includes(cat.id))
      }
      return list.sort((a, b) => a.order - b.order)
    }
    if (activeTab === "expense") {
      let list = accountTitles.filter((t) => t.group === "expense")
      if (formData.category) {
        const cat = categories.find((c) => c.name === formData.category)
        if (cat) list = list.filter((t) => t.categoryIds.includes(cat.id))
      }
      return list.sort((a, b) => a.order - b.order)
    }
    return []
  }, [accountTitles, activeTab, formData.category, categories])

  const activeMembers = useMemo(() => mockMembers.filter((m) => m.isActive), [])

  const deferredSettlementList = useMemo(
    () =>
      transactions.filter(
        (t) => t.type === "deferred" && t.counterparty === "record"
      ),
    [transactions]
  )

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setFormData((prev) => ({
      ...prev,
      accountTitle: "",
      counterpartyAccountTitle: "",
      fromAccountTitle: "",
      toAccountTitle: "",
      memberId: "",
      deferredAccount: "",
      deferredSettlementId: "",
      deferredCounterparty: "",
      deferredSettlementAccount: "",
    }))
  }

  const handleCategoryChange = (value: string) => {
    setFormData((prev) => ({ ...prev, category: value, accountTitle: "" }))
  }

  const handleOcrClick = () => {
    fileInputRef.current?.click()
  }

  const handleOcrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setOcrLoading(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string) ?? "")
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      setReceiptPreview(base64)
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || "OCRに失敗しました")
      }
      const data = await res.json()
      setFormData((prev) => ({
        ...prev,
        date: data.date || prev.date,
        amount: data.amount > 0 ? String(data.amount) : prev.amount,
        memo: data.description || prev.memo,
        accountTitle:
          data.accountTitle &&
          availableAccountTitles.some((t) => t.name === data.accountTitle)
            ? data.accountTitle
            : prev.accountTitle,
      }))
    } catch (err) {
      alert(err instanceof Error ? err.message : "レシートの読み取りに失敗しました")
    } finally {
      setOcrLoading(false)
      e.target.value = ""
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (activeTab === "transfer") {
      if (
        !formData.date ||
        !formData.fromAccountTitle ||
        !formData.toAccountTitle ||
        formData.fromAccountTitle === formData.toAccountTitle
      ) {
        alert("日付・出金元・入金先を正しく選択してください")
        return
      }
      const amount = parseFloat(formData.amount)
      if (Number.isNaN(amount) || amount <= 0) {
        alert("金額を0より大きい数値で入力してください")
        return
      }
      addTransaction({
        date: formData.date,
        type: "expense",
        amount,
        counterparty: formData.toAccountTitle,
        category: "",
        accountTitle: formData.fromAccountTitle,
        memo: `振替: ${formData.memo || ""}`,
        receiptUrl: receiptPreview,
      })
      addTransaction({
        date: formData.date,
        type: "income",
        amount,
        counterparty: formData.fromAccountTitle,
        category: "",
        accountTitle: formData.toAccountTitle,
        memo: `振替: ${formData.memo || ""}`,
        receiptUrl: receiptPreview,
      })
      alert("振替を登録しました")
      resetForm()
      return
    }

    if (activeTab === "collection") {
      if (!formData.date || !formData.memberId || !formData.counterpartyAccountTitle) {
        alert("日付・誰から・入金先を入力してください")
        return
      }
      const amount = parseFloat(formData.amount)
      if (Number.isNaN(amount) || amount <= 0) {
        alert("金額を0より大きい数値で入力してください")
        return
      }
      const member = activeMembers.find((m) => m.id === formData.memberId)
      const accountTitle =
        accountTitles.find((t) => t.group === "income")?.name ?? "集金収入"
      addTransaction({
        date: formData.date,
        type: "collection",
        amount,
        counterparty: formData.counterpartyAccountTitle,
        category: "共通",
        accountTitle,
        memo: member ? `集金: ${member.name}` : formData.memo,
        receiptUrl: receiptPreview,
      })
      alert("集金を登録しました")
      resetForm()
      return
    }

    if (activeTab === "deferred") {
      if (!formData.date || !formData.amount) {
        alert("日付と金額を入力してください")
        return
      }
      const amount = parseFloat(formData.amount)
      if (Number.isNaN(amount) || amount <= 0) {
        alert("金額を0より大きい数値で入力してください")
        return
      }
      if (formData.deferredType === "record") {
        if (!formData.deferredAccount) {
          alert("科目を選択してください")
          return
        }
        const counterpartyLabel = formData.deferredCounterparty
          ? `相手先: ${formData.deferredCounterparty}`
          : ""
        addTransaction({
          date: formData.date,
          type: "deferred",
          amount,
          counterparty: "record",
          category: DEFERRED_ACCOUNTS.find((a) => a.value === formData.deferredAccount)?.type ?? "asset",
          accountTitle: formData.deferredAccount,
          memo: [counterpartyLabel, formData.memo].filter(Boolean).join(" / ") || "計上",
          receiptUrl: null,
        })
        alert("繰延（計上）を登録しました")
      } else {
        if (!formData.deferredSettlementId) {
          alert("精算する繰延項目を選択してください")
          return
        }
        if (!formData.deferredSettlementAccount) {
          alert("決済口座を選択してください")
          return
        }
        const source = transactions.find((t) => t.id === formData.deferredSettlementId)
        if (!source) {
          alert("選択した繰延項目が見つかりません")
          return
        }
        addTransaction({
          date: formData.date,
          type: "deferred",
          amount,
          counterparty: formData.deferredSettlementAccount,
          category: source.category,
          accountTitle: source.accountTitle,
          memo: `消込: ${formData.memo || ""}`,
          receiptUrl: null,
        })
        alert("繰延（消込）を登録しました")
      }
      resetForm()
      return
    }

    const amount = parseFloat(formData.amount)
    if (
      !formData.date ||
      !formData.category ||
      !formData.accountTitle ||
      !formData.counterpartyAccountTitle ||
      Number.isNaN(amount) ||
      amount <= 0
    ) {
      alert("日付・カテゴリー・科目・入金先/出金元・金額を入力してください")
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
      receiptUrl: receiptPreview ?? null,
    })

    alert("登録しました")
    resetForm()
  }

  function resetForm() {
    setFormData({
      date: getTodayString(),
      category: "",
      accountTitle: "",
      amount: "",
      counterpartyAccountTitle: "",
      fromAccountTitle: "",
      toAccountTitle: "",
      memberId: "",
      memo: "",
      deferredType: "record",
      deferredAccount: "",
      deferredSettlementId: "",
      deferredCounterparty: "",
      deferredSettlementAccount: "",
    })
    setReceiptPreview(null)
  }

  const showReceiptArea = activeTab === "income" || activeTab === "expense"

  const showCategory = activeTab === "income" || activeTab === "expense"
  const showSubject = activeTab === "income" || activeTab === "expense"
  const showTransferFields = activeTab === "transfer"
  const showCollectionFields = activeTab === "collection"
  const showDeferredFields = activeTab === "deferred"

  const inputClass =
    "w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A3BC68] focus:border-transparent bg-white text-[#374151]"
  const labelClass = "block text-sm font-medium text-[#374151] mb-1.5"

  return (
    <div className="w-full min-h-screen bg-[#F5F5F0] flex flex-col pt-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleOcrFileChange}
      />

      {/* 5タブ（画面幅いっぱい・等幅・タブ間に隙間） */}
      <div className="flex-shrink-0 w-full px-4 pb-2">
        <div className="flex w-full gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 min-w-0 px-2 py-3.5 text-sm font-semibold transition-all whitespace-nowrap rounded-lg ${
                activeTab === tab.id
                  ? "bg-[#4B5563] text-white shadow-md"
                  : "bg-[#A3BC68]/25 text-[#374151] hover:bg-[#A3BC68]/35"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* タブに応じたレイアウト: 収入/支出=2カラム、それ以外=1カラム（レシートなし） */}
      <div
        className={`flex-1 grid gap-0 min-h-0 transition-[grid-template-columns] duration-300 ${
          showReceiptArea ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
        }`}
      >
        {/* 入力フォーム（1カラム時は中央配置） */}
        <div
          className={`overflow-y-auto bg-white ${
            showReceiptArea ? "border-r border-gray-200" : "flex justify-center"
          }`}
        >
          <div className={`p-6 ${showReceiptArea ? "max-w-lg" : "w-full max-w-lg"}`}>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 1. 日付（繰延・消込時は「入出金日付」） */}
              <div>
                <label htmlFor="date" className={labelClass}>
                  {activeTab === "deferred" && formData.deferredType === "settlement"
                    ? "入出金日付"
                    : "日付"}
                </label>
                <DatePickerField
                  id="date"
                  value={formData.date}
                  onChange={(v) => setFormData((prev) => ({ ...prev, date: v }))}
                  themeColor={THEME_COLOR}
                  className={inputClass}
                  aria-label={activeTab === "deferred" && formData.deferredType === "settlement" ? "入出金日付" : "日付"}
                />
              </div>

              {/* 2. 決済手段（日付の直後）：収入=入金先 / 支出=出金元 / 振替=出金元→入金先 */}
              {(activeTab === "income" || activeTab === "expense") && (
                <div>
                  <label htmlFor="counterparty" className={labelClass}>
                    {activeTab === "income"
                      ? "入金先（現金・預金科目）"
                      : "出金元（現金・預金科目）"}
                  </label>
                  <select
                    id="counterparty"
                    value={formData.counterpartyAccountTitle}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        counterpartyAccountTitle: e.target.value,
                      }))
                    }
                    className={inputClass}
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
              )}

              {showTransferFields && (
                <div className="rounded-lg border border-[#A3BC68]/30 bg-[#A3BC68]/5 p-4">
                  <p className="text-sm font-medium text-[#374151] mb-3">振替先（出金元 → 入金先）</p>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label htmlFor="fromAccountTitle" className={labelClass}>
                        出金元（From）
                      </label>
                      <select
                        id="fromAccountTitle"
                        value={formData.fromAccountTitle}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, fromAccountTitle: e.target.value }))
                        }
                        className={inputClass}
                        required
                      >
                        <option value="">選択</option>
                        {cashAccountTitles.map((title) => (
                          <option key={title.id} value={title.name}>
                            {title.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-shrink-0 pb-2.5 text-[#374151] font-semibold" aria-hidden>
                      →
                    </div>
                    <div className="flex-1">
                      <label htmlFor="toAccountTitle" className={labelClass}>
                        入金先（To）
                      </label>
                      <select
                        id="toAccountTitle"
                        value={formData.toAccountTitle}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, toAccountTitle: e.target.value }))
                        }
                        className={inputClass}
                        required
                      >
                        <option value="">選択</option>
                        {cashAccountTitles.map((title) => (
                          <option key={title.id} value={title.name}>
                            {title.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {showCollectionFields && (
                <>
                  <div>
                    <label htmlFor="memberId" className={labelClass}>
                      誰から
                    </label>
                    <select
                      id="memberId"
                      value={formData.memberId}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, memberId: e.target.value }))
                      }
                      className={inputClass}
                      required
                    >
                      <option value="">選択してください</option>
                      {activeMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="counterparty-collection" className={labelClass}>
                      入金先（現金・預金科目）
                    </label>
                    <select
                      id="counterparty-collection"
                      value={formData.counterpartyAccountTitle}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          counterpartyAccountTitle: e.target.value,
                        }))
                      }
                      className={inputClass}
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
                </>
              )}

              {showCategory && (
                <div>
                  <label htmlFor="category" className={labelClass}>
                    カテゴリー
                  </label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className={inputClass}
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
              )}

              {showSubject && (
                <div>
                  <label htmlFor="accountTitle" className={labelClass}>
                    科目
                  </label>
                  <select
                    id="accountTitle"
                    value={formData.accountTitle}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, accountTitle: e.target.value }))
                    }
                    className={inputClass}
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
              )}

              {showDeferredFields && (
                <>
                  <div>
                    <label className={labelClass}>処理区分</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="deferredType"
                          value="record"
                          checked={formData.deferredType === "record"}
                          onChange={() =>
                            setFormData((prev) => ({
                              ...prev,
                              deferredType: "record",
                              deferredSettlementId: "",
                              deferredSettlementAccount: "",
                            }))
                          }
                          className="text-[#A3BC68] focus:ring-[#A3BC68]"
                        />
                        <span className="text-sm text-[#374151]">計上</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="deferredType"
                          value="settlement"
                          checked={formData.deferredType === "settlement"}
                          onChange={() =>
                            setFormData((prev) => ({
                              ...prev,
                              deferredType: "settlement",
                              deferredAccount: "",
                              deferredCounterparty: "",
                            }))
                          }
                          className="text-[#A3BC68] focus:ring-[#A3BC68]"
                        />
                        <span className="text-sm text-[#374151]">消込</span>
                      </label>
                    </div>
                  </div>
                  {formData.deferredType === "record" ? (
                    <>
                      <div>
                        <label htmlFor="deferredAccount" className={labelClass}>
                          科目
                        </label>
                        <select
                          id="deferredAccount"
                          value={formData.deferredAccount}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, deferredAccount: e.target.value }))
                          }
                          className={inputClass}
                          required={formData.deferredType === "record"}
                        >
                          <option value="">選択してください</option>
                          {DEFERRED_ACCOUNTS.map((a) => (
                            <option key={a.value} value={a.value}>
                              {a.value}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="deferredCounterparty" className={labelClass}>
                          相手先
                        </label>
                        <input
                          type="text"
                          id="deferredCounterparty"
                          value={formData.deferredCounterparty}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              deferredCounterparty: e.target.value,
                            }))
                          }
                          className={inputClass}
                          placeholder="任意"
                          lang="ja"
                          autoComplete="off"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label htmlFor="deferredSettlement" className={labelClass}>
                          精算する繰延項目
                        </label>
                        <select
                          id="deferredSettlement"
                          value={formData.deferredSettlementId}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              deferredSettlementId: e.target.value,
                            }))
                          }
                          className={inputClass}
                          required={formData.deferredType === "settlement"}
                        >
                          <option value="">選択してください</option>
                          {deferredSettlementList.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.accountTitle} {Number(t.amount).toLocaleString()}円（{t.date}）
                            </option>
                          ))}
                        </select>
                        {deferredSettlementList.length === 0 && (
                          <p className="text-xs text-[#6B7280] mt-1">
                            精算待ちの繰延項目がありません
                          </p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="deferredSettlementAccount" className={labelClass}>
                          決済口座（現金・預金科目）
                        </label>
                        <select
                          id="deferredSettlementAccount"
                          value={formData.deferredSettlementAccount}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              deferredSettlementAccount: e.target.value,
                            }))
                          }
                          className={inputClass}
                          required={formData.deferredType === "settlement"}
                        >
                          <option value="">選択してください</option>
                          {cashAccountTitles.map((title) => (
                            <option key={title.id} value={title.name}>
                              {title.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-[#6B7280] mt-1">
                          実際の入出金があった口座を選択してください
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}

              <div>
                <label htmlFor="amount" className={labelClass}>
                  金額（円）
                </label>
                <input
                  type="text"
                  id="amount"
                  value={formData.amount ? Number(formData.amount).toLocaleString() : ""}
                  onChange={(e) => {
                    // カンマを除去して数値のみを保存
                    const rawValue = e.target.value.replace(/,/g, "")
                    if (rawValue === "" || /^\d+$/.test(rawValue)) {
                      setFormData((prev) => ({ ...prev, amount: rawValue }))
                    }
                  }}
                  className={`px-4 py-4 text-xl font-semibold text-right tabular-nums ${inputClass}`}
                  placeholder="0"
                  inputMode="numeric"
                  autoComplete="off"
                  lang="en"
                  required={
                    showCategory ||
                    showTransferFields ||
                    showCollectionFields ||
                    showDeferredFields
                  }
                />
              </div>

              <div>
                <label htmlFor="memo" className={labelClass}>
                  メモ
                </label>
                <textarea
                  id="memo"
                  value={formData.memo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, memo: e.target.value }))}
                  className={`${inputClass} resize-none`}
                  rows={3}
                  placeholder="任意"
                  lang="ja"
                  autoComplete="off"
                />
              </div>

              <Button
                type="submit"
                className="w-full py-6 text-base font-semibold text-white rounded-lg"
                style={{ backgroundColor: THEME_COLOR }}
              >
                登録する
              </Button>
            </form>
          </div>
        </div>

        {/* 右: レシート撮影・表示（収入/支出タブのみ表示） */}
        {showReceiptArea && (
          <div className="bg-gray-50 border-l border-gray-200 flex flex-col min-h-0">
            <div className="p-6 flex-1 flex flex-col min-h-0">
              <h3 className="text-sm font-semibold text-[#374151] mb-3">
                レシート・証憑
              </h3>
              <Button
                type="button"
                variant="outline"
                onClick={handleOcrClick}
                disabled={ocrLoading}
                className="w-full border-[#A3BC68] text-[#374151] hover:bg-[#A3BC68]/10 h-12 mb-4"
              >
                {ocrLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="mr-2 h-5 w-5" />
                )}
                撮影してOCR解析（左フォームに反映）
              </Button>
              <p className="text-xs text-[#6B7280] mb-4">
                画像と左の入力内容を突き合わせ、修正後に「登録する」を押してください
              </p>
              <div className="flex-1 min-h-[200px] rounded-lg border-2 border-dashed border-gray-200 bg-white overflow-hidden">
                {receiptPreview ? (
                  <img
                    src={receiptPreview}
                    alt="レシート"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#9CA3AF] text-sm">
                    レシートを撮影・アップロードするとここに表示されます
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DatePickerField } from "@/components/ui/date-picker-field"
import { Loader2, Camera, CheckCircle2, Search } from "lucide-react"
import {
  getCategories,
  getAccountTitles,
  getTransactions,
  addTransaction,
  getMembers,
  getCollectionSchedules,
  getCollectionRecords,
  syncAllCollectionRecords,
  updateCollectionRecord,
  type Category,
  type AccountTitle,
  type Transaction,
  type Member,
  type CollectionSchedule,
  type CollectionRecord,
  type CollectionPaymentStatus,
} from "@/utils/localStorage"
import { COLLECTION_STATUS_BADGE, getCollectionPaymentStatus } from "@/types"

const THEME_COLOR = "#A3BC68"
const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const
const GRADE_LABELS: Record<number, string> = { 1: "1年生", 2: "2年生", 3: "3年生", 4: "4年生" }

function getCurrentFiscalMonth(): number {
  return new Date().getMonth() + 1
}

function getFiscalStartYear(): number {
  const now = new Date()
  return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1
}

function monthToYYYYMM(fiscalStartYear: number, month: number): string {
  const y = month >= 4 ? fiscalStartYear : fiscalStartYear + 1
  return `${y}-${String(month).padStart(2, "0")}`
}

const fmtNum = (n: number): string => n.toLocaleString()

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
  const searchParams = useSearchParams()
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

  // ===== 集金タブ用 state =====
  const [colMembers, setColMembers] = useState<Member[]>([])
  const [colSchedules, setColSchedules] = useState<CollectionSchedule[]>([])
  const [colRecords, setColRecords] = useState<CollectionRecord[]>([])
  const [colMonth, setColMonth] = useState<number>(getCurrentFiscalMonth())
  const [colGrade, setColGrade] = useState<number | "all">("all")
  const [colSearch, setColSearch] = useState("")
  const [colBulkDate, setColBulkDate] = useState(getTodayString())
  const [colPayments, setColPayments] = useState<Record<string, { amount: string; date: string; memo: string }>>({})
  const [colHistoryEditing, setColHistoryEditing] = useState<Record<string, { amount: string; date: string; memo: string }>>({})
  const [colSuccess, setColSuccess] = useState<string | null>(null)
  const [colHistoryMap, setColHistoryMap] = useState<Record<string, { id: string; amount: number; date: string; memo: string }[]>>({})
  const [colFocusedMemberId, setColFocusedMemberId] = useState<string | null>(null)
  const memberRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})
  const deepLinkInitDoneRef = useRef(false)
  const deepLinkScrollDoneRef = useRef(false)

  const reloadCollectionData = useCallback(() => {
    syncAllCollectionRecords()
    setColMembers(getMembers())
    setColSchedules(getCollectionSchedules())
    setColRecords(getCollectionRecords())
  }, [])

  const setMemberRowRef = useCallback(
    (memberId: string) => (el: HTMLTableRowElement | null) => {
      memberRowRefs.current[memberId] = el
    },
    []
  )

  const deepLinkParams = useMemo(() => {
    const tab = searchParams.get("tab")
    const memberId = searchParams.get("memberId")
    const monthRaw = searchParams.get("month")
    const month = monthRaw ? Number(monthRaw) : NaN
    const validMonth = Number.isFinite(month) && FISCAL_MONTHS.includes(month as (typeof FISCAL_MONTHS)[number])
    return {
      tab,
      memberId: memberId ?? "",
      month: validMonth ? month : null,
    }
  }, [searchParams])

  useEffect(() => {
    if (activeTab === "collection") reloadCollectionData()
  }, [activeTab, reloadCollectionData])

  useEffect(() => {
    if (deepLinkInitDoneRef.current) return
    if (deepLinkParams.tab !== "collection") return
    setActiveTab("collection")
    if (deepLinkParams.month !== null) setColMonth(deepLinkParams.month)
    deepLinkInitDoneRef.current = true
  }, [deepLinkParams])

  useEffect(() => {
    if (activeTab !== "collection") return
    const interval = setInterval(reloadCollectionData, 500)
    return () => clearInterval(interval)
  }, [activeTab, reloadCollectionData])

  useEffect(() => {
    if (activeTab !== "collection") return
    if (deepLinkScrollDoneRef.current) return
    if (!deepLinkParams.memberId) return
    const target = memberRowRefs.current[deepLinkParams.memberId]
    if (!target) return

    target.scrollIntoView({ behavior: "smooth", block: "center" })
    setColFocusedMemberId(deepLinkParams.memberId)
    window.setTimeout(() => {
      setColFocusedMemberId((prev) => (prev === deepLinkParams.memberId ? null : prev))
    }, 2400)
    deepLinkScrollDoneRef.current = true
  }, [activeTab, deepLinkParams.memberId, colMonth, colMembers, colSchedules, colRecords, colHistoryMap, colGrade, colSearch])

  useEffect(() => {
    setColPayments({})
    setColHistoryEditing({})
  }, [colMonth])

  const fiscalStartYear = getFiscalStartYear()

  const colTargetYYYYMM = useMemo(() => monthToYYYYMM(fiscalStartYear, colMonth), [fiscalStartYear, colMonth])

  const colMonthSchedules = useMemo(() => {
    return colSchedules.filter((s) => s.targetMonth === colTargetYYYYMM)
  }, [colSchedules, colTargetYYYYMM])

  const colActiveMembers = useMemo(() => {
    return colMembers.filter((m) => m.status === "active")
  }, [colMembers])

  const colFilteredMembers = useMemo(() => {
    let list = colActiveMembers
    if (colGrade !== "all") list = list.filter((m) => m.grade === colGrade)
    if (colSearch.trim()) {
      const q = colSearch.trim().toLowerCase()
      list = list.filter((m) => m.name.toLowerCase().includes(q))
    }
    return list.sort((a, b) => {
      if (a.grade !== b.grade) return b.grade - a.grade
      return a.name.localeCompare(b.name, "ja")
    })
  }, [colActiveMembers, colGrade, colSearch])

  const getPaymentRow = (memberId: string) => {
    return colPayments[memberId] ?? { amount: "", date: colBulkDate, memo: "" }
  }

  const setPaymentRow = (memberId: string, updates: Partial<{ amount: string; date: string; memo: string }>) => {
    setColPayments((prev) => ({
      ...prev,
      [memberId]: { ...getPaymentRow(memberId), ...updates },
    }))
  }

  const getExpectedAmount = useCallback((memberId: string) => {
    return colMonthSchedules
      .filter((s) => (s.memberIds && s.memberIds.length > 0 ? s.memberIds.includes(memberId) : true))
      .reduce((sum, s) => sum + s.amount, 0)
  }, [colMonthSchedules])

  const getHistoryKey = useCallback((memberId: string) => `${colTargetYYYYMM}_${memberId}`, [colTargetYYYYMM])

  const getMemberHistory = useCallback((memberId: string) => {
    return colHistoryMap[getHistoryKey(memberId)] ?? []
  }, [colHistoryMap, getHistoryKey])

  const getTotalPaid = useCallback((memberId: string) => {
    return getMemberHistory(memberId).reduce((sum, h) => sum + h.amount, 0)
  }, [getMemberHistory])

  const getStatus = useCallback((memberId: string) => {
    const expected = getExpectedAmount(memberId)
    const paid = getTotalPaid(memberId)
    return getCollectionPaymentStatus(paid, expected)
  }, [getExpectedAmount, getTotalPaid])

  const toCollectionStatus = useCallback(
    (paid: number, expected: number): CollectionPaymentStatus => {
      if (expected <= 0) return paid > 0 ? "OVERPAID" : "UNPAID"
      if (paid <= 0) return "UNPAID"
      if (paid < expected) return "PARTIALLY_PAID"
      if (paid > expected) return "OVERPAID"
      return "COMPLETED"
    },
    []
  )

  const persistMemberCollectionState = useCallback(
    (memberId: string, history: { id: string; amount: number; date: string; memo: string }[]) => {
      const schedules = colMonthSchedules
        .filter((s) => (s.memberIds && s.memberIds.length > 0 ? s.memberIds.includes(memberId) : true))
        .sort((a, b) => a.id.localeCompare(b.id))
      if (schedules.length === 0) return

      const records = getCollectionRecords()
      const recordBySchedule = new Map<string, CollectionRecord>()
      records.forEach((r) => {
        if (r.memberId === memberId) recordBySchedule.set(r.scheduleId, r)
      })

      const paidByIndex = schedules.map(() => 0)
      const historyByIndex: Array<{ amount: number; date: string; memo: string; transactionId: string }[]> = schedules.map(() => [])

      for (const entry of history) {
        if (entry.amount >= 0) {
          let remain = entry.amount
          for (let i = 0; i < schedules.length; i++) {
            if (remain <= 0) break
            const cap = i === schedules.length - 1 ? Number.POSITIVE_INFINITY : Math.max(0, schedules[i].amount - paidByIndex[i])
            const alloc = Math.min(remain, cap)
            if (alloc <= 0) continue
            paidByIndex[i] += alloc
            historyByIndex[i].push({
              amount: alloc,
              date: entry.date,
              memo: entry.memo,
              transactionId: entry.id,
            })
            remain -= alloc
          }
        } else {
          let refund = Math.abs(entry.amount)
          for (let i = schedules.length - 1; i >= 0; i--) {
            if (refund <= 0) break
            const cap = i === schedules.length - 1 ? Number.POSITIVE_INFINITY : Math.max(0, paidByIndex[i])
            const deduct = Math.min(refund, cap)
            if (deduct <= 0) continue
            paidByIndex[i] -= deduct
            historyByIndex[i].push({
              amount: -deduct,
              date: entry.date,
              memo: entry.memo,
              transactionId: entry.id,
            })
            refund -= deduct
          }
          if (refund > 0 && schedules.length > 0) {
            const last = schedules.length - 1
            paidByIndex[last] -= refund
            historyByIndex[last].push({
              amount: -refund,
              date: entry.date,
              memo: entry.memo,
              transactionId: entry.id,
            })
          }
        }
      }

      schedules.forEach((s, i) => {
        const rec = recordBySchedule.get(s.id)
        if (!rec) return
        const paid = paidByIndex[i]
        updateCollectionRecord(rec.id, {
          paidAmount: paid,
          paidAt: historyByIndex[i].length > 0 ? historyByIndex[i][historyByIndex[i].length - 1].date : null,
          linkedTransactionId: historyByIndex[i].length > 0 ? historyByIndex[i][historyByIndex[i].length - 1].transactionId : null,
          paymentHistory: historyByIndex[i],
          status: toCollectionStatus(paid, s.amount),
        })
      })
    },
    [colMonthSchedules, toCollectionStatus]
  )

  useEffect(() => {
    const next: Record<string, { id: string; amount: number; date: string; memo: string }[]> = {}
    const schedulesByMember = new Map<string, CollectionSchedule[]>()
    for (const schedule of colMonthSchedules) {
      if (schedule.memberIds && schedule.memberIds.length > 0) {
        schedule.memberIds.forEach((memberId) => {
          const list = schedulesByMember.get(memberId) ?? []
          list.push(schedule)
          schedulesByMember.set(memberId, list)
        })
      } else {
        colActiveMembers.forEach((member) => {
          const list = schedulesByMember.get(member.id) ?? []
          list.push(schedule)
          schedulesByMember.set(member.id, list)
        })
      }
    }

    for (const member of colActiveMembers) {
      const targetSchedules = schedulesByMember.get(member.id) ?? []
      const allEntries = targetSchedules.flatMap((s) => {
        const rec = colRecords.find((r) => r.scheduleId === s.id && r.memberId === member.id)
        if (!rec) return []
        const history = rec.paymentHistory ?? []
        if (history.length > 0) return history
        const fallback = rec.paidAmount ?? 0
        if (fallback === 0) return []
        return [
          {
            amount: fallback,
            date: rec.paidAt ?? getTodayString(),
            memo: "",
            transactionId: rec.linkedTransactionId ?? rec.id,
          },
        ]
      })

      const mergedByTx = new Map<string, { id: string; amount: number; date: string; memo: string }>()
      for (const h of allEntries) {
        const key = h.transactionId || `${h.date}_${h.amount}`
        const prev = mergedByTx.get(key)
        if (prev) {
          mergedByTx.set(key, {
            ...prev,
            amount: prev.amount + h.amount,
          })
        } else {
          mergedByTx.set(key, {
            id: key,
            amount: h.amount,
            date: h.date,
            memo: h.memo,
          })
        }
      }
      next[getHistoryKey(member.id)] = [...mergedByTx.values()].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return a.id.localeCompare(b.id)
      })
    }
    setColHistoryMap(next)
  }, [colActiveMembers, colMonthSchedules, colRecords, getHistoryKey])

  const handleColRegister = (member: Member) => {
    const row = getPaymentRow(member.id)
    const amount = Number((row.amount || "").replace(/,/g, ""))
    if (Number.isNaN(amount)) {
      alert("金額を入力してください")
      return
    }
    const date = row.date || colBulkDate || getTodayString()
    const expected = getExpectedAmount(member.id)
    const currentPaid = getTotalPaid(member.id)
    const nextPaid = currentPaid + amount
    const diff = expected - nextPaid
    const suffix =
      expected > 0 && diff > 0
        ? `（${fmtNum(diff)}円未入金）`
        : expected > 0 && diff < 0
        ? `（${fmtNum(Math.abs(diff))}円過入金）`
        : ""
    const memoBase = row.memo?.trim() ?? ""
    const memo = suffix ? (memoBase ? `${memoBase} ${suffix}` : suffix) : memoBase

    const tx = addTransaction({
      date,
      type: "collection",
      amount,
      counterparty: "現金",
      category: "集金",
      accountTitle: "会費収入",
      memo: memo ? `${member.name} / ${memo}` : `${member.name} の集金`,
      receiptUrl: null,
    })

    const key = getHistoryKey(member.id)
    const entry = { id: tx.id, amount, date, memo }
    const nextHistory = [...(colHistoryMap[key] ?? []), entry]
    setColHistoryMap((prev) => ({ ...prev, [key]: nextHistory }))
    persistMemberCollectionState(member.id, nextHistory)
    reloadCollectionData()
    setColPayments((prev) => {
      const next = { ...prev }
      delete next[member.id]
      return next
    })
    setColSuccess(`${member.name} の入力を保存しました`)
    setTimeout(() => setColSuccess(null), 3000)
  }

  const getHistoryEditKey = (memberId: string, entryId: string) => `${memberId}_${entryId}`

  const handleStartHistoryEdit = (memberId: string, entry: { id: string; amount: number; date: string; memo: string }) => {
    const key = getHistoryEditKey(memberId, entry.id)
    setColHistoryEditing((prev) => ({
      ...prev,
      [key]: { amount: String(entry.amount), date: entry.date || colBulkDate, memo: entry.memo || "" },
    }))
  }

  const handleCancelHistoryEdit = (memberId: string, entryId: string) => {
    const key = getHistoryEditKey(memberId, entryId)
    setColHistoryEditing((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const handleSaveHistoryEdit = (memberId: string, entryId: string) => {
    const editKey = getHistoryEditKey(memberId, entryId)
    const edit = colHistoryEditing[editKey]
    if (!edit) return
    const amount = Number(edit.amount.replace(/,/g, ""))
    if (Number.isNaN(amount)) {
      alert("金額を入力してください")
      return
    }
    const date = edit.date || colBulkDate || getTodayString()
    const key = getHistoryKey(memberId)
    const list = colHistoryMap[key] ?? []
    const updated = list.map((h) => (h.id === entryId ? { ...h, amount, date, memo: edit.memo } : h))
    setColHistoryMap((prev) => ({ ...prev, [key]: updated }))
    persistMemberCollectionState(memberId, updated)
    reloadCollectionData()
    handleCancelHistoryEdit(memberId, entryId)
    setColSuccess("履歴を更新しました")
    setTimeout(() => setColSuccess(null), 2000)
  }

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

      {/* ===== 集金タブ: 実績入力一覧 ===== */}
      {showCollectionFields ? (
        <div className="flex-1 bg-white overflow-y-auto">
          <div className="px-6 py-5">
            {/* 成功メッセージ */}
            {colSuccess && (
              <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-800">{colSuccess}</p>
              </div>
            )}

            {/* 集金月ボタン */}
            <div className="mb-5">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-[#374151] whitespace-nowrap">集金月選択:</span>
                <div className="flex gap-1 flex-wrap">
                  {FISCAL_MONTHS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setColMonth(m)}
                      className={`min-w-[36px] px-2.5 py-2 rounded-md text-sm font-semibold transition-all ${
                        colMonth === m
                          ? "text-white shadow-sm"
                          : "bg-white text-[#374151] border border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                      }`}
                      style={colMonth === m ? { backgroundColor: "#67a384" } : {}}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-[#9CA3AF] ml-1">月</span>
              </div>
            </div>

            {/* フィルタ行 */}
            <div className="flex flex-wrap items-end gap-4 mb-5 pb-4 border-b border-gray-100">
              <div>
                <label className={labelClass}>入金日（一括）</label>
                <div className="w-44">
                  <DatePickerField
                    value={colBulkDate}
                    onChange={(v) => setColBulkDate(v)}
                    themeColor={THEME_COLOR}
                    className={inputClass}
                    aria-label="入金日"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>学年</label>
                <div className="flex gap-1">
                  {(["all", 4, 3, 2, 1] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setColGrade(g)}
                      className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                        colGrade === g ? "text-white" : "bg-gray-100 text-[#374151] hover:bg-gray-200"
                      }`}
                      style={colGrade === g ? { backgroundColor: THEME_COLOR } : {}}
                    >
                      {g === "all" ? "全員" : GRADE_LABELS[g]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>名前検索</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={colSearch}
                    onChange={(e) => setColSearch(e.target.value)}
                    className={`${inputClass} pl-8 w-44`}
                    placeholder="氏名で検索"
                  />
                </div>
              </div>
            </div>

            {/* テーブル */}
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse table-fixed text-sm">
                  <colgroup>
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col />
                    <col style={{ width: "7.5%" }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-[#67a384]/10">
                      <th className="px-3 py-3 text-left font-semibold text-[#374151] border-b border-r border-gray-300">氏名</th>
                      <th className="px-2 py-3 text-left font-semibold text-[#374151] border-b border-r border-gray-300">学年</th>
                      <th className="px-2 py-3 text-left font-semibold text-[#374151] border-b border-r border-gray-300">カテゴリー</th>
                      <th className="px-2 py-3 text-left font-semibold text-[#374151] border-b border-r border-gray-300">科目</th>
                      <th className="px-2 py-3 text-right font-semibold text-[#374151] border-b border-r border-gray-300 whitespace-nowrap">集金予定額</th>
                      <th className="px-2 py-3 text-right font-semibold text-[#374151] border-b border-r border-gray-300 whitespace-nowrap">当月集金予定総額</th>
                      <th className="px-2 py-3 text-right font-semibold text-[#374151] border-b border-r border-gray-300">入金実績</th>
                      <th className="px-2 py-3 text-left font-semibold text-[#374151] border-b border-r border-gray-300">入金日</th>
                      <th className="px-2 py-3 text-left font-semibold text-[#374151] border-b border-r border-gray-300">メモ</th>
                      <th className="px-2 py-3 text-left font-semibold text-[#374151] border-b border-gray-300">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {colFilteredMembers.length === 0 ? (
                      <tr className="border-b border-gray-300">
                        <td colSpan={10} className="px-4 py-12 text-center text-[#9CA3AF]">
                          {colActiveMembers.length === 0
                            ? "部員を登録してください"
                            : "該当する部員がいません"}
                        </td>
                      </tr>
                    ) : (
                      colFilteredMembers.flatMap((member, idx) => {
                        const row = getPaymentRow(member.id)
                        const memberSchedules = colMonthSchedules
                          .filter((s) => (s.memberIds && s.memberIds.length > 0 ? s.memberIds.includes(member.id) : true))
                          .sort((a, b) => {
                            const ca = a.categoryName ?? ""
                            const cb = b.categoryName ?? ""
                            if (ca !== cb) return ca.localeCompare(cb, "ja")
                            const sa = a.accountTitleName ?? a.name
                            const sb = b.accountTitleName ?? b.name
                            return sa.localeCompare(sb, "ja")
                          })
                        const history = getMemberHistory(member.id)
                        const expected = getExpectedAmount(member.id)
                        const paid = getTotalPaid(member.id)
                        const status = getStatus(member.id)
                        const guideDiff = expected - paid
                        const amountPlaceholder = expected > 0 ? fmtNum(guideDiff) : "0"
                        const memoGuide =
                          status === "PARTIALLY_PAID" && guideDiff > 0
                            ? `（${fmtNum(guideDiff)}円未入金）`
                            : status === "OVERPAID" && guideDiff < 0
                            ? `（${fmtNum(Math.abs(guideDiff))}円過入金）`
                            : ""
                        const isCompleted = status === "COMPLETED"
                        const showInputRow = expected > 0 && status !== "COMPLETED"
                        const detailCount = Math.max(1, memberSchedules.length)
                        const bg = isCompleted ? "bg-gray-200" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"
                        const text = "text-[#374151]"
                        const badge = expected > 0 ? COLLECTION_STATUS_BADGE[status] : null
                        const isFocused = colFocusedMemberId === member.id

                        type ActionRowType =
                          | { kind: "history"; entry: { id: string; amount: number; date: string; memo: string } }
                          | { kind: "input" }
                          | { kind: "none" }
                        const actionRows: ActionRowType[] =
                          expected <= 0
                            ? [{ kind: "none" }]
                            : [...history.map((h) => ({ kind: "history" as const, entry: h })), ...(showInputRow ? [{ kind: "input" as const }] : [])]
                        const actionCount = Math.max(1, actionRows.length)
                        const totalRows = Math.max(detailCount, actionCount)
                        const mergeCompletedSingleAction =
                          isCompleted &&
                          history.length === 1 &&
                          actionRows.length === 1 &&
                          actionRows[0].kind === "history"

                        const rows: React.ReactNode[] = []

                        for (let i = 0; i < totalRows; i++) {
                          const action = actionRows[i] ?? null
                          const schedule = memberSchedules[i] ?? null
                          const groupEntry = action && action.kind === "history" ? action.entry : null
                          const editKey = groupEntry ? getHistoryEditKey(member.id, groupEntry.id) : null
                          const editing = !!(editKey && colHistoryEditing[editKey])
                          const editRow = groupEntry
                            ? colHistoryEditing[editKey!] ?? { amount: String(groupEntry.amount), date: groupEntry.date, memo: groupEntry.memo }
                            : null
                          const firstGlobal = i === 0
                          const lastGlobal = i === totalRows - 1
                          const rowBgClass = editing ? "bg-blue-50" : bg

                          rows.push(
                            <tr
                              key={`${member.id}_${i}`}
                              ref={firstGlobal ? setMemberRowRef(member.id) : undefined}
                              className={`${lastGlobal ? "border-b-2 border-gray-400" : "border-b border-gray-300"} ${rowBgClass} ${firstGlobal && isFocused ? "bg-[#ECF8F2]" : ""}`}
                            >
                              {firstGlobal && (
                                <>
                                  <td rowSpan={totalRows} className={`px-3 py-3 text-left font-medium border-r border-gray-300 align-middle ${bg} ${text}`}>
                                    {member.name}
                                  </td>
                                  <td rowSpan={totalRows} className={`px-2 py-3 text-left border-r border-gray-300 whitespace-nowrap align-middle ${bg} ${text}`}>
                                    {GRADE_LABELS[member.grade] ?? `${member.grade}年`}
                                  </td>
                                </>
                              )}

                              <td className="px-2 py-2 border-r border-gray-300 text-left text-[#374151]">
                                {schedule?.categoryName ?? ""}
                              </td>
                              <td className="px-2 py-2 border-r border-gray-300 text-left text-[#374151]">
                                {schedule?.accountTitleName ?? schedule?.name ?? ""}
                              </td>
                              <td className="px-2 py-2 border-r border-gray-300 text-right tabular-nums text-[#374151]">
                                {schedule ? fmtNum(schedule.amount) : ""}
                              </td>

                              {firstGlobal && (
                                <td rowSpan={totalRows} className={`px-2 py-3 text-right border-r border-gray-300 align-middle ${bg}`}>
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className={`tabular-nums font-semibold text-right ${text}`}>
                                      {expected > 0 ? fmtNum(expected) : "0"}
                                    </span>
                                    {(status === "PARTIALLY_PAID" || status === "OVERPAID") && (
                                      <span className="text-[10px] tabular-nums text-right text-[#6B7280]">
                                        入金済 {fmtNum(paid)} / {fmtNum(expected)}
                                      </span>
                                    )}
                                    {badge && (
                                      <span className={`inline-block mt-0.5 px-1.5 py-0 rounded text-[9px] font-bold leading-relaxed text-left ${badge.className}`}>
                                        {badge.label}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              )}

                              {((mergeCompletedSingleAction && i === 0 && actionRows[0].kind === "history")
                                || (!mergeCompletedSingleAction && action?.kind === "history" && groupEntry)) ? (
                                <>
                                  {(() => {
                                    const targetEntry = mergeCompletedSingleAction && actionRows[0].kind === "history" ? actionRows[0].entry : groupEntry!
                                    const targetEditKey = getHistoryEditKey(member.id, targetEntry.id)
                                    const targetEditing = !!colHistoryEditing[targetEditKey]
                                    const targetEditRow =
                                      colHistoryEditing[targetEditKey] ?? {
                                        amount: String(targetEntry.amount),
                                        date: targetEntry.date,
                                        memo: targetEntry.memo,
                                      }
                                    const actionRowSpan = mergeCompletedSingleAction ? totalRows : undefined
                                    return (
                                      <>
                                  <td rowSpan={actionRowSpan} className="px-2 py-2 border-r border-gray-300 align-middle">
                                    {targetEditing ? (
                                      <input
                                        type="number"
                                        value={targetEditRow.amount}
                                        onChange={(e) =>
                                          setColHistoryEditing((prev) => ({
                                            ...prev,
                                            [targetEditKey]: { ...targetEditRow, amount: e.target.value },
                                          }))
                                        }
                                        className="w-full px-2 py-1.5 text-right tabular-nums text-sm border border-gray-300 rounded bg-white text-[#374151]"
                                      />
                                    ) : (
                                      <div className={`w-full px-2 py-1.5 text-right tabular-nums text-sm border border-gray-300 rounded ${isCompleted ? "bg-white/70 text-[#374151]" : "bg-white text-[#374151]"}`}>
                                        {fmtNum(targetEntry.amount)}
                                      </div>
                                    )}
                                  </td>
                                  <td rowSpan={actionRowSpan} className="px-2 py-2 border-r border-gray-300 align-middle">
                                    <DatePickerField
                                      value={targetEditing ? targetEditRow.date : targetEntry.date}
                                      onChange={(v) =>
                                        setColHistoryEditing((prev) => ({
                                          ...prev,
                                          [targetEditKey]: { ...targetEditRow, date: v },
                                        }))
                                      }
                                      themeColor="#67a384"
                                      className={`w-full px-2 py-1.5 text-left text-sm border border-gray-300 rounded ${targetEditing ? "bg-white text-[#374151]" : isCompleted ? "bg-white/70 text-[#374151] pointer-events-none" : "bg-white text-[#374151] pointer-events-none"}`}
                                      aria-label={`${member.name}の入金日（履歴）`}
                                    />
                                  </td>
                                  <td rowSpan={actionRowSpan} className="px-2 py-2 border-r border-gray-300 align-middle">
                                    <input
                                      type="text"
                                      value={targetEditing ? targetEditRow.memo : targetEntry.memo}
                                      onChange={(e) =>
                                        setColHistoryEditing((prev) => ({
                                          ...prev,
                                          [targetEditKey]: { ...targetEditRow, memo: e.target.value },
                                        }))
                                      }
                                      readOnly={!targetEditing}
                                      className={`w-full px-2 py-1.5 text-left text-sm border border-gray-300 rounded ${targetEditing ? "bg-white text-[#374151]" : isCompleted ? "bg-white/70 text-[#374151]" : "bg-white text-[#374151]"}`}
                                    />
                                  </td>
                                  <td rowSpan={actionRowSpan} className="px-2 py-2 text-left align-middle">
                                    {targetEditing ? (
                                      <div className="flex items-center justify-center gap-1">
                                        <Button
                                          type="button"
                                          size="sm"
                                          className="text-white text-xs px-2"
                                          style={{ backgroundColor: "#67a384" }}
                                          onClick={() => handleSaveHistoryEdit(member.id, targetEntry.id)}
                                        >
                                          保存
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="text-xs px-2"
                                          onClick={() => handleCancelHistoryEdit(member.id, targetEntry.id)}
                                        >
                                          取消
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="text-xs px-3 border-[#67a384] text-[#67a384] hover:bg-[#67a384]/10"
                                        onClick={() => handleStartHistoryEdit(member.id, targetEntry)}
                                      >
                                        編集する
                                      </Button>
                                    )}
                                  </td>
                                      </>
                                    )
                                  })()}
                                </>
                              ) : (!mergeCompletedSingleAction && action?.kind === "input") ? (
                                <>
                                  <td className="px-2 py-2 border-r border-gray-300 align-middle">
                                    <input
                                      type="number"
                                      value={row.amount}
                                      onChange={(e) => setPaymentRow(member.id, { amount: e.target.value })}
                                      className="w-full px-2 py-1.5 text-right tabular-nums text-sm border border-gray-300 rounded placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#67a384]"
                                      placeholder={amountPlaceholder}
                                    />
                                  </td>
                                  <td className="px-2 py-2 border-r border-gray-300 align-middle">
                                    <DatePickerField
                                      value={row.date || colBulkDate}
                                      onChange={(v) => setPaymentRow(member.id, { date: v })}
                                      themeColor="#67a384"
                                      className="w-full px-2 py-1.5 text-left text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#67a384]"
                                      aria-label={`${member.name}の入金日`}
                                    />
                                  </td>
                                  <td className="px-2 py-2 border-r border-gray-300 align-middle">
                                    <input
                                      type="text"
                                      value={row.memo}
                                      onChange={(e) => setPaymentRow(member.id, { memo: e.target.value })}
                                      className="w-full px-2 py-1.5 text-left text-sm border border-gray-300 rounded placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#67a384]"
                                      placeholder={memoGuide || "任意"}
                                    />
                                  </td>
                                  <td className="px-2 py-2 text-left align-middle">
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="text-white text-xs px-3"
                                      style={{ backgroundColor: "#67a384" }}
                                      onClick={() => handleColRegister(member)}
                                    >
                                      登録する
                                    </Button>
                                  </td>
                                </>
                              ) : (!mergeCompletedSingleAction && action?.kind === "none") ? (
                                <>
                                  <td className="px-2 py-3 border-r border-gray-300 align-middle text-right text-[#9CA3AF]">-</td>
                                  <td className="px-2 py-3 border-r border-gray-300 align-middle text-left text-[#9CA3AF]">-</td>
                                  <td className="px-2 py-3 border-r border-gray-300 align-middle text-left text-[#9CA3AF]">-</td>
                                  <td className="px-2 py-3 text-left align-middle">
                                    <span className="text-xs text-[#9CA3AF]">予定なし</span>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-2 py-3 border-r border-gray-300 align-middle"></td>
                                  <td className="px-2 py-3 border-r border-gray-300 align-middle"></td>
                                  <td className="px-2 py-3 border-r border-gray-300 align-middle"></td>
                                  <td className="px-2 py-3 text-left align-middle"></td>
                                </>
                              )}
                            </tr>
                          )
                        }

                        return rows
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {colFilteredMembers.length > 0 && (
              <p className="text-xs text-[#9CA3AF] mt-3">
                {colMonth}月の集金予定がある部員 {colFilteredMembers.filter((m) => getExpectedAmount(m.id) > 0).length}名
                　/　表示 {colFilteredMembers.length}名
              </p>
            )}
          </div>
        </div>
      ) : (
      /* ===== 他のタブ: 既存フォーム ===== */
      <div
        className={`flex-1 grid gap-0 min-h-0 transition-[grid-template-columns] duration-300 ${
          showReceiptArea ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
        }`}
      >
        <div
          className={`overflow-y-auto bg-white ${
            showReceiptArea ? "border-r border-gray-200" : "flex justify-center"
          }`}
        >
          <div className={`p-6 ${showReceiptArea ? "max-w-lg" : "w-full max-w-lg"}`}>
            <form onSubmit={handleSubmit} className="space-y-5">
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
      )}
    </div>
  )
}

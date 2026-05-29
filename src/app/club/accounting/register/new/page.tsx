"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DatePickerField } from "@/components/ui/date-picker-field"
import { Loader2, Camera, CheckCircle2, Search, Plus } from "lucide-react"
import {
  getCategories,
  getAccountTitles,
  getTransactions,
  saveTransactions,
  addTransaction,
  addCollectionRegisterTransactions,
  updateTransaction,
  deleteTransaction,
  getMembers,
  getCollectionSchedules,
  getCollectionRecords,
  syncAllCollectionRecords,
  reconcileCollectionRecordsPaidAmount,
  sumCollectionRecordNetPaid,
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
import { useUserInfo } from "@/contexts/UserInfoContext"
import { BankCsvImportSection } from "@/components/accounting/BankCsvImportSection"
import { SettlementLockAlert } from "@/components/club/SettlementLockAlert"
import {
  formatAmountInputDisplay,
  isAllowedSignedIntegerTyping,
  parseSubmitAmount,
} from "@/utils/amountInput"
import { formatDateDisplay as formatColDateDisplay } from "@/utils/dateDisplay"

const THEME_COLOR = "#A3BC68"
const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const
const GRADE_LABELS: Record<number, string> = { 1: "1年生", 2: "2年生", 3: "3年生", 4: "4年生" }
/** 集金入力テーブル用の短い学年表記（列幅節約） */
const GRADE_TABLE_LABELS: Record<number, string> = { 1: "1", 2: "2", 3: "3", 4: "4" }

/** 集金テーブル見出し（sticky・中央寄せ・不透過背景） */
const COL_TABLE_TH =
  "sticky top-0 z-30 bg-[#EEF6F1] text-center font-semibold text-[#374151] border-b border-r border-gray-300 shadow-[0_1px_0_0_#d1d5db]"

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

function parseMonthFromTargetMonth(targetMonth?: string): number | null {
  if (!targetMonth) return null
  const m = Number(targetMonth.split("-")[1])
  if (!Number.isFinite(m) || m < 1 || m > 12) return null
  return m
}

function formatCollectionMemo(memberName: string, targetMonth?: string, subjectName?: string): string {
  const month = parseMonthFromTargetMonth(targetMonth)
  const subject = (subjectName ?? "").trim()
  const label = subject ? `${memberName} - ${subject}` : memberName
  if (month == null) return `集金（${label}）`
  return `[${month}月分] 集金（${label}）`
}

/** 画面入力メモが空なら `[N月分] 集金（氏名 - 科目）` を補完。入力ありならそのまま採用。 */
function resolveCollectionMemo(
  userMemo: string,
  memberName: string,
  schedule: CollectionSchedule
): string {
  const trimmed = userMemo.trim()
  if (trimmed) return trimmed
  const subjectName = schedule.accountTitleName || schedule.name || ""
  return formatCollectionMemo(memberName, schedule.targetMonth, subjectName)
}

const fmtNum = (n: number): string => n.toLocaleString()
const fmtYen = (n: number): string => `¥${fmtNum(n)}`

/** 部員単位の進捗テキスト（入金済は非表示・過入金/一部入金は差額のみ） */
function formatCollectionMemberProgressText(
  status: CollectionPaymentStatus,
  paid: number,
  expected: number
): string | null {
  if (expected <= 0) return null
  if (status === "COMPLETED") return null
  if (status === "UNPAID" && paid <= 0) return null
  if (status === "OVERPAID") return `過入金 ${fmtNum(paid - expected)}`
  if (status === "PARTIALLY_PAID") return `未入金 ${fmtNum(expected - paid)}`
  if (paid > expected) return `過入金 ${fmtNum(paid - expected)}`
  if (paid > 0 && paid < expected) return `未入金 ${fmtNum(expected - paid)}`
  return null
}

type ColPaymentFields = { amount: string; date: string; memo: string }

const COL_BASE_LINE_ID = "base"

/** 入金段ごとに親の集金設定（マスタ）を保持し、追加段の仕訳生成に使う */
type ColPaymentLineMeta = {
  transactionId?: string
  scheduleId: string
  counterpartyName: string
  categoryName: string
  accountTitleName: string
}

function collectionTxFieldsFromSchedule(schedule: CollectionSchedule, defaultCashName: string) {
  return {
    scheduleId: schedule.id,
    counterpartyName: (schedule.counterpartyName ?? "").trim() || defaultCashName,
    categoryName: schedule.categoryName || "集金",
    accountTitleName: schedule.accountTitleName || schedule.name || "会費収入",
  }
}

function collectionTxFieldsFromMeta(
  meta: ColPaymentLineMeta | undefined,
  schedule: CollectionSchedule,
  defaultCashName: string
) {
  if (meta) {
    return {
      counterparty: meta.counterpartyName,
      category: meta.categoryName,
      accountTitle: meta.accountTitleName,
      collectionScheduleId: meta.scheduleId,
    }
  }
  const base = collectionTxFieldsFromSchedule(schedule, defaultCashName)
  return {
    counterparty: base.counterpartyName,
    category: base.categoryName,
    accountTitle: base.accountTitleName,
    collectionScheduleId: base.scheduleId,
  }
}

type ColEditSnapshot = {
  payments: Record<string, ColPaymentFields>
  lineKeys: string[]
  metas: Record<string, ColPaymentLineMeta>
}

type ColDisplayRow = {
  schedule: CollectionSchedule | null
  lineId: string
  paymentKey: string
  showSubjectLabel: boolean
}

function colPaymentLineKey(memberId: string, scheduleId: string, lineId: string) {
  return `${memberId}__${scheduleId}__${lineId}`
}

function parseColPaymentLineKey(key: string): { memberId: string; scheduleId: string; lineId: string } | null {
  const idx1 = key.indexOf("__")
  if (idx1 < 0) return null
  const idx2 = key.indexOf("__", idx1 + 2)
  if (idx2 < 0) return null
  return {
    memberId: key.slice(0, idx1),
    scheduleId: key.slice(idx1 + 2, idx2),
    lineId: key.slice(idx2 + 2),
  }
}

function newExtraLineId() {
  return `extra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 「追加する」で生成された入金段（`newExtraLineId` の `extra-` プレフィックス） */
function isNewCollectionPaymentLine(lineId: string): boolean {
  return lineId.startsWith("extra-")
}

type MemberPaymentLineState = {
  lineKeys: string[]
  payments: Record<string, ColPaymentFields>
  metas: Record<string, ColPaymentLineMeta>
}

/** 実績（paymentHistory）から部員の入金段キー・入力値・メタを同期構築（各行は独立した paymentKey） */
function buildMemberPaymentLineState(
  memberId: string,
  schedules: CollectionSchedule[],
  records: CollectionRecord[],
  defaultCashName: string
): MemberPaymentLineState {
  const lineKeys: string[] = []
  const payments: Record<string, ColPaymentFields> = {}
  const metas: Record<string, ColPaymentLineMeta> = {}

  for (const schedule of schedules) {
    const master = collectionTxFieldsFromSchedule(schedule, defaultCashName)
    const rec = records.find((r) => r.memberId === memberId && r.scheduleId === schedule.id)
    const history = rec?.paymentHistory ?? []
    if (history.length > 0) {
      history.forEach((h, idx) => {
        const lineId = h.transactionId || `hist-${idx}`
        const key = colPaymentLineKey(memberId, schedule.id, lineId)
        lineKeys.push(key)
        payments[key] = {
          amount: String(h.amount),
          date: h.date ?? "",
          memo: h.memo ?? "",
        }
        metas[key] = { ...master, transactionId: h.transactionId || undefined }
      })
      continue
    }
    const fromRecord = getLatestPaymentFromRecord(rec)
    const key = colPaymentKey(memberId, schedule.id)
    lineKeys.push(key)
    payments[key] = fromRecord
      ? { ...fromRecord }
      : { amount: "", date: "", memo: "" }
    metas[key] = { ...master, transactionId: rec?.linkedTransactionId || undefined }
  }

  return { lineKeys, payments, metas }
}

/** 科目ブロック内の指定位置の直後に新しい段キーを挿入 */
function insertPaymentLineKey(
  keys: string[],
  memberId: string,
  scheduleId: string,
  newKey: string,
  afterPaymentKey: string
): string[] {
  const next = [...keys]
  let insertAt = next.length
  const afterIdx = next.indexOf(afterPaymentKey)
  if (afterIdx >= 0) {
    insertAt = afterIdx + 1
  } else {
    for (let i = next.length - 1; i >= 0; i--) {
      const parsed = parseColPaymentLineKey(next[i])
      if (parsed?.memberId === memberId && parsed.scheduleId === scheduleId) {
        insertAt = i + 1
        break
      }
    }
  }
  next.splice(insertAt, 0, newKey)
  return next
}

/** 集金実績レコードから画面表示用の最新入金情報を取得（paymentHistory 優先） */
function getLatestPaymentFromRecord(rec: CollectionRecord | undefined): ColPaymentFields | null {
  if (!rec) return null
  const history = rec.paymentHistory ?? []
  if (history.length > 0) {
    const last = history[history.length - 1]
    return {
      amount: String(last.amount),
      date: last.date ?? "",
      memo: last.memo ?? "",
    }
  }
  if (rec.status !== "UNPAID" && (rec.paidAmount ?? 0) !== 0) {
    return {
      amount: String(rec.paidAmount ?? 0),
      date: rec.paidAt ?? "",
      memo: "",
    }
  }
  return null
}

const COL_INPUT_LOCKED_CLASS =
  "w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-100 text-[#374151] cursor-not-allowed"

/** 部員向け集金予定の表示順（カテゴリー → 科目 → id） */
function sortCollectionSchedulesForMember(
  schedules: CollectionSchedule[],
  memberId: string,
  categoryOrderMap: Map<string, number>,
  accountOrderMap: Map<string, number>
): CollectionSchedule[] {
  return schedules
    .filter((s) => (s.memberIds && s.memberIds.length > 0 ? s.memberIds.includes(memberId) : true))
    .sort((a, b) => {
      const caName = a.categoryName ?? ""
      const cbName = b.categoryName ?? ""
      const ca = categoryOrderMap.get(caName) ?? Number.MAX_SAFE_INTEGER
      const cb = categoryOrderMap.get(cbName) ?? Number.MAX_SAFE_INTEGER
      if (ca !== cb) return ca - cb
      const saName = a.accountTitleName ?? a.name
      const sbName = b.accountTitleName ?? b.name
      const sa = accountOrderMap.get(saName) ?? Number.MAX_SAFE_INTEGER
      const sb = accountOrderMap.get(sbName) ?? Number.MAX_SAFE_INTEGER
      if (sa !== sb) return sa - sb
      if (caName !== cbName) return caName.localeCompare(cbName, "ja")
      return saName.localeCompare(sbName, "ja")
    })
}

type TabType = "income" | "expense" | "transfer" | "collection" | "csv" | "deferred"

const tabs: { id: TabType; label: string }[] = [
  { id: "income", label: "収入" },
  { id: "expense", label: "支出" },
  { id: "transfer", label: "振替" },
  { id: "collection", label: "集金" },
  { id: "csv", label: "CSV" },
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentOperatorName } = useUserInfo()
  const [categories, setCategories] = useState<Category[]>([])
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [activeTab, setActiveTab] = useState<TabType>("income")
  const [isLocked, setIsLocked] = useState(false)
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

  const categoryOrderMap = useMemo(
    () => new Map(sortedCategories.map((c) => [c.name, c.order])),
    [sortedCategories]
  )
  const accountOrderMap = useMemo(
    () => new Map(accountTitles.map((t) => [t.name, t.order])),
    [accountTitles]
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
  // 科目（スケジュール）行ごとの入金入力。キー: `${memberId}__${scheduleId}`
  const [colPayments, setColPayments] = useState<Record<string, { amount: string; date: string; memo: string }>>({})
  const [colSuccess, setColSuccess] = useState<string | null>(null)
  const [colFocusedMemberId, setColFocusedMemberId] = useState<string | null>(null)
  const [colSelectedMemberIds, setColSelectedMemberIds] = useState<Set<string>>(() => new Set())
  /** 入金完了部員の編集モード（操作列「編集する」押下後） */
  const [colEditingMemberIds, setColEditingMemberIds] = useState<Set<string>>(() => new Set())
  /** 部員ごとの入金段（行）の表示順（フル paymentKey の配列） */
  const [colMemberLineKeys, setColMemberLineKeys] = useState<Record<string, string[]>>({})
  /** 入金段ごとの既存仕訳 ID（更新時に使用） */
  const [colPaymentLineMeta, setColPaymentLineMeta] = useState<Record<string, ColPaymentLineMeta>>({})
  /** 編集開始時のスナップショット（キャンセル時に復元） */
  const [colEditSnapshots, setColEditSnapshots] = useState<Record<string, ColEditSnapshot>>({})
  const memberRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})
  const deepLinkInitDoneRef = useRef(false)
  const deepLinkScrollDoneRef = useRef(false)

  useEffect(() => {
    try {
      const savedLocked = localStorage.getItem("is_club_settlement_locked")
      if (savedLocked === "true") {
        setIsLocked(true)
      }
    } catch (e) {}
  }, [])

  const reloadCollectionData = useCallback(() => {
    syncAllCollectionRecords()
    reconcileCollectionRecordsPaidAmount()
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
    const editTransfer = searchParams.get("editTransfer")
    return {
      tab,
      memberId: memberId ?? "",
      month: validMonth ? month : null,
      editTransfer: editTransfer ?? "",
    }
  }, [searchParams])

  // 振替編集モード: URLクエリ editTransfer=<expenseId>:<incomeId> で対の取引を編集する
  const [transferEditState, setTransferEditState] =
    useState<{ expenseId: string; incomeId: string } | null>(null)
  const transferEditInitDoneRef = useRef(false)

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

  // 振替編集モードの初期化（URLクエリ editTransfer=<expId>:<incId>）
  useEffect(() => {
    if (transferEditInitDoneRef.current) return
    const raw = deepLinkParams.editTransfer
    if (!raw) return
    const [expenseId, incomeId] = raw.split(":")
    if (!expenseId || !incomeId) {
      transferEditInitDoneRef.current = true
      return
    }
    const all = getTransactions()
    const expTx = all.find((t) => t.id === expenseId && t.type === "expense") ?? null
    const incTx = all.find((t) => t.id === incomeId && t.type === "income") ?? null
    if (!expTx || !incTx) {
      transferEditInitDoneRef.current = true
      return
    }
    setActiveTab("transfer")
    setTransferEditState({ expenseId, incomeId })
    // 振替対のうち、出金元 = expense.counterparty / 入金先 = income.counterparty
    const fromName = expTx.counterparty || incTx.accountTitle || ""
    const toName = incTx.counterparty || expTx.accountTitle || ""
    // メモは「振替（出金）→ ... / メモ本文」形式で保存しているため、本文部分のみ復元
    const memoMatch = expTx.memo.match(/\s\/\s(.+)$/)
    const restoredMemo = memoMatch ? memoMatch[1] : ""
    setFormData((prev) => ({
      ...prev,
      date: expTx.date || incTx.date || prev.date,
      fromAccountTitle: fromName,
      toAccountTitle: toName,
      amount: String(Math.abs(expTx.amount || incTx.amount || 0)),
      memo: restoredMemo,
    }))
    transferEditInitDoneRef.current = true
  }, [deepLinkParams.editTransfer])

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
  }, [activeTab, deepLinkParams.memberId, colMonth, colMembers, colSchedules, colRecords, colGrade, colSearch])

  useEffect(() => {
    setColPayments({})
    setColSelectedMemberIds(new Set())
    setColEditingMemberIds(new Set())
    setColEditSnapshots({})
    setColMemberLineKeys({})
    setColPaymentLineMeta({})
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

  const getExpectedAmount = useCallback((memberId: string) => {
    return colMonthSchedules
      .filter((s) => (s.memberIds && s.memberIds.length > 0 ? s.memberIds.includes(memberId) : true))
      .reduce((sum, s) => sum + s.amount, 0)
  }, [colMonthSchedules])

  const colMonthScheduleIdSet = useMemo(
    () => new Set(colMonthSchedules.map((s) => s.id)),
    [colMonthSchedules]
  )

  const getTotalPaid = useCallback(
    (memberId: string) => {
      return colRecords
        .filter((r) => r.memberId === memberId && colMonthScheduleIdSet.has(r.scheduleId))
        .reduce((sum, r) => sum + sumCollectionRecordNetPaid(r), 0)
    },
    [colRecords, colMonthScheduleIdSet]
  )

  const colPaymentKey = (memberId: string, scheduleId: string) =>
    colPaymentLineKey(memberId, scheduleId, COL_BASE_LINE_ID)

  const getMemberMonthSchedules = useCallback(
    (memberId: string) =>
      sortCollectionSchedulesForMember(
        colMonthSchedules,
        memberId,
        categoryOrderMap,
        accountOrderMap
      ),
    [colMonthSchedules, categoryOrderMap, accountOrderMap]
  )

  const getCollectionRecordForSchedule = useCallback(
    (memberId: string, scheduleId: string) =>
      colRecords.find((r) => r.memberId === memberId && r.scheduleId === scheduleId),
    [colRecords]
  )

  const buildMemberDisplayRows = useCallback(
    (
      memberId: string,
      schedules: CollectionSchedule[],
      useExpandedLineLayout: boolean,
      isMemberEditing: boolean
    ): ColDisplayRow[] => {
      if (schedules.length === 0) {
        return [
          {
            schedule: null,
            lineId: COL_BASE_LINE_ID,
            paymentKey: colPaymentLineKey(memberId, "none", COL_BASE_LINE_ID),
            showSubjectLabel: true,
          },
        ]
      }

      const rows: ColDisplayRow[] = []

      if (useExpandedLineLayout) {
        let orderedKeys = colMemberLineKeys[memberId] ?? []
        if (orderedKeys.length === 0 && isMemberEditing) {
          const defaultCashName = accountTitles.find((t) => t.group === "cash")?.name ?? "現金"
          orderedKeys = buildMemberPaymentLineState(
            memberId,
            schedules,
            colRecords,
            defaultCashName
          ).lineKeys
        }
        const keysBySchedule = new Map<string, string[]>()
        for (const key of orderedKeys) {
          const parsed = parseColPaymentLineKey(key)
          if (!parsed || parsed.memberId !== memberId) continue
          const list = keysBySchedule.get(parsed.scheduleId) ?? []
          list.push(key)
          keysBySchedule.set(parsed.scheduleId, list)
        }
        for (const schedule of schedules) {
          const keys = keysBySchedule.get(schedule.id) ?? [
            colPaymentLineKey(memberId, schedule.id, COL_BASE_LINE_ID),
          ]
          keys.forEach((paymentKey, idx) => {
            const parsed = parseColPaymentLineKey(paymentKey)
            rows.push({
              schedule,
              lineId: parsed?.lineId ?? COL_BASE_LINE_ID,
              paymentKey,
              showSubjectLabel: idx === 0,
            })
          })
        }
        return rows
      }

      for (const schedule of schedules) {
        const rec = colRecords.find((r) => r.memberId === memberId && r.scheduleId === schedule.id)
        const history = rec?.paymentHistory ?? []
        if (history.length > 0) {
          history.forEach((h, idx) => {
            const lineId = h.transactionId || `hist-${idx}`
            rows.push({
              schedule,
              lineId,
              paymentKey: colPaymentLineKey(memberId, schedule.id, lineId),
              showSubjectLabel: idx === 0,
            })
          })
          continue
        }
        rows.push({
          schedule,
          lineId: COL_BASE_LINE_ID,
          paymentKey: colPaymentKey(memberId, schedule.id),
          showSubjectLabel: true,
        })
      }
      return rows
    },
    [accountTitles, colRecords, colMemberLineKeys]
  )

  const getPaymentFieldsForDisplayRow = useCallback(
    (
      memberId: string,
      schedule: CollectionSchedule,
      paymentKey: string,
      lineId: string,
      isMemberEditing: boolean
    ): ColPaymentFields => {
      if (isMemberEditing) {
        return (
          colPayments[paymentKey] ?? {
            amount: "0",
            date: "",
            memo: "",
          }
        )
      }
      const rec = colRecords.find((r) => r.memberId === memberId && r.scheduleId === schedule.id)
      const history = rec?.paymentHistory ?? []
      const histByTx = history.find((h) => h.transactionId && h.transactionId === lineId)
      const histByIdx = lineId.startsWith("hist-")
        ? history[Number(lineId.replace("hist-", ""))]
        : undefined
      const histEntry = histByTx ?? histByIdx
      if (histEntry) {
        return {
          amount: String(histEntry.amount),
          date: histEntry.date ?? "",
          memo: histEntry.memo ?? "",
        }
      }
      if (lineId === COL_BASE_LINE_ID) {
        const fromState = colPayments[paymentKey]
        if (fromState && (fromState.amount !== "" || fromState.date !== "" || fromState.memo !== "")) {
          return fromState
        }
        const fromRecord = getLatestPaymentFromRecord(rec)
        if (fromRecord) return fromRecord
      }
      const fromState = colPayments[paymentKey]
      if (fromState) return fromState
      return { amount: "", date: "", memo: "" }
    },
    [colPayments, colRecords]
  )

  /** 登録済み部員のチェックボックスは通常・編集モードとも常時ロック */
  const isColCheckboxLocked = useCallback(
    (memberId: string) => {
      const expected = getExpectedAmount(memberId)
      if (expected <= 0) return true
      const paid = getTotalPaid(memberId)
      return paid > 0
    },
    [getExpectedAmount, getTotalPaid]
  )

  /** チェック ON: 各科目の集金予定額 + 一括入金日を展開。OFF: 入金額 0・入金日空欄に戻す（未登録部員のみ）。 */
  const handleColMemberCheckbox = useCallback(
    (memberId: string, checked: boolean) => {
      if (isColCheckboxLocked(memberId)) return
      const schedules = getMemberMonthSchedules(memberId)
      if (checked) {
        const bulkDate = (colBulkDate || getTodayString()).trim()
        setColPayments((prev) => {
          const next = { ...prev }
          for (const schedule of schedules) {
            const key = colPaymentKey(memberId, schedule.id)
            next[key] = {
              amount: String(schedule.amount),
              date: bulkDate,
              memo: prev[key]?.memo ?? "",
            }
          }
          return next
        })
        setColSelectedMemberIds((prev) => new Set(prev).add(memberId))
      } else {
        setColPayments((prev) => {
          const next = { ...prev }
          for (const schedule of schedules) {
            const key = colPaymentKey(memberId, schedule.id)
            next[key] = {
              amount: "0",
              date: "",
              memo: prev[key]?.memo ?? "",
            }
          }
          return next
        })
        setColSelectedMemberIds((prev) => {
          const next = new Set(prev)
          next.delete(memberId)
          return next
        })
      }
    },
    [colBulkDate, isColCheckboxLocked, getMemberMonthSchedules]
  )

  /** 登録処理用: 画面上の入力（colPayments）を優先。未入力時のみ空欄。 */
  const getPaymentRow = useCallback(
    (memberId: string, schedule: CollectionSchedule | null): ColPaymentFields => {
      const key = schedule ? colPaymentKey(memberId, schedule.id) : `${memberId}__none`
      const existing = colPayments[key]
      if (existing) return existing
      return { amount: "", date: "", memo: "" }
    },
    [colPayments]
  )

  /**
   * 表示用: colPayments → 集金実績（paymentHistory）の順で値を解決。
   * 登録後のリフレッシュ後も実績から同じ値を復元する。
   */
  const getDisplayPaymentRow = useCallback(
    (memberId: string, schedule: CollectionSchedule): ColPaymentFields => {
      const key = colPaymentKey(memberId, schedule.id)
      const rec = getCollectionRecordForSchedule(memberId, schedule.id)
      const fromRecord = getLatestPaymentFromRecord(rec)
      const isEditing = colEditingMemberIds.has(memberId)

      // 入金済科目: 実績を優先（編集モード中は colPayments を優先して上書き可能にする）
      if (rec?.status === "COMPLETED" && fromRecord && !isEditing) {
        return fromRecord
      }

      const fromState = colPayments[key]
      if (fromState && (fromState.amount !== "" || fromState.date !== "" || fromState.memo !== "")) {
        return fromState
      }
      if (fromRecord) return fromRecord
      if (fromState) return fromState
      return { amount: "", date: "", memo: "" }
    },
    [colPayments, colEditingMemberIds, getCollectionRecordForSchedule]
  )

  const setPaymentRowByKey = useCallback(
    (paymentKey: string, updates: Partial<ColPaymentFields>) => {
      setColPayments((prev) => {
        const current =
          prev[paymentKey] ?? {
            amount: "",
            date: "",
            memo: "",
          }
        return { ...prev, [paymentKey]: { ...current, ...updates } }
      })
    },
    []
  )

  const setPaymentRow = useCallback(
    (memberId: string, scheduleId: string, updates: Partial<ColPaymentFields>) => {
      setPaymentRowByKey(colPaymentKey(memberId, scheduleId), updates)
    },
    [setPaymentRowByKey]
  )

  /**
   * 新規追加段のみ: 入金額フォーカス時、入金日が空なら画面上部「入金日（一括）」をコピー。
   * 1段目（実績行・base / transactionId）には適用しない。
   */
  const handleColAmountFocusForNewLine = useCallback(
    (paymentKey: string, currentDate: string) => {
      if ((currentDate || "").trim() !== "") return
      const bulkDate = (colBulkDate || getTodayString()).trim()
      if (!bulkDate) return
      setPaymentRowByKey(paymentKey, { date: bulkDate })
    },
    [colBulkDate, setPaymentRowByKey]
  )

  const handleColAddPaymentLine = useCallback(
    (memberId: string, schedule: CollectionSchedule, afterPaymentKey: string) => {
      const schedules = getMemberMonthSchedules(memberId)
      const defaultCashName = accountTitles.find((t) => t.group === "cash")?.name ?? "現金"
      const parentMeta = colPaymentLineMeta[afterPaymentKey]
      const inherited =
        parentMeta?.scheduleId === schedule.id
          ? {
              scheduleId: parentMeta.scheduleId,
              counterpartyName: parentMeta.counterpartyName,
              categoryName: parentMeta.categoryName,
              accountTitleName: parentMeta.accountTitleName,
            }
          : collectionTxFieldsFromSchedule(schedule, defaultCashName)

      const lineId = newExtraLineId()
      const paymentKey = colPaymentLineKey(memberId, schedule.id, lineId)
      const newRow: ColPaymentFields = { amount: "", date: "", memo: "" }

      setColMemberLineKeys((prev) => {
        const existing = prev[memberId] ?? []
        const baseState =
          existing.length > 0
            ? null
            : buildMemberPaymentLineState(memberId, schedules, colRecords, defaultCashName)
        const mergedKeys = insertPaymentLineKey(
          existing.length > 0 ? existing : baseState!.lineKeys,
          memberId,
          schedule.id,
          paymentKey,
          afterPaymentKey
        )

        if (baseState) {
          setColPayments((p) => ({ ...p, ...baseState.payments, [paymentKey]: newRow }))
          setColPaymentLineMeta((m) => ({ ...m, ...baseState.metas, [paymentKey]: { ...inherited } }))
        } else {
          setColPayments((p) => ({ ...p, [paymentKey]: newRow }))
          setColPaymentLineMeta((m) => ({ ...m, [paymentKey]: { ...inherited } }))
        }

        return { ...prev, [memberId]: mergedKeys }
      })
    },
    [accountTitles, colPaymentLineMeta, colRecords, getMemberMonthSchedules]
  )

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

  /**
   * 部員の「登録する」: 科目行ごとに入力された 0 以外の行を個別 Transaction として保存。
   * `addTransaction({ type: "collection" })` は収入登録と同一の永続化経路（`transactions`）を通り、
   * 現金預金出納帳・科目別台帳・収支集計表・ダッシュボード残高・収支報告書へ反映される。
   */
  const handleColRegister = (member: Member) => {
    if (isLocked) return
    const schedules = getMemberMonthSchedules(member.id)
    if (schedules.length === 0) {
      alert("対象月の集金設定がありません")
      return
    }

    const records = getCollectionRecords()
    const recordBySchedule = new Map<string, CollectionRecord>()
    records.forEach((r) => {
      if (r.memberId === member.id) recordBySchedule.set(r.scheduleId, r)
    })

    const expandedKeys = colMemberLineKeys[member.id]
    const lines: { schedule: CollectionSchedule; amount: number; date: string; memo: string }[] = []
    const keysToScan =
      expandedKeys && expandedKeys.length > 0
        ? expandedKeys
        : schedules.map((s) => colPaymentKey(member.id, s.id))

    for (const paymentKey of keysToScan) {
      const parsed = parseColPaymentLineKey(paymentKey)
      if (!parsed || parsed.memberId !== member.id) continue
      const schedule = schedules.find((s) => s.id === parsed.scheduleId)
      if (!schedule) continue
      if (colPaymentLineMeta[paymentKey]?.transactionId) continue

      const row = colPayments[paymentKey] ?? getPaymentRow(member.id, schedule)
      const raw = (row.amount || "").replace(/,/g, "").trim()
      if (raw === "") continue
      const amount = Number(raw)
      if (Number.isNaN(amount) || amount === 0) continue
      const date = (row.date || "").trim()
      if (!date) {
        alert("入金日を入力してください")
        return
      }
      lines.push({
        schedule,
        amount,
        date,
        memo: row.memo?.trim() ?? "",
      })
    }

    if (lines.length === 0) {
      alert("入金額を入力してください")
      return
    }

    type RegisterLine = {
      schedule: CollectionSchedule
      amount: number
      date: string
      memo: string
      alloc: number
    }

    const linesBySchedule = new Map<string, typeof lines>()
    for (const line of lines) {
      const list = linesBySchedule.get(line.schedule.id) ?? []
      list.push(line)
      linesBySchedule.set(line.schedule.id, list)
    }

    const pending: RegisterLine[] = []
    for (const [scheduleId, scheduleLines] of linesBySchedule) {
      const rec = recordBySchedule.get(scheduleId)
      if (!rec) continue
      let runningPaid = sumCollectionRecordNetPaid(rec)
      for (const line of scheduleLines) {
        let alloc = line.amount
        if (line.amount < 0) {
          alloc = -Math.min(Math.abs(line.amount), runningPaid)
          if (alloc === 0) continue
        }
        pending.push({ ...line, alloc })
        runningPaid += alloc
      }
    }

    if (pending.length === 0) {
      alert("登録できる入金がありません（返金は入金済み額を超えられません）")
      return
    }

    const defaultCashName =
      accountTitles.find((t) => t.group === "cash")?.name ?? "現金"

    const txs = addCollectionRegisterTransactions(
      pending.map(({ schedule, alloc, date, memo }) => ({
        date,
        type: "collection" as const,
        amount: alloc,
        counterparty: (schedule.counterpartyName ?? "").trim() || defaultCashName,
        category: schedule.categoryName || "集金",
        accountTitle: schedule.accountTitleName || schedule.name || "会費収入",
        memo: resolveCollectionMemo(memo, member.name, schedule),
        receiptUrl: null,
        collectionMemberId: member.id,
        collectionScheduleId: schedule.id,
        createdBy: currentOperatorName,
      }))
    )

    let saved = 0
    pending.forEach((item, i) => {
      const tx = txs[i]
      if (!tx) return

      const resolvedMemo = tx.memo
      const { schedule, alloc, date } = item
      const rec = recordBySchedule.get(schedule.id)
      if (!rec) return

      const newHistory = [
        ...(rec.paymentHistory ?? []),
        { amount: alloc, date, memo: resolvedMemo, transactionId: tx.id },
      ]
      const newPaid = sumCollectionRecordNetPaid({ ...rec, paymentHistory: newHistory })
      const updated: CollectionRecord = {
        ...rec,
        paidAmount: newPaid,
        paidAt: date,
        linkedTransactionId: tx.id,
        paymentHistory: newHistory,
        status: toCollectionStatus(newPaid, schedule.amount),
      }
      updateCollectionRecord(rec.id, {
        paidAmount: updated.paidAmount,
        paidAt: updated.paidAt,
        linkedTransactionId: updated.linkedTransactionId,
        paymentHistory: updated.paymentHistory,
        status: updated.status,
      })

      recordBySchedule.set(schedule.id, updated)
      saved++
    })

    if (saved === 0) {
      alert("登録できる入金がありません（返金は入金済み額を超えられません）")
      return
    }

    // 登録成功後も入金額・入金日・メモを画面上に維持（クリアしない）
    setColPayments((prev) => {
      const next = { ...prev }
      pending.forEach((item, i) => {
        const tx = txs[i]
        if (!tx) return
        const key = colPaymentLineKey(member.id, item.schedule.id, tx.id)
        const historyEntry = {
          amount: item.alloc,
          date: item.date,
          memo: resolveCollectionMemo(item.memo, member.name, item.schedule),
        }
        next[key] = {
          amount: String(historyEntry.amount),
          date: historyEntry.date,
          memo: historyEntry.memo,
        }
      })
      return next
    })
    // 登録完了後は一律ロック表示のため、展開用 lineKeys は保持しない（実績は paymentHistory から復元）
    setColMemberLineKeys((prev) => {
      const { [member.id]: _removed, ...rest } = prev
      return rest
    })
    setColEditingMemberIds((prev) => {
      const next = new Set(prev)
      next.delete(member.id)
      return next
    })
    reloadCollectionData()
    setColSuccess(`${member.name} の集金を ${saved} 件保存しました`)
    setTimeout(() => setColSuccess(null), 3000)
  }

  const exitColEditMode = useCallback((memberId: string) => {
    setColEditingMemberIds((prev) => {
      const next = new Set(prev)
      next.delete(memberId)
      return next
    })
    setColSelectedMemberIds((prev) => {
      const next = new Set(prev)
      next.delete(memberId)
      return next
    })
    setColEditSnapshots((prev) => {
      const { [memberId]: _removed, ...rest } = prev
      return rest
    })
    setColMemberLineKeys((prev) => {
      const { [memberId]: _removed, ...rest } = prev
      return rest
    })
    setColPaymentLineMeta((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${memberId}__`)) delete next[key]
      }
      return next
    })
  }, [])

  /** 登録済み部員（入金済・一部入金・過入金）: 編集モードへ（実績の全段を colPayments に展開しスナップショット保存） */
  const handleColEditStart = useCallback(
    (member: Member) => {
      if (isLocked) return
      const schedules = getMemberMonthSchedules(member.id)
      const defaultCashName = accountTitles.find((t) => t.group === "cash")?.name ?? "現金"
      const { lineKeys, payments, metas } = buildMemberPaymentLineState(
        member.id,
        schedules,
        colRecords,
        defaultCashName
      )

      setColMemberLineKeys((prev) => ({ ...prev, [member.id]: lineKeys }))
      setColPaymentLineMeta((prev) => {
        const next = { ...prev }
        for (const key of Object.keys(next)) {
          if (key.startsWith(`${member.id}__`)) delete next[key]
        }
        return { ...next, ...metas }
      })
      setColPayments((prev) => {
        const next = { ...prev }
        for (const key of Object.keys(next)) {
          if (key.startsWith(`${member.id}__`) && key.split("__").length >= 3) delete next[key]
        }
        return { ...next, ...payments }
      })
      setColEditSnapshots((prev) => ({
        ...prev,
        [member.id]: { payments: { ...payments }, lineKeys: [...lineKeys], metas: { ...metas } },
      }))
      setColSelectedMemberIds((prev) => {
        const next = new Set(prev)
        next.delete(member.id)
        return next
      })
      setColEditingMemberIds((prev) => new Set(prev).add(member.id))
    },
    [accountTitles, colRecords, getMemberMonthSchedules, isLocked]
  )

  /** 入金完了部員: 編集を破棄して編集開始前の値・行構成に復元（永続化なし） */
  const handleColCancelEdit = useCallback(
    (member: Member) => {
      const snapshot = colEditSnapshots[member.id]
      const allowed = snapshot ? new Set(snapshot.lineKeys) : null

      setColPayments((prev) => {
        const next = { ...prev }
        for (const key of Object.keys(next)) {
          if (key.startsWith(`${member.id}__`) && key.split("__").length >= 3) {
            if (!allowed || !allowed.has(key)) delete next[key]
          }
        }
        if (snapshot) {
          for (const [key, row] of Object.entries(snapshot.payments)) {
            next[key] = { ...row }
          }
        }
        return next
      })

      if (snapshot) {
        setColMemberLineKeys((prev) => ({ ...prev, [member.id]: [...snapshot.lineKeys] }))
        setColPaymentLineMeta((prev) => {
          const next = { ...prev }
          for (const key of Object.keys(next)) {
            if (key.startsWith(`${member.id}__`)) delete next[key]
          }
          return { ...next, ...snapshot.metas }
        })
      }

      exitColEditMode(member.id)
    },
    [colEditSnapshots, exitColEditMode]
  )

  /** 入金完了部員: 全段を Transaction / CollectionRecord に反映（0 以外の段は各 1 仕訳） */
  const handleColSaveEdit = (member: Member) => {
    if (isLocked) return
    const schedules = getMemberMonthSchedules(member.id)
    const defaultCashName = accountTitles.find((t) => t.group === "cash")?.name ?? "現金"
    const allTxs = getTransactions()
    const lineKeys = colMemberLineKeys[member.id] ?? []
    let saved = 0

    for (const schedule of schedules) {
      const rec = getCollectionRecordForSchedule(member.id, schedule.id)
      if (!rec) continue

      const scheduleKeys = lineKeys.filter((k) => {
        const p = parseColPaymentLineKey(k)
        return p?.memberId === member.id && p.scheduleId === schedule.id
      })

      type RowToSave = {
        paymentKey: string
        amount: number
        date: string
        memo: string
        txId?: string
      }
      const rowsToSave: RowToSave[] = []

      for (const paymentKey of scheduleKeys) {
        const row = colPayments[paymentKey]
        if (!row) continue
        const raw = (row.amount || "").replace(/,/g, "").trim()
        if (raw === "") continue
        const amount = Number(raw)
        if (Number.isNaN(amount) || amount === 0) continue
        const date = (row.date || "").trim()
        if (!date) {
          alert("入金日を入力してください")
          return
        }
        rowsToSave.push({
          paymentKey,
          amount,
          date,
          memo: row.memo?.trim() ?? "",
          txId: colPaymentLineMeta[paymentKey]?.transactionId,
        })
      }

      if (rowsToSave.length === 0 && (rec.paidAmount ?? 0) === 0) continue

      const newHistory: {
        amount: number
        date: string
        memo: string
        transactionId: string
      }[] = []
      const keptTxIds = new Set<string>()
      let runningPaid = 0

      const pendingNew: {
        paymentKey: string
        amount: number
        date: string
        memo: string
        resolvedMemo: string
      }[] = []

      for (const row of rowsToSave) {
        const resolvedMemo = resolveCollectionMemo(row.memo, member.name, schedule)
        const txFields = collectionTxFieldsFromMeta(
          colPaymentLineMeta[row.paymentKey],
          schedule,
          defaultCashName
        )
        let alloc = row.amount
        if (row.amount < 0) {
          alloc = -Math.min(Math.abs(row.amount), runningPaid)
          if (alloc === 0) {
            alert("返金は入金済み額を超えられません")
            return
          }
        }

        if (row.txId) {
          const tx =
            allTxs.find((t) => t.id === row.txId) ??
            allTxs.find(
              (t) =>
                t.type === "collection" &&
                t.collectionMemberId === member.id &&
                t.collectionScheduleId === txFields.collectionScheduleId
            )
          if (!tx) {
            alert(`仕訳が見つかりません（${schedule.accountTitleName ?? schedule.name}）`)
            return
          }
          updateTransaction(tx.id, {
            date: row.date,
            amount: alloc,
            memo: resolvedMemo,
            counterparty: txFields.counterparty,
            category: txFields.category,
            accountTitle: txFields.accountTitle,
            collectionScheduleId: txFields.collectionScheduleId,
            collectionMemberId: member.id,
          })
          newHistory.push({
            amount: alloc,
            date: row.date,
            memo: resolvedMemo,
            transactionId: tx.id,
          })
          keptTxIds.add(tx.id)
          runningPaid += alloc
          saved++
        } else {
          pendingNew.push({
            paymentKey: row.paymentKey,
            amount: row.amount,
            date: row.date,
            memo: row.memo,
            resolvedMemo,
          })
        }
      }

      if (pendingNew.length > 0) {
        const toCreate: {
          paymentKey: string
          alloc: number
          date: string
          resolvedMemo: string
        }[] = []
        for (const item of pendingNew) {
          let alloc = item.amount
          if (item.amount < 0) {
            alloc = -Math.min(Math.abs(item.amount), runningPaid)
            if (alloc === 0) {
              alert("返金は入金済み額を超えられません")
              return
            }
          }
          toCreate.push({
            paymentKey: item.paymentKey,
            alloc,
            date: item.date,
            resolvedMemo: item.resolvedMemo,
          })
        }
        const txs = addCollectionRegisterTransactions(
          toCreate.map((item) => {
            const txFields = collectionTxFieldsFromMeta(
              colPaymentLineMeta[item.paymentKey],
              schedule,
              defaultCashName
            )
            return {
              date: item.date,
              type: "collection" as const,
              amount: item.alloc,
              counterparty: txFields.counterparty,
              category: txFields.category,
              accountTitle: txFields.accountTitle,
              memo: item.resolvedMemo,
              receiptUrl: null,
              collectionMemberId: member.id,
              collectionScheduleId: txFields.collectionScheduleId,
              createdBy: currentOperatorName,
            }
          })
        )
        toCreate.forEach((item, i) => {
          const tx = txs[i]
          if (!tx) return
          newHistory.push({
            amount: item.alloc,
            date: item.date,
            memo: item.resolvedMemo,
            transactionId: tx.id,
          })
          keptTxIds.add(tx.id)
          runningPaid += item.alloc
          saved++
        })
      }

      const oldTxIds = (rec.paymentHistory ?? [])
        .map((h) => h.transactionId)
        .filter((id): id is string => Boolean(id))
      for (const oldId of oldTxIds) {
        if (!keptTxIds.has(oldId)) deleteTransaction(oldId)
      }

      const newPaid = sumCollectionRecordNetPaid({ ...rec, paymentHistory: newHistory })
      const lastEntry = newHistory[newHistory.length - 1]
      updateCollectionRecord(rec.id, {
        paidAmount: newPaid,
        paidAt: lastEntry?.date ?? rec.paidAt,
        linkedTransactionId: lastEntry?.transactionId ?? rec.linkedTransactionId,
        paymentHistory: newHistory,
        status: toCollectionStatus(newPaid, schedule.amount),
      })
    }

    if (saved === 0) {
      alert("更新できる入金がありません")
      return
    }

    exitColEditMode(member.id)
    reloadCollectionData()
    setColSuccess(`${member.name} の集金を ${saved} 件更新しました`)
    setTimeout(() => setColSuccess(null), 3000)
  }

  const deferredSettlementList = useMemo(
    () =>
      transactions.filter(
        (t) => t.type === "deferred" && t.counterparty === "record"
      ),
    [transactions]
  )

  const handleTabChange = (tab: TabType) => {
    // 振替タブから別タブへ離脱した場合は振替編集モードを解除する
    if (tab !== "transfer") setTransferEditState(null)
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
        amount:
          typeof data.amount === "number" && Number.isFinite(data.amount)
            ? String(Math.trunc(data.amount))
            : prev.amount,
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
    if (isLocked) return

    if (activeTab === "csv") return

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
      const rawAmount = parseSubmitAmount(formData.amount)
      if (Number.isNaN(rawAmount) || rawAmount === 0) {
        alert("金額を0より大きい数値で入力してください")
        return
      }
      const amount = Math.abs(rawAmount)
      const fromName = formData.fromAccountTitle
      const toName = formData.toAccountTitle
      const baseMemo = formData.memo?.trim() ?? ""
      const memoSuffix = baseMemo ? ` / ${baseMemo}` : ""
      const transferGroupId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `tg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      // 編集モードの場合は古い対のメタ情報（登録者・登録日時）を引き継ぐため、
      // 削除前に元データを参照しておく
      let originalExp: Transaction | undefined
      let originalInc: Transaction | undefined
      if (transferEditState) {
        const all = getTransactions()
        originalExp = all.find((t) => t.id === transferEditState.expenseId) ?? undefined
        originalInc = all.find((t) => t.id === transferEditState.incomeId) ?? undefined
        if (transferEditState.expenseId) deleteTransaction(transferEditState.expenseId)
        if (transferEditState.incomeId) deleteTransaction(transferEditState.incomeId)
      }
      const nowIso = new Date().toISOString()
      const expCreated = addTransaction({
        date: formData.date,
        type: "expense",
        amount,
        counterparty: fromName,
        category: "共通",
        accountTitle: toName,
        memo: `振替（出金）→ ${toName}${memoSuffix}`,
        receiptUrl: null,
        transferGroupId,
        createdBy: originalExp?.createdBy ?? currentOperatorName,
        lastEditedAt: transferEditState ? nowIso : null,
        updatedBy: transferEditState ? currentOperatorName : null,
      })
      const incCreated = addTransaction({
        date: formData.date,
        type: "income",
        amount,
        counterparty: toName,
        category: "共通",
        accountTitle: fromName,
        memo: `振替（入金）← ${fromName}${memoSuffix}`,
        receiptUrl: null,
        transferGroupId,
        createdBy: originalInc?.createdBy ?? currentOperatorName,
        lastEditedAt: transferEditState ? nowIso : null,
        updatedBy: transferEditState ? currentOperatorName : null,
      })
      // 編集モードの場合は元の createdAt（初回登録日時）を引き継ぐ
      if (transferEditState) {
        if (originalExp?.createdAt) {
          updateTransaction(expCreated.id, { lastEditedAt: nowIso })
          // createdAt は updateTransaction では変更できないため、直接保存し直す
          const list = getTransactions().map((t) =>
            t.id === expCreated.id ? { ...t, createdAt: originalExp!.createdAt } : t
          )
          saveTransactions(list)
        }
        if (originalInc?.createdAt) {
          updateTransaction(incCreated.id, { lastEditedAt: nowIso })
          const list = getTransactions().map((t) =>
            t.id === incCreated.id ? { ...t, createdAt: originalInc!.createdAt } : t
          )
          saveTransactions(list)
        }
      }
      alert(transferEditState ? "振替を更新しました" : "振替を登録しました")
      setTransferEditState(null)
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
      const amount = parseSubmitAmount(formData.amount)
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
          createdBy: currentOperatorName,
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
          createdBy: currentOperatorName,
        })
        alert("繰延（消込）を登録しました")
      }
      resetForm()
      return
    }

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

    addTransaction({
      date: formData.date,
      type: activeTab,
      amount,
      counterparty: formData.counterpartyAccountTitle,
      category: categoryToSave,
      accountTitle: formData.accountTitle,
      memo: formData.memo,
      receiptUrl: receiptPreview ?? null,
      createdBy: currentOperatorName,
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
  const showCsvFields = activeTab === "csv"
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

      <div className="flex-shrink-0 w-full px-4 pb-2">
        <SettlementLockAlert isLocked={isLocked} />
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

            {/* テーブル（見出し sticky・本体のみ縦スクロール） */}
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <div className="overflow-auto max-h-[calc(100vh-14rem)] min-h-[12rem]">
                <table className="w-full border-collapse table-fixed text-sm min-w-[880px]">
                  <colgroup>
                    <col className="w-[2.25rem]" />
                    <col style={{ width: "11%" }} />
                    <col className="w-[2.25rem]" />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "14%" }} />
                    <col />
                    <col style={{ width: "8%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={`px-1 py-3 ${COL_TABLE_TH}`} aria-label="選択">
                        <span className="sr-only">選択</span>
                      </th>
                      <th className={`px-2 py-3 ${COL_TABLE_TH}`}>氏名</th>
                      <th className={`px-1 py-3 ${COL_TABLE_TH}`}>学年</th>
                      <th className={`px-2 py-3 whitespace-nowrap ${COL_TABLE_TH}`}>当月集金予定総額</th>
                      <th className={`px-2 py-3 ${COL_TABLE_TH}`}>科目</th>
                      <th className={`px-2 py-3 ${COL_TABLE_TH}`}>入金額</th>
                      <th className={`px-2 py-3 whitespace-nowrap ${COL_TABLE_TH}`}>入金日</th>
                      <th className={`px-2 py-3 ${COL_TABLE_TH}`}>メモ</th>
                      <th className={`px-2 py-3 border-b border-gray-300 ${COL_TABLE_TH}`}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {colFilteredMembers.length === 0 ? (
                      <tr className="border-b border-gray-300">
                        <td colSpan={9} className="px-4 py-12 text-center text-[#9CA3AF]">
                          {colActiveMembers.length === 0
                            ? "部員を登録してください"
                            : "該当する部員がいません"}
                        </td>
                      </tr>
                    ) : (
                      colFilteredMembers.flatMap((member, idx) => {
                        const memberSchedules = getMemberMonthSchedules(member.id)
                        const expected = getExpectedAmount(member.id)
                        const paid = getTotalPaid(member.id)
                        const status = getStatus(member.id)
                        const isMemberCompleted = expected > 0 && status === "COMPLETED"
                        const isMemberRegistered =
                          expected > 0 &&
                          (status === "COMPLETED" ||
                            status === "PARTIALLY_PAID" ||
                            status === "OVERPAID")
                        const isMemberEditing = colEditingMemberIds.has(member.id)
                        const useExpandedLineLayout = isMemberEditing
                        const isMemberGrayed = isMemberCompleted && !isMemberEditing
                        const canAddPaymentLine = isMemberEditing
                        const bg = isMemberGrayed
                          ? "bg-gray-200"
                          : idx % 2 === 0
                            ? "bg-white"
                            : "bg-gray-50/70"
                        const text = "text-[#374151]"
                        const badge = expected > 0 ? COLLECTION_STATUS_BADGE[status] : null
                        const isFocused = colFocusedMemberId === member.id

                        // チェック/氏名/学年/予定総額/操作は部員 rowSpan。科目/入金額/入金日/メモは予定×段ごと。
                        const displayRows = buildMemberDisplayRows(
                          member.id,
                          memberSchedules,
                          useExpandedLineLayout,
                          isMemberEditing
                        )
                        const totalRows = Math.max(1, displayRows.length)
                        const inputDisabled = expected <= 0
                        const colCheckboxLocked = inputDisabled || isColCheckboxLocked(member.id)

                        const scheduleRowCountMap = new Map<string, number>()
                        for (const dr of displayRows) {
                          const sid = dr.schedule?.id
                          if (sid) {
                            scheduleRowCountMap.set(sid, (scheduleRowCountMap.get(sid) ?? 0) + 1)
                          }
                        }
                        /** 部員ブロック最下端（現状維持・はっきり区切る） */
                        const memberBlockBorderClass = "border-b-2 border-gray-500"
                        /** 部員内・集金設定（科目）ブロック間（細く淡い線・網掛け時も同クラス） */
                        const scheduleBlockBorderClass = "border-b border-gray-300"

                        const rows: React.ReactNode[] = []
                        for (let i = 0; i < displayRows.length; i++) {
                          const dr = displayRows[i]
                          const schedule = dr.schedule
                          const firstGlobal = i === 0
                          const lastGlobal = i === displayRows.length - 1
                          const isLastLineOfSchedule =
                            i === displayRows.length - 1 ||
                            displayRows[i + 1]?.schedule?.id !== schedule?.id
                          const rowBorderClass =
                            lastGlobal && isLastLineOfSchedule
                              ? memberBlockBorderClass
                              : isLastLineOfSchedule
                                ? scheduleBlockBorderClass
                                : "border-b-0"
                          const rowBgClass = bg
                          const subjectLabel = schedule
                            ? schedule.accountTitleName ?? schedule.name ?? ""
                            : ""
                          const scheduleRowSpan =
                            schedule && dr.showSubjectLabel
                              ? scheduleRowCountMap.get(schedule.id) ?? 1
                              : 1

                          rows.push(
                            <tr
                              key={`${member.id}_${dr.paymentKey}_${i}`}
                              ref={firstGlobal ? setMemberRowRef(member.id) : undefined}
                              className={`${rowBorderClass} ${rowBgClass} ${firstGlobal && isFocused ? "bg-[#ECF8F2]" : ""}`}
                            >
                              {firstGlobal && (
                                <>
                                  <td
                                    rowSpan={totalRows}
                                    className={`px-1 py-3 text-center border-r border-gray-300 align-middle ${bg}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={colSelectedMemberIds.has(member.id)}
                                      disabled={colCheckboxLocked}
                                      title={
                                        colCheckboxLocked && !inputDisabled
                                          ? "登録済みのため一括入力は利用できません"
                                          : undefined
                                      }
                                      onChange={(e) => handleColMemberCheckbox(member.id, e.target.checked)}
                                      className="h-4 w-4 rounded border-gray-300 text-[#67a384] focus:ring-[#67a384] disabled:opacity-50 disabled:cursor-not-allowed"
                                      aria-label={`${member.name}を選択`}
                                    />
                                  </td>
                                  <td rowSpan={totalRows} className={`px-2 py-3 text-left font-medium border-r border-gray-300 align-middle ${bg} ${text}`}>
                                    {member.name}
                                  </td>
                                  <td rowSpan={totalRows} className={`px-1 py-3 text-center border-r border-gray-300 tabular-nums align-middle ${bg} ${text}`}>
                                    {GRADE_TABLE_LABELS[member.grade] ?? String(member.grade)}
                                  </td>
                                  <td
                                    rowSpan={totalRows}
                                    className={`px-2 py-3 text-right border-r border-gray-300 align-middle ${bg}`}
                                  >
                                    <div className="flex flex-col items-end gap-0.5">
                                      <span className={`tabular-nums font-semibold text-right ${text}`}>
                                        {expected > 0 ? fmtNum(expected) : "0"}
                                      </span>
                                      {(() => {
                                        const progressText = formatCollectionMemberProgressText(
                                          status,
                                          paid,
                                          expected
                                        )
                                        if (!badge && !progressText) return null
                                        return (
                                          <div className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 mt-0.5">
                                            {badge && (
                                              <span
                                                className={`inline-block px-1.5 py-0 rounded text-[9px] font-bold leading-relaxed ${badge.className}`}
                                              >
                                                {badge.label}
                                              </span>
                                            )}
                                            {progressText && (
                                              <span className="text-[10px] tabular-nums text-[#6B7280] leading-snug">
                                                {progressText}
                                              </span>
                                            )}
                                          </div>
                                        )
                                      })()}
                                    </div>
                                  </td>
                                </>
                              )}

                              {dr.showSubjectLabel &&
                                (schedule ? (
                                  <td
                                    rowSpan={scheduleRowSpan}
                                    className={`px-2 py-2 border-r border-gray-300 text-left align-middle text-[#374151] ${rowBgClass}`}
                                  >
                                    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                      <span>{subjectLabel}</span>
                                      {schedule.amount > 0 && (
                                        <span className="text-[10px] font-normal text-[#9CA3AF] tabular-nums whitespace-nowrap">
                                          ({fmtYen(schedule.amount)})
                                        </span>
                                      )}
                                    </span>
                                  </td>
                                ) : (
                                  <td
                                    className={`px-2 py-2 border-r border-gray-300 text-left text-[#374151] ${rowBgClass}`}
                                  >
                                    -
                                  </td>
                                ))}

                              {inputDisabled || !schedule ? (
                                <>
                                  <td className={`px-2 py-3 border-r border-gray-300 align-middle text-right text-[#9CA3AF] ${rowBgClass}`}>-</td>
                                  <td className={`px-2 py-3 border-r border-gray-300 align-middle text-left text-[#9CA3AF] ${rowBgClass}`}>-</td>
                                  <td className={`px-2 py-3 border-r border-gray-300 align-middle text-left text-[#9CA3AF] ${rowBgClass}`}>-</td>
                                </>
                              ) : (
                                (() => {
                                  const subjectName = schedule.accountTitleName ?? schedule.name ?? ""
                                  const scheduleRowLocked = isMemberRegistered && !isMemberEditing
                                  const scheduleRow = getPaymentFieldsForDisplayRow(
                                    member.id,
                                    schedule,
                                    dr.paymentKey,
                                    dr.lineId,
                                    isMemberEditing
                                  )
                                  const showAddLineBtn = canAddPaymentLine && isLastLineOfSchedule
                                  return (
                                    <>
                                      <td className={`px-2 py-2 border-r border-gray-300 align-middle ${rowBgClass}`}>
                                        {scheduleRowLocked ? (
                                          <div
                                            className={`${COL_INPUT_LOCKED_CLASS} text-right tabular-nums`}
                                            aria-label={`${member.name}・${subjectName}の入金額（入金済）`}
                                          >
                                            {scheduleRow.amount !== "" ? fmtNum(Number(scheduleRow.amount)) : "0"}
                                          </div>
                                        ) : (
                                          <input
                                            type="number"
                                            value={scheduleRow.amount}
                                            onChange={(e) =>
                                              setPaymentRowByKey(dr.paymentKey, { amount: e.target.value })
                                            }
                                            onFocus={() => {
                                              if (
                                                isMemberEditing &&
                                                isNewCollectionPaymentLine(dr.lineId)
                                              ) {
                                                handleColAmountFocusForNewLine(
                                                  dr.paymentKey,
                                                  scheduleRow.date
                                                )
                                              }
                                            }}
                                            className="w-full px-2 py-1.5 text-right tabular-nums text-sm border border-gray-300 rounded placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#67a384] bg-white text-[#374151]"
                                            placeholder="0"
                                            aria-label={`${member.name}・${subjectName}の入金額`}
                                          />
                                        )}
                                      </td>
                                      <td className={`px-2 py-2 border-r border-gray-300 align-middle min-w-[10.5rem] ${rowBgClass}`}>
                                        {scheduleRowLocked ? (
                                          <div
                                            className={`${COL_INPUT_LOCKED_CLASS} whitespace-nowrap min-w-[10rem]`}
                                            aria-label={`${member.name}・${subjectName}の入金日（入金済）`}
                                          >
                                            {formatColDateDisplay(scheduleRow.date) || "-"}
                                          </div>
                                        ) : (
                                          <DatePickerField
                                            value={scheduleRow.date}
                                            onChange={(v) => setPaymentRowByKey(dr.paymentKey, { date: v })}
                                            themeColor="#67a384"
                                            className="w-full min-w-[10rem] px-2 py-1.5 text-left text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#67a384] bg-white text-[#374151] whitespace-nowrap"
                                            aria-label={`${member.name}・${subjectName}の入金日`}
                                          />
                                        )}
                                      </td>
                                      <td className={`px-2 py-2 border-r border-gray-300 align-middle ${rowBgClass}`}>
                                        <div className="flex items-center gap-1 min-w-0">
                                          {scheduleRowLocked ? (
                                            <div
                                              className={`${COL_INPUT_LOCKED_CLASS} truncate flex-1 min-w-0`}
                                              title={scheduleRow.memo}
                                              aria-label={`${member.name}・${subjectName}のメモ（入金済）`}
                                            >
                                              {scheduleRow.memo || "-"}
                                            </div>
                                          ) : (
                                            <input
                                              type="text"
                                              value={scheduleRow.memo}
                                              onChange={(e) =>
                                                setPaymentRowByKey(dr.paymentKey, { memo: e.target.value })
                                              }
                                              className={`flex-1 min-w-0 px-2 py-1.5 text-left text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#67a384] bg-white text-[#374151] ${showAddLineBtn ? "max-w-[calc(100%-4.75rem)]" : ""}`}
                                              aria-label={`${member.name}・${subjectName}のメモ`}
                                            />
                                          )}
                                          {showAddLineBtn && (
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              disabled={isLocked}
                                              className="shrink-0 h-8 px-1.5 text-[10px] border-[#67a384] text-[#67a384] hover:bg-[#ECF8F2] whitespace-nowrap"
                                              onClick={() =>
                                                handleColAddPaymentLine(member.id, schedule, dr.paymentKey)
                                              }
                                              aria-label={`${member.name}・${subjectName}に入金段を追加`}
                                            >
                                              <Plus className="h-3.5 w-3.5 mr-0.5 inline-block" />
                                              追加する
                                            </Button>
                                          )}
                                        </div>
                                      </td>
                                    </>
                                  )
                                })()
                              )}

                              {firstGlobal && (
                                <td rowSpan={totalRows} className={`px-2 py-2 text-left align-middle ${bg}`}>
                                  {inputDisabled ? (
                                    <span className="text-xs text-[#9CA3AF]">予定なし</span>
                                  ) : isMemberRegistered ? (
                                    isMemberEditing ? (
                                      <div className="flex gap-1.5 w-full min-w-[7.5rem]">
                                        <Button
                                          type="button"
                                          size="sm"
                                          disabled={isLocked}
                                          className="flex-1 text-white text-xs px-2 h-8"
                                          style={{ backgroundColor: "#67a384" }}
                                          onClick={() => handleColSaveEdit(member)}
                                        >
                                          保存
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="flex-1 text-xs px-2 h-8 border-gray-400 text-gray-600 bg-white hover:bg-gray-50"
                                          onClick={() => handleColCancelEdit(member)}
                                        >
                                          キャンセル
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={isLocked}
                                        className="w-full text-xs px-3 border-[#67a384] text-[#67a384] hover:bg-[#ECF8F2]"
                                        onClick={() => handleColEditStart(member)}
                                      >
                                        編集する
                                      </Button>
                                    )
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={isLocked}
                                      className="w-full text-white text-xs px-3"
                                      style={{ backgroundColor: "#67a384" }}
                                      onClick={() => handleColRegister(member)}
                                    >
                                      登録する
                                    </Button>
                                  )}
                                </td>
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
      ) : showCsvFields ? (
        <BankCsvImportSection
          categories={categories}
          accountTitles={accountTitles}
          cashAccountTitles={accountTitles.filter((t) => t.group === "cash")}
          transactions={transactions}
          onImported={() => setTransactions(getTransactions())}
          registerDisabled={isLocked}
        />
      ) : (
      /* ===== 他のタブ: 既存フォーム ===== */
      <div
        className={`flex-1 grid gap-0 min-h-0 transition-[grid-template-columns] duration-300 ${
          showReceiptArea ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
        }`}
      >
        <div
          className={`overflow-y-auto bg-white ${
            showReceiptArea ? "border-r border-gray-200" : ""
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

              {showTransferFields && transferEditState && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-medium text-amber-900">
                    振替の編集モードです。登録すると元の振替（出金・入金の対）は置き換えられます。
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setTransferEditState(null)
                      resetForm()
                    }}
                    className="text-xs font-semibold text-amber-900 underline hover:no-underline"
                  >
                    編集をやめる
                  </button>
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
                  value={formatAmountInputDisplay(formData.amount)}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/,/g, "")
                    // 振替は常に「正の金額」のみ許容（誤入力で符号が逆転しないように）
                    const sanitized = showTransferFields ? rawValue.replace(/-/g, "") : rawValue
                    if (isAllowedSignedIntegerTyping(sanitized)) {
                      setFormData((prev) => ({ ...prev, amount: sanitized }))
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

              {showTransferFields && transferEditState ? (
                // 振替の編集中のみ：左＝キャンセル（控えめ）、右＝更新（メイン）。ボタン群はフォーム右寄せ
                <div className="flex w-full justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      // 入力内容を破棄して直前の画面（出納帳・登録履歴など）へ戻る
                      setTransferEditState(null)
                      router.back()
                    }}
                    className="shrink-0 py-3 px-5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-[#6B7280] hover:bg-gray-50 hover:text-[#374151]"
                  >
                    キャンセル
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLocked}
                    className="shrink-0 py-3 px-6 text-sm font-semibold text-white rounded-lg shadow-sm"
                    style={{ backgroundColor: THEME_COLOR }}
                  >
                    振替を更新する
                  </Button>
                </div>
              ) : (
                <Button
                  type="submit"
                  disabled={isLocked}
                  className="w-full py-6 text-base font-semibold text-white rounded-lg"
                  style={{ backgroundColor: THEME_COLOR }}
                >
                  登録する
                </Button>
              )}
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

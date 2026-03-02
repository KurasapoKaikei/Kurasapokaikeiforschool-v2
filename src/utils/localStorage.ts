// LocalStorage用のユーティリティ関数
import type { CollectionPaymentStatus } from "@/types"
export type { CollectionPaymentStatus } from "@/types"

export interface Category {
  id: string
  name: string
  order: number
  isUsed: boolean
}

export interface AccountTitle {
  id: string
  group: "cash" | "income" | "expense"
  name: string
  /** 紐づけるカテゴリーID。現金・預金（group===cash）の場合は空配列（共通）を許容する */
  categoryIds: string[]
  balance: number | null
  order: number
  isUsed: boolean
}

export interface Transaction {
  id: string
  date: string
  type: "income" | "expense" | "transfer" | "collection" | "deferred"
  amount: number
  counterparty: string
  category: string
  accountTitle: string
  memo: string
  receiptUrl: string | null
  createdAt: string
}

/** 月次備考データ（科目ID + 年月ごとに保存） */
export interface MonthlyNote {
  /** キー: `${subjectId}_${year}-${month}` 形式 */
  key: string
  subjectId: string
  year: number
  month: number
  note: string
}

export interface Member {
  id: string
  name: string
  grade: number // 1〜4
  email: string
  status: "active" | "retired" // 在席中 / 退部
  retiredAt: string | null // 退部日（YYYY-MM-DD）
  createdAt: string
}

/** 集金予定（スケジュール） */
export interface CollectionSchedule {
  id: string
  name: string
  amount: number
  targetMonth: string // "YYYY-MM"
  dueDate: string // "YYYY-MM-DD"
  categoryName?: string
  accountTitleName?: string
  counterpartyName?: string
  memo?: string
  /** 同一設定から一括作成されたスケジュールを束ねるID */
  groupId?: string
  /** 設定時の対象部員数 */
  memberCount?: number
  /** 設定時の対象月数 */
  monthCount?: number
  /** 設定時に選択された部員IDの配列 */
  memberIds?: string[]
  createdAt: string
}

/** 個別入金履歴エントリ */
export interface PaymentHistoryEntry {
  amount: number
  date: string
  memo: string
  transactionId: string
}

/** 集金実績レコード（部員×集金予定） */
export interface CollectionRecord {
  id: string
  scheduleId: string
  memberId: string
  status: CollectionPaymentStatus
  paidAt: string | null
  paidAmount?: number
  linkedTransactionId?: string | null
  paymentHistory?: PaymentHistoryEntry[]
  createdAt: string
}

let _idCounter = 0
function uniqueId(): string {
  const now = Date.now()
  _idCounter++
  return `${now}_${_idCounter}_${Math.random().toString(36).slice(2, 7)}`
}

const STORAGE_KEYS = {
  CATEGORIES: "classapo_categories",
  ACCOUNT_TITLES: "classapo_account_titles",
  TRANSACTIONS: "classapo_transactions",
  MONTHLY_NOTES: "classapo_monthly_notes",
  MEMBERS: "classapo_members",
  COLLECTION_SCHEDULES: "classapo_collection_schedules",
  COLLECTION_RECORDS: "classapo_collection_records",
  COLLECTION_RESET_MARKER: "classapo_collection_reset_marker",
} as const

/**
 * 集金機能のデータリセットを1回だけ適用するバージョンキー。
 * UI/ロジックは維持し、集金設定・集金実績・集金取引のみ初期化する。
 */
const COLLECTION_RESET_VERSION = "2026-02-25-reset-v1"

const applyCollectionDataResetOnce = (): void => {
  if (typeof window === "undefined") return
  const applied = localStorage.getItem(STORAGE_KEYS.COLLECTION_RESET_MARKER)
  if (applied === COLLECTION_RESET_VERSION) return

  // 1) 集金設定・集金実績を完全クリア
  localStorage.removeItem(STORAGE_KEYS.COLLECTION_SCHEDULES)
  localStorage.removeItem(STORAGE_KEYS.COLLECTION_RECORDS)

  // 2) 取引データから「集金登録」で作成された実績のみ除去（他の帳簿データは維持）
  const rawTx = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)
  if (rawTx) {
    try {
      const parsed = JSON.parse(rawTx) as Transaction[]
      const kept = parsed.filter((t) => t.type !== "collection")
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(kept))
    } catch {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]))
    }
  }

  localStorage.setItem(STORAGE_KEYS.COLLECTION_RESET_MARKER, COLLECTION_RESET_VERSION)
}

// カテゴリー関連
export const getCategories = (): Category[] => {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(STORAGE_KEYS.CATEGORIES)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return []
    }
  }
  // 初期値
  return [
    { id: "1", name: "部会計", order: 1, isUsed: false },
    { id: "2", name: "合宿会計", order: 2, isUsed: false },
    { id: "3", name: "遠征費", order: 3, isUsed: false },
  ]
}

export const saveCategories = (categories: Category[]): void => {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories))
}

// 科目関連
export const getAccountTitles = (): AccountTitle[] => {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(STORAGE_KEYS.ACCOUNT_TITLES)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return []
    }
  }
  // 初期値
  return [
    {
      id: "1",
      group: "cash",
      name: "現金",
      categoryIds: ["1"],
      balance: 50000,
      order: 1,
      isUsed: false,
    },
    {
      id: "2",
      group: "cash",
      name: "メイン銀行",
      categoryIds: ["1", "2"],
      balance: 500000,
      order: 2,
      isUsed: false,
    },
    {
      id: "3",
      group: "income",
      name: "会費収入",
      categoryIds: ["1"],
      balance: null,
      order: 1,
      isUsed: false,
    },
    {
      id: "4",
      group: "expense",
      name: "消耗品費",
      categoryIds: ["1", "2"],
      balance: null,
      order: 1,
      isUsed: false,
    },
  ]
}

export const saveAccountTitles = (accountTitles: AccountTitle[]): void => {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.ACCOUNT_TITLES, JSON.stringify(accountTitles))
}

// 取引関連
export const getTransactions = (): Transaction[] => {
  if (typeof window === "undefined") return []
  applyCollectionDataResetOnce()
  const stored = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return []
    }
  }
  return []
}

export const saveTransactions = (transactions: Transaction[]): void => {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions))
}

export const addTransaction = (transaction: Omit<Transaction, "id" | "createdAt">): Transaction => {
  const transactions = getTransactions()
  const newTransaction: Transaction = {
    ...transaction,
    id: uniqueId(),
    createdAt: new Date().toISOString(),
  }
  const updatedTransactions = [...transactions, newTransaction]
  saveTransactions(updatedTransactions)
  return newTransaction
}

export const deleteTransaction = (id: string): boolean => {
  const transactions = getTransactions()
  const filtered = transactions.filter((t) => t.id !== id)
  if (filtered.length === transactions.length) return false
  saveTransactions(filtered)
  return true
}

export const updateTransaction = (
  id: string,
  updates: Partial<Omit<Transaction, "id" | "createdAt">>
): Transaction | null => {
  const transactions = getTransactions()
  const idx = transactions.findIndex((t) => t.id === id)
  if (idx < 0) return null
  const updated: Transaction = {
    ...transactions[idx],
    ...updates,
    id: transactions[idx].id,
    createdAt: transactions[idx].createdAt,
  }
  const newList = [...transactions]
  newList[idx] = updated
  saveTransactions(newList)
  return updated
}

// 月次備考関連
export const getMonthlyNotes = (): MonthlyNote[] => {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(STORAGE_KEYS.MONTHLY_NOTES)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return []
    }
  }
  return []
}

export const saveMonthlyNotes = (notes: MonthlyNote[]): void => {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.MONTHLY_NOTES, JSON.stringify(notes))
}

/** 月次備考を取得（科目ID + 年月で検索） */
export const getMonthlyNote = (subjectId: string, year: number, month: number): string => {
  const notes = getMonthlyNotes()
  const key = `${subjectId}_${year}-${month}`
  const found = notes.find((n) => n.key === key)
  return found?.note ?? ""
}

/** 月次備考を保存（科目ID + 年月で保存） */
export const saveMonthlyNote = (subjectId: string, year: number, month: number, note: string): void => {
  const notes = getMonthlyNotes()
  const key = `${subjectId}_${year}-${month}`
  const idx = notes.findIndex((n) => n.key === key)
  if (idx >= 0) {
    notes[idx].note = note
  } else {
    notes.push({ key, subjectId, year, month, note })
  }
  saveMonthlyNotes(notes)
}

// 部員関連
export const getMembers = (): Member[] => {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(STORAGE_KEYS.MEMBERS)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return []
    }
  }
  return []
}

export const saveMembers = (members: Member[]): void => {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members))
}

export const addMember = (member: Omit<Member, "id" | "createdAt">): Member => {
  const members = getMembers()
  const newMember: Member = {
    ...member,
    id: uniqueId(),
    createdAt: new Date().toISOString(),
  }
  saveMembers([...members, newMember])
  // 既存の集金予定に対して UNPAID レコードを自動生成
  syncCollectionRecordsForMember(newMember.id)
  return newMember
}

export const updateMember = (
  id: string,
  updates: Partial<Omit<Member, "id" | "createdAt">>
): Member | null => {
  const members = getMembers()
  const idx = members.findIndex((m) => m.id === id)
  if (idx < 0) return null
  const updated: Member = {
    ...members[idx],
    ...updates,
    id: members[idx].id,
    createdAt: members[idx].createdAt,
  }
  const newList = [...members]
  newList[idx] = updated
  saveMembers(newList)
  return updated
}

// ===== 集金予定（スケジュール）関連 =====

export const getCollectionSchedules = (): CollectionSchedule[] => {
  if (typeof window === "undefined") return []
  applyCollectionDataResetOnce()
  const stored = localStorage.getItem(STORAGE_KEYS.COLLECTION_SCHEDULES)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return []
    }
  }
  return []
}

export const saveCollectionSchedules = (schedules: CollectionSchedule[]): void => {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.COLLECTION_SCHEDULES, JSON.stringify(schedules))
}

export const addCollectionSchedule = (
  schedule: Omit<CollectionSchedule, "id" | "createdAt">
): CollectionSchedule => {
  const schedules = getCollectionSchedules()
  const newSchedule: CollectionSchedule = {
    ...schedule,
    id: uniqueId(),
    createdAt: new Date().toISOString(),
  }
  saveCollectionSchedules([...schedules, newSchedule])

  // 全在籍部員に対して UNPAID レコードを自動生成
  const members = getMembers().filter((m) => m.status === "active")
  const records = getCollectionRecords()
  const newRecords: CollectionRecord[] = members.map((m) => ({
    id: `${newSchedule.id}_${m.id}`,
    scheduleId: newSchedule.id,
    memberId: m.id,
    status: "UNPAID",
    paidAt: null,
    createdAt: new Date().toISOString(),
  }))
  saveCollectionRecords([...records, ...newRecords])

  return newSchedule
}

/**
 * 特定の部員IDリストに対してのみレコードを生成するスケジュール登録
 */
export const addCollectionScheduleForMembers = (
  schedule: Omit<CollectionSchedule, "id" | "createdAt">,
  memberIds: string[]
): CollectionSchedule => {
  const schedules = getCollectionSchedules()
  const newSchedule: CollectionSchedule = {
    ...schedule,
    id: uniqueId(),
    createdAt: new Date().toISOString(),
  }
  saveCollectionSchedules([...schedules, newSchedule])

  const records = getCollectionRecords()
  const newRecords: CollectionRecord[] = memberIds.map((memberId) => ({
    id: `${newSchedule.id}_${memberId}`,
    scheduleId: newSchedule.id,
    memberId,
    status: "UNPAID" as const,
    paidAt: null,
    createdAt: new Date().toISOString(),
  }))
  saveCollectionRecords([...records, ...newRecords])

  return newSchedule
}

/**
 * スケジュールを更新し、未納レコードの金額も連動更新する
 */
export const updateCollectionSchedule = (
  id: string,
  updates: Partial<Omit<CollectionSchedule, "id" | "createdAt">>
): CollectionSchedule | null => {
  const schedules = getCollectionSchedules()
  const idx = schedules.findIndex((s) => s.id === id)
  if (idx < 0) return null
  schedules[idx] = { ...schedules[idx], ...updates }
  saveCollectionSchedules(schedules)

  if (updates.amount !== undefined) {
    const records = getCollectionRecords()
    for (const r of records) {
      if (r.scheduleId === id && r.status === "UNPAID") {
        r.paidAmount = undefined
      }
    }
    saveCollectionRecords(records)
  }
  return schedules[idx]
}

export const deleteCollectionSchedule = (id: string): boolean => {
  const schedules = getCollectionSchedules()
  const filtered = schedules.filter((s) => s.id !== id)
  if (filtered.length === schedules.length) return false
  saveCollectionSchedules(filtered)
  // 関連レコードも削除
  const records = getCollectionRecords().filter((r) => r.scheduleId !== id)
  saveCollectionRecords(records)
  return true
}

// ===== 集金実績レコード関連 =====

export const getCollectionRecords = (): CollectionRecord[] => {
  if (typeof window === "undefined") return []
  applyCollectionDataResetOnce()
  const stored = localStorage.getItem(STORAGE_KEYS.COLLECTION_RECORDS)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return []
    }
  }
  return []
}

export const saveCollectionRecords = (records: CollectionRecord[]): void => {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.COLLECTION_RECORDS, JSON.stringify(records))
}

export const updateCollectionRecord = (
  id: string,
  updates: Partial<Pick<CollectionRecord, "status" | "paidAt" | "paidAmount" | "linkedTransactionId" | "paymentHistory">>
): CollectionRecord | null => {
  const records = getCollectionRecords()
  const idx = records.findIndex((r) => r.id === id)
  if (idx < 0) return null
  records[idx] = { ...records[idx], ...updates }
  saveCollectionRecords(records)
  return records[idx]
}

/**
 * 部員登録時に呼び出す: 全既存スケジュールに対して UNPAID レコードを自動生成
 */
export const syncCollectionRecordsForMember = (memberId: string): void => {
  const schedules = getCollectionSchedules()
  if (schedules.length === 0) return
  const records = getCollectionRecords()
  const existingScheduleIds = new Set(
    records.filter((r) => r.memberId === memberId).map((r) => r.scheduleId)
  )
  const targetSchedules = schedules.filter((s) => {
    if (existingScheduleIds.has(s.id)) return false
    if (s.memberIds && s.memberIds.length > 0) {
      return s.memberIds.includes(memberId)
    }
    return true
  })
  const newRecords: CollectionRecord[] = targetSchedules.map((s) => ({
    id: `${s.id}_${memberId}`,
    scheduleId: s.id,
    memberId,
    status: "UNPAID" as const,
    paidAt: null,
    createdAt: new Date().toISOString(),
  }))
  if (newRecords.length > 0) {
    saveCollectionRecords([...records, ...newRecords])
  }
}

/**
 * 集金実績ページで呼び出す: 全部員×全スケジュールの欠損レコードを補完
 */
export const syncAllCollectionRecords = (): void => {
  const schedules = getCollectionSchedules()
  const members = getMembers()
  if (schedules.length === 0 || members.length === 0) return

  const records = getCollectionRecords()
  const existingKeys = new Set(records.map((r) => `${r.scheduleId}_${r.memberId}`))

  const newRecords: CollectionRecord[] = []
  for (const schedule of schedules) {
    const targetMembers = schedule.memberIds && schedule.memberIds.length > 0
      ? members.filter((m) => schedule.memberIds!.includes(m.id))
      : members
    for (const member of targetMembers) {
      const key = `${schedule.id}_${member.id}`
      if (!existingKeys.has(key)) {
        newRecords.push({
          id: key,
          scheduleId: schedule.id,
          memberId: member.id,
          status: "UNPAID",
          paidAt: null,
          createdAt: new Date().toISOString(),
        })
      }
    }
  }
  if (newRecords.length > 0) {
    saveCollectionRecords([...records, ...newRecords])
  }
}

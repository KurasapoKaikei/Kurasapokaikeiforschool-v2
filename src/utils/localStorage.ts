// LocalStorage用のユーティリティ関数
import type { CollectionPaymentStatus } from "@/types"
import { getCollectionPaymentStatus } from "@/types"
import {
  CLUB_MEMBERS_BASE_KEY,
  clubMembersStorageKey,
  dispatchClubMembersChanged,
} from "@/lib/clubMembers"
import { resolveActiveClubSession } from "@/lib/activeClubSession"
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
  /** CSV 一括取込で同一バッチに紐づけるID（手動登録時は undefined） */
  csvImportId?: string | null
  /** CSV 取込時の元ファイル名（手動登録時は undefined） */
  originalFileName?: string | null
  /** 集金取引の場合に、該当部員へドリルダウンするための補助情報 */
  collectionMemberId?: string
  /** 集金取引の場合に、該当集金設定へドリルダウンするための補助情報 */
  collectionScheduleId?: string
  /**
   * 振替取引の対（出金元 expense + 入金先 income）を束ねるID。
   * 同一IDを持つ2件で1つの振替を表す。履歴の集約表示・編集時の同期に使用。
   */
  transferGroupId?: string | null
  /** 登録した作業者名（担当者設定の氏名 or 未設定） */
  createdBy?: string | null
  /** 最終編集を行った作業者名（未編集なら null/undefined） */
  updatedBy?: string | null
  /** 最終編集日時（ISO 文字列）。未編集なら null/undefined */
  lastEditedAt?: string | null
  createdAt: string
}

/** CSV ファイル単位の取込履歴 */
export interface CsvImportBatch {
  id: string
  fileName: string
  /** 正規化後テキストの SHA-256（hex） */
  contentHash: string
  registeredAt: string
  transactionIds: string[]
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

export interface SystemSettings {
  /** システム利用初年度の前期繰越金（期首残高） */
  openingCarryover: number | null
  /** 旧ロックフラグ（互換維持用）。実際の編集可否は年度判定で制御する */
  openingCarryoverLocked: boolean
  /**
   * 年度更新（次年度繰越）完了日時。
   * null の間は初年度運用として扱う。
   * TODO: 年度更新機能実装時に本値を更新し、過去年度の繰越金を編集不可にする。
   */
  yearRolloverCompletedAt: string | null
}

export interface BudgetSetting {
  id: string
  fiscalYear: number
  categoryId: string
  accountTitleId: string
  amount: number
  updatedAt: string
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
  SYSTEM_SETTINGS: "classapo_system_settings",
  BUDGET_SETTINGS: "classapo_budget_settings",
  CSV_IMPORT_BATCHES: "classapo_csv_import_batches",
  /** クラブの担当者名簿（設定画面と UserInfo の staffNames と同期） */
  CLUB_PROFILE: "classapo_club_profile",
  /** 現在チェックイン中の作業者氏名（未選択時はキーなし／空） */
  CURRENT_OPERATOR: "classapo_current_operator",
} as const

function readStorageJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeStorageJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return
  localStorage.setItem(key, JSON.stringify(value))
}

/**
 * 集金機能のデータリセットを1回だけ適用するバージョンキー。
 * UI/ロジックは維持し、集金設定・集金実績・集金取引のみ初期化する。
 */
const COLLECTION_RESET_VERSION = "2026-02-25-reset-v1"
const COLLECTION_SCHEDULE_FISCAL_2026_MIGRATION_VERSION = "2026-05-06-fy2026-v1"

/** CSV 取込明細へ originalFileName を遡及付与（1回のみ） */
const TX_ORIGINAL_FILENAME_BACKFILL_VERSION = "2026-04-30-v1"

const applyTransactionOriginalFileNameBackfillOnce = (): void => {
  if (typeof window === "undefined") return
  const markerKey = "classapo_tx_original_filename_backfill"
  if (localStorage.getItem(markerKey) === TX_ORIGINAL_FILENAME_BACKFILL_VERSION) return

  const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)
  if (!raw) {
    localStorage.setItem(markerKey, TX_ORIGINAL_FILENAME_BACKFILL_VERSION)
    return
  }
  try {
    const txs = JSON.parse(raw) as Transaction[]
    const batches = readStorageJson<CsvImportBatch[]>(STORAGE_KEYS.CSV_IMPORT_BATCHES, [])
    const nameByBatchId = new Map(batches.map((b) => [b.id, b.fileName.trim()]))
    let changed = false
    const next = txs.map((t) => {
      if (t.csvImportId && !t.originalFileName) {
        const fn = nameByBatchId.get(t.csvImportId)
        if (fn) {
          changed = true
          return { ...t, originalFileName: fn }
        }
      }
      return t
    })
    if (changed) {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(next))
    }
  } catch {
    /* ignore */
  }
  localStorage.setItem(markerKey, TX_ORIGINAL_FILENAME_BACKFILL_VERSION)
}

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

function shiftFiscalYear2025To2026Ym(raw: string): string {
  const m = raw.trim().match(/^(\d{4})-(\d{1,2})$/)
  if (!m) return raw
  const year = Number(m[1])
  const month = Number(m[2])
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return raw
  const inFy2025 = (year === 2025 && month >= 4) || (year === 2026 && month <= 3)
  if (!inFy2025) return `${year}-${String(month).padStart(2, "0")}`
  return `${year + 1}-${String(month).padStart(2, "0")}`
}

function shiftFiscalYear2025To2026Date(raw: string): string {
  const m = raw.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return raw
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return raw
  }
  const inFy2025 = (year === 2025 && month >= 4) || (year === 2026 && month <= 3)
  const nextYear = inFy2025 ? year + 1 : year
  return `${nextYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

const applyCollectionScheduleFiscalYear2026MigrationOnce = (): void => {
  if (typeof window === "undefined") return
  const markerKey = "classapo_collection_schedule_fy2026_migration"
  if (localStorage.getItem(markerKey) === COLLECTION_SCHEDULE_FISCAL_2026_MIGRATION_VERSION) return

  const raw = localStorage.getItem(STORAGE_KEYS.COLLECTION_SCHEDULES)
  if (!raw) {
    localStorage.setItem(markerKey, COLLECTION_SCHEDULE_FISCAL_2026_MIGRATION_VERSION)
    return
  }

  try {
    const parsed = JSON.parse(raw) as CollectionSchedule[]
    let changed = false
    const next = parsed.map((s) => {
      const nextTargetMonth = shiftFiscalYear2025To2026Ym(s.targetMonth || "")
      const nextDueDate = shiftFiscalYear2025To2026Date(s.dueDate || "")
      if (nextTargetMonth !== s.targetMonth || nextDueDate !== s.dueDate) {
        changed = true
        return { ...s, targetMonth: nextTargetMonth, dueDate: nextDueDate }
      }
      return s
    })
    if (changed) {
      localStorage.setItem(STORAGE_KEYS.COLLECTION_SCHEDULES, JSON.stringify(next))
    }
  } catch {
    // no-op
  }

  localStorage.setItem(markerKey, COLLECTION_SCHEDULE_FISCAL_2026_MIGRATION_VERSION)
}

function parseMonthFromTargetMonth(targetMonth?: string): number | null {
  if (!targetMonth) return null
  const m = Number(targetMonth.split("-")[1])
  if (!Number.isFinite(m) || m < 1 || m > 12) return null
  return m
}

function formatCollectionMemo(memberName: string, targetMonth?: string): string {
  const month = parseMonthFromTargetMonth(targetMonth)
  if (month == null) return `集金（${memberName}）`
  return `[${month}月分] 集金（${memberName}）`
}

/**
 * 既存の集金実績（COMPLETED）を走査し、帳簿用の collection 取引を不足分だけ補完/同期する。
 * - category / accountTitle / counterparty は集金設定を優先
 * - memo は「[●月分] 集金（部員氏名）」へ統一
 * - receiptUrl は null（表示側で「ー」扱い）
 *
 * v2.9 §6.8「集金画面でのマイナス入力（返金）の台帳反映」対応:
 * - `paymentHistory.length > 0` のレコードは、集金画面側（`handleColRegister` /
 *   `handleSaveHistoryEdit`）で `addTransaction` / `updateTransaction` 経由で
 *   **すべての tx を完全管理済み**である。本 sync が `schedule.amount`（プラス値）で
 *   上書きすると、ユーザーが入力した負の金額（返金）が消えてしまうため、
 *   本ケースでは同期処理をスキップする。
 * - `paymentHistory` を持たない旧データ（status=COMPLETED のみで paidAmount のみ持つ）に対しては
 *   従来通り 1 件の collection 取引を補完/同期する。
 *
 * NOTE:
 * - 既存の取引履歴を破壊しないため、同一レコードに紐づく既存取引があれば更新、
 *   見つからない場合のみ新規作成する。
 */
const syncCollectionTransactionsFromRecords = (): void => {
  if (typeof window === "undefined") return

  const schedules = readStorageJson<CollectionSchedule[]>(STORAGE_KEYS.COLLECTION_SCHEDULES, [])
  const records = readStorageJson<CollectionRecord[]>(STORAGE_KEYS.COLLECTION_RECORDS, [])
  const members = readStorageJson<Member[]>(STORAGE_KEYS.MEMBERS, [])
  const transactions = readStorageJson<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, [])

  if (schedules.length === 0 || records.length === 0 || members.length === 0) return

  const scheduleMap = new Map(schedules.map((s) => [s.id, s]))
  const memberMap = new Map(members.map((m) => [m.id, m]))

  let txChanged = false
  let recordChanged = false
  const nextTransactions = [...transactions]
  const nextRecords = [...records]

  records.forEach((record, recordIndex) => {
    if (record.status !== "COMPLETED") return

    // v2.9 §6.8: paymentHistory ベースのレコードは集金画面側で個別 tx を完全管理しているため、
    // sync 側の上書きを行わない（マイナス入力＝返金の amount を保持するため必須）。
    if ((record.paymentHistory?.length ?? 0) > 0) return

    const schedule = scheduleMap.get(record.scheduleId)
    const member = memberMap.get(record.memberId)
    if (!schedule || !member) return

    const date = record.paidAt || new Date().toISOString().slice(0, 10)
    const targetMemo = formatCollectionMemo(member.name, schedule.targetMonth)
    const targetCategory = schedule.categoryName || "集金"
    const targetAccountTitle = schedule.accountTitleName || schedule.name || "会費収入"
    const targetCounterparty = schedule.counterpartyName || "現金"
    const targetAmount = schedule.amount

    let txIndex = -1
    if (record.linkedTransactionId) {
      txIndex = nextTransactions.findIndex(
        (t) => t.id === record.linkedTransactionId && t.type === "collection"
      )
    }
    if (txIndex < 0) {
      txIndex = nextTransactions.findIndex(
        (t) =>
          t.type === "collection" &&
          t.collectionMemberId === record.memberId &&
          t.collectionScheduleId === record.scheduleId
      )
    }
    if (txIndex < 0) {
      txIndex = nextTransactions.findIndex((t) => {
        if (t.type !== "collection") return false
        if (t.collectionScheduleId && t.collectionScheduleId !== record.scheduleId) return false
        if (t.collectionMemberId && t.collectionMemberId !== record.memberId) return false
        return (
          t.date === date &&
          t.amount === targetAmount &&
          t.category === targetCategory &&
          t.accountTitle === targetAccountTitle &&
          t.counterparty === targetCounterparty &&
          t.memo === targetMemo
        )
      })
    }

    if (txIndex >= 0) {
      const current = nextTransactions[txIndex]
      const patched: Transaction = {
        ...current,
        date,
        type: "collection",
        amount: targetAmount,
        counterparty: targetCounterparty,
        category: targetCategory,
        accountTitle: targetAccountTitle,
        memo: targetMemo,
        receiptUrl: null,
        collectionMemberId: record.memberId,
        collectionScheduleId: record.scheduleId,
      }
      if (JSON.stringify(current) !== JSON.stringify(patched)) {
        nextTransactions[txIndex] = patched
        txChanged = true
      }
      if (record.linkedTransactionId !== patched.id) {
        nextRecords[recordIndex] = {
          ...record,
          linkedTransactionId: patched.id,
        }
        recordChanged = true
      }
      return
    }

    const created: Transaction = {
      id: uniqueId(),
      date,
      type: "collection",
      amount: targetAmount,
      counterparty: targetCounterparty,
      category: targetCategory,
      accountTitle: targetAccountTitle,
      memo: targetMemo,
      receiptUrl: null,
      collectionMemberId: record.memberId,
      collectionScheduleId: record.scheduleId,
      createdAt: new Date().toISOString(),
    }
    nextTransactions.push(created)
    nextRecords[recordIndex] = {
      ...record,
      linkedTransactionId: created.id,
    }
    txChanged = true
    recordChanged = true
  })

  if (txChanged) writeStorageJson(STORAGE_KEYS.TRANSACTIONS, nextTransactions)
  if (recordChanged) writeStorageJson(STORAGE_KEYS.COLLECTION_RECORDS, nextRecords)
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
  return []
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
  return []
}

export const saveAccountTitles = (accountTitles: AccountTitle[]): void => {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.ACCOUNT_TITLES, JSON.stringify(accountTitles))
}

// システム設定（前期繰越金など）
export const getSystemSettings = (): SystemSettings => {
  if (typeof window === "undefined") {
    return { openingCarryover: null, openingCarryoverLocked: false, yearRolloverCompletedAt: null }
  }
  const stored = localStorage.getItem(STORAGE_KEYS.SYSTEM_SETTINGS)
  if (!stored) {
    return { openingCarryover: null, openingCarryoverLocked: false, yearRolloverCompletedAt: null }
  }
  try {
    const parsed = JSON.parse(stored) as Partial<SystemSettings>
    return {
      openingCarryover:
        typeof parsed.openingCarryover === "number" && Number.isFinite(parsed.openingCarryover)
          ? parsed.openingCarryover
          : null,
      openingCarryoverLocked: parsed.openingCarryoverLocked === true,
      yearRolloverCompletedAt:
        typeof parsed.yearRolloverCompletedAt === "string" && parsed.yearRolloverCompletedAt.trim() !== ""
          ? parsed.yearRolloverCompletedAt
          : null,
    }
  } catch {
    return { openingCarryover: null, openingCarryoverLocked: false, yearRolloverCompletedAt: null }
  }
}

export const saveSystemSettings = (settings: SystemSettings): void => {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.SYSTEM_SETTINGS, JSON.stringify(settings))
}

/** クラブ担当者名簿（Prisma Club.staffNames のブラウザ側キャッシュ・最大5名） */
export interface ClubProfile {
  staffNames: string[]
}

export const getClubProfile = (): ClubProfile => {
  const raw = readStorageJson<Partial<ClubProfile>>(STORAGE_KEYS.CLUB_PROFILE, {})
  const arr = Array.isArray(raw.staffNames) ? raw.staffNames : []
  const names = arr
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5)
  return { staffNames: names }
}

export const saveClubProfile = (profile: ClubProfile): void => {
  const names = profile.staffNames.map((s) => String(s).trim()).filter(Boolean).slice(0, 5)
  writeStorageJson(STORAGE_KEYS.CLUB_PROFILE, { staffNames: names })
}

/** マイページ等で表示する「現在の作業者」 */
export const getCurrentOperator = (): string | null => {
  if (typeof window === "undefined") return null
  const v = localStorage.getItem(STORAGE_KEYS.CURRENT_OPERATOR)
  if (v == null) return null
  const t = v.trim()
  return t === "" ? null : t
}

export const setCurrentOperator = (name: string | null): void => {
  if (typeof window === "undefined") return
  if (name == null || name.trim() === "") {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_OPERATOR)
    return
  }
  localStorage.setItem(STORAGE_KEYS.CURRENT_OPERATOR, name.trim())
}

// 予算設定（年度 × カテゴリー × 科目）
export const getBudgetSettings = (): BudgetSetting[] => {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(STORAGE_KEYS.BUDGET_SETTINGS)
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored) as Partial<BudgetSetting>[]
    return parsed
      .filter(
        (item) =>
          typeof item.id === "string" &&
          typeof item.fiscalYear === "number" &&
          typeof item.categoryId === "string" &&
          typeof item.accountTitleId === "string" &&
          typeof item.amount === "number" &&
          Number.isFinite(item.amount) &&
          typeof item.updatedAt === "string"
      )
      .map((item) => ({
        id: item.id!,
        fiscalYear: item.fiscalYear!,
        categoryId: item.categoryId!,
        accountTitleId: item.accountTitleId!,
        amount: item.amount!,
        updatedAt: item.updatedAt!,
      }))
  } catch {
    return []
  }
}

export const saveBudgetSettings = (settings: BudgetSetting[]): void => {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.BUDGET_SETTINGS, JSON.stringify(settings))
}

export const upsertBudgetSetting = (input: {
  fiscalYear: number
  categoryId: string
  accountTitleId: string
  amount: number
}): BudgetSetting => {
  const settings = getBudgetSettings()
  const idx = settings.findIndex(
    (s) =>
      s.fiscalYear === input.fiscalYear &&
      s.categoryId === input.categoryId &&
      s.accountTitleId === input.accountTitleId
  )
  const next: BudgetSetting = {
    id: idx >= 0 ? settings[idx].id : uniqueId(),
    fiscalYear: input.fiscalYear,
    categoryId: input.categoryId,
    accountTitleId: input.accountTitleId,
    amount: input.amount,
    updatedAt: new Date().toISOString(),
  }
  if (idx >= 0) {
    settings[idx] = next
  } else {
    settings.push(next)
  }
  saveBudgetSettings(settings)
  return next
}

// 取引関連
export const getTransactions = (): Transaction[] => {
  if (typeof window === "undefined") return []
  applyCollectionDataResetOnce()
  applyTransactionOriginalFileNameBackfillOnce()
  // 既存の集金実績を台帳取引へ遡及同期し、常時整合を担保する
  syncCollectionTransactionsFromRecords()
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

/** sync を挟まず LocalStorage から取引一覧を読む（集金の連続登録用） */
const readTransactionsWithoutSync = (): Transaction[] => {
  if (typeof window === "undefined") return []
  applyCollectionDataResetOnce()
  applyTransactionOriginalFileNameBackfillOnce()
  const stored = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)
  if (!stored) return []
  try {
    return JSON.parse(stored) as Transaction[]
  } catch {
    return []
  }
}

/**
 * 集金画面から複数科目を一括登録するとき用。
 * 行ごとに `addTransaction`（内部で sync 実行）を呼ぶと、2 段目以降の取引が
 * sync 側の突合で潰れることがあるため、sync なしでまとめて追加する。
 */
export const addCollectionRegisterTransactions = (
  items: Omit<Transaction, "id" | "createdAt">[]
): Transaction[] => {
  if (typeof window === "undefined" || items.length === 0) return []
  const transactions = readTransactionsWithoutSync()
  const created: Transaction[] = items.map((item) => ({
    ...item,
    id: uniqueId(),
    createdAt: new Date().toISOString(),
  }))
  saveTransactions([...transactions, ...created])
  return created
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
  const victim = transactions.find((t) => t.id === id)
  const filtered = transactions.filter((t) => t.id !== id)
  if (filtered.length === transactions.length) return false
  saveTransactions(filtered)
  if (victim?.csvImportId) {
    removeTransactionIdFromCsvBatch(victim.csvImportId, id)
  }
  return true
}

/**
 * 取引が「振替の片側レコード」かどうかを判定する。
 *
 * 振替は出金元（expense）と入金先（income）の2レコードで1組として保存しているため、
 * 収支集計や科目別台帳では本ヘルパーで両レコードを除外して計上することで、
 * 「振替が支出/収入として二重計上される」「現金・預金科目が支出科目として現れる」
 * といった集計ノイズを防ぐ。
 *
 * 判定ロジック:
 * - `transferGroupId` が付与されているレコードは確実に振替片側
 * - 旧データ（transferGroupId なし）でも、登録時に付与した memo プレフィックスで識別
 */
export const isTransferLeg = (t: Pick<Transaction, "type" | "memo" | "transferGroupId">): boolean => {
  if (t.transferGroupId) return true
  if (t.type === "expense" && /^振替（出金）/.test(t.memo ?? "")) return true
  if (t.type === "income" && /^振替（入金）/.test(t.memo ?? "")) return true
  return false
}

export const updateTransaction = (
  id: string,
  updates: Partial<Omit<Transaction, "id" | "createdAt">>
): Transaction | null => {
  const transactions = getTransactions()
  const idx = transactions.findIndex((t) => t.id === id)
  if (idx < 0) return null
  // 編集日時は呼び出し側が明示しなくても自動付与する
  const lastEditedAt = updates.lastEditedAt ?? new Date().toISOString()
  const updated: Transaction = {
    ...transactions[idx],
    ...updates,
    lastEditedAt,
    id: transactions[idx].id,
    createdAt: transactions[idx].createdAt,
  }
  const newList = [...transactions]
  newList[idx] = updated
  saveTransactions(newList)
  return updated
}

// --- CSV 一括取込バッチ（履歴・二重登録防止・一括削除） ---

export const getCsvImportBatches = (): CsvImportBatch[] => {
  if (typeof window === "undefined") return []
  return readStorageJson<CsvImportBatch[]>(STORAGE_KEYS.CSV_IMPORT_BATCHES, [])
}

export const saveCsvImportBatches = (batches: CsvImportBatch[]): void => {
  writeStorageJson(STORAGE_KEYS.CSV_IMPORT_BATCHES, batches)
}

/** 内容ハッシュまたはファイル名が既存バッチと重複する場合はメッセージを返す（ファイル名を優先） */
export const findCsvImportConflict = (fileName: string, contentHash: string): string | null => {
  const batches = getCsvImportBatches()
  const name = fileName.trim()
  if (name && batches.some((b) => b.fileName.trim() === name)) {
    return "このファイルは既に登録されています。修正したい場合は履歴画面から操作してください"
  }
  if (batches.some((b) => b.contentHash === contentHash)) {
    return "同じ内容のCSVは既に登録されています。登録を中止しました。"
  }
  return null
}

/** 取込バッチを作成し、取引を一括で追加する */
export const createCsvImportBatchAndTransactions = (
  meta: { fileName: string; contentHash: string },
  partials: Omit<Transaction, "id" | "createdAt" | "csvImportId" | "originalFileName">[]
): CsvImportBatch => {
  const batchId = uniqueId()
  const registeredAt = new Date().toISOString()
  const origName = meta.fileName.trim()
  const existing = getTransactions()
  const newTxs: Transaction[] = partials.map((p) => ({
    ...p,
    csvImportId: batchId,
    originalFileName: origName,
    id: uniqueId(),
    createdAt: registeredAt,
  }))
  saveTransactions([...existing, ...newTxs])
  const batch: CsvImportBatch = {
    id: batchId,
    fileName: meta.fileName.trim(),
    contentHash: meta.contentHash,
    registeredAt,
    transactionIds: newTxs.map((t) => t.id),
  }
  saveCsvImportBatches([...getCsvImportBatches(), batch])
  return batch
}

/** バッチに紐づく取引をすべて削除し、バッチ記録も削除 */
export const deleteCsvImportBatch = (batchId: string): boolean => {
  const batches = getCsvImportBatches()
  if (!batches.some((b) => b.id === batchId)) return false
  const txs = getTransactions().filter((t) => t.csvImportId !== batchId)
  saveTransactions(txs)
  saveCsvImportBatches(batches.filter((b) => b.id !== batchId))
  return true
}

export const getTransactionsByCsvImportId = (batchId: string): Transaction[] => {
  return getTransactions()
    .filter((t) => t.csvImportId === batchId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
}

/** 台帳から個別削除された行に合わせ、バッチの transactionIds を整合 */
export const syncCsvImportBatchFromTransactions = (batchId: string): void => {
  const txs = getTransactions().filter((t) => t.csvImportId === batchId)
  const ids = [...txs]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map((t) => t.id)
  const batches = getCsvImportBatches()
  const idx = batches.findIndex((b) => b.id === batchId)
  if (idx < 0) return
  if (ids.length === 0) {
    saveCsvImportBatches(batches.filter((b) => b.id !== batchId))
    return
  }
  const next = [...batches]
  next[idx] = { ...batches[idx], transactionIds: ids }
  saveCsvImportBatches(next)
}

function removeTransactionIdFromCsvBatch(batchId: string, txId: string): void {
  const batches = getCsvImportBatches()
  const idx = batches.findIndex((b) => b.id === batchId)
  if (idx < 0) return
  const b = batches[idx]
  const nextIds = b.transactionIds.filter((id) => id !== txId)
  if (nextIds.length === 0) {
    saveCsvImportBatches(batches.filter((x) => x.id !== batchId))
  } else {
    const next = [...batches]
    next[idx] = { ...b, transactionIds: nextIds }
    saveCsvImportBatches(next)
  }
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
function getMembersStorageKey(): string {
  const active = resolveActiveClubSession()
  if (active?.id) return clubMembersStorageKey(active.id)
  return CLUB_MEMBERS_BASE_KEY
}

function readMembersFromKey(key: string): Member[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(key)
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored) as Member[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function markClubPortalHasDataFlag(clubId: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(`kurasaokaikei-club-has-portal-data-${clubId}`, "1")
}

/** ログインクラブのスコープキーへ、レガシー全体キーからの初回移行 */
function migrateLegacyMembersToScopedClub(clubId: string, scopedKey: string): Member[] {
  const legacy = readMembersFromKey(CLUB_MEMBERS_BASE_KEY)
  if (legacy.length === 0) return []
  localStorage.setItem(scopedKey, JSON.stringify(legacy))
  markClubPortalHasDataFlag(clubId)
  dispatchClubMembersChanged(clubId)
  return legacy
}

export const getMembers = (): Member[] => {
  const key = getMembersStorageKey()
  let members = readMembersFromKey(key)
  const active = resolveActiveClubSession()
  if (active?.id && members.length === 0 && key !== CLUB_MEMBERS_BASE_KEY) {
    members = migrateLegacyMembersToScopedClub(active.id, key)
  }
  return members
}

export const saveMembers = (members: Member[]): void => {
  if (typeof window === "undefined") return
  const key = getMembersStorageKey()
  localStorage.setItem(key, JSON.stringify(members))
  const active = resolveActiveClubSession()
  if (active?.id) {
    markClubPortalHasDataFlag(active.id)
    dispatchClubMembersChanged(active.id)
  } else {
    dispatchClubMembersChanged()
  }
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

const COLLECTION_SCHEDULE_MASTER_REPAIR_VERSION = "collection_schedule_master_repair_v2"

function normalizeMasterName(value: string | undefined | null): string {
  return (value ?? "").trim()
}

function masterNamesEqual(stored: string | undefined | null, masterName: string): boolean {
  return normalizeMasterName(stored) === normalizeMasterName(masterName)
}

/** マスタに存在しない名称を、部分一致が1件だけのとき現行マスタ名へ救済 */
function resolveOrphanMasterName(
  stored: string,
  masterNames: string[]
): string | null {
  const trimmed = normalizeMasterName(stored)
  if (!trimmed) return null
  if (masterNames.some((n) => n === trimmed)) return null
  const candidates = masterNames.filter(
    (n) => trimmed.startsWith(n) || n.startsWith(trimmed) || trimmed.includes(n) || n.includes(trimmed)
  )
  if (candidates.length === 1) return candidates[0]
  return null
}

/**
 * 集金設定に残った古い口座名・科目名・カテゴリー名を、現行マスタへ自動同期（読み込み時救済）。
 */
function repairCollectionSchedulesAgainstMasters(schedules: CollectionSchedule[]): CollectionSchedule[] {
  if (typeof window === "undefined" || schedules.length === 0) return schedules

  const accountTitles = readStorageJson<AccountTitle[]>(STORAGE_KEYS.ACCOUNT_TITLES, [])
  const categories = readStorageJson<Category[]>(STORAGE_KEYS.CATEGORIES, [])
  const cashNames = accountTitles.filter((t) => t.group === "cash").map((t) => normalizeMasterName(t.name))
  const incomeNames = accountTitles.filter((t) => t.group === "income").map((t) => normalizeMasterName(t.name))
  const categoryNames = categories.map((c) => normalizeMasterName(c.name))

  let changed = false
  const repaired = schedules.map((s) => {
    let next = { ...s }

    const cp = normalizeMasterName(next.counterpartyName)
    if (cp) {
      const fixedCp = resolveOrphanMasterName(cp, cashNames)
      if (fixedCp && fixedCp !== cp) {
        next.counterpartyName = fixedCp
        changed = true
      }
    }

    const acctField = normalizeMasterName(next.accountTitleName)
    const nameField = normalizeMasterName(next.name)
    const effectiveIncome = acctField || (incomeNames.includes(nameField) ? nameField : "")
    if (effectiveIncome) {
      const fixedAcct = resolveOrphanMasterName(effectiveIncome, incomeNames)
      if (fixedAcct && fixedAcct !== effectiveIncome) {
        if (acctField) next.accountTitleName = fixedAcct
        else if (nameField === effectiveIncome) next.name = fixedAcct
        changed = true
      }
    } else if (acctField) {
      const fixedAcct = resolveOrphanMasterName(acctField, incomeNames)
      if (fixedAcct && fixedAcct !== acctField) {
        next.accountTitleName = fixedAcct
        changed = true
      }
    }

    const cat = normalizeMasterName(next.categoryName)
    if (cat) {
      const fixedCat = resolveOrphanMasterName(cat, categoryNames)
      if (fixedCat && fixedCat !== cat) {
        next.categoryName = fixedCat
        changed = true
      }
    }

    return next
  })

  if (changed) {
    writeStorageJson(STORAGE_KEYS.COLLECTION_SCHEDULES, repaired)
  }
  return repaired
}

function applyCollectionScheduleMasterRepairOnce(): void {
  if (typeof window === "undefined") return
  const markerKey = "classapo_collection_schedule_master_repair_marker"
  if (localStorage.getItem(markerKey) === COLLECTION_SCHEDULE_MASTER_REPAIR_VERSION) return
  const raw = readStorageJson<CollectionSchedule[]>(STORAGE_KEYS.COLLECTION_SCHEDULES, [])
  repairCollectionSchedulesAgainstMasters(raw)
  localStorage.setItem(markerKey, COLLECTION_SCHEDULE_MASTER_REPAIR_VERSION)
}

export const getCollectionSchedules = (): CollectionSchedule[] => {
  if (typeof window === "undefined") return []
  applyCollectionDataResetOnce()
  applyCollectionScheduleFiscalYear2026MigrationOnce()
  applyCollectionScheduleMasterRepairOnce()
  const schedules = readStorageJson<CollectionSchedule[]>(STORAGE_KEYS.COLLECTION_SCHEDULES, [])
  return repairCollectionSchedulesAgainstMasters(schedules)
}

export const saveCollectionSchedules = (schedules: CollectionSchedule[]): void => {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.COLLECTION_SCHEDULES, JSON.stringify(schedules))
}

/**
 * 集金設定（CollectionSchedule[]）に格納された **カテゴリー名** を、旧名 → 新名に一括置換する。
 *
 * 設計判断:
 * - CollectionSchedule.categoryName は **ID ではなく名称（文字列）** で保存されているため、
 *   マスタの名称が変わると参照が外れる可能性がある。これを防ぐため、マスタ側の rename と同時に
 *   本ヘルパーで集金設定側の値も書き換える。
 * - 厳密一致（trim 後の文字列同値）で照合する。空文字・無変更は即時 no-op。
 * - 戻り値は更新件数（UI 側のトースト等で「N 件の集金設定にも反映」と表示できる）。
 *
 * v2.9 §6.7「名称変更の集金設定への自動波及」で参照される。
 */
export const renameCategoryInTransactions = (oldName: string, newName: string): number => {
  if (typeof window === "undefined") return 0
  const oldTrimmed = normalizeMasterName(oldName)
  const newTrimmed = normalizeMasterName(newName)
  if (!oldTrimmed || !newTrimmed || oldTrimmed === newTrimmed) return 0
  const transactions = readTransactionsWithoutSync()
  let changed = 0
  const updated = transactions.map((t) => {
    if (!masterNamesEqual(t.category, oldTrimmed)) return t
    changed++
    return { ...t, category: newTrimmed }
  })
  if (changed > 0) saveTransactions(updated)
  return changed
}

export const renameCategoryInCollectionSchedules = (
  oldName: string,
  newName: string
): number => {
  if (typeof window === "undefined") return 0
  const oldTrimmed = normalizeMasterName(oldName)
  const newTrimmed = normalizeMasterName(newName)
  if (!oldTrimmed || !newTrimmed || oldTrimmed === newTrimmed) return 0
  const schedules = readStorageJson<CollectionSchedule[]>(STORAGE_KEYS.COLLECTION_SCHEDULES, [])
  let changed = 0
  const updated = schedules.map((s) => {
    if (!masterNamesEqual(s.categoryName, oldTrimmed)) return s
    changed++
    return { ...s, categoryName: newTrimmed }
  })
  if (changed > 0) saveCollectionSchedules(updated)
  return changed
}

/**
 * 集金設定（CollectionSchedule[]）に格納された **科目名（収入科目）** を、旧名 → 新名に一括置換する。
 *
 * `renameCategoryInCollectionSchedules` と同じ理由（名称ベースの保存）で、
 * 科目マスタの rename と同時に書き換える。
 *
 * 対象は **収入科目（AccountTitle.group === "income"）**。
 * 現金預金科目（group === "cash"）は `counterpartyName` に保存されており、
 * `renameCashAccountInCollectionSchedules` で別途書き換える。
 *
 * v2.9 §6.7「名称変更の集金設定への自動波及」で参照される。
 */
export const renameAccountTitleInTransactions = (oldName: string, newName: string): number => {
  if (typeof window === "undefined") return 0
  const oldTrimmed = normalizeMasterName(oldName)
  const newTrimmed = normalizeMasterName(newName)
  if (!oldTrimmed || !newTrimmed || oldTrimmed === newTrimmed) return 0
  const transactions = readTransactionsWithoutSync()
  let changed = 0
  const updated = transactions.map((t) => {
    if (!masterNamesEqual(t.accountTitle, oldTrimmed)) return t
    changed++
    return { ...t, accountTitle: newTrimmed }
  })
  if (changed > 0) saveTransactions(updated)
  return changed
}

export const renameAccountTitleInCollectionSchedules = (
  oldName: string,
  newName: string
): number => {
  if (typeof window === "undefined") return 0
  const oldTrimmed = normalizeMasterName(oldName)
  const newTrimmed = normalizeMasterName(newName)
  if (!oldTrimmed || !newTrimmed || oldTrimmed === newTrimmed) return 0
  const schedules = readStorageJson<CollectionSchedule[]>(STORAGE_KEYS.COLLECTION_SCHEDULES, [])
  let changed = 0
  const updated = schedules.map((s) => {
    let next = s
    let hit = false
    if (masterNamesEqual(s.accountTitleName, oldTrimmed)) {
      next = { ...next, accountTitleName: newTrimmed }
      hit = true
    }
    if (!normalizeMasterName(s.accountTitleName) && masterNamesEqual(s.name, oldTrimmed)) {
      next = { ...next, name: newTrimmed }
      hit = true
    }
    if (hit) {
      changed++
      return next
    }
    return s
  })
  if (changed > 0) saveCollectionSchedules(updated)
  return changed
}

/**
 * 集金設定（CollectionSchedule[]）に格納された **入金先口座名（現金預金科目）** を、旧名 → 新名に一括置換する。
 *
 * 集金設定 UI（`/collection/settings`）では入金先口座を `AccountTitle.group === "cash"` の中から
 * 選択し、その **name** が `CollectionSchedule.counterpartyName` に保存される。
 * ここを書き換えないと、口座名のリネーム後に編集画面で入金先が「未設定」に見えてしまうため、
 * 現金預金科目のリネームと同時に必ず本ヘルパーを呼ぶ。
 *
 * v2.9 §6.7「名称変更の集金設定への自動波及」で参照される。
 */
export const renameCashAccountInTransactions = (oldName: string, newName: string): number => {
  if (typeof window === "undefined") return 0
  const oldTrimmed = normalizeMasterName(oldName)
  const newTrimmed = normalizeMasterName(newName)
  if (!oldTrimmed || !newTrimmed || oldTrimmed === newTrimmed) return 0
  const transactions = readTransactionsWithoutSync()
  let changed = 0
  const updated = transactions.map((t) => {
    if (!masterNamesEqual(t.counterparty, oldTrimmed)) return t
    changed++
    return { ...t, counterparty: newTrimmed }
  })
  if (changed > 0) saveTransactions(updated)
  return changed
}

export const renameCashAccountInCollectionSchedules = (
  oldName: string,
  newName: string
): number => {
  if (typeof window === "undefined") return 0
  const oldTrimmed = normalizeMasterName(oldName)
  const newTrimmed = normalizeMasterName(newName)
  if (!oldTrimmed || !newTrimmed || oldTrimmed === newTrimmed) return 0
  const schedules = readStorageJson<CollectionSchedule[]>(STORAGE_KEYS.COLLECTION_SCHEDULES, [])
  let changed = 0
  const updated = schedules.map((s) => {
    if (!masterNamesEqual(s.counterpartyName, oldTrimmed)) return s
    changed++
    return { ...s, counterpartyName: newTrimmed }
  })
  if (changed > 0) saveCollectionSchedules(updated)
  return changed
}

/** マスタ名称変更を集金設定＋仕訳へ一括波及（設定画面から呼ぶ） */
export const propagateMasterRename = (
  kind: "category" | "income" | "cash",
  oldName: string,
  newName: string
): { schedules: number; transactions: number } => {
  if (kind === "category") {
    return {
      schedules: renameCategoryInCollectionSchedules(oldName, newName),
      transactions: renameCategoryInTransactions(oldName, newName),
    }
  }
  if (kind === "income") {
    return {
      schedules: renameAccountTitleInCollectionSchedules(oldName, newName),
      transactions: renameAccountTitleInTransactions(oldName, newName),
    }
  }
  return {
    schedules: renameCashAccountInCollectionSchedules(oldName, newName),
    transactions: renameCashAccountInTransactions(oldName, newName),
  }
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

/**
 * 集金実績の入金済み総額（符号付き算術合計）。
 * - paymentHistory がある場合は各段の amount を合算（transactionId があれば取引の amount を優先）
 * - 旧データは paidAmount、取引のみの場合は該当 collection 取引の合計にフォールバック
 */
export const sumCollectionRecordNetPaid = (
  record: CollectionRecord,
  transactions?: Transaction[]
): number => {
  const history = record.paymentHistory ?? []
  if (history.length > 0) {
    return history.reduce((sum, entry) => {
      const txAmount =
        entry.transactionId && transactions
          ? transactions.find((t) => t.id === entry.transactionId)?.amount
          : undefined
      const n = Number(txAmount ?? entry.amount)
      return sum + (Number.isFinite(n) ? n : 0)
    }, 0)
  }
  if (transactions) {
    const fromTx = transactions
      .filter(
        (t) =>
          t.type === "collection" &&
          t.collectionMemberId === record.memberId &&
          t.collectionScheduleId === record.scheduleId
      )
      .reduce((sum, t) => {
        const n = Number(t.amount)
        return sum + (Number.isFinite(n) ? n : 0)
      }, 0)
    if (fromTx !== 0) return fromTx
  }
  const paid = Number(record.paidAmount)
  return Number.isFinite(paid) ? paid : 0
}

/**
 * paymentHistory / 取引から paidAmount・status を再計算し、不整合を修復する。
 */
export const reconcileCollectionRecordsPaidAmount = (): void => {
  if (typeof window === "undefined") return

  const records = readStorageJson<CollectionRecord[]>(STORAGE_KEYS.COLLECTION_RECORDS, [])
  if (records.length === 0) return

  const schedules = readStorageJson<CollectionSchedule[]>(STORAGE_KEYS.COLLECTION_SCHEDULES, [])
  const transactions = readTransactionsWithoutSync()
  const scheduleMap = new Map(schedules.map((s) => [s.id, s]))

  let changed = false
  const next = records.map((record) => {
    const computed = sumCollectionRecordNetPaid(record, transactions)
    const stored = record.paidAmount ?? 0
    if (computed === stored) return record

    const expected = scheduleMap.get(record.scheduleId)?.amount ?? 0
    changed = true
    return {
      ...record,
      paidAmount: computed,
      status: getCollectionPaymentStatus(computed, expected),
    }
  })

  if (changed) saveCollectionRecords(next)
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

  reconcileCollectionRecordsPaidAmount()

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

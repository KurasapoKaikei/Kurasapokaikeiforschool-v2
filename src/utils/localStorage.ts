// LocalStorage用のユーティリティ関数

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

const STORAGE_KEYS = {
  CATEGORIES: "classapo_categories",
  ACCOUNT_TITLES: "classapo_account_titles",
  TRANSACTIONS: "classapo_transactions",
  MONTHLY_NOTES: "classapo_monthly_notes",
} as const

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
    id: Date.now().toString(),
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

/**
 * 学校共通カテゴリーの利用判定・当年度限定の名称波及
 * - 削除可否: いずれかのクラブで当年度に1件でも仕訳があれば削除不可
 * - 過年度仕訳は参照・変更しない
 */

import { loadSchoolClubs } from "@/lib/schoolClubs"
import type { PortalFiscalYearLabel } from "@/lib/portalBrand"
import { normalizeNameForCompare } from "@/utils/nameNormalize"
import type { Transaction } from "@/utils/localStorage"

const TRANSACTIONS_BASE_KEY = "classapo_transactions"

function readJsonArray<T>(key: string): T[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as T[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeJsonArray<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(key, JSON.stringify(value))
}

/** 「2026年度」→ 2026 */
export function parsePortalFiscalYearLabel(
  label: PortalFiscalYearLabel | string
): number {
  const m = String(label).match(/(\d{4})/)
  if (m) return Number(m[1])
  const now = new Date()
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
}

/**
 * 会計年度 Y（4月始まり）の日付範囲
 * 例: 2026年度 → 2026-04-01 〜 2027-03-31
 */
export function getFiscalYearDateRange(fiscalYear: number): {
  start: string
  end: string
} {
  return {
    start: `${fiscalYear}-04-01`,
    end: `${fiscalYear + 1}-03-31`,
  }
}

export function isDateInFiscalYear(
  dateStr: string,
  fiscalYear: number
): boolean {
  const d = String(dateStr ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
  const { start, end } = getFiscalYearDateRange(fiscalYear)
  return d >= start && d <= end
}

/** 全クラブ（＋レガシーグローバル）の仕訳キー一覧 */
function listTransactionStorageKeys(): string[] {
  const keys = new Set<string>([TRANSACTIONS_BASE_KEY])
  for (const club of loadSchoolClubs()) {
    if (club.id?.trim()) {
      keys.add(`${TRANSACTIONS_BASE_KEY}__${club.id.trim()}`)
    }
  }
  return [...keys]
}

/** 全クラブの仕訳を読み取る（過年度含む・フィルタなし） */
export function loadAllClubTransactions(): Transaction[] {
  const all: Transaction[] = []
  for (const key of listTransactionStorageKeys()) {
    all.push(...readJsonArray<Transaction>(key))
  }
  return all
}

function categoryNamesMatch(a: string, b: string): boolean {
  return normalizeNameForCompare(a) === normalizeNameForCompare(b)
}

/**
 * 指定会計年度において、いずれかのクラブに当該カテゴリーの仕訳が1件でもあるか
 */
export function isCategoryUsedInFiscalYear(
  categoryName: string,
  fiscalYearLabel: PortalFiscalYearLabel | string
): boolean {
  const name = categoryName.trim()
  if (!name) return false
  const fiscalYear = parsePortalFiscalYearLabel(fiscalYearLabel)
  return loadAllClubTransactions().some(
    (t) =>
      categoryNamesMatch(t.category, name) &&
      isDateInFiscalYear(t.date, fiscalYear)
  )
}

/**
 * カテゴリー一覧に当年度利用フラグ（isUsed）を付与
 */
export function applyFiscalYearUsageToCategories<
  T extends { name: string; isUsed: boolean },
>(categories: T[], fiscalYearLabel: PortalFiscalYearLabel | string): T[] {
  return categories.map((c) => ({
    ...c,
    isUsed: isCategoryUsedInFiscalYear(c.name, fiscalYearLabel),
  }))
}

/**
 * 名称変更を「指定会計年度の仕訳のみ」全クラブへ波及（過年度は変更しない）
 */
export function renameCategoryInFiscalYearAcrossClubs(
  oldName: string,
  newName: string,
  fiscalYearLabel: PortalFiscalYearLabel | string
): number {
  const oldTrimmed = oldName.trim()
  const newTrimmed = newName.trim()
  if (!oldTrimmed || !newTrimmed || categoryNamesMatch(oldTrimmed, newTrimmed)) {
    return 0
  }
  const fiscalYear = parsePortalFiscalYearLabel(fiscalYearLabel)
  let changed = 0
  for (const key of listTransactionStorageKeys()) {
    const txs = readJsonArray<Transaction>(key)
    let keyChanged = 0
    const updated = txs.map((t) => {
      if (!categoryNamesMatch(t.category, oldTrimmed)) return t
      if (!isDateInFiscalYear(t.date, fiscalYear)) return t
      keyChanged++
      return { ...t, category: newTrimmed }
    })
    if (keyChanged > 0) {
      writeJsonArray(key, updated)
      changed += keyChanged
    }
  }
  return changed
}

/**
 * 科目が当年度仕訳で使用されているか
 * （accountTitle または現金預金の counterparty）
 */
export function isAccountTitleUsedInFiscalYear(
  titleName: string,
  fiscalYearLabel: PortalFiscalYearLabel | string
): boolean {
  const name = titleName.trim()
  if (!name) return false
  const fiscalYear = parsePortalFiscalYearLabel(fiscalYearLabel)
  return loadAllClubTransactions().some(
    (t) =>
      isDateInFiscalYear(t.date, fiscalYear) &&
      (categoryNamesMatch(t.accountTitle, name) ||
        categoryNamesMatch(t.counterparty, name))
  )
}

export function applyFiscalYearUsageToAccountTitles<
  T extends { name: string; isUsed: boolean },
>(titles: T[], fiscalYearLabel: PortalFiscalYearLabel | string): T[] {
  return titles.map((t) => ({
    ...t,
    isUsed: isAccountTitleUsedInFiscalYear(t.name, fiscalYearLabel),
  }))
}

/** 科目名変更を当年度仕訳のみ全クラブへ波及（accountTitle / counterparty） */
export function renameAccountTitleInFiscalYearAcrossClubs(
  oldName: string,
  newName: string,
  fiscalYearLabel: PortalFiscalYearLabel | string
): number {
  const oldTrimmed = oldName.trim()
  const newTrimmed = newName.trim()
  if (!oldTrimmed || !newTrimmed || categoryNamesMatch(oldTrimmed, newTrimmed)) {
    return 0
  }
  const fiscalYear = parsePortalFiscalYearLabel(fiscalYearLabel)
  let changed = 0
  for (const key of listTransactionStorageKeys()) {
    const txs = readJsonArray<Transaction>(key)
    let keyChanged = 0
    const updated = txs.map((t) => {
      if (!isDateInFiscalYear(t.date, fiscalYear)) return t
      let next = t
      let touched = false
      if (categoryNamesMatch(t.accountTitle, oldTrimmed)) {
        next = { ...next, accountTitle: newTrimmed }
        touched = true
      }
      if (categoryNamesMatch(t.counterparty, oldTrimmed)) {
        next = { ...next, counterparty: newTrimmed }
        touched = true
      }
      if (touched) keyChanged++
      return next
    })
    if (keyChanged > 0) {
      writeJsonArray(key, updated)
      changed += keyChanged
    }
  }
  return changed
}

/**
 * 科目の初期残高（現金は科目単位、収入・支出はカテゴリー別）
 */

import { isSystemInitialYear } from "@/lib/openingBalanceLabel"
import type { AccountTitle } from "@/utils/localStorage"

export function normalizeCategoryBalances(
  raw: unknown,
  categoryIds: string[]
): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!categoryIds.includes(key)) continue
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function sumCategoryBalances(
  categoryBalances: Record<string, number> | undefined
): number | null {
  if (!categoryBalances) return null
  const values = Object.values(categoryBalances)
  if (values.length === 0) return null
  return values.reduce((sum, n) => sum + n, 0)
}

/** 旧データ（balance のみ）を先頭カテゴリーへ移行しつつ正規化 */
export function resolveCategoryBalances(title: AccountTitle): Record<string, number> | undefined {
  const categoryIds = title.group === "cash" ? [] : [...(title.categoryIds ?? [])]
  let categoryBalances = normalizeCategoryBalances(title.categoryBalances, categoryIds)
  if (
    !categoryBalances &&
    title.group !== "cash" &&
    typeof title.balance === "number" &&
    Number.isFinite(title.balance) &&
    categoryIds.length > 0
  ) {
    categoryBalances = { [categoryIds[0]]: title.balance }
  }
  return categoryBalances
}

export function getTitleBalanceTotal(title: AccountTitle): number | null {
  if (title.group === "cash") {
    return typeof title.balance === "number" && Number.isFinite(title.balance)
      ? title.balance
      : null
  }
  return sumCategoryBalances(resolveCategoryBalances(title))
}

export function getTitleBalanceForTab(
  title: AccountTitle,
  activeTab: string
): number | null {
  if (title.group === "cash") {
    return typeof title.balance === "number" && Number.isFinite(title.balance)
      ? title.balance
      : null
  }
  if (activeTab === "all") {
    return getTitleBalanceTotal(title)
  }
  const categoryBalances = resolveCategoryBalances(title)
  const value = categoryBalances?.[activeTab]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function withUpdatedBalanceForTab(
  title: AccountTitle,
  activeTab: string,
  amount: number | null
): AccountTitle {
  if (title.group === "cash") {
    return { ...title, balance: amount, categoryBalances: undefined }
  }

  const categoryIds = [...(title.categoryIds ?? [])]
  const nextBalances: Record<string, number> = {
    ...(resolveCategoryBalances(title) ?? {}),
  }

  if (activeTab === "all") {
    // 「すべて」では収入・支出の直接入力はしない（呼び出し側で防ぐ）
    return title
  }

  if (!categoryIds.includes(activeTab)) return title

  if (amount === null) {
    delete nextBalances[activeTab]
  } else {
    nextBalances[activeTab] = amount
  }

  const categoryBalances = normalizeCategoryBalances(nextBalances, categoryIds)
  return {
    ...title,
    categoryBalances,
    balance: sumCategoryBalances(categoryBalances),
  }
}

export function balanceDraftKey(titleId: string, activeTab: string): string {
  return `${titleId}::${activeTab}`
}

/**
 * 収支集計表・科目別台帳共通：利用初年度の収入・支出初期残高。
 * categoryTab は `"all"` またはカテゴリーID。
 */
export function getSubjectOpeningForSummary(
  title: AccountTitle | undefined,
  categoryTab: string
): number {
  if (!title) return 0
  if (!isSystemInitialYear()) return 0
  if (title.group !== "income" && title.group !== "expense") return 0
  return getTitleBalanceForTab(title, categoryTab) ?? 0
}

/** 会計年度の期首月（4月）。初期残高はこの月に計上する */
export const FISCAL_OPENING_MONTH = 4 as const

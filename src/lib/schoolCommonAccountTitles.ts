/**
 * 学校管理者ポータル：共通科目設定
 * - 共通カテゴリーと同仕様（全クラブ反映・追加権限）
 * - 学校正本に初期残高は持たない（各クラブが入力。同期時はクラブ残高を保持）
 * - 学校共通科目（現金・預金含む）の名称・カテゴリー・削除はクラブ不可（初期残高のみ可）
 * - 現金・預金のクラブ独自科目は追加権限オフでも常に追加・編集可
 */

import {
  isDateInFiscalYear,
  parsePortalFiscalYearLabel,
} from "@/lib/schoolCategoryUsage"
import type { PortalFiscalYearLabel } from "@/lib/portalBrand"
import {
  normalizeCategoryBalances,
  resolveCategoryBalances,
  sumCategoryBalances,
} from "@/lib/accountTitleBalances"
import {
  getAccountTitles,
  saveAccountTitles,
  type AccountTitle,
} from "@/utils/localStorage"

export const SCHOOL_COMMON_ACCOUNT_TITLES_STORAGE_KEY =
  "kurasaokaikei-school-common-account-titles"

export const SCHOOL_COMMON_ACCOUNT_TITLES_CHANGED_EVENT =
  "kurasaokaikei-school-common-account-titles-changed"

export const SCHOOL_ALLOW_CLUB_ACCOUNT_TITLE_ADD_KEY =
  "kurasaokaikei-school-allow-club-account-title-add"

function dispatchChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SCHOOL_COMMON_ACCOUNT_TITLES_CHANGED_EVENT))
}

export function getAllowClubAccountTitleAdd(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(SCHOOL_ALLOW_CLUB_ACCOUNT_TITLE_ADD_KEY) === "1"
}

export function setAllowClubAccountTitleAdd(allowed: boolean): void {
  if (typeof window === "undefined") return
  localStorage.setItem(
    SCHOOL_ALLOW_CLUB_ACCOUNT_TITLE_ADD_KEY,
    allowed ? "1" : "0"
  )
  dispatchChanged()
}

function isSameTitle(a: AccountTitle, b: AccountTitle): boolean {
  return a.id === b.id || a.name.trim() === b.name.trim()
}

function normalizeAccountTitles(
  titles: AccountTitle[],
  options?: { fromSchool?: boolean }
): AccountTitle[] {
  const markFromSchool = options?.fromSchool === true
  const buckets: Record<"cash" | "income" | "expense", AccountTitle[]> = {
    cash: [],
    income: [],
    expense: [],
  }
  const sorted = [...titles].sort((a, b) => {
    const g = { cash: 0, income: 1, expense: 2 }
    const ga = g[a.group] ?? 9
    const gb = g[b.group] ?? 9
    if (ga !== gb) return ga - gb
    return (a.order ?? 0) - (b.order ?? 0)
  })
  for (const t of sorted) {
    if (t.group !== "cash" && t.group !== "income" && t.group !== "expense") {
      continue
    }
    const name = String(t.name ?? "").trim()
    if (!name) continue
    const categoryIds = t.group === "cash" ? [] : [...(t.categoryIds ?? [])]
    const categoryBalances =
      t.group === "cash" ? undefined : resolveCategoryBalances(t)
    const balance =
      t.group === "cash"
        ? typeof t.balance === "number" && Number.isFinite(t.balance)
          ? t.balance
          : null
        : sumCategoryBalances(categoryBalances)
    buckets[t.group].push({
      id: String(t.id),
      group: t.group,
      name,
      categoryIds,
      balance,
      ...(categoryBalances ? { categoryBalances } : {}),
      order: buckets[t.group].length + 1,
      isUsed: Boolean(t.isUsed),
      ...(markFromSchool || t.fromSchool ? { fromSchool: true as const } : {}),
      ...(!markFromSchool && t.createdAt
        ? { createdAt: String(t.createdAt) }
        : {}),
    })
  }
  return [...buckets.cash, ...buckets.income, ...buckets.expense]
}

function getTitleCreatedDate(title: AccountTitle): string | null {
  if (title.createdAt) {
    const d = String(title.createdAt).slice(0, 10)
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
  }
  const m = /^(\d+)$/.exec(title.id)
  if (m) {
    const date = new Date(Number(m[1]))
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10)
  }
  const m2 = /^title-(\d+)$/.exec(title.id)
  if (m2) {
    const date = new Date(Number(m2[1]))
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10)
  }
  return null
}

export function hasSchoolCommonAccountTitlesConfigured(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(SCHOOL_COMMON_ACCOUNT_TITLES_STORAGE_KEY) != null
}

export function getSchoolCommonAccountTitles(): AccountTitle[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(SCHOOL_COMMON_ACCOUNT_TITLES_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AccountTitle[]
      if (Array.isArray(parsed)) {
        return normalizeAccountTitles(parsed, { fromSchool: true })
      }
    }
  } catch {
    /* fall through */
  }
  return []
}

export function getSchoolCommonAccountTitlesForEditor(): AccountTitle[] {
  if (hasSchoolCommonAccountTitlesConfigured()) {
    return getSchoolCommonAccountTitles()
  }
  return normalizeAccountTitles(getAccountTitles())
}

export function isSchoolCommonAccountTitle(title: AccountTitle): boolean {
  if (title.fromSchool) return true
  if (!hasSchoolCommonAccountTitlesConfigured()) return false
  const school = getSchoolCommonAccountTitles()
  return school.some((s) => isSameTitle(s, title))
}

export function getClubAddedAccountTitles(): AccountTitle[] {
  const school = getSchoolCommonAccountTitles()
  return getAccountTitles().filter(
    (t) => !t.fromSchool && !school.some((s) => isSameTitle(s, t))
  )
}

/**
 * 収入・支出のクラブ独自科目のみカウント（現金・預金は権限スイッチ対象外のため除外）
 */
export function countClubAddedNonCashAccountTitlesInFiscalYear(
  fiscalYearLabel: PortalFiscalYearLabel | string
): number {
  const fiscalYear = parsePortalFiscalYearLabel(fiscalYearLabel)
  return getClubAddedAccountTitles()
    .filter((t) => t.group !== "cash")
    .filter((t) => {
      const created = getTitleCreatedDate(t)
      if (!created) return true
      return isDateInFiscalYear(created, fiscalYear)
    }).length
}

/** @deprecated 互換用。権限判定は countClubAddedNonCashAccountTitlesInFiscalYear を使う */
export function countClubAddedAccountTitlesInFiscalYear(
  fiscalYearLabel: PortalFiscalYearLabel | string
): number {
  return countClubAddedNonCashAccountTitlesInFiscalYear(fiscalYearLabel)
}

export function canDisallowClubAccountTitleAdd(
  fiscalYearLabel: PortalFiscalYearLabel | string
): { ok: true } | { ok: false; count: number } {
  const count = countClubAddedNonCashAccountTitlesInFiscalYear(fiscalYearLabel)
  if (count > 0) return { ok: false, count }
  return { ok: true }
}

/**
 * 学校マスタの定義に、クラブ側で入力済みの初期残高を重ねる。
 * 学校共通科目（現金・預金含む）の名称・並びは学校正本を維持する。
 */
function applyClubOverridesToSchoolTitles(
  schoolTitles: AccountTitle[],
  existing: AccountTitle[]
): AccountTitle[] {
  return schoolTitles.map((s) => {
    const prev = existing.find((e) => e.id === s.id || isSameTitle(e, s))
    if (!prev) {
      return { ...s, balance: null, categoryBalances: undefined }
    }
    if (s.group === "cash") {
      const balance =
        typeof prev.balance === "number" && Number.isFinite(prev.balance)
          ? prev.balance
          : null
      return { ...s, balance, categoryBalances: undefined }
    }
    const categoryBalances = normalizeCategoryBalances(
      resolveCategoryBalances(prev),
      s.categoryIds
    )
    return {
      ...s,
      categoryBalances,
      balance: sumCategoryBalances(categoryBalances),
    }
  })
}

export function mergeSchoolAndClubAccountTitles(): AccountTitle[] {
  const school = getSchoolCommonAccountTitles()
  const existing = getAccountTitles()
  const clubOnly = existing.filter(
    (t) => !t.fromSchool && !school.some((s) => isSameTitle(s, t))
  )
  return normalizeAccountTitles([
    ...applyClubOverridesToSchoolTitles(school, existing),
    ...clubOnly.map((t) => ({ ...t, fromSchool: false as const })),
  ])
}

export function saveSchoolCommonAccountTitles(titles: AccountTitle[]): void {
  if (typeof window === "undefined") return
  // 学校正本には初期残高を持たない（各クラブが入力）
  const normalized = normalizeAccountTitles(
    titles.map((t) => ({ ...t, balance: null })),
    { fromSchool: true }
  )
  localStorage.setItem(
    SCHOOL_COMMON_ACCOUNT_TITLES_STORAGE_KEY,
    JSON.stringify(normalized)
  )
  const existing = getAccountTitles()
  const clubOnly = existing.filter(
    (t) => !t.fromSchool && !normalized.some((s) => isSameTitle(s, t))
  )
  saveAccountTitles(
    normalizeAccountTitles([
      ...applyClubOverridesToSchoolTitles(normalized, existing),
      ...clubOnly.map((t) => ({
        id: t.id,
        group: t.group,
        name: t.name,
        categoryIds: t.categoryIds,
        balance: t.balance,
        ...(t.categoryBalances ? { categoryBalances: { ...t.categoryBalances } } : {}),
        order: t.order,
        isUsed: t.isUsed,
        ...(t.createdAt ? { createdAt: t.createdAt } : {}),
      })),
    ])
  )
  dispatchChanged()
}

export function saveClubFacingAccountTitles(titles: AccountTitle[]): void {
  if (typeof window === "undefined") return
  const school = hasSchoolCommonAccountTitlesConfigured()
    ? getSchoolCommonAccountTitles()
    : []
  const clubOnly = titles
    .filter((t) => !isSchoolCommonAccountTitle(t))
    .map((t) => {
      const categoryIds = t.group === "cash" ? [] : [...t.categoryIds]
      const categoryBalances =
        t.group === "cash" ? undefined : resolveCategoryBalances(t)
      return {
        id: t.id,
        group: t.group,
        name: t.name.trim(),
        categoryIds,
        balance:
          t.group === "cash"
            ? t.balance
            : sumCategoryBalances(categoryBalances),
        ...(categoryBalances ? { categoryBalances } : {}),
        order: t.order,
        isUsed: Boolean(t.isUsed),
        ...(t.createdAt ? { createdAt: t.createdAt } : {}),
      }
    })
  // 学校共通の定義は学校正本、初期残高のみクラブ入力を優先
  const schoolWithClubOverrides = applyClubOverridesToSchoolTitles(school, titles)
  saveAccountTitles(
    school.length > 0
      ? normalizeAccountTitles([...schoolWithClubOverrides, ...clubOnly])
      : normalizeAccountTitles(titles)
  )
}

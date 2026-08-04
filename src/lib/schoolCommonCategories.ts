/**
 * 学校管理者ポータル：共通カテゴリー設定
 * - 学校が定義したカテゴリーを正本として保持
 * - 保存時にクラブが参照する `classapo_categories` へ同期し、全クラブへ反映する
 * - クラブ独自カテゴリー追加の許可フラグも管理する
 */

import {
  isDateInFiscalYear,
  parsePortalFiscalYearLabel,
} from "@/lib/schoolCategoryUsage"
import type { PortalFiscalYearLabel } from "@/lib/portalBrand"
import {
  getCategories,
  saveCategories,
  type Category,
} from "@/utils/localStorage"
import {
  listAllSchoolClubIds,
  readClubScopedJsonForClubId,
  writeClubScopedJsonForClubId,
} from "@/lib/clubScopedStorage"

export const SCHOOL_COMMON_CATEGORIES_STORAGE_KEY =
  "kurasaokaikei-school-common-categories"

/** クラブ側のカテゴリー保存ベースキー（`src/utils/localStorage.ts` の STORAGE_KEYS.CATEGORIES と一致） */
const CLUB_CATEGORIES_BASE_KEY = "classapo_categories"

export const SCHOOL_COMMON_CATEGORIES_CHANGED_EVENT =
  "kurasaokaikei-school-common-categories-changed"

/** クラブごとに独自カテゴリーを追加できるか（学校設定・既定 OFF） */
export const SCHOOL_ALLOW_CLUB_CATEGORY_ADD_KEY =
  "kurasaokaikei-school-allow-club-category-add"

function dispatchChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SCHOOL_COMMON_CATEGORIES_CHANGED_EVENT))
}

/** クラブ独自カテゴリー追加権限（未設定時は false = OFF） */
export function getAllowClubCategoryAdd(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(SCHOOL_ALLOW_CLUB_CATEGORY_ADD_KEY) === "1"
}

export function setAllowClubCategoryAdd(allowed: boolean): void {
  if (typeof window === "undefined") return
  localStorage.setItem(SCHOOL_ALLOW_CLUB_CATEGORY_ADD_KEY, allowed ? "1" : "0")
  dispatchChanged()
}

function getCategoryCreatedDate(category: Category): string | null {
  if (category.createdAt) {
    const d = String(category.createdAt).slice(0, 10)
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
  }
  const m = /^cat-(\d+)$/.exec(category.id)
  if (m) {
    const date = new Date(Number(m[1]))
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10)
    }
  }
  return null
}

/** クラブ独自カテゴリー一覧（学校共通以外） */
export function getClubAddedCategories(): Category[] {
  const school = getSchoolCommonCategories()
  return getCategories().filter(
    (c) => !c.fromSchool && !school.some((s) => isSameCategory(s, c))
  )
}

/**
 * 指定会計年度にクラブが追加した独自カテゴリー件数。
 * 作成日不明の独自カテゴリーは件数に含める（許可しないへの変更を安全側で阻止）。
 */
export function countClubAddedCategoriesInFiscalYear(
  fiscalYearLabel: PortalFiscalYearLabel | string
): number {
  const fiscalYear = parsePortalFiscalYearLabel(fiscalYearLabel)
  return getClubAddedCategories().filter((c) => {
    const created = getCategoryCreatedDate(c)
    if (!created) return true
    return isDateInFiscalYear(created, fiscalYear)
  }).length
}

/**
 * 「許可しない」へ変更可能か。
 * 当年度にクラブ独自カテゴリーが1件でもあれば不可。
 */
export function canDisallowClubCategoryAdd(
  fiscalYearLabel: PortalFiscalYearLabel | string
): { ok: true } | { ok: false; count: number } {
  const count = countClubAddedCategoriesInFiscalYear(fiscalYearLabel)
  if (count > 0) return { ok: false, count }
  return { ok: true }
}

function normalizeCategories(
  categories: Category[],
  options?: { fromSchool?: boolean }
): Category[] {
  const markFromSchool = options?.fromSchool === true
  return [...categories]
    .map((c, idx) => ({
      id: String(c.id),
      name: String(c.name ?? "").trim(),
      order: typeof c.order === "number" ? c.order : idx + 1,
      isUsed: Boolean(c.isUsed),
      ...(markFromSchool || c.fromSchool ? { fromSchool: true as const } : {}),
      ...(!markFromSchool && c.createdAt
        ? { createdAt: String(c.createdAt) }
        : {}),
    }))
    .filter((c) => c.name)
    .sort((a, b) => a.order - b.order)
    .map((c, idx) => ({ ...c, order: idx + 1 }))
}

/** 学校が登録した共通カテゴリーか（クラブ側の編集・削除判定用） */
export function isSchoolCommonCategory(category: Category): boolean {
  if (category.fromSchool) return true
  if (!hasSchoolCommonCategoriesConfigured()) return false
  const school = getSchoolCommonCategories()
  return school.some(
    (s) => s.id === category.id || s.name.trim() === category.name.trim()
  )
}

/** 学校が共通カテゴリーを一度でも保存済みか */
export function hasSchoolCommonCategoriesConfigured(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(SCHOOL_COMMON_CATEGORIES_STORAGE_KEY) != null
}

/**
 * 学校共通カテゴリーを取得。
 * 未設定時は空配列（学校画面の初回は既存クラブマスタをシード可能）。
 */
export function getSchoolCommonCategories(): Category[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(SCHOOL_COMMON_CATEGORIES_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Category[]
      if (Array.isArray(parsed)) {
        return normalizeCategories(parsed, { fromSchool: true })
      }
    }
  } catch {
    /* fall through */
  }
  return []
}

/** 学校画面初回用：未設定なら既存クラブマスタを初期表示用に取り込む（保存はしない） */
export function getSchoolCommonCategoriesForEditor(): Category[] {
  const configured = getSchoolCommonCategories()
  if (hasSchoolCommonCategoriesConfigured()) return configured
  return normalizeCategories(getCategories())
}

function isSameCategory(a: Category, b: Category): boolean {
  return a.id === b.id || a.name.trim() === b.name.trim()
}

/** クラブ側表示用：学校共通 + クラブ独自をマージ */
export function mergeSchoolAndClubCategories(): Category[] {
  const school = getSchoolCommonCategories()
  const existing = getCategories()
  const clubOnly = existing.filter(
    (c) => !c.fromSchool && !school.some((s) => isSameCategory(s, c))
  )
  return [
    ...school,
    ...clubOnly.map((c, idx) => ({
      ...c,
      fromSchool: false as const,
      order: school.length + idx + 1,
    })),
  ]
}

function mergeSchoolCommonWithClubOnly(
  normalizedSchool: Category[],
  clubExisting: Category[]
): Category[] {
  const clubOnly = clubExisting.filter(
    (c) => !c.fromSchool && !normalizedSchool.some((s) => isSameCategory(s, c))
  )
  return [
    ...normalizedSchool,
    ...clubOnly.map((c, idx) => ({
      ...c,
      fromSchool: undefined,
      order: normalizedSchool.length + idx + 1,
    })),
  ]
}

/**
 * 学校共通カテゴリーを保存し、**登録済み全クラブ**の参照用マスタへ反映する。
 * クラブ独自カテゴリー（fromSchool でないもの）は各クラブごとに消さず残す。
 *
 * 複数クラブが同一ブラウザを使う場合、アクティブクラブのみを更新すると他クラブが
 * 古い共通カテゴリーのまま残ってしまうため、`loadSchoolClubs()` の全クラブへ
 * クラブスコープ済みキー（`classapo_categories__{clubId}`）で直接書き込む。
 */
export function saveSchoolCommonCategories(categories: Category[]): void {
  if (typeof window === "undefined") return
  const normalized = normalizeCategories(categories, { fromSchool: true })
  localStorage.setItem(
    SCHOOL_COMMON_CATEGORIES_STORAGE_KEY,
    JSON.stringify(normalized)
  )

  const clubIds = listAllSchoolClubIds()
  for (const clubId of clubIds) {
    const existing = readClubScopedJsonForClubId<Category[]>(
      CLUB_CATEGORIES_BASE_KEY,
      clubId,
      []
    )
    writeClubScopedJsonForClubId(
      CLUB_CATEGORIES_BASE_KEY,
      clubId,
      mergeSchoolCommonWithClubOnly(normalized, existing)
    )
  }

  // アクティブクラブが学校未登録（デモ・移行前など）でも即時反映されるよう保険で更新
  const activeExisting = getCategories()
  saveCategories(mergeSchoolCommonWithClubOnly(normalized, activeExisting))
  dispatchChanged()
}

/**
 * クラブポータルからカテゴリー一覧を保存する。
 * 学校共通は学校正本で上書きし、クラブ独自のみクラブ入力を採用する。
 */
export function saveClubFacingCategories(categories: Category[]): void {
  if (typeof window === "undefined") return
  const school = hasSchoolCommonCategoriesConfigured()
    ? getSchoolCommonCategories()
    : []
  const clubOnly = categories
    .filter((c) => !isSchoolCommonCategory(c))
    .map((c, idx) => ({
      id: c.id,
      name: c.name.trim(),
      order: school.length + idx + 1,
      isUsed: Boolean(c.isUsed),
      ...(c.createdAt ? { createdAt: c.createdAt } : {}),
    }))
  saveCategories(
    school.length > 0
      ? [...school, ...clubOnly]
      : normalizeCategories(categories)
  )
}

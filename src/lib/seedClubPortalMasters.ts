/**
 * 新規クラブ登録時に、学校共通カテゴリー・科目をクラブスコープキーへ初期投入する。
 * （学校共通を再保存しなくても、新クラブが空マスタのままにならないようにする）
 *
 * 既存クラブでスコープが空の場合は `getCategories` / `getAccountTitles` 側の
 * `ensureActiveClubMastersHydratedFromSchool` が不足分を補完する。
 */

import {
  getSchoolCommonAccountTitles,
  hasSchoolCommonAccountTitlesConfigured,
} from "@/lib/schoolCommonAccountTitles"
import {
  getSchoolCommonCategories,
  hasSchoolCommonCategoriesConfigured,
} from "@/lib/schoolCommonCategories"
import {
  readClubScopedJsonForClubId,
  writeClubScopedJsonForClubId,
} from "@/lib/clubScopedStorage"

export function seedClubPortalMastersFromSchool(clubId: string): void {
  if (typeof window === "undefined") return
  const id = clubId.trim()
  if (!id) return

  if (hasSchoolCommonCategoriesConfigured()) {
    const existing = readClubScopedJsonForClubId<
      ReturnType<typeof getSchoolCommonCategories>
    >("classapo_categories", id, [])
    if (existing.length === 0) {
      writeClubScopedJsonForClubId(
        "classapo_categories",
        id,
        getSchoolCommonCategories()
      )
    }
  }

  if (hasSchoolCommonAccountTitlesConfigured()) {
    const existing = readClubScopedJsonForClubId<
      ReturnType<typeof getSchoolCommonAccountTitles>
    >("classapo_account_titles", id, [])
    if (existing.length === 0) {
      const titles = getSchoolCommonAccountTitles().map((t) => ({
        ...t,
        balance: null as number | null,
        categoryBalances: undefined,
      }))
      writeClubScopedJsonForClubId("classapo_account_titles", id, titles)
    }
  }
}

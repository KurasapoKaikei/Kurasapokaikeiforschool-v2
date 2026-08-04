/**
 * 新規クラブ登録時に、学校共通カテゴリー・科目をクラブスコープキーへ初期投入する。
 * （学校共通を再保存しなくても、新クラブが空マスタのままにならないようにする）
 */

import {
  getSchoolCommonAccountTitles,
  hasSchoolCommonAccountTitlesConfigured,
} from "@/lib/schoolCommonAccountTitles"
import {
  getSchoolCommonCategories,
  hasSchoolCommonCategoriesConfigured,
} from "@/lib/schoolCommonCategories"
import { writeClubScopedJsonForClubId } from "@/lib/clubScopedStorage"

export function seedClubPortalMastersFromSchool(clubId: string): void {
  if (typeof window === "undefined") return
  const id = clubId.trim()
  if (!id) return

  if (hasSchoolCommonCategoriesConfigured()) {
    writeClubScopedJsonForClubId(
      "classapo_categories",
      id,
      getSchoolCommonCategories()
    )
  }

  if (hasSchoolCommonAccountTitlesConfigured()) {
    const titles = getSchoolCommonAccountTitles().map((t) => ({
      ...t,
      balance: null as number | null,
      categoryBalances: undefined,
    }))
    writeClubScopedJsonForClubId("classapo_account_titles", id, titles)
  }
}

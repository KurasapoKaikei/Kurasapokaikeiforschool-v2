"use client"

import { useCallback, useEffect, useState } from "react"
import { HelpCircle } from "lucide-react"
import { CategorySettingsEditor } from "@/components/settings/CategorySettingsEditor"
import { usePortalFiscalYear } from "@/contexts/PortalFiscalYearContext"
import {
  canDisallowClubCategoryAdd,
  getAllowClubCategoryAdd,
  getSchoolCommonCategoriesForEditor,
  saveSchoolCommonCategories,
  setAllowClubCategoryAdd,
  SCHOOL_COMMON_CATEGORIES_CHANGED_EVENT,
} from "@/lib/schoolCommonCategories"
import {
  applyFiscalYearUsageToCategories,
  renameCategoryInFiscalYearAcrossClubs,
} from "@/lib/schoolCategoryUsage"
import { SCHOOL_THEME } from "@/lib/schoolTheme"
import { cn } from "@/lib/utils"
import type { Category } from "@/utils/localStorage"

const CLUB_ADD_PERMISSION_HELP =
  "許可するのとき、各クラブは共通カテゴリーに加えて独自カテゴリーを追加できます。許可しないのときは追加できません（学校共通の編集・削除はクラブ側では常に不可）。選択中の年度にクラブ独自カテゴリーが1件でもある間は、許可しないへ変更できません。クラブ側で該当カテゴリーをすべて削除（0件）してから変更してください。"

export default function SchoolSettingsCategoryPage() {
  const { selectedYear } = usePortalFiscalYear()
  const [categories, setCategories] = useState<Category[]>([])
  const [allowClubAdd, setAllowClubAdd] = useState(false)
  const [showClubAddHelp, setShowClubAddHelp] = useState(false)
  const [showPageHelp, setShowPageHelp] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const pageHelp = `いずれかのクラブで${selectedYear}に仕訳が1件でもあるカテゴリーは削除できません。名称の編集はいつでも可能です（当年度の仕訳のみ名称が更新され、過年度は変わりません）。`

  const reload = useCallback(() => {
    const base = getSchoolCommonCategoriesForEditor()
    setCategories(applyFiscalYearUsageToCategories(base, selectedYear))
    setAllowClubAdd(getAllowClubCategoryAdd())
    setIsLoaded(true)
  }, [selectedYear])

  useEffect(() => {
    reload()
    const onChange = () => reload()
    window.addEventListener(SCHOOL_COMMON_CATEGORIES_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    window.addEventListener("focus", onChange)
    return () => {
      window.removeEventListener(SCHOOL_COMMON_CATEGORIES_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
      window.removeEventListener("focus", onChange)
    }
  }, [reload])

  const handleCategoriesChange = (next: Category[]) => {
    const toSave: Category[] = next.map((c) => ({
      id: c.id,
      name: c.name,
      order: c.order,
      isUsed: false,
      ...(c.fromSchool ? { fromSchool: true as const } : {}),
    }))
    saveSchoolCommonCategories(toSave)
    setCategories(applyFiscalYearUsageToCategories(toSave, selectedYear))
  }

  const handleCategoryRename = (oldName: string, newName: string) => {
    const count = renameCategoryInFiscalYearAcrossClubs(
      oldName,
      newName,
      selectedYear
    )
    setCategories((prev) => applyFiscalYearUsageToCategories(prev, selectedYear))
    return count
  }

  const handleToggleClubAdd = () => {
    const next = !allowClubAdd
    if (allowClubAdd && !next) {
      const check = canDisallowClubCategoryAdd(selectedYear)
      if (!check.ok) {
        alert(
          `${selectedYear}にクラブが追加した独自カテゴリーが ${check.count} 件あるため、「許可しない」に変更できません。クラブポータルで該当カテゴリーをすべて削除し、0件になってから再度お試しください。`
        )
        return
      }
    }
    setAllowClubCategoryAdd(next)
    setAllowClubAdd(next)
  }

  if (!isLoaded) {
    return (
      <div className="px-6 py-8">
        <p className="text-sm text-[#6B7280]">読み込み中…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] px-6 py-8">
      <div
        className="mx-auto max-w-4xl overflow-hidden rounded-lg border border-gray-300 bg-[#F5F5F0] shadow-sm"
        style={{ borderLeftWidth: 5, borderLeftColor: SCHOOL_THEME.navy }}
      >
        <div className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold text-indigo-950">共通カテゴリー設定</h1>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPageHelp((v) => !v)}
                onBlur={() => setShowPageHelp(false)}
                className="text-[#6B7280] transition-colors hover:text-[#374151]"
                aria-label="共通カテゴリー設定についての説明"
                aria-expanded={showPageHelp}
              >
                <HelpCircle className="h-4 w-4" />
              </button>
              {showPageHelp ? (
                <div
                  role="tooltip"
                  className="absolute left-0 top-6 z-50 w-80 rounded-lg bg-[#374151] p-3 text-xs leading-relaxed text-white shadow-lg sm:w-96"
                >
                  {pageHelp}
                </div>
              ) : null}
            </div>
          </div>
          <p className="mt-1 text-xs text-[#6B7280]">
            ここで登録したカテゴリーは、全クラブのカテゴリー設定・入出金登録などに反映されます。
          </p>
        </div>

        <div className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <p className="text-sm font-semibold text-[#374151]">
                クラブごとにカテゴリーの追加権限を与える
              </p>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowClubAddHelp((v) => !v)}
                  onBlur={() => setShowClubAddHelp(false)}
                  className="text-[#6B7280] transition-colors hover:text-[#374151]"
                  aria-label="クラブごとにカテゴリーの追加権限についての説明"
                  aria-expanded={showClubAddHelp}
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
                {showClubAddHelp ? (
                  <div
                    role="tooltip"
                    className="absolute left-0 top-6 z-50 w-80 rounded-lg bg-[#374151] p-3 text-xs leading-relaxed text-white shadow-lg sm:w-96"
                  >
                    {CLUB_ADD_PERMISSION_HELP}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={allowClubAdd}
                aria-label="クラブごとにカテゴリーの追加権限を与える"
                onClick={handleToggleClubAdd}
                className={cn(
                  "relative h-8 w-14 shrink-0 rounded-full transition-colors",
                  allowClubAdd ? "bg-[#172554]" : "bg-gray-300"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all",
                    allowClubAdd ? "left-7" : "left-1"
                  )}
                />
                <span className="sr-only">
                  {allowClubAdd ? "許可する" : "許可しない"}
                </span>
              </button>
              <span
                className={cn(
                  "min-w-[4.5rem] text-sm font-bold",
                  allowClubAdd ? "text-[#172554]" : "text-[#9CA3AF]"
                )}
              >
                {allowClubAdd ? "許可する" : "許可しない"}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          <CategorySettingsEditor
            categories={categories}
            onCategoriesChange={handleCategoriesChange}
            propagateRename={false}
            onCategoryRename={handleCategoryRename}
            deleteBlockedMessage={`このカテゴリーは${selectedYear}にいずれかのクラブで仕訳が登録されているため削除できません。`}
            inUseBadgeLabel="当年度使用中"
            accentClassName="focus:ring-[#172554]"
            addButtonClassName="bg-[#172554] hover:bg-[#172554]/90"
          />
        </div>
      </div>
    </div>
  )
}

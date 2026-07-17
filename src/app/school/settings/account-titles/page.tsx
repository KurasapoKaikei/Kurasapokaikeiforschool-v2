"use client"

import { useCallback, useEffect, useState } from "react"
import { HelpCircle } from "lucide-react"
import { AccountTitlesSettingsView } from "@/components/settings/AccountTitlesSettingsView"
import { usePortalFiscalYear } from "@/contexts/PortalFiscalYearContext"
import { getSchoolCommonCategoriesForEditor, SCHOOL_COMMON_CATEGORIES_CHANGED_EVENT } from "@/lib/schoolCommonCategories"
import {
  canDisallowClubAccountTitleAdd,
  getAllowClubAccountTitleAdd,
  getSchoolCommonAccountTitlesForEditor,
  saveSchoolCommonAccountTitles,
  setAllowClubAccountTitleAdd,
  SCHOOL_COMMON_ACCOUNT_TITLES_CHANGED_EVENT,
} from "@/lib/schoolCommonAccountTitles"
import {
  applyFiscalYearUsageToAccountTitles,
  renameAccountTitleInFiscalYearAcrossClubs,
} from "@/lib/schoolCategoryUsage"
import { SCHOOL_THEME } from "@/lib/schoolTheme"
import { propagateMasterRename, type AccountTitle } from "@/utils/localStorage"
import { cn } from "@/lib/utils"
import type { Category } from "@/utils/localStorage"

const CLUB_ADD_PERMISSION_HELP =
  "許可するのとき、各クラブは共通科目に加えて収入・支出の独自科目を追加できます。許可しないのときは収入・支出の独自追加はできません。現金・預金グループのクラブ独自科目は、口座事情がクラブごとに異なるため、許可しない場合でも常に追加・編集できます（学校共通の現金・預金は編集・削除不可。初期残高のみ各クラブで入力可）。選択中の年度にクラブ独自の収入・支出科目が1件でもある間は、許可しないへ変更できません（現金・預金の独自科目は判定対象外）。"

export default function SchoolSettingsAccountTitlesPage() {
  const { selectedYear } = usePortalFiscalYear()
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [allowClubAdd, setAllowClubAdd] = useState(false)
  const [showClubAddHelp, setShowClubAddHelp] = useState(false)
  const [showPageHelp, setShowPageHelp] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const pageHelp = `いずれかのクラブで${selectedYear}に仕訳が1件でもある科目は削除できません。名称の編集はいつでも可能です（当年度の仕訳のみ名称が更新され、過年度は変わりません）。`

  const reload = useCallback(() => {
    const base = getSchoolCommonAccountTitlesForEditor()
    setAccountTitles(applyFiscalYearUsageToAccountTitles(base, selectedYear))
    setCategories(getSchoolCommonCategoriesForEditor())
    setAllowClubAdd(getAllowClubAccountTitleAdd())
    setIsLoaded(true)
  }, [selectedYear])

  useEffect(() => {
    reload()
    const onChange = () => reload()
    window.addEventListener(SCHOOL_COMMON_ACCOUNT_TITLES_CHANGED_EVENT, onChange)
    window.addEventListener(SCHOOL_COMMON_CATEGORIES_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    window.addEventListener("focus", onChange)
    return () => {
      window.removeEventListener(SCHOOL_COMMON_ACCOUNT_TITLES_CHANGED_EVENT, onChange)
      window.removeEventListener(SCHOOL_COMMON_CATEGORIES_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
      window.removeEventListener("focus", onChange)
    }
  }, [reload])

  const handleAccountTitlesChange = (next: AccountTitle[]) => {
    const toSave: AccountTitle[] = next.map((t) => ({
      id: t.id,
      group: t.group,
      name: t.name,
      categoryIds: t.group === "cash" ? [] : [...t.categoryIds],
      balance: null,
      order: t.order,
      isUsed: false,
      ...(t.fromSchool ? { fromSchool: true as const } : {}),
    }))
    saveSchoolCommonAccountTitles(toSave)
    setAccountTitles(applyFiscalYearUsageToAccountTitles(toSave, selectedYear))
  }

  const handleTitleRename = (oldName: string, newName: string, title: AccountTitle) => {
    const count = renameAccountTitleInFiscalYearAcrossClubs(oldName, newName, selectedYear)
    if (title.group === "income") {
      propagateMasterRename("income", oldName, newName)
    } else if (title.group === "cash") {
      propagateMasterRename("cash", oldName, newName)
    }
    setAccountTitles((prev) => applyFiscalYearUsageToAccountTitles(prev, selectedYear))
    return count
  }

  const handleToggleClubAdd = () => {
    const next = !allowClubAdd
    if (allowClubAdd && !next) {
      const check = canDisallowClubAccountTitleAdd(selectedYear)
      if (!check.ok) {
        alert(
          `${selectedYear}にクラブが追加した収入・支出の独自科目が ${check.count} 件あるため、「許可しない」に変更できません。クラブポータルで該当科目をすべて削除し、0件になってから再度お試しください。（現金・預金の独自科目は対象外です）`
        )
        return
      }
    }
    setAllowClubAccountTitleAdd(next)
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
            <h1 className="text-xl font-bold text-indigo-950">共通科目設定</h1>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPageHelp((v) => !v)}
                onBlur={() => setShowPageHelp(false)}
                className="text-[#6B7280] transition-colors hover:text-[#374151]"
                aria-label="共通科目設定についての説明"
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
            ここで登録した科目は、全クラブの科目設定・入出金登録などに反映されます。
          </p>
        </div>

        <div className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <p className="text-sm font-semibold text-[#374151]">
                クラブごとに科目の追加権限を与える
              </p>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowClubAddHelp((v) => !v)}
                  onBlur={() => setShowClubAddHelp(false)}
                  className="text-[#6B7280] transition-colors hover:text-[#374151]"
                  aria-label="クラブごとに科目の追加権限についての説明"
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
                aria-label="クラブごとに科目の追加権限を与える"
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
          <AccountTitlesSettingsView
            accountTitles={accountTitles}
            onAccountTitlesChange={handleAccountTitlesChange}
            categories={categories}
            useFiscalYearIsUsed
            onTitleRename={handleTitleRename}
            propagateRename={false}
            showOpeningBalance={false}
            deleteBlockedMessage={`この科目は${selectedYear}にいずれかのクラブで仕訳が登録されているため削除できません。`}
            inUseBadgeLabel="当年度使用中"
            accentClassName="focus:ring-[#172554]"
            addButtonClassName="bg-[#172554] hover:bg-[#172554]/90"
            tabActiveClassName="border-[#172554] text-[#172554]"
            groupBorderClassName="border-[#172554]/30"
            toastClassName="bg-[#172554]"
          />
        </div>
      </div>
    </div>
  )
}

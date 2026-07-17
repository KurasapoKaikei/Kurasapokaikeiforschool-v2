"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AccountTitlesSettingsView } from "@/components/settings/AccountTitlesSettingsView"
import { SettlementLockAlert } from "@/components/club/SettlementLockAlert"
import { useClubSettlementLock } from "@/hooks/useClubSettlementLock"
import {
  getAllowClubAccountTitleAdd,
  hasSchoolCommonAccountTitlesConfigured,
  isSchoolCommonAccountTitle,
  mergeSchoolAndClubAccountTitles,
  saveClubFacingAccountTitles,
  SCHOOL_COMMON_ACCOUNT_TITLES_CHANGED_EVENT,
} from "@/lib/schoolCommonAccountTitles"
import {
  hasSchoolCommonCategoriesConfigured,
  mergeSchoolAndClubCategories,
} from "@/lib/schoolCommonCategories"
import {
  getAccountTitles,
  getCategories,
  type AccountTitle,
  type Category,
} from "@/utils/localStorage"

export default function AccountTitlesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])
  const [schoolManaged, setSchoolManaged] = useState(false)
  const [allowClubAdd, setAllowClubAdd] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const skipNextSaveRef = useRef(true)
  const isLocked = useClubSettlementLock()

  const reloadFromMasters = useCallback(() => {
    const managed = hasSchoolCommonAccountTitlesConfigured()
    const canAdd = getAllowClubAccountTitleAdd()
    const categoriesManaged = hasSchoolCommonCategoriesConfigured()
    setSchoolManaged(managed)
    setAllowClubAdd(canAdd)
    setAccountTitles(managed ? mergeSchoolAndClubAccountTitles() : getAccountTitles())
    setCategories(
      categoriesManaged ? mergeSchoolAndClubCategories() : getCategories()
    )
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    reloadFromMasters()
  }, [reloadFromMasters])

  useEffect(() => {
    const onChange = () => {
      skipNextSaveRef.current = true
      reloadFromMasters()
    }
    window.addEventListener(SCHOOL_COMMON_ACCOUNT_TITLES_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(SCHOOL_COMMON_ACCOUNT_TITLES_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [reloadFromMasters])

  useEffect(() => {
    if (!isLoaded) return
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }
    saveClubFacingAccountTitles(accountTitles)
  }, [accountTitles, isLoaded])

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] px-6 py-8">
        <p className="text-sm text-[#6B7280]">読み込み中…</p>
      </div>
    )
  }

  // 現金・預金は口座事情がクラブごとに異なるため、追加権限オフでも常に追加可
  const canAddTitles = !isLocked
  const allowedAddGroups =
    schoolManaged && !allowClubAdd
      ? (["cash"] as const)
      : undefined

  const notice = schoolManaged
    ? allowClubAdd
      ? "学校共通科目は編集・削除できません（現金・預金も同様）。初期残高はご利用初年度のみ入力できます。「すべて」では現金・預金のみ入力、収入・支出はカテゴリー別タブで入力（「すべて」には合計を表示）。学校から許可されているため、クラブ独自の科目を追加できます。"
      : "学校共通科目は編集・削除できません（現金・預金も同様）。現金・預金のクラブ独自科目は追加権限が「許可しない」でも常に追加・編集できます。収入・支出の独自追加は学校が「許可する」のときのみ可能です。初期残高はご利用初年度のみ。「すべて」では現金・預金のみ入力、収入・支出はカテゴリー別タブで入力します。"
    : undefined

  return (
    <div className="min-h-screen bg-[#F5F5F0] px-6 py-8">
      <div className="w-full max-w-none">
        <SettlementLockAlert isLocked={isLocked} className="mb-4" />
        <AccountTitlesSettingsView
          title="科目設定"
          description={
            schoolManaged
              ? "学校共通科目と、クラブの現金・預金科目（および許可されている場合の収入・支出独自科目）"
              : "勘定科目の登録・編集・削除"
          }
          notice={notice}
          accountTitles={accountTitles}
          onAccountTitlesChange={setAccountTitles}
          categories={categories}
          locked={isLocked}
          allowAdd={canAddTitles}
          allowedAddGroups={allowedAddGroups ? [...allowedAddGroups] : undefined}
          isTitleReadOnly={isSchoolCommonAccountTitle}
          isTitleDeletable={(t) => !isSchoolCommonAccountTitle(t)}
          showOpeningCarryover
          markCreatedAtOnAdd={schoolManaged}
        />
      </div>
    </div>
  )
}

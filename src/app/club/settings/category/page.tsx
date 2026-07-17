"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CategorySettingsEditor } from "@/components/settings/CategorySettingsEditor"
import { SettlementLockAlert } from "@/components/club/SettlementLockAlert"
import { useClubSettlementLock } from "@/hooks/useClubSettlementLock"
import {
  getAllowClubCategoryAdd,
  hasSchoolCommonCategoriesConfigured,
  isSchoolCommonCategory,
  mergeSchoolAndClubCategories,
  saveClubFacingCategories,
  SCHOOL_COMMON_CATEGORIES_CHANGED_EVENT,
} from "@/lib/schoolCommonCategories"
import {
  getCategories,
  type Category,
} from "@/utils/localStorage"

export default function CategorySettingsPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [schoolManaged, setSchoolManaged] = useState(false)
  const [allowClubAdd, setAllowClubAdd] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const skipNextSaveRef = useRef(true)
  const isLocked = useClubSettlementLock()

  const reloadFromMasters = useCallback(() => {
    const managed = hasSchoolCommonCategoriesConfigured()
    const canAdd = getAllowClubCategoryAdd()
    setSchoolManaged(managed)
    setAllowClubAdd(canAdd)
    setCategories(managed ? mergeSchoolAndClubCategories() : getCategories())
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
    window.addEventListener(SCHOOL_COMMON_CATEGORIES_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(SCHOOL_COMMON_CATEGORIES_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [reloadFromMasters])

  useEffect(() => {
    if (!isLoaded) return
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }
    // 学校共通はクラブから書き換えず、独自分のみ保存に含める
    saveClubFacingCategories(categories)
  }, [categories, isLoaded])

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] px-6 py-8">
        <p className="text-sm text-[#6B7280]">読み込み中…</p>
      </div>
    )
  }

  const canAddClubCategories =
    !isLocked && (!schoolManaged || allowClubAdd)

  const notice = schoolManaged
    ? allowClubAdd
      ? "学校共通カテゴリーは編集・削除できません。学校から許可されているため、クラブ独自のカテゴリーを追加できます。"
      : "学校共通カテゴリーは編集・削除できません。クラブ独自カテゴリーの追加は、学校管理者ポータルで「クラブごとにカテゴリーの追加権限を与える」が ON のときのみ可能です。"
    : "学校管理者ポータルで登録したカテゴリーには「学校共通」と表示され、クラブ側では編集・削除できません。"

  return (
    <div className="min-h-screen bg-[#F5F5F0] px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <SettlementLockAlert isLocked={isLocked} className="mb-4" />
        <CategorySettingsEditor
          title="カテゴリー設定"
          description={
            schoolManaged
              ? "学校共通カテゴリーと、許可されている場合のクラブ独自カテゴリー"
              : "カテゴリーの登録・編集・削除"
          }
          notice={notice}
          categories={categories}
          onCategoriesChange={setCategories}
          locked={isLocked}
          allowAdd={canAddClubCategories}
          isCategoryReadOnly={isSchoolCommonCategory}
        />
      </div>
    </div>
  )
}

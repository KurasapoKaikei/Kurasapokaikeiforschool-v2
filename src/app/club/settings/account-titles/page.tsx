"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { GripVertical, Edit2, Trash2 } from "lucide-react"
import {
  getCategories,
  getAccountTitles,
  saveAccountTitles,
  getSystemSettings,
  saveSystemSettings,
  getTransactions,
  getCollectionSchedules,
  propagateMasterRename,
  type Category,
  type AccountTitle,
  type Transaction,
  type CollectionSchedule,
} from "@/utils/localStorage"
import { isDuplicateName } from "@/utils/nameNormalize"
import { SettlementLockAlert } from "@/components/club/SettlementLockAlert"

/**
 * データ整合性メッセージ（v2.9 §6.5 / §6.6「整合性チェック」準拠。§6.5 では仕訳に加え集金設定も参照）。
 * 直接ハードコードせず定数化することで、テキストの揺れを防ぐ。
 */
const MSG_CATEGORY_UNLINK_BLOCKED =
  "このカテゴリーには既にこの科目の仕訳データが存在するため、変更できません。カテゴリーを変更する場合は、対象の仕訳をすべて削除するか、別の科目に振り替えて、残高を0にする必要があります。"
const MSG_CATEGORY_UNLINK_BLOCKED_COLLECTION =
  "このカテゴリーと科目の組み合わせは、集金設定で使用されています。変更するには、先に集金設定（集金管理画面）から該当の設定を削除するか、別のカテゴリー・科目に変更してください。"
const MSG_ACCOUNT_TITLE_DELETE_BLOCKED =
  "この科目は既に使用されているため削除できません。削除するには、この科目に関連するすべての仕訳データを削除し、残高を0の状態にする必要があります。"
const MSG_ACCOUNT_TITLE_DELETE_BLOCKED_COLLECTION =
  "この科目は集金設定に登録されているため削除できません。先に集金設定からこの科目を取り除いてください。"
const MSG_ACCOUNT_TITLE_DUPLICATE =
  "この科目名はすでに登録されています。別の名前を入力してください。"

type AccountGroup = "cash" | "income" | "expense"

const groupLabels: Record<AccountGroup, string> = {
  cash: "現金・預金",
  income: "収入",
  expense: "支出",
}

/** 現金・預金グループ選択時の説明文（カテゴリー設定なし＝共通） */
const CASH_GROUP_CATEGORY_MESSAGE = "現金・預金グループはカテゴリーの設定はありません。"

/** 一覧テーブル：合計18ユニット（科目名7 / カテゴリー9 / 編集1 / 削除1） */
const ACCOUNT_TITLE_LIST_GRID =
  "sm:[grid-template-columns:minmax(0,7fr)_minmax(0,9fr)_minmax(2.25rem,1fr)_minmax(2.25rem,1fr)]"

/**
 * 前期繰越金を編集できる「初年度運用中」かを判定する。
 * TODO: 年度更新（次年度繰越）実装時に、FiscalYear/Club 側のロック情報と連動させる。
 */
function isInitialYear(settings: { yearRolloverCompletedAt: string | null }): boolean {
  return settings.yearRolloverCompletedAt === null
}

export default function AccountTitlesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [collectionSchedules, setCollectionSchedules] = useState<CollectionSchedule[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("all")
  const [newAccountTitle, setNewAccountTitle] = useState({
    group: "" as AccountGroup | "",
    categoryIds: [] as string[],
    name: "",
    balance: "",
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<Partial<AccountTitle>>({})
  const [draggedTitleId, setDraggedTitleId] = useState<string | null>(null)
  const [draggedGroup, setDraggedGroup] = useState<AccountGroup | null>(null)
  const [dragOverTitleId, setDragOverTitleId] = useState<string | null>(null)
  const [addToast, setAddToast] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const [openingCarryoverInput, setOpeningCarryoverInput] = useState("")
  const [openingCarryoverLocked, setOpeningCarryoverLocked] = useState(false)
  const [yearRolloverCompletedAt, setYearRolloverCompletedAt] = useState<string | null>(null)
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    try {
      const savedLocked = localStorage.getItem("is_club_settlement_locked")
      if (savedLocked === "true") {
        setIsLocked(true)
      }
    } catch (e) {}
  }, [])

  const showToast = (message: string) => {
    setToastMessage(message)
    setAddToast(true)
    setTimeout(() => {
      setAddToast(false)
      setToastMessage("")
    }, 2500)
  }

  // LocalStorageから読み込み
  useEffect(() => {
    const loadedCategories = getCategories()
    const loadedAccountTitles = getAccountTitles()
    const loadedTransactions = getTransactions()
    const loadedSchedules = getCollectionSchedules()
    const settings = getSystemSettings()
    setCategories(loadedCategories)
    setAccountTitles(loadedAccountTitles)
    setTransactions(loadedTransactions)
    setCollectionSchedules(loadedSchedules)
    setOpeningCarryoverInput(
      settings.openingCarryover !== null ? settings.openingCarryover.toLocaleString() : ""
    )
    setOpeningCarryoverLocked(settings.openingCarryoverLocked)
    setYearRolloverCompletedAt(settings.yearRolloverCompletedAt)
    setIsLoaded(true)
  }, [])

  // カテゴリー・取引・集金設定の変更を監視（LocalStorageの変更を検知するため、定期的にチェック）
  // 整合性チェック（v2.9 §6.5）に使う transactions / collectionSchedules もここで同期する
  useEffect(() => {
    if (!isLoaded) return
    const interval = setInterval(() => {
      setCategories(getCategories())
      setTransactions(getTransactions())
      setCollectionSchedules(getCollectionSchedules())
    }, 500)

    return () => clearInterval(interval)
  }, [isLoaded])

  // カテゴリーが削除された場合、科目からも削除
  useEffect(() => {
    if (!isLoaded) return
    
    setAccountTitles((prevTitles) => {
      const updatedTitles = prevTitles.map((title) => {
        const validCategoryIds = title.categoryIds.filter((id) =>
          categories.some((cat) => cat.id === id)
        )
        return { ...title, categoryIds: validCategoryIds }
      })
      
      // 変更があった場合のみ更新
      const hasChanges = updatedTitles.some(
        (title, index) =>
          title.categoryIds.length !== prevTitles[index].categoryIds.length
      )
      
      return hasChanges ? updatedTitles : prevTitles
    })
  }, [categories, isLoaded])

  // 科目が変更されたらLocalStorageに保存
  useEffect(() => {
    if (isLoaded) {
      saveAccountTitles(accountTitles)
    }
  }, [accountTitles, isLoaded])

  // タブでフィルタリング
  // 「すべて」: 全科目（現金・預金含む）を表示
  // 特定カテゴリー: 現金・預金は表示しない（共通資産のため）。そのカテゴリーに属する収入・支出科目のみ表示
  const filteredAccountTitles =
    activeTab === "all"
      ? accountTitles
      : accountTitles.filter(
          (title) => title.group !== "cash" && title.categoryIds.includes(activeTab)
        )

  // グループごとに分類
  const groupedTitles = {
    cash: filteredAccountTitles.filter((t) => t.group === "cash").sort((a, b) => a.order - b.order),
    income: filteredAccountTitles.filter((t) => t.group === "income").sort((a, b) => a.order - b.order),
    expense: filteredAccountTitles.filter((t) => t.group === "expense").sort((a, b) => a.order - b.order),
  }

  const handleAddAccountTitle = () => {
    if (isLocked) return
    if (!newAccountTitle.group || !newAccountTitle.name) {
      alert("グループと科目名は必須です。")
      return
    }
    // 現金・預金はカテゴリー設定なし（共通）。収入・支出はカテゴリー必須
    if (newAccountTitle.group !== "cash" && newAccountTitle.categoryIds.length === 0) {
      alert("収入・支出の場合はカテゴリーを1つ以上選択してください。")
      return
    }

    const trimmedName = newAccountTitle.name.trim()
    // v2.9 §6.6 整合性チェック：科目名はグループを跨いでもグローバルに重複禁止
    if (isDuplicateName(trimmedName, accountTitles.map((t) => t.name))) {
      alert(MSG_ACCOUNT_TITLE_DUPLICATE)
      return
    }

    const newTitle: AccountTitle = {
      id: Date.now().toString(),
      group: newAccountTitle.group,
      name: trimmedName,
      categoryIds: newAccountTitle.group === "cash" ? [] : newAccountTitle.categoryIds,
      balance: newAccountTitle.balance ? parseFloat(newAccountTitle.balance) : null,
      order: accountTitles.filter((t) => t.group === newAccountTitle.group).length + 1,
      isUsed: false,
    }

    setAccountTitles([...accountTitles, newTitle])
    setNewAccountTitle({
      group: "" as AccountGroup | "",
      categoryIds: [],
      name: "",
      balance: "",
    })
    showToast("追加完了")
  }

  const handleCategoryToggle = (categoryId: string) => {
    setNewAccountTitle((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(categoryId)
        ? prev.categoryIds.filter((id) => id !== categoryId)
        : [...prev.categoryIds, categoryId],
    }))
  }

  const handleStartEdit = (title: AccountTitle) => {
    if (isLocked) return
    setEditingId(title.id)
    setEditingData({
      name: title.name,
      categoryIds: [...title.categoryIds],
      balance: title.balance,
    })
  }

  /**
   * 指定の科目名を「自口座（counterparty）」または「科目（accountTitle）」として
   * 使用している仕訳が1件以上あるかを判定する。
   * - 収入・支出科目: 通常 `t.accountTitle === name`
   * - 現金・預金科目: 出納帳上は `t.counterparty === name` として登場
   * - 振替: `accountTitle` に対向口座名、`counterparty` に自口座名が入るため両方カバー
   */
  const hasTransactionForTitle = (titleName: string): boolean => {
    if (!titleName) return false
    return transactions.some(
      (t) => t.accountTitle === titleName || t.counterparty === titleName
    )
  }

  /**
   * (カテゴリー × 科目) の組合せで使用されている仕訳が1件以上あるか判定する。
   * カテゴリーは Transaction.category に「名前」が保存される前提で照合する。
   * 現金・預金グループは categoryIds を持たないため、本関数の対象外。
   */
  const hasTransactionForTitleAndCategory = (
    titleName: string,
    categoryName: string
  ): boolean => {
    if (!titleName || !categoryName) return false
    return transactions.some(
      (t) => t.accountTitle === titleName && t.category === categoryName
    )
  }

  /**
   * 集金設定（CollectionSchedule）上の表示用カテゴリー名。
   * 未設定時は集金取引生成ロジック（`syncCollectionTransactionsFromRecords` 等）と揃え「集金」を既定とする。
   */
  const effectiveScheduleCategoryName = (s: CollectionSchedule): string => {
    const raw = s.categoryName?.trim()
    return raw ? raw : "集金"
  }

  /**
   * 集金設定上の表示用科目名（収入科目）。
   * `accountTitleName` が空の場合は `name`（スケジュール名）をフォールバックし、さらに空なら「会費収入」。
   */
  const effectiveScheduleAccountTitleName = (s: CollectionSchedule): string => {
    const fromField = s.accountTitleName?.trim()
    if (fromField) return fromField
    const fromName = s.name?.trim()
    if (fromName) return fromName
    return "会費収入"
  }

  /**
   * (カテゴリー名 × 科目名) が集金設定のいずれか1件以上で使用されているか。
   * 仕訳が0件でも、未来の集金予定に残っている場合は true となりカテゴリー解除をブロックする。
   */
  const hasCollectionScheduleForTitleAndCategory = (
    titleName: string,
    categoryName: string
  ): boolean => {
    if (!titleName || !categoryName) return false
    return collectionSchedules.some((s) => {
      const cat = effectiveScheduleCategoryName(s)
      const acct = effectiveScheduleAccountTitleName(s)
      return acct === titleName && cat === categoryName
    })
  }

  /**
   * 科目名が集金設定の収入科目として登録されているか（いずれかのスケジュールで一致すれば true）。
   */
  const hasCollectionScheduleForTitle = (titleName: string): boolean => {
    if (!titleName) return false
    return collectionSchedules.some((s) => effectiveScheduleAccountTitleName(s) === titleName)
  }

  /**
   * 編集モード中にカテゴリーチェックボックスを切り替えるハンドラ。
   * 「外す方向」のときに当該（カテゴリー × 科目）の仕訳が存在すれば、
   * v2.9 §6.5 整合性チェック に従いアラート表示し変更を中止する。
   */
  const handleEditingCategoryToggle = (title: AccountTitle, category: Category) => {
    const currentIds = editingData.categoryIds ?? title.categoryIds
    const willUnlink = currentIds.includes(category.id)
    if (willUnlink) {
      if (hasTransactionForTitleAndCategory(title.name, category.name)) {
        alert(MSG_CATEGORY_UNLINK_BLOCKED)
        return
      }
      if (hasCollectionScheduleForTitleAndCategory(title.name, category.name)) {
        alert(MSG_CATEGORY_UNLINK_BLOCKED_COLLECTION)
        return
      }
    }
    const next = willUnlink
      ? currentIds.filter((id) => id !== category.id)
      : [...currentIds, category.id]
    setEditingData({ ...editingData, categoryIds: next })
  }

  const handleSaveEdit = (id: string) => {
    if (isLocked) return
    const target = accountTitles.find((t) => t.id === id)
    if (!target) return

    // v2.9 §6.6 整合性チェック：科目名の重複を保存直前に検証（自身の旧名は除外）
    const nextName = (editingData.name ?? target.name).trim() || target.name
    if (
      isDuplicateName(
        nextName,
        accountTitles.map((t) => t.name),
        target.name
      )
    ) {
      alert(MSG_ACCOUNT_TITLE_DUPLICATE)
      return
    }

    // 現金・預金はカテゴリーを常に空（共通）に固定
    const nextCategoryIds =
      target.group === "cash" ? [] : (editingData.categoryIds ?? target.categoryIds)

    // 「外されたカテゴリーID」一覧を求め、当該組合せに仕訳が存在する場合は保存を中止
    // （UI 側で外せないようガードしているが、二重防御として保存直前にも検証する）
    if (target.group !== "cash") {
      const removedIds = target.categoryIds.filter((id) => !nextCategoryIds.includes(id))
      for (const removedId of removedIds) {
        const cat = categories.find((c) => c.id === removedId)
        if (!cat) continue
        if (hasTransactionForTitleAndCategory(target.name, cat.name)) {
          alert(MSG_CATEGORY_UNLINK_BLOCKED)
          return
        }
        if (hasCollectionScheduleForTitleAndCategory(target.name, cat.name)) {
          alert(MSG_CATEGORY_UNLINK_BLOCKED_COLLECTION)
          return
        }
      }
    }

    setAccountTitles(
      accountTitles.map((title) => {
        if (title.id !== id) return title
        const balance = editingData.balance !== undefined ? editingData.balance : title.balance
        return {
          ...title,
          name: nextName,
          categoryIds: nextCategoryIds,
          balance,
        }
      })
    )
    // v2.9 §6.7 名称変更の集金設定・仕訳への自動波及（名称が変わったときのみ）
    let propagatedSchedules = 0
    let propagatedTransactions = 0
    if (target.name.trim() !== nextName) {
      if (target.group === "income") {
        const r = propagateMasterRename("income", target.name, nextName)
        propagatedSchedules = r.schedules
        propagatedTransactions = r.transactions
      } else if (target.group === "cash") {
        const r = propagateMasterRename("cash", target.name, nextName)
        propagatedSchedules = r.schedules
        propagatedTransactions = r.transactions
      }
    }
    setEditingId(null)
    setEditingData({})
    const totalPropagated = propagatedSchedules + propagatedTransactions
    showToast(
      totalPropagated > 0
        ? `更新完了（集金設定 ${propagatedSchedules} 件・仕訳 ${propagatedTransactions} 件に反映）`
        : "更新完了"
    )
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingData({})
  }

  const handleDelete = (id: string) => {
    if (isLocked) return
    const title = accountTitles.find((t) => t.id === id)
    if (!title) return
    // v2.9 §6.5 整合性チェック: 仕訳が1件でも存在する科目は削除禁止
    // （旧 isUsed フラグへの依存をやめ、実取引ベースで判定する）
    if (hasTransactionForTitle(title.name)) {
      alert(MSG_ACCOUNT_TITLE_DELETE_BLOCKED)
      return
    }
    if (hasCollectionScheduleForTitle(title.name)) {
      alert(MSG_ACCOUNT_TITLE_DELETE_BLOCKED_COLLECTION)
      return
    }
    if (confirm("この科目を削除してもよろしいですか？")) {
      setAccountTitles(accountTitles.filter((t) => t.id !== id))
    }
  }

  const handleDragStart = (titleId: string, group: AccountGroup) => {
    setDraggedTitleId(titleId)
    setDraggedGroup(group)
  }

  const handleDragOver = (e: React.DragEvent, titleId: string, group: AccountGroup) => {
    e.preventDefault()
    if (draggedGroup === group) {
      setDragOverTitleId(titleId)
    }
  }

  const handleDrop = (e: React.DragEvent, dropTitleId: string, group: AccountGroup) => {
    e.preventDefault()
    if (!draggedTitleId || !draggedGroup || draggedGroup !== group || draggedTitleId === dropTitleId) {
      setDraggedTitleId(null)
      setDraggedGroup(null)
      setDragOverTitleId(null)
      return
    }

    const groupTitles = accountTitles.filter((t) => t.group === group).sort((a, b) => a.order - b.order)
    const draggedIndex = groupTitles.findIndex((t) => t.id === draggedTitleId)
    const dropIndex = groupTitles.findIndex((t) => t.id === dropTitleId)

    if (draggedIndex === -1 || dropIndex === -1) {
      setDraggedTitleId(null)
      setDraggedGroup(null)
      setDragOverTitleId(null)
      return
    }

    const newGroupTitles = [...groupTitles]
    const draggedItem = newGroupTitles[draggedIndex]
    newGroupTitles.splice(draggedIndex, 1)
    newGroupTitles.splice(dropIndex, 0, draggedItem)

    // orderを更新
    const updatedTitles = newGroupTitles.map((title, idx) => ({
      ...title,
      order: idx + 1,
    }))

    // 他のグループの科目とマージ
    const otherTitles = accountTitles.filter((t) => t.group !== group)
    setAccountTitles([...otherTitles, ...updatedTitles])
    setDraggedTitleId(null)
    setDraggedGroup(null)
    setDragOverTitleId(null)
  }

  const handleDragEnd = () => {
    setDraggedTitleId(null)
    setDraggedGroup(null)
    setDragOverTitleId(null)
  }

  const getCategoryNames = (title: AccountTitle) => {
    if (title.group === "cash") return "共通"
    return title.categoryIds
      .map((id) => categories.find((cat) => cat.id === id)?.name)
      .filter(Boolean)
      .join("、") || "-"
  }

  const parseAmountInput = (raw: string): number | null => {
    const normalized = raw.replace(/,/g, "").trim()
    if (normalized === "" || normalized === "-") return null
    const n = Number(normalized)
    return Number.isFinite(n) ? Math.trunc(n) : null
  }

  const handleOpeningCarryoverChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d,-]/g, "")
    const sign = cleaned.startsWith("-") ? "-" : ""
    const digits = cleaned.replace(/-/g, "").replace(/,/g, "")
    if (digits.length === 0) {
      setOpeningCarryoverInput(sign === "-" ? "-" : "")
      return
    }
    const formatted = Number(digits).toLocaleString()
    setOpeningCarryoverInput(`${sign}${formatted}`)
  }

  const handleSaveOpeningCarryover = () => {
    if (isLocked) return
    if (!isInitialYear({ yearRolloverCompletedAt })) {
      alert("年度更新後のため、前期繰越金は編集できません。")
      return
    }
    const amount = parseAmountInput(openingCarryoverInput)
    if (amount === null) {
      alert("前期繰越金を入力してください。")
      return
    }
    saveSystemSettings({
      openingCarryover: amount,
      // 互換維持のため保存は継続。編集可否は isInitialYear 判定を優先する。
      openingCarryoverLocked,
      yearRolloverCompletedAt,
    })
    setOpeningCarryoverInput(amount.toLocaleString())
    showToast("前期繰越金を保存しました")
  }

  return (
    <div className="px-6 py-8 bg-[#F5F5F0] min-h-screen w-full">
      <div className="w-full max-w-none">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-[#374151]">科目設定</h2>
          <p className="text-sm text-[#6B7280]">勘定科目の登録・編集・削除</p>
          <SettlementLockAlert isLocked={isLocked} className="mt-4" />
        </div>

        {/* 追加完了トースト */}
        {addToast && (
          <div
            role="status"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-[#77B8DA] text-white text-sm font-medium rounded-lg shadow-lg"
          >
            {toastMessage}
          </div>
        )}

        {/* 新規追加エリア（コンパクト・左寄せ／一覧とは幅を分離） */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm w-full max-w-2xl mr-auto mb-10">
          <h3 className="text-lg font-semibold mb-5 text-[#374151]">新規追加</h3>
          <div className="space-y-5 w-full">
            {/* 1. グループ */}
            <div>
              <label htmlFor="group" className="block text-sm font-medium text-[#374151] mb-1.5">
                グループ <span className="text-[#EF4444]">*</span>
              </label>
              <select
                id="group"
                value={newAccountTitle.group}
                onChange={(e) => {
                  const newGroup = e.target.value as AccountGroup
                  setNewAccountTitle({
                    ...newAccountTitle,
                    group: newGroup,
                    categoryIds: newGroup === "cash" ? [] : newAccountTitle.categoryIds,
                  })
                }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#77B8DA] focus:border-transparent bg-white"
                required
              >
                <option value="">選択してください</option>
                <option value="cash">現金・預金</option>
                <option value="income">収入</option>
                <option value="expense">支出</option>
              </select>
            </div>

            {/* 2. カテゴリー（現金・預金時は共通・選択不可） */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                カテゴリー {newAccountTitle.group && newAccountTitle.group !== "cash" && (
                  <span className="text-[#EF4444]">*</span>
                )}
              </label>
              {newAccountTitle.group === "cash" ? (
                <div className="py-2.5 px-3 bg-[#77B8DA]/5 border border-[#77B8DA]/30 rounded-lg">
                  <p className="text-sm font-medium text-[#374151]">共通（設定なし）</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">{CASH_GROUP_CATEGORY_MESSAGE}</p>
                </div>
              ) : newAccountTitle.group ? (
                <div className="flex flex-wrap gap-3">
                  {categories
                    .sort((a, b) => a.order - b.order)
                    .map((category) => (
                      <label
                        key={category.id}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={newAccountTitle.categoryIds.includes(category.id)}
                          onChange={() => handleCategoryToggle(category.id)}
                          className="w-4 h-4 text-[#77B8DA] border-gray-300 rounded focus:ring-[#77B8DA]"
                        />
                        <span className="text-sm text-[#374151]">{category.name}</span>
                      </label>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-[#9CA3AF] py-2">グループを選択してください</p>
              )}
            </div>

            {/* 3. 科目名 */}
            <div>
              <label htmlFor="accountName" className="block text-sm font-medium text-[#374151] mb-1.5">
                科目名 <span className="text-[#EF4444]">*</span>
              </label>
              <input
                type="text"
                id="accountName"
                value={newAccountTitle.name}
                onChange={(e) => setNewAccountTitle({ ...newAccountTitle, name: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#77B8DA] focus:border-transparent"
                placeholder="例：部費、消耗品費"
                required
              />
            </div>

            {/* 4. 期首残高 */}
            <div>
              <label htmlFor="balance" className="block text-sm font-medium text-[#374151] mb-1.5">
                期首残高（円）
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="balance"
                  value={newAccountTitle.balance}
                  onChange={(e) => setNewAccountTitle({ ...newAccountTitle, balance: e.target.value })}
                  className="w-full pl-3 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#77B8DA] focus:border-transparent tabular-nums text-right"
                  placeholder="0"
                  step="1"
                />
              </div>
              <p className="text-xs text-[#6B7280] mt-1">運用開始時の金額（任意・マイナス可）</p>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                onClick={handleAddAccountTitle}
                disabled={isLocked}
                className="bg-[#77B8DA] hover:bg-[#77B8DA]/90 text-white px-6 py-2.5 rounded-lg"
              >
                追加する
              </Button>
            </div>
          </div>
        </div>

        {/* 追加済み科目一覧（全幅維持） */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 w-full max-w-none">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#374151]">追加済み科目</h3>
            <span className="text-xs text-[#9CA3AF]">（単位：円）</span>
          </div>

          {/* タブ */}
          <div className="mb-6">
            <div className="flex gap-2 border-b border-gray-200">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === "all"
                    ? "border-[#77B8DA] text-[#77B8DA]"
                    : "border-transparent text-[#6B7280] hover:text-[#374151]"
                }`}
              >
                すべて
              </button>
              {categories
                .sort((a, b) => a.order - b.order)
                .map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveTab(category.id)}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                      activeTab === category.id
                        ? "border-[#77B8DA] text-[#77B8DA]"
                        : "border-transparent text-[#6B7280] hover:text-[#374151]"
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
            </div>
          </div>

          {/* 一覧ヘッダー（科目名＋並び替え｜カテゴリー｜編集｜削除） */}
          <div
            className={`hidden sm:grid mb-2 text-xs font-semibold text-[#6B7280] border-b border-gray-200 pb-2 gap-x-2 gap-y-1 items-center ${ACCOUNT_TITLE_LIST_GRID}`}
          >
            <span className="min-w-0 pl-5 pr-4 text-left">
              <span className="inline-block pl-7">科目名</span>
            </span>
            <span className="min-w-0 px-5 text-left">カテゴリー</span>
            <span className="min-w-0 pl-2 pr-1 text-left">編集</span>
            <span className="min-w-0 pl-1 pr-5 text-left">削除</span>
          </div>

          {/* グループごとのリスト */}
          {Object.entries(groupedTitles).map(([group, titles]) => {
            if (titles.length === 0) return null

            return (
              <div key={group} className="mb-6">
                <h4 className="text-md font-semibold mb-3 text-[#374151] border-b border-[#77B8DA]/30 pb-2">
                  {groupLabels[group as AccountGroup]}
                </h4>
                <div className="space-y-2">
                  {titles.map((title) => {
                    const isDragged = draggedTitleId === title.id
                    const isDragOver = dragOverTitleId === title.id && draggedTitleId !== title.id && draggedGroup === title.group
                    // v2.9 §6.5: 削除ボタンの活性判定は実取引ベース（旧 isUsed フラグへの依存を廃止）
                    const isInUse =
                      hasTransactionForTitle(title.name) || hasCollectionScheduleForTitle(title.name)
                    return (
                      <div
                        key={title.id}
                        draggable
                        onDragStart={() => handleDragStart(title.id, title.group)}
                        onDragOver={(e) => handleDragOver(e, title.id, title.group)}
                        onDrop={(e) => handleDrop(e, title.id, title.group)}
                        onDragEnd={handleDragEnd}
                        className={`border border-gray-200 rounded-lg hover:bg-gray-50/80 transition-colors cursor-move ${
                          isDragged ? "opacity-50" : ""
                        } ${isDragOver ? "border-[#77B8DA] bg-[#77B8DA]/10" : ""}`}
                      >
                        <div
                          className={`grid grid-cols-1 gap-3 p-3 sm:gap-x-2 sm:gap-y-2 sm:items-start ${ACCOUNT_TITLE_LIST_GRID}`}
                        >
                          {/* 科目名（左にドラッグハンドル） */}
                          <div className="min-w-0 pl-5 pr-4 text-left flex gap-2 items-start">
                            <GripVertical className="h-5 w-5 text-[#6B7280] flex-shrink-0 mt-0.5" aria-hidden />
                            <div className="min-w-0 flex-1">
                              <span className="sm:hidden text-xs text-[#6B7280] block mb-0.5">科目名</span>
                              {editingId === title.id ? (
                                <input
                                  type="text"
                                  value={editingData.name || title.name}
                                  onChange={(e) =>
                                    setEditingData({ ...editingData, name: e.target.value })
                                  }
                                  className="w-full max-w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#77B8DA] focus:border-transparent text-sm"
                                  autoFocus
                                />
                              ) : (
                                <span className="text-base font-semibold text-[#374151] leading-snug break-words block">
                                  {title.name}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* カテゴリー（9/18・中央やや右まで広く） */}
                          <div className="min-w-0 px-5 text-left">
                            <span className="sm:hidden text-xs text-[#6B7280] block mb-0.5">カテゴリー</span>
                            {editingId === title.id && title.group === "cash" ? (
                              <span className="text-sm text-[#6B7280]">共通</span>
                            ) : editingId === title.id ? (
                              <div className="flex flex-wrap gap-2 justify-start">
                                {categories
                                  .sort((a, b) => a.order - b.order)
                                  .map((cat) => (
                                    <label key={cat.id} className="flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={(editingData.categoryIds ?? []).includes(cat.id)}
                                        onChange={() => handleEditingCategoryToggle(title, cat)}
                                        className="w-3.5 h-3.5 text-[#77B8DA] rounded"
                                      />
                                      <span className="text-xs">{cat.name}</span>
                                    </label>
                                  ))}
                              </div>
                            ) : (
                              <span className="text-sm text-[#6B7280] break-words w-full max-w-full">
                                {title.group === "cash" ? "共通" : getCategoryNames(title)}
                              </span>
                            )}
                          </div>
                          {/* 編集（カテゴリー直後・コンパクト） */}
                          <div className="flex min-w-0 pl-2 pr-1 justify-start items-center w-full">
                            <span className="sm:hidden text-xs text-[#6B7280] w-16 shrink-0">編集</span>
                            {editingId === title.id ? (
                              <Button
                                type="button"
                                onClick={() => handleSaveEdit(title.id)}
                                disabled={isLocked}
                                variant="outline"
                                size="sm"
                                className="h-8 w-full sm:w-auto min-w-[2.75rem] px-2"
                              >
                                保存
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                onClick={() => handleStartEdit(title)}
                                disabled={isLocked}
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 shrink-0"
                                title="編集"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          {/* 削除 */}
                          <div className="flex min-w-0 pl-1 pr-5 justify-start items-center w-full">
                            <span className="sm:hidden text-xs text-[#6B7280] w-16 shrink-0">削除</span>
                            {editingId === title.id ? (
                              <Button
                                type="button"
                                onClick={handleCancelEdit}
                                variant="outline"
                                size="sm"
                                className="h-8 w-full sm:w-auto min-w-[2.75rem] px-2"
                              >
                                キャンセル
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                onClick={() => handleDelete(title.id)}
                                variant="outline"
                                size="sm"
                                className={`h-8 w-8 p-0 shrink-0 ${
                                  isInUse || isLocked
                                    ? "text-gray-400 cursor-not-allowed"
                                    : "text-[#EF4444] hover:text-[#EF4444]"
                                }`}
                                disabled={isInUse || isLocked}
                                title={isInUse ? "仕訳または集金設定で使用中のため削除不可" : "削除"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {editingId === title.id && (
                          <div className="px-3 pb-3 pt-3 border-t border-gray-100">
                            <span className="text-xs font-medium text-[#6B7280] block mb-1.5">
                              期首残高（円）
                            </span>
                            <input
                              type="number"
                              value={editingData.balance ?? ""}
                              onChange={(e) => {
                                const value = e.target.value
                                setEditingData({
                                  ...editingData,
                                  balance: value === "" ? null : parseFloat(value),
                                })
                              }}
                              className="w-full max-w-xs px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#77B8DA] focus:border-transparent text-sm text-right tabular-nums"
                              placeholder="0"
                              step="1"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {filteredAccountTitles.length === 0 && (
            <p className="text-center py-8 text-[#6B7280]">科目がありません</p>
          )}
        </div>

        {/* 前期繰越金（初期設定） */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 mt-6 w-full max-w-2xl mr-auto">
          <h3 className="text-lg font-semibold mb-2 text-[#374151]">前期繰越金の初期残高</h3>
          <p className="text-sm text-[#6B7280] mb-4">
            システム利用初年度の期首残高です。年度更新後は読み取り専用になります。
          </p>
          <div className="w-full space-y-3">
            <div>
              <label
                htmlFor="openingCarryover"
                className="block text-sm font-medium text-[#374151] mb-1.5"
              >
                前期繰越金（円）
              </label>
              <input
                id="openingCarryover"
                type="text"
                inputMode="numeric"
                value={openingCarryoverInput}
                onChange={(e) => handleOpeningCarryoverChange(e.target.value)}
                disabled={!isInitialYear({ yearRolloverCompletedAt }) || isLocked}
                className="w-full pl-3 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#77B8DA] focus:border-transparent tabular-nums text-right disabled:bg-gray-100 disabled:text-[#6B7280]"
                placeholder="例：1,000,000"
              />
            </div>
            {isInitialYear({ yearRolloverCompletedAt }) ? (
              <div className="pt-1">
                <Button
                  type="button"
                  onClick={handleSaveOpeningCarryover}
                  disabled={isLocked}
                  className="bg-[#77B8DA] hover:bg-[#77B8DA]/90 text-white px-6 py-2.5 rounded-lg"
                >
                  保存
                </Button>
              </div>
            ) : (
              <p className="text-xs text-amber-700">
                年度更新後のため、前期繰越金はロックされています。
              </p>
            )}
            {openingCarryoverLocked && isInitialYear({ yearRolloverCompletedAt }) && (
              <p className="text-xs text-[#6B7280]">
                保存済みです。初年度運用中は必要に応じて再編集できます。
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { GripVertical, Edit2, Trash2 } from "lucide-react"
import {
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
import { cn } from "@/lib/utils"
import {
  balanceDraftKey,
  getTitleBalanceForTab,
  withUpdatedBalanceForTab,
} from "@/lib/accountTitleBalances"

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

const CASH_GROUP_CATEGORY_MESSAGE = "現金・預金グループはカテゴリーの設定はありません。"

const ACCOUNT_TITLE_LIST_GRID =
  "sm:[grid-template-columns:minmax(0,7fr)_minmax(0,9fr)_minmax(2.25rem,1fr)_minmax(2.25rem,1fr)]"

const ACCOUNT_TITLE_LIST_GRID_WITH_BALANCE =
  "sm:[grid-template-columns:minmax(0,1fr)_minmax(0,1fr)_7.5rem_2.5rem_2.5rem]"

function isInitialYear(settings: { yearRolloverCompletedAt: string | null }): boolean {
  return settings.yearRolloverCompletedAt === null
}

function formatBalanceDraft(balance: number | null | undefined): string {
  if (typeof balance === "number" && Number.isFinite(balance)) return String(balance)
  return ""
}

export type AccountTitlesSettingsViewProps = {
  accountTitles: AccountTitle[]
  onAccountTitlesChange: (next: AccountTitle[]) => void
  categories: Category[]
  locked?: boolean
  allowAdd?: boolean
  /** 指定時は科目追加で選べるグループを制限（例: 現金・預金のみ常時追加可） */
  allowedAddGroups?: AccountGroup[]
  isTitleReadOnly?: (title: AccountTitle) => boolean
  /** 未指定時は isTitleReadOnly と同じ扱い。学校共通の現金・預金は編集可でも削除不可にする用途 */
  isTitleDeletable?: (title: AccountTitle) => boolean
  /** true のとき削除判定に title.isUsed を使う（学校・当年度横断） */
  useFiscalYearIsUsed?: boolean
  onTitleRename?: (oldName: string, newName: string, title: AccountTitle) => number
  propagateRename?: boolean
  showOpeningCarryover?: boolean
  /** false のとき科目の初期残高入力を出さない（学校共通科目設定）。既定 true */
  showOpeningBalance?: boolean
  markCreatedAtOnAdd?: boolean
  title?: string
  description?: string
  notice?: string
  deleteBlockedMessage?: string
  inUseBadgeLabel?: string
  accentClassName?: string
  addButtonClassName?: string
  tabActiveClassName?: string
  groupBorderClassName?: string
  toastClassName?: string
}

export function AccountTitlesSettingsView({
  accountTitles,
  onAccountTitlesChange,
  categories,
  locked = false,
  allowAdd,
  allowedAddGroups,
  isTitleReadOnly,
  isTitleDeletable,
  useFiscalYearIsUsed = false,
  onTitleRename,
  propagateRename = true,
  showOpeningCarryover = false,
  showOpeningBalance = true,
  markCreatedAtOnAdd = false,
  title,
  description,
  notice,
  deleteBlockedMessage = MSG_ACCOUNT_TITLE_DELETE_BLOCKED,
  inUseBadgeLabel = "使用中",
  accentClassName = "focus:ring-[#77B8DA]",
  addButtonClassName = "bg-[#77B8DA] hover:bg-[#77B8DA]/90",
  tabActiveClassName = "border-[#77B8DA] text-[#77B8DA]",
  groupBorderClassName = "border-[#77B8DA]/30",
  toastClassName = "bg-[#77B8DA]",
}: AccountTitlesSettingsViewProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [collectionSchedules, setCollectionSchedules] = useState<CollectionSchedule[]>([])
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
  const [balanceDrafts, setBalanceDrafts] = useState<Record<string, string>>({})
  const accountTitlesRef = useRef(accountTitles)
  accountTitlesRef.current = accountTitles

  const canAdd = !locked && (allowAdd ?? true)
  const addGroupOptions: { value: AccountGroup; label: string }[] = (
    [
      { value: "cash" as const, label: "現金・預金" },
      { value: "income" as const, label: "収入" },
      { value: "expense" as const, label: "支出" },
    ] as const
  ).filter(
    (opt) => !allowedAddGroups || allowedAddGroups.includes(opt.value)
  )
  const isReadOnly = (title: AccountTitle) =>
    locked || Boolean(isTitleReadOnly?.(title))
  const canDeleteTitle = (title: AccountTitle) => {
    if (locked) return false
    if (isTitleDeletable) return isTitleDeletable(title)
    return !isReadOnly(title)
  }
  const listGridClass = showOpeningBalance
    ? ACCOUNT_TITLE_LIST_GRID_WITH_BALANCE
    : ACCOUNT_TITLE_LIST_GRID
  const canEditOpeningBalance =
    showOpeningBalance && !locked && isInitialYear({ yearRolloverCompletedAt })
  /** クラブ側で「学校共通」バッジ列の幅を常に確保し、初期残高入力枠の位置ずれを防ぐ */
  const reserveSchoolCommonBadgeSlot =
    Boolean(isTitleReadOnly) || Boolean(isTitleDeletable)

  useEffect(() => {
    if (!allowedAddGroups || allowedAddGroups.length === 0) return
    if (
      newAccountTitle.group &&
      !allowedAddGroups.includes(newAccountTitle.group)
    ) {
      setNewAccountTitle((prev) => ({
        ...prev,
        group: "" as AccountGroup | "",
        categoryIds: [],
      }))
    }
  }, [allowedAddGroups, newAccountTitle.group])

  const showToast = (message: string) => {
    setToastMessage(message)
    setAddToast(true)
    setTimeout(() => {
      setAddToast(false)
      setToastMessage("")
    }, 2500)
  }

  useEffect(() => {
    if (useFiscalYearIsUsed) return
    setTransactions(getTransactions())
    setCollectionSchedules(getCollectionSchedules())
    const interval = setInterval(() => {
      setTransactions(getTransactions())
      setCollectionSchedules(getCollectionSchedules())
    }, 500)
    return () => clearInterval(interval)
  }, [useFiscalYearIsUsed])

  useEffect(() => {
    if (!showOpeningCarryover && !showOpeningBalance) return
    const settings = getSystemSettings()
    if (showOpeningCarryover) {
      setOpeningCarryoverInput(
        settings.openingCarryover !== null ? settings.openingCarryover.toLocaleString() : ""
      )
      setOpeningCarryoverLocked(settings.openingCarryoverLocked)
    }
    setYearRolloverCompletedAt(settings.yearRolloverCompletedAt)
  }, [showOpeningCarryover, showOpeningBalance])

  useEffect(() => {
    if (!showOpeningBalance) return
    setBalanceDrafts(() => {
      const next: Record<string, string> = {}
      for (const title of accountTitles) {
        const key = balanceDraftKey(title.id, activeTab)
        next[key] = formatBalanceDraft(getTitleBalanceForTab(title, activeTab))
      }
      return next
    })
  }, [accountTitles, showOpeningBalance, activeTab])

  const canEditBalanceOnCurrentTab = (title: AccountTitle) => {
    if (!canEditOpeningBalance) return false
    if (title.group === "cash") return activeTab === "all"
    return activeTab !== "all"
  }

  const commitOpeningBalance = (id: string, balance: number | null) => {
    const current = accountTitlesRef.current
    const target = current.find((t) => t.id === id)
    if (!target || !canEditBalanceOnCurrentTab(target)) return
    const prev = getTitleBalanceForTab(target, activeTab)
    if (prev === balance) return
    onAccountTitlesChange(
      current.map((title) =>
        title.id === id ? withUpdatedBalanceForTab(title, activeTab, balance) : title
      )
    )
  }

  const handleOpeningBalanceChange = (id: string, value: string) => {
    const target = accountTitlesRef.current.find((t) => t.id === id)
    if (!target || !canEditBalanceOnCurrentTab(target)) return
    const key = balanceDraftKey(id, activeTab)
    setBalanceDrafts((prev) => ({ ...prev, [key]: value }))
    if (value.trim() === "" || value === "-") {
      commitOpeningBalance(id, null)
      return
    }
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      commitOpeningBalance(id, parsed)
    }
  }

  useEffect(() => {
    const prevTitles = accountTitlesRef.current
    const updatedTitles = prevTitles.map((title) => {
      if (title.group === "cash") return title
      const validCategoryIds = title.categoryIds.filter((id) =>
        categories.some((cat) => cat.id === id)
      )
      const filteredBalances = title.categoryBalances
        ? Object.fromEntries(
            Object.entries(title.categoryBalances).filter(([id]) =>
              validCategoryIds.includes(id)
            )
          )
        : undefined
      const categoryBalances =
        filteredBalances && Object.keys(filteredBalances).length > 0
          ? filteredBalances
          : undefined
      const balance =
        categoryBalances != null
          ? Object.values(categoryBalances).reduce((a, b) => a + b, 0)
          : null
      const sameCategories =
        validCategoryIds.length === title.categoryIds.length &&
        validCategoryIds.every((id) => title.categoryIds.includes(id))
      const sameBalances =
        JSON.stringify(categoryBalances ?? null) ===
        JSON.stringify(title.categoryBalances ?? null)
      if (sameCategories && sameBalances) return title
      return {
        ...title,
        categoryIds: validCategoryIds,
        categoryBalances,
        balance,
      }
    })
    const hasChanges = updatedTitles.some(
      (title, index) => title !== prevTitles[index]
    )
    if (hasChanges) onAccountTitlesChange(updatedTitles)
  }, [categories, onAccountTitlesChange])

  const filteredAccountTitles =
    activeTab === "all"
      ? accountTitles
      : accountTitles.filter(
          (title) => title.group !== "cash" && title.categoryIds.includes(activeTab)
        )

  const groupedTitles = {
    cash: filteredAccountTitles.filter((t) => t.group === "cash").sort((a, b) => a.order - b.order),
    income: filteredAccountTitles.filter((t) => t.group === "income").sort((a, b) => a.order - b.order),
    expense: filteredAccountTitles.filter((t) => t.group === "expense").sort((a, b) => a.order - b.order),
  }

  const hasTransactionForTitle = (titleName: string): boolean => {
    if (!titleName) return false
    return transactions.some(
      (t) => t.accountTitle === titleName || t.counterparty === titleName
    )
  }

  const hasTransactionForTitleAndCategory = (
    titleName: string,
    categoryName: string
  ): boolean => {
    if (!titleName || !categoryName) return false
    return transactions.some(
      (t) => t.accountTitle === titleName && t.category === categoryName
    )
  }

  const effectiveScheduleCategoryName = (s: CollectionSchedule): string => {
    const raw = s.categoryName?.trim()
    return raw ? raw : "集金"
  }

  const effectiveScheduleAccountTitleName = (s: CollectionSchedule): string => {
    const fromField = s.accountTitleName?.trim()
    if (fromField) return fromField
    const fromName = s.name?.trim()
    if (fromName) return fromName
    return "会費収入"
  }

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

  const hasCollectionScheduleForTitle = (titleName: string): boolean => {
    if (!titleName) return false
    return collectionSchedules.some(
      (s) => effectiveScheduleAccountTitleName(s) === titleName
    )
  }

  const isTitleInUse = (title: AccountTitle): boolean => {
    if (useFiscalYearIsUsed) return Boolean(title.isUsed)
    return (
      hasTransactionForTitle(title.name) || hasCollectionScheduleForTitle(title.name)
    )
  }

  const handleAddAccountTitle = () => {
    if (!canAdd) return
    if (!newAccountTitle.group || !newAccountTitle.name) {
      alert("グループと科目名は必須です。")
      return
    }
    if (
      allowedAddGroups &&
      !allowedAddGroups.includes(newAccountTitle.group)
    ) {
      alert("このグループの科目は追加できません。")
      return
    }
    if (newAccountTitle.group !== "cash" && newAccountTitle.categoryIds.length === 0) {
      alert("収入・支出の場合はカテゴリーを1つ以上選択してください。")
      return
    }

    const trimmedName = newAccountTitle.name.trim()
    if (isDuplicateName(trimmedName, accountTitles.map((t) => t.name))) {
      alert(MSG_ACCOUNT_TITLE_DUPLICATE)
      return
    }

    const cashBalance =
      newAccountTitle.group === "cash" &&
      canEditOpeningBalance &&
      newAccountTitle.balance
        ? parseFloat(newAccountTitle.balance)
        : null
    const newTitle: AccountTitle = {
      id: Date.now().toString(),
      group: newAccountTitle.group,
      name: trimmedName,
      categoryIds: newAccountTitle.group === "cash" ? [] : newAccountTitle.categoryIds,
      balance: newAccountTitle.group === "cash" ? cashBalance : null,
      order: accountTitles.filter((t) => t.group === newAccountTitle.group).length + 1,
      isUsed: false,
      ...(markCreatedAtOnAdd ? { createdAt: new Date().toISOString() } : {}),
    }

    onAccountTitlesChange([...accountTitles, newTitle])
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
    if (isReadOnly(title)) return
    setEditingId(title.id)
    setEditingData({
      name: title.name,
      categoryIds: [...title.categoryIds],
    })
  }

  const handleEditingCategoryToggle = (title: AccountTitle, category: Category) => {
    const currentIds = editingData.categoryIds ?? title.categoryIds
    const willUnlink = currentIds.includes(category.id)
    if (willUnlink && !useFiscalYearIsUsed) {
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
    const target = accountTitles.find((t) => t.id === id)
    if (!target || isReadOnly(target)) return

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

    const nextCategoryIds =
      target.group === "cash" ? [] : (editingData.categoryIds ?? target.categoryIds)

    if (target.group !== "cash" && !useFiscalYearIsUsed) {
      const removedIds = target.categoryIds.filter((cid) => !nextCategoryIds.includes(cid))
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

    onAccountTitlesChange(
      accountTitles.map((title) => {
        if (title.id !== id) return title
        return {
          ...title,
          name: nextName,
          categoryIds: nextCategoryIds,
        }
      })
    )

    let propagatedSchedules = 0
    let propagatedTransactions = 0
    if (target.name.trim() !== nextName) {
      if (onTitleRename) {
        const count = onTitleRename(target.name, nextName, target)
        if (count > 0) {
          showToast(
            `科目名を更新（当年度の仕訳 ${count} 件に反映・過年度は変更なし）`
          )
        } else {
          showToast("更新完了")
        }
        setEditingId(null)
        setEditingData({})
        return
      }
      if (propagateRename) {
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
    const title = accountTitles.find((t) => t.id === id)
    if (!title || !canDeleteTitle(title)) return
    if (isTitleInUse(title)) {
      alert(useFiscalYearIsUsed ? deleteBlockedMessage : MSG_ACCOUNT_TITLE_DELETE_BLOCKED)
      return
    }
    if (!useFiscalYearIsUsed && hasCollectionScheduleForTitle(title.name)) {
      alert(MSG_ACCOUNT_TITLE_DELETE_BLOCKED_COLLECTION)
      return
    }
    if (confirm("この科目を削除してもよろしいですか？")) {
      onAccountTitlesChange(accountTitles.filter((t) => t.id !== id))
    }
  }

  const handleDragStart = (titleId: string, group: AccountGroup) => {
    const title = accountTitles.find((t) => t.id === titleId)
    if (!title || isReadOnly(title)) return
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

    const updatedTitles = newGroupTitles.map((t, idx) => ({
      ...t,
      order: idx + 1,
    }))

    const otherTitles = accountTitles.filter((t) => t.group !== group)
    onAccountTitlesChange([...otherTitles, ...updatedTitles])
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
    return (
      title.categoryIds
        .map((id) => categories.find((cat) => cat.id === id)?.name)
        .filter(Boolean)
        .join("、") || "-"
    )
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
    if (locked) return
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
      openingCarryoverLocked,
      yearRolloverCompletedAt,
    })
    setOpeningCarryoverInput(amount.toLocaleString())
    showToast("前期繰越金を保存しました")
  }

  const showHeader = Boolean(title || description || notice)

  return (
    <div className="space-y-6">
      {showHeader ? (
        <div>
          {title ? (
            <h2 className="text-xl font-semibold text-[#374151]">{title}</h2>
          ) : null}
          {description ? (
            <p className="mt-1 text-sm text-[#6B7280]">{description}</p>
          ) : null}
          {notice ? (
            <p className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-[#374151]">
              {notice}
            </p>
          ) : null}
        </div>
      ) : null}

      {addToast ? (
        <div
          role="status"
          className={cn(
            "fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg",
            toastClassName
          )}
        >
          {toastMessage}
        </div>
      ) : null}

      {canAdd ? (
        <div className="mb-10 mr-auto w-full max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-5 text-lg font-semibold text-[#374151]">科目追加</h3>
          <div className="w-full space-y-5">
            <div>
              <label htmlFor="group" className="mb-1.5 block text-sm font-medium text-[#374151]">
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
                className={cn(
                  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 focus:border-transparent focus:outline-none focus:ring-2",
                  accentClassName
                )}
                required
              >
                <option value="">選択してください</option>
                {addGroupOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {allowedAddGroups?.length === 1 &&
              allowedAddGroups[0] === "cash" ? (
                <p className="mt-1 text-xs text-[#6B7280]">
                  現金・預金グループの科目は、口座事情がクラブごとに異なるため常に追加できます。
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#374151]">
                カテゴリー{" "}
                {newAccountTitle.group && newAccountTitle.group !== "cash" && (
                  <span className="text-[#EF4444]">*</span>
                )}
              </label>
              {newAccountTitle.group ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-3">
                    {categories
                      .sort((a, b) => a.order - b.order)
                      .map((category) => {
                        const isCash = newAccountTitle.group === "cash"
                        return (
                          <label
                            key={category.id}
                            className={cn(
                              "flex items-center gap-2",
                              isCash ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={
                                isCash
                                  ? false
                                  : newAccountTitle.categoryIds.includes(category.id)
                              }
                              disabled={isCash}
                              onChange={() => {
                                if (!isCash) handleCategoryToggle(category.id)
                              }}
                              className={cn(
                                "h-4 w-4 rounded border-gray-300 text-[#77B8DA]",
                                accentClassName.replace("focus:ring-", "focus:ring-")
                              )}
                            />
                            <span className="text-sm text-[#374151]">{category.name}</span>
                          </label>
                        )
                      })}
                  </div>
                  {newAccountTitle.group === "cash" ? (
                    <p className="text-xs text-[#6B7280]">{CASH_GROUP_CATEGORY_MESSAGE}</p>
                  ) : null}
                  {categories.length === 0 ? (
                    <p className="text-sm text-[#9CA3AF]">登録済みのカテゴリーがありません</p>
                  ) : null}
                </div>
              ) : (
                <p className="py-2 text-sm text-[#9CA3AF]">グループを選択してください</p>
              )}
            </div>

            <div>
              <label htmlFor="accountName" className="mb-1.5 block text-sm font-medium text-[#374151]">
                科目名 <span className="text-[#EF4444]">*</span>
              </label>
              <input
                type="text"
                id="accountName"
                value={newAccountTitle.name}
                onChange={(e) => setNewAccountTitle({ ...newAccountTitle, name: e.target.value })}
                className={cn(
                  "w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-transparent focus:outline-none focus:ring-2",
                  accentClassName
                )}
                placeholder="例：現金、部費、旅費交通費など"
                required
              />
            </div>

            {showOpeningBalance &&
            canEditOpeningBalance &&
            newAccountTitle.group === "cash" ? (
              <div>
                <label htmlFor="balance" className="mb-1.5 block text-sm font-medium text-[#374151]">
                  初期残高（円）
                </label>
                <input
                  type="number"
                  id="balance"
                  value={newAccountTitle.balance}
                  onChange={(e) =>
                    setNewAccountTitle({ ...newAccountTitle, balance: e.target.value })
                  }
                  className={cn(
                    "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-right tabular-nums focus:border-transparent focus:outline-none focus:ring-2",
                    accentClassName
                  )}
                  placeholder="0"
                  step="1"
                />
                <p className="mt-1 text-xs text-[#6B7280]">
                  ご利用初年度のみ入力できます（任意・マイナス可）。追加後も「すべて」タブの入力枠から変更できます。
                </p>
              </div>
            ) : null}
            {showOpeningBalance &&
            canEditOpeningBalance &&
            (newAccountTitle.group === "income" ||
              newAccountTitle.group === "expense") ? (
              <p className="text-xs text-[#6B7280]">
                収入・支出の初期残高は、カテゴリー別タブの一覧で入力します（「すべて」では合計が表示されます）。
              </p>
            ) : null}

            <div className="pt-2">
              <Button
                type="button"
                onClick={handleAddAccountTitle}
                className={cn("rounded-lg px-6 py-2.5 text-white", addButtonClassName)}
              >
                追加する
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="w-full max-w-none rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-[#374151]">追加済み科目</h3>
          {showOpeningBalance ? (
            <span className="text-xs text-[#9CA3AF]">
              {canEditOpeningBalance
                ? activeTab === "all"
                  ? "「すべて」では現金・預金のみ入力可。収入・支出はカテゴリー別の合計を表示"
                  : "このカテゴリーの初期残高を入力できます（ご利用初年度のみ）"
                : "初期残高はご利用初年度のみ入力可能です（現在は読み取り専用）"}
            </span>
          ) : null}
        </div>

        <div className="mb-6">
          <div className="flex gap-2 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={cn(
                "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "all"
                  ? tabActiveClassName
                  : "border-transparent text-[#6B7280] hover:text-[#374151]"
              )}
            >
              すべて
            </button>
            {categories
              .sort((a, b) => a.order - b.order)
              .map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveTab(category.id)}
                  className={cn(
                    "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                    activeTab === category.id
                      ? tabActiveClassName
                      : "border-transparent text-[#6B7280] hover:text-[#374151]"
                  )}
                >
                  {category.name}
                </button>
              ))}
          </div>
        </div>

        <div
          className={cn(
            "mb-2 hidden items-center gap-x-2 gap-y-1 border-b border-gray-200 pb-2 text-xs font-semibold text-[#6B7280] sm:grid",
            listGridClass
          )}
        >
          <span className="min-w-0 pl-5 pr-4 text-left">
            <span className="inline-block pl-7">科目名</span>
          </span>
          <span className="min-w-0 px-5 text-left">カテゴリー</span>
          {showOpeningBalance ? (
            <span className="min-w-0 px-2 text-center">初期残高（円）</span>
          ) : null}
          <span className="min-w-0 pl-2 pr-1 text-left">編集</span>
          <span className="min-w-0 pl-1 pr-5 text-left">削除</span>
        </div>

        {Object.entries(groupedTitles).map(([group, titles]) => {
          if (titles.length === 0) return null

          return (
            <div key={group} className="mb-6">
              <h4
                className={cn(
                  "text-md mb-3 border-b pb-2 font-semibold text-[#374151]",
                  groupBorderClassName
                )}
              >
                {groupLabels[group as AccountGroup]}
              </h4>
              <div className="space-y-2">
                {titles.map((title) => {
                  const readOnly = isReadOnly(title)
                  const isEditing = editingId === title.id
                  const canEditMaster = !readOnly
                  const deletable = canDeleteTitle(title)
                  // クラブ側のみ表示（学校管理者ポータルでは判定関数未指定のため出さない）
                  const schoolCommon = isTitleDeletable
                    ? !isTitleDeletable(title)
                    : Boolean(isTitleReadOnly?.(title))
                  const isDragged = draggedTitleId === title.id
                  const isDragOver =
                    dragOverTitleId === title.id &&
                    draggedTitleId !== title.id &&
                    draggedGroup === title.group
                  const inUse = isTitleInUse(title)
                  const draftKey = balanceDraftKey(title.id, activeTab)
                  const balanceValue =
                    balanceDrafts[draftKey] ??
                    formatBalanceDraft(getTitleBalanceForTab(title, activeTab))
                  const balanceEditable = canEditBalanceOnCurrentTab(title)

                  return (
                    <div
                      key={title.id}
                      draggable={canEditMaster}
                      onDragStart={() => handleDragStart(title.id, title.group)}
                      onDragOver={(e) => handleDragOver(e, title.id, title.group)}
                      onDrop={(e) => handleDrop(e, title.id, title.group)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "rounded-lg border border-gray-200 transition-colors",
                        canEditMaster
                          ? "cursor-move hover:bg-gray-50/80"
                          : "cursor-default bg-gray-50/80",
                        isDragged && "opacity-50",
                        isDragOver && "border-[#77B8DA] bg-[#77B8DA]/10"
                      )}
                    >
                      <div className="flex items-start gap-2 p-3">
                        <div
                          className={cn(
                            "min-w-0 flex-1 grid grid-cols-1 gap-3 sm:gap-x-2 sm:gap-y-2 sm:items-start",
                            listGridClass
                          )}
                        >
                          <div className="flex min-w-0 items-start gap-2 pl-5 pr-4 text-left">
                            {canEditMaster ? (
                              <GripVertical
                                className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#6B7280]"
                                aria-hidden
                              />
                            ) : (
                              <span className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden />
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="mb-0.5 block text-xs text-[#6B7280] sm:hidden">
                                科目名
                              </span>
                              {isEditing && canEditMaster ? (
                                <input
                                  type="text"
                                  value={editingData.name || title.name}
                                  onChange={(e) =>
                                    setEditingData({ ...editingData, name: e.target.value })
                                  }
                                  className={cn(
                                    "w-full max-w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-transparent focus:outline-none focus:ring-2",
                                    accentClassName
                                  )}
                                  autoFocus
                                />
                              ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="block break-words text-base font-semibold leading-snug text-[#374151]">
                                    {title.name}
                                  </span>
                                  {inUse && useFiscalYearIsUsed ? (
                                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-[#6B7280]">
                                      {inUseBadgeLabel}
                                    </span>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="min-w-0 px-5 text-left">
                            <span className="mb-0.5 block text-xs text-[#6B7280] sm:hidden">
                              カテゴリー
                            </span>
                            {isEditing && canEditMaster && title.group === "cash" ? (
                              <span className="text-sm text-[#6B7280]">共通</span>
                            ) : isEditing && canEditMaster ? (
                              <div className="flex flex-wrap justify-start gap-2">
                                {categories
                                  .sort((a, b) => a.order - b.order)
                                  .map((cat) => (
                                    <label
                                      key={cat.id}
                                      className="flex cursor-pointer items-center gap-1.5"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={(editingData.categoryIds ?? []).includes(cat.id)}
                                        onChange={() => handleEditingCategoryToggle(title, cat)}
                                        className="h-3.5 w-3.5 rounded text-[#77B8DA]"
                                      />
                                      <span className="text-xs">{cat.name}</span>
                                    </label>
                                  ))}
                              </div>
                            ) : (
                              <span className="block w-full max-w-full break-words text-sm text-[#6B7280]">
                                {title.group === "cash" ? "共通" : getCategoryNames(title)}
                              </span>
                            )}
                          </div>

                          {showOpeningBalance ? (
                            <div className="min-w-0 px-2">
                              <span className="mb-0.5 block text-center text-xs text-[#6B7280] sm:hidden">
                                初期残高（円）
                              </span>
                              <input
                                type="number"
                                inputMode="numeric"
                                value={balanceValue}
                                onChange={(e) =>
                                  handleOpeningBalanceChange(title.id, e.target.value)
                                }
                                disabled={!balanceEditable}
                                readOnly={!balanceEditable}
                                className={cn(
                                  "w-full rounded-md border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums focus:border-transparent focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-[#6B7280]",
                                  accentClassName
                                )}
                                placeholder="0"
                                step="1"
                                aria-label={
                                  activeTab === "all" && title.group !== "cash"
                                    ? `${title.name}の初期残高（カテゴリー別の合計）`
                                    : `${title.name}の初期残高`
                                }
                                title={
                                  !canEditOpeningBalance
                                    ? "ご利用初年度のみ入力できます"
                                    : balanceEditable
                                      ? "入力した金額がそのまま初期残高として登録されます"
                                      : title.group === "cash"
                                        ? "現金・預金の初期残高は「すべて」タブで入力します"
                                        : "カテゴリー別タブで入力した初期残高の合計です"
                                }
                              />
                            </div>
                          ) : null}

                          <div className="flex h-8 w-full min-w-0 items-center justify-start pl-2 pr-1">
                            <span className="w-16 shrink-0 text-xs text-[#6B7280] sm:hidden">
                              編集
                            </span>
                            {isEditing && canEditMaster ? (
                              <Button
                                type="button"
                                onClick={() => handleSaveEdit(title.id)}
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 shrink-0 px-0 text-[10px]"
                              >
                                保存
                              </Button>
                            ) : canEditMaster ? (
                              <Button
                                type="button"
                                onClick={() => handleStartEdit(title)}
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 shrink-0 p-0"
                                title="編集"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="hidden h-8 w-8 shrink-0 sm:block" aria-hidden />
                            )}
                          </div>

                          <div className="flex h-8 w-full min-w-0 items-center justify-start pl-1 pr-5">
                            <span className="w-16 shrink-0 text-xs text-[#6B7280] sm:hidden">
                              削除
                            </span>
                            {isEditing && canEditMaster ? (
                              <Button
                                type="button"
                                onClick={handleCancelEdit}
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 shrink-0 px-0 text-[10px]"
                              >
                                取消
                              </Button>
                            ) : deletable ? (
                              <Button
                                type="button"
                                onClick={() => handleDelete(title.id)}
                                variant="outline"
                                size="sm"
                                className={cn(
                                  "h-8 w-8 shrink-0 p-0",
                                  inUse || locked
                                    ? "cursor-not-allowed text-gray-400"
                                    : "text-[#EF4444] hover:text-[#EF4444]"
                                )}
                                disabled={inUse || locked}
                                title={
                                  inUse
                                    ? "仕訳または集金設定で使用中のため削除不可"
                                    : "削除"
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="hidden h-8 w-8 shrink-0 sm:block" aria-hidden />
                            )}
                          </div>
                        </div>

                        {reserveSchoolCommonBadgeSlot ? (
                          <span
                            className={cn(
                              "ml-auto w-[4.75rem] shrink-0 rounded px-2 py-0.5 text-center text-xs font-medium",
                              !isEditing && schoolCommon
                                ? "bg-indigo-50 text-indigo-800"
                                : "invisible"
                            )}
                            aria-hidden={!schoolCommon || isEditing}
                          >
                            学校共通
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {filteredAccountTitles.length === 0 ? (
          <p className="py-8 text-center text-[#6B7280]">科目が登録されていません</p>
        ) : null}
      </div>

      {showOpeningCarryover && activeTab === "all" ? (
        <div className="mr-auto mt-6 w-full max-w-2xl rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-2 text-lg font-semibold text-[#374151]">前期繰越金の初期残高</h3>
          <p className="mb-4 text-sm text-[#6B7280]">
            システム利用初年度の初期残高です。年度更新後は読み取り専用になります。
          </p>
          <div className="w-full space-y-3">
            <div>
              <label
                htmlFor="openingCarryover"
                className="mb-1.5 block text-sm font-medium text-[#374151]"
              >
                前期繰越金（円）
              </label>
              <input
                id="openingCarryover"
                type="text"
                inputMode="numeric"
                value={openingCarryoverInput}
                onChange={(e) => handleOpeningCarryoverChange(e.target.value)}
                disabled={!isInitialYear({ yearRolloverCompletedAt }) || locked}
                className={cn(
                  "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-right tabular-nums focus:border-transparent focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:text-[#6B7280]",
                  accentClassName
                )}
                placeholder="例：1,000,000"
              />
            </div>
            {isInitialYear({ yearRolloverCompletedAt }) ? (
              <div className="pt-1">
                <Button
                  type="button"
                  onClick={handleSaveOpeningCarryover}
                  disabled={locked}
                  className={cn("rounded-lg px-6 py-2.5 text-white", addButtonClassName)}
                >
                  保存
                </Button>
              </div>
            ) : (
              <p className="text-xs text-amber-700">
                年度更新後のため、前期繰越金はロックされています。
              </p>
            )}
            {openingCarryoverLocked && isInitialYear({ yearRolloverCompletedAt }) ? (
              <p className="text-xs text-[#6B7280]">
                保存済みです。初年度運用中は必要に応じて再編集できます。
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

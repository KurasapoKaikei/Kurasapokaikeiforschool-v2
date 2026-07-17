"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { HelpCircle, GripVertical, Edit2, Trash2 } from "lucide-react"
import { propagateMasterRename, type Category } from "@/utils/localStorage"
import { isDuplicateName } from "@/utils/nameNormalize"
import { cn } from "@/lib/utils"

const MSG_CATEGORY_DUPLICATE =
  "このカテゴリー名はすでに登録されています。別の名前を入力してください。"

export type CategorySettingsEditorProps = {
  /** 未指定時は見出しブロックを出さない（親画面でタイトルを持つ場合） */
  title?: string
  description?: string
  /** 追加説明（学校管理など・常時表示バナー） */
  notice?: string
  /** タイトル横の？クリックで表示する説明 */
  titleHelp?: string
  categories: Category[]
  onCategoriesChange: (next: Category[]) => void
  /** 画面全体を操作不可（追加・編集・削除・並び替えを隠す） */
  locked?: boolean
  /**
   * カテゴリー追加フォームを出すか。
   * 未指定時は `!locked`。学校がクラブ追加を禁止している場合は false を渡す。
   */
  allowAdd?: boolean
  /** 個別カテゴリーを編集・削除不可にする（学校共通など） */
  isCategoryReadOnly?: (category: Category) => boolean
  /** 名称変更時に仕訳・集金へ波及するか（onCategoryRename 指定時は使わない） */
  propagateRename?: boolean
  /**
   * 名称変更時のカスタム波及処理。
   * 指定時はデフォルトの propagateMasterRename の代わりに呼ぶ。
   * 戻り値は波及件数（トースト表示用）。
   */
  onCategoryRename?: (oldName: string, newName: string) => number
  /** 削除不可時のメッセージ（isUsed のとき） */
  deleteBlockedMessage?: string
  /** 「使用中」バッジのラベル */
  inUseBadgeLabel?: string
  /** フォーカスリング等のアクセント（デフォルト: クラブ水色） */
  accentClassName?: string
  addButtonClassName?: string
}

const DEFAULT_DELETE_BLOCKED =
  "このカテゴリーは既に使用されているため削除できません。"

export function CategorySettingsEditor({
  title,
  description,
  notice,
  titleHelp,
  categories,
  onCategoriesChange,
  locked = false,
  allowAdd,
  isCategoryReadOnly,
  propagateRename = true,
  onCategoryRename,
  deleteBlockedMessage = DEFAULT_DELETE_BLOCKED,
  inUseBadgeLabel = "使用中",
  accentClassName = "focus:ring-[#77B8DA]",
  addButtonClassName = "bg-[#77B8DA] hover:bg-[#77B8DA]/90",
}: CategorySettingsEditorProps) {
  const [newCategoryName, setNewCategoryName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [showHelpTooltip, setShowHelpTooltip] = useState(false)
  const [showTitleHelp, setShowTitleHelp] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [toastMessage, setToastMessage] = useState("")
  const [showToast, setShowToast] = useState(false)

  const showToastMsg = (message: string) => {
    setToastMessage(message)
    setShowToast(true)
    window.setTimeout(() => {
      setShowToast(false)
      setToastMessage("")
    }, 2500)
  }

  const sorted = [...categories].sort((a, b) => a.order - b.order)
  const canMutateAll = !locked
  const canAdd = !locked && (allowAdd ?? true)
  const isReadOnly = (category: Category) =>
    locked || Boolean(isCategoryReadOnly?.(category))

  const handleAddCategory = () => {
    if (!canAdd) return
    const trimmed = newCategoryName.trim()
    if (!trimmed) return
    if (isDuplicateName(trimmed, categories.map((c) => c.name))) {
      alert(MSG_CATEGORY_DUPLICATE)
      return
    }
    const newCategory: Category = {
      id: `cat-${Date.now()}`,
      name: trimmed,
      order: categories.length + 1,
      isUsed: false,
      createdAt: new Date().toISOString(),
    }
    onCategoriesChange([...categories, newCategory])
    setNewCategoryName("")
    showToastMsg("追加完了")
  }

  const handleStartEdit = (category: Category) => {
    if (isReadOnly(category)) return
    setEditingId(category.id)
    setEditingName(category.name)
  }

  const handleSaveEdit = (id: string) => {
    const target = categories.find((c) => c.id === id)
    if (!target || isReadOnly(target)) return
    const trimmed = editingName.trim()
    if (!trimmed) {
      setEditingId(null)
      setEditingName("")
      return
    }
    if (
      isDuplicateName(
        trimmed,
        categories.map((c) => c.name),
        target.name
      )
    ) {
      alert(MSG_CATEGORY_DUPLICATE)
      return
    }
    onCategoriesChange(
      categories.map((cat) => (cat.id === id ? { ...cat, name: trimmed } : cat))
    )
    if (target.name.trim() !== trimmed) {
      if (onCategoryRename) {
        const count = onCategoryRename(target.name, trimmed)
        if (count > 0) {
          showToastMsg(
            `カテゴリー名を更新（当年度の仕訳 ${count} 件に反映・過年度は変更なし）`
          )
        }
      } else if (propagateRename) {
        const propagated = propagateMasterRename(
          "category",
          target.name,
          trimmed
        )
        const total = propagated.schedules + propagated.transactions
        if (total > 0) {
          showToastMsg(
            `カテゴリー名を更新（集金設定 ${propagated.schedules} 件・仕訳 ${propagated.transactions} 件に反映）`
          )
        }
      }
    }
    setEditingId(null)
    setEditingName("")
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName("")
  }

  const handleDelete = (id: string) => {
    const category = categories.find((cat) => cat.id === id)
    if (!category || isReadOnly(category)) return
    if (category.isUsed) {
      alert(deleteBlockedMessage)
      return
    }
    if (!confirm("このカテゴリーを削除してもよろしいですか？")) return
    const updated = categories
      .filter((cat) => cat.id !== id)
      .sort((a, b) => a.order - b.order)
      .map((cat, idx) => ({ ...cat, order: idx + 1 }))
    onCategoriesChange(updated)
  }

  const handleDragStart = (index: number) => {
    if (!canMutateAll) return
    const cat = sorted[index]
    if (cat && isReadOnly(cat)) return
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (!canMutateAll) return
    setDragOverIndex(index)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (!canMutateAll) return
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }
    const next = [...sorted]
    const [draggedItem] = next.splice(draggedIndex, 1)
    next.splice(dropIndex, 0, draggedItem)
    onCategoriesChange(
      next.map((cat, idx) => ({
        ...cat,
        order: idx + 1,
      }))
    )
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const showHeader = Boolean(title || description || notice || titleHelp)

  return (
    <div className="space-y-6">
      {showHeader ? (
        <div>
          {title || titleHelp ? (
            <div className="flex items-center gap-1.5">
              {title ? (
                <h2 className="text-xl font-semibold text-[#374151]">{title}</h2>
              ) : null}
              {titleHelp ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTitleHelp((v) => !v)}
                    onBlur={() => setShowTitleHelp(false)}
                    className="text-[#6B7280] transition-colors hover:text-[#374151]"
                    aria-label={`${title ?? "カテゴリー"}についての説明`}
                    aria-expanded={showTitleHelp}
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                  {showTitleHelp ? (
                    <div
                      role="tooltip"
                      className="absolute left-0 top-6 z-50 w-80 rounded-lg bg-[#374151] p-3 text-xs leading-relaxed text-white shadow-lg sm:w-96"
                    >
                      {titleHelp}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
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

      {showToast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#77B8DA] px-4 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          {toastMessage}
        </div>
      ) : null}

      {canAdd ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-[#374151]">カテゴリー追加</h3>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <label
                  htmlFor="categoryName"
                  className="block text-sm font-medium text-[#374151]"
                >
                  カテゴリー名
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onMouseEnter={() => setShowHelpTooltip(true)}
                    onMouseLeave={() => setShowHelpTooltip(false)}
                    onClick={() => setShowHelpTooltip(!showHelpTooltip)}
                    className="text-[#6B7280] transition-colors hover:text-[#374151]"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                  {showHelpTooltip ? (
                    <div className="absolute left-0 top-6 z-50 w-80 rounded-lg bg-[#374151] p-3 text-xs text-white shadow-lg">
                      カテゴリーとは、活動ごとの収支を把握するための区分（部門）のことです。例えば「部会計」「合宿会計」「寄付金会計」などのように、目的別に設定することで、活動ごとの正確な収支を確認できるようになります。
                    </div>
                  ) : null}
                </div>
              </div>
              <input
                type="text"
                id="categoryName"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddCategory()
                  }
                }}
                className={cn(
                  "w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent",
                  accentClassName
                )}
                placeholder="カテゴリー名を入力"
              />
            </div>
            <Button
              type="button"
              onClick={handleAddCategory}
              className={cn("px-6 text-white transition-colors", addButtonClassName)}
            >
              追加する
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mb-2 rounded-lg border border-gray-200 bg-white p-6 pb-8">
        <h3 className="mb-4 text-lg font-semibold text-[#374151]">追加済みカテゴリー</h3>
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-[#6B7280]">
            設定されているカテゴリーはありません
          </p>
        ) : (
          <div className="space-y-2">
            {sorted.map((category, index) => {
              const readOnly = isReadOnly(category)
              // クラブ側のみ表示（学校管理者ポータルでは isCategoryReadOnly 未指定のため出さない）
              const schoolCommon = Boolean(isCategoryReadOnly?.(category))
              return (
                <div
                  key={category.id}
                  draggable={!readOnly}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition-colors",
                    readOnly
                      ? "cursor-default bg-gray-50/80"
                      : "cursor-move hover:bg-gray-50",
                    draggedIndex === index && "opacity-50",
                    dragOverIndex === index &&
                      draggedIndex !== index &&
                      "border-[#77B8DA] bg-[#77B8DA]/10"
                  )}
                >
                  {readOnly ? (
                    <span className="h-5 w-5 flex-shrink-0" aria-hidden />
                  ) : (
                    <GripVertical className="h-5 w-5 flex-shrink-0 text-[#6B7280]" />
                  )}
                  <div className="flex-1">
                    {editingId === category.id && !readOnly ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(category.id)
                            else if (e.key === "Escape") handleCancelEdit()
                          }}
                          className={cn(
                            "flex-1 rounded-md border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:border-transparent",
                            accentClassName
                          )}
                          autoFocus
                        />
                        <Button
                          type="button"
                          onClick={() => handleSaveEdit(category.id)}
                          variant="outline"
                          size="sm"
                        >
                          保存
                        </Button>
                        <Button
                          type="button"
                          onClick={handleCancelEdit}
                          variant="outline"
                          size="sm"
                        >
                          キャンセル
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-[#374151]">
                          {category.name}
                        </span>
                        {category.isUsed ? (
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-[#6B7280]">
                            {inUseBadgeLabel}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                  {editingId !== category.id && !readOnly ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => handleStartEdit(category)}
                        variant="outline"
                        size="sm"
                        className="h-8"
                        aria-label={`${category.name}を編集`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleDelete(category.id)}
                        disabled={category.isUsed}
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-8",
                          category.isUsed
                            ? "cursor-not-allowed text-gray-400"
                            : "text-[#EF4444] hover:text-[#EF4444]"
                        )}
                        aria-label={`${category.name}を削除`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                  {editingId !== category.id && schoolCommon ? (
                    <span className="ml-auto shrink-0 rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-800">
                      学校共通
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

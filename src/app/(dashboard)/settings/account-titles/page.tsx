"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { GripVertical, Edit2, Trash2 } from "lucide-react"
import { getCategories, getAccountTitles, saveAccountTitles, type Category, type AccountTitle } from "@/utils/localStorage"

type AccountGroup = "cash" | "income" | "expense"

const groupLabels: Record<AccountGroup, string> = {
  cash: "現金・預金",
  income: "収入",
  expense: "支出",
}

/** 現金・預金グループ選択時の説明文（カテゴリー設定なし＝共通） */
const CASH_GROUP_CATEGORY_MESSAGE = "現金・預金グループはカテゴリーの設定はありません。"

export default function AccountTitlesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])
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
    setCategories(loadedCategories)
    setAccountTitles(loadedAccountTitles)
    setIsLoaded(true)
  }, [])

  // カテゴリーの変更を監視（LocalStorageの変更を検知するため、定期的にチェック）
  useEffect(() => {
    if (!isLoaded) return
    const interval = setInterval(() => {
      const loadedCategories = getCategories()
      setCategories(loadedCategories)
    }, 500) // 500msごとにチェック

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
    if (!newAccountTitle.group || !newAccountTitle.name) {
      alert("グループと科目名は必須です。")
      return
    }
    // 現金・預金はカテゴリー設定なし（共通）。収入・支出はカテゴリー必須
    if (newAccountTitle.group !== "cash" && newAccountTitle.categoryIds.length === 0) {
      alert("収入・支出の場合はカテゴリーを1つ以上選択してください。")
      return
    }

    const newTitle: AccountTitle = {
      id: Date.now().toString(),
      group: newAccountTitle.group,
      name: newAccountTitle.name.trim(),
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
    setEditingId(title.id)
    setEditingData({
      name: title.name,
      categoryIds: [...title.categoryIds],
      balance: title.balance,
    })
  }

  const handleSaveEdit = (id: string) => {
    setAccountTitles(
      accountTitles.map((title) => {
        if (title.id !== id) return title
        // 現金・預金はカテゴリーを常に空（共通）に固定
        const categoryIds = title.group === "cash" ? [] : (editingData.categoryIds ?? title.categoryIds)
        // 残高の更新（undefined の場合は既存値を維持）
        const balance = editingData.balance !== undefined ? editingData.balance : title.balance
        return {
          ...title,
          name: editingData.name || title.name,
          categoryIds,
          balance,
        }
      })
    )
    setEditingId(null)
    setEditingData({})
    showToast("更新完了")
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingData({})
  }

  const handleDelete = (id: string) => {
    const title = accountTitles.find((t) => t.id === id)
    if (title?.isUsed) {
      alert("この科目は既に使用されているため削除できません。")
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

  return (
    <div className="px-6 py-8 bg-[#F5F5F0] min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-[#374151]">科目設定</h2>
          <p className="text-sm text-[#6B7280]">勘定科目の登録・編集・削除</p>
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

        {/* 新規追加エリア（縦並び・論理的な入力順） */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 mb-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-5 text-[#374151]">新規追加</h3>
          <div className="space-y-5 max-w-md">
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
                className="bg-[#77B8DA] hover:bg-[#77B8DA]/90 text-white px-6 py-2.5 rounded-lg"
              >
                追加する
              </Button>
            </div>
          </div>
        </div>

        {/* 追加済み科目一覧 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
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

          {/* 一覧ヘッダー（グループ｜カテゴリー｜科目名｜残高） */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_1.5fr_1fr] gap-4 px-3 py-2 mb-2 text-xs font-semibold text-[#6B7280] uppercase tracking-wide border-b border-gray-200">
            <span className="text-center">グループ</span>
            <span className="text-center">カテゴリー</span>
            <span className="text-center">科目名</span>
            <span className="text-center">残高</span>
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
                    return (
                      <div
                        key={title.id}
                        draggable
                        onDragStart={() => handleDragStart(title.id, title.group)}
                        onDragOver={(e) => handleDragOver(e, title.id, title.group)}
                        onDrop={(e) => handleDrop(e, title.id, title.group)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50/80 transition-colors cursor-move ${
                          isDragged ? "opacity-50" : ""
                        } ${
                          isDragOver ? "border-[#77B8DA] bg-[#77B8DA]/10" : ""
                        }`}
                      >
                        <GripVertical className="h-5 w-5 text-[#6B7280] flex-shrink-0" />
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.5fr_1fr] gap-3 sm:gap-4">
                          {/* グループ */}
                          <div>
                            <span className="sm:hidden text-xs text-[#6B7280]">グループ</span>
                            <span className="text-sm font-medium text-[#374151]">
                              {groupLabels[title.group]}
                            </span>
                          </div>
                          {/* カテゴリー */}
                          <div>
                            <span className="sm:hidden text-xs text-[#6B7280]">カテゴリー</span>
                            {editingId === title.id && title.group === "cash" ? (
                              <span className="text-sm text-[#6B7280] italic">
                                共通
                              </span>
                            ) : editingId === title.id ? (
                              <div className="flex flex-wrap gap-2">
                                {categories
                                  .sort((a, b) => a.order - b.order)
                                  .map((cat) => (
                                    <label key={cat.id} className="flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={(editingData.categoryIds ?? []).includes(cat.id)}
                                        onChange={() => {
                                          const ids = editingData.categoryIds ?? []
                                          const next = ids.includes(cat.id)
                                            ? ids.filter((id) => id !== cat.id)
                                            : [...ids, cat.id]
                                          setEditingData({ ...editingData, categoryIds: next })
                                        }}
                                        className="w-3.5 h-3.5 text-[#77B8DA] rounded"
                                      />
                                      <span className="text-xs">{cat.name}</span>
                                    </label>
                                  ))}
                              </div>
                            ) : (
                              <span className="text-sm text-[#6B7280]">
                                {getCategoryNames(title)}
                              </span>
                            )}
                          </div>
                          {/* 科目名 */}
                          <div>
                            <span className="sm:hidden text-xs text-[#6B7280]">科目名</span>
                            {editingId === title.id ? (
                              <input
                                type="text"
                                value={editingData.name || title.name}
                                onChange={(e) =>
                                  setEditingData({ ...editingData, name: e.target.value })
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#77B8DA] focus:border-transparent text-sm"
                                autoFocus
                              />
                            ) : (
                              <span className="text-sm font-medium text-[#374151]">{title.name}</span>
                            )}
                          </div>
                          {/* 残高 */}
                          <div>
                            <span className="sm:hidden text-xs text-[#6B7280]">残高</span>
                            {editingId === title.id ? (
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
                                className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#77B8DA] focus:border-transparent text-sm text-right tabular-nums"
                                placeholder="0"
                                step="1"
                              />
                            ) : title.balance !== null ? (
                              <span className="text-sm font-semibold text-[#374151] text-right tabular-nums block">
                                {title.balance.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-sm text-[#6B7280] text-right block">-</span>
                            )}
                          </div>
                        </div>
                        {editingId === title.id ? (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              onClick={() => handleSaveEdit(title.id)}
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
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              onClick={() => handleStartEdit(title)}
                              variant="outline"
                              size="sm"
                              className="h-8"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              onClick={() => handleDelete(title.id)}
                              variant="outline"
                              size="sm"
                              className={`h-8 ${
                                title.isUsed
                                  ? "text-gray-400 cursor-not-allowed"
                                  : "text-[#EF4444] hover:text-[#EF4444]"
                              }`}
                              disabled={title.isUsed}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { HelpCircle, GripVertical, Edit2, Trash2 } from "lucide-react"
import { getCategories, saveCategories, type Category } from "@/utils/localStorage"

export default function CategorySettingsPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // LocalStorageから読み込み
  useEffect(() => {
    const loadedCategories = getCategories()
    setCategories(loadedCategories)
    setIsLoaded(true)
  }, [])

  // カテゴリーが変更されたらLocalStorageに保存
  useEffect(() => {
    if (isLoaded) {
      saveCategories(categories)
    }
  }, [categories, isLoaded])
  const [newCategoryName, setNewCategoryName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [showHelpTooltip, setShowHelpTooltip] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
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

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return

    const newCategory: Category = {
      id: Date.now().toString(),
      name: newCategoryName.trim(),
      order: categories.length + 1,
      isUsed: false,
    }

    setCategories([...categories, newCategory])
    setNewCategoryName("")
    showToast("追加完了")
  }

  const handleStartEdit = (category: Category) => {
    setEditingId(category.id)
    setEditingName(category.name)
  }

  const handleSaveEdit = (id: string) => {
    setCategories(
      categories.map((cat) =>
        cat.id === id ? { ...cat, name: editingName.trim() } : cat
      )
    )
    setEditingId(null)
    setEditingName("")
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName("")
  }

  const handleDelete = (id: string) => {
    const category = categories.find((cat) => cat.id === id)
    if (category?.isUsed) {
      alert("このカテゴリーは既に使用されているため削除できません。")
      return
    }
    if (confirm("このカテゴリーを削除してもよろしいですか？")) {
      const updatedCategories = categories.filter((cat) => cat.id !== id)
      // orderを再計算
      const reorderedCategories = updatedCategories
        .sort((a, b) => a.order - b.order)
        .map((cat, idx) => ({ ...cat, order: idx + 1 }))
      setCategories(reorderedCategories)
    }
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    const newCategories = [...categories]
    const draggedItem = newCategories[draggedIndex]
    newCategories.splice(draggedIndex, 1)
    newCategories.splice(dropIndex, 0, draggedItem)

    // orderを更新
    const updatedCategories = newCategories.map((cat, idx) => ({
      ...cat,
      order: idx + 1,
    }))

    setCategories(updatedCategories)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="px-6 py-8 bg-[#F5F5F0] min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-[#374151]">カテゴリー設定</h2>
          <p className="text-sm text-[#6B7280]">カテゴリーの登録・編集・削除</p>
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

        {/* カテゴリー追加エリア */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4 text-[#374151]">カテゴリー追加</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <label htmlFor="categoryName" className="block text-sm font-medium text-[#374151]">
                  カテゴリー名
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onMouseEnter={() => setShowHelpTooltip(true)}
                    onMouseLeave={() => setShowHelpTooltip(false)}
                    onClick={() => setShowHelpTooltip(!showHelpTooltip)}
                    className="text-[#6B7280] hover:text-[#374151] transition-colors"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                  {showHelpTooltip && (
                    <div className="absolute left-0 top-6 z-50 w-80 p-3 bg-[#374151] text-white text-xs rounded-lg shadow-lg">
                      カテゴリーとは、活動ごとの収支を把握するための区分（部門）のことです。例えば「部会計」「合宿会計」「寄付金会計」などのように、目的別に設定することで、活動ごとの正確な収支を確認できるようになります。
                    </div>
                  )}
                </div>
              </div>
              <input
                type="text"
                id="categoryName"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddCategory()
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#77B8DA] focus:border-transparent"
                placeholder="カテゴリー名を入力"
              />
            </div>
            <Button
              type="button"
              onClick={handleAddCategory}
              className="bg-[#77B8DA] hover:bg-[#77B8DA]/90 text-white px-6 transition-colors"
            >
              追加する
            </Button>
          </div>
        </div>

        {/* 追加済みカテゴリーリスト */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 pb-8 mb-8">
          <h3 className="text-lg font-semibold mb-4 text-[#374151]">追加済みカテゴリー</h3>
          {categories.length === 0 ? (
            <p className="text-center py-8 text-[#6B7280]">カテゴリーがありません</p>
          ) : (
            <div className="space-y-2">
              {categories
                .sort((a, b) => a.order - b.order)
                .map((category, index) => (
                  <div
                    key={category.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-move ${
                      draggedIndex === index ? "opacity-50" : ""
                    } ${
                      dragOverIndex === index && draggedIndex !== index
                        ? "border-[#77B8DA] bg-[#77B8DA]/10"
                        : ""
                    }`}
                  >
                    <GripVertical className="h-5 w-5 text-[#6B7280] flex-shrink-0" />
                    <div className="flex-1">
                      {editingId === category.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                handleSaveEdit(category.id)
                              } else if (e.key === "Escape") {
                                handleCancelEdit()
                              }
                            }}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#77B8DA] focus:border-transparent"
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
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#374151]">
                            {category.name}
                          </span>
                          {category.isUsed && (
                            <span className="text-xs text-[#6B7280] bg-gray-100 px-2 py-0.5 rounded">
                              使用中
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {editingId !== category.id && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          onClick={() => handleStartEdit(category)}
                          variant="outline"
                          size="sm"
                          className="h-8"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleDelete(category.id)}
                          variant="outline"
                          size="sm"
                          className={`h-8 ${
                            category.isUsed
                              ? "text-gray-400 cursor-not-allowed"
                              : "text-[#EF4444] hover:text-[#EF4444]"
                          }`}
                          disabled={category.isUsed}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

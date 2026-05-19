"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useSchoolClubGroups } from "@/contexts/SchoolClubGroupsContext"
import { Edit2, GripVertical, Trash2 } from "lucide-react"
import { SCHOOL_BRAND_NAVY } from "@/lib/schoolTheme"
import type { SchoolClubGroup } from "@/lib/schoolClubGroups"

export function SchoolClubGroupsView() {
  const { sortedGroups, addGroup, updateGroup, deleteGroup, setGroupsOrder, isLoaded } =
    useSchoolClubGroups()
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleAdd = () => {
    if (!isLoaded) return
    const trimmed = newName.trim()
    if (!trimmed) return
    if (!addGroup(trimmed)) {
      alert("このグループ名はすでに登録されています。")
      return
    }
    setNewName("")
  }

  const handleStartEdit = (group: SchoolClubGroup) => {
    setEditingId(group.id)
    setEditingName(group.name)
  }

  const handleSaveEdit = (id: string) => {
    const trimmed = editingName.trim()
    if (!trimmed) {
      setEditingId(null)
      return
    }
    if (!updateGroup(id, trimmed)) {
      alert("このグループ名はすでに登録されています。")
      return
    }
    setEditingId(null)
    setEditingName("")
  }

  const handleDelete = (id: string) => {
    if (!confirm("このグループを削除してもよろしいですか？")) return
    deleteGroup(id)
  }

  const handleDragStart = (index: number) => setDraggedIndex(index)

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
    const next = [...sortedGroups]
    const [moved] = next.splice(draggedIndex, 1)
    next.splice(dropIndex, 0, moved)
    setGroupsOrder(next)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="min-h-full bg-[#F5F5F0] px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <div
          className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
          style={{ borderLeftWidth: 5, borderLeftColor: SCHOOL_BRAND_NAVY }}
        >
          <h3 className="mb-4 text-lg font-semibold text-[#374151]">グループ追加</h3>
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px] flex-1">
              <label
                htmlFor="groupName"
                className="mb-2 block text-sm font-medium text-[#374151]"
              >
                グループ名
              </label>
              <input
                id="groupName"
                type="text"
                value={newName}
                disabled={!isLoaded}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAdd()
                  }
                }}
                placeholder="グループ名を入力"
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#005088]/40"
              />
            </div>
            <Button
              type="button"
              onClick={handleAdd}
              disabled={!isLoaded}
              className="px-6 text-white hover:opacity-90"
              style={{ backgroundColor: SCHOOL_BRAND_NAVY }}
            >
              追加する
            </Button>
          </div>
        </div>

        <div
          className="rounded-lg border border-gray-200 bg-white p-6 pb-8 shadow-sm"
          style={{ borderLeftWidth: 5, borderLeftColor: SCHOOL_BRAND_NAVY }}
        >
          <h3 className="mb-4 text-lg font-semibold text-[#374151]">追加済みグループ</h3>
          {sortedGroups.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#9CA3AF]">
              登録されたグループはありません。
            </p>
          ) : (
            <div className="space-y-2">
              {sortedGroups.map((group, index) => (
                <div
                  key={group.id}
                  draggable={editingId !== group.id}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition-colors ${
                    editingId !== group.id ? "cursor-move hover:bg-gray-50" : ""
                  } ${draggedIndex === index ? "opacity-50" : ""} ${
                    dragOverIndex === index && draggedIndex !== index
                      ? "border-[#005088] bg-[#005088]/10"
                      : ""
                  }`}
                >
                  <GripVertical className="h-5 w-5 shrink-0 text-[#6B7280]" />
                  <div className="min-w-0 flex-1">
                    {editingId === group.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(group.id)
                            if (e.key === "Escape") setEditingId(null)
                          }}
                          className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#005088]/40"
                          autoFocus
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleSaveEdit(group.id)}
                        >
                          保存
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingId(null)}
                        >
                          キャンセル
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-[#374151]">
                        {group.name}
                      </span>
                    )}
                  </div>
                  {editingId !== group.id && (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => handleStartEdit(group)}
                        aria-label="編集"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-[#EF4444] hover:text-[#EF4444]"
                        onClick={() => handleDelete(group.id)}
                        aria-label="削除"
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
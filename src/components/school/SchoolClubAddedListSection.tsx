"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Edit2, GripVertical, Trash2 } from "lucide-react"
import { useSchoolClubGroups } from "@/contexts/SchoolClubGroupsContext"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import { SchoolClubAccountPrintModal } from "@/components/school/SchoolClubAccountPrintModal"
import { formatClubRegisteredAt } from "@/lib/schoolClubs"
import type { SchoolClub } from "@/lib/schoolClubs"

/** 順序｜クラブ名｜クラブID｜初期PW｜所属グループ｜登録日｜操作 */
const CLUB_LIST_GRID =
  "sm:[grid-template-columns:minmax(2.5rem,0.4fr)_minmax(0,1.5fr)_minmax(0,0.95fr)_minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(5.5rem,auto)]"

type SchoolClubAddedListSectionProps = {
  resetTabKey?: number
}

/** 登録済みクラブ一覧（タブ＋テーブル） */
export function SchoolClubAddedListSection({
  resetTabKey = 0,
}: SchoolClubAddedListSectionProps) {
  const { sortedGroups, isLoaded: groupsLoaded } = useSchoolClubGroups()
  const {
    sortedClubs,
    isLoaded: clubsLoaded,
    updateClub,
    deleteClub,
    setClubsOrder,
  } = useSchoolClubs()
  const [activeTab, setActiveTab] = useState<string>("all")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [editingGroupId, setEditingGroupId] = useState("")
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [printOpen, setPrintOpen] = useState(false)

  const isLoaded = groupsLoaded && clubsLoaded

  useEffect(() => {
    setActiveTab("all")
  }, [resetTabKey])

  const filteredClubs = useMemo(() => {
    if (activeTab === "all") return sortedClubs
    return sortedClubs.filter((c) => c.groupIds.includes(activeTab))
  }, [sortedClubs, activeTab])

  const handleStartEdit = (club: SchoolClub) => {
    setEditingId(club.id)
    setEditingName(club.name)
    setEditingGroupId(club.groupIds[0] ?? "")
  }

  const handleSaveEdit = (id: string) => {
    const trimmed = editingName.trim()
    if (!trimmed || !editingGroupId) return
    const group = sortedGroups.find((g) => g.id === editingGroupId)
    if (!group) return
    updateClub(id, {
      name: trimmed,
      groupId: group.id,
      groupName: group.name,
    })
    setEditingId(null)
  }

  const handleDelete = (id: string) => {
    if (!confirm("このクラブを削除してもよろしいですか？")) return
    deleteClub(id)
    if (editingId === id) setEditingId(null)
  }

  const handleDragStart = (id: string) => setDraggedId(id)

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (draggedId && draggedId !== id) setDragOverId(id)
  }

  const handleDrop = (e: React.DragEvent, dropId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === dropId) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }

    const visible = [...filteredClubs]
    const from = visible.findIndex((c) => c.id === draggedId)
    const to = visible.findIndex((c) => c.id === dropId)
    if (from === -1 || to === -1) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }

    const reorderedVisible = [...visible]
    const [moved] = reorderedVisible.splice(from, 1)
    reorderedVisible.splice(to, 0, moved)

    const visibleIds = new Set(reorderedVisible.map((c) => c.id))
    const others = sortedClubs.filter((c) => !visibleIds.has(c.id))
    setClubsOrder([...others, ...reorderedVisible])

    setDraggedId(null)
    setDragOverId(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  return (
    <div className="w-full max-w-none rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[#374151]">登録済みクラブ</h3>
        <Button
          type="button"
          variant="outline"
          className="rounded-lg border-[#005088] bg-white text-[#005088] hover:bg-[#005088]/5"
          onClick={() => setPrintOpen(true)}
          disabled={!isLoaded || sortedClubs.length === 0}
        >
          アカウント情報を印刷
        </Button>
      </div>

      <SchoolClubAccountPrintModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        clubs={sortedClubs}
      />

      <div className="mb-6">
        <div className="flex flex-wrap gap-2 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "all"
                ? "border-[#005088] text-[#005088]"
                : "border-transparent text-[#6B7280] hover:text-[#374151]"
            }`}
          >
            すべて
          </button>
          {sortedGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setActiveTab(group.id)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === group.id
                  ? "border-[#005088] text-[#005088]"
                  : "border-transparent text-[#6B7280] hover:text-[#374151]"
              }`}
            >
              {group.name}
            </button>
          ))}
        </div>
      </div>

      {!isLoaded ? (
        <p className="py-8 text-center text-sm text-[#9CA3AF]">読み込み中...</p>
      ) : filteredClubs.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#6B7280]">
          {activeTab === "all"
            ? "登録されたクラブはありません。"
            : "このグループに登録されたクラブはありません。"}
        </p>
      ) : (
        <>
          <div
            className={`mb-2 hidden items-center gap-x-2 border-b border-gray-200 pb-2 text-xs font-semibold text-[#6B7280] sm:grid ${CLUB_LIST_GRID}`}
          >
            <span className="pl-5 text-left">順序</span>
            <span className="pl-5 text-left">クラブ名</span>
            <span className="text-left">クラブID</span>
            <span className="text-left">初期PW</span>
            <span className="text-left">所属グループ</span>
            <span className="text-left">登録日</span>
            <span className="pr-4 text-right">操作</span>
          </div>

          <div className="space-y-2">
            {filteredClubs.map((club) => {
              const isDragged = draggedId === club.id
              const isDragOver = dragOverId === club.id && draggedId !== club.id
              const isEditing = editingId === club.id

              return (
                <div
                  key={club.id}
                  draggable={!isEditing}
                  onDragStart={() => handleDragStart(club.id)}
                  onDragOver={(e) => handleDragOver(e, club.id)}
                  onDrop={(e) => handleDrop(e, club.id)}
                  onDragEnd={handleDragEnd}
                  className={`cursor-move rounded-lg border border-gray-200 transition-colors hover:bg-gray-50/80 ${
                    isDragged ? "opacity-50" : ""
                  } ${isDragOver ? "border-[#005088] bg-[#005088]/10" : ""}`}
                >
                  <div
                    className={`grid grid-cols-1 gap-3 p-3 sm:items-center sm:gap-x-2 ${CLUB_LIST_GRID}`}
                  >
                    <div className="flex min-w-0 items-center gap-2 pl-5">
                      <GripVertical
                        className="h-5 w-5 shrink-0 text-[#6B7280]"
                        aria-hidden
                      />
                      <span className="text-sm font-medium tabular-nums text-[#374151]">
                        {club.order}
                      </span>
                    </div>

                    <div className="min-w-0 sm:pl-5">
                      <span className="mb-0.5 block text-xs text-[#6B7280] sm:hidden">
                        クラブ名
                      </span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#005088]/40"
                          autoFocus
                        />
                      ) : (
                        <span className="text-base font-semibold leading-snug text-[#374151]">
                          {club.name}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 font-mono text-sm text-[#374151]">
                      <span className="mb-0.5 block text-xs text-[#6B7280] sm:hidden">
                        クラブID
                      </span>
                      {club.id}
                    </div>

                    <div className="min-w-0 font-mono text-xs text-[#6B7280]">
                      <span className="mb-0.5 block text-[#9CA3AF] sm:hidden">
                        初期PW
                      </span>
                      {club.initialPassword}
                    </div>

                    <div className="min-w-0">
                      <span className="mb-0.5 block text-xs text-[#6B7280] sm:hidden">
                        所属グループ
                      </span>
                      {isEditing ? (
                        <div className="flex flex-wrap gap-3">
                          {sortedGroups.map((g) => (
                            <label
                              key={g.id}
                              className="inline-flex cursor-pointer items-center gap-2 text-sm"
                            >
                              <input
                                type="radio"
                                name={`edit-group-${club.id}`}
                                checked={editingGroupId === g.id}
                                onChange={() => setEditingGroupId(g.id)}
                                className="h-4 w-4 border-gray-300 text-[#005088] focus:ring-[#005088]/40"
                              />
                              {g.name}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-[#6B7280]">
                          {club.groupNames.join("、") || "—"}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 text-sm text-[#6B7280] sm:whitespace-nowrap">
                      <span className="mb-0.5 block text-xs text-[#6B7280] sm:hidden">
                        登録日
                      </span>
                      {formatClubRegisteredAt(club.registeredAt)}
                    </div>

                    <div className="flex min-w-0 items-center justify-end gap-4 pr-4 max-sm:col-span-full max-sm:border-t max-sm:border-gray-100 max-sm:pt-3">
                      <span className="mr-auto text-xs text-[#6B7280] sm:hidden">
                        操作
                      </span>
                      {isEditing ? (
                        <div className="flex shrink-0 items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => handleSaveEdit(club.id)}
                          >
                            保存
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => setEditingId(null)}
                          >
                            キャンセル
                          </Button>
                        </div>
                      ) : (
                        <div className="flex shrink-0 items-center justify-end gap-4">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 shrink-0 p-0"
                            onClick={() => handleStartEdit(club)}
                            aria-label="編集"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 shrink-0 p-0 text-[#EF4444] hover:text-[#EF4444]"
                            onClick={() => handleDelete(club.id)}
                            aria-label="削除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

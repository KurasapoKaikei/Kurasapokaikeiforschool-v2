"use client"

import { useState, useEffect, useMemo } from "react"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getMembers, type Member } from "@/utils/localStorage"
import { MemberModal } from "@/components/members/MemberModal"

const THEME_COLOR = "#9D8CC3"
const GRADES = [4, 3, 2, 1] as const
const GRADE_LABELS: Record<number, string> = { 1: "1年生", 2: "2年生", 3: "3年生", 4: "4年生" }

export default function MembersListPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [gradeFilter, setGradeFilter] = useState<number | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")

  // モーダル
  const [modalOpen, setModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)

  useEffect(() => {
    setMembers(getMembers())
    setIsLoaded(true)
  }, [])

  // 定期的にLocalStorageを監視
  useEffect(() => {
    if (!isLoaded) return
    const interval = setInterval(() => {
      setMembers(getMembers())
    }, 500)
    return () => clearInterval(interval)
  }, [isLoaded])

  const filtered = useMemo(() => {
    let list = members
    if (gradeFilter !== "all") {
      list = list.filter((m) => m.grade === gradeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter((m) => m.name.toLowerCase().includes(q))
    }
    return list.sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1
      if (a.grade !== b.grade) return b.grade - a.grade
      return a.name.localeCompare(b.name, "ja")
    })
  }, [members, gradeFilter, searchQuery])

  const activeMemberCount = members.filter((m) => m.status === "active").length

  const handleEdit = (member: Member) => {
    setEditingMember(member)
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setEditingMember(null)
  }

  const handleModalSuccess = () => {
    setMembers(getMembers())
    handleModalClose()
  }

  return (
    <div className="px-6 py-8 min-h-screen bg-[#F5F5F0]">
      {/* ページタイトル */}
      <div
        className="rounded-t-lg border border-b-0 border-gray-200 px-6 py-4"
        style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR, backgroundColor: "white" }}
      >
        <h2 className="text-xl font-semibold" style={{ color: THEME_COLOR }}>
          部員一覧
        </h2>
      </div>

      {/* フィルタ・検索バー */}
      <div className="bg-white border-x border-gray-200 px-6 py-3 flex flex-wrap items-end gap-4">
        {/* 学年タブ */}
        <div>
          <label className="block text-xs font-medium text-[#6B7280] mb-1">学年</label>
          <div className="flex gap-1">
            <button
              onClick={() => setGradeFilter("all")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                gradeFilter === "all" ? "text-white" : "bg-gray-100 text-[#374151] hover:bg-gray-200"
              }`}
              style={gradeFilter === "all" ? { backgroundColor: THEME_COLOR } : {}}
            >
              すべて
            </button>
            {GRADES.map((g) => (
              <button
                key={g}
                onClick={() => setGradeFilter(g)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  gradeFilter === g ? "text-white" : "bg-gray-100 text-[#374151] hover:bg-gray-200"
                }`}
                style={gradeFilter === g ? { backgroundColor: THEME_COLOR } : {}}
              >
                {GRADE_LABELS[g]}
              </button>
            ))}
          </div>
        </div>

        {/* 氏名検索 */}
        <div>
          <label className="block text-xs font-medium text-[#6B7280] mb-1">氏名検索</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9D8CC3] min-w-[200px]"
            placeholder="氏名で検索..."
          />
        </div>

        <div className="ml-auto flex items-end gap-4">
          <span className="text-sm font-medium text-[#374151]">
            在籍：<span className="font-bold" style={{ color: THEME_COLOR }}>{activeMemberCount}</span> 名
          </span>
          <span className="text-xs text-[#9CA3AF]">（単位：人）</span>
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white border border-gray-200 rounded-b-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-center font-semibold text-[#374151] border-b border-r border-gray-200 w-16">
                  No.
                </th>
                <th className="px-4 py-3 text-center font-semibold text-[#374151] border-b border-r border-gray-200">
                  氏名
                </th>
                <th className="px-4 py-3 text-center font-semibold text-[#374151] border-b border-r border-gray-200 w-24">
                  学年
                </th>
                <th className="px-4 py-3 text-center font-semibold text-[#374151] border-b border-r border-gray-200">
                  メールアドレス
                </th>
                <th className="px-4 py-3 text-center font-semibold text-[#374151] border-b border-r border-gray-200 w-28">
                  在席状況
                </th>
                <th className="px-4 py-3 text-center font-semibold text-[#374151] border-b border-gray-200 w-20">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[#9CA3AF]">
                    {members.length === 0
                      ? "部員が登録されていません。「部員管理 → 部員登録」から登録してください。"
                      : "条件に一致する部員がいません。"}
                  </td>
                </tr>
              ) : (
                filtered.map((member, idx) => {
                  const isRetired = member.status === "retired"
                  return (
                    <tr
                      key={member.id}
                      className={`border-b border-gray-100 transition-colors ${
                        isRetired ? "bg-gray-50 opacity-60" : "hover:bg-gray-50/50"
                      }`}
                    >
                      <td className="px-4 py-3 text-center text-right tabular-nums text-[#6B7280]">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 text-left font-medium text-[#374151]">
                        {member.name}
                      </td>
                      <td className="px-4 py-3 text-center text-[#374151]">
                        {GRADE_LABELS[member.grade] ?? `${member.grade}年`}
                      </td>
                      <td className="px-4 py-3 text-left text-[#6B7280]">
                        {member.email || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isRetired ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                            退部
                          </span>
                        ) : (
                          <span
                            className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: THEME_COLOR }}
                          >
                            在籍中
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => handleEdit(member)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* モーダル */}
      <MemberModal
        isOpen={modalOpen}
        member={editingMember}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}

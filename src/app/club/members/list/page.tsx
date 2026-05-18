"use client"

import { useState, useEffect, useMemo } from "react"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getMembers, type Member } from "@/utils/localStorage"
import { MemberModal } from "@/components/members/MemberModal"

const THEME_COLOR = "#9D8CC3"
const GRADES = [4, 3, 2, 1] as const
const GRADE_LABELS: Record<number, string> = { 1: "1年生", 2: "2年生", 3: "3年生", 4: "4年生" }

/** `YYYY-MM-DD` を一覧用 `YYYY/MM/DD` に整形（パース不能時は元文字列） */
function formatRetiredDateForList(iso: string): string {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  return `${m[1]}/${m[2]}/${m[3]}`
}

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

      {/* テーブル（コンパクト列幅・左寄せ） */}
      <div className="bg-white border border-gray-200 rounded-b-lg overflow-hidden py-6 px-6">
        <div className="border border-gray-200 rounded-lg overflow-hidden inline-block max-w-full">
          <div className="overflow-x-auto">
            <table className="table-fixed border-collapse text-sm w-[34rem] sm:w-[38rem]">
              <colgroup>
                <col className="w-10" />
                <col className="w-[7rem]" />
                <col className="w-12" />
                <col className="w-[9rem]" />
                <col className="w-[11rem]" />
                <col className="w-12" />
              </colgroup>
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-2 py-2.5 text-left font-semibold text-[#374151] border-b border-r border-gray-200">
                    No.
                  </th>
                  <th className="px-2 py-2.5 text-left font-semibold text-[#374151] border-b border-r border-gray-200">
                    氏名
                  </th>
                  <th className="px-2 py-2.5 text-left font-semibold text-[#374151] border-b border-r border-gray-200">
                    学年
                  </th>
                  <th className="px-2 py-2.5 text-left font-semibold text-[#374151] border-b border-r border-gray-200">
                    メールアドレス
                  </th>
                  <th className="px-2 py-2.5 text-left font-semibold text-[#374151] border-b border-r border-gray-200">
                    在席状況
                  </th>
                  <th className="px-2 py-2.5 text-left font-semibold text-[#374151] border-b border-gray-200">
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
                          className={`border-b border-gray-100 last:border-b-0 transition-colors ${
                            isRetired ? "bg-gray-50 opacity-60" : "hover:bg-[#F9FAFB]"
                          }`}
                        >
                          <td className="px-2 py-2.5 text-left tabular-nums text-[#6B7280] border-r border-gray-100">
                            {idx + 1}
                          </td>
                          <td
                            className="px-2 py-2.5 text-left text-[#374151] border-r border-gray-100 truncate max-w-0 font-medium"
                            title={member.name}
                          >
                            {member.name}
                          </td>
                          <td className="px-2 py-2.5 text-left tabular-nums text-[#374151] border-r border-gray-100">
                            {member.grade}
                          </td>
                          <td
                            className="px-2 py-2.5 text-left text-[#6B7280] border-r border-gray-100 truncate max-w-0"
                            title={member.email || undefined}
                          >
                            {member.email || "-"}
                          </td>
                          <td className="px-2 py-2.5 text-left align-top border-r border-gray-100">
                            <div className="flex flex-col items-start gap-1">
                              {isRetired ? (
                                <>
                                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                                    退部
                                  </span>
                                  {member.retiredAt ? (
                                    <span className="text-xs leading-tight text-red-500 whitespace-normal">
                                      （退部日：{formatRetiredDateForList(member.retiredAt)}）
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                <span
                                  className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                                  style={{ backgroundColor: THEME_COLOR }}
                                >
                                  在籍中
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-left align-top">
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

"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { addMember, updateMember, type Member } from "@/utils/localStorage"

const THEME_COLOR = "#9D8CC3"

interface MemberModalProps {
  isOpen: boolean
  member: Member | null // null = 新規登録
  onClose: () => void
  onSuccess: () => void
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10)
}

export function MemberModal({ isOpen, member, onClose, onSuccess }: MemberModalProps) {
  const isEdit = !!member

  const [formData, setFormData] = useState({
    name: "",
    grade: "" as string,
    email: "",
    status: "active" as "active" | "retired",
    retiredAt: "",
  })

  useEffect(() => {
    if (isOpen) {
      if (member) {
        setFormData({
          name: member.name,
          grade: String(member.grade),
          email: member.email,
          status: member.status,
          retiredAt: member.retiredAt ?? "",
        })
      } else {
        setFormData({
          name: "",
          grade: "",
          email: "",
          status: "active",
          retiredAt: "",
        })
      }
    }
  }, [isOpen, member])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      alert("氏名を入力してください。")
      return
    }
    if (!formData.grade) {
      alert("学年を選択してください。")
      return
    }
    if (formData.status === "retired" && !formData.retiredAt) {
      alert("退部日を入力してください。")
      return
    }

    const payload = {
      name: formData.name.trim(),
      grade: parseInt(formData.grade, 10),
      email: formData.email.trim(),
      status: formData.status,
      retiredAt: formData.status === "retired" ? formData.retiredAt : null,
    }

    if (isEdit && member) {
      updateMember(member.id, payload)
    } else {
      addMember(payload)
    }

    onSuccess()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" aria-hidden onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-modal-title"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 id="member-modal-title" className="text-lg font-semibold" style={{ color: THEME_COLOR }}>
            {isEdit ? "部員情報を編集" : "新規部員登録"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#6B7280] hover:bg-gray-100 hover:text-[#374151]"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* 氏名 */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                氏名 <span className="text-[#EF4444]">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9D8CC3] focus:border-transparent"
                placeholder="例：山田 太郎"
                required
                autoFocus
              />
            </div>

            {/* 学年 */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                学年 <span className="text-[#EF4444]">*</span>
              </label>
              <select
                value={formData.grade}
                onChange={(e) => setFormData((p) => ({ ...p, grade: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9D8CC3] focus:border-transparent bg-white"
                required
              >
                <option value="">選択してください</option>
                <option value="1">1年生</option>
                <option value="2">2年生</option>
                <option value="3">3年生</option>
                <option value="4">4年生</option>
              </select>
            </div>

            {/* メールアドレス */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                メールアドレス
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9D8CC3] focus:border-transparent"
                placeholder="例：taro@example.com"
              />
            </div>

            {/* 在席状況（編集時のみ） */}
            {isEdit && (
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  在席状況
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="active"
                      checked={formData.status === "active"}
                      onChange={() => setFormData((p) => ({ ...p, status: "active", retiredAt: "" }))}
                      className="w-4 h-4"
                      style={{ accentColor: THEME_COLOR }}
                    />
                    <span className="text-sm text-[#374151]">在籍中</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="retired"
                      checked={formData.status === "retired"}
                      onChange={() =>
                        setFormData((p) => ({ ...p, status: "retired", retiredAt: p.retiredAt || getTodayString() }))
                      }
                      className="w-4 h-4"
                      style={{ accentColor: THEME_COLOR }}
                    />
                    <span className="text-sm text-[#374151]">退部</span>
                  </label>
                </div>

                {/* 退部日（退部選択時のみ表示） */}
                {formData.status === "retired" && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-[#374151] mb-1.5">
                      退部日 <span className="text-[#EF4444]">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.retiredAt}
                      onChange={(e) => setFormData((p) => ({ ...p, retiredAt: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9D8CC3] focus:border-transparent"
                      required
                    />
                  </div>
                )}
              </div>
            )}

            {/* ボタン */}
            <div className="flex gap-3 pt-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                className="flex-1 text-white"
                style={{ backgroundColor: THEME_COLOR }}
              >
                {isEdit ? "変更を保存する" : "登録する"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

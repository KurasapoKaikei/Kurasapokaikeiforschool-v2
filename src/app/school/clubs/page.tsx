"use client"

import { useId, useState } from "react"

type ClubListItem = { id: string; name: string }

export default function SchoolClubsPage() {
  const inputId = useId()
  const [name, setName] = useState("")
  const [clubs, setClubs] = useState<ClubListItem[]>([])

  const register = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setClubs((prev) => [...prev, { id: crypto.randomUUID(), name: trimmed }])
    setName("")
  }

  return (
    <div className="px-6 py-8 min-h-screen bg-[#F5F5F0]">
      <div
        className="rounded-t-lg border border-b-0 border-gray-300 bg-white overflow-hidden"
        style={{ borderLeftWidth: 5, borderLeftColor: "#1A237E" }}
      >
        <div className="px-6 py-4">
          <h2 className="text-xl font-bold text-[#1A237E]">クラブ一覧・登録</h2>
          <p className="text-xs text-[#6B7280] mt-1">学校配下のクラブを登録し、一覧で確認します。（単位：件）</p>
        </div>
        <div className="border-t border-gray-200 px-6 py-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1 max-w-md">
              <label htmlFor={inputId} className="block text-sm font-medium text-[#374151] mb-1.5">
                クラブ名
              </label>
              <input
                id={inputId}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && register()}
                placeholder="例：硬式野球部"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-md bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-budget/30 focus:border-budget"
              />
            </div>
            <button
              type="button"
              onClick={register}
              className="px-5 py-2.5 rounded-md text-sm font-semibold bg-budget text-white shadow-sm hover:opacity-95"
            >
              登録
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-300 rounded-b-lg overflow-hidden border-t-0">
        <div className="p-5">
          {clubs.length === 0 ? (
            <p className="text-sm text-[#6B7280]">登録されたクラブはまだありません。</p>
          ) : (
            <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md overflow-hidden">
              {clubs.map((c) => (
                <li key={c.id} className="px-4 py-3 bg-white text-[#374151] text-sm">
                  {c.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

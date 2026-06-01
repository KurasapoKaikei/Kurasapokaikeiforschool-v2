"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useUserInfo } from "@/contexts/UserInfoContext"
import { SettlementLockAlert } from "@/components/club/SettlementLockAlert"
import { useClubSettlementLock } from "@/hooks/useClubSettlementLock"

const MAX_STAFF = 5

export default function StaffSettingsPage() {
  const { userInfo, updateStaffNames } = useUserInfo()
  const [fields, setFields] = useState<string[]>(() =>
    Array.from({ length: MAX_STAFF }, (_, i) => userInfo.staffNames[i] ?? "")
  )
  const [staff1Error, setStaff1Error] = useState<string | null>(null)
  const isLocked = useClubSettlementLock()

  useEffect(() => {
    setFields(Array.from({ length: MAX_STAFF }, (_, i) => userInfo.staffNames[i] ?? ""))
  }, [userInfo.staffNames])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isLocked) return
    const first = fields[0]?.trim() ?? ""
    if (!first) {
      setStaff1Error("担当者1は必須です")
      return
    }
    setStaff1Error(null)
    const rest = fields
      .slice(1)
      .map((s) => s.trim())
      .filter(Boolean)
    const names = [first, ...rest].slice(0, MAX_STAFF)
    updateStaffNames(names)
    alert("担当者名を保存しました")
  }

  return (
    <div className="px-6 py-8 bg-[#F5F5F0] min-h-screen">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-[#374151]">担当者設定</h2>
          <p className="text-sm text-[#6B7280]">
            会計入力の担当者（最大{MAX_STAFF}名）を登録します。担当者1は必須です。担当者2以降の空欄は保存されません。
          </p>
          <SettlementLockAlert isLocked={isLocked} className="mt-4" />
        </div>

        <form noValidate onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          {fields.map((value, idx) => {
            const isFirst = idx === 0
            const hasErr = isFirst && staff1Error
            return (
              <div key={idx}>
                <label htmlFor={`staff-${idx}`} className="block text-sm font-medium text-[#374151] mb-1.5">
                  担当者 {idx + 1}
                  {isFirst && (
                    <span className="text-[#EF4444] font-normal ml-1.5" aria-hidden>
                      ＊必須
                    </span>
                  )}
                </label>
                <input
                  id={`staff-${idx}`}
                  type="text"
                  value={value}
                  onChange={(e) => {
                    const next = [...fields]
                    next[idx] = e.target.value
                    setFields(next)
                    if (isFirst) setStaff1Error(null)
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    hasErr
                      ? "border-red-500 focus:ring-red-400 focus:border-red-500"
                      : "border-gray-300 focus:ring-[#77B8DA] focus:border-transparent"
                  }`}
                  placeholder={isFirst ? "氏名（必須）" : "氏名（任意）"}
                  autoComplete="name"
                  aria-invalid={hasErr ? true : undefined}
                  aria-describedby={hasErr ? "staff-0-error" : undefined}
                />
                {hasErr ? (
                  <p id="staff-0-error" className="mt-1.5 text-sm text-red-600" role="alert">
                    {staff1Error}
                  </p>
                ) : null}
              </div>
            )
          })}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="submit" disabled={isLocked} className="bg-[#77B8DA] hover:bg-[#77B8DA]/90 text-white px-8">
              保存する
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

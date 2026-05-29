"use client"

import { useEffect, useState } from "react"
import { SettlementLockAlert } from "@/components/club/SettlementLockAlert"

export default function FiscalYearsPage() {
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    try {
      const savedLocked = localStorage.getItem("is_club_settlement_locked")
      if (savedLocked === "true") {
        setIsLocked(true)
      }
    } catch (e) {}
  }, [])

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2 text-[#374151]">会計年度管理</h2>
        <p className="text-sm text-[#6B7280]">会計年度の作成・編集・削除</p>
        <SettlementLockAlert isLocked={isLocked} className="mt-4" />
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <p className="text-center py-8 text-[#6B7280]">
          会計年度管理は後で実装
        </p>
      </div>
    </div>
  )
}

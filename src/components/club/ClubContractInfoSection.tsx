"use client"

import { useEffect, useState } from "react"
import { SCHOOL_SESSION_CHANGED_EVENT } from "@/lib/currentSchool"
import { getSchoolContractDisplay } from "@/lib/getSchoolContractDisplay"
import { CONTRACT_INFO_STORAGE_KEY } from "@/lib/schoolContractInfo"
import type { ContractDisplayData } from "@/lib/schoolContractInfo"
import { SCHOOL_THEME } from "@/lib/schoolTheme"

function ContractInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline border-t border-gray-100 py-3 first:border-t-0 first:pt-0">
      <span className="w-1/3 shrink-0 max-w-[11rem] pr-4 text-left text-sm text-[#6B7280]">
        {label}
      </span>
      <span className="min-w-0 flex-1 break-words text-left text-sm font-medium text-[#374151]">
        {value}
      </span>
    </div>
  )
}

function ContractSectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      style={{ borderLeftWidth: 5, borderLeftColor: SCHOOL_THEME.navy }}
    >
      <h3 className="mb-4 border-b border-gray-200 pb-2 text-lg font-semibold text-indigo-950">
        {title}
      </h3>
      {children}
    </section>
  )
}

/** クラブ設定：学校契約状況（localStorage 連動・表示専用） */
export function ClubContractInfoSection() {
  const [contract, setContract] = useState<ContractDisplayData | null>(null)

  useEffect(() => {
    const refresh = () => setContract(getSchoolContractDisplay())
    refresh()
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === null ||
        e.key === CONTRACT_INFO_STORAGE_KEY ||
        e.key === "current_school" ||
        e.key === "active_schools"
      ) {
        refresh()
      }
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener(SCHOOL_SESSION_CHANGED_EVENT, refresh)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refresh()
    })
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener(SCHOOL_SESSION_CHANGED_EVENT, refresh)
      window.removeEventListener("focus", refresh)
    }
  }, [])

  if (!contract) {
    return (
      <ContractSectionCard title="ご契約情報">
        <p className="text-sm text-[#9CA3AF]">読み込み中…</p>
      </ContractSectionCard>
    )
  }

  return (
    <ContractSectionCard title="ご契約情報">
      <div className="overflow-x-hidden">
        <ContractInfoRow label="ご利用開始日" value={contract.startDate} />
        <ContractInfoRow label="ご契約プラン" value={contract.planSelectLabel} />
        <ContractInfoRow label="オプション" value={contract.optionsLabel} />
        <ContractInfoRow label="会計期間" value={contract.fiscalPeriod} />
        <ContractInfoRow label="決算日" value={contract.settlementDate} />
      </div>
    </ContractSectionCard>
  )
}

"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { SCHOOL_SESSION_CHANGED_EVENT } from "@/lib/currentSchool"
import { getSchoolContractDisplay } from "@/lib/getSchoolContractDisplay"
import type { ContractDisplayData } from "@/lib/schoolContractInfo"
import { SCHOOL_ROUTES, SCHOOL_THEME } from "@/lib/schoolTheme"
import { FileText } from "lucide-react"

type ContractSummary = {
  plan: string
  options: string
  amount: string
  paymentCycle: string
  nextPaymentDate: string
  paymentMethod: string
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-1.5 border-b border-gray-100 px-1 last:border-0">
      <span className="text-xs font-medium text-[#6B7280]">{label}</span>
      <span className="text-sm font-medium leading-snug text-[#374151]">
        {value}
      </span>
    </div>
  )
}

function formatNextPaymentDate(d: ContractDisplayData): string {
  if (d.paymentCycle === "年払い") {
    return "次回 2027年7月31日"
  }
  const dayMatch = d.paymentDayLabel.match(/(\d+)日/)
  const day = dayMatch?.[1] ?? "1"
  return `次回 2026年7月${day}日`
}

function toSummary(d: ContractDisplayData): ContractSummary {
  const nextPaymentDate = formatNextPaymentDate(d)

  return {
    plan: d.planSelectLabel,
    options: d.optionsLabel,
    amount: d.contractAmountLabel,
    paymentCycle: d.paymentCycle,
    nextPaymentDate,
    paymentMethod: d.paymentMethod,
  }
}

export function SchoolContractStatusSummaryCard() {
  const [summary, setSummary] = useState<ContractSummary | null>(null)

  useEffect(() => {
    const refresh = () => setSummary(toSummary(getSchoolContractDisplay()))
    refresh()
    window.addEventListener("storage", refresh)
    window.addEventListener(SCHOOL_SESSION_CHANGED_EVENT, refresh)
    return () => {
      window.removeEventListener("storage", refresh)
      window.removeEventListener(SCHOOL_SESSION_CHANGED_EVENT, refresh)
    }
  }, [])

  if (!summary) {
    return (
      <div className="h-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-[#6B7280]">契約状況を読み込み中…</p>
      </div>
    )
  }

  const rows: Array<{ label: string; value: string }> = [
    { label: "契約プラン", value: summary.plan },
    { label: "オプション", value: summary.options },
    { label: "金額", value: summary.amount },
    { label: "支払いサイクル", value: summary.paymentCycle },
    { label: "お支払い日", value: summary.nextPaymentDate },
    { label: "お支払方法", value: summary.paymentMethod },
  ]

  return (
    <section
      className="flex h-full min-h-0 flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      style={{ borderLeftWidth: 5, borderLeftColor: SCHOOL_THEME.navy }}
      aria-labelledby="contract-status-heading"
    >
      <div className="mb-6 flex shrink-0 items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText
            className="h-5 w-5 flex-shrink-0"
            style={{ color: SCHOOL_THEME.navy, strokeWidth: 2.5 }}
          />
          <h2
            id="contract-status-heading"
            className="text-lg font-semibold text-indigo-950"
          >
            契約状況
          </h2>
        </div>
        <Link
          href={SCHOOL_ROUTES.contract}
          className="shrink-0 text-sm font-medium text-indigo-900 underline-offset-2 hover:text-indigo-950 hover:underline"
        >
          詳細を見る
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-100 bg-[#FAFAF8] px-5 py-3">
        {rows.map((row) => (
          <DataRow key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
    </section>
  )
}

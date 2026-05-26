"use client"

import {
  calculateRegisterPricing,
  formatYen,
  type RegisterOptionsState,
} from "@/lib/registerPricing"
import type { SchoolPlanId } from "@/lib/schoolContractInfo"
import { SCHOOL_BRAND_NAVY } from "@/lib/schoolTheme"

type RegisterPricingSummaryProps = {
  plan: SchoolPlanId
  options: RegisterOptionsState
  compact?: boolean
}

/** お申込み合計金額（月額）のリアルタイム表示 */
export function RegisterPricingSummary({
  plan,
  options,
  compact = false,
}: RegisterPricingSummaryProps) {
  const { lines, totalMonthly } = calculateRegisterPricing(plan, options)

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-gray-200 bg-[#FAFCFE] p-4"
          : "rounded-xl border-2 border-[#005088]/15 bg-gradient-to-b from-[#FAFCFE] to-white p-5 shadow-sm"
      }
    >
      {!compact ? (
        <p className="mb-3 text-sm font-semibold text-[#374151]">料金内訳</p>
      ) : null}
      <ul className="space-y-2 text-sm">
        {lines.map((line) => (
          <li
            key={line.key}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
          >
            <span className="min-w-0 flex-1 text-[#6B7280]">{line.label}</span>
            <span className="shrink-0 tabular-nums font-medium text-[#374151]">
              {line.note ?? formatYen(line.amount)}
            </span>
          </li>
        ))}
      </ul>
      <div
        className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-[#005088]/10 pt-4"
        style={{ borderTopWidth: compact ? 1 : 2 }}
      >
        <span className="text-sm font-semibold text-[#374151]">
          お申込み合計金額（月額）
        </span>
        <span
          className="text-xl font-bold tabular-nums"
          style={{ color: SCHOOL_BRAND_NAVY }}
        >
          {formatYen(totalMonthly)}
          <span className="ml-1 text-xs font-normal text-[#6B7280]">(税込)</span>
        </span>
      </div>
    </div>
  )
}

/** 新規申込フォーム用ユーティリティ */

import type { PaymentMethodId, SchoolPlanId } from "@/lib/schoolContractInfo"

export type PaymentCycleId = "monthly" | "yearly"

/** 月払いのお支払い日（31 = 末日） */
export type MonthlyBillingDay = 10 | 26 | 31

export const PLAN_SELECT_OPTIONS: { value: SchoolPlanId; label: string }[] = [
  { value: "light", label: "ライトプラン（最大10クラブ）" },
  { value: "standard", label: "スタンダードプラン（最大100クラブ）" },
  { value: "plus", label: "プラスプラン（上限なし）" },
]

export const MONTHLY_BILLING_OPTIONS: { value: MonthlyBillingDay; label: string }[] = [
  { value: 10, label: "10日" },
  { value: 26, label: "26日" },
  { value: 31, label: "末日" },
]

const DAYS_IN_MONTH: Record<number, number> = {
  1: 31,
  2: 28,
  3: 31,
  4: 30,
  5: 31,
  6: 30,
  7: 31,
  8: 31,
  9: 30,
  10: 31,
  11: 30,
  12: 31,
}

/** 決算月に応じた日の最大値（閏年は考慮しない） */
export function getMaxDaysInMonth(month: number): number {
  return DAYS_IN_MONTH[month] ?? 31
}

export function clampSettlementDay(month: number, day: number): number {
  const max = getMaxDaysInMonth(month)
  return Math.min(Math.max(1, day), max)
}

export function getSettlementDayOptions(month: number): number[] {
  const max = getMaxDaysInMonth(month)
  return Array.from({ length: max }, (_, i) => i + 1)
}

export function formatPaymentCycleLabel(cycle: PaymentCycleId): string {
  return cycle === "monthly" ? "月払い" : "年払い"
}

export function formatBillingDayLabel(
  cycle: PaymentCycleId,
  monthlyDay: MonthlyBillingDay,
  settlementMonth: number
): string {
  if (cycle === "yearly") {
    return `決算月（${settlementMonth}月）の月末`
  }
  if (monthlyDay === 31) return "末日"
  return `毎月${monthlyDay}日`
}

export function formatBillingForContract(
  cycle: PaymentCycleId,
  monthlyDay: MonthlyBillingDay,
  settlementMonth: number
): string {
  if (cycle === "yearly") {
    return `年払い（${settlementMonth}月末・決算月先払い）`
  }
  const dayLabel = monthlyDay === 31 ? "毎月末日" : `毎月${monthlyDay}日`
  return `月払い（${dayLabel}）`
}

export const YEARLY_PAYMENT_NOTE =
  "※年払いは決算月の月末に次年度分を先払いしていただくサイクルとなります。初年度は申込翌月末に当年度分（1年分）をご請求させていただきます。年間利用料となりますので、期中の利用開始でも1年分のご利用料となります。"

export const MONTHLY_PAYMENT_NOTE =
  "※月払いは、ご指定のお支払日に当月分を先払いいただきます。初年度は申込翌月末に「会計期間開始月〜ご利用開始月分」を一括でのご請求となります。本サービスは年間利用料契約となりますので、期中の利用開始でも1年分のご利用料となります。なお、期中で退会される場合は、最後のお支払い時に残債（未払いの残月数分）を精算の上、一括でご請求させていただきます。"

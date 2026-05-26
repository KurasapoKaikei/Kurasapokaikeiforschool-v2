/** 新規申込：プラン・オプション料金（将来の改定に備え price を正本化） */

import type { SchoolPlanId } from "@/lib/schoolContractInfo"

export type RegisterOptionId = "auditFlow" | "memberMypage" | "onlinePayment"

export type RegisterOptionsState = {
  auditFlow: boolean
  memberMypage: boolean
  onlinePayment: boolean
}

export const DEFAULT_REGISTER_OPTIONS: RegisterOptionsState = {
  auditFlow: false,
  memberMypage: false,
  onlinePayment: false,
}

/** プラン基本料金（月額・税込・ダミー） */
export const PLAN_MONTHLY_PRICE: Record<SchoolPlanId, number> = {
  light: 5_000,
  standard: 10_000,
  plus: 20_000,
}

export type RegisterOptionDefinition = {
  id: RegisterOptionId
  label: string
  /** 月額料金（税込） */
  price: number
  /** 8月以降リリース予定など */
  releaseScheduled?: boolean
  releaseNote?: string
}

export const REGISTER_OPTION_DEFINITIONS: RegisterOptionDefinition[] = [
  {
    id: "auditFlow",
    label: "クラブ監査 担当割り当てオプション",
    price: 3_000,
  },
  {
    id: "memberMypage",
    label: "部員マイページ機能（保護者連携）",
    price: 0,
    releaseScheduled: true,
    releaseNote: "8月リリース予定",
  },
  {
    id: "onlinePayment",
    label:
      "部員オンライン決済連携（クレジットカード・QRコード・コンビニ払）",
    price: 0,
    releaseScheduled: true,
    releaseNote: "8月リリース予定",
  },
]

export type PricingLineItem = {
  key: string
  label: string
  amount: number
  note?: string
}

export type RegisterPricingBreakdown = {
  lines: PricingLineItem[]
  totalMonthly: number
}

export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`
}

function getOptionDef(id: RegisterOptionId): RegisterOptionDefinition {
  return REGISTER_OPTION_DEFINITIONS.find((o) => o.id === id)!
}

export function calculateRegisterPricing(
  plan: SchoolPlanId,
  options: RegisterOptionsState
): RegisterPricingBreakdown {
  const lines: PricingLineItem[] = [
    {
      key: "plan",
      label: "基本プラン",
      amount: PLAN_MONTHLY_PRICE[plan],
    },
  ]

  if (options.auditFlow) {
    const def = getOptionDef("auditFlow")
    lines.push({
      key: def.id,
      label: def.label,
      amount: def.price,
    })
  }

  if (options.memberMypage) {
    const def = getOptionDef("memberMypage")
    lines.push({
      key: def.id,
      label: def.label,
      amount: def.price,
      note: def.releaseScheduled
        ? "¥0 (8月以降有償化予定)"
        : undefined,
    })
  }

  if (options.onlinePayment) {
    const def = getOptionDef("onlinePayment")
    lines.push({
      key: def.id,
      label: def.label,
      amount: def.price,
      note: def.releaseScheduled
        ? "¥0 (8月以降有償化予定)"
        : undefined,
    })
  }

  const totalMonthly = lines.reduce((sum, line) => sum + line.amount, 0)
  return { lines, totalMonthly }
}

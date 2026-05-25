/** 学校新規申込フォーム → 契約状況画面連動（localStorage） */

import { loadSchoolClubs } from "@/lib/schoolClubs"
import {
  formatBillingDayLabel,
  formatBillingForContract,
  MONTHLY_PAYMENT_NOTE,
  PLAN_SELECT_OPTIONS,
  YEARLY_PAYMENT_NOTE,
  type PaymentCycleId,
  type MonthlyBillingDay,
} from "@/lib/registerFormUtils"

export const CONTRACT_INFO_STORAGE_KEY = "contract_info"

export type SchoolPlanId = "light" | "standard" | "plus"

export type PaymentMethodId = "auto_debit" | "bank_transfer" | "credit_card"

export type PaymentCycleId = "monthly" | "yearly"

/** 月払い時の請求日（31 = 末日） */
export type MonthlyBillingDay = 10 | 26 | 31

export type SchoolContractInfo = {
  submittedAt: string
  /** 本登録後の学校ID（SCH-xxxxx） */
  schoolId?: string
  school: {
    schoolName: string
    representativeName: string
    postalCode: string
    prefecture: string
    city: string
    addressLine: string
    phone: string
  }
  contact: {
    department: string
    position: string
    contactName: string
    contactPhone: string
    email: string
  }
  contract: {
    plan: SchoolPlanId
    settlementMonth: number
    settlementDay: number
    paymentCycle: PaymentCycleId
    /** 月払い時のみ（10 / 26 / 31） */
    monthlyBillingDay: MonthlyBillingDay
    paymentMethod: PaymentMethodId
  }
}

export const PLAN_META: Record<
  SchoolPlanId,
  { label: string; planDisplay: string; maxClubs: number | null }
> = {
  light: {
    label: "ライト",
    planDisplay: "クラサポ会計 for School ライトプラン",
    maxClubs: 10,
  },
  standard: {
    label: "スタンダード",
    planDisplay: "クラサポ会計 for School スタンダードプラン",
    maxClubs: 100,
  },
  plus: {
    label: "プラス",
    planDisplay: "クラサポ会計 for School プラスプラン",
    maxClubs: null,
  },
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodId, string> = {
  auto_debit: "自動振替",
  bank_transfer: "銀行振込",
  credit_card: "クレジット払い",
}

const ANNUAL_FEE: Record<SchoolPlanId, string> = {
  light: "¥60,000 (税込)",
  standard: "¥120,000 (税込)",
  plus: "要お見積り",
}

export function saveContractInfo(info: SchoolContractInfo): void {
  if (typeof window === "undefined") return
  localStorage.setItem(CONTRACT_INFO_STORAGE_KEY, JSON.stringify(info))
}

export function loadContractInfo(): SchoolContractInfo | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CONTRACT_INFO_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SchoolContractInfo & {
      schoolId?: string
    }
    if (parsed?.school?.schoolName && parsed?.contract?.plan) {
      return {
        ...parsed,
        contract: migrateContractFields(parsed.contract),
      }
    }
    return null
  } catch {
    return null
  }
}

export function loadContractSchoolId(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CONTRACT_INFO_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { schoolId?: string }
    return typeof parsed.schoolId === "string" ? parsed.schoolId : null
  } catch {
    return null
  }
}

export function formatRegisteredClubsLine(plan: SchoolPlanId): string {
  const registered = loadSchoolClubs().length
  const meta = PLAN_META[plan]
  if (meta.maxClubs == null) {
    return `${registered}クラブ登録済み （上限なし）`
  }
  return `${registered} / ${meta.maxClubs}クラブ`
}

function formatSettlementDate(month: number, day: number): string {
  return `${month}月${day}日`
}

function formatFiscalPeriod(month: number, day: number): string {
  const endMonth = month
  const endDay = day
  const startMonth = endMonth === 12 ? 1 : endMonth + 1
  const startYear = 2026
  const endYear = startMonth > endMonth ? startYear + 1 : startYear
  return `${startYear}.${startMonth}.1 ～ ${endYear}.${endMonth}.${endDay}`
}

function formatBillingMonth(contract: SchoolContractInfo["contract"]): string {
  const cycle = contract.paymentCycle ?? "monthly"
  const monthlyDay = (contract.monthlyBillingDay ?? 31) as MonthlyBillingDay
  return formatBillingForContract(
    cycle,
    monthlyDay,
    contract.settlementMonth
  )
}

/** 旧データ互換（billingDayOfMonth のみ） */
function migrateContractFields(
  c: Partial<SchoolContractInfo["contract"]> & { billingDayOfMonth?: number }
): SchoolContractInfo["contract"] {
  const plan = c.plan ?? "standard"
  const settlementMonth = c.settlementMonth ?? 3
  const settlementDay = c.settlementDay ?? 31
  if (c.paymentCycle) {
    return {
      plan,
      settlementMonth,
      settlementDay,
      paymentCycle: c.paymentCycle,
      monthlyBillingDay: (c.monthlyBillingDay ?? 31) as MonthlyBillingDay,
      paymentMethod: c.paymentMethod ?? "bank_transfer",
    }
  }
  const legacyDay = c.billingDayOfMonth ?? 31
  let monthlyBillingDay: MonthlyBillingDay = 31
  if (legacyDay === 10) monthlyBillingDay = 10
  else if (legacyDay === 26) monthlyBillingDay = 26
  return {
    plan,
    settlementMonth,
    settlementDay,
    paymentCycle: "monthly",
    monthlyBillingDay,
    paymentMethod: c.paymentMethod ?? "bank_transfer",
  }
}

function formatStartDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/** 契約状況画面用の表示オブジェクト */
export type ContractDisplayData = {
  startDate: string
  plan: string
  registeredClubs: string
  fiscalPeriod: string
  settlementDate: string
  annualFee: string
  billingMonth: string
  paymentCycle: string
  /** 申込フォームと同じプラン表示（例: ライトプラン（最大10クラブ）） */
  planSelectLabel: string
  /** お支払い日の表示（例: 毎月26日 / 決算月（3月）の月末） */
  paymentDayLabel: string
  /** 月払い・年払いの注釈全文 */
  paymentCycleNote: string
  paymentMethod: string
  schoolName: string
  representativeName: string
  postalCode: string
  prefecture: string
  city: string
  addressLine: string
  phone: string
  department: string
  position: string
  contactName: string
  contactPhone: string
  email: string
  loginId: string
  passwordMask: string
}

export function contractInfoToDisplay(info: SchoolContractInfo): ContractDisplayData {
  const { school, contact, contract: rawContract } = info
  const contract = migrateContractFields(rawContract)
  const planMeta = PLAN_META[contract.plan]
  const loginId = info.schoolId ?? "（申込後に発行）"
  const cycleLabel =
    contract.paymentCycle === "yearly" ? "年払い" : "月払い"
  const monthlyDay = (contract.monthlyBillingDay ?? 31) as MonthlyBillingDay
  const planSelectLabel =
    PLAN_SELECT_OPTIONS.find((o) => o.value === contract.plan)?.label ??
    planMeta.planDisplay
  return {
    startDate: formatStartDate(info.submittedAt),
    plan: planMeta.planDisplay,
    planSelectLabel,
    registeredClubs: formatRegisteredClubsLine(contract.plan),
    fiscalPeriod: formatFiscalPeriod(contract.settlementMonth, contract.settlementDay),
    settlementDate: formatSettlementDate(
      contract.settlementMonth,
      contract.settlementDay
    ),
    annualFee: ANNUAL_FEE[contract.plan],
    billingMonth: formatBillingMonth(contract),
    paymentCycle: cycleLabel,
    paymentDayLabel: formatBillingDayLabel(
      contract.paymentCycle,
      monthlyDay,
      contract.settlementMonth
    ),
    paymentCycleNote:
      contract.paymentCycle === "yearly"
        ? YEARLY_PAYMENT_NOTE
        : MONTHLY_PAYMENT_NOTE,
    paymentMethod: PAYMENT_METHOD_LABELS[contract.paymentMethod],
    schoolName: school.schoolName,
    representativeName: school.representativeName,
    postalCode: school.postalCode,
    prefecture: school.prefecture,
    city: school.city,
    addressLine: school.addressLine,
    phone: school.phone,
    department: contact.department,
    position: contact.position,
    contactName: contact.contactName,
    contactPhone: contact.contactPhone,
    email: contact.email,
    loginId,
    passwordMask: "••••••••••••",
  }
}

/** 郵便番号から住所を取得（zipcloud API、失敗時はデモ用フォールバック） */
export async function fetchAddressByPostalCode(
  postalCode: string
): Promise<{ prefecture: string; city: string } | null> {
  const digits = postalCode.replace(/\D/g, "")
  if (digits.length !== 7) return null

  try {
    const res = await fetch(
      `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`
    )
    const data = (await res.json()) as {
      status: number
      results?: Array<{
        address1: string
        address2: string
        address3: string
      }>
    }
    if (data.status === 200 && data.results?.[0]) {
      const r = data.results[0]
      return {
        prefecture: r.address1,
        city: `${r.address2}${r.address3}`,
      }
    }
  } catch {
    /* デモ用フォールバックへ */
  }

  const prefix = digits.slice(0, 3)
  const fallback: Record<string, { prefecture: string; city: string }> = {
    "100": { prefecture: "東京都", city: "千代田区" },
    "150": { prefecture: "東京都", city: "渋谷区" },
    "530": { prefecture: "大阪府", city: "大阪市北区" },
  }
  return fallback[prefix] ?? { prefecture: "東京都", city: "千代田区" }
}

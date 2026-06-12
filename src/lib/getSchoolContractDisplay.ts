import { resolveActiveSchoolContract } from "@/lib/currentSchool"
import { SCHOOL_CONTRACT_DEMO } from "@/lib/schoolTheme"
import {
  contractInfoToDisplay,
  type ContractDisplayData,
} from "@/lib/schoolContractInfo"

/** 契約状況画面：セッション学校ID → active_schools → contract_info → current_school → デモ */
export function getSchoolContractDisplay(): ContractDisplayData {
  const resolved = resolveActiveSchoolContract()
  if (resolved) return contractInfoToDisplay(resolved)
  return {
    startDate: SCHOOL_CONTRACT_DEMO.startDate,
    plan: SCHOOL_CONTRACT_DEMO.plan,
    registeredClubs: SCHOOL_CONTRACT_DEMO.registeredClubs,
    fiscalPeriod: SCHOOL_CONTRACT_DEMO.fiscalPeriod,
    settlementDate: "7月31日",
    annualFee: SCHOOL_CONTRACT_DEMO.annualFee,
    billingMonth: SCHOOL_CONTRACT_DEMO.billingMonth,
    paymentCycle: "月払い",
    planSelectLabel: "スタンダードプラン（最大100クラブ）",
    paymentDayLabel: "毎月26日",
    paymentCycleNote: "",
    paymentMethod: SCHOOL_CONTRACT_DEMO.paymentMethod,
    schoolName: SCHOOL_CONTRACT_DEMO.schoolName,
    representativeName: SCHOOL_CONTRACT_DEMO.representativeName,
    postalCode: SCHOOL_CONTRACT_DEMO.postalCode,
    prefecture: SCHOOL_CONTRACT_DEMO.prefecture,
    city: SCHOOL_CONTRACT_DEMO.city,
    addressLine: SCHOOL_CONTRACT_DEMO.addressLine,
    phone: SCHOOL_CONTRACT_DEMO.phone,
    department: SCHOOL_CONTRACT_DEMO.department,
    position: "",
    contactName: SCHOOL_CONTRACT_DEMO.contactName,
    contactPhone: SCHOOL_CONTRACT_DEMO.phone,
    email: SCHOOL_CONTRACT_DEMO.email,
    loginId: SCHOOL_CONTRACT_DEMO.loginId,
    passwordMask: SCHOOL_CONTRACT_DEMO.passwordMask,
    hasAuditorOption: false,
    optionsLabel: "なし",
    monthlyFeeLabel: "¥10,000 (税込)",
    contractAmountLabel: "¥10,000 (税込)",
  }
}

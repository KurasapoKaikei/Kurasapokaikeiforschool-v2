import { loadCurrentSchool, resolveSchoolContractForLogin } from "@/lib/currentSchool"
import { getSchoolAdminSession } from "@/lib/schoolLoginSession"
import { SCHOOL_CONTRACT_DEMO } from "@/lib/schoolTheme"
import {
  contractInfoToDisplay,
  loadContractInfo,
  type ContractDisplayData,
} from "@/lib/schoolContractInfo"

/** 契約状況画面：current_school → ログイン学校 → contract_info → デモ */
export function getSchoolContractDisplay(): ContractDisplayData {
  const current = loadCurrentSchool()
  if (current?.contract) return contractInfoToDisplay(current.contract)

  const session = getSchoolAdminSession()
  if (session?.loginId) {
    const resolved = resolveSchoolContractForLogin(session.loginId)
    if (resolved) return contractInfoToDisplay(resolved)
  }

  const saved = loadContractInfo()
  if (saved) return contractInfoToDisplay(saved)
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
  }
}

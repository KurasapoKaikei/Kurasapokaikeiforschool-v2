/**
 * ログイン中の学校データ（localStorage: current_school）
 * ポータル全体で申込・本登録データを参照する
 */

import {
  contractInfoToDisplay,
  loadContractInfo,
  type SchoolContractInfo,
} from "@/lib/schoolContractInfo"
import {
  getRegistrationById,
  registrationToContractInfo,
} from "@/lib/schoolRegistration"
import { SCHOOL_DISPLAY_NAME, SCHOOL_FISCAL_PERIOD } from "@/lib/schoolTheme"

export const CURRENT_SCHOOL_KEY = "current_school"
const CURRENT_SCHOOL_USER_KEY = "current_school_user"

export type CurrentSchool = {
  loginId: string
  schoolId: string
  schoolName: string
  fiscalPeriod: string
  contract: SchoolContractInfo
}

export const SCHOOL_SESSION_CHANGED_EVENT = "kurasaokaikei-school-session-changed"

function notifySchoolSessionChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SCHOOL_SESSION_CHANGED_EVENT))
}

/** ログインIDに紐づく契約データを active_schools / contract_info から解決 */
export function resolveSchoolContractForLogin(
  loginId: string
): SchoolContractInfo | null {
  const id = loginId.trim() || "admin"

  if (id !== "admin") {
    const reg = getRegistrationById(id)
    if (reg?.status === "active") {
      return { ...registrationToContractInfo(reg), schoolId: reg.schoolId }
    }
  }

  const saved = loadContractInfo()
  if (saved) {
    if (id === "admin" || !saved.schoolId || saved.schoolId === id) {
      return saved
    }
  }

  return null
}

export function loadCurrentSchool(): CurrentSchool | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CURRENT_SCHOOL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CurrentSchool
    if (parsed?.schoolName) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

function mirrorCurrentSchoolUser(data: CurrentSchool): void {
  const user = {
    loginId: data.loginId,
    schoolId: data.schoolId,
    schoolName: data.schoolName,
    fiscalPeriod: data.fiscalPeriod,
  }
  localStorage.setItem(CURRENT_SCHOOL_USER_KEY, JSON.stringify(user))
}

/** ログイン成功時：該当学校の契約データを current_school に保存 */
export function persistCurrentSchool(loginId: string): void {
  if (typeof window === "undefined") return
  const id = loginId.trim() || "admin"
  const contract = resolveSchoolContractForLogin(id)

  if (contract) {
    const display = contractInfoToDisplay(contract)
    const schoolId = contract.schoolId ?? id
    const data: CurrentSchool = {
      loginId: id,
      schoolId,
      schoolName: display.schoolName,
      fiscalPeriod: display.fiscalPeriod,
      contract: { ...contract, schoolId },
    }
    localStorage.setItem(CURRENT_SCHOOL_KEY, JSON.stringify(data))
    mirrorCurrentSchoolUser(data)
    notifySchoolSessionChanged()
    return
  }

  const fallback: CurrentSchool = {
    loginId: id,
    schoolId: id,
    schoolName: SCHOOL_DISPLAY_NAME,
    fiscalPeriod: SCHOOL_FISCAL_PERIOD,
    contract: {
      submittedAt: new Date().toISOString(),
      school: {
        schoolName: SCHOOL_DISPLAY_NAME,
        representativeName: "",
        postalCode: "",
        prefecture: "",
        city: "",
        addressLine: "",
        phone: "",
      },
      contact: {
        department: "",
        position: "",
        contactName: "",
        contactPhone: "",
        email: "",
      },
      contract: {
        plan: "standard",
        settlementMonth: 7,
        settlementDay: 31,
        paymentCycle: "monthly",
        monthlyBillingDay: 26,
        paymentMethod: "bank_transfer",
      },
    },
  }
  localStorage.setItem(CURRENT_SCHOOL_KEY, JSON.stringify(fallback))
  mirrorCurrentSchoolUser(fallback)
  notifySchoolSessionChanged()
}

export function clearCurrentSchool(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(CURRENT_SCHOOL_KEY)
  localStorage.removeItem(CURRENT_SCHOOL_USER_KEY)
  notifySchoolSessionChanged()
}

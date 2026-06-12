/**
 * ログイン中の学校データ（localStorage: current_school）
 * ポータル全体で申込・本登録データを参照する
 */

import {
  contractInfoToDisplay,
  loadContractInfo,
  normalizeSchoolContractInfo,
  type SchoolContractInfo,
} from "@/lib/schoolContractInfo"
import {
  getRegistrationById,
  registrationToContractInfo,
} from "@/lib/schoolRegistration"
import {
  DEMO_SCHOOL_MASTER_ID,
  ensureSchoolMastersSeeded,
  getSchoolMaster,
  loadSchoolUseAuditFlowForSchool,
} from "@/lib/schoolMasters"
import { SCHOOL_DISPLAY_NAME, SCHOOL_FISCAL_PERIOD } from "@/lib/schoolTheme"

export const CURRENT_SCHOOL_KEY = "current_school"
const CURRENT_SCHOOL_USER_KEY = "current_school_user"

export type CurrentSchool = {
  loginId: string
  schoolId: string
  schoolName: string
  fiscalPeriod: string
  /** 学校マスタ由来（プラン設定） */
  useAuditFlow: boolean
  contract: SchoolContractInfo
}

export const SCHOOL_SESSION_CHANGED_EVENT = "kurasaokaikei-school-session-changed"

/** デモ管理者ログインはクラサポ大学マスタに固定 */
const DEMO_ADMIN_LOGIN_IDS = new Set(["admin", "tc-university-admin"])

/** schoolLoginSession と循環参照を避けるためキーを直接参照 */
const SCHOOL_ADMIN_SESSION_KEY = "kurasaokaikei-school-admin-session"

function readLoggedInSchoolId(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(SCHOOL_ADMIN_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { loginId?: string; loggedInAt?: string }
    if (!parsed?.loggedInAt || !parsed.loginId) return null
    return parsed.loginId.trim() || "admin"
  } catch {
    return null
  }
}

function notifySchoolSessionChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SCHOOL_SESSION_CHANGED_EVENT))
}

/**
 * ログインIDに紐づく契約データを解決。
 * 優先順: active_schools（本登録正本）→ contract_info（学校ID一致時のみ）
 * デモ管理者（admin）は contract_info を参照しない（直近の申込データ混入を防止）
 */
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
  if (saved && id !== "admin" && saved.schoolId === id) {
    return saved
  }

  return null
}

function currentSchoolMatchesSession(
  current: CurrentSchool,
  loginId: string
): boolean {
  const id = loginId.trim() || "admin"
  if (current.loginId !== id) return false
  if (id === "admin") return true
  const sid = current.schoolId?.trim() || current.contract?.schoolId?.trim()
  return !sid || sid === id
}

/**
 * ポータル起動時: セッションの学校IDと current_school が食い違う場合に再同期
 */
export function ensureCurrentSchoolSynced(): void {
  if (typeof window === "undefined") return
  const loginId = readLoggedInSchoolId()
  if (!loginId) return
  const current = loadCurrentSchool()

  if (!current || !currentSchoolMatchesSession(current, loginId)) {
    persistCurrentSchool(loginId)
    return
  }

  const expected = resolveSchoolContractForLogin(loginId)
  if (!expected) return

  const currentName = current.contract?.school?.schoolName?.trim()
  const expectedName = expected.school?.schoolName?.trim()
  const currentPlan = current.contract?.contract?.plan
  const expectedPlan = expected.contract?.plan
  const currentAuditor = current.contract?.hasAuditorOption === true
  const expectedAuditor = expected.hasAuditorOption === true
  const currentFee = current.contract?.monthlyFee
  const expectedFee = expected.monthlyFee

  if (
    (expectedName && currentName !== expectedName) ||
    (expectedPlan && currentPlan !== expectedPlan) ||
    currentAuditor !== expectedAuditor ||
    currentFee !== expectedFee
  ) {
    persistCurrentSchool(loginId)
  }
}

/** 契約状況表示用: セッション連動で最新の申込データを最優先で解決 */
export function resolveActiveSchoolContract(): SchoolContractInfo | null {
  if (typeof window === "undefined") return null

  const loginId = readLoggedInSchoolId()

  if (loginId) {
    const fromSession = resolveSchoolContractForLogin(loginId)
    if (fromSession) return fromSession
  }

  if (loginId) {
    const current = loadCurrentSchool()
    if (current?.contract && currentSchoolMatchesSession(current, loginId)) {
      const schoolId =
        current.schoolId?.trim() ||
        current.contract.schoolId?.trim() ||
        undefined
      return normalizeSchoolContractInfo({ ...current.contract, schoolId })
    }

    if (loginId === "admin") return null
  }

  const saved = loadContractInfo()
  if (!saved) return null
  if (!loginId || !saved.schoolId || saved.schoolId === loginId) {
    return normalizeSchoolContractInfo(saved)
  }
  return null
}

function withAuditFlowFlag(data: CurrentSchool): CurrentSchool {
  ensureSchoolMastersSeeded()
  const masterId =
    data.schoolId?.trim() ||
    data.contract?.schoolId?.trim() ||
    DEMO_SCHOOL_MASTER_ID
  const useAuditFlow = loadSchoolUseAuditFlowForSchool(masterId)
  return { ...data, schoolId: masterId, useAuditFlow }
}

export function loadCurrentSchool(): CurrentSchool | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CURRENT_SCHOOL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CurrentSchool
    if (parsed?.schoolName) {
      return withAuditFlowFlag(parsed)
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

  ensureSchoolMastersSeeded()

  if (contract) {
    const display = contractInfoToDisplay(contract)
    const schoolId = DEMO_ADMIN_LOGIN_IDS.has(id)
      ? DEMO_SCHOOL_MASTER_ID
      : (contract.schoolId ?? DEMO_SCHOOL_MASTER_ID)
    const master = getSchoolMaster(schoolId)
    const data: CurrentSchool = withAuditFlowFlag({
      loginId: id,
      schoolId,
      schoolName: DEMO_ADMIN_LOGIN_IDS.has(id)
        ? (master?.schoolName ?? display.schoolName)
        : display.schoolName,
      fiscalPeriod: display.fiscalPeriod,
      useAuditFlow: master?.useAuditFlow ?? false,
      contract: { ...contract, schoolId },
    })
    localStorage.setItem(CURRENT_SCHOOL_KEY, JSON.stringify(data))
    mirrorCurrentSchoolUser(data)
    notifySchoolSessionChanged()
    return
  }

  const master = getSchoolMaster(DEMO_SCHOOL_MASTER_ID)
  const fallback: CurrentSchool = withAuditFlowFlag({
    loginId: id,
    schoolId: DEMO_SCHOOL_MASTER_ID,
    schoolName: master?.schoolName ?? "クラサポ大学",
    fiscalPeriod: SCHOOL_FISCAL_PERIOD,
    useAuditFlow: master?.useAuditFlow ?? true,
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
  })
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

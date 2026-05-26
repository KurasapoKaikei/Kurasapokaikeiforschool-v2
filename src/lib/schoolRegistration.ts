/**
 * 学校新規申込オンボーディング（仮申込 → メール認証 → 学校ID発行 → ログイン）
 */

import {
  saveContractInfo,
  loadContractInfo,
  type MonthlyBillingDay,
  type PaymentCycleId,
  type PaymentMethodId,
  type SchoolContractInfo,
  type SchoolPlanId,
} from "@/lib/schoolContractInfo"
import type { RegisterOptionsState } from "@/lib/registerPricing"
import { upsertSchoolMaster } from "@/lib/schoolMasters"
import { initializeCleanSchoolWorkspace } from "@/lib/schoolWorkspace"

export type RegistrationStatus = "pending" | "active"

/** 仮申込時点のデータ（学校ID未発行） */
export type PendingSchoolData = {
  createdAt: string
  adminPassword: string
  school: {
    schoolName: string
    representativeName: string
    representativeNameKana: string
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
    contactNameKana: string
    contactPhone: string
    email: string
  }
  contract: {
    plan: SchoolPlanId
    settlementMonth: number
    settlementDay: number
    paymentCycle: PaymentCycleId
    monthlyBillingDay: MonthlyBillingDay
    paymentMethod: PaymentMethodId
  }
  /** 有料オプション（申込時点） */
  options: RegisterOptionsState
  termsAcceptedAt: string
}

export const EMAIL_ALREADY_USED_ERROR =
  "このメールアドレスはすでに使用されています"

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeSchoolContactEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isValidEmailForDuplicateCheck(email: string): boolean {
  return EMAIL_FORMAT.test(email.trim())
}

function collectEmailsFromRegistrations(
  map: Record<string, SchoolRegistration>
): string[] {
  return Object.values(map)
    .map((r) => r.contact?.email)
    .filter((e): e is string => typeof e === "string" && e.trim().length > 0)
    .map(normalizeSchoolContactEmail)
}

/** localStorage 内の全学校データで担当者メールの重複を判定 */
export function isSchoolContactEmailAlreadyRegistered(email: string): boolean {
  if (typeof window === "undefined") return false
  const normalized = normalizeSchoolContactEmail(email)
  if (!normalized || !isValidEmailForDuplicateCheck(email)) return false

  const pending = loadPendingSchoolEnvelope()
  if (
    pending?.contact?.email &&
    normalizeSchoolContactEmail(pending.contact.email) === normalized
  ) {
    return true
  }

  const activeEmails = collectEmailsFromRegistrations(loadActiveSchools())
  if (activeEmails.includes(normalized)) return true

  const regEmails = collectEmailsFromRegistrations(loadAllRegistrations())
  if (regEmails.includes(normalized)) return true

  const contract = loadContractInfo()
  if (
    contract?.contact?.email &&
    normalizeSchoolContactEmail(contract.contact.email) === normalized
  ) {
    return true
  }

  return false
}

/** localStorage に保存する仮申込エンベロープ（token を含む） */
export type PendingSchoolDataEnvelope = PendingSchoolData & {
  token: string
}

export type SchoolRegistration = PendingSchoolData & {
  schoolId: string
  status: RegistrationStatus
  activatedAt?: string
}

export const PENDING_SCHOOL_DATA_KEY = "pending_school_data"
export const ACTIVE_SCHOOLS_KEY = "active_schools"
const REGISTRATIONS_KEY = "kurasaokaikei-school-registrations"

function verifyCacheKey(urlToken: string): string {
  return `kurasaokaikei-verify-result-${urlToken || "pending"}`
}

function getCachedVerifyResult(urlToken: string): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem(verifyCacheKey(urlToken))
}

function setCachedVerifyResult(urlToken: string, schoolId: string): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(verifyCacheKey(urlToken), schoolId)
}

function isPendingEnvelope(
  value: unknown
): value is PendingSchoolDataEnvelope {
  if (!value || typeof value !== "object") return false
  const v = value as PendingSchoolDataEnvelope
  return (
    typeof v.token === "string" &&
    typeof v.createdAt === "string" &&
    typeof v.adminPassword === "string" &&
    !!v.school?.schoolName &&
    !!v.contact?.email
  )
}

/** 旧形式 { [token]: PendingSchoolData } からの移行 */
function migrateLegacyPendingMap(
  parsed: Record<string, PendingSchoolData>
): PendingSchoolDataEnvelope | null {
  const keys = Object.keys(parsed)
  if (keys.length === 0) return null
  const token = keys[0]
  const data = parsed[token]
  if (!data?.createdAt) return null
  return { ...data, token }
}

/** localStorage から仮申込エンベロープを読み込み */
export function loadPendingSchoolEnvelope(): PendingSchoolDataEnvelope | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(PENDING_SCHOOL_DATA_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (isPendingEnvelope(parsed)) return parsed
    if (parsed && typeof parsed === "object") {
      return migrateLegacyPendingMap(
        parsed as Record<string, PendingSchoolData>
      )
    }
    return null
  } catch {
    return null
  }
}

/** 仮申込データを単一オブジェクトとして保存（token をデータ内に含める） */
export function savePendingSchoolData(
  data: PendingSchoolData
): { token: string; verifyUrl: string } {
  const token = generateVerificationToken()
  const envelope: PendingSchoolDataEnvelope = { ...data, token }
  if (typeof window !== "undefined") {
    localStorage.setItem(PENDING_SCHOOL_DATA_KEY, JSON.stringify(envelope))
  }
  const verifyUrl = buildVerificationUrl(token)
  return { token, verifyUrl }
}

export function clearPendingSchoolData(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(PENDING_SCHOOL_DATA_KEY)
}

function loadActiveSchools(): Record<string, SchoolRegistration> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(ACTIVE_SCHOOLS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, SchoolRegistration>
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function saveActiveSchools(map: Record<string, SchoolRegistration>): void {
  if (typeof window === "undefined") return
  localStorage.setItem(ACTIVE_SCHOOLS_KEY, JSON.stringify(map))
}

function loadAllRegistrations(): Record<string, SchoolRegistration> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(REGISTRATIONS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, SchoolRegistration>
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function saveAllRegistrations(map: Record<string, SchoolRegistration>): void {
  if (typeof window === "undefined") return
  localStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(map))
}

/** メール認証用の仮トークン */
export function generateVerificationToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "")
  }
  return `tok_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`
}

/** SCH- + 5桁数字（active・registrations と重複回避） */
export function generateSchoolId(): string {
  const active = loadActiveSchools()
  const regs = loadAllRegistrations()
  const used = new Set([...Object.keys(active), ...Object.keys(regs)])
  for (let i = 0; i < 200; i++) {
    const digits = String(Math.floor(10000 + Math.random() * 90000))
    const id = `SCH-${digits}`
    if (!used.has(id)) return id
  }
  return `SCH-${Date.now().toString().slice(-5)}`
}

export function buildVerificationUrl(token: string): string {
  if (typeof window === "undefined") {
    return `http://localhost:3000/register/verify?token=${encodeURIComponent(token)}`
  }
  const origin = window.location.origin
  return `${origin}/register/verify?token=${encodeURIComponent(token)}`
}

/** @deprecated 旧フロー互換（id パラメータ） */
export function buildVerificationUrlBySchoolId(schoolId: string): string {
  if (typeof window === "undefined") {
    return `http://localhost:3000/register/verify?id=${encodeURIComponent(schoolId)}`
  }
  return `${window.location.origin}/register/verify?id=${encodeURIComponent(schoolId)}`
}

export function getRegistrationById(
  schoolId: string
): SchoolRegistration | null {
  const active = loadActiveSchools()[schoolId]
  if (active) return active
  const reg = loadAllRegistrations()[schoolId]
  return reg ?? null
}

export function getActiveRegistrationByCredentials(
  loginId: string,
  password: string
): SchoolRegistration | null {
  const id = loginId.trim()
  const pw = password
  const reg = getRegistrationById(id)
  if (reg?.status === "active" && reg.adminPassword === pw) return reg
  return null
}

export function registrationToContractInfo(
  reg: SchoolRegistration
): SchoolContractInfo {
  return {
    submittedAt: reg.activatedAt ?? reg.createdAt,
    school: {
      schoolName: reg.school.schoolName,
      representativeName: reg.school.representativeName,
      postalCode: reg.school.postalCode,
      prefecture: reg.school.prefecture,
      city: reg.school.city,
      addressLine: reg.school.addressLine,
      phone: reg.school.phone,
    },
    contact: {
      department: reg.contact.department,
      position: reg.contact.position,
      contactName: reg.contact.contactName,
      contactPhone: reg.contact.contactPhone,
      email: reg.contact.email,
    },
    contract: { ...reg.contract },
  }
}

/** メール送信シミュレーション（デモ用コンソール出力） */
export function simulateVerificationEmail(
  email: string,
  verifyUrl: string
): void {
  const body = [
    "【クラサポ会計】学校登録を完了してください",
    "",
    `${email} 様`,
    "",
    "お申し込みありがとうございます。",
    "以下のURLにアクセスして、本登録を完了させてください。",
    "",
    verifyUrl,
    "",
    "※本メールはデモ用のシミュレーションです。",
  ].join("\n")
  console.info("[デモ] 確認メール送信シミュレーション", {
    to: email,
    verifyUrl,
    body,
  })
}

/**
 * 認証URL（token）アクセス時：学校ID初発行・active化・契約反映
 * デモ用：pending_school_data が存在すれば URL トークン不一致でも本登録を許可
 */
export function activateSchoolRegistrationByToken(
  urlToken: string
): { schoolId: string } | null {
  const tokenFromUrl = urlToken.trim()
  const cached = getCachedVerifyResult(tokenFromUrl)
  if (cached) return { schoolId: cached }

  const envelope = loadPendingSchoolEnvelope()
  if (!envelope) return null

  const { token: storedToken, ...pendingRaw } = envelope
  const pending = {
    ...pendingRaw,
    options: pendingRaw.options ?? {
      auditFlow: false,
      memberMypage: false,
      onlinePayment: false,
    },
  }

  if (tokenFromUrl && storedToken && tokenFromUrl !== storedToken) {
    console.info(
      "[デモ] URLトークンと保存トークンが異なりますが、pending があるため本登録を続行します",
      { urlToken: tokenFromUrl, storedToken }
    )
  }

  const schoolId = generateSchoolId()
  const activated: SchoolRegistration = {
    ...pending,
    schoolId,
    status: "active",
    activatedAt: new Date().toISOString(),
  }

  const activeMap = loadActiveSchools()
  activeMap[schoolId] = activated
  saveActiveSchools(activeMap)

  const regs = loadAllRegistrations()
  regs[schoolId] = activated
  saveAllRegistrations(regs)

  clearPendingSchoolData()

  saveContractInfo({ ...registrationToContractInfo(activated), schoolId })

  upsertSchoolMaster({
    schoolId,
    schoolName: activated.school.schoolName,
    useAuditFlow: activated.options?.auditFlow === true,
  })

  initializeCleanSchoolWorkspace(schoolId)

  setCachedVerifyResult(tokenFromUrl || storedToken, schoolId)

  return { schoolId }
}

/** @deprecated 旧フロー（仮申込時に schoolId 済みの registrations） */
export function savePendingRegistration(reg: SchoolRegistration): void {
  const regs = loadAllRegistrations()
  regs[reg.schoolId] = { ...reg, status: "pending" }
  saveAllRegistrations(regs)
}

/** @deprecated 旧フロー互換 */
export function activateSchoolRegistration(schoolId: string): boolean {
  const regs = loadAllRegistrations()
  const reg = regs[schoolId]
  if (!reg || reg.status !== "pending") return false

  const activated: SchoolRegistration = {
    ...reg,
    status: "active",
    activatedAt: new Date().toISOString(),
  }

  const activeMap = loadActiveSchools()
  activeMap[schoolId] = activated
  saveActiveSchools(activeMap)
  regs[schoolId] = activated
  saveAllRegistrations(regs)

  saveContractInfo({ ...registrationToContractInfo(activated), schoolId })

  upsertSchoolMaster({
    schoolId,
    schoolName: activated.school.schoolName,
    useAuditFlow: activated.options?.auditFlow === true,
  })
  initializeCleanSchoolWorkspace(schoolId)

  return true
}

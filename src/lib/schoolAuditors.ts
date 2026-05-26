/** 学校ポータル：監査担当者マスタ（localStorage） */

import {
  getOperationalSchoolId,
  readScopedWorkspace,
  writeScopedWorkspace,
} from "@/lib/schoolWorkspace"

export const SCHOOL_AUDITORS_KEY = "school_auditors"

export const SCHOOL_AUDITORS_CHANGED_EVENT =
  "kurasaokaikei-school-auditors-changed"

/** 監査進捗（一覧ステータス表示用） */
export type AuditorAuditStatus = "before" | "in_progress" | "completed"

export const AUDITOR_AUDIT_STATUS_LABELS: Record<AuditorAuditStatus, string> = {
  before: "ー",
  in_progress: "監査中",
  completed: "終了",
}

export type SchoolAuditor = {
  id: string
  /** 監査人氏名 */
  name: string
  /** 部署 */
  department: string
  /** 監査進捗 */
  auditStatus: AuditorAuditStatus
  /** 電話番号 */
  phone: string
  /** メールアドレス（ログインID 代替） */
  email: string
  /** 配布用の初期パスワード（登録時に固定） */
  initialPassword: string
  /** 担当クラブ ID 一覧 */
  assignedClubIds: string[]
  createdAt: string
  updatedAt: string
}

export type SchoolAuditorInput = {
  name: string
  department: string
  phone: string
  email: string
  assignedClubIds: string[]
  auditStatus?: AuditorAuditStatus
}

function normalizeAuditStatus(raw: unknown): AuditorAuditStatus {
  if (raw === "in_progress" || raw === "completed") return raw
  return "before"
}

function dispatchChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SCHOOL_AUDITORS_CHANGED_EVENT))
}

const PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"

/** 英数字6桁の初期パスワード（クラブ登録と同等ルール） */
export function generateInitialAuditorPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const lower = "abcdefghijkmnpqrstuvwxyz"
  const digits = "23456789"
  const pick = (from: string) => from[Math.floor(Math.random() * from.length)]!
  const chars = [pick(upper), pick(lower), pick(digits)]
  while (chars.length < 6) {
    chars.push(PASSWORD_CHARS[Math.floor(Math.random() * PASSWORD_CHARS.length)]!)
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  return chars.join("")
}

function newAuditorId(existing: SchoolAuditor[]): string {
  const numbers = existing
    .map((a) => {
      const m = /^AUD-(\d+)$/.exec(a.id)
      return m ? Number(m[1]) : null
    })
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
  const next = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1
  return `AUD-${String(next).padStart(4, "0")}`
}

function normalizeAuditor(raw: unknown): SchoolAuditor | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Partial<SchoolAuditor> & {
    // 旧フィールド互換
    accountId?: unknown
  }
  const id = typeof item.id === "string" ? item.id : ""
  const name = typeof item.name === "string" ? item.name.trim() : ""
  const department =
    typeof item.department === "string" ? item.department.trim() : ""
  const phone = typeof item.phone === "string" ? item.phone.trim() : ""
  const email =
    typeof item.email === "string"
      ? item.email.trim()
      : typeof item.accountId === "string"
        ? item.accountId.trim()
        : ""
  const initialPassword =
    typeof item.initialPassword === "string" && item.initialPassword
      ? item.initialPassword
      : generateInitialAuditorPassword()
  if (!id || !name || !email) return null
  const assignedClubIds = Array.isArray(item.assignedClubIds)
    ? item.assignedClubIds.filter((x): x is string => typeof x === "string")
    : []
  const createdAt =
    typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString()
  const updatedAt =
    typeof item.updatedAt === "string" ? item.updatedAt : createdAt
  return {
    id,
    name,
    department,
    phone,
    email,
    initialPassword,
    assignedClubIds,
    auditStatus: normalizeAuditStatus(item.auditStatus),
    createdAt,
    updatedAt,
  }
}

function parseAuditors(parsed: unknown): SchoolAuditor[] {
  if (!Array.isArray(parsed)) return []
  return parsed
    .map(normalizeAuditor)
    .filter((a): a is SchoolAuditor => a != null)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
}

function loadAuditorsFromGlobal(): SchoolAuditor[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(SCHOOL_AUDITORS_KEY)
    if (!raw) return []
    return parseAuditors(JSON.parse(raw) as unknown)
  } catch {
    return []
  }
}

function saveAllToGlobal(auditors: SchoolAuditor[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(SCHOOL_AUDITORS_KEY, JSON.stringify(auditors))
    dispatchChanged()
  } catch {
    /* ignore */
  }
}

function saveAll(auditors: SchoolAuditor[]): void {
  const schoolId = getOperationalSchoolId()
  writeScopedWorkspace(
    schoolId,
    (ws) => ({ ...ws, auditors }),
    () => saveAllToGlobal(auditors)
  )
}

export function loadSchoolAuditors(): SchoolAuditor[] {
  const schoolId = getOperationalSchoolId()
  return readScopedWorkspace(
    schoolId,
    (ws) => parseAuditors(ws.auditors),
    loadAuditorsFromGlobal
  )
}

export function isDuplicateAuditorEmail(
  email: string,
  auditors: SchoolAuditor[],
  excludeId?: string
): boolean {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  return auditors.some(
    (a) =>
      a.id !== excludeId && a.email.trim().toLowerCase() === normalized
  )
}

export function addSchoolAuditor(input: SchoolAuditorInput): SchoolAuditor | null {
  const auditors = loadSchoolAuditors()
  const name = input.name.trim()
  const department = input.department.trim()
  const phone = input.phone.trim()
  const email = input.email.trim()
  if (!name || !department || !phone || !email) return null
  if (isDuplicateAuditorEmail(email, auditors)) return null
  const now = new Date().toISOString()
  const created: SchoolAuditor = {
    id: newAuditorId(auditors),
    name,
    department,
    phone,
    email,
    initialPassword: generateInitialAuditorPassword(),
    assignedClubIds: [...new Set(input.assignedClubIds)],
    auditStatus: "before",
    createdAt: now,
    updatedAt: now,
  }
  saveAll([created, ...auditors])
  return created
}

export function updateSchoolAuditor(
  id: string,
  input: SchoolAuditorInput
): SchoolAuditor | null {
  const auditors = loadSchoolAuditors()
  const idx = auditors.findIndex((a) => a.id === id)
  if (idx < 0) return null
  const name = input.name.trim()
  const department = input.department.trim()
  const phone = input.phone.trim()
  const email = input.email.trim()
  if (!name || !department || !phone || !email) return null
  if (isDuplicateAuditorEmail(email, auditors, id)) return null
  const prev = auditors[idx]!
  const updated: SchoolAuditor = {
    ...prev,
    name,
    department,
    phone,
    email,
    assignedClubIds: [...new Set(input.assignedClubIds)],
    auditStatus: input.auditStatus ?? prev.auditStatus,
    updatedAt: new Date().toISOString(),
  }
  const next = [...auditors]
  next[idx] = updated
  saveAll(next)
  return updated
}

export function deleteSchoolAuditor(id: string): boolean {
  const auditors = loadSchoolAuditors()
  const next = auditors.filter((a) => a.id !== id)
  if (next.length === auditors.length) return false
  saveAll(next)
  return true
}

export function getSchoolAuditorById(id: string): SchoolAuditor | null {
  return loadSchoolAuditors().find((a) => a.id === id) ?? null
}

/** メッセージBOX宛先プルダウン用（部署名 ＋ 氏名） */
export function formatAuditorSelectLabel(auditor: SchoolAuditor): string {
  const dept = auditor.department.trim()
  const name = auditor.name.trim()
  if (dept && name) return `${dept} ${name}`
  return name || dept || auditor.id
}

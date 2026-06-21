/** 学校ポータル：監査担当者マスタ（localStorage） */

import {
  assertSchoolWorkspaceWritable,
  getOperationalSchoolId,
  readScopedWorkspace,
  usesLegacyGlobalSchoolStorage,
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
  /** 姓 */
  lastName: string
  /** 名 */
  firstName: string
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
  /** 一覧表示順（1始まり） */
  order: number
  createdAt: string
  updatedAt: string
}

export type SchoolAuditorInput = {
  lastName: string
  firstName: string
  department: string
  phone: string
  email: string
  assignedClubIds: string[]
  auditStatus?: AuditorAuditStatus
}

/** 一覧・選択肢表示用：姓と名を全角スペースで結合 */
export function formatAuditorDisplayName(
  auditor: Pick<SchoolAuditor, "lastName" | "firstName">
): string {
  const last = auditor.lastName.trim()
  const first = auditor.firstName.trim()
  if (last && first) return `${last}　${first}`
  return last || first
}

/** 旧 `name` フィールド（半角/全角スペース区切り）を姓・名に分割 */
function splitLegacyAuditorName(name: string): {
  lastName: string
  firstName: string
} {
  const trimmed = name.trim()
  if (!trimmed) return { lastName: "", firstName: "" }
  const match = trimmed.match(/^(\S+)[\s　]+(\S.*)$/)
  if (match) {
    return { lastName: match[1]!.trim(), firstName: match[2]!.trim() }
  }
  return { lastName: trimmed, firstName: "" }
}

function parseAuditorNameFields(
  item: Partial<SchoolAuditor> & { name?: unknown }
): { lastName: string; firstName: string } {
  const lastFromField =
    typeof item.lastName === "string" ? item.lastName.trim() : ""
  const firstFromField =
    typeof item.firstName === "string" ? item.firstName.trim() : ""
  if (lastFromField || firstFromField) {
    return { lastName: lastFromField, firstName: firstFromField }
  }
  if (typeof item.name === "string" && item.name.trim()) {
    return splitLegacyAuditorName(item.name)
  }
  return { lastName: "", firstName: "" }
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
    name?: unknown
    accountId?: unknown
  }
  const id = typeof item.id === "string" ? item.id : ""
  const { lastName, firstName } = parseAuditorNameFields(item)
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
  if (!id || !lastName || !email) return null
  const assignedClubIds = Array.isArray(item.assignedClubIds)
    ? item.assignedClubIds.filter((x): x is string => typeof x === "string")
    : []
  const createdAt =
    typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString()
  const updatedAt =
    typeof item.updatedAt === "string" ? item.updatedAt : createdAt
  const order = typeof item.order === "number" ? item.order : 0
  return {
    id,
    lastName,
    firstName,
    department,
    phone,
    email,
    initialPassword,
    assignedClubIds,
    order,
    auditStatus: normalizeAuditStatus(item.auditStatus),
    createdAt,
    updatedAt,
  }
}

function compareAuditorDisplayOrder(a: SchoolAuditor, b: SchoolAuditor): number {
  const orderDiff = (a.order ?? 0) - (b.order ?? 0)
  if (orderDiff !== 0) return orderDiff
  const createdDiff = a.createdAt.localeCompare(b.createdAt)
  if (createdDiff !== 0) return createdDiff
  return a.id.localeCompare(b.id)
}

/** order が作成日時の逆順になっている既存データを昇順に修復 */
function repairAuditorOrderIfInverted(auditors: SchoolAuditor[]): SchoolAuditor[] {
  const byOrder = [...auditors].sort(compareAuditorDisplayOrder)
  if (byOrder.length < 2) return byOrder
  let descendingCreated = true
  for (let i = 1; i < byOrder.length; i++) {
    if (byOrder[i]!.createdAt.localeCompare(byOrder[i - 1]!.createdAt) > 0) {
      descendingCreated = false
      break
    }
  }
  if (descendingCreated) {
    return [...auditors].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }
  return byOrder
}

function normalizeAuditorOrders(auditors: SchoolAuditor[]): SchoolAuditor[] {
  return applyAuditorDisplayOrder(repairAuditorOrderIfInverted(auditors))
}

/** 配列の並び順を order に反映（並び替え保存用） */
function applyAuditorDisplayOrder(auditors: SchoolAuditor[]): SchoolAuditor[] {
  return auditors.map((a, idx) => ({ ...a, order: idx + 1 }))
}

function parseAuditors(parsed: unknown): SchoolAuditor[] {
  if (!Array.isArray(parsed)) return []
  return normalizeAuditorOrders(
    parsed
      .map(normalizeAuditor)
      .filter((a): a is SchoolAuditor => a != null)
      .map((a, idx) => ({
        ...a,
        order: a.order > 0 ? a.order : idx + 1,
      }))
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
    localStorage.setItem(
      SCHOOL_AUDITORS_KEY,
      JSON.stringify(normalizeAuditorOrders(auditors))
    )
    dispatchChanged()
  } catch {
    /* ignore */
  }
}

function saveAll(auditors: SchoolAuditor[]): boolean {
  const normalized = normalizeAuditorOrders(auditors)
  const schoolId = getOperationalSchoolId()
  const isLegacy =
    !schoolId || usesLegacyGlobalSchoolStorage(schoolId)

  if (
    schoolId &&
    !isLegacy &&
    !assertSchoolWorkspaceWritable(schoolId)
  ) {
    return false
  }

  writeScopedWorkspace(
    schoolId,
    (ws) => ({ ...ws, auditors: normalized }),
    () => saveAllToGlobal(normalized)
  )
  if (!isLegacy) dispatchChanged()
  return true
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
  const lastName = input.lastName.trim()
  const firstName = input.firstName.trim()
  const department = input.department.trim()
  const phone = input.phone.trim()
  const email = input.email.trim()
  if (!lastName || !firstName || !department || !phone || !email) return null
  if (isDuplicateAuditorEmail(email, auditors)) return null
  const now = new Date().toISOString()
  const maxOrder = auditors.reduce(
    (max, a) => Math.max(max, a.order ?? 0),
    0
  )
  const created: SchoolAuditor = {
    id: newAuditorId(auditors),
    lastName,
    firstName,
    department,
    phone,
    email,
    initialPassword: generateInitialAuditorPassword(),
    assignedClubIds: [...new Set(input.assignedClubIds)],
    order: maxOrder + 1,
    auditStatus: "before",
    createdAt: now,
    updatedAt: now,
  }
  if (!saveAll([...auditors, created])) return null
  return created
}

export function updateSchoolAuditor(
  id: string,
  input: SchoolAuditorInput
): SchoolAuditor | null {
  const auditors = loadSchoolAuditors()
  const idx = auditors.findIndex((a) => a.id === id)
  if (idx < 0) return null
  const lastName = input.lastName.trim()
  const firstName = input.firstName.trim()
  const department = input.department.trim()
  const phone = input.phone.trim()
  const email = input.email.trim()
  if (!lastName || !firstName || !department || !phone || !email) return null
  if (isDuplicateAuditorEmail(email, auditors, id)) return null
  const prev = auditors[idx]!
  const updated: SchoolAuditor = {
    ...prev,
    lastName,
    firstName,
    department,
    phone,
    email,
    assignedClubIds: [...new Set(input.assignedClubIds)],
    auditStatus: input.auditStatus ?? prev.auditStatus,
    updatedAt: new Date().toISOString(),
  }
  const next = [...auditors]
  next[idx] = updated
  if (!saveAll(next)) return null
  return updated
}

export function deleteSchoolAuditor(id: string): boolean {
  const auditors = loadSchoolAuditors()
  const next = auditors.filter((a) => a.id !== id)
  if (next.length === auditors.length) return false
  return saveAll(next)
}

/** 監査人の表示順を更新（配列順を order に反映して即保存） */
export function setSchoolAuditorsOrder(ordered: SchoolAuditor[]): boolean {
  return saveAll(applyAuditorDisplayOrder(ordered))
}

export function getSchoolAuditorById(id: string): SchoolAuditor | null {
  return loadSchoolAuditors().find((a) => a.id === id) ?? null
}

/** 全監査人の担当クラブ ID を集合で返す */
export function collectAssignedClubIds(
  auditors: SchoolAuditor[] = loadSchoolAuditors()
): Set<string> {
  const ids = new Set<string>()
  for (const auditor of auditors) {
    for (const clubId of auditor.assignedClubIds) {
      if (clubId) ids.add(clubId)
    }
  }
  return ids
}

/** クラブ ID に担当監査人がいれば返す（いなければ null） */
export function findAuditorForClub(
  clubId: string,
  auditors: SchoolAuditor[] = loadSchoolAuditors()
): SchoolAuditor | null {
  if (!clubId) return null
  return auditors.find((a) => a.assignedClubIds.includes(clubId)) ?? null
}

/** どの監査人にも割り当てられていないクラブを抽出 */
export function filterUnassignedClubs<T extends { id: string }>(
  clubs: T[],
  auditors: SchoolAuditor[] = loadSchoolAuditors()
): T[] {
  const assigned = collectAssignedClubIds(auditors)
  return clubs.filter((club) => club.id && !assigned.has(club.id))
}

/** メッセージBOX宛先プルダウン用（部署名 ＋ 氏名） */
export function formatAuditorSelectLabel(auditor: SchoolAuditor): string {
  const dept = auditor.department.trim()
  const name = formatAuditorDisplayName(auditor)
  if (dept && name) return `${dept} ${name}`
  return name || dept || auditor.id
}

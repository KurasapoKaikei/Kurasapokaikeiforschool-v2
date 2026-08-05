/** 学校ポータル：登録クラブ（クラブ登録画面で管理） */

import {
  getOperationalSchoolId,
  readScopedWorkspace,
  writeScopedWorkspace,
} from "@/lib/schoolWorkspace"

export type SchoolClub = {
  /** 例: club-7392 */
  id: string
  name: string
  groupIds: string[]
  /** 登録時点のグループ名（一覧表示用） */
  groupNames: string[]
  /** ISO 8601 */
  registeredAt: string
  order: number
  /** 配布用の初期パスワード（作業者用・登録時に固定） */
  initialPassword: string
  /** 現在の作業者ログインパスワード（変更可能） */
  password: string
  /** クラブ責任者（役職）例: 顧問、監督 */
  managerTitle: string
  /** クラブ責任者（氏名） */
  managerName: string
  /** クラブ責任者用初期パスワード（英数字6桁） */
  managerInitialPassword: string
  /** クラブ責任者用ログインパスワード（変更可能） */
  managerPassword: string
}

const PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"

/** 英数字6桁の初期パスワード（例: pW3x9B） */
export function generateInitialPassword(): string {
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

function migrateClubFields(c: SchoolClub): SchoolClub {
  const initial =
    typeof c.initialPassword === "string" && c.initialPassword
      ? c.initialPassword
      : generateInitialPassword()
  const password =
    typeof c.password === "string" && c.password ? c.password : initial
  const managerInitial =
    typeof c.managerInitialPassword === "string" && c.managerInitialPassword
      ? c.managerInitialPassword
      : generateInitialPassword()
  const managerPassword =
    typeof c.managerPassword === "string" && c.managerPassword
      ? c.managerPassword
      : managerInitial
  return {
    ...c,
    initialPassword: initial,
    password,
    managerTitle: typeof c.managerTitle === "string" ? c.managerTitle : "",
    managerName: typeof c.managerName === "string" ? c.managerName : "",
    managerInitialPassword: managerInitial,
    managerPassword,
  }
}

function compareClubDisplayOrder(a: SchoolClub, b: SchoolClub): number {
  const orderDiff = (a.order ?? 0) - (b.order ?? 0)
  if (orderDiff !== 0) return orderDiff
  const timeDiff = a.registeredAt.localeCompare(b.registeredAt)
  if (timeDiff !== 0) return timeDiff
  return a.id.localeCompare(b.id)
}

/** order が登録日時の逆順になっている既存データを昇順に修復 */
function repairClubOrderIfInverted(clubs: SchoolClub[]): SchoolClub[] {
  const byOrder = [...clubs].sort(compareClubDisplayOrder)
  if (byOrder.length < 2) return byOrder
  let descendingRegistered = true
  for (let i = 1; i < byOrder.length; i++) {
    if (
      byOrder[i]!.registeredAt.localeCompare(byOrder[i - 1]!.registeredAt) > 0
    ) {
      descendingRegistered = false
      break
    }
  }
  if (descendingRegistered) {
    return [...clubs].sort((a, b) =>
      a.registeredAt.localeCompare(b.registeredAt)
    )
  }
  return byOrder
}

function normalizeClubOrders(clubs: SchoolClub[]): SchoolClub[] {
  return repairClubOrderIfInverted(clubs).map((c, idx) => ({
    ...c,
    order: idx + 1,
  }))
}

const STORAGE_KEY = "kurasaokaikei-school-clubs"

/** クラブ登録フォーム：重複時の表示文言 */
export const DUPLICATE_CLUB_NAME_ERROR =
  "※このクラブ名は既に登録されています。"

/** 同一学校内でクラブ名が既に使われているか（前後空白を除いた完全一致） */
export function isDuplicateClubName(
  name: string,
  clubs: SchoolClub[],
  excludeClubId?: string
): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  return clubs.some(
    (c) => c.id !== excludeClubId && c.name.trim() === trimmed
  )
}

function parseClubsFromRaw(parsed: unknown): SchoolClub[] {
  if (!Array.isArray(parsed)) return []
  return normalizeClubOrders(
    parsed
      .filter(
        (c) =>
          c &&
          typeof c.id === "string" &&
          typeof c.name === "string" &&
          Array.isArray(c.groupIds) &&
          Array.isArray(c.groupNames) &&
          typeof c.registeredAt === "string"
      )
      .map((c, idx) =>
        migrateClubFields({
          ...(c as SchoolClub),
          order: typeof (c as SchoolClub).order === "number" ? (c as SchoolClub).order : idx + 1,
          initialPassword: (c as SchoolClub).initialPassword ?? "",
          password: (c as SchoolClub).password ?? "",
          managerTitle: (c as SchoolClub).managerTitle ?? "",
          managerName: (c as SchoolClub).managerName ?? "",
          managerInitialPassword: (c as SchoolClub).managerInitialPassword ?? "",
          managerPassword: (c as SchoolClub).managerPassword ?? "",
        })
      )
  )
}

function loadSchoolClubsFromGlobal(): SchoolClub[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return parseClubsFromRaw(JSON.parse(raw) as unknown)
  } catch {
    return []
  }
}

function saveSchoolClubsToGlobal(clubs: SchoolClub[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeClubOrders(clubs)))
}

export function loadSchoolClubs(): SchoolClub[] {
  const schoolId = getOperationalSchoolId()
  return readScopedWorkspace(
    schoolId,
    (ws) => parseClubsFromRaw(ws.clubs),
    loadSchoolClubsFromGlobal
  )
}

export function saveSchoolClubs(clubs: SchoolClub[]): void {
  const schoolId = getOperationalSchoolId()
  const normalized = normalizeClubOrders(clubs)
  writeScopedWorkspace(
    schoolId,
    (ws) => ({ ...ws, clubs: normalized }),
    () => saveSchoolClubsToGlobal(normalized)
  )
}

/** club-XXXX（4桁数字）で既存と重複しない ID を発行 */
export function generateUniqueClubId(existing: SchoolClub[]): string {
  const used = new Set(existing.map((c) => c.id))
  for (let attempt = 0; attempt < 200; attempt++) {
    const digits = String(Math.floor(1000 + Math.random() * 9000))
    const id = `club-${digits}`
    if (!used.has(id)) return id
  }
  return `club-${Date.now().toString().slice(-4)}`
}

export function updateClubPassword(clubId: string, newPassword: string): boolean {
  const trimmed = newPassword.trim()
  if (!trimmed) return false
  const clubs = loadSchoolClubs()
  const idx = clubs.findIndex((c) => c.id === clubId)
  if (idx === -1) return false
  const next = clubs.map((c, i) =>
    i === idx ? { ...c, password: trimmed } : c
  )
  saveSchoolClubs(next)
  return true
}

export function verifyClubPassword(clubId: string, password: string): boolean {
  const club = loadSchoolClubs().find((c) => c.id === clubId)
  return club?.password === password
}

/** 作業者PWまたは責任者PWのいずれかと一致するか */
export function verifyClubLoginPassword(
  clubId: string,
  password: string
): "worker" | "manager" | null {
  const club = loadSchoolClubs().find((c) => c.id === clubId)
  if (!club) return null
  if (club.password === password) return "worker"
  if (club.managerPassword === password) return "manager"
  return null
}

export function getClubById(clubId: string): SchoolClub | undefined {
  return loadSchoolClubs().find((c) => c.id === clubId)
}

export function formatClubRegisteredAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

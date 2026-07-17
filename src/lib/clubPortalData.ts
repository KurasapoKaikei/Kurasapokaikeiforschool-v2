/**
 * クラブポータル：ログインクラブごとのデータ参照
 * - 学校登録クラブで未使用 → 空の初期状態
 * - セッションなし → 空配列（既存セッションの誤上書きを防止）
 */

import {
  getClubPortalMessageViews,
  isClubAudienceMessage,
  loadPortalMessages,
  toClubPortalMessageView,
  type ClubPortalMessageView,
} from "@/lib/portalMessages"
import { resolveActiveClubSession, type ActiveClubSession } from "@/lib/activeClubSession"
import { getClubMembersById } from "@/lib/clubMembers"
import { loadSchoolClubs } from "@/lib/schoolClubs"
import {
  hasSchoolCommonAccountTitlesConfigured,
  mergeSchoolAndClubAccountTitles,
} from "@/lib/schoolCommonAccountTitles"
import {
  getAccountTitles,
  getTransactions,
  type AccountTitle,
  type Member,
  type Transaction,
} from "@/utils/localStorage"

const BASE_KEYS = {
  TRANSACTIONS: "classapo_transactions",
  ACCOUNT_TITLES: "classapo_account_titles",
  MEMBERS: "classapo_members",
} as const

const PORTAL_DATA_FLAG = (clubId: string) =>
  `kurasaokaikei-club-has-portal-data-${clubId}`

function readStorageJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function scopedKey(baseKey: string, clubId: string): string {
  return `${baseKey}__${clubId}`
}

export function isSchoolRegisteredClub(clubId: string): boolean {
  return loadSchoolClubs().some((c) => c.id === clubId)
}

export function markClubPortalHasData(clubId: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(PORTAL_DATA_FLAG(clubId), "1")
}

export function clubHasPortalData(clubId: string): boolean {
  if (typeof window === "undefined") return false
  if (localStorage.getItem(PORTAL_DATA_FLAG(clubId)) === "1") return true
  const tx = readStorageJson<Transaction[]>(
    scopedKey(BASE_KEYS.TRANSACTIONS, clubId),
    []
  )
  return tx.length > 0
}

/** 学校登録クラブで活動データがまだない → 初期空状態 */
export function isEmptyPortalForClub(active: ActiveClubSession | null): boolean {
  if (!active) return false
  if (!isSchoolRegisteredClub(active.id)) return false
  return !clubHasPortalData(active.id)
}

export function isLegacyGlobalPortal(active: ActiveClubSession | null): boolean {
  return active === null
}

export function getPortalTransactions(
  active: ActiveClubSession | null
): Transaction[] {
  if (isLegacyGlobalPortal(active)) return []
  if (!active) return []
  if (isEmptyPortalForClub(active)) return []
  const scoped = readStorageJson<Transaction[]>(
    scopedKey(BASE_KEYS.TRANSACTIONS, active.id),
    []
  )
  // 出納帳・入出金登録と同じ正本（グローバル）へフォールバック
  if (scoped.length > 0) return scoped
  return getTransactions()
}

/**
 * 科目マスタは科目設定・現金預金出納帳と同じ正本を返す。
 * 空ポータルでも現金・預金科目と初期残高を表示できるよう、空配列にしない。
 */
export function getPortalAccountTitles(
  active: ActiveClubSession | null
): AccountTitle[] {
  if (isLegacyGlobalPortal(active)) return []
  if (!active) return []
  if (hasSchoolCommonAccountTitlesConfigured()) {
    return mergeSchoolAndClubAccountTitles()
  }
  return getAccountTitles()
}

export function getPortalMembers(active: ActiveClubSession | null): Member[] {
  if (isEmptyPortalForClub(active)) return []
  if (isLegacyGlobalPortal(active)) return []
  return getClubMembersById(active!.id) as Member[]
}

export const LEGACY_INBOX_CLUB_ID = "legacy-demo"

/** クラブポータル：メッセージBOX（school_to_club_messages 正本・活動データとは独立） */
export function getPortalMessages(
  active: ActiveClubSession | null
): ClubPortalMessageView[] {
  try {
    if (isLegacyGlobalPortal(active)) {
      return loadPortalMessages()
        .filter(isClubAudienceMessage)
        .filter((m) => m.targetClubId === "all")
        .map((m) => toClubPortalMessageView(m, LEGACY_INBOX_CLUB_ID))
    }
    if (!active?.id) return []
    return getClubPortalMessageViews(active.id)
  } catch {
    return []
  }
}

export function getActivePortalState() {
  const active = resolveActiveClubSession()
  return {
    activeClub: active,
    isEmptyPortal: isEmptyPortalForClub(active),
    isLegacyGlobalPortal: isLegacyGlobalPortal(active),
  }
}

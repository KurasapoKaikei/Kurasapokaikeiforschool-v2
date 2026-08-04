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
import { readClubScopedJsonForClubId } from "@/lib/clubScopedStorage"

/** クラブ側の取引データ保存ベースキー（`src/utils/localStorage.ts` の STORAGE_KEYS.TRANSACTIONS と一致） */
const TRANSACTIONS_BASE_KEY = "classapo_transactions"

const PORTAL_DATA_FLAG = (clubId: string) =>
  `kurasaokaikei-club-has-portal-data-${clubId}`

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
  const tx = readClubScopedJsonForClubId<Transaction[]>(
    TRANSACTIONS_BASE_KEY,
    clubId,
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
  // `getTransactions()` は現在アクティブなクラブのスコープ済みキーのみを読む
  // （出納帳・入出金登録と同じ正本）。他クラブのグローバル/共有データへは
  // フォールバックしない（クラブ間のデータ混在を防ぐ）。
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

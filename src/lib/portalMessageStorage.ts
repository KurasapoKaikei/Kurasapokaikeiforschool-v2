/**
 * メッセージBOX専用 localStorage の一括クリア・初回リセット
 * （クラブ・監査人・会計データには触れない）
 */

import { AUDITOR_DRAFT_MESSAGES_KEY } from "@/lib/auditorDraftMessages"
import {
  PORTAL_DRAFTS_CHANGED_EVENT,
  SCHOOL_DRAFT_MESSAGES_KEY,
} from "@/lib/portalDraftMessages"
import {
  LEGACY_PORTAL_MESSAGES_STORAGE_KEY,
  PORTAL_MESSAGES_CHANGED_EVENT,
  SCHOOL_TO_CLUB_MESSAGES_KEY,
} from "@/lib/portalMessages"
import { clearAllWorkspaceMessageData } from "@/lib/schoolWorkspace"

/** 一括クリア済みマーカー（再実行しない） */
export const PORTAL_MESSAGES_RESET_MARKER_KEY =
  "kurasaokaikei-portal-messages-reset-2026-05-v1"

function dispatchStorageChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(PORTAL_MESSAGES_CHANGED_EVENT))
  window.dispatchEvent(new Event(PORTAL_DRAFTS_CHANGED_EVENT))
  window.dispatchEvent(new Event("kurasaokaikei-auditor-drafts-changed"))
}

/**
 * メッセージBOX関連キーをすべて空にする。
 * クラサポ大学のクラブ・監査人（kurasaokaikei-school-clubs / school_auditors）は変更しない。
 */
export function clearAllPortalMessageStorage(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(SCHOOL_TO_CLUB_MESSAGES_KEY, "[]")
    localStorage.removeItem(LEGACY_PORTAL_MESSAGES_STORAGE_KEY)
    localStorage.setItem(SCHOOL_DRAFT_MESSAGES_KEY, "[]")
    localStorage.setItem(AUDITOR_DRAFT_MESSAGES_KEY, "[]")
    clearAllWorkspaceMessageData()
    dispatchStorageChanged()
  } catch {
    // localStorage 不可時はスキップ
  }
}

/** 初回のみメッセージ履歴を完全クリア（114団体登録前のリセット用） */
export function ensurePortalMessagesClearedOnce(): void {
  if (typeof window === "undefined") return
  try {
    if (localStorage.getItem(PORTAL_MESSAGES_RESET_MARKER_KEY) === "1") return
    clearAllPortalMessageStorage()
    localStorage.setItem(PORTAL_MESSAGES_RESET_MARKER_KEY, "1")
  } catch {
    // ignore
  }
}

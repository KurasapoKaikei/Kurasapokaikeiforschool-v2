/** 学校ポータル：メッセージ下書き（localStorage） */

import {
  ALL_AUDITORS_TARGET_ID,
  ALL_CLUBS_TARGET_ID,
  isAllAuditorsTarget,
  isAllClubsTarget,
  type PortalMessageAudience,
} from "@/lib/portalMessages"
import {
  getOperationalSchoolId,
  readScopedWorkspace,
  writeScopedWorkspace,
} from "@/lib/schoolWorkspace"

export const SCHOOL_DRAFT_MESSAGES_KEY = "school_draft_messages"

export const PORTAL_DRAFTS_CHANGED_EVENT = "kurasaokaikei-portal-drafts-changed"

export type SchoolMessageDraft = {
  id: string
  updatedAt: string
  audience: PortalMessageAudience
  targetId: string
  targetName: string
  subject: string
  body: string
}

function dispatchDraftsChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(PORTAL_DRAFTS_CHANGED_EVENT))
}

function newDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function parseDrafts(parsed: unknown): SchoolMessageDraft[] {
  if (!Array.isArray(parsed)) return []
  return parsed
    .map(normalizeDraft)
    .filter((d): d is SchoolMessageDraft => d != null)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
}

function loadDraftsFromGlobal(): SchoolMessageDraft[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(SCHOOL_DRAFT_MESSAGES_KEY)
    if (!raw) return []
    return parseDrafts(JSON.parse(raw) as unknown)
  } catch {
    return []
  }
}

export function loadSchoolDraftMessages(): SchoolMessageDraft[] {
  const schoolId = getOperationalSchoolId()
  return readScopedWorkspace(
    schoolId,
    (ws) => parseDrafts(ws.draftMessages),
    loadDraftsFromGlobal
  )
}

function normalizeDraft(raw: unknown): SchoolMessageDraft | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Partial<SchoolMessageDraft>
  const id = typeof item.id === "string" ? item.id : ""
  const subject = typeof item.subject === "string" ? item.subject : ""
  const body = typeof item.body === "string" ? item.body : ""
  if (!id) return null
  const rawAudience = item.audience as PortalMessageAudience | "staff" | undefined
  const audience =
    rawAudience === "auditor" || rawAudience === "staff" ? "auditor" : "club"
  const defaultTargetId =
    audience === "auditor" ? ALL_AUDITORS_TARGET_ID : ALL_CLUBS_TARGET_ID
  const targetId =
    typeof item.targetId === "string" ? item.targetId : defaultTargetId
  const targetName =
    typeof item.targetName === "string"
      ? item.targetName
      : audience === "club"
        ? "全クラブ"
        : "全監査人"
  const updatedAt =
    typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString()
  return {
    id,
    updatedAt,
    audience,
    targetId,
    targetName,
    subject,
    body,
  }
}

function saveAllDraftsToGlobal(drafts: SchoolMessageDraft[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(SCHOOL_DRAFT_MESSAGES_KEY, JSON.stringify(drafts))
    dispatchDraftsChanged()
  } catch {
    // localStorage 不可時はスキップ
  }
}

function saveAllDrafts(drafts: SchoolMessageDraft[]): void {
  const schoolId = getOperationalSchoolId()
  writeScopedWorkspace(
    schoolId,
    (ws) => ({ ...ws, draftMessages: drafts }),
    () => saveAllDraftsToGlobal(drafts)
  )
}

export type SaveSchoolDraftInput = {
  id?: string
  audience: PortalMessageAudience
  targetId: string
  targetName: string
  subject: string
  body: string
}

export function saveSchoolDraft(input: SaveSchoolDraftInput): SchoolMessageDraft {
  const drafts = loadSchoolDraftMessages()
  const now = new Date().toISOString()
  const existingIdx =
    input.id != null ? drafts.findIndex((d) => d.id === input.id) : -1

  const draft: SchoolMessageDraft = {
    id: input.id ?? newDraftId(),
    updatedAt: now,
    audience: input.audience,
    targetId: input.targetId,
    targetName: input.targetName,
    subject: input.subject.trim(),
    body: input.body.trim(),
  }

  if (existingIdx >= 0) {
    drafts[existingIdx] = draft
  } else {
    drafts.unshift(draft)
  }
  saveAllDrafts(drafts)
  return draft
}

export function deleteSchoolDraft(id: string): void {
  const next = loadSchoolDraftMessages().filter((d) => d.id !== id)
  saveAllDrafts(next)
}

export function getSchoolDraftById(id: string): SchoolMessageDraft | null {
  return loadSchoolDraftMessages().find((d) => d.id === id) ?? null
}

/** 下書き一覧の送信先表示 */
export function formatSchoolDraftTargetLabel(d: SchoolMessageDraft): string {
  if (d.audience === "auditor") {
    if (isAllAuditorsTarget(d.targetId)) return "全監査人宛て"
    return d.targetName ? `監査人：${d.targetName}` : "監査人"
  }
  if (isAllClubsTarget(d.targetId)) return "全クラブ宛て"
  return `個別：${d.targetName}`
}

/** 下書きを一覧テーブル用の行データに変換 */
export function draftToHistoryRow(d: SchoolMessageDraft): {
  id: string
  sentAt: string
  subject: string
  targetClubName: string
} {
  return {
    id: d.id,
    sentAt: d.updatedAt,
    subject: d.subject || "（件名なし）",
    targetClubName: formatSchoolDraftTargetLabel(d),
  }
}

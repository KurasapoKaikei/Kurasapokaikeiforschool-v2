/** 監査人ポータル：メッセージ下書き */

export const AUDITOR_DRAFT_MESSAGES_KEY = "auditor_draft_messages"

export const AUDITOR_DRAFTS_CHANGED_EVENT =
  "kurasaokaikei-auditor-drafts-changed"

export type AuditorMessageDraft = {
  id: string
  auditorId: string
  updatedAt: string
  targetId: string
  targetName: string
  subject: string
  body: string
}

function dispatchChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(AUDITOR_DRAFTS_CHANGED_EVENT))
}

function newDraftId(): string {
  return `aud-draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeDraft(raw: unknown): AuditorMessageDraft | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Partial<AuditorMessageDraft>
  const id = typeof item.id === "string" ? item.id : ""
  const auditorId = typeof item.auditorId === "string" ? item.auditorId : ""
  if (!id || !auditorId) return null
  return {
    id,
    auditorId,
    updatedAt:
      typeof item.updatedAt === "string"
        ? item.updatedAt
        : new Date().toISOString(),
    targetId: typeof item.targetId === "string" ? item.targetId : "",
    targetName: typeof item.targetName === "string" ? item.targetName : "",
    subject: typeof item.subject === "string" ? item.subject : "",
    body: typeof item.body === "string" ? item.body : "",
  }
}

function saveAll(drafts: AuditorMessageDraft[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(AUDITOR_DRAFT_MESSAGES_KEY, JSON.stringify(drafts))
    dispatchChanged()
  } catch {
    /* ignore */
  }
}

export function loadAuditorDraftMessages(
  auditorId: string
): AuditorMessageDraft[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(AUDITOR_DRAFT_MESSAGES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeDraft)
      .filter((d): d is AuditorMessageDraft => d != null && d.auditorId === auditorId)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
  } catch {
    return []
  }
}

export type SaveAuditorDraftInput = {
  id?: string
  auditorId: string
  targetId: string
  targetName: string
  subject: string
  body: string
}

export function saveAuditorDraft(
  input: SaveAuditorDraftInput
): AuditorMessageDraft {
  const allRaw: AuditorMessageDraft[] = (() => {
    if (typeof window === "undefined") return []
    try {
      const raw = localStorage.getItem(AUDITOR_DRAFT_MESSAGES_KEY)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed
        .map(normalizeDraft)
        .filter((d): d is AuditorMessageDraft => d != null)
    } catch {
      return []
    }
  })()

  const others = allRaw.filter((d) => d.auditorId !== input.auditorId)
  const mine = allRaw.filter((d) => d.auditorId === input.auditorId)
  const now = new Date().toISOString()
  const existingIdx =
    input.id != null ? mine.findIndex((d) => d.id === input.id) : -1

  const draft: AuditorMessageDraft = {
    id: input.id ?? newDraftId(),
    auditorId: input.auditorId,
    updatedAt: now,
    targetId: input.targetId,
    targetName: input.targetName,
    subject: input.subject.trim(),
    body: input.body.trim(),
  }

  const nextMine =
    existingIdx >= 0
      ? mine.map((d, i) => (i === existingIdx ? draft : d))
      : [draft, ...mine]

  saveAll([...nextMine, ...others])
  return draft
}

export function deleteAuditorDraft(id: string, auditorId: string): void {
  const all = (() => {
    if (typeof window === "undefined") return []
    try {
      const raw = localStorage.getItem(AUDITOR_DRAFT_MESSAGES_KEY)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed
        .map(normalizeDraft)
        .filter((d): d is AuditorMessageDraft => d != null)
    } catch {
      return []
    }
  })()
  saveAll(all.filter((d) => !(d.id === id && d.auditorId === auditorId)))
}

export function getAuditorDraftById(
  id: string,
  auditorId: string
): AuditorMessageDraft | null {
  return loadAuditorDraftMessages(auditorId).find((d) => d.id === id) ?? null
}

export function formatAuditorDraftTargetLabel(d: AuditorMessageDraft): string {
  return d.targetName ? `個別：${d.targetName}` : d.targetId
}

export function auditorDraftToHistoryRow(d: AuditorMessageDraft): {
  id: string
  sentAt: string
  subject: string
  targetClubName: string
} {
  return {
    id: d.id,
    sentAt: d.updatedAt,
    subject: d.subject || "（件名なし）",
    targetClubName: formatAuditorDraftTargetLabel(d),
  }
}

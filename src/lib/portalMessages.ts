/** 学校⇔クラブ メッセージBOX（5/27デモ・localStorage） */

const STORAGE_KEY = "portal_messages"

export const PORTAL_MESSAGES_CHANGED_EVENT = "kurasaokaikei-portal-messages-changed"

export type PortalMessageKind = "general" | "settlement_deadline"

/** 送信元（クラブポータル表示用） */
export type PortalMessageSender = "school" | "system"

export type PortalMessage = {
  id: string
  subject: string
  body: string
  sentAt: string
  /** 個別クラブID、または全クラブ向けは `all` */
  targetClubId: string
  targetClubName: string
  readByClubIds: string[]
  kind: PortalMessageKind
  sender?: PortalMessageSender
}

/** クラブ向け一覧・詳細の表示モデル（ダッシュボード／メッセージBOX共通） */
export type ClubPortalMessageView = {
  id: string
  subject: string
  body: string
  date: string
  isRead: boolean
  sender: PortalMessageSender
  senderLabel: string
}

export const CLUB_MESSAGE_EMPTY_TEXT = "メッセージはまだありません"

function resolveSender(m: PortalMessage): PortalMessageSender {
  if (m.sender === "school" || m.sender === "system") return m.sender
  return "school"
}

export function toClubPortalMessageView(
  m: PortalMessage,
  clubId: string
): ClubPortalMessageView {
  const sender = resolveSender(m)
  return {
    id: m.id,
    subject: m.subject,
    body: m.body,
    date: formatPortalMessageDate(m.sentAt),
    isRead: m.readByClubIds.includes(clubId),
    sender,
    senderLabel: sender === "school" ? "学校" : "クラサポ会計",
  }
}

export function getClubPortalMessageViews(clubId: string): ClubPortalMessageView[] {
  return getMessagesForClub(clubId).map((m) => toClubPortalMessageView(m, clubId))
}

function dispatchChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(PORTAL_MESSAGES_CHANGED_EVENT))
}

export function loadPortalMessages(): PortalMessage[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PortalMessage[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (m) =>
          m &&
          typeof m.id === "string" &&
          typeof m.subject === "string" &&
          typeof m.body === "string"
      )
      .map((m) => ({
        ...m,
        sentAt: m.sentAt ?? new Date().toISOString(),
        targetClubId: m.targetClubId ?? "all",
        targetClubName: m.targetClubName ?? "全クラブ",
        readByClubIds: Array.isArray(m.readByClubIds) ? m.readByClubIds : [],
        kind: m.kind === "settlement_deadline" ? "settlement_deadline" : "general",
        sender:
          m.sender === "system" || m.sender === "school" ? m.sender : undefined,
      }))
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
  } catch {
    return []
  }
}

function savePortalMessages(messages: PortalMessage[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  dispatchChanged()
}

function newMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export type SendPortalMessageInput = {
  subject: string
  body: string
  targetClubId: string
  targetClubName: string
  kind?: PortalMessageKind
  sender?: PortalMessageSender
}

export function sendPortalMessage(input: SendPortalMessageInput): PortalMessage {
  const message: PortalMessage = {
    id: newMessageId(),
    subject: input.subject.trim(),
    body: input.body.trim(),
    sentAt: new Date().toISOString(),
    targetClubId: input.targetClubId,
    targetClubName: input.targetClubName,
    readByClubIds: [],
    kind: input.kind ?? "general",
    sender: input.sender ?? "school",
  }
  const next = [message, ...loadPortalMessages()]
  savePortalMessages(next)
  return message
}

/** クラブ向け受信メッセージ（全体宛て + 個別宛て） */
export function getMessagesForClub(clubId: string): PortalMessage[] {
  return loadPortalMessages().filter(
    (m) => m.targetClubId === "all" || m.targetClubId === clubId
  )
}

export function markPortalMessageRead(messageId: string, clubId: string): void {
  const messages = loadPortalMessages()
  const idx = messages.findIndex((m) => m.id === messageId)
  if (idx === -1) return
  const target = messages[idx]!
  if (target.readByClubIds.includes(clubId)) return
  messages[idx] = {
    ...target,
    readByClubIds: [...target.readByClubIds, clubId],
  }
  savePortalMessages(messages)
}

export function formatPortalMessageDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}.${m}.${day}`
}

/** 全クラブへ決算提出期限通知（メッセージBOXへ自動投稿） */
export function sendSettlementDeadlineNotice(): PortalMessage {
  const deadline = "2026年7月31日"
  return sendPortalMessage({
    subject: "【重要】会計年度末 決算データ提出期限のお知らせ",
    body: [
      "学校管理者より、決算データ提出期限のご案内です。",
      "",
      `■提出期限: ${deadline}`,
      "■提出方法: クラブポータルのダッシュボードより「決算データを学校へ提出する」を実行してください。",
      "",
      "期限内に提出がない場合、年度繰越処理が遅れる可能性があります。",
      "ご不明点は本メッセージBOXより学生支援課までお問い合わせください。",
    ].join("\n"),
    targetClubId: "all",
    targetClubName: "全クラブ",
    kind: "settlement_deadline",
    sender: "school",
  })
}

/** クラサポ会計（システム）からの通知用（将来の自動配信） */
export function sendSystemPortalMessage(
  input: Omit<SendPortalMessageInput, "sender">
): PortalMessage {
  return sendPortalMessage({ ...input, sender: "system" })
}

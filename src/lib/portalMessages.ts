/** 学校⇔クラブ メッセージBOX（5/27デモ・localStorage） */

import {
  getOperationalSchoolId,
  readScopedWorkspace,
  writeScopedWorkspace,
} from "@/lib/schoolWorkspace"

/** 学校→クラブメッセージの正本キー（学校・クラブ双方で同一） */
export const SCHOOL_TO_CLUB_MESSAGES_KEY = "school_to_club_messages"

/** @deprecated school_to_club_messages へ移行済み。クリア時に削除 */
export const LEGACY_PORTAL_MESSAGES_STORAGE_KEY = "portal_messages"

const LEGACY_STORAGE_KEY = LEGACY_PORTAL_MESSAGES_STORAGE_KEY

export const PORTAL_MESSAGES_CHANGED_EVENT = "kurasaokaikei-portal-messages-changed"

export type PortalMessageKind = "general" | "settlement_deadline"

/** 学校ポータル送信先区分（一覧タブ・履歴フィルタ用） */
export type PortalMessageAudience = "club" | "auditor"

/** 旧データ互換（管理担当者 → 監査人） */
function normalizeMessageAudience(
  raw: PortalMessageAudience | "staff" | undefined
): PortalMessageAudience {
  if (raw === "auditor" || raw === "staff") return "auditor"
  return "club"
}

/** 送信元（クラブポータル表示用） */
export type PortalMessageSender = "school" | "audit" | "system"

/** クラブポータルバッジ表示ラベル */
export const CLUB_SENDER_LABELS: Record<PortalMessageSender, string> = {
  school: "学校",
  audit: "監査",
  system: "クラサポ",
}

export function getClubSenderLabel(sender: PortalMessageSender): string {
  return CLUB_SENDER_LABELS[sender]
}

export type PortalMessage = {
  id: string
  /** 件名（保存時は subject、読み込み時 title も受け付け） */
  subject: string
  body: string
  sentAt: string
  /** 個別クラブID、全クラブ `all`、担当者 `staff-all` 等 */
  targetClubId: string
  targetClubName: string
  /** クラブごとの既読（clubId 一覧） */
  readByClubIds: string[]
  /** クラブごとの受領確認（clubId 一覧） */
  confirmedByClubIds: string[]
  kind: PortalMessageKind
  sender?: PortalMessageSender
  /** 監査人送信時の担当者 ID（AUD-0001 形式） */
  auditorId?: string
  /** 未指定はクラブ宛て（既存データ互換） */
  audience?: PortalMessageAudience
}

/** 連携仕様向けの表示用型（内部は PortalMessage に正規化） */
export type SchoolToClubMessage = {
  id: string
  title: string
  body: string
  sender: "学校" | "監査" | "クラサポ" | "クラサポ会計"
  targetClubId: string
  createdAt: string
  isRead: boolean
}

/** クラブ向け一覧・詳細の表示モデル（ダッシュボード／メッセージBOX共通） */
export type ClubPortalMessageView = {
  id: string
  subject: string
  body: string
  /** 一覧用（例: 2026/05/25） */
  date: string
  /** 一覧用（例: 22:30） */
  time: string
  isRead: boolean
  /** 当該クラブが「メッセージを確認しました」を押したか */
  isConfirmed: boolean
  sender: PortalMessageSender
  senderLabel: string
}

export const CLUB_MESSAGE_EMPTY_TEXT = "メッセージはまだありません"

function resolveSender(m: PortalMessage): PortalMessageSender {
  if (
    m.sender === "school" ||
    m.sender === "audit" ||
    m.sender === "system"
  ) {
    return m.sender
  }
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
    time: formatPortalMessageTime(m.sentAt),
    isRead: isMessageReadByClub(m, clubId),
    isConfirmed: isMessageConfirmedByClub(m, clubId),
    sender,
    senderLabel: getClubSenderLabel(sender),
  }
}

export function getClubPortalMessageViews(clubId: string): ClubPortalMessageView[] {
  return getMessagesForClub(clubId).map((m) => toClubPortalMessageView(m, clubId))
}

function dispatchChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(PORTAL_MESSAGES_CHANGED_EVENT))
}

/** 旧キー portal_messages → school_to_club_messages へ一度だけ移行 */
function migrateLegacyStorageKey(): void {
  if (typeof window === "undefined") return
  try {
    if (localStorage.getItem(SCHOOL_TO_CLUB_MESSAGES_KEY)) return
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      localStorage.setItem(SCHOOL_TO_CLUB_MESSAGES_KEY, legacy)
    }
  } catch {
    // localStorage 不可・破損時は移行をスキップ
  }
}

type RawStoredMessage = Partial<PortalMessage> & {
  title?: string
  createdAt?: string
  isRead?: boolean
  sender?: PortalMessageSender | "学校" | "監査" | "クラサポ" | "クラサポ会計"
}

function normalizeSender(
  raw: RawStoredMessage
): PortalMessageSender | undefined {
  if (raw.sender === "audit" || raw.sender === "監査") return "audit"
  if (
    raw.sender === "system" ||
    raw.sender === "クラサポ" ||
    raw.sender === "クラサポ会計"
  ) {
    return "system"
  }
  if (raw.sender === "school" || raw.sender === "学校") return "school"
  return undefined
}

function normalizeRawMessage(raw: unknown): PortalMessage | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as RawStoredMessage

  const id = typeof item.id === "string" ? item.id : ""
  const subject =
    typeof item.subject === "string"
      ? item.subject
      : typeof item.title === "string"
        ? item.title
        : ""
  const body = typeof item.body === "string" ? item.body : ""
  if (!id || !subject || !body) return null

  const sentAt =
    typeof item.sentAt === "string"
      ? item.sentAt
      : typeof item.createdAt === "string"
        ? item.createdAt
        : new Date().toISOString()

  const readByClubIds = Array.isArray(item.readByClubIds)
    ? item.readByClubIds.filter((clubId): clubId is string => typeof clubId === "string")
    : []

  const confirmedByClubIds = Array.isArray(item.confirmedByClubIds)
    ? item.confirmedByClubIds.filter(
        (clubId): clubId is string => typeof clubId === "string"
      )
    : []

  return {
    id,
    subject,
    body,
    sentAt,
    targetClubId:
      typeof item.targetClubId === "string" ? item.targetClubId : "all",
    targetClubName:
      typeof item.targetClubName === "string" ? item.targetClubName : "全クラブ",
    readByClubIds,
    confirmedByClubIds,
    kind:
      item.kind === "settlement_deadline" ? "settlement_deadline" : "general",
    sender: normalizeSender(item),
    auditorId:
      typeof item.auditorId === "string" ? item.auditorId.trim() : undefined,
    audience: normalizeMessageAudience(
      item.audience as PortalMessageAudience | "staff" | undefined
    ),
  }
}

function parsePortalMessages(parsed: unknown): PortalMessage[] {
  if (!Array.isArray(parsed)) return []
  return parsed
    .map(normalizeRawMessage)
    .filter((m): m is PortalMessage => m != null)
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
}

function loadPortalMessagesFromGlobal(): PortalMessage[] {
  if (typeof window === "undefined") return []
  try {
    migrateLegacyStorageKey()
    const raw = localStorage.getItem(SCHOOL_TO_CLUB_MESSAGES_KEY)
    if (!raw) return []
    return parsePortalMessages(JSON.parse(raw) as unknown)
  } catch {
    return []
  }
}

export function loadPortalMessages(): PortalMessage[] {
  const schoolId = getOperationalSchoolId()
  return readScopedWorkspace(
    schoolId,
    (ws) => parsePortalMessages(ws.portalMessages),
    loadPortalMessagesFromGlobal
  )
}

function savePortalMessagesToGlobal(messages: PortalMessage[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(SCHOOL_TO_CLUB_MESSAGES_KEY, JSON.stringify(messages))
    dispatchChanged()
  } catch {
    // localStorage 不可・容量超過時は保存をスキップ（UI は継続）
  }
}

function savePortalMessages(messages: PortalMessage[]): void {
  const schoolId = getOperationalSchoolId()
  writeScopedWorkspace(
    schoolId,
    (ws) => ({ ...ws, portalMessages: messages }),
    () => savePortalMessagesToGlobal(messages)
  )
}

/** クラブID向けの既読（isRead） */
export function isMessageReadByClub(m: PortalMessage, clubId: string): boolean {
  const ids = Array.isArray(m.readByClubIds) ? m.readByClubIds : []
  return ids.includes(clubId)
}

/** クラブID向けの受領確認 */
export function isMessageConfirmedByClub(m: PortalMessage, clubId: string): boolean {
  if (!clubId) return false
  const ids = Array.isArray(m.confirmedByClubIds) ? m.confirmedByClubIds : []
  return ids.includes(clubId)
}

export function toSchoolToClubMessage(
  m: PortalMessage,
  clubId: string
): SchoolToClubMessage {
  const sender = resolveSender(m)
  return {
    id: m.id,
    title: m.subject,
    body: m.body,
    sender: getClubSenderLabel(sender),
    targetClubId: m.targetClubId,
    createdAt: m.sentAt,
    isRead: isMessageReadByClub(m, clubId),
  }
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
  auditorId?: string
  audience?: PortalMessageAudience
}

export function isClubAudienceMessage(m: PortalMessage): boolean {
  return normalizeMessageAudience(m.audience) === "club"
}

export function isAuditorAudienceMessage(m: PortalMessage): boolean {
  return normalizeMessageAudience(m.audience) === "auditor"
}

/** @deprecated 監査人宛てへ名称変更 */
export function isStaffAudienceMessage(m: PortalMessage): boolean {
  return isAuditorAudienceMessage(m)
}

export const ALL_CLUBS_TARGET_ID = "all"

/** 監査人宛て一括送信（`audience: "auditor"` と組み合わせて解釈） */
export const ALL_AUDITORS_TARGET_ID = "all"

export function isAllClubsTarget(targetClubId: string): boolean {
  return targetClubId === ALL_CLUBS_TARGET_ID
}

export function isAllAuditorsTarget(targetId: string): boolean {
  return targetId === ALL_AUDITORS_TARGET_ID
}

/** 学校→クラブ送信履歴の送信先表示（全クラブ / 個別） */
export function formatSchoolClubOutboundTargetLabel(m: PortalMessage): string {
  if (isAllClubsTarget(m.targetClubId)) return "全クラブ宛て"
  return `個別：${m.targetClubName}`
}

export function loadSchoolClubOutboundMessages(): PortalMessage[] {
  return loadPortalMessages().filter(isClubAudienceMessage)
}

/** クラブ一覧の✉から：全クラブ宛＋当該クラブ個別宛の送信履歴のみ */
export function loadSchoolClubMessagesForClub(clubId: string): PortalMessage[] {
  return loadSchoolClubOutboundMessages().filter(
    (m) => isAllClubsTarget(m.targetClubId) || m.targetClubId === clubId
  )
}

export function loadSchoolAuditorOutboundMessages(): PortalMessage[] {
  return loadPortalMessages().filter(isAuditorAudienceMessage)
}

/** @deprecated loadSchoolAuditorOutboundMessages を使用 */
export function loadSchoolStaffOutboundMessages(): PortalMessage[] {
  return loadSchoolAuditorOutboundMessages()
}

/** 監査人宛て送信履歴の送信先表示（全監査人 / 個別） */
export function formatSchoolAuditorOutboundTargetLabel(m: PortalMessage): string {
  if (isAllAuditorsTarget(m.targetClubId)) return "全監査人宛て"
  return m.targetClubName ? `監査人：${m.targetClubName}` : "監査人"
}

/** 監査人向け受信メッセージ（全監査人宛て + 個別宛て） */
export function getMessagesForAuditor(auditorId: string): PortalMessage[] {
  return loadPortalMessages().filter(
    (m) =>
      isAuditorAudienceMessage(m) &&
      (isAllAuditorsTarget(m.targetClubId) || m.targetClubId === auditorId)
  )
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
    confirmedByClubIds: [],
    kind: input.kind ?? "general",
    sender: input.sender ?? "school",
    auditorId: input.auditorId?.trim() || undefined,
    audience: input.audience ?? "club",
  }
  const next = [message, ...loadPortalMessages()]
  savePortalMessages(next)
  return message
}

/** クラブ向け受信メッセージ（全体宛て + 個別宛て・担当者宛ては除外） */
export function getMessagesForClub(clubId: string): PortalMessage[] {
  return loadPortalMessages().filter(
    (m) =>
      isClubAudienceMessage(m) &&
      (m.targetClubId === "all" || m.targetClubId === clubId)
  )
}

/** 学校 → 監査人宛てメッセージ送信 */
export function sendAuditorPortalMessage(input: {
  subject: string
  body: string
  targetAuditorId: string
  targetAuditorName: string
}): PortalMessage {
  return sendPortalMessage({
    subject: input.subject,
    body: input.body,
    targetClubId: input.targetAuditorId,
    targetClubName: input.targetAuditorName,
    audience: "auditor",
    sender: "school",
  })
}

/** @deprecated sendAuditorPortalMessage を使用 */
export function sendStaffPortalMessage(input: {
  subject: string
  body: string
  targetStaffId?: string
  targetStaffName?: string
}): PortalMessage {
  return sendAuditorPortalMessage({
    subject: input.subject,
    body: input.body,
    targetAuditorId: input.targetStaffId ?? "",
    targetAuditorName: input.targetStaffName ?? "監査人",
  })
}

export function markPortalMessageRead(messageId: string, clubId: string): void {
  if (!clubId) return
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

/** クラブが「メッセージを確認しました」を押したとき（既読も同時に付与） */
export function markPortalMessageConfirmed(
  messageId: string,
  clubId: string
): void {
  if (!clubId) return
  const messages = loadPortalMessages()
  const idx = messages.findIndex((m) => m.id === messageId)
  if (idx === -1) return
  const target = messages[idx]!
  const prevRead = Array.isArray(target.readByClubIds) ? target.readByClubIds : []
  const prevConfirmed = Array.isArray(target.confirmedByClubIds)
    ? target.confirmedByClubIds
    : []
  const readByClubIds = prevRead.includes(clubId) ? prevRead : [...prevRead, clubId]
  if (prevConfirmed.includes(clubId)) {
    if (readByClubIds.length === prevRead.length) return
    messages[idx] = { ...target, readByClubIds, confirmedByClubIds: prevConfirmed }
    savePortalMessages(messages)
    return
  }
  messages[idx] = {
    ...target,
    readByClubIds,
    confirmedByClubIds: [...prevConfirmed, clubId],
  }
  savePortalMessages(messages)
}

/** 一覧の日付列（例: 2026/05/25） */
export function formatPortalMessageDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}/${m}/${day}`
}

/** 一覧の時間列（例: 22:30） */
export function formatPortalMessageTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const h = String(d.getHours()).padStart(2, "0")
  const min = String(d.getMinutes()).padStart(2, "0")
  return `${h}:${min}`
}

/** 詳細画面など（例: 2026/05/25 22:15） */
export function formatPortalMessageDateTime(iso: string): string {
  const date = formatPortalMessageDate(iso)
  const time = formatPortalMessageTime(iso)
  if (!time) return date
  return `${date} ${time}`
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

/** クラサポ（システム）からの通知用（将来の自動配信） */
export function sendSystemPortalMessage(
  input: Omit<SendPortalMessageInput, "sender">
): PortalMessage {
  return sendPortalMessage({ ...input, sender: "system" })
}

/** 監査人→担当クラブへの送信 */
export function sendAuditPortalMessage(
  input: Omit<SendPortalMessageInput, "sender">
): PortalMessage {
  return sendPortalMessage({ ...input, sender: "audit" })
}

/** 監査人の送信履歴（担当クラブ宛てのみ） */
export function loadAuditorOutboundMessages(
  auditorId: string,
  assignedClubIds: string[]
): PortalMessage[] {
  const id = auditorId.trim()
  const clubSet = new Set(assignedClubIds)
  return loadPortalMessages().filter((m) => {
    if (!isClubAudienceMessage(m) || resolveSender(m) !== "audit") return false
    if (m.auditorId) return m.auditorId === id
    return clubSet.has(m.targetClubId)
  })
}

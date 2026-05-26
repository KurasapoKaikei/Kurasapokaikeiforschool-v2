/** 監査人ポータル（/audit） */

export const AUDIT_PAGE_TITLES = {
  login: "監査人ログイン",
  home: "ポータルトップ",
  guide: "操作ガイド",
  messages: "メッセージBOX",
  messagesList: "メッセージ一覧",
  messagesDrafts: "下書き",
  clubReview: "決算監査",
} as const

export const AUDIT_ROUTES = {
  login: "/audit/login",
  home: "/audit",
  guide: "/audit/guide",
  messages: "/audit/messages",
  messagesBase: "/audit/messages",
  messagesDrafts: "/audit/messages/drafts",
  clubReview: (clubId: string) =>
    `/audit/clubs/${encodeURIComponent(clubId)}`,
} as const

export function safeAuditPathname(pathname: string | null | undefined): string {
  return pathname ?? ""
}

export function isAuditMessagesPath(pathname: string | null | undefined): boolean {
  const path = safeAuditPathname(pathname)
  return (
    path === AUDIT_ROUTES.messages ||
    path.startsWith(`${AUDIT_ROUTES.messagesBase}/`)
  )
}

/** 担当クラブ宛てメッセージ新規作成（宛先プリセット） */
export function auditorComposeMessagePath(clubId: string): string {
  const params = new URLSearchParams({ compose: "1", to: clubId })
  return `${AUDIT_ROUTES.messages}?${params.toString()}`
}

/** 監査人ポータル UI アクセント */
export const AUDIT_BRAND_ORANGE = "#EA580C"

/** 監査人メッセージ作成のアクセント（オレンジ系・クラブ監査バッジと揃える） */
export const AUDIT_MESSAGE_BOX_ACCENT = "#EA580C"

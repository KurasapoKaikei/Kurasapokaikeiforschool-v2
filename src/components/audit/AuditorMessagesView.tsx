"use client"

import { usePathname } from "next/navigation"
import { AuditorMessagesDraftsView } from "@/components/audit/AuditorMessagesDraftsView"
import { AuditorMessagesListView } from "@/components/audit/AuditorMessagesListView"
import { AUDIT_ROUTES, safeAuditPathname } from "@/lib/auditorTheme"

/**
 * 監査人メッセージBOX（一覧 / 下書きのルーティング）
 * - `/audit/messages` … メッセージ一覧（受信・送信済タブ）
 * - `/audit/messages/drafts` … 下書き一覧
 */
export function AuditorMessagesView() {
  const pathname = safeAuditPathname(usePathname())

  if (
    pathname === AUDIT_ROUTES.messagesDrafts ||
    pathname.startsWith(`${AUDIT_ROUTES.messagesDrafts}/`)
  ) {
    return <AuditorMessagesDraftsView />
  }

  return <AuditorMessagesListView />
}

export default AuditorMessagesView

export { AuditorMessagesListView } from "@/components/audit/AuditorMessagesListView"
export { AuditorMessagesDraftsView } from "@/components/audit/AuditorMessagesDraftsView"

/** クラブポータルのセッション変更通知（ヘッダー・サイドバー・バナー連動） */

export const CLUB_PORTAL_SESSION_CHANGED_EVENT =
  "kurasaokaikei-club-portal-session-changed"

export function notifyClubPortalSessionChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(CLUB_PORTAL_SESSION_CHANGED_EVENT))
}

/** クラブ担当者向け画面の URL プレフィックス（App Router: `src/app/club/`） */
export const CLUB_PREFIX = "/club"

/** クラブ配下のパスを生成（`/dashboard` → `/club/dashboard`） */
export function clubPath(path: string): string {
  if (!path.startsWith("/")) {
    return `${CLUB_PREFIX}/${path}`
  }
  if (path === "/") return CLUB_PREFIX
  return `${CLUB_PREFIX}${path}`
}

/** パスがクラブ配下かどうか */
export function isClubPath(pathname: string): boolean {
  return pathname === CLUB_PREFIX || pathname.startsWith(`${CLUB_PREFIX}/`)
}

/** `/club/accounting/...` → `/accounting/...`（ヘッダー・タイトルマップ用） */
export function clubRelativePath(pathname: string): string {
  if (!isClubPath(pathname)) return pathname
  const rest = pathname.slice(CLUB_PREFIX.length)
  return rest === "" ? "/" : rest
}

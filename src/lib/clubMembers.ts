/**
 * クラブ別部員データ（localStorage: classapo_members__{clubId}）
 */

export const CLUB_MEMBERS_BASE_KEY = "classapo_members"

export const CLUB_MEMBERS_CHANGED_EVENT =
  "kurasaokaikei-club-members-changed"

export function clubMembersStorageKey(clubId: string): string {
  return `${CLUB_MEMBERS_BASE_KEY}__${clubId}`
}

function readMembersArray(clubId: string): unknown[] {
  if (typeof window === "undefined" || !clubId.trim()) return []
  try {
    const raw = localStorage.getItem(clubMembersStorageKey(clubId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** クラブ ID 指定で部員配列を取得 */
export function getClubMembersById(clubId: string): unknown[] {
  const id = clubId.trim()
  if (!id) return []

  const scoped = readMembersArray(id)
  if (scoped.length > 0) return scoped

  if (typeof window === "undefined") return []

  try {
    const legacyRaw = localStorage.getItem(CLUB_MEMBERS_BASE_KEY)
    if (!legacyRaw) return []
    const legacy = JSON.parse(legacyRaw) as unknown
    if (!Array.isArray(legacy) || legacy.length === 0) return []

    const hasAnyScoped = Object.keys(localStorage).some((k) =>
      k.startsWith(`${CLUB_MEMBERS_BASE_KEY}__`)
    )
    if (hasAnyScoped) return []

    localStorage.setItem(clubMembersStorageKey(id), legacyRaw)
    dispatchClubMembersChanged(id)
    return legacy
  } catch {
    return []
  }
}

/** クラブの登録部員数（配列 length） */
export function getClubMemberCount(clubId: string): number {
  return getClubMembersById(clubId).length
}

/** 在籍中（status === "active"）の部員数 */
export function getClubActiveMemberCount(clubId: string): number {
  return readMembersArray(clubId).filter(
    (m) =>
      m != null &&
      typeof m === "object" &&
      (m as { status?: string }).status === "active"
  ).length
}

export function dispatchClubMembersChanged(clubId?: string): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent(CLUB_MEMBERS_CHANGED_EVENT, {
      detail: { clubId: clubId?.trim() || undefined },
    })
  )
}

/** storage / カスタムイベントで当該クラブの部員が変わったか */
export function isClubMembersStorageChange(
  clubId: string,
  storageKey: string | null
): boolean {
  if (!clubId.trim()) return false
  if (storageKey === null) return true
  return storageKey === clubMembersStorageKey(clubId)
}

export function isClubMembersChangedForClub(
  clubId: string,
  event: Event
): boolean {
  if (!clubId.trim()) return false
  if (event.type === "storage") {
    return isClubMembersStorageChange(
      clubId,
      (event as StorageEvent).key
    )
  }
  if (event.type === CLUB_MEMBERS_CHANGED_EVENT) {
    const detail = (event as CustomEvent<{ clubId?: string }>).detail
    return !detail?.clubId || detail.clubId === clubId
  }
  return false
}

/** 保護者 ID に紐づく部員 ID のみ許可（アプリ層の閲覧スコープ用） */
export function memberIdsForParent<T extends { id: string; parentId: string | null }>(
  parentId: string,
  members: T[]
): string[] {
  return members.filter((m) => m.parentId === parentId).map((m) => m.id)
}

/** 対象部員に限定した配列フィルタ（例: CollectionItem, Transaction 拡張時） */
export function filterByMemberScope<T extends { memberId: string }>(
  rows: T[],
  allowedMemberIds: ReadonlySet<string>
): T[] {
  return rows.filter((row) => allowedMemberIds.has(row.memberId))
}

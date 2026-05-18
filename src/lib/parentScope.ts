import type { PrismaClient } from "@prisma/client"

/** 保護者ユーザーに紐づく部員 ID 一覧（アプリ層でのデータスコープ用） */
export async function getMemberIdsForParentId(
  prisma: Pick<PrismaClient, "member">,
  parentId: string
): Promise<string[]> {
  const rows = await prisma.member.findMany({
    where: { parentId },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

/** 集金明細など `memberId` 付きレコードを、保護者に許可された部員だけに絞る */
export function filterRowsByMemberAllowlist<T extends { memberId: string }>(
  rows: T[],
  allowedMemberIds: ReadonlySet<string>
): T[] {
  return rows.filter((r) => allowedMemberIds.has(r.memberId))
}

import { CollectionStatus, Prisma, type PrismaClient } from "@prisma/client"

export type PaymentCompleteResult =
  | { ok: true; collectionItemId: string }
  | { ok: false; reason: "NOT_FOUND" }

/**
 * 外部決済の完了イベントを受けたときに、集金を入金済み化する（将来: 帳簿連携フックを呼ぶ）。
 * `paymentExternalId` で `CollectionItem` を特定する。
 */
export async function applyPaymentCompletedEvent(
  prisma: PrismaClient,
  paymentExternalId: string,
  options?: { collectedAmount?: number }
): Promise<PaymentCompleteResult> {
  const item = await prisma.collectionItem.findFirst({
    where: { paymentExternalId },
  })
  if (!item) return { ok: false, reason: "NOT_FOUND" }

  const collected =
    options?.collectedAmount !== undefined
      ? new Prisma.Decimal(options.collectedAmount)
      : item.amount

  await prisma.collectionItem.update({
    where: { id: item.id },
    data: {
      status: CollectionStatus.COLLECTED,
      collectedAt: new Date(),
      collectedAmount: collected,
      paymentUpdatedAt: new Date(),
    },
  })

  return { ok: true, collectionItemId: item.id }
}

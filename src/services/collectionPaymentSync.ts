import { CollectionStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"

type PaymentCompleteOptions = {
  /** 将来: Transaction(type=collection) 生成など */
  syncLedger?: boolean
}

/**
 * 決済完了イベントを受けたとき、集金を収納済み化する（スタブ: 帳簿連携はオプション）
 */
export async function applyCollectionPaymentCompletedByExternalId(
  paymentExternalId: string,
  options: PaymentCompleteOptions = {}
): Promise<{ ok: true } | { ok: false; reason: "NOT_FOUND" | "ALREADY_COLLECTED" }> {
  const existing = await prisma.collectionItem.findFirst({
    where: { paymentExternalId },
  })
  if (!existing) {
    return { ok: false, reason: "NOT_FOUND" }
  }
  if (existing.status === CollectionStatus.COLLECTED) {
    return { ok: false, reason: "ALREADY_COLLECTED" }
  }

  const now = new Date()
  await prisma.collectionItem.update({
    where: { id: existing.id },
    data: {
      status: CollectionStatus.COLLECTED,
      collectedAt: existing.collectedAt ?? now,
      collectedAmount: existing.collectedAmount ?? existing.amount,
      paymentUpdatedAt: now,
      paymentStatus: "COMPLETED",
    },
  })

  if (options.syncLedger) {
    // 帳簿連携トリガー（将来実装）
  }

  return { ok: true }
}

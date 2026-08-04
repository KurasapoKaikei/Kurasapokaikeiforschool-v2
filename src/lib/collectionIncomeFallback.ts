/**
 * 収支集計・報告書向けの集金収入補完。
 *
 * 正本は帳簿の collection 取引。集金実績は「取引が一度も作られていない旧データ」のみ補完する。
 * transactionId / linkedTransactionId があるのに取引が無い場合は削除済みとみなし加算しない
 * （台帳から消した集金が集計表に幽霊加算されるのを防ぐ）。
 */

import type { CollectionRecord, CollectionSchedule, Transaction } from "@/utils/localStorage"

export type CollectionIncomeFallbackEntry = {
  date: string
  amount: number
  accountTitle: string
  category: string
  counterparty: string
}

export function buildCollectionIncomeFallbackEntries(
  collectionRecords: CollectionRecord[],
  collectionSchedules: CollectionSchedule[],
  transactions: Transaction[]
): CollectionIncomeFallbackEntry[] {
  const scheduleMap = new Map(collectionSchedules.map((s) => [s.id, s]))
  const existingCollectionTxIds = new Set(
    transactions.filter((t) => t.type === "collection").map((t) => t.id)
  )
  const list: CollectionIncomeFallbackEntry[] = []

  collectionRecords.forEach((record) => {
    const schedule = scheduleMap.get(record.scheduleId)
    if (!schedule) return
    const accountTitle = schedule.accountTitleName || schedule.name || "会費収入"
    const category = schedule.categoryName || "集金"
    const counterparty = schedule.counterpartyName || "現金"
    const history = record.paymentHistory ?? []

    if (history.length > 0) {
      history.forEach((h) => {
        // 取引 ID がある履歴は帳簿側で計上済み、または削除済み。補完しない。
        if (h.transactionId) return
        list.push({
          date: h.date,
          amount: h.amount,
          accountTitle,
          category,
          counterparty,
        })
      })
      return
    }

    // 履歴なしの旧データ: 紐付け ID がある場合は取引側が正本（削除済み含む）
    if (record.linkedTransactionId) return
    if (record.status === "UNPAID" || (record.paidAmount ?? 0) === 0 || !record.paidAt) return
    // 同部員・同予定の collection 取引が既にあれば二重計上しない
    const hasMatchingTx = transactions.some(
      (t) =>
        t.type === "collection" &&
        t.collectionMemberId === record.memberId &&
        t.collectionScheduleId === record.scheduleId
    )
    if (hasMatchingTx) return

    list.push({
      date: record.paidAt,
      amount: record.paidAmount ?? 0,
      accountTitle,
      category,
      counterparty,
    })
  })

  return list
}

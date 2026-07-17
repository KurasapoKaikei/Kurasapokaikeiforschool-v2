/**
 * 現金・預金科目の現在残高（現金預金出納帳と同じ集計）
 */

import type { CollectionSchedule, Transaction } from "@/utils/localStorage"

/** 現金・預金出納帳に載せるか（counterparty 一致、または集金設定の入金先口座と一致） */
export function transactionMatchesCashAccount(
  t: Transaction,
  cashName: string,
  scheduleById: Map<string, CollectionSchedule>
): boolean {
  if (t.counterparty === cashName) return true
  if (t.type !== "collection" || !t.collectionScheduleId) return false
  const schedule = scheduleById.get(t.collectionScheduleId)
  const scheduleCash = (schedule?.counterpartyName ?? "").trim()
  return scheduleCash === cashName
}

/** 初期残高 + 当該口座に紐づく仕訳から現在残高を算出 */
export function computeCashAccountCurrentBalance(
  openingBalance: number | null | undefined,
  cashName: string,
  transactions: Transaction[],
  scheduleById: Map<string, CollectionSchedule>
): number {
  let balance =
    typeof openingBalance === "number" && Number.isFinite(openingBalance)
      ? openingBalance
      : 0

  for (const t of transactions) {
    if (!transactionMatchesCashAccount(t, cashName, scheduleById)) continue
    const isIncome = t.type === "income" || t.type === "collection"
    const isExpense =
      t.type === "expense" || t.type === "transfer" || t.type === "deferred"
    if (isIncome) balance += t.amount
    if (isExpense) balance -= t.amount
  }

  return balance
}

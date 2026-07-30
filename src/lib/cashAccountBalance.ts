/**
 * 現金・預金科目の現在残高（現金預金出納帳と同じ集計）
 * - 繰延・計上は常に除外
 * - 繰延・精算は科目・精算区分に応じ、現金影響があるもののみ入金/出金として反映
 */

import type { CollectionSchedule, Transaction } from "@/utils/localStorage"
import {
  getDeferredSettlementCashEffectFromTx,
  isDeferredRecord,
  isDeferredSettlement,
} from "@/lib/deferredAccounting"

/** 現金・預金出納帳に載せるか（counterparty 一致、または集金設定の入金先口座と一致） */
export function transactionMatchesCashAccount(
  t: Transaction,
  cashName: string,
  scheduleById: Map<string, CollectionSchedule>
): boolean {
  if (isDeferredRecord(t)) return false
  if (isDeferredSettlement(t)) {
    // 現金影響のない精算（仮払金・仮受金の当期計上など）は除外
    if (getDeferredSettlementCashEffectFromTx(t) === null) return false
    return t.counterparty === cashName
  }
  if (t.counterparty === cashName) return true
  if (t.type !== "collection" || !t.collectionScheduleId) return false
  const schedule = scheduleById.get(t.collectionScheduleId)
  const scheduleCash = (schedule?.counterpartyName ?? "").trim()
  return scheduleCash === cashName
}

/** 出納帳・残高計算用の入金額・出金額 */
export function getCashLedgerFlowAmounts(t: Transaction): {
  income: number
  expense: number
} {
  if (isDeferredSettlement(t)) {
    const effect = getDeferredSettlementCashEffectFromTx(t)
    if (effect === "income") return { income: t.amount, expense: 0 }
    if (effect === "expense") return { income: 0, expense: t.amount }
    return { income: 0, expense: 0 }
  }
  if (t.type === "income" || t.type === "collection") {
    return { income: t.amount, expense: 0 }
  }
  if (t.type === "expense" || t.type === "transfer") {
    return { income: 0, expense: t.amount }
  }
  return { income: 0, expense: 0 }
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
    const { income, expense } = getCashLedgerFlowAmounts(t)
    balance += income - expense
  }

  return balance
}

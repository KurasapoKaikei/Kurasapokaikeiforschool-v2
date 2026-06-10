import { isTransferLeg, type Transaction } from "@/utils/localStorage"

/** 証憑チェック対象の支出仕訳か（振替片側は除外） */
export function isExpenseRequiringReceipt(t: Transaction): boolean {
  return t.type === "expense" && !isTransferLeg(t)
}

/** 証憑未登録の支出仕訳か */
export function isExpenseMissingReceipt(t: Transaction): boolean {
  return isExpenseRequiringReceipt(t) && !t.receiptUrl
}

export type ClubReceiptStats = {
  totalExpenseEntries: number
  missingReceiptCount: number
}

/** 支出仕訳の証憑未登録件数を集計 */
export function computeClubReceiptStats(
  transactions: Transaction[],
): ClubReceiptStats {
  const expenseEntries = transactions.filter(isExpenseRequiringReceipt)
  const missingReceiptCount = expenseEntries.filter((t) => !t.receiptUrl).length
  return {
    totalExpenseEntries: expenseEntries.length,
    missingReceiptCount,
  }
}

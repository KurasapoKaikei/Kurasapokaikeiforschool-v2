import type { FiscalYearStatus } from "@prisma/client"

/** `SUBMITTED` / `APPROVED` のとき、Transaction / Budget の更新・削除を拒否する前提のロック判定 */
export function isFiscalYearLocked(status: FiscalYearStatus): boolean {
  return status === "SUBMITTED" || status === "APPROVED"
}

export function assertFiscalYearEditableForBudgetAndTransactions(status: FiscalYearStatus): void {
  if (isFiscalYearLocked(status)) {
    const err = new Error("FISCAL_YEAR_LOCKED")
    ;(err as Error & { code?: string }).code = "FISCAL_YEAR_LOCKED"
    throw err
  }
}

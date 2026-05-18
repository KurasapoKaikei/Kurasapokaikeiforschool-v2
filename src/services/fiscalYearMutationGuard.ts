import { FiscalYearStatus } from "@prisma/client"

const LOCKED: ReadonlySet<FiscalYearStatus> = new Set([
  FiscalYearStatus.SUBMITTED,
  FiscalYearStatus.APPROVED,
])

/** 年度が提出済み・承認済みのとき、取引・予算などの変更を拒否するための判定 */
export function isFiscalYearLockedStatus(status: FiscalYearStatus): boolean {
  return LOCKED.has(status)
}

export class FiscalYearLockedError extends Error {
  constructor(message = "この会計年度はロック済みのため、更新・削除できません。") {
    super(message)
    this.name = "FiscalYearLockedError"
  }
}

export function assertFiscalYearUnlockedForMutation(status: FiscalYearStatus): void {
  if (isFiscalYearLockedStatus(status)) {
    throw new FiscalYearLockedError()
  }
}

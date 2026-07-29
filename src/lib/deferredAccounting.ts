/**
 * 繰延（計上・精算）の帳簿反映ルール
 *
 * - 未収入金: 来期入金だが当期収入 → 収入＋／現金無影響／繰延計上＋
 * - 未払金: 来期出金だが当期支出 → 支出＋／現金無影響／繰延計上＋
 * - 預り金: 当期入金だが来期収入 → 収入−／現金無影響／繰延計上＋
 * - 仮払金: 当期出金だが来期支出 → 支出−／現金無影響／繰延計上＋
 */

import type { Transaction } from "@/utils/localStorage"

/** 繰延科目の表示・選択順（正本） */
export const DEFERRED_ACCOUNT_ORDER = [
  "未収入金",
  "未払金",
  "預り金",
  "仮払金",
] as const

export type DeferredAccountName = (typeof DEFERRED_ACCOUNT_ORDER)[number]

export function normalizeDeferredAccountName(name: string): string {
  return name === "仮受金" ? "預り金" : name
}

export function isDeferredRecord(t: Transaction): boolean {
  return t.type === "deferred" && t.counterparty === "record"
}

export function isDeferredSettlement(t: Transaction): boolean {
  return t.type === "deferred" && t.counterparty !== "record"
}

/** 現金預金出納帳・現金残高計算から繰延を除外する */
export function isDeferredTransaction(t: Transaction): boolean {
  return t.type === "deferred"
}

export function parseDeferredMemo(memo: string): {
  sideLabel: string
  category: string
  subject: string
  userMemo: string
} {
  const parts = (memo || "")
    .split(" / ")
    .map((p) => p.trim())
    .filter(Boolean)
  let sideLabel = ""
  let category = ""
  let subject = ""
  const rest: string[] = []
  for (const p of parts) {
    if (p.startsWith("区分:")) {
      sideLabel = p.replace(/^区分:\s*/, "").trim()
    } else if (p.startsWith("カテゴリー:")) {
      category = p.replace(/^カテゴリー:\s*/, "").trim()
    } else if (p.startsWith("科目:")) {
      subject = p.replace(/^科目:\s*/, "").trim()
    } else if (p === "精算" || p === "計上") {
      // skip
    } else {
      rest.push(p)
    }
  }
  return { sideLabel, category, subject, userMemo: rest.join(" / ") }
}

/** 繰延科目が影響する収支側 */
export function getDeferredPlSide(
  deferredAccount: string
): "income" | "expense" | null {
  const name = normalizeDeferredAccountName(deferredAccount)
  if (name === "未収入金" || name === "預り金") return "income"
  if (name === "未払金" || name === "仮払金") return "expense"
  return null
}

/**
 * 科目別台帳・収支集計表用の符号付き金額
 * 預り金・仮払金はマイナス表記（減算）
 */
export function getDeferredPlSignedAmount(
  deferredAccount: string,
  amount: number
): number {
  const name = normalizeDeferredAccountName(deferredAccount)
  if (name === "預り金" || name === "仮払金") return -Math.abs(amount)
  if (name === "未収入金" || name === "未払金") return Math.abs(amount)
  return amount
}

export type DeferredPlAdjustment = {
  transaction: Transaction
  categoryName: string
  subjectName: string
  side: "income" | "expense"
  signedAmount: number
  deferredAccount: string
  userMemo: string
}

/**
 * 計上（record）のみを収支調整として返す。
 * 精算は繰延台帳の残高減算のみ（科目別・収支集計には載せない）。
 */
export function getDeferredRecordPlAdjustment(
  t: Transaction
): DeferredPlAdjustment | null {
  if (!isDeferredRecord(t)) return null
  const deferredAccount = normalizeDeferredAccountName(t.accountTitle)
  const parsed = parseDeferredMemo(t.memo)
  const side =
    t.deferredPlSide === "income" || t.deferredPlSide === "expense"
      ? t.deferredPlSide
      : getDeferredPlSide(deferredAccount)
  if (!side) return null
  const subjectName = (t.deferredPlSubject ?? parsed.subject).trim()
  const categoryName = (t.deferredPlCategory ?? parsed.category).trim()
  if (!subjectName) return null
  return {
    transaction: t,
    categoryName,
    subjectName,
    side,
    signedAmount: getDeferredPlSignedAmount(deferredAccount, t.amount),
    deferredAccount,
    userMemo: parsed.userMemo,
  }
}

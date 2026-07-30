/**
 * 繰延（計上・精算）の帳簿反映ルール（正本）
 *
 * ■ 未収入金（入出金は来期／当期の収入）
 *   計上: 科目別・収支＝収入＋／現金＝除外／繰延台帳＝計上額＋
 *   精算: 現金科目必須／科目別・収支＝除外／現金＝入金／繰延台帳＝精算額・日付
 *
 * ■ 未払金（入出金は来期／当期の支出）
 *   計上: 科目別・収支＝支出＋／現金＝除外／繰延台帳＝計上額＋
 *   精算: 現金科目必須／科目別・収支＝除外／現金＝出金／繰延台帳＝精算額・日付
 *
 * ■ 仮受金（入出金は当期／来期の収入）
 *   計上: 科目別・収支＝収入−／現金＝除外／繰延台帳＝計上額＋
 *   精算「当期に計上」: 現金なし／科目別・収支＝除外／現金＝除外／繰延台帳＝精算額・日付
 *   精算「返金」: 現金科目必須／科目別・収支＝除外／現金＝出金／繰延台帳＝精算額・日付
 *
 * ■ 仮払金（入出金は当期／来期の支出）
 *   計上: 科目別・収支＝支出−／現金＝除外／繰延台帳＝計上額＋
 *   精算: 現金なし／科目別・収支＝除外／現金＝除外／繰延台帳＝精算額・日付
 */

import type { Transaction } from "@/utils/localStorage"

/** 繰延科目の表示・選択順（正本） */
export const DEFERRED_ACCOUNT_ORDER = [
  "未収入金",
  "未払金",
  "仮受金",
  "仮払金",
] as const

export type DeferredAccountName = (typeof DEFERRED_ACCOUNT_ORDER)[number]

/** 現金を伴わない精算の counterparty 値 */
export const DEFERRED_SETTLEMENT_NON_CASH = "settlement"

/** 仮受金の精算区分 */
export type DeferredKaruukeSettlementMode = "period" | "refund"

/** 旧称「預り金」で保存された仕訳を「仮受金」に正規化する */
export function normalizeDeferredAccountName(name: string): string {
  return name === "預り金" ? "仮受金" : name
}

export function isDeferredRecord(t: Transaction): boolean {
  return t.type === "deferred" && t.counterparty === "record"
}

export function isDeferredSettlement(t: Transaction): boolean {
  return t.type === "deferred" && t.counterparty !== "record"
}

/** @deprecated 新規は isDeferredRecord / isDeferredSettlement を使う */
export function isDeferredTransaction(t: Transaction): boolean {
  return t.type === "deferred"
}

/**
 * 精算が現金預金出納帳に載るか、および入金/出金の別。
 * null = 現金影響なし（出納帳・残高から除外）
 */
export function getDeferredSettlementCashEffect(
  deferredAccount: string,
  karuukeMode?: DeferredKaruukeSettlementMode | null
): "income" | "expense" | null {
  const name = normalizeDeferredAccountName(deferredAccount)
  if (name === "未収入金") return "income"
  if (name === "未払金") return "expense"
  if (name === "仮払金") return null
  if (name === "仮受金") {
    if (karuukeMode === "refund") return "expense"
    // 「当期に計上」または未選択 → 現金影響なし
    return null
  }
  return null
}

/** 仕訳から精算の現金影響を判定（旧データ互換あり） */
export function getDeferredSettlementCashEffectFromTx(
  t: Transaction
): "income" | "expense" | null {
  if (!isDeferredSettlement(t)) return null
  const name = normalizeDeferredAccountName(t.accountTitle)
  if (name === "未収入金") return "income"
  if (name === "未払金") return "expense"
  if (name === "仮払金") return null
  if (name === "仮受金") {
    if (t.deferredSettlementMode === "period") return null
    if (t.deferredSettlementMode === "refund") return "expense"
    // 旧データ（mode なし・現金科目入り）は返金相当として出金扱い
    if (
      t.counterparty &&
      t.counterparty !== DEFERRED_SETTLEMENT_NON_CASH &&
      t.counterparty !== "record"
    ) {
      return "expense"
    }
    return null
  }
  return null
}

/** 精算UIで現金・預金科目の選択が必要か */
export function settlementRequiresCashAccount(
  deferredAccount: string,
  karuukeMode?: DeferredKaruukeSettlementMode | "" | null
): boolean {
  return (
    getDeferredSettlementCashEffect(
      deferredAccount,
      karuukeMode === "period" || karuukeMode === "refund" ? karuukeMode : null
    ) !== null
  )
}

/** @deprecated getDeferredSettlementCashEffect を使用 */
export function isDeferredSettlementCashIn(deferredAccount: string): boolean {
  return getDeferredSettlementCashEffect(deferredAccount) === "income"
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
    } else if (
      p === "精算" ||
      p === "計上" ||
      p === "当期に計上" ||
      p === "返金"
    ) {
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
  if (name === "未収入金" || name === "仮受金") return "income"
  if (name === "未払金" || name === "仮払金") return "expense"
  return null
}

/**
 * 科目別台帳・収支集計表用の符号付き金額（計上のみ）
 * - 未収入金: 収入＋
 * - 未払金: 支出＋
 * - 仮受金: 収入−
 * - 仮払金: 支出−
 */
export function getDeferredPlSignedAmount(
  deferredAccount: string,
  amount: number
): number {
  const name = normalizeDeferredAccountName(deferredAccount)
  if (name === "仮受金" || name === "仮払金") return -Math.abs(amount)
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
 * 計上仕訳に紐づく精算合計額
 */
export function getDeferredSettledAmountForRecord(
  recordId: string,
  transactions: Transaction[]
): number {
  if (!recordId) return 0
  return transactions.reduce((sum, t) => {
    if (!isDeferredSettlement(t)) return sum
    if ((t.deferredRecordId ?? "").trim() !== recordId) return sum
    return sum + (Number.isFinite(t.amount) ? Math.abs(t.amount) : 0)
  }, 0)
}

/** 計上仕訳が精算済みか（精算合計 ≥ 計上額） */
export function isDeferredRecordFullySettled(
  record: Transaction,
  transactions: Transaction[]
): boolean {
  if (!isDeferredRecord(record)) return false
  const settled = getDeferredSettledAmountForRecord(record.id, transactions)
  return settled >= Math.abs(record.amount) - 1e-9
}

/**
 * 計上（record）のみを収支調整として返す。
 * 精算は科目別台帳・収支集計表には載せない。
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

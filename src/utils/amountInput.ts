/**
 * 符号付き金額のフォーム入力（単式簿記の返金・取り消し用）
 * カンマ区切りは表示のみ。状態は数字と先頭の「-」のみを保持する想定。
 */

export function formatAmountInputDisplay(raw: string): string {
  const s = raw.replace(/,/g, "")
  if (s === "" || s === "-") return s
  const n = Number(s)
  if (!Number.isFinite(n)) return raw
  return n.toLocaleString()
}

/** カンマを除いた文字列が、入力途中を含めて許容されるか */
export function isAllowedSignedIntegerTyping(rawNoCommas: string): boolean {
  return rawNoCommas === "" || /^-?\d*$/.test(rawNoCommas)
}

/** 送信時にパース。空・「-」のみは NaN */
export function parseSubmitAmount(raw: string): number {
  const s = raw.replace(/,/g, "").trim()
  if (s === "" || s === "-") return Number.NaN
  const n = Number(s)
  return Number.isFinite(n) ? Math.trunc(n) : Number.NaN
}

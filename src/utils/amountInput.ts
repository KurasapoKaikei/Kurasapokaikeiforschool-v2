/**
 * 符号付き金額のフォーム入力（単式簿記の返金・取り消し用）
 * カンマ区切りと負数の「△」は表示のみ。内部状態は数字と先頭の「-」のみを保持する。
 */

/** 表示・入力値を内部保持用に正規化（カンマ除去、△→-） */
export function normalizeAmountInputRaw(value: string): string {
  return value.replace(/,/g, "").replace(/△/g, "-")
}

export function formatAmountInputDisplay(raw: string): string {
  const s = normalizeAmountInputRaw(raw)
  if (s === "") return ""
  if (s === "-") return "△"
  const n = Number(s)
  if (!Number.isFinite(n)) return raw
  if (n < 0) return `△${Math.abs(n).toLocaleString("ja-JP")}`
  return n.toLocaleString("ja-JP")
}

/** カンマ／△ を除いた文字列が、入力途中を含めて許容されるか */
export function isAllowedSignedIntegerTyping(rawNoCommas: string): boolean {
  const s = normalizeAmountInputRaw(rawNoCommas)
  return s === "" || /^-?\d*$/.test(s)
}

/** 送信時にパース。空・「-」／「△」のみは NaN */
export function parseSubmitAmount(raw: string): number {
  const s = normalizeAmountInputRaw(raw).trim()
  if (s === "" || s === "-") return Number.NaN
  const n = Number(s)
  return Number.isFinite(n) ? Math.trunc(n) : Number.NaN
}

/**
 * 会計金額の表示用フォーマット。
 * 負数は会計慣行に合わせ「△」表記（ハイフンマイナスは使わない）。
 */

export type FormatAmountDisplayOptions = {
  /** true のとき 0 を "-" で返す（集計表の空欄相当） */
  zeroAsDash?: boolean
}

/** 数値をカンマ区切り文字列にする。負数は `△1,234` */
export function formatAmountDisplay(
  n: number,
  options?: FormatAmountDisplayOptions
): string {
  if (!Number.isFinite(n)) return "—"
  if (options?.zeroAsDash && n === 0) return "-"
  if (n < 0) return `△${Math.abs(n).toLocaleString("ja-JP")}`
  return n.toLocaleString("ja-JP")
}

/** `¥` 付き。負数は `△¥1,234` */
export function formatYenDisplay(n: number): string {
  if (!Number.isFinite(n)) return "—"
  if (n < 0) return `△¥${Math.abs(n).toLocaleString("ja-JP")}`
  return `¥${n.toLocaleString("ja-JP")}`
}

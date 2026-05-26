/** 氏名フリガナ：全角カタカナ入力 */

/** 全角カタカナ・長音・中黒・スペース（半角/全角）のみ許可 */
export const KATAKANA_ALLOWED_PATTERN = /^[ァ-ヶー・\u3000\s]*$/

export const KATAKANA_INPUT_ERROR = "全角カタカナで入力してください"

/** 許可文字以外を除去（リアルタイム入力用） */
export function filterToKatakana(input: string): string {
  return input.replace(/[^ァ-ヶー・\u3000\s]/g, "")
}

/** 必須チェックは別途。値がある場合の形式チェック */
export function isValidKatakanaInput(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (!KATAKANA_ALLOWED_PATTERN.test(trimmed)) return false
  return /[ァ-ヶ]/.test(trimmed)
}

/** 新規申込：管理者パスワード強度チェック */

export const ADMIN_PASSWORD_STRENGTH_ERROR =
  "パスワードは英大文字・小文字・数字・記号をそれぞれ1文字以上含み、8文字以上で入力してください"

export const ADMIN_PASSWORD_MISMATCH_ERROR = "パスワードが一致しません"

const HAS_UPPER = /[A-Z]/
const HAS_LOWER = /[a-z]/
const HAS_DIGIT = /\d/
/** 一般的な記号（ハイフンはクラス末尾でリテラル扱い） */
const HAS_SYMBOL =
  /[!@#$%^&*()_=+[\]{}|;:',.<>?/`~\-]/

/** 8文字以上・英大文字・小文字・数字・記号を各1文字以上 */
export function isValidAdminPassword(password: string): boolean {
  if (password.length < 8) return false
  if (!HAS_UPPER.test(password)) return false
  if (!HAS_LOWER.test(password)) return false
  if (!HAS_DIGIT.test(password)) return false
  if (!HAS_SYMBOL.test(password)) return false
  return true
}

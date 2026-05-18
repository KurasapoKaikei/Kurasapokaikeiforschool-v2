/**
 * マスタ名称（科目名・カテゴリー名 等）の重複判定用の正規化ユーティリティ。
 *
 * v2.9 §6.6「名称重複禁止」整合性チェックで参照される。
 *
 * 正規化ルール:
 *   1. `String.prototype.normalize("NFKC")` で Unicode 互換等価変換
 *      - 全角英数 → 半角英数
 *      - 半角カナ → 全角カナ
 *      - 互換漢字 → 標準漢字
 *      - その他 NFKC 規格で同一とみなされる文字を統一
 *   2. `toLowerCase()` で大文字・小文字を統一
 *   3. `trim()` で前後空白を除去
 *
 * 中間の連続空白は意味のある区切りと解釈する余地があるため、本ユーティリティでは
 * 圧縮しない（必要になればプロジェクト方針として別途追加する）。
 */
export const normalizeNameForCompare = (raw: string): string => {
  if (!raw) return ""
  return raw.normalize("NFKC").trim().toLowerCase()
}

/**
 * 与えた候補名が、既存名称リストのいずれかと「実質的に同じ」かを判定する。
 *
 * @param candidate 入力された候補名（生文字列・未トリミングで可）
 * @param existingNames 既存の名称配列
 * @param excludeName 自身の旧名（編集時に自分自身を重複判定から除外するため）
 */
export const isDuplicateName = (
  candidate: string,
  existingNames: string[],
  excludeName?: string
): boolean => {
  const normalized = normalizeNameForCompare(candidate)
  if (!normalized) return false
  const excludeNormalized = excludeName ? normalizeNameForCompare(excludeName) : null
  return existingNames.some((n) => {
    const cur = normalizeNameForCompare(n)
    if (!cur) return false
    if (excludeNormalized !== null && cur === excludeNormalized) return false
    return cur === normalized
  })
}

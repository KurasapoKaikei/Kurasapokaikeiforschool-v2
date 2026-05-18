/**
 * 入出金CSV取込テンプレート（レイアウト）
 * - 1行目 A1: 現金・預金科目名（B〜D は空）
 * - 2行目: 日付, 入金額, 出金額, メモ
 * - 3行目以降: データ（テンプレートでは空行のみ）
 */

/** 2行目の見出し（A2〜D2） */
export const BANK_IMPORT_HEADER_ROW = ["日付", "入金額", "出金額", "メモ"] as const

function normalizeHeaderToken(s: string): string {
  return s.replace(/^\uFEFF/, "").trim().replace(/\s/g, "")
}

export function bankImportHeaderRowMatch(headerCells: string[]): boolean {
  const exp = [...BANK_IMPORT_HEADER_ROW]
  if (headerCells.length < exp.length) return false
  return exp.every((h, i) => normalizeHeaderToken(headerCells[i] ?? "") === normalizeHeaderToken(h))
}

/** RFC 4180 風：カンマ・改行・ダブルクォートを含む場合はクォートで囲む */
function formatCsvCell(v: string): string {
  const s = v ?? ""
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * UTF-8 BOM は呼び出し側（createUtf8CsvBlob）で付与する想定の本文
 * @param defaultAccountName 登録済み現金・預金名の先頭など。未登録時は空文字で A1 空欄
 */
export function buildBankImportTemplateCsvBody(defaultAccountName: string): string {
  const a1 = (defaultAccountName ?? "").trim()
  const row1 = a1 ? `${formatCsvCell(a1)},,,` : `,,,`
  const row2 = [...BANK_IMPORT_HEADER_ROW].join(",")
  return `${row1}\r\n${row2}\r\n`
}

/** 旧コード互換エイリアス（5列版から移行済みのため、現在は4列見出し定数を指す） */
export const BANK_IMPORT_HEADERS = BANK_IMPORT_HEADER_ROW

import { getCsvImportBatches, type Transaction } from "@/utils/localStorage"

/** 編集画面から「キャンセル／保存後」に戻る先を渡すクエリ名 */
export const REGISTER_EDIT_RETURN_QUERY = "returnTo"

const DEFAULT_REGISTER_BACK = "/accounting/register/history"

/**
 * オープンリダイレクト防止のため、同一アプリ内の相対パスのみ許可する。
 */
export function sanitizeReturnTo(raw: string | null | undefined): string | null {
  if (raw == null || raw === "") return null
  const s = raw.trim()
  if (!s.startsWith("/")) return null
  if (s.startsWith("//")) return null
  if (/^[\/\\]{2,}/.test(s)) return null
  return s
}

export function withReturnTo(path: string, returnTo: string | null | undefined): string {
  const safe = sanitizeReturnTo(returnTo ?? null)
  if (!safe) return path
  const sep = path.includes("?") ? "&" : "?"
  return `${path}${sep}${REGISTER_EDIT_RETURN_QUERY}=${encodeURIComponent(safe)}`
}

/** `returnTo` クエリから戻り先を決定（不正時は登録履歴） */
export function resolveRegisterEditBackHref(param: string | null): string {
  return sanitizeReturnTo(param) ?? DEFAULT_REGISTER_BACK
}

function resolveCsvImportBatchId(
  t: Pick<Transaction, "id" | "csvImportId" | "originalFileName">
): string | null {
  const direct = t.csvImportId?.trim()
  if (direct) return direct

  if (typeof window === "undefined") return null

  const batches = getCsvImportBatches()
  const byMember = batches.find((b) => b.transactionIds.includes(t.id))
  if (byMember) return byMember.id

  const name = t.originalFileName?.trim()
  if (!name) return null
  const byFileName = batches.find((b) => b.fileName.trim() === name)
  return byFileName?.id ?? null
}

export function isCsvLinkedTransaction(
  t: Pick<Transaction, "id" | "csvImportId" | "originalFileName">
): boolean {
  return resolveCsvImportBatchId(t) != null
}

/**
 * 仕訳の編集（鉛筆）からの遷移先 URL。
 * `returnTo` には現在の pathname + search（例: 帳簿のフィルタ付きURL）を渡す。
 */
export function getEditUrl(
  t: Pick<Transaction, "id" | "csvImportId" | "originalFileName">,
  returnTo?: string | null
): string {
  const batchId = resolveCsvImportBatchId(t)
  const base =
    batchId != null
      ? `/accounting/register/csv/${batchId}`
      : `/accounting/register/edit/${t.id}`
  return withReturnTo(base, returnTo)
}

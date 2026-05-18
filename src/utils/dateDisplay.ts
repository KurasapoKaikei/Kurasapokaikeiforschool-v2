/**
 * 画面表示用の取引日（YYYY-MM-DD → YYYY/MM/DD）。
 * 保存値は ISO / ハイフン区切りのまま、描画時のみスラッシュに統一する。
 */
export function formatDateDisplay(dateStr: string): string {
  const trimmed = (dateStr || "").trim()
  if (!trimmed) return ""
  const datePart = trimmed.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart.replace(/-/g, "/")
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(datePart)) return datePart
  return datePart.replace(/-/g, "/")
}

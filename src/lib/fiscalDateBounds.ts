/**
 * ヘッダー選択の会計年度に基づく登録可能日付の範囲（4/1〜翌3/31）
 */

import {
  DEFAULT_PORTAL_FISCAL_YEAR,
  type PortalFiscalYearLabel,
} from "@/lib/portalBrand"
import {
  getFiscalYearDateRange,
  isDateInFiscalYear,
  parsePortalFiscalYearLabel,
} from "@/lib/schoolCategoryUsage"

export type FiscalDateBounds = {
  fiscalYear: number
  minDate: string
  maxDate: string
}

export function resolveFiscalDateBounds(
  selectedYear?: PortalFiscalYearLabel | string | null
): FiscalDateBounds {
  const fiscalYear = parsePortalFiscalYearLabel(
    selectedYear ?? DEFAULT_PORTAL_FISCAL_YEAR
  )
  const { start, end } = getFiscalYearDateRange(fiscalYear)
  return { fiscalYear, minDate: start, maxDate: end }
}

/** 期間外なら期首／期末へ丸める */
export function clampDateToFiscalBounds(
  dateStr: string,
  bounds: Pick<FiscalDateBounds, "minDate" | "maxDate">
): string {
  const d = String(dateStr ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return bounds.minDate
  if (d < bounds.minDate) return bounds.minDate
  if (d > bounds.maxDate) return bounds.maxDate
  return d
}

export function isDateWithinFiscalBounds(
  dateStr: string,
  bounds: Pick<FiscalDateBounds, "fiscalYear">
): boolean {
  return isDateInFiscalYear(dateStr, bounds.fiscalYear)
}

/** ユーザー向けメッセージ（YYYY/MM/DD） */
export function formatFiscalBoundsMessage(
  bounds: Pick<FiscalDateBounds, "minDate" | "maxDate">
): string {
  const fmt = (s: string) => s.replace(/-/g, "/")
  return `日付は会計期間（${fmt(bounds.minDate)}〜${fmt(bounds.maxDate)}）の範囲内で入力してください`
}

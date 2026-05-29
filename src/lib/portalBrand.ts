import { CLUB_BRAND_PINK } from "@/lib/schoolTheme"

/** ポータル統一ヘッダー用ブランドカラー（UI統一仕様） */
export const PORTAL_BRAND = {
  school: "#001e43",
  /** サイドメニュー「ポータルトップ」等と同一（#E66A84） */
  club: CLUB_BRAND_PINK,
  audit: "#ff9800",
} as const

export type PortalKind = keyof typeof PORTAL_BRAND

export const PORTAL_FISCAL_YEARS = ["2024年度", "2025年度", "2026年度"] as const

export type PortalFiscalYearLabel = (typeof PORTAL_FISCAL_YEARS)[number]

export const DEFAULT_PORTAL_FISCAL_YEAR: PortalFiscalYearLabel = "2026年度"

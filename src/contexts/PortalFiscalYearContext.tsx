"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  DEFAULT_PORTAL_FISCAL_YEAR,
  PORTAL_FISCAL_YEARS,
  type PortalFiscalYearLabel,
} from "@/lib/portalBrand"

type PortalFiscalYearContextValue = {
  selectedYear: PortalFiscalYearLabel
  setSelectedYear: (year: PortalFiscalYearLabel) => void
  fiscalYears: readonly PortalFiscalYearLabel[]
}

const PortalFiscalYearContext = createContext<PortalFiscalYearContextValue | null>(
  null
)

export function PortalFiscalYearProvider({ children }: { children: ReactNode }) {
  const [selectedYear, setSelectedYearState] = useState<PortalFiscalYearLabel>(
    DEFAULT_PORTAL_FISCAL_YEAR
  )

  const setSelectedYear = useCallback((year: PortalFiscalYearLabel) => {
    setSelectedYearState(year)
  }, [])

  const value = useMemo(
    () => ({
      selectedYear,
      setSelectedYear,
      fiscalYears: PORTAL_FISCAL_YEARS,
    }),
    [selectedYear, setSelectedYear]
  )

  return (
    <PortalFiscalYearContext.Provider value={value}>
      {children}
    </PortalFiscalYearContext.Provider>
  )
}

export function usePortalFiscalYear(): PortalFiscalYearContextValue {
  const ctx = useContext(PortalFiscalYearContext)
  if (!ctx) {
    throw new Error("usePortalFiscalYear must be used within PortalFiscalYearProvider")
  }
  return ctx
}

/** ヘッダー外のページ用（プロバイダ未設定時はローカル相当のフォールバック） */
export function usePortalFiscalYearOptional(): PortalFiscalYearContextValue | null {
  return useContext(PortalFiscalYearContext)
}

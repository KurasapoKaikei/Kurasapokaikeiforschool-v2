/**
 * ポータル共通ヘッダー表示用（契約状況画面と同じ解決順で学校名を取得）
 */

import { resolveActiveSchoolContract } from "@/lib/currentSchool"
import { contractInfoToDisplay } from "@/lib/schoolContractInfo"
import { SCHOOL_DISPLAY_NAME, SCHOOL_FISCAL_PERIOD } from "@/lib/schoolTheme"

export type SchoolHeaderDisplay = {
  schoolName: string
  fiscalPeriod: string
}

/** セッション学校ID → active_schools → contract_info → current_school → デモ固定 */
export function getSchoolHeaderDisplay(): SchoolHeaderDisplay {
  const resolved = resolveActiveSchoolContract()
  if (resolved) {
    const d = contractInfoToDisplay(resolved)
    return { schoolName: d.schoolName, fiscalPeriod: d.fiscalPeriod }
  }

  return {
    schoolName: SCHOOL_DISPLAY_NAME,
    fiscalPeriod: SCHOOL_FISCAL_PERIOD,
  }
}

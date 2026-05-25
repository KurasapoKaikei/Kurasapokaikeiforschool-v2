/**
 * ポータル共通ヘッダー表示用（契約状況画面と同じ解決順で学校名を取得）
 */

import {
  loadCurrentSchool,
  resolveSchoolContractForLogin,
} from "@/lib/currentSchool"
import {
  contractInfoToDisplay,
  loadContractInfo,
} from "@/lib/schoolContractInfo"
import { getSchoolAdminSession } from "@/lib/schoolLoginSession"
import { SCHOOL_DISPLAY_NAME, SCHOOL_FISCAL_PERIOD } from "@/lib/schoolTheme"

export type SchoolHeaderDisplay = {
  schoolName: string
  fiscalPeriod: string
}

/** current_school → セッションの学校ID → contract_info → デモ固定 */
export function getSchoolHeaderDisplay(): SchoolHeaderDisplay {
  const current = loadCurrentSchool()
  if (current?.schoolName) {
    return {
      schoolName: current.schoolName,
      fiscalPeriod: current.fiscalPeriod,
    }
  }

  const session = getSchoolAdminSession()
  if (session?.loginId) {
    const resolved = resolveSchoolContractForLogin(session.loginId)
    if (resolved) {
      const d = contractInfoToDisplay(resolved)
      return { schoolName: d.schoolName, fiscalPeriod: d.fiscalPeriod }
    }
  }

  const saved = loadContractInfo()
  if (saved) {
    const d = contractInfoToDisplay(saved)
    return { schoolName: d.schoolName, fiscalPeriod: d.fiscalPeriod }
  }

  return {
    schoolName: SCHOOL_DISPLAY_NAME,
    fiscalPeriod: SCHOOL_FISCAL_PERIOD,
  }
}

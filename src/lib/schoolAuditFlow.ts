/** @deprecated 学校マスタの useAuditFlow を参照（schoolMasters.ts） */

import {
  loadCurrentSchoolUseAuditFlow,
  loadSchoolUseAuditFlowForSchool,
  SCHOOL_MASTER_CHANGED_EVENT,
} from "@/lib/schoolMasters"

/** 旧キー（移行用・読み取りのみ） */
export const SCHOOL_USE_AUDIT_FLOW_KEY = "school_use_audit_flow"

export const SCHOOL_AUDIT_FLOW_CHANGED_EVENT = SCHOOL_MASTER_CHANGED_EVENT

/** ログイン中学校の監査フロー可否 */
export function loadSchoolUseAuditFlow(): boolean {
  if (typeof window === "undefined") return true
  try {
    migrateLegacyCheckboxFlag()
    return loadCurrentSchoolUseAuditFlow()
  } catch {
    return true
  }
}

function migrateLegacyCheckboxFlag(): void {
  if (typeof window === "undefined") return
  const legacy = localStorage.getItem(SCHOOL_USE_AUDIT_FLOW_KEY)
  if (legacy === null) return
  localStorage.removeItem(SCHOOL_USE_AUDIT_FLOW_KEY)
}

/** 画面チェックボックスは廃止（no-op） */
export function saveSchoolUseAuditFlow(_enabled: boolean): void {
  /* プランは学校マスタで管理 */
}

export { loadSchoolUseAuditFlowForSchool }

/** 学校ポータル：監査フロー運用フラグ */

export const SCHOOL_USE_AUDIT_FLOW_KEY = "school_use_audit_flow"

export const SCHOOL_AUDIT_FLOW_CHANGED_EVENT =
  "kurasaokaikei-school-audit-flow-changed"

function dispatchChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SCHOOL_AUDIT_FLOW_CHANGED_EVENT))
}

/** デフォルト true（利用する） */
export function loadSchoolUseAuditFlow(): boolean {
  if (typeof window === "undefined") return true
  try {
    const raw = localStorage.getItem(SCHOOL_USE_AUDIT_FLOW_KEY)
    if (raw === null) return true
    if (raw === "true") return true
    if (raw === "false") return false
    const parsed = JSON.parse(raw) as unknown
    return parsed !== false
  } catch {
    return true
  }
}

export function saveSchoolUseAuditFlow(enabled: boolean): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(SCHOOL_USE_AUDIT_FLOW_KEY, JSON.stringify(enabled))
    dispatchChanged()
  } catch {
    /* ignore */
  }
}

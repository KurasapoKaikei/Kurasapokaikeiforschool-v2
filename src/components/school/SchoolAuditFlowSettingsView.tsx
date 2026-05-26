"use client"

import { useCallback, useEffect, useState } from "react"
import { SchoolContentPanel } from "@/components/layout/school/SchoolContentPanel"
import {
  loadSchoolUseAuditFlow,
  saveSchoolUseAuditFlow,
  SCHOOL_AUDIT_FLOW_CHANGED_EVENT,
} from "@/lib/schoolAuditFlow"

/** 設定：監査フロー運用 ON/OFF */
export function SchoolAuditFlowSettingsView() {
  const [enabled, setEnabled] = useState(true)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(() => {
    setEnabled(loadSchoolUseAuditFlow())
    setLoaded(true)
  }, [])

  useEffect(() => {
    refresh()
    const onChange = () => refresh()
    window.addEventListener(SCHOOL_AUDIT_FLOW_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(SCHOOL_AUDIT_FLOW_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [refresh])

  const handleToggle = (checked: boolean) => {
    setEnabled(checked)
    saveSchoolUseAuditFlow(checked)
  }

  return (
    <SchoolContentPanel
      title="監査運用設定"
      description="監査フローの有効化と、監査人管理メニューの表示を制御します"
    >
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-[#FAFAF9] px-4 py-4">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-700 focus:ring-indigo-600"
          checked={enabled}
          disabled={!loaded}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        <span className="text-sm leading-relaxed text-[#374151]">
          監査フローを利用する（チェックを入れると監査担当者の登録やクラブへの割り当てが可能になります）
        </span>
      </label>
      <p className="mt-4 text-xs text-[#6B7280]">
        チェックを外すと、サイドメニューの「監査人管理」は非表示になります。登録済みの監査人データは保持されます。
      </p>
    </SchoolContentPanel>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import { SchoolContentPanel } from "@/components/layout/school/SchoolContentPanel"
import {
  loadCurrentSchool,
  SCHOOL_SESSION_CHANGED_EVENT,
} from "@/lib/currentSchool"
import {
  DEMO_SCHOOL_MASTER_ID,
  getSchoolMaster,
  SCHOOL_MASTER_CHANGED_EVENT,
} from "@/lib/schoolMasters"

/** 設定：監査フロー運用（学校マスタ参照・画面からは変更不可） */
export function SchoolAuditFlowSettingsView() {
  const [schoolName, setSchoolName] = useState("—")
  const [schoolId, setSchoolId] = useState("—")
  const [useAuditFlow, setUseAuditFlow] = useState(true)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(() => {
    const current = loadCurrentSchool()
    const masterId =
      current?.schoolId?.trim() ||
      current?.contract?.schoolId?.trim() ||
      DEMO_SCHOOL_MASTER_ID
    const master = getSchoolMaster(masterId)
    setSchoolId(masterId)
    setSchoolName(master?.schoolName ?? current?.schoolName ?? "—")
    setUseAuditFlow(
      current?.useAuditFlow ?? master?.useAuditFlow ?? false
    )
    setLoaded(true)
  }, [])

  useEffect(() => {
    refresh()
    const onChange = () => refresh()
    window.addEventListener(SCHOOL_MASTER_CHANGED_EVENT, onChange)
    window.addEventListener(SCHOOL_SESSION_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(SCHOOL_MASTER_CHANGED_EVENT, onChange)
      window.removeEventListener(SCHOOL_SESSION_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [refresh])

  return (
    <SchoolContentPanel
      title="監査運用設定"
      description="監査フローの有効化はログイン学校のプラン設定（学校マスタ）で管理されます"
    >
      <dl className="space-y-4 rounded-lg border border-gray-200 bg-[#FAFAF9] px-4 py-4 text-sm">
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          <dt className="font-medium text-[#6B7280]">学校名</dt>
          <dd className="text-[#374151]">{loaded ? schoolName : "読み込み中…"}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          <dt className="font-medium text-[#6B7280]">学校ID</dt>
          <dd className="tabular-nums text-[#374151]">
            {loaded ? schoolId : "—"}
          </dd>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <dt className="font-medium text-[#6B7280]">監査フロー</dt>
          <dd>
            <span
              className={
                useAuditFlow
                  ? "inline-flex rounded bg-[#D1FAE5] px-2 py-0.5 text-xs font-semibold text-[#047857]"
                  : "inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold text-[#6B7280]"
              }
            >
              {useAuditFlow ? "利用する（useAuditFlow: true）" : "利用しない"}
            </span>
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-[#6B7280]">
        デモのクラサポ大学（{DEMO_SCHOOL_MASTER_ID}）は監査ありプランです。監査なしの学校アカウントでは、サイドメニューの「監査人管理」等が自動的に非表示になります。画面上のチェックボックスでの切替は行いません。
      </p>
    </SchoolContentPanel>
  )
}

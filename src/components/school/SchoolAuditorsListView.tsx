"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import {
  loadSchoolUseAuditFlow,
  SCHOOL_AUDIT_FLOW_CHANGED_EVENT,
} from "@/lib/schoolAuditFlow"
import { SCHOOL_PAGE_TITLES, SCHOOL_ROUTES } from "@/lib/schoolTheme"
import { SchoolAuditorsListSection } from "@/components/school/SchoolAuditorsListSection"
import type { SchoolAuditor } from "@/lib/schoolAuditors"

/** 監査人一覧（監査人管理 > 監査人一覧） */
export function SchoolAuditorsListView() {
  const router = useRouter()
  const [auditFlowEnabled, setAuditFlowEnabled] = useState(true)
  const [listRefreshKey, setListRefreshKey] = useState(0)

  const refreshAuditFlag = useCallback(() => {
    try {
      setAuditFlowEnabled(loadSchoolUseAuditFlow())
    } catch {
      setAuditFlowEnabled(true)
    }
  }, [])

  useEffect(() => {
    refreshAuditFlag()
    const onChange = () => refreshAuditFlag()
    window.addEventListener(SCHOOL_AUDIT_FLOW_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(SCHOOL_AUDIT_FLOW_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [refreshAuditFlag])

  const handleEdit = (auditor: SchoolAuditor) => {
    router.push(
      `${SCHOOL_ROUTES.auditorsRegister}?edit=${encodeURIComponent(auditor.id)}`
    )
  }

  if (!auditFlowEnabled) {
    return (
      <div className="min-h-full w-full bg-[#F5F5F0] px-6 py-8">
        <div className="max-w-3xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-[#374151]">
            監査フローが無効のため、監査人管理は利用できません。
          </p>
          <Link
            href={SCHOOL_ROUTES.settingsAuditFlow}
            className="mt-3 inline-block text-sm font-medium text-[#4A90E2] hover:underline"
          >
            監査運用設定を開く
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full w-full bg-[#F5F5F0] px-6 py-8">
      <div className="w-full max-w-none">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-[#374151]">
            {SCHOOL_PAGE_TITLES.auditors}
          </h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            学内の監査人アカウント一覧と、各監査人の担当クラブ紐付け状況を俯瞰できます
          </p>
        </div>
        <SchoolAuditorsListSection
          onEdit={handleEdit}
          listRefreshKey={listRefreshKey}
          onDeleted={() => setListRefreshKey((k) => k + 1)}
        />
      </div>
    </div>
  )
}

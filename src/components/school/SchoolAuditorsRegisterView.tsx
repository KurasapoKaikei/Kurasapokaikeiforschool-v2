"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import {
  loadSchoolUseAuditFlow,
  SCHOOL_AUDIT_FLOW_CHANGED_EVENT,
} from "@/lib/schoolAuditFlow"
import { getSchoolAuditorById } from "@/lib/schoolAuditors"
import { SCHOOL_ROUTES } from "@/lib/schoolTheme"
import { SchoolAuditorsRegisterSection } from "@/components/school/SchoolAuditorsRegisterSection"
import type { SchoolAuditor } from "@/lib/schoolAuditors"

/** 監査人登録（監査人管理 > 監査人登録） */
export function SchoolAuditorsRegisterView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")?.trim() ?? null
  const [auditFlowEnabled, setAuditFlowEnabled] = useState(true)
  const [editingAuditor, setEditingAuditor] = useState<SchoolAuditor | null>(null)
  const [formResetKey, setFormResetKey] = useState(0)

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

  useEffect(() => {
    if (!editId) {
      setEditingAuditor(null)
      return
    }
    setEditingAuditor(getSchoolAuditorById(editId))
  }, [editId, formResetKey])

  const handleSaved = () => {
    setEditingAuditor(null)
    setFormResetKey((k) => k + 1)
    if (editId) {
      router.replace(SCHOOL_ROUTES.auditorsRegister, { scroll: false })
    }
  }

  const handleCancelEdit = () => {
    setEditingAuditor(null)
    setFormResetKey((k) => k + 1)
    router.push(SCHOOL_ROUTES.auditorsRegister)
  }

  const handleEditFromList = useCallback(
    (auditor: SchoolAuditor) => {
      setEditingAuditor(auditor)
      router.replace(
        `${SCHOOL_ROUTES.auditorsRegister}?edit=${encodeURIComponent(auditor.id)}`,
        { scroll: false }
      )
      requestAnimationFrame(() => {
        document
          .getElementById("auditor-register-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    },
    [router]
  )

  const handleDeletedFromList = useCallback(() => {
    if (editId && !getSchoolAuditorById(editId)) {
      setEditingAuditor(null)
      setFormResetKey((k) => k + 1)
      router.replace(SCHOOL_ROUTES.auditorsRegister)
    }
  }, [editId, router])

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
            {editingAuditor ? "監査人の編集" : "監査人登録"}
          </h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            監査担当者の情報と担当クラブを登録・更新します
          </p>
        </div>
        <SchoolAuditorsRegisterSection
          editingAuditor={editingAuditor}
          onCancelEdit={handleCancelEdit}
          onSaved={handleSaved}
          onEditFromList={handleEditFromList}
          onDeletedFromList={handleDeletedFromList}
          formResetKey={formResetKey}
        />
      </div>
    </div>
  )
}

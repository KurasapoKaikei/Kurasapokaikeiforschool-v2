"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { SchoolFormRequiredBadge } from "@/components/school/SchoolFormRequiredBadge"
import { ActionConfirmDialog } from "@/components/shared/ActionConfirmDialog"
import { useActionConfirmDialog } from "@/hooks/useActionConfirmDialog"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import {
  addSchoolAuditor,
  isDuplicateAuditorEmail,
  loadSchoolAuditors,
  SCHOOL_AUDITORS_CHANGED_EVENT,
  updateSchoolAuditor,
  type SchoolAuditor,
} from "@/lib/schoolAuditors"
import { SchoolAuditorsAccountBackupSection } from "@/components/school/SchoolAuditorsAccountBackupSection"
import { SCHOOL_BRAND_NAVY } from "@/lib/schoolTheme"
import { cn } from "@/lib/utils"

export type AuditorFormState = {
  name: string
  department: string
  phone: string
  email: string
  assignedClubIds: string[]
}

export const emptyAuditorForm = (): AuditorFormState => ({
  name: "",
  department: "",
  phone: "",
  email: "",
  assignedClubIds: [],
})

type SchoolAuditorsRegisterSectionProps = {
  editingAuditor: SchoolAuditor | null
  onCancelEdit: () => void
  onSaved: () => void
  onEditFromList: (auditor: SchoolAuditor) => void
  onDeletedFromList?: () => void
  formResetKey?: number
}

export function SchoolAuditorsRegisterSection({
  editingAuditor,
  onCancelEdit,
  onSaved,
  onEditFromList,
  onDeletedFromList,
  formResetKey = 0,
}: SchoolAuditorsRegisterSectionProps) {
  const { sortedClubs, isLoaded: clubsLoaded } = useSchoolClubs()
  const [form, setForm] = useState<AuditorFormState>(emptyAuditorForm)
  const [formError, setFormError] = useState<string | null>(null)
  const { requestConfirm, confirmProps } = useActionConfirmDialog()

  const editingId = editingAuditor?.id ?? null

  useEffect(() => {
    if (editingAuditor) {
      setForm({
        name: editingAuditor.name,
        department: editingAuditor.department,
        phone: editingAuditor.phone,
        email: editingAuditor.email,
        assignedClubIds: [...editingAuditor.assignedClubIds],
      })
    } else {
      setForm(emptyAuditorForm())
    }
    setFormError(null)
  }, [editingAuditor, formResetKey])

  const [auditors, setAuditors] = useState(() => loadSchoolAuditors())

  useEffect(() => {
    const refresh = () => setAuditors(loadSchoolAuditors())
    refresh()
    window.addEventListener(SCHOOL_AUDITORS_CHANGED_EVENT, refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener(SCHOOL_AUDITORS_CHANGED_EVENT, refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [formResetKey, editingId])

  const lockedClubIds = useMemo(() => {
    const set = new Set<string>()
    for (const a of auditors) {
      if (editingId && a.id === editingId) continue
      for (const cid of a.assignedClubIds) set.add(cid)
    }
    return set
  }, [auditors, editingId])

  const toggleClub = (clubId: string) => {
    setForm((prev) => {
      const has = prev.assignedClubIds.includes(clubId)
      return {
        ...prev,
        assignedClubIds: has
          ? prev.assignedClubIds.filter((id) => id !== clubId)
          : [...prev.assignedClubIds, clubId],
      }
    })
  }

  const isClubSelectable = (clubId: string): boolean => {
    if (form.assignedClubIds.includes(clubId)) return true
    return !lockedClubIds.has(clubId)
  }

  const persistAuditor = () => {
    const input = {
      name: form.name.trim(),
      department: form.department.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      assignedClubIds: form.assignedClubIds,
    }

    const result = editingId
      ? updateSchoolAuditor(editingId, input)
      : addSchoolAuditor(input)

    if (!result) {
      setFormError("保存に失敗しました。入力内容を確認してください。")
      return
    }

    onSaved()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) {
      setFormError("氏名を入力してください。")
      return
    }
    const department = form.department.trim()
    if (!department) {
      setFormError("部署を入力してください。")
      return
    }
    const phone = form.phone.trim()
    if (!phone) {
      setFormError("電話番号を入力してください。")
      return
    }
    const email = form.email.trim()
    if (!email) {
      setFormError("メールアドレスを入力してください。")
      return
    }
    if (form.assignedClubIds.length === 0) {
      setFormError("担当クラブを1つ以上選択してください。")
      return
    }
    if (isDuplicateAuditorEmail(email, auditors, editingId ?? undefined)) {
      setFormError("このメールアドレスは既に登録されています。")
      return
    }

    setFormError(null)
    requestConfirm(editingId ? "edit" : "register", persistAuditor)
  }

  return (
    <>
      <ActionConfirmDialog {...confirmProps} />
      <form
        id="auditor-register-form"
        onSubmit={handleSubmit}
        noValidate
        className="mr-auto w-full max-w-3xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div className="space-y-5">
          <div>
            <label
              htmlFor="auditor-name"
              className="mb-1.5 flex items-center text-sm font-medium text-[#374151]"
            >
              氏名
              <SchoolFormRequiredBadge />
            </label>
            <input
              id="auditor-name"
              type="text"
              value={form.name}
              onChange={(e) => {
                setForm((p) => ({ ...p, name: e.target.value }))
                setFormError(null)
              }}
              placeholder="例：鈴木 公認会計士"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
            />
          </div>
          <div>
            <label
              htmlFor="auditor-dept"
              className="mb-1.5 flex items-center text-sm font-medium text-[#374151]"
            >
              部署
              <SchoolFormRequiredBadge />
            </label>
            <input
              id="auditor-dept"
              type="text"
              value={form.department}
              onChange={(e) => {
                setForm((p) => ({ ...p, department: e.target.value }))
                setFormError(null)
              }}
              placeholder="例：外部監査役、会計審査課"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="auditor-phone"
                className="mb-1.5 flex items-center text-sm font-medium text-[#374151]"
              >
                電話番号
                <SchoolFormRequiredBadge />
              </label>
              <input
                id="auditor-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => {
                  setForm((p) => ({ ...p, phone: e.target.value }))
                  setFormError(null)
                }}
                placeholder="例：090-1234-5678"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
                autoComplete="off"
              />
            </div>
            <div>
              <label
                htmlFor="auditor-email"
                className="mb-1.5 flex items-center text-sm font-medium text-[#374151]"
              >
                メールアドレス
                <SchoolFormRequiredBadge />
              </label>
              <input
                id="auditor-email"
                type="email"
                value={form.email}
                onChange={(e) => {
                  setForm((p) => ({ ...p, email: e.target.value }))
                  setFormError(null)
                }}
                placeholder="例：audit@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
                autoComplete="off"
              />
            </div>
          </div>
          <fieldset>
            <legend className="mb-2 flex items-center text-sm font-medium text-[#374151]">
              担当クラブ
              <SchoolFormRequiredBadge />
            </legend>
            {!clubsLoaded ? (
              <p className="text-sm text-[#6B7280]">クラブ一覧を読み込み中…</p>
            ) : sortedClubs.length === 0 ? (
              <p className="text-sm text-amber-700">
                クラブが未登録です。先にクラブ登録を行ってください。
              </p>
            ) : (
              <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-200 bg-[#FAFAF9] p-3">
                <div className="flex flex-wrap gap-3">
                  {sortedClubs.map((club) => (
                    <label
                      key={club.id}
                      className={cn(
                        "flex items-center gap-2 text-sm",
                        isClubSelectable(club.id)
                          ? "cursor-pointer text-[#374151]"
                          : "cursor-not-allowed text-[#9CA3AF]"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={form.assignedClubIds.includes(club.id)}
                        disabled={!isClubSelectable(club.id)}
                        onChange={() => toggleClub(club.id)}
                      />
                      <span>{club.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </fieldset>
          {formError ? (
            <p className="text-sm text-[#EF4444]" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 pt-1">
            <Button
              type="submit"
              className="rounded-lg px-6 py-2.5 text-white hover:opacity-90"
              style={{ backgroundColor: SCHOOL_BRAND_NAVY }}
            >
              {editingId ? "変更を保存する" : "登録する"}
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" onClick={onCancelEdit}>
                キャンセル
              </Button>
            ) : null}
          </div>
        </div>
      </form>
      <SchoolAuditorsAccountBackupSection
        listRefreshKey={formResetKey}
        editingId={editingId}
        onEdit={onEditFromList}
        onDeleted={onDeletedFromList}
      />
    </>
  )
}

"use client"

import Link from "next/link"
import { Edit2, Trash2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  loadSchoolUseAuditFlow,
  SCHOOL_AUDIT_FLOW_CHANGED_EVENT,
} from "@/lib/schoolAuditFlow"
import { SCHOOL_ROUTES } from "@/lib/schoolTheme"
import { Button } from "@/components/ui/button"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import { SchoolFormRequiredBadge } from "@/components/school/SchoolFormRequiredBadge"
import {
  SCHOOL_MESSAGE_PAGE_CONTENT_CLASS,
} from "@/components/school/SchoolMessageHistoryUi"
import {
  MessageBoxTitleBand,
  SCHOOL_MESSAGE_BOX_BAND_COLOR,
} from "@/components/shared/MessageBoxTitleBand"
import {
  addSchoolAuditor,
  deleteSchoolAuditor,
  isDuplicateAuditorEmail,
  loadSchoolAuditors,
  SCHOOL_AUDITORS_CHANGED_EVENT,
  updateSchoolAuditor,
  type SchoolAuditor,
} from "@/lib/schoolAuditors"
import { cn } from "@/lib/utils"

const AUDIT_PAGE_ACCENT = "#4A90E2"

/** 順序｜氏名｜監査人ID｜初期PW｜部署｜電話｜メール｜担当クラブ｜アクション */
const AUDITOR_TABLE_GRID =
  "grid w-full min-w-[72rem] grid-cols-[3rem_minmax(0,1fr)_7rem_5.5rem_minmax(0,0.95fr)_9rem_minmax(0,1.1fr)_minmax(0,1.5fr)_6.5rem] items-center gap-x-3"

const EMPTY_TEXT = "監査人が登録されていません"

type FormState = {
  name: string
  department: string
  phone: string
  email: string
  assignedClubIds: string[]
}

const emptyForm = (): FormState => ({
  name: "",
  department: "",
  phone: "",
  email: "",
  assignedClubIds: [],
})

function clubNamesByIds(
  clubIds: string[],
  clubs: { id: string; name: string }[]
): string[] {
  return clubIds
    .map((id) => clubs.find((c) => c.id === id)?.name)
    .filter((n): n is string => Boolean(n))
}

export function SchoolAuditorsManageView() {
  const { sortedClubs, isLoaded: clubsLoaded } = useSchoolClubs()
  const [auditFlowEnabled, setAuditFlowEnabled] = useState(true)
  const [auditors, setAuditors] = useState<SchoolAuditor[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setAuditors(loadSchoolAuditors())
    setAuditFlowEnabled(loadSchoolUseAuditFlow())
  }, [])

  useEffect(() => {
    refresh()
    const onChange = () => refresh()
    window.addEventListener(SCHOOL_AUDITORS_CHANGED_EVENT, onChange)
    window.addEventListener(SCHOOL_AUDIT_FLOW_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(SCHOOL_AUDITORS_CHANGED_EVENT, onChange)
      window.removeEventListener(SCHOOL_AUDIT_FLOW_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [refresh])

  if (!auditFlowEnabled) {
    return (
      <div className="flex min-h-full flex-col bg-[#F5F5F0] px-6 py-8">
        <div className="mx-0 w-full max-w-3xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
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

  const resetForm = () => {
    setForm(emptyForm())
    setEditingId(null)
    setFormError(null)
  }

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

  const lockedClubIds = useMemo(() => {
    const set = new Set<string>()
    for (const a of auditors) {
      if (editingId && a.id === editingId) continue
      for (const cid of a.assignedClubIds) set.add(cid)
    }
    return set
  }, [auditors, editingId])

  const isClubSelectable = (clubId: string): boolean => {
    if (form.assignedClubIds.includes(clubId)) return true
    return !lockedClubIds.has(clubId)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) {
      setFormError("監査人氏名を入力してください。")
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

    const input = {
      name,
      department,
      phone,
      email,
      assignedClubIds: form.assignedClubIds,
    }

    const result = editingId
      ? updateSchoolAuditor(editingId, input)
      : addSchoolAuditor(input)

    if (!result) {
      setFormError("保存に失敗しました。入力内容を確認してください。")
      return
    }

    resetForm()
    refresh()
  }

  const startEdit = (auditor: SchoolAuditor) => {
    setEditingId(auditor.id)
    setForm({
      name: auditor.name,
      department: auditor.department,
      phone: auditor.phone,
      email: auditor.email,
      assignedClubIds: [...auditor.assignedClubIds],
    })
    setFormError(null)
  }

  const handleDelete = (auditor: SchoolAuditor) => {
    if (
      !window.confirm(
        `「${auditor.name}」を削除します。よろしいですか？`
      )
    ) {
      return
    }
    deleteSchoolAuditor(auditor.id)
    if (editingId === auditor.id) resetForm()
    refresh()
  }

  return (
    <div className="flex min-h-full flex-col bg-[#F5F5F0]">
      <MessageBoxTitleBand
        title="監査人管理"
        accentColor={SCHOOL_MESSAGE_BOX_BAND_COLOR}
        description="監査担当者の登録と、担当クラブの割り当て"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-6 px-6 py-4 pb-8">
        <div className={SCHOOL_MESSAGE_PAGE_CONTENT_CLASS}>
          <form
            onSubmit={handleSubmit}
            noValidate
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
            style={{ borderLeftWidth: 5, borderLeftColor: AUDIT_PAGE_ACCENT }}
          >
            <h3 className="mb-4 text-base font-semibold text-[#374151]">
              {editingId ? "監査人を編集" : "監査人の新規登録"}
            </h3>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="auditor-name"
                  className="mb-1.5 flex items-center text-sm font-medium text-[#374151]"
                >
                  監査人氏名
                  <SchoolFormRequiredBadge />
                </label>
                <input
                  id="auditor-name"
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="例：鈴木 公認会計士、田中 OB監査員"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
                  onChange={(e) =>
                    setForm((p) => ({ ...p, department: e.target.value }))
                  }
                  placeholder="例：外部監査役、会計審査課"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
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
                    onChange={(e) =>
                      setForm((p) => ({ ...p, phone: e.target.value }))
                    }
                    placeholder="例：090-XXXX-XXXX"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
                    onChange={(e) =>
                      setForm((p) => ({ ...p, email: e.target.value }))
                    }
                    placeholder="例：audit@example.com"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
                  <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-[#FAFAF9] p-3">
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
                <p className="text-sm text-red-600" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  className="text-white"
                  style={{ backgroundColor: AUDIT_PAGE_ACCENT }}
                >
                  {editingId ? "更新" : "登録"}
                </Button>
                {editingId ? (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    キャンセル
                  </Button>
                ) : null}
              </div>
            </div>
          </form>
        </div>

        <section className="w-full max-w-none">
          <h3
            className="mb-3 text-base font-semibold"
            style={{ color: AUDIT_PAGE_ACCENT }}
          >
            登録済みの監査人一覧
          </h3>
          <div
            className="flex min-h-[280px] w-full max-w-none flex-col overflow-hidden rounded-lg border border-gray-200 border-l-[5px] bg-white shadow-sm"
            style={{ borderLeftColor: AUDIT_PAGE_ACCENT }}
          >
            <div className="overflow-x-auto">
              <div
                className={cn(
                  AUDITOR_TABLE_GRID,
                  "sticky top-0 z-10 shrink-0 border-b border-gray-300 bg-[#EFF6FF] px-4 py-2.5 text-center text-xs font-semibold text-[#374151]"
                )}
                role="row"
              >
                <span role="columnheader">順序</span>
                <span role="columnheader">氏名</span>
                <span role="columnheader">監査人ID</span>
                <span role="columnheader">初期PW</span>
                <span role="columnheader">部署</span>
                <span role="columnheader">電話番号</span>
                <span role="columnheader">メールアドレス</span>
                <span role="columnheader">担当クラブ</span>
                <span role="columnheader">操作</span>
              </div>

              {auditors.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-[#6B7280]">
                  {EMPTY_TEXT}
                </p>
              ) : (
                <ul className="divide-y divide-gray-300">
                  {auditors.map((auditor, index) => {
                    const names = clubNamesByIds(
                      auditor.assignedClubIds,
                      sortedClubs
                    )
                    return (
                      <li
                        key={auditor.id}
                        className="transition-colors hover:bg-blue-50/50"
                      >
                        <div
                          className={cn(
                            AUDITOR_TABLE_GRID,
                            "px-4 py-3 text-sm text-[#374151]"
                          )}
                          role="row"
                        >
                          <span className="text-center tabular-nums text-[#6B7280]">
                            {index + 1}
                          </span>
                          <span className="font-medium">{auditor.name}</span>
                          <span className="tabular-nums text-xs font-semibold text-[#1F2937]">
                            {auditor.id}
                          </span>
                          <span className="tabular-nums font-semibold">
                            {auditor.initialPassword}
                          </span>
                          <span className="truncate" title={auditor.department}>
                            {auditor.department}
                          </span>
                          <span className="tabular-nums">{auditor.phone}</span>
                          <span
                            className="truncate tabular-nums"
                            title={auditor.email}
                          >
                            {auditor.email}
                          </span>
                          <span className="flex min-w-0 flex-wrap gap-1">
                            {names.length > 0 ? (
                              names.map((n) => (
                                <span
                                  key={`${auditor.id}-${n}`}
                                  className="inline-flex max-w-full truncate rounded bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-medium text-[#1E40AF]"
                                  title={n}
                                >
                                  {n}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-[#9CA3AF]">
                                未割当
                              </span>
                            )}
                          </span>
                          <span className="flex min-w-0 items-center justify-center gap-4 sm:justify-end sm:pr-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 shrink-0 p-0"
                              onClick={() => startEdit(auditor)}
                              aria-label="編集"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 shrink-0 p-0 text-[#EF4444] hover:text-[#EF4444]"
                              onClick={() => handleDelete(auditor)}
                              aria-label="削除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

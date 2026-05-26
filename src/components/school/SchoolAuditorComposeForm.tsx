"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SchoolMessageComposePreview } from "@/components/school/SchoolMessageComposePreview"
import {
  ALL_AUDITORS_TARGET_ID,
  sendAuditorPortalMessage,
} from "@/lib/portalMessages"
import {
  deleteSchoolDraft,
  saveSchoolDraft,
  type SchoolMessageDraft,
} from "@/lib/portalDraftMessages"
import { SCHOOL_BRAND_NAVY, SCHOOL_ROUTES } from "@/lib/schoolTheme"
import {
  SCHOOL_MESSAGE_BOX_ACCENT,
  SCHOOL_MESSAGE_PAGE_CONTENT_CLASS,
} from "@/components/school/SchoolMessageHistoryUi"
import {
  formatAuditorSelectLabel,
  loadSchoolAuditors,
  SCHOOL_AUDITORS_CHANGED_EVENT,
  type SchoolAuditor,
} from "@/lib/schoolAuditors"

const AUDITOR_SUBJECT_PLACEHOLDER = "例：2026年度決算の監査依頼"

type ComposeStep = "compose" | "confirm"

function RequiredMark() {
  return (
    <span className="ml-1 text-xs font-medium text-[#EF4444]" aria-hidden>
      *必須
    </span>
  )
}

export type SchoolAuditorComposeInitial = {
  targetAuditorId: string
  subject: string
  body: string
}

type SchoolAuditorComposeFormProps = {
  onBack: () => void
  onSent: () => void
  onDraftSaved?: () => void
  initialValues?: SchoolAuditorComposeInitial
  editingDraftId?: string | null
}

/** 学校：監査人宛てメッセージ作成（確認画面・下書き対応） */
export function SchoolAuditorComposeForm({
  onBack,
  onSent,
  onDraftSaved,
  initialValues,
  editingDraftId = null,
}: SchoolAuditorComposeFormProps) {
  const [step, setStep] = useState<ComposeStep>("compose")
  const [draftId, setDraftId] = useState<string | null>(editingDraftId)
  const [auditors, setAuditors] = useState<SchoolAuditor[]>([])
  const [targetAuditorId, setTargetAuditorId] = useState(
    initialValues?.targetAuditorId ?? ALL_AUDITORS_TARGET_ID
  )
  const [subject, setSubject] = useState(initialValues?.subject ?? "")
  const [body, setBody] = useState(initialValues?.body ?? "")
  const [error, setError] = useState<string | null>(null)
  const [draftNotice, setDraftNotice] = useState<string | null>(null)

  const refreshAuditors = useCallback(() => {
    try {
      setAuditors(loadSchoolAuditors())
    } catch {
      setAuditors([])
    }
  }, [])

  useEffect(() => {
    refreshAuditors()
    const onChange = () => refreshAuditors()
    window.addEventListener(SCHOOL_AUDITORS_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(SCHOOL_AUDITORS_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [refreshAuditors])

  useEffect(() => {
    if (auditors.length === 0) return
    if (targetAuditorId === ALL_AUDITORS_TARGET_ID) return
    const exists = auditors.some((a) => a.id === targetAuditorId)
    if (!exists) {
      const preferred =
        initialValues?.targetAuditorId === ALL_AUDITORS_TARGET_ID
          ? ALL_AUDITORS_TARGET_ID
          : initialValues?.targetAuditorId &&
              auditors.some((a) => a.id === initialValues.targetAuditorId)
            ? initialValues.targetAuditorId
            : ALL_AUDITORS_TARGET_ID
      setTargetAuditorId(preferred)
    }
  }, [auditors, targetAuditorId, initialValues?.targetAuditorId])

  const targetLabel = useMemo(() => {
    if (targetAuditorId === ALL_AUDITORS_TARGET_ID) return "全監査人"
    const auditor = auditors.find((a) => a.id === targetAuditorId)
    return auditor ? formatAuditorSelectLabel(auditor) : ""
  }, [auditors, targetAuditorId])

  const hasValidTarget = useMemo(() => {
    if (auditors.length === 0 || !targetAuditorId) return false
    if (targetAuditorId === ALL_AUDITORS_TARGET_ID) return true
    return auditors.some((a) => a.id === targetAuditorId)
  }, [auditors, targetAuditorId])

  const isFormValid =
    hasValidTarget && subject.trim().length > 0 && body.trim().length > 0

  const persistDraft = (): SchoolMessageDraft => {
    const saved = saveSchoolDraft({
      id: draftId ?? undefined,
      audience: "auditor",
      targetId: targetAuditorId,
      targetName: targetLabel,
      subject,
      body,
    })
    setDraftId(saved.id)
    return saved
  }

  const handleGoConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (auditors.length === 0) {
      setError("監査人が登録されていません。監査人管理から登録してください。")
      return
    }
    if (!isFormValid) {
      setError("送信先、件名、本文を入力してください。")
      return
    }
    setError(null)
    setDraftNotice(null)
    setStep("confirm")
  }

  const handleSaveDraft = () => {
    if (auditors.length === 0) {
      setError("監査人が登録されていません。")
      return
    }
    if (!targetAuditorId || !targetLabel) {
      setError("送信先の監査人を選択してください。")
      return
    }
    persistDraft()
    setDraftNotice("下書きを保存しました。")
    onDraftSaved?.()
  }

  const handleSend = () => {
    if (!isFormValid) return
    sendAuditorPortalMessage({
      subject: subject.trim(),
      body: body.trim(),
      targetAuditorId,
      targetAuditorName: targetLabel,
    })
    if (draftId) deleteSchoolDraft(draftId)
    onSent()
  }

  return (
    <div className="px-6 py-6">
      <div className={SCHOOL_MESSAGE_PAGE_CONTENT_CLASS}>
        <button
          type="button"
          onClick={step === "confirm" ? () => setStep("compose") : onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#6B7280] transition-colors hover:text-[#4A90E2] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {step === "confirm" ? "入力画面に戻る" : "一覧に戻る"}
        </button>

        {draftNotice ? (
          <p
            className="mb-4 rounded-md border border-[#6EE7B7] bg-[#D1FAE5]/50 px-4 py-2.5 text-sm text-[#065F46]"
            role="status"
          >
            {draftNotice}
          </p>
        ) : null}

        {step === "confirm" ? (
          <>
            <SchoolMessageComposePreview
              title="送信内容の確認"
              targetFieldLabel="送信先（監査人）"
              targetLabel={targetLabel}
              subject={subject.trim()}
              body={body.trim()}
            />
            <div className="mt-5 flex flex-wrap justify-start gap-3">
              <Button
                type="button"
                onClick={handleSend}
                className="rounded-lg px-6 text-white hover:opacity-90"
                style={{ backgroundColor: SCHOOL_BRAND_NAVY }}
              >
                送信
              </Button>
              <Button type="button" variant="outline" onClick={handleSaveDraft}>
                下書き保存
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("compose")}
              >
                キャンセル
              </Button>
            </div>
          </>
        ) : (
          <form
            onSubmit={handleGoConfirm}
            noValidate
            className="rounded-lg border border-gray-200 border-l-[5px] bg-white p-6 shadow-sm"
            style={{ borderLeftColor: SCHOOL_MESSAGE_BOX_ACCENT }}
          >
            <h2 className="mb-4 text-lg font-semibold text-[#374151]">
              監査人宛てメッセージ作成
            </h2>
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#374151]">
                  送信先（監査人）
                  <RequiredMark />
                </label>
                {auditors.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                    登録済みの監査人がありません。
                    <Link
                      href={SCHOOL_ROUTES.auditorsRegister}
                      className="ml-1 font-medium text-[#4A90E2] hover:underline"
                    >
                      監査人管理
                    </Link>
                    から監査人を登録してください。
                  </div>
                ) : (
                  <select
                    value={targetAuditorId}
                    onChange={(e) => {
                      setTargetAuditorId(e.target.value)
                      setError(null)
                    }}
                    required
                    aria-required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
                  >
                    <option value={ALL_AUDITORS_TARGET_ID}>
                      すべて（全監査人）
                    </option>
                    {auditors.map((auditor) => (
                      <option key={auditor.id} value={auditor.id}>
                        {formatAuditorSelectLabel(auditor)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label
                  htmlFor="auditorMsgSubject"
                  className="mb-1.5 block text-sm font-medium text-[#374151]"
                >
                  件名
                  <RequiredMark />
                </label>
                <input
                  id="auditorMsgSubject"
                  type="text"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value)
                    setError(null)
                  }}
                  placeholder={AUDITOR_SUBJECT_PLACEHOLDER}
                  required
                  aria-required
                  disabled={auditors.length === 0}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label
                  htmlFor="auditorMsgBody"
                  className="mb-1.5 block text-sm font-medium text-[#374151]"
                >
                  本文
                  <RequiredMark />
                </label>
                <textarea
                  id="auditorMsgBody"
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value)
                    setError(null)
                  }}
                  rows={6}
                  placeholder="監査人への連絡内容を入力"
                  required
                  aria-required
                  disabled={auditors.length === 0}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40 disabled:bg-gray-50"
                />
              </div>
              {error ? (
                <p className="text-sm text-[#EF4444]" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-start gap-3">
                <Button
                  type="submit"
                  disabled={auditors.length === 0}
                  className="rounded-lg px-6 text-white hover:opacity-90"
                  style={{ backgroundColor: SCHOOL_MESSAGE_BOX_ACCENT }}
                >
                  確認画面へ
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={auditors.length === 0}
                >
                  下書き保存
                </Button>
                <Button type="button" variant="outline" onClick={onBack}>
                  キャンセル
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

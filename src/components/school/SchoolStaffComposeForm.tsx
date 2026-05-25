"use client"

import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SchoolMessageComposePreview } from "@/components/school/SchoolMessageComposePreview"
import { sendStaffPortalMessage } from "@/lib/portalMessages"
import {
  deleteSchoolDraft,
  saveSchoolDraft,
  type SchoolMessageDraft,
} from "@/lib/portalDraftMessages"
import { SCHOOL_BRAND_NAVY } from "@/lib/schoolTheme"
import {
  SCHOOL_MESSAGE_BOX_ACCENT,
  SCHOOL_MESSAGE_PAGE_CONTENT_CLASS,
} from "@/components/school/SchoolMessageHistoryUi"

const STAFF_SUBJECT_PLACEHOLDER = "例：2026年度決算の監査依頼"

const STAFF_TARGET_OPTIONS = [
  { id: "staff-all", name: "管理担当者全員" },
  { id: "staff-student-affairs", name: "学生課" },
  { id: "staff-accounting", name: "会計担当" },
] as const

type ComposeStep = "compose" | "confirm"

function RequiredMark() {
  return (
    <span className="ml-1 text-xs font-medium text-[#EF4444]" aria-hidden>
      *必須
    </span>
  )
}

export type SchoolStaffComposeInitial = {
  targetStaffId: string
  subject: string
  body: string
}

type SchoolStaffComposeFormProps = {
  onBack: () => void
  onSent: () => void
  onDraftSaved?: () => void
  initialValues?: SchoolStaffComposeInitial
  editingDraftId?: string | null
}

/** 学校：管理担当者宛てメッセージ作成（確認画面・下書き対応） */
export function SchoolStaffComposeForm({
  onBack,
  onSent,
  onDraftSaved,
  initialValues,
  editingDraftId = null,
}: SchoolStaffComposeFormProps) {
  const [step, setStep] = useState<ComposeStep>("compose")
  const [draftId, setDraftId] = useState<string | null>(editingDraftId)
  const [targetStaffId, setTargetStaffId] = useState(
    initialValues?.targetStaffId ?? STAFF_TARGET_OPTIONS[0].id
  )
  const [subject, setSubject] = useState(initialValues?.subject ?? "")
  const [body, setBody] = useState(initialValues?.body ?? "")
  const [error, setError] = useState<string | null>(null)
  const [draftNotice, setDraftNotice] = useState<string | null>(null)

  const targetLabel =
    STAFF_TARGET_OPTIONS.find((o) => o.id === targetStaffId)?.name ?? "管理担当者"

  const isFormValid = subject.trim().length > 0 && body.trim().length > 0

  const persistDraft = (): SchoolMessageDraft => {
    const saved = saveSchoolDraft({
      id: draftId ?? undefined,
      audience: "staff",
      targetId: targetStaffId,
      targetName: targetLabel,
      subject,
      body,
    })
    setDraftId(saved.id)
    return saved
  }

  const handleGoConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) {
      setError("件名と本文を入力してください。")
      return
    }
    setError(null)
    setDraftNotice(null)
    setStep("confirm")
  }

  const handleSaveDraft = () => {
    persistDraft()
    setDraftNotice("下書きを保存しました。")
    onDraftSaved?.()
  }

  const handleSend = () => {
    if (!isFormValid) return
    sendStaffPortalMessage({
      subject: subject.trim(),
      body: body.trim(),
      targetStaffId,
      targetStaffName: targetLabel,
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
              targetFieldLabel="送信先（管理担当者）"
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
              管理担当者宛てメッセージ作成
            </h2>
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#374151]">
                  送信先（管理担当者）
                </label>
                <select
                  value={targetStaffId}
                  onChange={(e) => setTargetStaffId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
                >
                  {STAFF_TARGET_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-[#9CA3AF]">
                  ※担当者設定画面連携は今後対応（デモ用の送信先です）
                </p>
              </div>
              <div>
                <label
                  htmlFor="staffMsgSubject"
                  className="mb-1.5 block text-sm font-medium text-[#374151]"
                >
                  件名
                  <RequiredMark />
                </label>
                <input
                  id="staffMsgSubject"
                  type="text"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value)
                    setError(null)
                  }}
                  placeholder={STAFF_SUBJECT_PLACEHOLDER}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
                />
              </div>
              <div>
                <label
                  htmlFor="staffMsgBody"
                  className="mb-1.5 block text-sm font-medium text-[#374151]"
                >
                  本文
                  <RequiredMark />
                </label>
                <textarea
                  id="staffMsgBody"
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value)
                    setError(null)
                  }}
                  rows={6}
                  placeholder="管理担当者への連絡内容を入力"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
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
                  className="rounded-lg px-6 text-white hover:opacity-90"
                  style={{ backgroundColor: SCHOOL_MESSAGE_BOX_ACCENT }}
                >
                  確認画面へ
                </Button>
                <Button type="button" variant="outline" onClick={handleSaveDraft}>
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

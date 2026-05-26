"use client"

import { useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SchoolMessageComposePreview } from "@/components/school/SchoolMessageComposePreview"
import { sendAuditPortalMessage } from "@/lib/portalMessages"
import {
  deleteAuditorDraft,
  saveAuditorDraft,
  type AuditorMessageDraft,
} from "@/lib/auditorDraftMessages"
import { AUDIT_MESSAGE_BOX_ACCENT } from "@/lib/auditorTheme"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import {
  SCHOOL_MESSAGE_PAGE_CONTENT_CLASS,
} from "@/components/school/SchoolMessageHistoryUi"

const SUBJECT_PLACEHOLDER = "例：決算報告書の修正依頼"
const REQUIRED_FIELDS_ERROR = "送信先、件名、本文は必須入力です。"

type ComposeStep = "compose" | "confirm"

function RequiredMark() {
  return (
    <span className="ml-1 text-xs font-medium text-[#EF4444]" aria-hidden>
      *必須
    </span>
  )
}

export type AuditorClubComposeInitial = {
  targetClubId: string
  subject: string
  body: string
}

type AuditorClubComposeFormProps = {
  auditorId: string
  assignedClubIds: string[]
  onBack: () => void
  onSent: () => void
  onDraftSaved?: () => void
  backLabel?: string
  title?: string
  initialValues?: AuditorClubComposeInitial
  editingDraftId?: string | null
}

/** 監査人：担当クラブ宛てメッセージ作成 */
export function AuditorClubComposeForm({
  auditorId,
  assignedClubIds,
  onBack,
  onSent,
  onDraftSaved,
  backLabel = "一覧に戻る",
  title = "担当クラブへメッセージ作成",
  initialValues,
  editingDraftId = null,
}: AuditorClubComposeFormProps) {
  const { sortedClubs, isLoaded: clubsLoaded } = useSchoolClubs()

  const assignedClubs = useMemo(
    () =>
      (sortedClubs ?? []).filter((c) =>
        (assignedClubIds ?? []).includes(c?.id ?? "")
      ),
    [sortedClubs, assignedClubIds]
  )

  const defaultClubId =
    initialValues?.targetClubId &&
    (assignedClubIds ?? []).includes(initialValues.targetClubId)
      ? initialValues.targetClubId
      : assignedClubs[0]?.id ?? ""

  const [step, setStep] = useState<ComposeStep>("compose")
  const [draftId, setDraftId] = useState<string | null>(editingDraftId)
  const [targetClubId, setTargetClubId] = useState(defaultClubId)
  const [subject, setSubject] = useState(initialValues?.subject ?? "")
  const [body, setBody] = useState(initialValues?.body ?? "")
  const [error, setError] = useState<string | null>(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [draftNotice, setDraftNotice] = useState<string | null>(null)

  const targetLabel = useMemo(
    () => assignedClubs.find((c) => c.id === targetClubId)?.name ?? targetClubId,
    [assignedClubs, targetClubId]
  )

  const hasValidTarget =
    clubsLoaded &&
    targetClubId.length > 0 &&
    assignedClubIds.includes(targetClubId)

  const isFormValid =
    hasValidTarget && subject.trim().length > 0 && body.trim().length > 0

  const validationError =
    clubsLoaded && !isFormValid ? REQUIRED_FIELDS_ERROR : null

  const displayError = error ?? (submitAttempted ? validationError : null)

  const persistDraft = (): AuditorMessageDraft => {
    const saved = saveAuditorDraft({
      id: draftId ?? undefined,
      auditorId,
      targetId: targetClubId,
      targetName: targetLabel,
      subject,
      body,
    })
    setDraftId(saved.id)
    return saved
  }

  const handleGoConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitAttempted(true)
    if (!isFormValid) {
      setError(REQUIRED_FIELDS_ERROR)
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
    sendAuditPortalMessage({
      subject: subject.trim(),
      body: body.trim(),
      targetClubId,
      targetClubName: targetLabel,
      auditorId,
    })
    if (draftId) deleteAuditorDraft(draftId, auditorId)
    onSent()
  }

  const clearErrors = () => {
    setError(null)
    setSubmitAttempted(false)
  }

  if (assignedClubIds.length === 0) {
    return (
      <div className="px-6 py-6">
        <div className={SCHOOL_MESSAGE_PAGE_CONTENT_CLASS}>
          <p className="text-sm text-[#374151]">
            担当クラブが割り当てられていないため、メッセージを送信できません。
          </p>
          <Button type="button" variant="outline" className="mt-4" onClick={onBack}>
            {backLabel}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-6">
      <div className={SCHOOL_MESSAGE_PAGE_CONTENT_CLASS}>
        <button
          type="button"
          onClick={step === "confirm" ? () => setStep("compose") : onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#6B7280] transition-colors hover:text-[#EA580C] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {step === "confirm" ? "入力画面に戻る" : backLabel}
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
              targetFieldLabel="送信先クラブ"
              targetLabel={targetLabel}
              subject={subject.trim()}
              body={body.trim()}
            />
            <div className="mt-5 flex flex-wrap justify-start gap-3">
              <Button
                type="button"
                onClick={handleSend}
                className="rounded-lg px-6 text-white hover:opacity-90"
                style={{ backgroundColor: AUDIT_MESSAGE_BOX_ACCENT }}
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
            style={{ borderLeftColor: AUDIT_MESSAGE_BOX_ACCENT }}
          >
            <h2 className="mb-4 text-lg font-semibold text-[#374151]">{title}</h2>
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#374151]">
                  送信先クラブ（担当のみ）
                  <RequiredMark />
                </label>
                {!clubsLoaded ? (
                  <p className="text-sm text-[#9CA3AF]">読み込み中...</p>
                ) : (
                  <select
                    value={targetClubId}
                    onChange={(e) => {
                      setTargetClubId(e.target.value)
                      clearErrors()
                    }}
                    required
                    aria-required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40"
                  >
                    {assignedClubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}（{club.id}）
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label
                  htmlFor="auditMsgSubject"
                  className="mb-1.5 block text-sm font-medium text-[#374151]"
                >
                  件名
                  <RequiredMark />
                </label>
                <input
                  id="auditMsgSubject"
                  type="text"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value)
                    clearErrors()
                  }}
                  placeholder={SUBJECT_PLACEHOLDER}
                  required
                  aria-required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40"
                />
              </div>
              <div>
                <label
                  htmlFor="auditMsgBody"
                  className="mb-1.5 block text-sm font-medium text-[#374151]"
                >
                  本文
                  <RequiredMark />
                </label>
                <textarea
                  id="auditMsgBody"
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value)
                    clearErrors()
                  }}
                  rows={6}
                  placeholder="決算指示・修正連絡などを入力"
                  required
                  aria-required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40"
                />
              </div>
              {displayError ? (
                <p className="text-sm text-[#EF4444]" role="alert">
                  {displayError}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-start gap-3">
                <Button
                  type="submit"
                  disabled={!clubsLoaded}
                  className="rounded-lg px-6 text-white hover:opacity-90"
                  style={{ backgroundColor: AUDIT_MESSAGE_BOX_ACCENT }}
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

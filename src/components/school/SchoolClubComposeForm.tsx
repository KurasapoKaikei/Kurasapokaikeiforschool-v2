"use client"

import { useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SchoolMessageComposePreview } from "@/components/school/SchoolMessageComposePreview"
import {
  ALL_CLUBS_TARGET_ID,
  sendPortalMessage,
} from "@/lib/portalMessages"
import {
  deleteSchoolDraft,
  saveSchoolDraft,
  type SchoolMessageDraft,
} from "@/lib/portalDraftMessages"
import { SCHOOL_BRAND_NAVY } from "@/lib/schoolTheme"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import {
  SCHOOL_MESSAGE_BOX_ACCENT,
  SCHOOL_MESSAGE_PAGE_CONTENT_CLASS,
} from "@/components/school/SchoolMessageHistoryUi"

const CLUB_SUBJECT_PLACEHOLDER = "例：2026年度収支報告書提出期限のお知らせ"
const REQUIRED_FIELDS_ERROR = "送信先、件名、本文は必須入力です。"

type ComposeStep = "compose" | "confirm"

function RequiredMark() {
  return (
    <span className="ml-1 text-xs font-medium text-[#EF4444]" aria-hidden>
      *必須
    </span>
  )
}

export type SchoolClubComposeInitial = {
  targetClubId: string
  subject: string
  body: string
}

type SchoolClubComposeFormProps = {
  onBack: () => void
  onSent: () => void
  onDraftSaved?: () => void
  fixedTargetClub?: { id: string; name: string }
  backLabel?: string
  title?: string
  initialValues?: SchoolClubComposeInitial
  editingDraftId?: string | null
}

/** 学校：クラブ宛てメッセージ作成（確認画面・下書き対応） */
export function SchoolClubComposeForm({
  onBack,
  onSent,
  onDraftSaved,
  fixedTargetClub,
  backLabel = "一覧に戻る",
  title = "クラブ宛てメッセージ作成",
  initialValues,
  editingDraftId = null,
}: SchoolClubComposeFormProps) {
  const { sortedClubs, isLoaded: clubsLoaded } = useSchoolClubs()
  const [step, setStep] = useState<ComposeStep>("compose")
  const [draftId, setDraftId] = useState<string | null>(editingDraftId)
  const [targetClubId, setTargetClubId] = useState(
    initialValues?.targetClubId ??
      fixedTargetClub?.id ??
      ALL_CLUBS_TARGET_ID
  )
  const [subject, setSubject] = useState(initialValues?.subject ?? "")
  const [body, setBody] = useState(initialValues?.body ?? "")
  const [error, setError] = useState<string | null>(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [draftNotice, setDraftNotice] = useState<string | null>(null)

  const isTargetLocked = fixedTargetClub != null

  const targetLabel = useMemo(() => {
    if (isTargetLocked) return fixedTargetClub.name
    if (targetClubId === ALL_CLUBS_TARGET_ID) return "全クラブ"
    return sortedClubs.find((c) => c.id === targetClubId)?.name ?? targetClubId
  }, [isTargetLocked, fixedTargetClub, targetClubId, sortedClubs])

  const hasValidTarget = useMemo(() => {
    if (isTargetLocked && fixedTargetClub) return true
    if (!clubsLoaded || !targetClubId) return false
    if (targetClubId === ALL_CLUBS_TARGET_ID) return true
    return sortedClubs.some((c) => c.id === targetClubId)
  }, [isTargetLocked, fixedTargetClub, clubsLoaded, targetClubId, sortedClubs])

  const isFormValid =
    hasValidTarget && subject.trim().length > 0 && body.trim().length > 0

  const validationError =
    clubsLoaded && !isFormValid ? REQUIRED_FIELDS_ERROR : null

  const displayError = error ?? (submitAttempted ? validationError : null)

  const persistDraft = (): SchoolMessageDraft => {
    const clubId = isTargetLocked ? fixedTargetClub!.id : targetClubId
    const clubName = isTargetLocked ? fixedTargetClub!.name : targetLabel
    const saved = saveSchoolDraft({
      id: draftId ?? undefined,
      audience: "club",
      targetId: clubId,
      targetName: clubName,
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
    const clubId = isTargetLocked ? fixedTargetClub!.id : targetClubId
    const clubName = isTargetLocked ? fixedTargetClub!.name : targetLabel

    sendPortalMessage({
      subject: subject.trim(),
      body: body.trim(),
      targetClubId: clubId,
      targetClubName: clubName,
      audience: "club",
    })
    if (draftId) deleteSchoolDraft(draftId)
    onSent()
  }

  const clearErrors = () => {
    setError(null)
    setSubmitAttempted(false)
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
            <h2 className="mb-4 text-lg font-semibold text-[#374151]">{title}</h2>
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#374151]">
                  送信先クラブ
                  <RequiredMark />
                </label>
                {isTargetLocked ? (
                  <p
                    className="rounded-lg border border-gray-200 bg-[#F9FAFB] px-3 py-2.5 text-sm font-medium text-[#374151]"
                    aria-readonly
                  >
                    {fixedTargetClub.name}
                    <span className="ml-2 font-normal text-[#6B7280]">
                      （{fixedTargetClub.id}）
                    </span>
                  </p>
                ) : !clubsLoaded ? (
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
                  >
                    <option value={ALL_CLUBS_TARGET_ID}>すべて（全クラブ）</option>
                    {sortedClubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}（{club.id}）
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label
                  htmlFor="clubMsgSubject"
                  className="mb-1.5 block text-sm font-medium text-[#374151]"
                >
                  件名
                  <RequiredMark />
                </label>
                <input
                  id="clubMsgSubject"
                  type="text"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value)
                    clearErrors()
                  }}
                  placeholder={CLUB_SUBJECT_PLACEHOLDER}
                  required
                  aria-required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
                />
              </div>
              <div>
                <label
                  htmlFor="clubMsgBody"
                  className="mb-1.5 block text-sm font-medium text-[#374151]"
                >
                  本文
                  <RequiredMark />
                </label>
                <textarea
                  id="clubMsgBody"
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value)
                    clearErrors()
                  }}
                  rows={6}
                  placeholder="クラブ担当者への連絡内容を入力"
                  required
                  aria-required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
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
                  disabled={!clubsLoaded && !isTargetLocked}
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

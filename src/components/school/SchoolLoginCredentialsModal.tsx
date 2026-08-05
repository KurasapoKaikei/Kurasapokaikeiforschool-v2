"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Check, Copy, X } from "lucide-react"
import { SCHOOL_BRAND_NAVY } from "@/lib/schoolTheme"

type CopyField =
  | "loginId"
  | "password"
  | "managerPassword"
  | "managerInfo"
  | "all"

type SchoolLoginCredentialsModalProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  loginIdLabel?: string
  loginId: string
  initialPassword: string
  /** クラブ責任者（役職） */
  managerTitle?: string
  /** クラブ責任者（氏名） */
  managerName?: string
  /** 責任者用初期PW */
  managerInitialPassword?: string
}

function formatBulkCopyText(props: {
  loginId: string
  initialPassword: string
  managerTitle?: string
  managerName?: string
  managerInitialPassword?: string
}): string {
  const lines = [
    `ログインID: ${props.loginId}`,
    `作業者用初期パスワード: ${props.initialPassword}`,
  ]
  if (props.managerTitle || props.managerName) {
    lines.push(
      `クラブ責任者: ${[props.managerTitle, props.managerName].filter(Boolean).join(" ")}`
    )
  }
  if (props.managerInitialPassword) {
    lines.push(`責任者用初期パスワード: ${props.managerInitialPassword}`)
  }
  return lines.join("\n")
}

/** 登録完了時：ログインID・初期パスワードの表示とクリップボードコピー */
export function SchoolLoginCredentialsModal({
  open,
  onClose,
  title,
  description,
  loginIdLabel = "ログインID",
  loginId,
  initialPassword,
  managerTitle = "",
  managerName = "",
  managerInitialPassword = "",
}: SchoolLoginCredentialsModalProps) {
  const [copiedField, setCopiedField] = useState<CopyField | null>(null)

  useEffect(() => {
    if (!open) {
      setCopiedField(null)
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const copyText = useCallback(async (text: string, field: CopyField) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      /* クリップボード非対応環境では無視 */
    }
  }, [])

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!open || !mounted) return null

  const managerLabel = [managerTitle, managerName].filter(Boolean).join(" ") || "—"

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-credentials-title"
    >
      <div className="flex w-full max-w-md flex-col rounded-lg border border-gray-200 bg-white shadow-xl max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2
            id="login-credentials-title"
            className="text-lg font-semibold text-[#374151]"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[#6B7280] hover:bg-gray-100"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5 overflow-y-auto">
          {description ? (
            <p className="text-sm text-[#6B7280]">{description}</p>
          ) : null}

          <div className="space-y-4">
            <CredentialRow
              label={loginIdLabel}
              value={loginId}
              copied={copiedField === "loginId"}
              onCopy={() => copyText(loginId, "loginId")}
            />
            <CredentialRow
              label="作業者用初期パスワード"
              value={initialPassword}
              copied={copiedField === "password"}
              onCopy={() => copyText(initialPassword, "password")}
            />
            <CredentialRow
              label="クラブ責任者（役職・氏名）"
              value={managerLabel}
              copied={copiedField === "managerInfo"}
              onCopy={() => copyText(managerLabel, "managerInfo")}
            />
            {managerInitialPassword ? (
              <CredentialRow
                label="責任者用初期パスワード"
                value={managerInitialPassword}
                copied={copiedField === "managerPassword"}
                onCopy={() =>
                  copyText(managerInitialPassword, "managerPassword")
                }
              />
            ) : null}
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() =>
              copyText(
                formatBulkCopyText({
                  loginId,
                  initialPassword,
                  managerTitle,
                  managerName,
                  managerInitialPassword,
                }),
                "all"
              )
            }
          >
            {copiedField === "all" ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copiedField === "all" ? "コピーしました" : "ログイン情報をコピー"}
          </Button>
        </div>

        <div className="flex justify-end border-t border-gray-200 px-6 py-4">
          <Button
            type="button"
            className="text-white hover:opacity-90"
            style={{ backgroundColor: SCHOOL_BRAND_NAVY }}
            onClick={onClose}
          >
            閉じる
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

type CredentialRowProps = {
  label: string
  value: string
  copied: boolean
  onCopy: () => void
}

function CredentialRow({ label, value, copied, onCopy }: CredentialRowProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-[#FAFAF9] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[#6B7280]">{label}</p>
          <p className="mt-1 break-all font-mono text-base font-semibold text-[#374151]">
            {value}
          </p>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded-md border border-gray-300 p-2 text-[#374151] hover:bg-white"
          aria-label={`${label}をコピー`}
          title="コピーする"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  )
}

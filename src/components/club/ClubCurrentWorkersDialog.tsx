"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatWorkersLabel } from "@/lib/currentWorkersSession"

type ClubCurrentWorkersDialogProps = {
  open: boolean
  staffNames: string[]
  selectedNames: string[]
  onToggleName: (name: string) => void
  onConfirm: () => void
}

/** ログイン直後：今から作業する担当者を複数選択するモーダル */
export function ClubCurrentWorkersDialog({
  open,
  staffNames,
  selectedNames,
  onToggleName,
  onConfirm,
}: ClubCurrentWorkersDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => confirmRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open])

  if (!open) return null

  const preview =
    selectedNames.length > 0
      ? `今から ${formatWorkersLabel(selectedNames)} が作業します`
      : "担当者を1名以上選択してください"

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="club-current-workers-title"
        aria-describedby="club-current-workers-desc"
        className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="club-current-workers-title"
          className="text-lg font-semibold text-[#374151]"
        >
          作業担当者の選択
        </h2>
        <p id="club-current-workers-desc" className="mt-2 text-sm text-[#6B7280]">
          今から作業する担当者を選択してください。設定 ＞ 担当者設定に登録された氏名から選べます。
        </p>

        <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-[#FAFAF8] p-3">
          {staffNames.map((name) => {
            const checked = selectedNames.includes(name)
            return (
              <li key={name}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                    checked ? "bg-[#77B8DA]/15 text-[#374151]" : "hover:bg-white"
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-[#77B8DA] focus:ring-[#77B8DA]"
                    checked={checked}
                    onChange={() => onToggleName(name)}
                  />
                  <span className="font-medium">{name}</span>
                </label>
              </li>
            )
          })}
        </ul>

        <p
          className={cn(
            "mt-4 text-sm",
            selectedNames.length > 0 ? "text-[#374151]" : "text-[#9CA3AF]"
          )}
          aria-live="polite"
        >
          {preview}
        </p>

        <div className="mt-6 flex justify-end">
          <Button
            ref={confirmRef}
            type="button"
            disabled={selectedNames.length === 0}
            className="bg-[#77B8DA] px-8 text-white hover:bg-[#77B8DA]/90 disabled:opacity-50"
            onClick={onConfirm}
          >
            確定する
          </Button>
        </div>
      </div>
    </div>
  )
}

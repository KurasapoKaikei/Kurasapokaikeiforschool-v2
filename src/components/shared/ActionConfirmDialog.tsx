"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ActionConfirmVariant = "register" | "edit" | "delete"

const MESSAGES: Record<ActionConfirmVariant, string> = {
  register: "本当に登録してもよろしいですか？",
  edit: "変更内容を保存してもよろしいですか？",
  delete: "このデータを完全に削除します。本当によろしいですか？",
}

type ActionConfirmDialogProps = {
  open: boolean
  variant: ActionConfirmVariant
  message?: string
  onConfirm: () => void
  onCancel: () => void
}

/** 登録・編集・削除のワンクッション確認（Enter＝はい、Esc＝いいえ） */
export function ActionConfirmDialog({
  open,
  variant,
  message,
  onConfirm,
  onCancel,
}: ActionConfirmDialogProps) {
  const yesRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => yesRef.current?.focus(), 0)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault()
        e.stopPropagation()
        onConfirm()
      } else if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        onCancel()
      }
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener("keydown", onKeyDown, true)
    }
  }, [open, onConfirm, onCancel])

  if (!open) return null

  const isDelete = variant === "delete"
  const text = message ?? MESSAGES[variant]

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="action-confirm-title"
        aria-describedby="action-confirm-desc"
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="action-confirm-title"
          className="text-lg font-semibold text-[#374151]"
        >
          確認
        </h2>
        <p
          id="action-confirm-desc"
          className={cn(
            "mt-3 text-sm leading-relaxed",
            isDelete ? "text-[#B91C1C]" : "text-[#374151]"
          )}
        >
          {text}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            いいえ
          </Button>
          <Button
            ref={yesRef}
            type="button"
            className={cn(
              "min-w-[5.5rem] text-white hover:opacity-90",
              isDelete ? "bg-[#EF4444] hover:bg-[#EF4444]/90" : "bg-[#4A90E2]"
            )}
            onClick={onConfirm}
          >
            はい
          </Button>
        </div>
      </div>
    </div>
  )
}

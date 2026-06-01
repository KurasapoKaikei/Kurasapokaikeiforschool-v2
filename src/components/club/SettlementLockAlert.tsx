"use client"

import { AlertTriangle } from "lucide-react"

const LOCK_MESSAGE =
  "当年度の決算は監査中のため、登録、編集、削除はできません。ロックを解除するには監査人から差戻しをしてもらう必要があります。"

type SettlementLockAlertProps = {
  isLocked: boolean
  className?: string
}

/** 決算提出ロック中に表示する警告バナー */
export function SettlementLockAlert({ isLocked, className = "" }: SettlementLockAlertProps) {
  if (!isLocked) return null

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm ${className}`}
    >
      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
      <p>{LOCK_MESSAGE}</p>
    </div>
  )
}

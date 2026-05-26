"use client"

import { useCallback, useState } from "react"
import type { ActionConfirmVariant } from "@/components/shared/ActionConfirmDialog"

type PendingConfirm = {
  variant: ActionConfirmVariant
  message?: string
  onConfirm: () => void
}

export function useActionConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const requestConfirm = useCallback(
    (
      variant: ActionConfirmVariant,
      onConfirm: () => void,
      message?: string
    ) => {
      setPending({ variant, message, onConfirm })
    },
    []
  )

  const cancelConfirm = useCallback(() => setPending(null), [])

  const confirmProps = pending
    ? {
        open: true as const,
        variant: pending.variant,
        message: pending.message,
        onConfirm: () => {
          pending.onConfirm()
          setPending(null)
        },
        onCancel: cancelConfirm,
      }
    : {
        open: false as const,
        variant: "register" as ActionConfirmVariant,
        onConfirm: () => {},
        onCancel: cancelConfirm,
      }

  return { requestConfirm, confirmProps, isConfirmOpen: pending != null }
}

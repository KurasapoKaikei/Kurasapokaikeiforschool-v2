"use client"

import { useCallback, useRef, useState } from "react"
import type { ActionConfirmVariant } from "@/components/shared/ActionConfirmDialog"

type PendingConfirm = {
  variant: ActionConfirmVariant
  message?: string
  onConfirm: () => void
}

export function useActionConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const pendingRef = useRef<PendingConfirm | null>(null)

  const requestConfirm = useCallback(
    (
      variant: ActionConfirmVariant,
      onConfirm: () => void,
      message?: string
    ) => {
      const next = { variant, message, onConfirm }
      pendingRef.current = next
      setPending(next)
    },
    []
  )

  const cancelConfirm = useCallback(() => {
    pendingRef.current = null
    setPending(null)
  }, [])

  const handleConfirm = useCallback(() => {
    pendingRef.current?.onConfirm()
    pendingRef.current = null
    setPending(null)
  }, [])

  const confirmProps = pending
    ? {
        open: true as const,
        variant: pending.variant,
        message: pending.message,
        onConfirm: handleConfirm,
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

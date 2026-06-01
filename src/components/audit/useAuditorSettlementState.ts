"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT,
  CLUB_SETTLEMENT_LOCK_CHANGED_EVENT,
  canAuditorActOnSettlement,
  makeClubAuditorAuditStatusKey,
  makeClubSettlementLockKey,
  getAuditorAuditStatus,
  getAuditorAuditStatusBadgeVariant,
  getAuditorAuditStatusLabel,
  readClubSettlementLocked,
  type AuditorAuditStatusValue,
} from "@/lib/clubSettlementPortalSync"

export function useAuditorSettlementState(clubId: string) {
  const [isClubSubmitted, setIsClubSubmitted] = useState(false)
  const [auditStatus, setAuditStatus] = useState<AuditorAuditStatusValue>("not_started")
  const [canReview, setCanReview] = useState(false)

  const sync = useCallback(() => {
    const locked = readClubSettlementLocked(clubId)
    const audit = getAuditorAuditStatus(clubId)
    setIsClubSubmitted(locked)
    setAuditStatus(audit)
    setCanReview(canAuditorActOnSettlement(clubId))
  }, [clubId])

  useEffect(() => {
    sync()
    const onChange = () => sync()
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === null ||
        e.key === makeClubSettlementLockKey(clubId) ||
        e.key === makeClubAuditorAuditStatusKey(clubId)
      ) {
        sync()
      }
    }
    window.addEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, onChange)
    window.addEventListener(CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT, onChange)
    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", sync)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") sync()
    })
    return () => {
      window.removeEventListener(CLUB_SETTLEMENT_LOCK_CHANGED_EVENT, onChange)
      window.removeEventListener(CLUB_AUDITOR_AUDIT_STATUS_CHANGED_EVENT, onChange)
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", sync)
    }
  }, [sync, clubId])

  const auditLabel = getAuditorAuditStatusLabel(auditStatus, isClubSubmitted)
  const auditBadgeVariant = getAuditorAuditStatusBadgeVariant(
    auditStatus,
    isClubSubmitted
  )
  const isApproved = auditStatus === "approved"

  return {
    isClubSubmitted,
    auditStatus,
    auditLabel,
    auditBadgeVariant,
    canReview,
    isApproved,
  }
}

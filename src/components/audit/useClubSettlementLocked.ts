"use client"

import { useAuditorSettlementState } from "@/components/audit/useAuditorSettlementState"

/**
 * @deprecated 監査人画面は useAuditorSettlementState を利用してください。
 * 提出ロックのみ必要な場合の互換ラッパー。
 */
export function useClubSettlementLocked(clubId: string) {
  const { isClubSubmitted } = useAuditorSettlementState(clubId)
  return isClubSubmitted
}

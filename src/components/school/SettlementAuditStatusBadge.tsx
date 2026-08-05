import {
  AUDITOR_APPROVED_BADGE_CLASSES,
  SETTLEMENT_AWAITING_MANAGER_BADGE_CLASSES,
  SETTLEMENT_IN_AUDIT_BADGE_CLASSES,
  SETTLEMENT_NOT_SUBMITTED_BADGE_CLASSES,
  SETTLEMENT_REJECTED_BADGE_CLASSES,
  type AuditorAuditBadgeVariant,
} from "@/lib/clubSettlementPortalSync"
import { cn } from "@/lib/utils"

/** クラブ/監査人ダッシュボードと共通の決算・監査ステータスバッジ */
export function SettlementAuditStatusBadge({
  label,
  variant,
}: {
  label: string
  variant: AuditorAuditBadgeVariant
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-16 shrink-0 items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium tracking-tight whitespace-nowrap",
        variant === "navy" && SETTLEMENT_IN_AUDIT_BADGE_CLASSES,
        variant === "amber" && SETTLEMENT_AWAITING_MANAGER_BADGE_CLASSES,
        variant === "approved" && AUDITOR_APPROVED_BADGE_CLASSES,
        variant === "rejected" && SETTLEMENT_REJECTED_BADGE_CLASSES,
        variant === "muted" && SETTLEMENT_NOT_SUBMITTED_BADGE_CLASSES,
      )}
    >
      {label}
    </span>
  )
}

import {
  AUDITOR_AUDIT_STATUS_LABELS,
  type AuditorAuditStatus,
} from "@/lib/schoolAuditors"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<
  AuditorAuditStatus,
  { className: string; label: string }
> = {
  before: {
    label: AUDITOR_AUDIT_STATUS_LABELS.before,
    className: "bg-gray-100 text-[#6B7280] border-gray-200",
  },
  in_progress: {
    label: AUDITOR_AUDIT_STATUS_LABELS.in_progress,
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
  completed: {
    label: AUDITOR_AUDIT_STATUS_LABELS.completed,
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
}

export function AuditorAuditStatusBadge({
  status,
}: {
  status: AuditorAuditStatus
}) {
  const style = STATUS_STYLES[status]
  return (
    <span
      className={cn(
        "inline-flex min-w-[3.5rem] justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        style.className
      )}
    >
      {style.label}
    </span>
  )
}

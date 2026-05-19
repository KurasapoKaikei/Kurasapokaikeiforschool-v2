import {
  CLUB_SETTLEMENT_STATUS_META,
  type ClubSettlementStatus,
} from "@/lib/schoolClubSettlement"

export function SchoolClubSettlementBadge({
  status,
}: {
  status: ClubSettlementStatus
}) {
  const meta = CLUB_SETTLEMENT_STATUS_META[status]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  )
}

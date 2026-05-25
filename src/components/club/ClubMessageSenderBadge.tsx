import type { PortalMessageSender } from "@/lib/portalMessages"

const BADGE_STYLES: Record<PortalMessageSender, string> = {
  school: "bg-[#DBEAFE] text-[#1E40AF] border border-[#93C5FD]",
  system: "bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7]",
}

/** 送信元バッジ（学校 / クラサポ会計） */
export function ClubMessageSenderBadge({
  sender,
  label,
}: {
  sender: PortalMessageSender
  label: string
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${BADGE_STYLES[sender]}`}
    >
      {label}
    </span>
  )
}

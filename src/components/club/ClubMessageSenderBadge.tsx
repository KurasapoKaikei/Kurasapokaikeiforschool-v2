import {
  getClubSenderLabel,
  type PortalMessageSender,
} from "@/lib/portalMessages"

/** 送信元バッジ（学校 / 監査 / クラサポ） */
const BADGE_STYLES: Record<PortalMessageSender, string> = {
  school: "bg-[#2563EB] text-white",
  audit: "bg-[#EA580C] text-white",
  system: "bg-[#059669] text-white",
}

export function ClubMessageSenderBadge({
  sender,
  label,
}: {
  sender: PortalMessageSender
  /** 未指定時は送信元に応じた既定ラベル */
  label?: string
}) {
  const text = label ?? getClubSenderLabel(sender)

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${BADGE_STYLES[sender]}`}
    >
      {text}
    </span>
  )
}

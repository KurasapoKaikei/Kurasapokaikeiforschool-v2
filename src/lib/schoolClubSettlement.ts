/** 学校ポータル：クラブ決算提出ステータス（デモ用モック） */

export type ClubSettlementStatus = "draft" | "auditing" | "approved"

const STORAGE_KEY = "kurasaokaikei-school-club-settlement-status"

export const CLUB_SETTLEMENT_STATUS_META: Record<
  ClubSettlementStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "作成中",
    className: "bg-gray-100 text-gray-700 border border-gray-300",
  },
  auditing: {
    label: "監査中",
    className: "bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]",
  },
  approved: {
    label: "承認済",
    className: "bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7]",
  },
}

function normalizeStatus(raw: string): ClubSettlementStatus {
  if (raw === "submitted") return "auditing"
  if (raw === "draft" || raw === "auditing" || raw === "approved") return raw
  return "draft"
}

function loadAll(): Record<string, ClubSettlementStatus> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    if (!parsed || typeof parsed !== "object") return {}
    const out: Record<string, ClubSettlementStatus> = {}
    for (const [id, status] of Object.entries(parsed)) {
      out[id] = normalizeStatus(status)
    }
    return out
  } catch {
    return {}
  }
}

function saveAll(map: Record<string, ClubSettlementStatus>): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

function mockStatusForClubId(clubId: string): ClubSettlementStatus {
  const options: ClubSettlementStatus[] = ["draft", "auditing", "approved"]
  const sum = clubId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return options[sum % options.length]
}

/** 未設定クラブにデモ用ステータスを割り当てて返す */
export function ensureClubSettlementStatuses(
  clubIds: string[]
): Record<string, ClubSettlementStatus> {
  const current = loadAll()
  let changed = false
  for (const id of clubIds) {
    if (!current[id]) {
      current[id] = mockStatusForClubId(id)
      changed = true
    }
  }
  if (changed) saveAll(current)
  return current
}

export function getClubSettlementStatus(
  clubId: string
): ClubSettlementStatus {
  const map = loadAll()
  return map[clubId] ?? mockStatusForClubId(clubId)
}

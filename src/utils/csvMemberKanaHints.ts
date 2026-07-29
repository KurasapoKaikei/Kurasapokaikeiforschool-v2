/**
 * CSV 摘要に含まれる半角カナ等と部員の対応を学習・候補提示する。
 * 部員マスタにフリガナ欄がないため、取込時の選択結果を localStorage に蓄積する。
 */

import type { Member } from "@/utils/localStorage"

const STORAGE_KEY = "classapo_csv_member_kana_hints"

export type MemberKanaHint = {
  memberId: string
  memberName: string
  hits: number
  lastAt: string
}

type HintStore = Record<string, MemberKanaHint[]>

/** 半角・全角カタカナ連続を抽出（長音・中黒含む） */
export function extractKanaTokens(raw: string): string[] {
  if (!raw) return []
  const nfkc = raw.normalize("NFKC")
  const matches = nfkc.match(/[\u30A0-\u30FFー・]+/g) ?? []
  const tokens = matches
    .map((t) => t.replace(/[・\s]/g, "").trim())
    .filter((t) => t.length >= 2)
  return Array.from(new Set(tokens))
}

function readStore(): HintStore {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as HintStore
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store: HintStore): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* ignore quota */
  }
}

/** 摘要のカナ断片と部員選択を学習 */
export function learnMemberFromCsvMemo(memo: string, member: Member): void {
  const tokens = extractKanaTokens(memo)
  if (tokens.length === 0) return
  const store = readStore()
  const now = new Date().toISOString()
  for (const token of tokens) {
    const list = store[token] ?? []
    const idx = list.findIndex((h) => h.memberId === member.id)
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        memberName: member.name,
        hits: list[idx].hits + 1,
        lastAt: now,
      }
    } else {
      list.push({ memberId: member.id, memberName: member.name, hits: 1, lastAt: now })
    }
    store[token] = list.sort((a, b) => b.hits - a.hits || b.lastAt.localeCompare(a.lastAt))
  }
  writeStore(store)
}

export type MemberSuggestion = {
  member: Member
  /** 表示用「もしかして3年 山田太郎？」 */
  label: string
  reason: "kana" | "name" | "both"
  score: number
}

function suggestionLabel(m: Member): string {
  return `もしかして${m.grade}年 ${m.name}？`
}

/**
 * 摘要から部員候補を推定。
 * - 学習済みカナ対応
 * - 摘要に氏名（漢字）が含まれる場合
 * 同姓など複数ヒットはすべて返す。
 */
export function suggestMembersFromCsvMemo(
  memo: string,
  members: Member[]
): MemberSuggestion[] {
  const active = members.filter((m) => m.status === "active")
  if (active.length === 0) return []

  const scores = new Map<string, { member: Member; score: number; reason: "kana" | "name" | "both" }>()
  const bump = (m: Member, add: number, reason: "kana" | "name") => {
    const prev = scores.get(m.id)
    if (!prev) {
      scores.set(m.id, { member: m, score: add, reason })
      return
    }
    const nextReason =
      prev.reason !== reason ? "both" : prev.reason
    scores.set(m.id, { member: m, score: prev.score + add, reason: nextReason })
  }

  const memoNfkc = (memo || "").normalize("NFKC")
  for (const m of active) {
    const name = (m.name || "").trim()
    if (name.length >= 1 && memoNfkc.includes(name)) {
      bump(m, 100, "name")
    }
  }

  const tokens = extractKanaTokens(memo)
  const store = readStore()
  for (const token of tokens) {
    const hints = store[token] ?? []
    for (const h of hints) {
      const m = active.find((x) => x.id === h.memberId)
      if (!m) continue
      bump(m, 50 + Math.min(h.hits, 20), "kana")
    }
  }

  return Array.from(scores.values())
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.member.grade - b.member.grade ||
        a.member.name.localeCompare(b.member.name, "ja")
    )
    .map((s) => ({
      member: s.member,
      label: suggestionLabel(s.member),
      reason: s.reason,
      score: s.score,
    }))
}

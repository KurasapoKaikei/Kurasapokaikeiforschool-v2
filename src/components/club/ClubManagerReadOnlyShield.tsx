"use client"

import { useEffect } from "react"
import { getClubLoginRole } from "@/lib/clubLoginSession"
import { CLUB_PORTAL_SESSION_CHANGED_EVENT } from "@/lib/clubPortalSessionEvents"

const INTERACTIVE_SELECTOR =
  'button, input, select, textarea, [role="button"], [contenteditable="true"]'

/**
 * 責任者ログイン時、メイン領域の登録・編集・削除操作をキャプチャ段階で抑止する。
 * スクロール・閲覧・サイドバー遷移は可能。承認 UI（data-manager-action）は除外。
 */
export function ClubManagerReadOnlyShield() {
  useEffect(() => {
    let enabled = getClubLoginRole() === "manager"

    const sync = () => {
      enabled = getClubLoginRole() === "manager"
    }

    const shouldBlock = (target: EventTarget | null): boolean => {
      if (!enabled || !(target instanceof Element)) return false
      // 承認・メッセージ閲覧／確認など、責任者に許可する操作
      if (target.closest("[data-manager-action]")) return false
      const el = target.closest(INTERACTIVE_SELECTOR)
      if (!el) return false
      // 年度切替などはヘッダー側。メイン内の読み取り専用表示は許可
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        if (el.readOnly || el.disabled) return false
      }
      return true
    }

    const onClick = (e: Event) => {
      if (!shouldBlock(e.target)) return
      e.preventDefault()
      e.stopPropagation()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return
      if (!shouldBlock(e.target)) return
      e.preventDefault()
      e.stopPropagation()
    }

    const root = document.querySelector(".club-portal-main-content")
    root?.addEventListener("click", onClick, true)
    root?.addEventListener("keydown", onKeyDown, true)
    window.addEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, sync)
    window.addEventListener("storage", sync)

    return () => {
      root?.removeEventListener("click", onClick, true)
      root?.removeEventListener("keydown", onKeyDown, true)
      window.removeEventListener(CLUB_PORTAL_SESSION_CHANGED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  return null
}

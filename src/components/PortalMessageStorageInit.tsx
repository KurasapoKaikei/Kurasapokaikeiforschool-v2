"use client"

import { useEffect } from "react"
import { ensurePortalMessagesClearedOnce } from "@/lib/portalMessageStorage"

/** 全ポータル共通：メッセージBOXの初回一括クリア（1回のみ） */
export function PortalMessageStorageInit() {
  useEffect(() => {
    ensurePortalMessagesClearedOnce()
  }, [])
  return null
}

"use client"

import { useRouter } from "next/navigation"
import { PortalUnifiedHeader } from "@/components/layout/PortalUnifiedHeader"
import { clearCurrentAuditor } from "@/lib/currentAuditor"

/** 監査人ポータル共通ヘッダー（3段・オレンジ帯） */
export function AuditorHeader() {
  const router = useRouter()

  const handleLogout = () => {
    clearCurrentAuditor()
    router.push("/")
  }

  return (
    <PortalUnifiedHeader
      portal="audit"
      portalTitle="監査人ポータル"
      onLogout={handleLogout}
    />
  )
}

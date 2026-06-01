"use client"

import { useRouter } from "next/navigation"
import { PortalUnifiedHeader } from "@/components/layout/PortalUnifiedHeader"
import { clearSchoolAdminSession } from "@/lib/schoolLoginSession"

/** 学校管理者ポータル共通ヘッダー（3段・ネイビー帯） */
export function SchoolHeader() {
  const router = useRouter()

  const handleLogout = () => {
    clearSchoolAdminSession()
    router.push("/")
  }

  return (
    <PortalUnifiedHeader
      portal="school"
      portalTitle="学校管理者ポータル"
      onLogout={handleLogout}
    />
  )
}

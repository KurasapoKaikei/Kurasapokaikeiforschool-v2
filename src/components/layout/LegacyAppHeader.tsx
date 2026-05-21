"use client"

import { usePathname } from "next/navigation"
import { useUserInfo } from "@/contexts/UserInfoContext"
import { clubRelativePath, isClubPath } from "@/lib/routes"

interface LegacyAppHeaderProps {
  title?: string
}

const pageTitleMap: Record<string, string> = {
  "/parent": "保護者マイページ",
  "/member": "部員・保護者マイページ",
}

const pageColorMap: Record<string, string> = {
  "/parent": "#7C6BA8",
  "/member": "#9D8CC3",
}

/** 保護者・部員などクラブ以外の AppShell 用ヘッダー */
export function LegacyAppHeader({ title }: LegacyAppHeaderProps) {
  const pathname = usePathname()
  const rel = clubRelativePath(pathname)
  const { userInfo } = useUserInfo()

  const displayTitle =
    title ||
    (pathname.startsWith("/parent")
      ? "保護者マイページ"
      : pathname.startsWith("/member")
        ? "部員・保護者マイページ"
        : isClubPath(pathname)
          ? pageTitleMap[rel] || "クラブポータル"
          : pageTitleMap[pathname] || "クラブポータル")

  const themeColor = pathname.startsWith("/member")
    ? "#9D8CC3"
    : pathname.startsWith("/parent")
      ? "#7C6BA8"
      : pageColorMap[pathname] || "#7C6BA8"

  const organizationName = userInfo.organizationName
  const fiscalPeriod = userInfo.fiscalPeriod

  return (
    <header className="sticky top-0 z-50">
      <div className="bg-[#F5F5F0] px-6 py-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold text-[#374151]">{organizationName}</h1>
          <span className="text-sm text-[#6B7280]">{fiscalPeriod}</span>
        </div>
      </div>
      <div className="text-white" style={{ backgroundColor: themeColor }}>
        <div className="flex h-12 items-center px-6">
          <h2 className="text-lg font-semibold">{displayTitle}</h2>
        </div>
      </div>
    </header>
  )
}

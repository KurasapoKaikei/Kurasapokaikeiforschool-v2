"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useUserInfo } from "@/contexts/UserInfoContext"
import {
  LayoutDashboard,
  Receipt,
  BookOpen,
  Wallet,
  Users,
  Settings,
  HelpCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react"

interface SubMenuItem {
  title: string
  href: string
}

interface MenuItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  colorHex: string
  subItems?: SubMenuItem[]
}

const menuItems: MenuItem[] = [
  {
    title: "マイページ",
    href: "/dashboard",
    icon: LayoutDashboard,
    color: "dashboard",
    colorHex: "#E66A84", // ピンク
  },
  {
    title: "入出金登録",
    href: "/accounting/register",
    icon: Receipt,
    color: "accounting",
    colorHex: "#A3BC68", // 黄緑
    subItems: [
      { title: "新規登録", href: "/accounting/register/new" },
      { title: "登録履歴", href: "/accounting/register/history" },
    ],
  },
  {
    title: "集金・帳簿",
    href: "/accounting/ledger",
    icon: BookOpen,
    color: "ledger",
    colorHex: "#68A384", // 集計・帳簿（青緑）
    subItems: [
      { title: "収支集計表", href: "/accounting/summary" },
      { title: "現金・預金出納帳", href: "/accounting/ledger/cash-bank" },
      { title: "科目別台帳", href: "/accounting/ledger/subject" },
      { title: "収支報告書", href: "/accounting/report" },
    ],
  },
  {
    title: "集金管理",
    href: "/collection",
    icon: Wallet,
    color: "collection",
    colorHex: "#D99529", // オレンジ
    subItems: [
      { title: "集金実績", href: "/collection/history" },
      { title: "集金予定一覧", href: "/collection/schedule" },
      { title: "集金設定", href: "/collection/settings" },
    ],
  },
  {
    title: "部員管理",
    href: "/members",
    icon: Users,
    color: "members",
    colorHex: "#9D8CC3", // パープル
    subItems: [
      { title: "部員一覧", href: "/members/list" },
      { title: "部員登録", href: "/members/register" },
    ],
  },
  {
    title: "設定",
    href: "/settings",
    icon: Settings,
    color: "settings",
    colorHex: "#77B8DA", // ブルー
    subItems: [
      { title: "クラブ設定", href: "/settings/club" },
      { title: "カテゴリー設定", href: "/settings/category" },
      { title: "科目設定", href: "/settings/account-titles" },
    ],
  },
  {
    title: "操作ガイド",
    href: "/guide",
    icon: HelpCircle,
    color: "settings",
    colorHex: "#4A90E2", // 少し濃いブルー
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { userInfo } = useUserInfo()
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    // 現在のパスに基づいて初期展開状態を決定
    const initialExpanded: string[] = []
    menuItems.forEach((item) => {
      if (item.subItems) {
        const hasActiveSubItem = item.subItems.some(
          (subItem) => pathname === subItem.href || pathname.startsWith(subItem.href + "/")
        )
        if (hasActiveSubItem) {
          initialExpanded.push(item.href)
        }
      }
    })
    return initialExpanded
  })

  const toggleExpanded = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
    )
  }

  const isItemActive = (item: MenuItem) => {
    if (item.subItems) {
      return item.subItems.some(
        (subItem) => pathname === subItem.href || pathname.startsWith(subItem.href + "/")
      )
    }
    return pathname === item.href || pathname.startsWith(item.href + "/")
  }

  const isSubItemActive = (subItem: SubMenuItem) => {
    return pathname === subItem.href || pathname.startsWith(subItem.href + "/")
  }

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-200 bg-white">
      <div className="flex h-full flex-col">
        {/* ロゴ・ヘッダー */}
        <div className="flex h-16 items-center border-b border-gray-200 px-6">
          <h1 className="text-xl font-bold text-[#374151]">クラサポ会計</h1>
        </div>

        {/* ナビゲーションメニュー */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon
            const hasSubItems = item.subItems && item.subItems.length > 0
            const isExpanded = expandedItems.includes(item.href)
            const isActive = isItemActive(item)

            return (
              <div key={item.href}>
                {/* メインメニューアイテム */}
                {hasSubItems ? (
                  <button
                    onClick={() => toggleExpanded(item.href)}
                    className={cn(
                      "group relative flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-[#FCE7F3] text-[#374151]"
                        : "text-[#374151] hover:bg-gray-50"
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {/* 左端のアクセント線 */}
                      {isActive && (
                        <div
                          className="absolute left-0 top-0 h-full w-1 rounded-l-lg"
                          style={{ backgroundColor: item.colorHex }}
                        />
                      )}
                      <Icon
                        className="h-5 w-5 flex-shrink-0"
                        style={{
                          color: item.colorHex,
                          strokeWidth: 2.5,
                        }}
                      />
                      <span className="text-[#374151]">{item.title}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-[#6B7280]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[#6B7280]" />
                    )}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-[#FCE7F3] text-[#374151]"
                        : "text-[#374151] hover:bg-gray-50"
                    )}
                  >
                    {/* 左端のアクセント線 */}
                    {isActive && (
                      <div
                        className="absolute left-0 top-0 h-full w-1 rounded-l-lg"
                        style={{ backgroundColor: item.colorHex }}
                      />
                    )}
                    <Icon
                      className="h-5 w-5 flex-shrink-0"
                      style={{
                        color: item.colorHex,
                        strokeWidth: 2.5,
                      }}
                    />
                    <span className="text-[#374151]">{item.title}</span>
                  </Link>
                )}

                {/* サブメニュー */}
                {hasSubItems && isExpanded && (
                  <div className="ml-8 mt-1 space-y-1">
                    {item.subItems!.map((subItem) => {
                      const subIsActive = isSubItemActive(subItem)
                      // 「for school」ユーザーの場合、「クラブ設定」をグレーアウト
                      const isDisabled = userInfo.isForSchool && subItem.href === "/settings/club"
                      
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                            isDisabled
                              ? "text-gray-400 cursor-not-allowed pointer-events-none"
                              : subIsActive
                              ? "bg-[#FCE7F3] text-[#374151] font-medium"
                              : "text-[#6B7280] hover:bg-gray-50 hover:text-[#374151]"
                          )}
                          onClick={(e) => {
                            if (isDisabled) {
                              e.preventDefault()
                            }
                          }}
                        >
                          <div
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              subIsActive ? item.colorHex : isDisabled ? "bg-gray-300" : "bg-gray-300"
                            )}
                            style={subIsActive && !isDisabled ? { backgroundColor: item.colorHex } : {}}
                          />
                          <span>{subItem.title}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { KurasapoBrandLogo } from "@/components/layout/KurasapoBrandLogo"
import { clubPath } from "@/lib/routes"
import {
  LayoutDashboard,
  Mail,
  Receipt,
  BookOpen,
  Wallet,
  BarChart3,
  Users,
  Settings,
  ClipboardCheck,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from "lucide-react"

interface SubMenuItem {
  title: string
  href: string
}

interface MenuItem {
  title: string
  href: string
  icon: LucideIcon
  color: string
  colorHex: string
  subItems?: SubMenuItem[]
}

const menuItems: MenuItem[] = [
  {
    title: "ポータルトップ",
    href: clubPath("/dashboard"),
    icon: LayoutDashboard,
    color: "dashboard",
    colorHex: "#E66A84", // ピンク
  },
  {
    title: "入出金登録",
    href: clubPath("/accounting/input"),
    icon: Receipt,
    color: "accounting",
    colorHex: "#A3BC68", // 黄緑
    subItems: [
      { title: "新規登録", href: clubPath("/accounting/register/new") },
      { title: "登録履歴", href: clubPath("/accounting/register/history") },
    ],
  },
  {
    title: "集計・帳簿",
    href: clubPath("/accounting/ledger"),
    icon: BookOpen,
    color: "ledger",
    colorHex: "#68A384", // 集計・帳簿（青緑）
    subItems: [
      { title: "収支集計表", href: clubPath("/accounting/summary") },
      { title: "現金・預金出納帳", href: clubPath("/accounting/ledger/cash-bank") },
      { title: "科目別台帳", href: clubPath("/accounting/ledger/subject") },
      { title: "収支報告書", href: clubPath("/accounting/report") },
    ],
  },
  {
    title: "集金管理",
    href: clubPath("/collection"),
    icon: Wallet,
    color: "collection",
    colorHex: "#D99529", // オレンジ
    subItems: [
      { title: "集金実績", href: clubPath("/collection/history") },
      { title: "集金予定一覧", href: clubPath("/collection/schedule") },
      { title: "集金設定", href: clubPath("/collection/settings") },
    ],
  },
  {
    title: "予実管理",
    href: clubPath("/budget"),
    icon: BarChart3,
    color: "budget",
    colorHex: "#1A237E", // ディープインディゴ
    subItems: [
      { title: "予算書", href: clubPath("/budget/book") },
      { title: "前年度比", href: clubPath("/budget/comparison") },
    ],
  },
  {
    title: "部員管理",
    href: clubPath("/members"),
    icon: Users,
    color: "members",
    colorHex: "#9D8CC3", // パープル
    subItems: [
      { title: "部員一覧", href: clubPath("/members/list") },
      { title: "部員登録", href: clubPath("/members/register") },
    ],
  },
  {
    title: "メッセージBOX",
    href: clubPath("/messages"),
    icon: Mail,
    color: "dashboard",
    colorHex: "#4A90E2",
  },
  {
    title: "決算",
    href: clubPath("/settlement"),
    icon: ClipboardCheck,
    color: "settings",
    colorHex: "#005088",
  },
  {
    title: "設定",
    href: clubPath("/settings"),
    icon: Settings,
    color: "settings",
    colorHex: "#77B8DA", // ブルー
    subItems: [
      { title: "クラブ設定", href: clubPath("/settings/club") },
      { title: "担当者設定", href: clubPath("/settings/staff") },
      { title: "カテゴリー設定", href: clubPath("/settings/category") },
      { title: "科目設定", href: clubPath("/settings/account-titles") },
    ],
  },
  {
    title: "操作ガイド",
    href: clubPath("/guide"),
    icon: HelpCircle,
    color: "settings",
    colorHex: "#4A90E2", // 少し濃いブルー
  },
]

/** サブメニュー href と現在パスの一致（`/budget/comparison` → `year-over-year` へのリダイレクトも同一扱い） */
function subItemPathMatches(pathname: string, subHref: string): boolean {
  if (pathname === subHref || pathname.startsWith(`${subHref}/`)) return true
  if (
    subHref === clubPath("/budget/comparison") &&
    pathname.startsWith(clubPath("/budget/year-over-year"))
  ) {
    return true
  }
  return false
}

export function Sidebar() {
  const navyColor = "#001e43"
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    const initialExpanded: string[] = []
    menuItems.forEach((item) => {
      if (item.subItems) {
        const hasActiveSubItem = item.subItems.some((subItem) =>
          subItemPathMatches(pathname, subItem.href)
        )
        if (hasActiveSubItem) {
          initialExpanded.push(item.href)
        }
      }
    })
    return initialExpanded
  })

  useEffect(() => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      menuItems.forEach((item) => {
        if (!item.subItems) return
        if (item.subItems.some((sub) => subItemPathMatches(pathname, sub.href))) {
          next.add(item.href)
        }
      })
      return Array.from(next)
    })
  }, [pathname])

  const toggleExpanded = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
    )
  }

  const isItemActive = (item: MenuItem) => {
    if (item.subItems) {
      return item.subItems.some((subItem) => subItemPathMatches(pathname, subItem.href))
    }
    return pathname === item.href || pathname.startsWith(item.href + "/")
  }

  const isSubItemActive = (subItem: SubMenuItem) => {
    return subItemPathMatches(pathname, subItem.href)
  }

  return (
    <aside
      className="z-[100] flex min-h-screen w-64 shrink-0 flex-col self-stretch border-r border-gray-200 bg-white isolate pointer-events-auto"
      aria-label="クラブポータル メニュー"
    >
      {/* ロゴ・ヘッダー */}
      <div className="shrink-0 border-b border-gray-200 px-4 py-4">
        <KurasapoBrandLogo />
        <p className="mt-2 text-xs font-medium text-[#6B7280]">クラブポータル</p>
      </div>

      {/* ナビゲーション：本体（main）の高さに合わせてサイドバー全体が伸長する */}
      <nav className="flex-1 space-y-1 px-3 py-4">
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
                        ? "bg-[#E6ECF5] text-[#001e43]"
                        : "text-[#374151] hover:bg-gray-50"
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {/* 左端のアクセント線 */}
                      {isActive && (
                        <div
                          className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-lg"
                          style={{ backgroundColor: item.colorHex }}
                        />
                      )}
                      <Icon
                        className="pointer-events-none h-5 w-5 flex-shrink-0"
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
                        ? "bg-[#E6ECF5] text-[#001e43]"
                        : "text-[#374151] hover:bg-gray-50"
                    )}
                  >
                    {/* 左端のアクセント線 */}
                    {isActive && (
                      <div
                        className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-lg"
                        style={{ backgroundColor: item.colorHex }}
                      />
                    )}
                    <Icon
                      className="pointer-events-none h-5 w-5 flex-shrink-0"
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

                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          prefetch
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                            subIsActive
                              ? "bg-[#E6ECF5] text-[#001e43] font-medium"
                              : "text-[#6B7280] hover:bg-gray-50 hover:text-[#374151]"
                          )}
                        >
                          <div
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              subIsActive ? item.colorHex : "bg-gray-300"
                            )}
                            style={subIsActive ? { backgroundColor: navyColor } : {}}
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
    </aside>
  )
}

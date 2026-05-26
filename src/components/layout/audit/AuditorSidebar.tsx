"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronDown,
  ChevronRight,
  FileEdit,
  HelpCircle,
  LayoutDashboard,
  List,
  Mail,
  type LucideIcon,
} from "lucide-react"
import { KurasapoBrandLogo } from "@/components/layout/KurasapoBrandLogo"
import {
  AUDIT_BRAND_ORANGE,
  AUDIT_ROUTES,
  isAuditMessagesPath,
  safeAuditPathname,
} from "@/lib/auditorTheme"
import { cn } from "@/lib/utils"

const MESSAGES_PARENT_KEY = AUDIT_ROUTES.messagesBase

interface SubMenuItem {
  title: string
  href: string
}

interface MenuItem {
  title: string
  href: string
  icon: LucideIcon
  match?: (path: string) => boolean
  subItems?: SubMenuItem[]
  parentKey?: "messages"
}

const MENU_ITEMS: MenuItem[] = [
  {
    title: "ポータルトップ",
    href: AUDIT_ROUTES.home,
    icon: LayoutDashboard,
    match: (path) => path === AUDIT_ROUTES.home,
  },
  {
    title: "メッセージBOX",
    href: MESSAGES_PARENT_KEY,
    icon: Mail,
    parentKey: "messages",
    subItems: [
      { title: "メッセージ一覧", href: AUDIT_ROUTES.messages },
      { title: "下書き", href: AUDIT_ROUTES.messagesDrafts },
    ],
  },
  {
    title: "操作ガイド",
    href: AUDIT_ROUTES.guide,
    icon: HelpCircle,
    match: (path) => path.startsWith(AUDIT_ROUTES.guide),
  },
]

function subItemPathMatches(pathname: string | null, subHref: string): boolean {
  const path = safeAuditPathname(pathname)
  if (subHref === AUDIT_ROUTES.messages) {
    return path === AUDIT_ROUTES.messages
  }
  if (subHref === AUDIT_ROUTES.messagesDrafts) {
    return (
      path === AUDIT_ROUTES.messagesDrafts ||
      path.startsWith(`${AUDIT_ROUTES.messagesDrafts}/`)
    )
  }
  return path === subHref || path.startsWith(`${subHref}/`)
}

function getSubIcon(href: string): LucideIcon {
  if (href === AUDIT_ROUTES.messages) return List
  if (href === AUDIT_ROUTES.messagesDrafts) return FileEdit
  return List
}

function initialExpanded(pathname: string | null): string[] {
  return isAuditMessagesPath(pathname) ? [MESSAGES_PARENT_KEY] : []
}

export function AuditorSidebar() {
  const pathname = safeAuditPathname(usePathname())
  const [expandedItems, setExpandedItems] = useState<string[]>(() =>
    initialExpanded(pathname)
  )

  useEffect(() => {
    if (isAuditMessagesPath(pathname)) {
      setExpandedItems((prev) =>
        prev.includes(MESSAGES_PARENT_KEY)
          ? prev
          : [...prev, MESSAGES_PARENT_KEY]
      )
    }
  }, [pathname])

  const toggleExpanded = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
    )
  }

  const isParentActive = (item: MenuItem) =>
    item.parentKey === "messages" && isAuditMessagesPath(pathname)

  const isItemActive = (item: MenuItem) => {
    if (item.subItems) return isParentActive(item)
    return item.match?.(pathname) ?? pathname === item.href
  }

  const isSubItemActive = (sub: SubMenuItem) =>
    subItemPathMatches(pathname, sub.href)

  return (
    <aside className="fixed left-0 top-0 z-20 flex h-screen w-64 flex-col border-r border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-5">
        <Link href={AUDIT_ROUTES.home} className="block hover:opacity-90">
          <KurasapoBrandLogo />
        </Link>
        <p className="mt-2 text-xs font-medium text-[#6B7280]">監査人ポータル</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="監査人メニュー">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon
          const hasSubItems = item.subItems && item.subItems.length > 0
          const isExpanded = expandedItems.includes(item.href)
          const isActive = isItemActive(item)

          return (
            <div key={item.href}>
              {hasSubItems ? (
                <button
                  type="button"
                  onClick={() => toggleExpanded(item.href)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-orange-50 text-orange-800"
                      : "text-[#374151] hover:bg-gray-50"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      className="h-5 w-5 shrink-0"
                      style={isActive ? { color: AUDIT_BRAND_ORANGE } : undefined}
                    />
                    {item.title}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
                  )}
                </button>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-orange-50 text-orange-800"
                      : "text-[#374151] hover:bg-gray-50"
                  )}
                >
                  <Icon
                    className="h-5 w-5 shrink-0"
                    style={isActive ? { color: AUDIT_BRAND_ORANGE } : undefined}
                  />
                  {item.title}
                </Link>
              )}

              {hasSubItems && isExpanded ? (
                <ul className="ml-4 mt-1 space-y-0.5 border-l-2 border-orange-100 pl-3">
                  {item.subItems!.map((sub) => {
                    const SubIcon = getSubIcon(sub.href)
                    const subActive = isSubItemActive(sub)
                    return (
                      <li key={sub.href}>
                        <Link
                          href={sub.href}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
                            subActive
                              ? "bg-orange-50 font-medium text-orange-700"
                              : "text-[#6B7280] hover:bg-gray-50 hover:text-[#374151]"
                          )}
                        >
                          <SubIcon className="h-4 w-4 shrink-0" />
                          {sub.title}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

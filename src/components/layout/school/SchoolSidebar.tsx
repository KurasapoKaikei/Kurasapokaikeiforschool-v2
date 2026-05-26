"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  isSchoolClubPath,
  isSchoolMessagesPath,
  isSchoolSettingsPath,
  SCHOOL_PAGE_TITLES,
  SCHOOL_ROUTES,
  SCHOOL_THEME,
} from "@/lib/schoolTheme"
import { KurasapoBrandLogo } from "@/components/layout/KurasapoBrandLogo"
import {
  loadSchoolUseAuditFlow,
  SCHOOL_AUDIT_FLOW_CHANGED_EVENT,
} from "@/lib/schoolAuditFlow"
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileEdit,
  FileText,
  Layers,
  LayoutDashboard,
  List,
  ListOrdered,
  Mail,
  Plus,
  Settings,
  SlidersHorizontal,
  Tags,
  UserCog,
  Users,
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
  match?: (path: string) => boolean
  subItems?: SubMenuItem[]
  parentKey?: "club" | "settings" | "messages"
}

const CLUB_PARENT_KEY = SCHOOL_ROUTES.clubsBase
const SETTINGS_PARENT_KEY = SCHOOL_ROUTES.settingsBase
const MESSAGES_PARENT_KEY = SCHOOL_ROUTES.messages

function buildMenuItems(auditFlowEnabled: boolean): MenuItem[] {
  const clubSubItems: SubMenuItem[] = [
    { title: SCHOOL_PAGE_TITLES.clubList, href: SCHOOL_ROUTES.clubList },
    { title: SCHOOL_PAGE_TITLES.clubGroups, href: SCHOOL_ROUTES.clubGroups },
    { title: SCHOOL_PAGE_TITLES.clubRegister, href: SCHOOL_ROUTES.clubRegister },
  ]

  return [
    {
      title: "ポータルトップ",
      href: SCHOOL_ROUTES.home,
      icon: LayoutDashboard,
      match: (path) => path === SCHOOL_ROUTES.home,
    },
    {
      title: SCHOOL_PAGE_TITLES.messages,
      href: MESSAGES_PARENT_KEY,
      icon: Mail,
      parentKey: "messages",
      subItems: [
        { title: SCHOOL_PAGE_TITLES.messagesList, href: SCHOOL_ROUTES.messages },
        {
          title: SCHOOL_PAGE_TITLES.messagesDrafts,
          href: SCHOOL_ROUTES.messagesDrafts,
        },
      ],
    },
    {
      title: SCHOOL_PAGE_TITLES.clubs,
      href: CLUB_PARENT_KEY,
      icon: Users,
      parentKey: "club",
      subItems: clubSubItems,
    },
    ...(auditFlowEnabled
      ? ([
          {
            title: SCHOOL_PAGE_TITLES.auditors,
            href: SCHOOL_ROUTES.auditors,
            icon: ClipboardCheck,
            match: (path) =>
              path === SCHOOL_ROUTES.auditors ||
              path.startsWith(`${SCHOOL_ROUTES.auditors}/`),
          },
        ] satisfies MenuItem[])
      : []),
    {
      title: SCHOOL_PAGE_TITLES.contract,
      href: SCHOOL_ROUTES.contract,
      icon: FileText,
      match: (path) => path.startsWith(SCHOOL_ROUTES.contract),
    },
    {
      title: SCHOOL_PAGE_TITLES.settings,
      href: SETTINGS_PARENT_KEY,
      icon: Settings,
      parentKey: "settings",
      subItems: [
        {
          title: SCHOOL_PAGE_TITLES.settingsCategory,
          href: SCHOOL_ROUTES.settingsCategory,
        },
        {
          title: SCHOOL_PAGE_TITLES.settingsAccountTitles,
          href: SCHOOL_ROUTES.settingsAccountTitles,
        },
        { title: SCHOOL_PAGE_TITLES.settingsStaff, href: SCHOOL_ROUTES.settingsStaff },
        {
          title: SCHOOL_PAGE_TITLES.settingsAuditFlow,
          href: SCHOOL_ROUTES.settingsAuditFlow,
        },
      ],
    },
    {
      title: SCHOOL_PAGE_TITLES.guide,
      href: SCHOOL_ROUTES.guide,
      icon: BookOpen,
      match: (path) => path.startsWith(SCHOOL_ROUTES.guide),
    },
  ]
}

function subItemPathMatches(pathname: string, subHref: string): boolean {
  if (subHref === SCHOOL_ROUTES.messages) {
    return pathname === SCHOOL_ROUTES.messages
  }
  if (subHref === SCHOOL_ROUTES.messagesDrafts) {
    return (
      pathname === SCHOOL_ROUTES.messagesDrafts ||
      pathname.startsWith(`${SCHOOL_ROUTES.messagesDrafts}/`)
    )
  }
  if (subHref === SCHOOL_ROUTES.clubList) {
    return pathname === SCHOOL_ROUTES.clubList
  }
  if (subHref === SCHOOL_ROUTES.auditors) {
    return (
      pathname === SCHOOL_ROUTES.auditors ||
      pathname.startsWith(`${SCHOOL_ROUTES.auditors}/`)
    )
  }
  if (subHref === SCHOOL_ROUTES.settingsCategory) {
    return (
      pathname === SCHOOL_ROUTES.settingsCategory ||
      pathname === SCHOOL_ROUTES.settingsBase
    )
  }
  if (subHref === SCHOOL_ROUTES.settingsAuditFlow) {
    return (
      pathname === SCHOOL_ROUTES.settingsAuditFlow ||
      pathname.startsWith(`${SCHOOL_ROUTES.settingsAuditFlow}/`)
    )
  }
  return pathname === subHref || pathname.startsWith(`${subHref}/`)
}

function getSubIcon(href: string): LucideIcon {
  if (href === SCHOOL_ROUTES.messages) return Mail
  if (href === SCHOOL_ROUTES.messagesDrafts) return FileEdit
  if (href === SCHOOL_ROUTES.clubList) return List
  if (href === SCHOOL_ROUTES.clubGroups) return Layers
  if (href === SCHOOL_ROUTES.clubRegister) return Plus
  if (href === SCHOOL_ROUTES.settingsCategory) return Tags
  if (href === SCHOOL_ROUTES.settingsAccountTitles) return ListOrdered
  if (href === SCHOOL_ROUTES.settingsStaff) return UserCog
  if (href === SCHOOL_ROUTES.settingsAuditFlow) return SlidersHorizontal
  if (href === SCHOOL_ROUTES.auditors) return ClipboardCheck
  return List
}

function isParentActive(item: MenuItem, pathname: string): boolean {
  if (item.parentKey === "club") return isSchoolClubPath(pathname)
  if (item.parentKey === "settings") return isSchoolSettingsPath(pathname)
  if (item.parentKey === "messages") return isSchoolMessagesPath(pathname)
  return false
}

function initialExpanded(pathname: string): string[] {
  const keys: string[] = []
  if (isSchoolClubPath(pathname)) keys.push(CLUB_PARENT_KEY)
  if (isSchoolSettingsPath(pathname)) keys.push(SETTINGS_PARENT_KEY)
  if (isSchoolMessagesPath(pathname)) keys.push(MESSAGES_PARENT_KEY)
  return keys
}

export function SchoolSidebar() {
  const pathname = usePathname()
  const [auditFlowEnabled, setAuditFlowEnabled] = useState(true)
  const [expandedItems, setExpandedItems] = useState<string[]>(() =>
    initialExpanded(pathname)
  )

  useEffect(() => {
    const sync = () => setAuditFlowEnabled(loadSchoolUseAuditFlow())
    sync()
    window.addEventListener(SCHOOL_AUDIT_FLOW_CHANGED_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(SCHOOL_AUDIT_FLOW_CHANGED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  const menuItems = buildMenuItems(auditFlowEnabled)

  useEffect(() => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (isSchoolClubPath(pathname)) next.add(CLUB_PARENT_KEY)
      if (isSchoolSettingsPath(pathname)) next.add(SETTINGS_PARENT_KEY)
      if (isSchoolMessagesPath(pathname)) next.add(MESSAGES_PARENT_KEY)
      return Array.from(next)
    })
  }, [pathname])

  const toggleExpanded = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
    )
  }

  const isItemActive = (item: MenuItem) => {
    if (item.subItems) return isParentActive(item, pathname)
    return item.match?.(pathname) ?? pathname === item.href
  }

  const isSubItemActive = (sub: SubMenuItem) => subItemPathMatches(pathname, sub.href)

  return (
    <aside
      className="fixed left-0 top-0 z-[100] isolate h-screen w-64 border-r border-gray-200 bg-white pointer-events-auto"
      aria-label="管理者ポータル メニュー"
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-gray-200 px-4 py-4">
          <Link
            href={SCHOOL_ROUTES.home}
            className="block rounded-md outline-offset-2 hover:opacity-90"
          >
            <KurasapoBrandLogo />
          </Link>
        </div>
        <p className="px-5 py-2 text-xs font-medium text-indigo-700/80">学校管理</p>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {menuItems.map((item) => {
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
                      "group relative flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-indigo-50 text-indigo-950"
                        : "text-[#374151] hover:bg-indigo-50/50"
                    )}
                  >
                    <div className="flex flex-1 items-center gap-3">
                      {isActive && (
                        <div className="absolute left-0 top-0 h-full w-1 rounded-l-lg bg-blue-950" />
                      )}
                      <Icon
                        className="h-5 w-5 flex-shrink-0"
                        style={{
                          color: isActive ? SCHOOL_THEME.navy : SCHOOL_THEME.iconMuted,
                          strokeWidth: 2.5,
                        }}
                        aria-hidden
                      />
                      <span>{item.title}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-[#6B7280]" aria-hidden />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[#6B7280]" aria-hidden />
                    )}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-indigo-50 text-indigo-950"
                        : "text-[#374151] hover:bg-indigo-50/50"
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-0 h-full w-1 rounded-l-lg bg-blue-950" />
                    )}
                    <Icon
                      className="h-5 w-5 flex-shrink-0"
                      style={{
                        color: isActive ? SCHOOL_THEME.navy : SCHOOL_THEME.iconMuted,
                        strokeWidth: 2.5,
                      }}
                      aria-hidden
                    />
                    <span>{item.title}</span>
                  </Link>
                )}

                {hasSubItems && isExpanded && (
                  <div className="ml-8 mt-1 space-y-1">
                    {item.subItems!.map((subItem) => {
                      const subIsActive = isSubItemActive(subItem)
                      const SubIcon = getSubIcon(subItem.href)

                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                            subIsActive
                              ? "bg-indigo-50 font-medium text-indigo-950"
                              : "text-[#6B7280] hover:bg-indigo-50/50 hover:text-[#374151]"
                          )}
                        >
                          <SubIcon
                            className="h-4 w-4 flex-shrink-0"
                            style={{
                              color: subIsActive ? SCHOOL_THEME.navy : "#94a3b8",
                              strokeWidth: 2.5,
                            }}
                            aria-hidden
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

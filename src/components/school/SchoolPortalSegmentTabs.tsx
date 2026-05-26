"use client"

import { cn } from "@/lib/utils"

export type SchoolPortalSegmentTab = {
  id: string
  label: string
}

type SchoolPortalSegmentTabsProps = {
  tabs: SchoolPortalSegmentTab[]
  activeId: string
  onChange: (id: string) => void
  ariaLabel?: string
  className?: string
}

/** 管理者ポータル：グレー（選択中）× ライトブルー（未選択）の丸角タブ */
export function SchoolPortalSegmentTabs({
  tabs,
  activeId,
  onChange,
  ariaLabel,
  className,
}: SchoolPortalSegmentTabsProps) {
  return (
    <div className={cn("border-b border-[#38bdf8]", className)}>
      <div
        className="flex flex-wrap items-end gap-x-1.5"
        role="tablist"
        aria-label={ariaLabel}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative rounded-t-lg px-4 py-2 text-sm font-medium transition-[background-color,color,border-color] duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]/60 focus-visible:ring-offset-1",
                isActive
                  ? "z-10 -mb-px border border-[#737373] border-b-[#737373] bg-[#737373] text-white"
                  : "border border-[#38bdf8] border-b-[#38bdf8] bg-[#f0f9ff] text-[#0284c7] hover:bg-sky-50/80"
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

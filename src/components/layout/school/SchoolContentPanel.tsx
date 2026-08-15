import { ReactNode } from "react"
import { SCHOOL_THEME } from "@/lib/schoolTheme"

interface SchoolContentPanelProps {
  title: string
  description?: string
  children?: ReactNode
}

/** 学校画面メイン領域の白パネル（クラブ画面のカード体裁に合わせる） */
export function SchoolContentPanel({
  title,
  description,
  children,
}: SchoolContentPanelProps) {
  return (
    <div className="px-6 py-8">
      <div
        className="rounded-lg border border-gray-300 bg-white shadow-sm"
        style={{ borderLeftWidth: 5, borderLeftColor: SCHOOL_THEME.navy }}
      >
        <div className="overflow-hidden rounded-t-[calc(0.5rem-1px)] border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold text-indigo-950">{title}</h2>
          {description ? (
            <p className="text-xs text-[#6B7280] mt-1">{description}</p>
          ) : null}
        </div>
        {children ? (
          <div className="overflow-visible px-6 py-8 text-sm text-[#6B7280]">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  )
}

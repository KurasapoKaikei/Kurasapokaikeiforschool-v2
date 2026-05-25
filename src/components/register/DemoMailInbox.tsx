import type { ReactNode } from "react"
import { SCHOOL_BRAND_NAVY } from "@/lib/schoolTheme"

type DemoMailInboxProps = {
  bannerTitle: string
  toEmail?: string
  subject: string
  children: ReactNode
}

/** デモ用の受信メールUI（仮申込・本登録完了など） */
export function DemoMailInbox({
  bannerTitle,
  toEmail,
  subject,
  children,
}: DemoMailInboxProps) {
  return (
    <div className="rounded-xl border-2 border-dashed border-[#005088]/40 bg-[#FAFCFE] p-5 sm:p-6 text-left">
      <p
        className="mb-4 text-center text-sm font-bold tracking-wide"
        style={{ color: SCHOOL_BRAND_NAVY }}
      >
        {bannerTitle}
      </p>
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        {toEmail ? (
          <>
            <p className="text-xs text-[#9CA3AF]">宛先（To）</p>
            <p className="mt-1 text-sm font-medium text-[#005088]">{toEmail}</p>
          </>
        ) : null}
        <p className={`text-xs text-[#9CA3AF] ${toEmail ? "mt-4" : ""}`}>件名</p>
        <p className="mt-1 text-sm font-semibold text-[#374151]">{subject}</p>
        <hr className="my-4 border-gray-100" />
        <div className="space-y-3 text-sm leading-relaxed text-[#374151]">
          {children}
        </div>
      </div>
    </div>
  )
}

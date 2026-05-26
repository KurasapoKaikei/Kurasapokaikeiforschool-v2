import { Suspense } from "react"
import { SchoolAuditorsRegisterView } from "@/components/school/SchoolAuditorsRegisterView"

/** 監査人管理 > 監査人登録 */
export default function SchoolClubAuditorsRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[12rem] bg-[#F5F5F0] px-6 py-8 text-sm text-[#6B7280]">
          読み込み中…
        </div>
      }
    >
      <SchoolAuditorsRegisterView />
    </Suspense>
  )
}

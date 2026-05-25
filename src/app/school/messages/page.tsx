import { Suspense } from "react"
import { SchoolMessagesView } from "@/components/school/SchoolMessagesView"

/** メッセージBOX一覧・作成（学校管理者） */
export default function SchoolMessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-[12rem] bg-[#F5F5F0]" aria-busy />}>
      <SchoolMessagesView />
    </Suspense>
  )
}

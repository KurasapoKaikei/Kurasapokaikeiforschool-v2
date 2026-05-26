import { Suspense } from "react"
import { AuditorMessagesView } from "@/components/audit/AuditorMessagesView"

export default function AuditorMessagesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#6B7280]">読み込み中…</div>}>
      <AuditorMessagesView />
    </Suspense>
  )
}

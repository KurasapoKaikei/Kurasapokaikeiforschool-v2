import { Suspense } from "react"
import { SchoolContractView } from "@/components/school/SchoolContractView"

export default function SchoolContractPage() {
  return (
    <Suspense fallback={<div className="px-6 py-8 text-sm text-[#6B7280]">読み込み中…</div>}>
      <SchoolContractView />
    </Suspense>
  )
}

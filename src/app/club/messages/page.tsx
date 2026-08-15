import { Suspense } from "react"
import { ClubMessagesView } from "@/components/club/ClubMessagesView"

/** メッセージ受信箱（クラブポータル） */
export default function ClubMessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-[12rem] bg-[#F5F5F0]" aria-busy />}>
      <ClubMessagesView />
    </Suspense>
  )
}

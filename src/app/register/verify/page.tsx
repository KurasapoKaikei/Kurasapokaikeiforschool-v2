import { Suspense } from "react"
import { SchoolRegisterVerifyView } from "@/components/register/SchoolRegisterVerifyView"

/** メール認証 → 本登録・自動ログイン */
export default function SchoolRegisterVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-[#6B7280]">
          認証処理中…
        </div>
      }
    >
      <SchoolRegisterVerifyView />
    </Suspense>
  )
}

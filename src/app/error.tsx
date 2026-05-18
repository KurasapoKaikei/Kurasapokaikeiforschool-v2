"use client"

import { useEffect } from "react"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F5F5F0] px-6">
      <h2 className="text-lg font-semibold text-[#374151]">表示中にエラーが発生しました</h2>
      <p className="text-sm text-[#6B7280] text-center max-w-md">
        一時的な不整合の可能性があります。再試行するか、ページを再読み込みしてください。
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="px-4 py-2 rounded-md bg-[#A3BC68] text-white text-sm font-semibold hover:opacity-90"
      >
        再試行
      </button>
    </div>
  )
}

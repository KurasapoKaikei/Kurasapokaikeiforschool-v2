import Link from "next/link"

/** 統合システム LP（5/27 デモ用・各権限への入り口） */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F5F5F0] px-6">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[#374151]">クラサポ会計</h1>
          <p className="text-sm text-[#6B7280]">
            学校・クラブ・部員・保護者の入り口をお選びください
          </p>
        </div>
        <nav className="flex flex-col gap-4">
          <Link
            href="/school"
            className="rounded-lg bg-[#1A237E] px-6 py-4 text-center text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            学校ログイン画面へ
          </Link>
          <Link
            href="/club"
            className="rounded-lg bg-[#E66A84] px-6 py-4 text-center text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            クラブログイン画面へ
          </Link>
          <Link
            href="/member"
            className="rounded-lg bg-[#9D8CC3] px-6 py-4 text-center text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            部員ログイン画面へ
          </Link>
        </nav>
      </div>
    </main>
  )
}

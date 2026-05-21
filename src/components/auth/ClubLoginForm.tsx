"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  authenticateClub,
  establishClubLogin,
} from "@/lib/clubLoginSession"
import { CLUB_BRAND_PINK, CLUB_PORTAL_DASHBOARD } from "@/lib/schoolTheme"

type ClubLoginFormProps = {
  onBack?: () => void
  backLabel?: string
}

/** クラブID・パスワード入力フォーム */
export function ClubLoginForm({
  onBack,
  backLabel = "ログイン選択に戻る",
}: ClubLoginFormProps) {
  const router = useRouter()
  const [clubId, setClubId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const session = authenticateClub(clubId, password)
    if (!session) {
      setError("クラブIDまたはパスワードが正しくありません。")
      setSubmitting(false)
      return
    }

    establishClubLogin(session)
    router.push(CLUB_PORTAL_DASHBOARD)
  }

  return (
    <div
      className="w-full max-w-md rounded-2xl border border-[#E66A84]/20 bg-white p-8 shadow-lg"
      style={{ borderTopWidth: 4, borderTopColor: CLUB_BRAND_PINK }}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-4 text-sm text-[#6B7280] hover:text-[#374151] hover:underline"
        >
          ← {backLabel}
        </button>
      ) : null}

      <h2 className="mb-1 text-center text-2xl font-bold text-[#374151]">
        クラブログイン
      </h2>
      <p className="mb-8 text-center text-sm text-[#6B7280]">
        クラブIDとパスワードを入力してください
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <label
            htmlFor="clubId"
            className="mb-1.5 block text-sm font-medium text-[#374151]"
          >
            クラブID
          </label>
          <input
            id="clubId"
            type="text"
            value={clubId}
            onChange={(e) => {
              setClubId(e.target.value)
              setError(null)
            }}
            placeholder="例 club-1234"
            autoComplete="username"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#E66A84]/40"
          />
        </div>

        <div>
          <label
            htmlFor="clubPassword"
            className="mb-1.5 block text-sm font-medium text-[#374151]"
          >
            パスワード
          </label>
          <input
            id="clubPassword"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
            placeholder="パスワードを入力"
            autoComplete="current-password"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#E66A84]/40"
          />
        </div>

        {error ? (
          <p className="text-sm text-[#EF4444]" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={submitting}
          className="h-11 w-full rounded-lg text-base font-semibold text-white hover:opacity-90"
          style={{ backgroundColor: CLUB_BRAND_PINK }}
        >
          ログイン
        </Button>
      </form>
    </div>
  )
}

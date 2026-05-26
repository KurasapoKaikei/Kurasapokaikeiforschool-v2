"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PasswordInput } from "@/components/ui/password-input"
import { establishAuditorLoginById } from "@/lib/currentAuditor"
import { AUDIT_ROUTES } from "@/lib/auditorTheme"
import {
  authenticateSchool,
  clearSchoolAdminSession,
  establishSchoolLogin,
} from "@/lib/schoolLoginSession"
import { SCHOOL_BRAND_NAVY, SCHOOL_ROUTES } from "@/lib/schoolTheme"

/** 学校管理者ログイン画面 */
export function SchoolLoginView() {
  const [loginId, setLoginId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const id = loginId.trim()
    if (/^AUD-/i.test(id)) {
      if (!establishAuditorLoginById(id, password)) {
        setError("監査人IDまたはパスワードが正しくありません。")
        return
      }
      clearSchoolAdminSession()
      window.location.assign(AUDIT_ROUTES.home)
      return
    }

    if (!authenticateSchool(loginId, password)) {
      setError("ログインIDまたはパスワードが正しくありません。")
      return
    }

    establishSchoolLogin(loginId)
    window.location.assign(SCHOOL_ROUTES.home)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#E8EEF4] to-[#F5F5F0] px-6 py-12">
      <div className="w-full max-w-md">
        <div
          className="rounded-2xl border border-[#005088]/15 bg-white p-8 shadow-lg"
          style={{ borderTopWidth: 4, borderTopColor: SCHOOL_BRAND_NAVY }}
        >
          <Link
            href="/"
            className="mb-4 inline-block text-sm text-[#6B7280] hover:text-[#374151] hover:underline"
          >
            ← ログイン選択に戻る
          </Link>

          <h1 className="mb-1 text-center text-2xl font-bold text-[#374151]">
            学校ログイン
          </h1>
          <p className="mb-8 text-center text-sm text-[#6B7280]">
            管理者IDとパスワードを入力してください
          </p>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label
                htmlFor="schoolLoginId"
                className="mb-1.5 block text-sm font-medium text-[#374151]"
              >
                ログインID
              </label>
              <input
                id="schoolLoginId"
                name="schoolLoginId"
                type="text"
                value={loginId}
                onChange={(e) => {
                  setLoginId(e.target.value)
                  setError(null)
                }}
                placeholder="例 admin または AUD-0001"
                autoComplete="username"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#005088]/30"
              />
            </div>

            <div>
              <label
                htmlFor="schoolPassword"
                className="mb-1.5 block text-sm font-medium text-[#374151]"
              >
                パスワード
              </label>
              <PasswordInput
                id="schoolPassword"
                value={password}
                onChange={(v) => {
                  setPassword(v)
                  setError(null)
                }}
                placeholder="パスワードを入力"
                autoComplete="current-password"
                deferAutofillUntilFocus
                inputClassName="focus:ring-[#005088]/30"
              />
            </div>

            {error ? (
              <p className="text-sm text-[#EF4444]" role="alert">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              className="h-11 w-full rounded-lg text-base font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: SCHOOL_BRAND_NAVY }}
            >
              ログイン
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-[#9CA3AF]">
            デモ用: ID「admin」/ PW「admin」、または空欄のままログイン可能
          </p>
        </div>
      </div>
    </main>
  )
}

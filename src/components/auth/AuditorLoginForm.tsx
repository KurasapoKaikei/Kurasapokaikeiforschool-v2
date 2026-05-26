"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { establishAuditorLogin } from "@/lib/currentAuditor"
import { AUDIT_MESSAGE_BOX_ACCENT } from "@/lib/auditorTheme"

type AuditorLoginFormProps = {
  onSuccess: () => void
  onBack?: () => void
}

export function AuditorLoginForm({ onSuccess, onBack }: AuditorLoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!establishAuditorLogin(email, password)) {
      setError("メールアドレスまたはパスワードが正しくありません。")
      return
    }
    setError(null)
    onSuccess()
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold text-[#374151]">監査人ログイン</h1>
      <p className="mt-2 text-sm text-[#6B7280]">
        登録メールアドレスと初期パスワードでログインしてください。
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="auditorEmail"
            className="mb-1 block text-sm font-medium text-[#374151]"
          >
            メールアドレス
          </label>
          <input
            id="auditorEmail"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
            required
          />
        </div>
        <div>
          <label
            htmlFor="auditorPassword"
            className="mb-1 block text-sm font-medium text-[#374151]"
          >
            パスワード
          </label>
          <input
            id="auditorPassword"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
            required
          />
        </div>
        {error ? (
          <p className="text-sm text-[#EF4444]" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          className="w-full text-white hover:opacity-90"
          style={{ backgroundColor: AUDIT_MESSAGE_BOX_ACCENT }}
        >
          ログイン
        </Button>
        {onBack ? (
          <Button type="button" variant="outline" className="w-full" onClick={onBack}>
            戻る
          </Button>
        ) : null}
      </form>
    </div>
  )
}

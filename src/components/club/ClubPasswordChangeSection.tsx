"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { getCurrentClub } from "@/lib/clubLoginSession"
import { getImpersonatedClub } from "@/lib/schoolClubSession"
import {
  getClubById,
  loadSchoolClubs,
  updateClubPassword,
  verifyClubPassword,
} from "@/lib/schoolClubs"

/** クラブ設定：パスワード変更（デモ用） */
export function ClubPasswordChangeSection({
  actionDisabled = false,
}: {
  actionDisabled?: boolean
}) {
  const [clubId, setClubId] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const impersonated = getImpersonatedClub()
    if (impersonated?.id) {
      setClubId(impersonated.id)
      return
    }
    const loggedIn = getCurrentClub()
    if (loggedIn?.id) {
      setClubId(loggedIn.id)
      return
    }
    const clubs = loadSchoolClubs()
    if (clubs[0]) setClubId(clubs[0].id)
  }, [])

  const club = clubId ? getClubById(clubId) : undefined

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!clubId || !club) {
      setError("クラブ情報を取得できません。")
      return
    }
    if (!currentPassword) {
      setError("現在のパスワードを入力してください。")
      return
    }
    if (!verifyClubPassword(clubId, currentPassword)) {
      setError("現在のパスワードが正しくありません。")
      return
    }
    if (newPassword.length < 6) {
      setError("新しいパスワードは6文字以上で入力してください。")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("新しいパスワードと確認用が一致しません。")
      return
    }

    if (!updateClubPassword(clubId, newPassword)) {
      setError("パスワードの変更に失敗しました。")
      return
    }

    setSuccess(true)
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-4 border-b border-gray-200 pb-2 text-lg font-semibold text-[#374151]">
        パスワード変更
      </h3>
      {club ? (
        <p className="mb-4 text-xs text-[#6B7280]">
          ログインID: <span className="font-mono font-medium text-[#374151]">{club.id}</span>
        </p>
      ) : (
        <p className="mb-4 text-sm text-[#6B7280]">
          クラブ情報が見つかりません。学校ポータルからクラブを登録してください。
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label
            htmlFor="currentPassword"
            className="mb-1.5 block text-sm font-medium text-[#374151]"
          >
            現在のパスワード
          </label>
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value)
              setSuccess(false)
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#77B8DA]/40"
            autoComplete="current-password"
            disabled={!club}
          />
        </div>

        <div>
          <label
            htmlFor="newPassword"
            className="mb-1.5 block text-sm font-medium text-[#374151]"
          >
            新しいパスワード
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value)
              setSuccess(false)
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#77B8DA]/40"
            autoComplete="new-password"
            disabled={!club}
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1.5 block text-sm font-medium text-[#374151]"
          >
            新しいパスワード（確認）
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              setSuccess(false)
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#77B8DA]/40"
            autoComplete="new-password"
            disabled={!club}
          />
        </div>

        {error ? (
          <p className="text-sm text-[#EF4444]" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="text-sm text-[#059669]" role="status">
            パスワードを変更しました。
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={!club || actionDisabled}
          className="bg-[#E66A84] text-white hover:opacity-90"
        >
          変更する
        </Button>
      </form>
    </div>
  )
}

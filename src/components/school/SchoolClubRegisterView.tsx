"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { useSchoolClubGroups } from "@/contexts/SchoolClubGroupsContext"
import { useSchoolClubs } from "@/contexts/SchoolClubsContext"
import { SchoolFormRequiredBadge } from "@/components/school/SchoolFormRequiredBadge"
import { SchoolClubAddedListSection } from "@/components/school/SchoolClubAddedListSection"
import {
  DUPLICATE_CLUB_NAME_ERROR,
  isDuplicateClubName,
} from "@/lib/schoolClubs"
import { SCHOOL_BRAND_NAVY } from "@/lib/schoolTheme"
import { ActionConfirmDialog } from "@/components/shared/ActionConfirmDialog"
import { SchoolLoginCredentialsModal } from "@/components/school/SchoolLoginCredentialsModal"
import { useActionConfirmDialog } from "@/hooks/useActionConfirmDialog"
import type { SchoolClub } from "@/lib/schoolClubs"

/** クラブ登録・管理（グループ作成と共有データ連動） */
export function SchoolClubRegisterView() {
  const { sortedGroups, isLoaded: groupsLoaded } = useSchoolClubGroups()
  const { registerClub, sortedClubs, isLoaded: clubsLoaded } = useSchoolClubs()
  const [selectedGroupId, setSelectedGroupId] = useState("")
  const [clubName, setClubName] = useState("")
  const [managerTitle, setManagerTitle] = useState("")
  const [managerName, setManagerName] = useState("")
  const [groupError, setGroupError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [managerError, setManagerError] = useState<string | null>(null)
  const [listResetKey, setListResetKey] = useState(0)
  const [registeredClub, setRegisteredClub] = useState<SchoolClub | null>(null)
  const { requestConfirm, confirmProps } = useActionConfirmDialog()

  const isLoaded = groupsLoaded && clubsLoaded
  const trimmedName = clubName.trim()
  const isDuplicateName = useMemo(
    () =>
      isLoaded &&
      trimmedName !== "" &&
      isDuplicateClubName(trimmedName, sortedClubs),
    [isLoaded, trimmedName, sortedClubs]
  )
  const displayNameError =
    nameError ?? (isDuplicateName ? DUPLICATE_CLUB_NAME_ERROR : null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded) return

    let valid = true
    if (!selectedGroupId) {
      setGroupError("グループを選択してください。")
      valid = false
    } else {
      setGroupError(null)
    }

    if (!trimmedName) {
      setNameError("クラブ名を入力してください。")
      valid = false
    } else if (isDuplicateClubName(trimmedName, sortedClubs)) {
      setNameError(DUPLICATE_CLUB_NAME_ERROR)
      valid = false
    } else {
      setNameError(null)
    }

    if (!managerTitle.trim() || !managerName.trim()) {
      setManagerError("クラブ責任者の役職と氏名を入力してください。")
      valid = false
    } else {
      setManagerError(null)
    }

    if (!valid) return

    const group = sortedGroups.find((g) => g.id === selectedGroupId)
    if (!group) return

    requestConfirm("register", () => {
      const created = registerClub({
        name: trimmedName,
        groupId: group.id,
        groupName: group.name,
        managerTitle: managerTitle.trim(),
        managerName: managerName.trim(),
      })
      if (!created) {
        setNameError(DUPLICATE_CLUB_NAME_ERROR)
        return
      }

      setClubName("")
      setManagerTitle("")
      setManagerName("")
      setSelectedGroupId("")
      setListResetKey((k) => k + 1)
      setRegisteredClub(created)
    })
  }

  return (
    <div className="min-h-full w-full bg-[#F5F5F0] px-6 py-8">
      <ActionConfirmDialog {...confirmProps} />
      <SchoolLoginCredentialsModal
        open={registeredClub !== null}
        onClose={() => setRegisteredClub(null)}
        title="クラブ登録が完了しました"
        description={`「${registeredClub?.name ?? ""}」のログイン情報を担当者・責任者へ共有してください。`}
        loginIdLabel="ログインID（クラブID）"
        loginId={registeredClub?.id ?? ""}
        initialPassword={registeredClub?.initialPassword ?? ""}
        managerTitle={registeredClub?.managerTitle ?? ""}
        managerName={registeredClub?.managerName ?? ""}
        managerInitialPassword={registeredClub?.managerInitialPassword ?? ""}
      />
      <div className="w-full max-w-none">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-[#374151]">クラブ登録</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            クラブの新規登録・編集・削除（メンテナンス）
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mb-10 mr-auto w-full max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h3 className="mb-5 text-lg font-semibold text-[#374151]">新規登録</h3>
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-1.5 flex items-center text-sm font-medium text-[#374151]">
                グループ
                <SchoolFormRequiredBadge />
              </legend>

              {!isLoaded ? (
                <p className="text-sm text-[#9CA3AF]">読み込み中...</p>
              ) : sortedGroups.length === 0 ? (
                <p className="text-sm text-[#6B7280]">
                  先に「グループ作成」画面でグループを登録してください。
                </p>
              ) : (
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  {sortedGroups.map((group) => (
                    <label
                      key={group.id}
                      className="inline-flex cursor-pointer items-center gap-2 text-sm text-[#374151]"
                    >
                      <input
                        type="radio"
                        name="clubGroup"
                        value={group.id}
                        checked={selectedGroupId === group.id}
                        onChange={() => {
                          setSelectedGroupId(group.id)
                          setGroupError(null)
                        }}
                        disabled={!isLoaded}
                        className="h-4 w-4 border-gray-300 text-[#005088] focus:ring-[#005088]/40"
                      />
                      {group.name}
                    </label>
                  ))}
                </div>
              )}

              {groupError ? (
                <p className="mt-2 text-sm text-[#EF4444]" role="alert">
                  {groupError}
                </p>
              ) : null}
            </fieldset>

            <div>
              <label
                htmlFor="clubName"
                className="mb-1.5 flex items-center text-sm font-medium text-[#374151]"
              >
                クラブ名
                <SchoolFormRequiredBadge />
              </label>
              <input
                id="clubName"
                type="text"
                value={clubName}
                onChange={(e) => {
                  setClubName(e.target.value)
                  setNameError(null)
                }}
                disabled={!isLoaded}
                placeholder="例：男子サッカー部"
                className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${
                  displayNameError
                    ? "border-[#EF4444] focus:ring-[#EF4444]/40"
                    : "border-gray-300 focus:ring-[#005088]/40"
                }`}
              />
              {displayNameError ? (
                <p className="mt-2 text-sm text-[#EF4444]" role="alert">
                  {displayNameError}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="managerTitle"
                className="mb-1.5 flex items-center text-sm font-medium text-[#374151]"
              >
                クラブ責任者（役職）
                <SchoolFormRequiredBadge />
              </label>
              <input
                id="managerTitle"
                type="text"
                value={managerTitle}
                onChange={(e) => {
                  setManagerTitle(e.target.value)
                  setManagerError(null)
                }}
                disabled={!isLoaded}
                placeholder="例：顧問、監督"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#005088]/40"
              />
            </div>

            <div>
              <label
                htmlFor="managerName"
                className="mb-1.5 flex items-center text-sm font-medium text-[#374151]"
              >
                クラブ責任者（氏名）
                <SchoolFormRequiredBadge />
              </label>
              <input
                id="managerName"
                type="text"
                value={managerName}
                onChange={(e) => {
                  setManagerName(e.target.value)
                  setManagerError(null)
                }}
                disabled={!isLoaded}
                placeholder="例：山田 太郎"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#005088]/40"
              />
              {managerError ? (
                <p className="mt-2 text-sm text-[#EF4444]" role="alert">
                  {managerError}
                </p>
              ) : null}
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={
                  !isLoaded ||
                  sortedGroups.length === 0 ||
                  !trimmedName ||
                  isDuplicateName ||
                  !managerTitle.trim() ||
                  !managerName.trim()
                }
                className="rounded-lg px-6 py-2.5 text-white hover:opacity-90"
                style={{ backgroundColor: SCHOOL_BRAND_NAVY }}
              >
                登録する
              </Button>
            </div>
          </div>
        </form>

        <SchoolClubAddedListSection resetTabKey={listResetKey} />
      </div>
    </div>
  )
}

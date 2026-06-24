"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ClubContractInfoSection } from "@/components/club/ClubContractInfoSection"
import { ClubOrganizationInfoSection } from "@/components/club/ClubOrganizationInfoSection"
import { SettlementLockAlert } from "@/components/club/SettlementLockAlert"
import { useClubSettlementLock } from "@/hooks/useClubSettlementLock"
import { useClubSession } from "@/contexts/ClubSessionContext"
import { useUserInfo } from "@/contexts/UserInfoContext"
import {
  emptyClubOrganizationProfile,
  loadClubOrganizationProfile,
  saveClubOrganizationProfile,
  type ClubOrganizationProfile,
} from "@/lib/clubOrganizationProfile"

export default function ClubSettingsPage() {
  const { activeClub, isHydrated } = useClubSession()
  const { userInfo } = useUserInfo()
  const isLocked = useClubSettlementLock()

  const organizationName = useMemo(() => {
    const fromClub = activeClub?.name?.trim()
    if (fromClub) return fromClub
    return userInfo.organizationName?.trim() || "（名称未設定）"
  }, [activeClub?.name, userInfo.organizationName])

  const clubId = activeClub?.id ?? ""

  const [orgProfile, setOrgProfile] = useState<ClubOrganizationProfile>(
    emptyClubOrganizationProfile
  )

  const loginId = activeClub?.id ?? "—"

  useEffect(() => {
    if (!isHydrated || !clubId) {
      setOrgProfile(emptyClubOrganizationProfile())
      return
    }
    setOrgProfile(loadClubOrganizationProfile(clubId))
  }, [isHydrated, clubId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isLocked) return

    if (!clubId) {
      alert("クラブ情報を読み込めませんでした。再度ログインしてください。")
      return
    }

    const title = orgProfile.representativeTitle.trim()
    const lastName = orgProfile.representativeLastName.trim()
    const firstName = orgProfile.representativeFirstName.trim()
    const phone = orgProfile.representativePhone.trim()

    if (!title || !lastName || !firstName || !phone) {
      alert("代表者肩書・氏名・電話番号をすべて入力してください。")
      return
    }

    saveClubOrganizationProfile(clubId, {
      representativeTitle: title,
      representativeLastName: lastName,
      representativeFirstName: firstName,
      representativePhone: phone,
    })

    alert("変更を保存しました")
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h2 className="mb-2 text-xl font-semibold text-[#374151]">クラブ設定</h2>
          <p className="text-sm text-[#6B7280]">クラブ情報の登録・編集</p>
          <SettlementLockAlert isLocked={isLocked} className="mt-4" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <ClubContractInfoSection />

          <ClubOrganizationInfoSection
            organizationName={organizationName}
            profile={orgProfile}
            onProfileChange={setOrgProfile}
            disabled={isLocked || !clubId}
          />

          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 border-b border-gray-200 pb-2 text-lg font-semibold text-[#374151]">
              ログイン情報
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#374151]">
                  ログインID
                </label>
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-[#6B7280]">
                  {loginId}
                </div>
                <p className="mt-1 text-xs text-[#6B7280]">
                  ログインIDは変更できません
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isLocked || !clubId}
              className="bg-[#77B8DA] px-8 text-white hover:bg-[#77B8DA]/90"
            >
              変更を保存する
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

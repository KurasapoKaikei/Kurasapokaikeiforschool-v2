"use client"

import type { ReactNode } from "react"
import type { ClubOrganizationProfile } from "@/lib/clubOrganizationProfile"

const inputClass =
  "w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#77B8DA] focus:border-transparent"

const readOnlyClass =
  "w-full max-w-md rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-[#6B7280]"

function FormInfoRow({
  label,
  required,
  children,
  hint,
}: {
  label: string
  required?: boolean
  children: ReactNode
  hint?: string
}) {
  return (
    <div className="flex items-start border-t border-gray-100 py-3 first:border-t-0 first:pt-0">
      <span className="w-1/3 shrink-0 min-w-[11rem] pr-4 pt-2 text-left text-sm text-[#6B7280]">
        {label}
        {required ? <span className="text-[#EF4444]"> *</span> : null}
      </span>
      <div className="min-w-0 flex-1">
        {children}
        {hint ? (
          <p className="mt-1 text-xs text-[#6B7280]">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}

type ClubOrganizationInfoSectionProps = {
  organizationName: string
  profile: ClubOrganizationProfile
  onProfileChange: (profile: ClubOrganizationProfile) => void
  disabled?: boolean
}

/** クラブ設定：団体情報（団体名は読み取り専用・代表者欄は編集可） */
export function ClubOrganizationInfoSection({
  organizationName,
  profile,
  onProfileChange,
  disabled = false,
}: ClubOrganizationInfoSectionProps) {
  const setField = <K extends keyof ClubOrganizationProfile>(
    key: K,
    value: ClubOrganizationProfile[K]
  ) => {
    onProfileChange({ ...profile, [key]: value })
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 border-b border-gray-200 pb-2 text-lg font-semibold text-[#374151]">
        団体情報
      </h3>
      <div className="overflow-x-auto">
        <FormInfoRow
          label="団体名"
          hint="クラサポ会計 for School（学校管理者ポータル）で登録されたクラブ名です。クラブポータルからは変更できません。"
        >
          <input
            type="text"
            id="organizationName"
            value={organizationName}
            readOnly
            disabled
            className={readOnlyClass}
            aria-readonly="true"
          />
        </FormInfoRow>

        <FormInfoRow label="代表者役職" required>
          <input
            type="text"
            id="representativeTitle"
            value={profile.representativeTitle}
            onChange={(e) => setField("representativeTitle", e.target.value)}
            disabled={disabled}
            className={inputClass}
            placeholder="例：顧問、部長、監督など"
            required
          />
        </FormInfoRow>

        <FormInfoRow label="代表者氏名（姓）" required>
          <input
            type="text"
            id="representativeLastName"
            value={profile.representativeLastName}
            onChange={(e) => setField("representativeLastName", e.target.value)}
            disabled={disabled}
            className={inputClass}
            placeholder="例：山田"
            autoComplete="family-name"
            required
          />
        </FormInfoRow>

        <FormInfoRow label="代表者氏名（名）" required>
          <input
            type="text"
            id="representativeFirstName"
            value={profile.representativeFirstName}
            onChange={(e) => setField("representativeFirstName", e.target.value)}
            disabled={disabled}
            className={inputClass}
            placeholder="例：太郎"
            autoComplete="given-name"
            required
          />
        </FormInfoRow>

        <FormInfoRow label="代表者電話番号" required>
          <input
            type="tel"
            id="representativePhone"
            value={profile.representativePhone}
            onChange={(e) => setField("representativePhone", e.target.value)}
            disabled={disabled}
            className={inputClass}
            placeholder="例：090-1234-5678"
            autoComplete="tel"
            required
          />
        </FormInfoRow>
      </div>
    </section>
  )
}

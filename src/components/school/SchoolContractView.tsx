"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { SCHOOL_SESSION_CHANGED_EVENT } from "@/lib/currentSchool"
import { SCHOOL_THEME } from "@/lib/schoolTheme"
import { getSchoolContractDisplay } from "@/lib/getSchoolContractDisplay"
import type { ContractDisplayData } from "@/lib/schoolContractInfo"

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      style={{ borderLeftWidth: 5, borderLeftColor: SCHOOL_THEME.navy }}
    >
      <h3 className="mb-4 border-b border-gray-200 pb-2 text-lg font-semibold text-indigo-950">
        {title}
      </h3>
      {children}
    </section>
  )
}

function ContractInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline border-t border-gray-100 py-3 first:border-t-0 first:pt-0">
      <span className="w-1/3 shrink-0 max-w-[11rem] pr-4 text-left text-sm text-[#6B7280]">
        {label}
      </span>
      <span className="min-w-0 flex-1 break-words text-left text-sm font-medium text-[#374151]">
        {value}
      </span>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-gray-100 py-3 first:border-t-0 first:pt-0">
      <dt className="text-sm text-[#6B7280]">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-[#374151]">{value}</dd>
    </div>
  )
}

function ChangeLink({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 text-sm font-medium text-indigo-900 underline-offset-2 hover:text-indigo-950 hover:underline"
    >
      {label}
    </button>
  )
}

export function SchoolContractView() {
  const searchParams = useSearchParams()
  const [d, setD] = useState<ContractDisplayData | null>(null)
  const showApplied = searchParams.get("applied") === "1"

  useEffect(() => {
    const refresh = () => setD(getSchoolContractDisplay())
    refresh()
    window.addEventListener("storage", refresh)
    window.addEventListener(SCHOOL_SESSION_CHANGED_EVENT, refresh)
    return () => {
      window.removeEventListener("storage", refresh)
      window.removeEventListener(SCHOOL_SESSION_CHANGED_EVENT, refresh)
    }
  }, [])

  if (!d) {
    return (
      <div className="px-6 py-8 text-sm text-[#6B7280]">読み込み中…</div>
    )
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <h2 className="text-xl font-bold text-indigo-950">契約状況</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            ご契約内容・学校情報・ログイン情報の確認
          </p>
          {showApplied ? (
            <p
              className="mt-3 rounded-lg border border-[#005088]/25 bg-[#F0F7FB] px-4 py-2 text-sm font-medium"
              style={{ color: "#005088" }}
              role="status"
            >
              お申し込み内容を反映しました（localStorage: contract_info）
            </p>
          ) : null}
        </header>

        <div className="space-y-6">
          <SectionCard title="ご契約情報">
            <div className="overflow-x-hidden">
              <ContractInfoRow label="ご利用開始日" value={d.startDate} />
              <ContractInfoRow label="ご契約プラン" value={d.planSelectLabel} />
              <ContractInfoRow label="オプション" value={d.optionsLabel} />
              <ContractInfoRow label="登録クラブ数" value={d.registeredClubs} />
              <ContractInfoRow label="会計期間" value={d.fiscalPeriod} />
              <ContractInfoRow label="決算日" value={d.settlementDate} />
              <ContractInfoRow
                label={d.paymentCycle === "年払い" ? "年額" : "月額"}
                value={d.contractAmountLabel}
              />
              {d.paymentCycle === "月払い" ? (
                <ContractInfoRow label="年額（参考）" value={d.annualFee} />
              ) : null}
              <ContractInfoRow
                label="お支払い回数（サイクル）"
                value={d.paymentCycle}
              />
              <ContractInfoRow label="お支払い日" value={d.paymentDayLabel} />
              <ContractInfoRow label="お支払方法" value={d.paymentMethod} />
            </div>
            {d.paymentCycleNote ? (
              <div className="mt-4 rounded-lg border border-gray-100 bg-slate-50 px-4 py-3">
                <p className="mb-2 text-xs font-medium text-[#6B7280]">
                  お支払いに関する注釈
                </p>
                <p className="text-xs leading-relaxed text-slate-400 whitespace-pre-wrap">
                  {d.paymentCycleNote}
                </p>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="学校情報">
            <dl className="m-0 p-0">
              <InfoField label="学校名" value={d.schoolName} />
              <InfoField label="代表者様氏名" value={d.representativeName} />
              <InfoField label="郵便番号" value={d.postalCode} />
              <InfoField label="都道府県" value={d.prefecture} />
              <InfoField label="市区町村" value={d.city} />
              <InfoField label="以降のご住所" value={d.addressLine} />
              <InfoField label="電話番号" value={d.phone} />
              <InfoField label="担当管理部署" value={d.department} />
              {d.position ? (
                <InfoField label="役職" value={d.position} />
              ) : null}
              <InfoField label="担当者氏名" value={d.contactName} />
              <InfoField label="担当者電話番号" value={d.contactPhone} />
              <InfoField label="メールアドレス" value={d.email} />
            </dl>
          </SectionCard>

          <SectionCard title="ログイン情報">
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-[#6B7280]">ログインID</dt>
                <dd className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-[#374151]">
                  {d.loginId}
                </dd>
                <p className="mt-1 text-xs text-[#6B7280]">ログインIDは変更できません</p>
              </div>

              <div>
                <dt className="text-sm text-[#6B7280]">メールアドレス</dt>
                <dd className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-[#374151]">
                  {d.email}
                </dd>
                <ChangeLink label="[メールアドレスを変更する]" />
              </div>

              <div>
                <dt className="text-sm text-[#6B7280]">パスワード</dt>
                <dd className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium tracking-widest text-[#374151]">
                  {d.passwordMask}
                </dd>
                <ChangeLink label="[パスワードを変更する]" />
              </div>
            </dl>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

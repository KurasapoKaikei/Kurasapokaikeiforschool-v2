import { SCHOOL_CONTRACT_DEMO, SCHOOL_THEME } from "@/lib/schoolTheme"

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

/**
 * ご契約情報：項目名は左1/3幅で固定、内容はその直後（約2/3位置）から左寄せで縦揃え。
 * 長い文字列は改行せず右方向へ1行で伸ばす。
 */
function ContractInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline border-t border-gray-100 py-3 first:border-t-0 first:pt-0">
      <span className="w-1/3 shrink-0 min-w-[11rem] pr-4 text-left text-sm text-[#6B7280]">
        {label}
      </span>
      <span className="min-w-0 flex-1 whitespace-nowrap text-left text-sm font-medium text-[#374151]">
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
  const d = SCHOOL_CONTRACT_DEMO

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <h2 className="text-xl font-bold text-indigo-950">契約状況</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            ご契約内容・学校情報・ログイン情報の確認
          </p>
        </header>

        <div className="space-y-6">
          <SectionCard title="ご契約情報">
            <div className="overflow-x-auto">
              <ContractInfoRow label="ご利用開始日" value={d.startDate} />
              <ContractInfoRow label="ご利用プラン" value={d.plan} />
              <ContractInfoRow label="登録クラブ数" value={d.registeredClubs} />
              <ContractInfoRow label="会計期間" value={d.fiscalPeriod} />
              <ContractInfoRow label="年額" value={d.annualFee} />
              <ContractInfoRow label="ご請求月" value={d.billingMonth} />
              <ContractInfoRow label="お支払方法" value={d.paymentMethod} />
            </div>
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
              <InfoField label="担当者氏名" value={d.contactName} />
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

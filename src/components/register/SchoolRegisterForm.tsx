"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PasswordInput } from "@/components/ui/password-input"
import { RegisterStepper } from "@/components/register/RegisterStepper"
import {
  fetchAddressByPostalCode,
  PAYMENT_METHOD_LABELS,
  type MonthlyBillingDay,
  type PaymentCycleId,
  type PaymentMethodId,
  type SchoolPlanId,
} from "@/lib/schoolContractInfo"
import {
  clampSettlementDay,
  formatBillingDayLabel,
  formatPaymentCycleLabel,
  getSettlementDayOptions,
  MONTHLY_BILLING_OPTIONS,
  PLAN_SELECT_OPTIONS,
  MONTHLY_PAYMENT_NOTE,
  YEARLY_PAYMENT_NOTE,
} from "@/lib/registerFormUtils"
import {
  savePendingSchoolData,
  simulateVerificationEmail,
  type PendingSchoolData,
} from "@/lib/schoolRegistration"
import {
  ADMIN_PASSWORD_MISMATCH_ERROR,
  ADMIN_PASSWORD_STRENGTH_ERROR,
  isValidAdminPassword,
} from "@/lib/registerPasswordUtils"
import { SCHOOL_BRAND_NAVY } from "@/lib/schoolTheme"

const STEPS = [
  { id: 1, label: "学校情報" },
  { id: 2, label: "担当者" },
  { id: 3, label: "契約・PW" },
  { id: 4, label: "確認" },
  { id: 5, label: "完了" },
] as const

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#005088]/30"

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

const EMAIL_PLACEHOLDER = "例：hanako@example.com"
const EMAIL_MISMATCH_ERROR = "メールアドレスが一致しません"
const EMAIL_FORMAT_ERROR = "有効なメールアドレスを入力してください"

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmailFormat(email: string): boolean {
  return EMAIL_FORMAT.test(email.trim())
}

function mergeEmailFieldErrors(
  email: string,
  emailConfirm: string,
  prev: Record<string, string>
): Record<string, string> {
  const next = { ...prev }
  if (!email.trim()) next.email = "メールアドレスを入力してください"
  else if (!isValidEmailFormat(email)) next.email = EMAIL_FORMAT_ERROR
  else delete next.email

  if (!emailConfirm.trim())
    next.emailConfirm = "メールアドレス（確認）を入力してください"
  else if (email.trim() !== emailConfirm.trim())
    next.emailConfirm = EMAIL_MISMATCH_ERROR
  else delete next.emailConfirm

  return next
}

function joinFullName(last: string, first: string): string {
  return `${last.trim()}${first.trim()}`
}

function joinKanaName(last: string, first: string): string {
  const l = last.trim()
  const f = first.trim()
  if (l && f) return `${l} ${f}`
  return l || f
}

type SchoolFormState = {
  schoolName: string
  representativeLastName: string
  representativeFirstName: string
  representativeLastNameKana: string
  representativeFirstNameKana: string
  postalCode: string
  prefecture: string
  city: string
  addressLine: string
  phone: string
}

type ContactFormState = {
  department: string
  position: string
  contactLastName: string
  contactFirstName: string
  contactLastNameKana: string
  contactFirstNameKana: string
  contactPhone: string
  email: string
}

export function SchoolRegisterForm() {
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [addressLoading, setAddressLoading] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null)

  const [school, setSchool] = useState<SchoolFormState>({
    schoolName: "",
    representativeLastName: "",
    representativeFirstName: "",
    representativeLastNameKana: "",
    representativeFirstNameKana: "",
    postalCode: "",
    prefecture: "",
    city: "",
    addressLine: "",
    phone: "",
  })
  const [contact, setContact] = useState<ContactFormState>({
    department: "",
    position: "",
    contactLastName: "",
    contactFirstName: "",
    contactLastNameKana: "",
    contactFirstNameKana: "",
    contactPhone: "",
    email: "",
    emailConfirm: "",
  })
  const [plan, setPlan] = useState<SchoolPlanId>("standard")
  const [settlementMonth, setSettlementMonth] = useState(3)
  const [settlementDay, setSettlementDay] = useState(31)
  const [paymentCycle, setPaymentCycle] = useState<PaymentCycleId>("monthly")
  const [monthlyBillingDay, setMonthlyBillingDay] =
    useState<MonthlyBillingDay>(26)
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodId>("bank_transfer")
  const [adminPassword, setAdminPassword] = useState("")
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("")

  const settlementDayOptions = useMemo(
    () => getSettlementDayOptions(settlementMonth),
    [settlementMonth]
  )

  useEffect(() => {
    setSettlementDay((d) => clampSettlementDay(settlementMonth, d))
  }, [settlementMonth])

  /** STEP2：メール入力のリアルタイムバリデーション（他項目のエラーは維持） */
  useEffect(() => {
    if (step !== 2) return
    if (!contact.email && !contact.emailConfirm) return
    setErrors((prev) =>
      mergeEmailFieldErrors(contact.email, contact.emailConfirm, prev)
    )
  }, [contact.email, contact.emailConfirm, step])

  const validateStep1 = () => {
    const e: Record<string, string> = {}
    if (!school.schoolName.trim()) e.schoolName = "学校名を入力してください"
    if (!school.representativeLastName.trim())
      e.representativeLastName = "姓を入力してください"
    if (!school.representativeFirstName.trim())
      e.representativeFirstName = "名を入力してください"
    if (!school.representativeLastNameKana.trim())
      e.representativeLastNameKana = "姓（フリガナ）を入力してください"
    if (!school.representativeFirstNameKana.trim())
      e.representativeFirstNameKana = "名（フリガナ）を入力してください"
    if (!school.postalCode.trim()) e.postalCode = "郵便番号を入力してください"
    if (!school.prefecture.trim()) e.prefecture = "都道府県を入力してください"
    if (!school.city.trim()) e.city = "市区町村を入力してください"
    if (!school.addressLine.trim()) e.addressLine = "住所を入力してください"
    if (!school.phone.trim()) e.phone = "電話番号を入力してください"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateStep2 = () => {
    const e: Record<string, string> = {}
    if (!contact.department.trim()) e.department = "管理部署を入力してください"
    if (!contact.contactLastName.trim())
      e.contactLastName = "姓を入力してください"
    if (!contact.contactFirstName.trim())
      e.contactFirstName = "名を入力してください"
    if (!contact.contactLastNameKana.trim())
      e.contactLastNameKana = "姓（フリガナ）を入力してください"
    if (!contact.contactFirstNameKana.trim())
      e.contactFirstNameKana = "名（フリガナ）を入力してください"
    if (!contact.contactPhone.trim()) e.contactPhone = "電話番号を入力してください"
    const merged = mergeEmailFieldErrors(
      contact.email,
      contact.emailConfirm,
      e
    )
    Object.assign(e, merged)
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateStep3 = () => {
    const e: Record<string, string> = {}
    if (!isValidAdminPassword(adminPassword))
      e.adminPassword = ADMIN_PASSWORD_STRENGTH_ERROR
    if (adminPassword !== adminPasswordConfirm)
      e.adminPasswordConfirm = ADMIN_PASSWORD_MISMATCH_ERROR
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleAdminPasswordChange = (value: string) => {
    setAdminPassword(value)
    setErrors((prev) => {
      const next = { ...prev }
      if (value && !isValidAdminPassword(value))
        next.adminPassword = ADMIN_PASSWORD_STRENGTH_ERROR
      else delete next.adminPassword
      if (adminPasswordConfirm && value !== adminPasswordConfirm)
        next.adminPasswordConfirm = ADMIN_PASSWORD_MISMATCH_ERROR
      else if (adminPasswordConfirm) delete next.adminPasswordConfirm
      return next
    })
  }

  const handleAdminPasswordConfirmChange = (value: string) => {
    setAdminPasswordConfirm(value)
    setErrors((prev) => {
      const next = { ...prev }
      if (value && adminPassword !== value)
        next.adminPasswordConfirm = ADMIN_PASSWORD_MISMATCH_ERROR
      else delete next.adminPasswordConfirm
      if (adminPassword && !isValidAdminPassword(adminPassword))
        next.adminPassword = ADMIN_PASSWORD_STRENGTH_ERROR
      return next
    })
  }

  const handlePostalLookup = async () => {
    setAddressLoading(true)
    const result = await fetchAddressByPostalCode(school.postalCode)
    setAddressLoading(false)
    if (result) {
      setSchool((s) => ({
        ...s,
        prefecture: result.prefecture,
        city: result.city,
      }))
      setErrors((prev) => {
        const next = { ...prev }
        delete next.postalCode
        return next
      })
    } else {
      setErrors((prev) => ({
        ...prev,
        postalCode: "住所を取得できませんでした",
      }))
    }
  }

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2)
    if (step === 2 && validateStep2()) setStep(3)
    if (step === 3 && validateStep3()) setStep(4)
  }

  const handleProvisionalSubmit = () => {
    if (!termsAccepted) {
      setErrors({ terms: "利用規約への同意が必要です" })
      return
    }
    setErrors({})

    const pending: PendingSchoolData = {
      createdAt: new Date().toISOString(),
      adminPassword,
      school: {
        schoolName: school.schoolName.trim(),
        representativeName: joinFullName(
          school.representativeLastName,
          school.representativeFirstName
        ),
        representativeNameKana: joinKanaName(
          school.representativeLastNameKana,
          school.representativeFirstNameKana
        ),
        postalCode: school.postalCode.trim(),
        prefecture: school.prefecture.trim(),
        city: school.city.trim(),
        addressLine: school.addressLine.trim(),
        phone: school.phone.trim(),
      },
      contact: {
        department: contact.department.trim(),
        position: contact.position.trim(),
        contactName: joinFullName(contact.contactLastName, contact.contactFirstName),
        contactNameKana: joinKanaName(
          contact.contactLastNameKana,
          contact.contactFirstNameKana
        ),
        contactPhone: contact.contactPhone.trim(),
        email: contact.email.trim(),
      },
      contract: {
        plan,
        settlementMonth,
        settlementDay,
        paymentCycle,
        monthlyBillingDay:
          paymentCycle === "yearly" ? 31 : monthlyBillingDay,
        paymentMethod,
      },
      termsAcceptedAt: new Date().toISOString(),
    }

    const { verifyUrl } = savePendingSchoolData(pending)
    simulateVerificationEmail(contact.email.trim(), verifyUrl)
    setVerifyUrl(verifyUrl)
    setStep(5)
  }

  return (
    <main className="min-h-screen bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 text-center">
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: SCHOOL_BRAND_NAVY }}
          >
            クラサポ会計 for School
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#374151]">
            新規お申し込み
          </h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            仮申込 → メール認証 → 管理者ポータル自動発行
          </p>
        </header>

        <RegisterStepper steps={[...STEPS]} currentStep={step} />

        <div
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg sm:p-8"
          style={{ borderTopWidth: 4, borderTopColor: SCHOOL_BRAND_NAVY }}
        >
          {step === 1 && (
            <StepSchool
              school={school}
              setSchool={setSchool}
              errors={errors}
              addressLoading={addressLoading}
              onPostalLookup={handlePostalLookup}
            />
          )}
          {step === 2 && (
            <StepContact contact={contact} setContact={setContact} errors={errors} />
          )}
          {step === 3 && (
            <StepContract
              plan={plan}
              setPlan={setPlan}
              settlementMonth={settlementMonth}
              setSettlementMonth={setSettlementMonth}
              settlementDay={settlementDay}
              setSettlementDay={setSettlementDay}
              settlementDayOptions={settlementDayOptions}
              paymentCycle={paymentCycle}
              setPaymentCycle={setPaymentCycle}
              monthlyBillingDay={monthlyBillingDay}
              setMonthlyBillingDay={setMonthlyBillingDay}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              adminPassword={adminPassword}
              onAdminPasswordChange={handleAdminPasswordChange}
              adminPasswordConfirm={adminPasswordConfirm}
              onAdminPasswordConfirmChange={handleAdminPasswordConfirmChange}
              errors={errors}
            />
          )}
          {step === 4 && (
            <StepConfirm
              school={school}
              contact={contact}
              plan={plan}
              settlementMonth={settlementMonth}
              settlementDay={settlementDay}
              paymentCycle={paymentCycle}
              monthlyBillingDay={monthlyBillingDay}
              paymentMethod={paymentMethod}
              termsAccepted={termsAccepted}
              setTermsAccepted={setTermsAccepted}
              errors={errors}
            />
          )}
          {step === 5 && verifyUrl && (
            <StepComplete email={contact.email} verifyUrl={verifyUrl} />
          )}

          {step < 5 && (
            <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-6">
              <div className="flex flex-wrap items-center gap-2">
                {step === 1 ? (
                  <Link
                    href="/"
                    className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-[#374151] hover:bg-gray-50"
                  >
                    キャンセル
                  </Link>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setErrors({})
                        setStep((s) => s - 1)
                      }}
                    >
                      戻る
                    </Button>
                    {step === 2 ? (
                      <Link
                        href="/"
                        className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-[#374151] hover:bg-gray-50"
                      >
                        キャンセル
                      </Link>
                    ) : null}
                  </>
                )}
              </div>
              {step < 4 ? (
                <Button
                  type="button"
                  className="text-white hover:opacity-90"
                  style={{ backgroundColor: SCHOOL_BRAND_NAVY }}
                  onClick={handleNext}
                >
                  次へ
                </Button>
              ) : (
                <Button
                  type="button"
                  className="text-white hover:opacity-90"
                  style={{ backgroundColor: SCHOOL_BRAND_NAVY }}
                  onClick={handleProvisionalSubmit}
                >
                  仮申し込み
                </Button>
              )}
            </footer>
          )}
        </div>
      </div>
    </main>
  )
}

function StepSchool({
  school,
  setSchool,
  errors,
  addressLoading,
  onPostalLookup,
}: {
  school: SchoolFormState
  setSchool: React.Dispatch<React.SetStateAction<SchoolFormState>>
  errors: Record<string, string>
  addressLoading: boolean
  onPostalLookup: () => void
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[#374151]">STEP 1：学校情報</h2>
      <Field label="学校名" error={errors.schoolName} required>
        <input
          className={inputClass}
          value={school.schoolName}
          onChange={(e) => setSchool({ ...school, schoolName: e.target.value })}
          placeholder="例：クラサポ大学"
        />
      </Field>
      <NamePairField
        label="代表者氏名"
        required
        error={
          errors.representativeLastName ||
          errors.representativeFirstName ||
          undefined
        }
        lastName={school.representativeLastName}
        firstName={school.representativeFirstName}
        lastPlaceholder="例：倉部"
        firstPlaceholder="例：太郎"
        onLastNameChange={(v) =>
          setSchool({ ...school, representativeLastName: v })
        }
        onFirstNameChange={(v) =>
          setSchool({ ...school, representativeFirstName: v })
        }
      />
      <NamePairField
        label="代表者氏名（フリガナ）"
        required
        error={
          errors.representativeLastNameKana ||
          errors.representativeFirstNameKana ||
          undefined
        }
        lastName={school.representativeLastNameKana}
        firstName={school.representativeFirstNameKana}
        lastPlaceholder="例：クラブ"
        firstPlaceholder="例：タロウ"
        onLastNameChange={(v) =>
          setSchool({ ...school, representativeLastNameKana: v })
        }
        onFirstNameChange={(v) =>
          setSchool({ ...school, representativeFirstNameKana: v })
        }
      />
      <Field label="郵便番号" error={errors.postalCode} required>
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={school.postalCode}
            onChange={(e) => setSchool({ ...school, postalCode: e.target.value })}
            placeholder="例：102-0074"
          />
          <Button
            type="button"
            variant="outline"
            onClick={onPostalLookup}
            disabled={addressLoading}
            className="shrink-0 border-[#005088] text-[#005088]"
          >
            {addressLoading ? "取得中…" : "住所検索"}
          </Button>
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="都道府県" error={errors.prefecture} required>
          <input
            className={inputClass}
            value={school.prefecture}
            onChange={(e) => setSchool({ ...school, prefecture: e.target.value })}
            placeholder="例：東京都"
          />
        </Field>
        <Field label="市区町村" error={errors.city} required>
          <input
            className={inputClass}
            value={school.city}
            onChange={(e) => setSchool({ ...school, city: e.target.value })}
            placeholder="例：千代田区"
          />
        </Field>
      </div>
      <Field label="以降のご住所" error={errors.addressLine} required>
        <input
          className={inputClass}
          value={school.addressLine}
          onChange={(e) => setSchool({ ...school, addressLine: e.target.value })}
          placeholder="例：富士見台2-11-1"
        />
      </Field>
      <Field label="電話番号" error={errors.phone} required>
        <input
          className={inputClass}
          type="tel"
          value={school.phone}
          onChange={(e) => setSchool({ ...school, phone: e.target.value })}
          placeholder="例：03-5211-7171"
        />
      </Field>
    </div>
  )
}

function StepContact({
  contact,
  setContact,
  errors,
}: {
  contact: ContactFormState
  setContact: React.Dispatch<React.SetStateAction<ContactFormState>>
  errors: Record<string, string>
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[#374151]">STEP 2：担当者情報</h2>
      <Field label="管理部署" error={errors.department} required>
        <input
          className={inputClass}
          value={contact.department}
          onChange={(e) => setContact({ ...contact, department: e.target.value })}
          placeholder="例：学生支援課 部活動統括係"
        />
      </Field>
      <Field label="役職" error={errors.position}>
        <input
          className={inputClass}
          value={contact.position}
          onChange={(e) => setContact({ ...contact, position: e.target.value })}
          placeholder="例：主任（任意）"
        />
      </Field>
      <NamePairField
        label="担当者氏名"
        required
        error={
          errors.contactLastName || errors.contactFirstName || undefined
        }
        lastName={contact.contactLastName}
        firstName={contact.contactFirstName}
        lastPlaceholder="例：会計"
        firstPlaceholder="例：花子"
        onLastNameChange={(v) => setContact({ ...contact, contactLastName: v })}
        onFirstNameChange={(v) =>
          setContact({ ...contact, contactFirstName: v })
        }
      />
      <NamePairField
        label="担当者氏名（フリガナ）"
        required
        error={
          errors.contactLastNameKana ||
          errors.contactFirstNameKana ||
          undefined
        }
        lastName={contact.contactLastNameKana}
        firstName={contact.contactFirstNameKana}
        lastPlaceholder="例：カイケイ"
        firstPlaceholder="例：ハナコ"
        onLastNameChange={(v) =>
          setContact({ ...contact, contactLastNameKana: v })
        }
        onFirstNameChange={(v) =>
          setContact({ ...contact, contactFirstNameKana: v })
        }
      />
      <Field label="電話番号" error={errors.contactPhone} required>
        <input
          className={inputClass}
          type="tel"
          value={contact.contactPhone}
          onChange={(e) => setContact({ ...contact, contactPhone: e.target.value })}
          placeholder="例：03-5211-7172"
        />
      </Field>
      <Field label="メールアドレス" error={errors.email} required>
        <input
          id="register-contact-email"
          name="contactEmail"
          className={inputClass}
          type="text"
          inputMode="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={contact.email}
          onChange={(e) =>
            setContact((c) => ({ ...c, email: e.target.value }))
          }
          placeholder={EMAIL_PLACEHOLDER}
          autoComplete="email"
          data-testid="register-contact-email"
        />
      </Field>
      <Field
        label="メールアドレス（確認）"
        error={errors.emailConfirm}
        required
      >
        <input
          id="register-contact-email-confirm"
          name="contactEmailConfirm"
          className={inputClass}
          type="text"
          inputMode="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={contact.emailConfirm}
          onChange={(e) =>
            setContact((c) => ({ ...c, emailConfirm: e.target.value }))
          }
          onPaste={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V")) {
              e.preventDefault()
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault()
          }}
          placeholder={EMAIL_PLACEHOLDER}
          autoComplete="off"
          data-testid="register-contact-email-confirm"
        />
      </Field>
    </div>
  )
}

function StepContract({
  plan,
  setPlan,
  settlementMonth,
  setSettlementMonth,
  settlementDay,
  setSettlementDay,
  settlementDayOptions,
  paymentCycle,
  setPaymentCycle,
  monthlyBillingDay,
  setMonthlyBillingDay,
  paymentMethod,
  setPaymentMethod,
  adminPassword,
  onAdminPasswordChange,
  adminPasswordConfirm,
  onAdminPasswordConfirmChange,
  errors,
}: {
  plan: SchoolPlanId
  setPlan: (p: SchoolPlanId) => void
  settlementMonth: number
  setSettlementMonth: (n: number) => void
  settlementDay: number
  setSettlementDay: (n: number) => void
  settlementDayOptions: number[]
  paymentCycle: PaymentCycleId
  setPaymentCycle: (c: PaymentCycleId) => void
  monthlyBillingDay: MonthlyBillingDay
  setMonthlyBillingDay: (d: MonthlyBillingDay) => void
  paymentMethod: PaymentMethodId
  setPaymentMethod: (p: PaymentMethodId) => void
  adminPassword: string
  onAdminPasswordChange: (s: string) => void
  adminPasswordConfirm: string
  onAdminPasswordConfirmChange: (s: string) => void
  errors: Record<string, string>
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[#374151]">
        STEP 3：お申込み情報 ＆ パスワード設定
      </h2>
      <Field label="ご利用プラン" required>
        <select
          className={inputClass}
          value={plan}
          onChange={(e) => setPlan(e.target.value as SchoolPlanId)}
        >
          {PLAN_SELECT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="決算日" required>
        <div className="flex gap-3">
          <select
            className={inputClass}
            value={settlementMonth}
            onChange={(e) => setSettlementMonth(Number(e.target.value))}
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={settlementDay}
            onChange={(e) => setSettlementDay(Number(e.target.value))}
          >
            {settlementDayOptions.map((d) => (
              <option key={d} value={d}>
                {d}日
              </option>
            ))}
          </select>
        </div>
      </Field>
      <Field label="お支払いサイクル" required>
        <div className="flex gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="paymentCycle"
              checked={paymentCycle === "monthly"}
              onChange={() => setPaymentCycle("monthly")}
            />
            月払い
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="paymentCycle"
              checked={paymentCycle === "yearly"}
              onChange={() => setPaymentCycle("yearly")}
            />
            年払い
          </label>
        </div>
        {paymentCycle === "yearly" ? (
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            {YEARLY_PAYMENT_NOTE}
          </p>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            {MONTHLY_PAYMENT_NOTE}
          </p>
        )}
      </Field>
      <Field label="お支払い日" required>
        {paymentCycle === "monthly" ? (
          <select
            className={inputClass}
            value={monthlyBillingDay}
            onChange={(e) =>
              setMonthlyBillingDay(Number(e.target.value) as MonthlyBillingDay)
            }
          >
            {MONTHLY_BILLING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <p
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-[#374151]"
          >
            {formatBillingDayLabel("yearly", 31, settlementMonth)}
            （自動設定・変更不可）
          </p>
        )}
      </Field>
      <Field label="お支払方法" required>
        <select
          className={inputClass}
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodId)}
        >
          <option value="auto_debit">自動振替</option>
          <option value="bank_transfer">銀行振込</option>
          <option value="credit_card">クレジット払い</option>
        </select>
      </Field>
      <div className="border-t border-gray-100 pt-4">
        <p className="mb-3 text-sm font-medium text-[#374151]">
          管理者ログイン用パスワード
        </p>
        <Field label="管理者パスワード" error={errors.adminPassword} required>
          <PasswordInput
            id="register-admin-password"
            value={adminPassword}
            onChange={onAdminPasswordChange}
            autoComplete="new-password"
            placeholder="8文字以上・英大小・数字・記号"
            data-testid="register-admin-password"
            inputClassName="focus:ring-[#005088]/30"
          />
        </Field>
        <Field
          label="確認用パスワード"
          error={errors.adminPasswordConfirm}
          required
        >
          <PasswordInput
            id="register-admin-password-confirm"
            value={adminPasswordConfirm}
            onChange={onAdminPasswordConfirmChange}
            autoComplete="new-password"
            placeholder="もう一度入力"
            data-testid="register-admin-password-confirm"
            inputClassName="focus:ring-[#005088]/30"
          />
        </Field>
      </div>
    </div>
  )
}

function StepConfirm({
  school,
  contact,
  plan,
  settlementMonth,
  settlementDay,
  paymentCycle,
  monthlyBillingDay,
  paymentMethod,
  termsAccepted,
  setTermsAccepted,
  errors,
}: {
  school: SchoolFormState
  contact: ContactFormState
  plan: SchoolPlanId
  settlementMonth: number
  settlementDay: number
  paymentCycle: PaymentCycleId
  monthlyBillingDay: MonthlyBillingDay
  paymentMethod: PaymentMethodId
  termsAccepted: boolean
  setTermsAccepted: (v: boolean) => void
  errors: Record<string, string>
}) {
  const planLabel =
    PLAN_SELECT_OPTIONS.find((o) => o.value === plan)?.label ?? plan
  const positionDisplay = contact.position.trim() || "（未入力）"

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[#374151]">STEP 4：確認 ＆ 同意</h2>
      <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
        <ReviewSection title="学校情報">
          <ReviewRow label="学校名" value={school.schoolName} />
          <ReviewRow
            label="代表者"
            value={`${joinFullName(school.representativeLastName, school.representativeFirstName)}（${joinKanaName(school.representativeLastNameKana, school.representativeFirstNameKana)}）`}
          />
          <ReviewRow
            label="住所"
            value={`〒${school.postalCode} ${school.prefecture}${school.city}${school.addressLine}`}
          />
          <ReviewRow label="電話" value={school.phone} />
        </ReviewSection>
        <ReviewSection title="担当者情報">
          <ReviewRow label="管理部署" value={contact.department} />
          <ReviewRow label="役職" value={positionDisplay} />
          <ReviewRow
            label="担当者"
            value={`${joinFullName(contact.contactLastName, contact.contactFirstName)}（${joinKanaName(contact.contactLastNameKana, contact.contactFirstNameKana)}）`}
          />
          <ReviewRow label="電話" value={contact.contactPhone} />
          <ReviewRow label="メール" value={contact.email} />
        </ReviewSection>
        <ReviewSection title="お申込み情報">
          <ReviewRow label="ご利用プラン" value={planLabel} />
          <ReviewRow
            label="決算日"
            value={`${settlementMonth}月${settlementDay}日`}
          />
          <ReviewRow
            label="お支払いサイクル"
            value={formatPaymentCycleLabel(paymentCycle)}
          />
          <ReviewRow
            label="お支払い日"
            value={formatBillingDayLabel(
              paymentCycle,
              monthlyBillingDay,
              settlementMonth
            )}
          />
          <ReviewRow
            label="お支払方法"
            value={PAYMENT_METHOD_LABELS[paymentMethod]}
          />
        </ReviewSection>
      </dl>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300"
        />
        <span className="text-sm text-[#374151]">
          <a href="#" className="font-medium text-[#005088] hover:underline" onClick={(e) => e.preventDefault()}>
            利用規約
          </a>
          （現在はダミー）に同意します
        </span>
      </label>
      {errors.terms ? (
        <p className="text-sm text-[#EF4444]" role="alert">
          {errors.terms}
        </p>
      ) : null}
    </div>
  )
}

function StepComplete({ email, verifyUrl }: { email: string; verifyUrl: string }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: "#E8EEF4" }}
        >
          <Mail className="h-7 w-7" style={{ color: SCHOOL_BRAND_NAVY }} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-[#374151]">
          STEP 5：仮申し込み完了
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[#374151]">
          仮申し込みが完了しました。担当者メールアドレスに確認メールを送信しました。
        </p>
        <p className="mt-1 text-sm text-[#6B7280]">
          送信先: <span className="font-medium text-[#005088]">{email}</span>
        </p>
      </div>

      <div className="rounded-xl border-2 border-dashed border-[#005088]/40 bg-[#FAFCFE] p-5 sm:p-6">
        <p
          className="mb-4 text-center text-sm font-bold tracking-wide text-[#005088]"
        >
          【デモ用】担当者宛ての受信メール（シミュレーション）
        </p>
        <div className="rounded-lg border border-gray-200 bg-white p-5 text-left shadow-sm">
          <p className="text-xs text-[#9CA3AF]">宛先（To）</p>
          <p className="mt-1 text-sm font-medium text-[#005088]">{email || "—"}</p>
          <p className="mt-4 text-xs text-[#9CA3AF]">件名</p>
          <p className="mt-1 text-sm font-semibold text-[#374151]">
            【クラサポ会計】学校登録を完了してください
          </p>
          <hr className="my-4 border-gray-100" />
          <div className="space-y-3 text-sm leading-relaxed text-[#374151]">
            <p>{email || "（未入力）"} 様</p>
            <p>
              お申し込みありがとうございます。以下のURLにアクセスして、本登録を完了させてください。
            </p>
          </div>
          <p className="mt-4">
            <Link
              href={verifyUrl}
              className="break-all text-sm font-medium text-[#005088] underline hover:no-underline"
            >
              {verifyUrl}
            </Link>
          </p>
          <p className="mt-4 text-xs text-[#9CA3AF]">
            ※本登録完了後に学校ID（SCH-xxxxx）が発行されます。
          </p>
        </div>
      </div>

      <div className="text-center">
        <Link
          href={verifyUrl}
          className="inline-flex rounded-lg px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
          style={{ backgroundColor: SCHOOL_BRAND_NAVY }}
        >
          本登録URLを開く（デモ）
        </Link>
        <p className="mt-4 text-xs text-[#9CA3AF]">
          <Link href="/" className="hover:underline">
            トップページへ戻る
          </Link>
        </p>
      </div>
    </div>
  )
}

function ReviewSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-[#6B7280]">{label}</dt>
      <dd className="text-[#374151]">{value || "—"}</dd>
    </div>
  )
}

function NamePairField({
  label,
  lastName,
  firstName,
  lastPlaceholder,
  firstPlaceholder,
  onLastNameChange,
  onFirstNameChange,
  error,
  required,
}: {
  label: string
  lastName: string
  firstName: string
  lastPlaceholder: string
  firstPlaceholder: string
  onLastNameChange: (v: string) => void
  onFirstNameChange: (v: string) => void
  error?: string
  required?: boolean
}) {
  return (
    <Field label={label} error={error} required={required}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="mb-1 block text-xs text-[#6B7280]">姓</span>
          <input
            className={inputClass}
            value={lastName}
            onChange={(e) => onLastNameChange(e.target.value)}
            placeholder={lastPlaceholder}
          />
        </div>
        <div>
          <span className="mb-1 block text-xs text-[#6B7280]">名</span>
          <input
            className={inputClass}
            value={firstName}
            onChange={(e) => onFirstNameChange(e.target.value)}
            placeholder={firstPlaceholder}
          />
        </div>
      </div>
    </Field>
  )
}

function Field({
  label,
  children,
  error,
  required,
}: {
  label: string
  children: React.ReactNode
  error?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#374151]">
        {label}
        {required ? <span className="text-[#EF4444]"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

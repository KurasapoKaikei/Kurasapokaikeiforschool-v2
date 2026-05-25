"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Copy, Loader2 } from "lucide-react"
import { DemoMailInbox } from "@/components/register/DemoMailInbox"
import {
  activateSchoolRegistration,
  activateSchoolRegistrationByToken,
} from "@/lib/schoolRegistration"
import { loadContractInfo } from "@/lib/schoolContractInfo"
import { SCHOOL_BRAND_NAVY, SCHOOL_ROUTES } from "@/lib/schoolTheme"

export function SchoolRegisterVerifyView() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")?.trim() ?? ""
  const legacySchoolId = searchParams.get("id")?.trim() ?? ""

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [issuedSchoolId, setIssuedSchoolId] = useState<string | null>(null)
  const [contactEmail, setContactEmail] = useState<string>("")
  const [loginUrl, setLoginUrl] = useState("http://localhost:3000/school/login")
  const [message, setMessage] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLoginUrl(`${window.location.origin}${SCHOOL_ROUTES.login}`)
    }
  }, [])

  useEffect(() => {
    if (token) {
      const result = activateSchoolRegistrationByToken(token)
      if (result) {
        setIssuedSchoolId(result.schoolId)
        const info = loadContractInfo()
        setContactEmail(info?.contact.email ?? "")
        setStatus("success")
        return
      }
      setStatus("error")
      setMessage(
        "お申し込み情報が見つかりません。仮申込の有効期限が切れているか、すでに本登録済みの可能性があります。"
      )
      return
    }

    if (legacySchoolId) {
      const ok = activateSchoolRegistration(legacySchoolId)
      if (ok) {
        setIssuedSchoolId(legacySchoolId)
        const info = loadContractInfo()
        setContactEmail(info?.contact.email ?? "")
        setStatus("success")
        return
      }
      setStatus("error")
      setMessage("認証に失敗しました。お申し込み情報が見つかりません。")
      return
    }

    setStatus("error")
    setMessage("認証URLが不正です。メール内のリンクから再度アクセスしてください。")
  }, [token, legacySchoolId])

  const handleCopyId = async () => {
    if (!issuedSchoolId) return
    try {
      await navigator.clipboard.writeText(issuedSchoolId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* デモ環境では無視 */
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#E8EEF4] to-white px-6 py-12">
      <div className="w-full max-w-lg text-center">
        {status === "loading" && (
          <>
            <Loader2
              className="mx-auto h-10 w-10 animate-spin"
              style={{ color: SCHOOL_BRAND_NAVY }}
            />
            <p className="mt-4 text-sm text-[#6B7280]">本登録を処理しています…</p>
          </>
        )}

        {status === "success" && issuedSchoolId && (
          <div className="space-y-6">
            <p className="text-3xl font-bold text-[#374151]">🎉 本登録が完了しました！</p>
            <p className="text-sm text-[#6B7280]">
              管理者ログインには、以下の学校IDと申込時に設定したパスワードをご利用ください。
            </p>
            <div
              className="rounded-2xl border-2 bg-white px-6 py-8 shadow-md"
              style={{ borderColor: SCHOOL_BRAND_NAVY }}
            >
              <p className="text-sm font-medium text-[#6B7280]">あなたの学校ID</p>
              <p
                className="mt-2 font-mono text-3xl font-bold tracking-wide sm:text-4xl"
                style={{ color: SCHOOL_BRAND_NAVY }}
              >
                {issuedSchoolId}
              </p>
              <button
                type="button"
                onClick={handleCopyId}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-[#374151] hover:bg-gray-50"
              >
                <Copy className="h-4 w-4" />
                {copied ? "コピーしました" : "学校IDをコピー"}
              </button>
            </div>

            <DemoMailInbox
              bannerTitle="【デモ用】担当者宛ての受信メール（自動送信）"
              toEmail={contactEmail || undefined}
              subject="【クラサポ会計】本登録完了・学校ID発行のお知らせ"
            >
              <p>
                お申し込みが完了しました。あなた専用の学校IDを発行いたしましたので、大切に保管してください。
              </p>
              <div className="rounded-md bg-gray-50 px-3 py-3 text-left">
                <p>
                  <span className="font-medium text-[#6B7280]">■学校ID：</span>{" "}
                  <span className="font-mono font-semibold text-[#005088]">
                    {issuedSchoolId}
                  </span>
                </p>
                <p className="mt-2">
                  <span className="font-medium text-[#6B7280]">■ログインURL：</span>{" "}
                  <Link
                    href={loginUrl}
                    className="break-all font-medium text-[#005088] underline hover:no-underline"
                  >
                    {loginUrl}
                  </Link>
                </p>
              </div>
            </DemoMailInbox>

            <Link
              href={SCHOOL_ROUTES.login}
              className="inline-flex w-full max-w-xs justify-center rounded-lg px-6 py-3.5 text-base font-semibold text-white hover:opacity-90 sm:w-auto"
              style={{ backgroundColor: SCHOOL_BRAND_NAVY }}
            >
              学校管理者ログイン画面へ
            </Link>
          </div>
        )}

        {status === "error" && (
          <>
            <p className="text-lg font-semibold text-[#EF4444]">認証エラー</p>
            <p className="mt-2 text-sm text-[#6B7280]">{message}</p>
            <Link
              href="/register/school"
              className="mt-6 inline-block text-sm font-medium hover:underline"
              style={{ color: SCHOOL_BRAND_NAVY }}
            >
              申込フォームへ戻る
            </Link>
          </>
        )}
      </div>
    </main>
  )
}

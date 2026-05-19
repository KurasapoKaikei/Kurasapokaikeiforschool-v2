"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Printer, X } from "lucide-react"
import { SCHOOL_BRAND_NAVY } from "@/lib/schoolTheme"
import type { SchoolClub } from "@/lib/schoolClubs"

const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  #school-club-account-print-root,
  #school-club-account-print-root * { visibility: visible !important; }
  #school-club-account-print-root {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    background: white !important;
  }
  .school-club-print-no-print { display: none !important; }
}
`

type SchoolClubAccountPrintModalProps = {
  open: boolean
  onClose: () => void
  clubs: SchoolClub[]
}

/** クラブアカウント情報の印刷用モーダル */
export function SchoolClubAccountPrintModal({
  open,
  onClose,
  clubs,
}: SchoolClubAccountPrintModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLE }} />

      <div
        className="school-club-print-no-print fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="club-account-print-title"
      >
        <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-gray-200 bg-white shadow-xl">
          <div className="school-club-print-no-print flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2
              id="club-account-print-title"
              className="text-lg font-semibold text-[#374151]"
            >
              アカウント情報一覧（印刷用）
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-[#6B7280] hover:bg-gray-100"
              aria-label="閉じる"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto px-6 py-5">
            <div id="school-club-account-print-root">
              <p className="mb-1 text-sm font-medium text-[#374151]">
                クラサポ会計 for School — クラブログイン情報
              </p>
              <p className="mb-6 text-xs text-[#6B7280]">
                各クラブ担当者へ配布してください。ログインIDはクラブID、初回パスワードは下記のとおりです。
              </p>

              {clubs.length === 0 ? (
                <p className="text-sm text-[#6B7280]">登録されたクラブがありません。</p>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-300 text-left">
                      <th className="py-2 pr-4 font-semibold text-[#374151]">クラブ名</th>
                      <th className="py-2 pr-4 font-semibold text-[#374151]">クラブID</th>
                      <th className="py-2 font-semibold text-[#374151]">初期パスワード</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clubs.map((club) => (
                      <tr key={club.id} className="border-b border-gray-200">
                        <td className="py-3 pr-4 text-[#374151]">{club.name}</td>
                        <td className="py-3 pr-4 font-mono text-[#374151]">{club.id}</td>
                        <td className="py-3 font-mono font-medium text-[#374151]">
                          {club.initialPassword}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="school-club-print-no-print flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>
              閉じる
            </Button>
            <Button
              type="button"
              className="gap-2 text-white hover:opacity-90"
              style={{ backgroundColor: SCHOOL_BRAND_NAVY }}
              onClick={() => window.print()}
              disabled={clubs.length === 0}
            >
              <Printer className="h-4 w-4" />
              印刷する
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

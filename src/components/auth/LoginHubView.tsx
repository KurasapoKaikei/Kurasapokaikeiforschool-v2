"use client"

import { useState } from "react"
import Link from "next/link"
import { ClubLoginForm } from "@/components/auth/ClubLoginForm"
import {
  CLUB_BRAND_PINK,
  SCHOOL_BRAND_NAVY,
  SCHOOL_ROUTES,
} from "@/lib/schoolTheme"

type HubView = "hub" | "club"

/** トップページ：統合ログインハブ */
export function LoginHubView() {
  const [view, setView] = useState<HubView>("hub")
  const [memberNoticeOpen, setMemberNoticeOpen] = useState(false)

  if (view === "club") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#FDF2F5] to-[#F5F5F0] px-6 py-12">
        <ClubLoginForm onBack={() => setView("hub")} />
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#F0F4F8] to-[#F5F5F0] px-6 py-12">
      <div className="w-full max-w-lg">
        <header className="mb-10 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[#374151]">
            クラサポ会計
          </h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            ログイン種別を選択してください
          </p>
        </header>

        <div className="flex flex-col gap-4">
          <Link
            href={SCHOOL_ROUTES.login}
            className="group block rounded-2xl border-2 border-transparent bg-white p-6 shadow-md transition hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#005088]/50"
            style={{ borderLeftWidth: 6, borderLeftColor: SCHOOL_BRAND_NAVY }}
          >
            <span
              className="mb-2 inline-block rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: SCHOOL_BRAND_NAVY }}
            >
              学校
            </span>
            <span className="block text-xl font-bold text-[#374151] group-hover:text-[#005088]">
              学校ログイン
            </span>
            <span className="mt-1 block text-sm text-[#6B7280]">
              管理者ポータルへ
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setView("club")}
            className="group w-full rounded-2xl border-2 border-transparent bg-white p-6 text-left shadow-md transition hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E66A84]/50"
            style={{ borderLeftWidth: 6, borderLeftColor: CLUB_BRAND_PINK }}
          >
            <span
              className="mb-2 inline-block rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: CLUB_BRAND_PINK }}
            >
              クラブ
            </span>
            <span className="block text-xl font-bold text-[#374151] group-hover:text-[#E66A84]">
              クラブログイン
            </span>
            <span className="mt-1 block text-sm text-[#6B7280]">
              クラブIDとパスワードでサインイン
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMemberNoticeOpen(true)}
            className="group w-full rounded-2xl border-2 border-transparent bg-white p-6 text-left shadow-md transition hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50"
            style={{ borderLeftWidth: 6, borderLeftColor: "#9CA3AF" }}
          >
            <span className="mb-2 inline-block rounded-full bg-[#6B7280] px-3 py-1 text-xs font-semibold text-white">
              部員
            </span>
            <span className="block text-xl font-bold text-[#374151] group-hover:text-[#4B5563]">
              部員ログイン
            </span>
            <span className="mt-1 block text-sm text-[#6B7280]">
              部員向けページ（準備中）
            </span>
          </button>
        </div>
      </div>

      {memberNoticeOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="member-notice-title"
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2
              id="member-notice-title"
              className="text-lg font-bold text-[#374151]"
            >
              お知らせ
            </h2>
            <p className="mt-3 text-sm text-[#6B7280]">
              部員ページは現在準備中です
            </p>
            <button
              type="button"
              onClick={() => setMemberNoticeOpen(false)}
              className="mt-6 w-full rounded-lg bg-[#6B7280] py-2.5 text-sm font-semibold text-white hover:bg-[#4B5563]"
            >
              閉じる
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}

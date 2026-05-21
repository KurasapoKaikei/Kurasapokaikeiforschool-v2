"use client"

import { useRouter } from "next/navigation"
import { ClubLoginForm } from "@/components/auth/ClubLoginForm"

/** クラブログイン専用ページ（/club/login） */
export function ClubLoginView() {
  const router = useRouter()
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#FDF2F5] to-[#F5F5F0] px-6 py-12">
      <ClubLoginForm onBack={() => router.push("/")} />
    </main>
  )
}

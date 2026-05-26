"use client"

import { useRouter } from "next/navigation"
import { AuditorLoginForm } from "@/components/auth/AuditorLoginForm"
import { AUDIT_ROUTES } from "@/lib/auditorTheme"

export function AuditorLoginView() {
  const router = useRouter()
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#FFF7ED] to-[#F5F5F0] px-6 py-12">
      <AuditorLoginForm
        onSuccess={() => router.push(AUDIT_ROUTES.home)}
        onBack={() => router.push("/")}
      />
    </main>
  )
}

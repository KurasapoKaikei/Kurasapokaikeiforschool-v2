import { ReactNode } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { AppShellHeader } from "@/components/layout/AppShellHeader"

/** ダッシュボード系（(dashboard) / (club) / (parent)）共通のサイドバー＋ヘッダー枠 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F5F5F0]">
      <Sidebar />
      <main className="flex-1 ml-64">
        <AppShellHeader />
        <div className="pt-3">{children}</div>
      </main>
    </div>
  )
}

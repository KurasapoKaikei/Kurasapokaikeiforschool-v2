import { ReactNode } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"

export default function DashboardGroupLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-[#F5F5F0]">
      <Sidebar />
      <main className="flex-1 ml-64">
        <Header />
        {children}
      </main>
    </div>
  )
}

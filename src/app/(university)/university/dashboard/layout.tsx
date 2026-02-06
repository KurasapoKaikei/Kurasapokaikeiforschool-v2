import { ReactNode } from "react"

export default function UniversityDashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-dashboard/10">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-dashboard">
            大学統合ダッシュボード
          </h1>
        </div>
      </div>
      {children}
    </div>
  )
}

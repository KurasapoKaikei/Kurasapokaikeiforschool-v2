import { ReactNode } from "react"

export default function ApprovalsLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-accounting/10">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-accounting">
            承認待ち一覧
          </h1>
        </div>
      </div>
      {children}
    </div>
  )
}

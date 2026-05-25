import { ReactNode } from "react"

/** ダッシュボード：高さ制限は page 内のメイン領域のみ（サイドバーと分離） */
export default function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  return <>{children}</>
}

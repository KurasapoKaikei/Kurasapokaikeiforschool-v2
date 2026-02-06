import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { UserInfoProvider } from "@/contexts/UserInfoContext"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "クラサポ会計 - Classapo Accounting",
  description: "大学スポーツ・部活動向け会計DXソリューション",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <UserInfoProvider>
          {children}
        </UserInfoProvider>
      </body>
    </html>
  )
}

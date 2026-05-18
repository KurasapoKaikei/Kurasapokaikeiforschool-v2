import { redirect } from "next/navigation"

export default function SettingsPage() {
  // クラブ設定ページにリダイレクト
  redirect("/club/settings/club")
}

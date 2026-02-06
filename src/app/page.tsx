import { redirect } from "next/navigation"

export default function Home() {
  // ログイン状態に応じてリダイレクト
  // 未実装のため、一旦ダッシュボードへ
  redirect("/dashboard")
}

import { redirect } from "next/navigation"

export default function RegisterPage() {
  // 新規登録ページにリダイレクト
  redirect("/accounting/register/new")
}

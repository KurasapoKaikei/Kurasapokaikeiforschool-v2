import { redirect } from "next/navigation"

export default function RegisterPage() {
  // 新規登録ページにリダイレクト
  redirect("/club/accounting/register/new")
}

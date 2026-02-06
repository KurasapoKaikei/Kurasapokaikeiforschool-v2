import { redirect } from "next/navigation"

export default function AccountingPage() {
  // 入出金登録ページにリダイレクト
  redirect("/accounting/register")
}

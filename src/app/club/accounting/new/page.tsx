import { redirect } from "next/navigation"

export default function NewTransactionPage() {
  // 入出金登録ページにリダイレクト
  redirect("/club/accounting/register")
}

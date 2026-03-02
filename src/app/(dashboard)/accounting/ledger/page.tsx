"use client"

import { mockTransactions } from "@/constants/mockData"

export default function LedgerPage() {
  // 証憑なしの取引を赤字で表示
  const getRowStyle = (transaction: typeof mockTransactions[0]) => {
    if (transaction.type === "EXPENSE" && !transaction.receiptUrl) {
      return "bg-[#EF4444] text-white"
    }
    return "bg-white text-[#374151]"
  }

  // 日付フォーマット関数
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}/${month}/${day}`
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2 text-[#374151]">集金・帳簿</h2>
        <p className="text-sm text-[#6B7280]">取引一覧と集金状況</p>
      </div>

      {/* 取引一覧テーブル */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#374151]">日付</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#374151]">摘要</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#374151]">科目</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-[#374151]">収入</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-[#374151]">支出</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-[#374151]">証憑</th>
            </tr>
          </thead>
          <tbody>
            {mockTransactions.map((transaction) => (
              <tr
                key={transaction.id}
                className={`border-t border-gray-200 ${getRowStyle(transaction)}`}
              >
                <td className="px-4 py-3 text-sm">
                  {formatDate(transaction.date)}
                </td>
                <td className="px-4 py-3 text-sm">{transaction.description}</td>
                <td className="px-4 py-3 text-sm">{transaction.accountTitle}</td>
                <td className="px-4 py-3 text-sm text-right">
                  {transaction.type === "INCOME" ? transaction.amount.toLocaleString() : "-"}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  {transaction.type === "EXPENSE" ? transaction.amount.toLocaleString() : "-"}
                </td>
                <td className="px-4 py-3 text-sm text-center">
                  {transaction.receiptUrl ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-red-600">✗</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 注意書き */}
      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>注意:</strong> 証憑（領収書）がない支出取引は、行全体が赤字（#EF4444）で表示されます。
        </p>
      </div>
    </div>
  )
}

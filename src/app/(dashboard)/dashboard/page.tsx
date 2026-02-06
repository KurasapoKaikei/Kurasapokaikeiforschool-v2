"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { mockMemberCounts, mockMemberLastUpdated, mockMessages } from "@/constants/mockData"
import { getTransactions, getAccountTitles, type Transaction, type AccountTitle } from "@/utils/localStorage"

export default function DashboardPage() {
  const router = useRouter()
  const [selectedYear, setSelectedYear] = useState("2025年度")
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])

  // LocalStorageから取引データと科目データを読み込み
  useEffect(() => {
    const loadedTransactions = getTransactions()
    const loadedAccountTitles = getAccountTitles()
    setTransactions(loadedTransactions)
    setAccountTitles(loadedAccountTitles)
  }, [])

  // 取引データの変更を監視（リアルタイム更新）
  useEffect(() => {
    const interval = setInterval(() => {
      const loadedTransactions = getTransactions()
      const loadedAccountTitles = getAccountTitles()
      setTransactions(loadedTransactions)
      setAccountTitles(loadedAccountTitles)
    }, 500)

    return () => clearInterval(interval)
  }, [])

  // 現金・預金科目のみを取得
  const cashAccountTitles = useMemo(
    () => accountTitles.filter((t) => t.group === "cash").sort((a, b) => a.order - b.order),
    [accountTitles]
  )

  // 各現金・預金科目の残高を計算（出納帳と同じロジック）
  const cashBalances = useMemo(() => {
    return cashAccountTitles.map((account) => {
      const accountName = account.name
      const openingBalance = account.balance ?? 0

      // この科目が counterparty（入金先/出金元）として登録されている取引を計算
      let balance = openingBalance
      transactions.forEach((t) => {
        if (t.counterparty !== accountName) return

        const isIncome = t.type === "income" || t.type === "collection"
        const isExpense = t.type === "expense" || t.type === "transfer" || t.type === "deferred"

        if (isIncome) balance += t.amount
        if (isExpense) balance -= t.amount
      })

      return {
        id: account.id,
        name: accountName,
        currentBalance: balance,
      }
    })
  }, [cashAccountTitles, transactions])

  // 総残高（全科目の現在残高の合計）
  const cashDepositTotal = useMemo(
    () => cashBalances.reduce((sum, item) => sum + item.currentBalance, 0),
    [cashBalances]
  )

  // 資産・負債の計算
  const { assetBalances, liabilityBalances, assetTotal, liabilityTotal } = useMemo(() => {
    const assetBalances: Record<string, number> = {
      未収入金: 0,
      仮払金: 0,
    }
    const liabilityBalances: Record<string, number> = {
      未払金: 0,
      仮受金: 0,
    }

    transactions.forEach((transaction) => {
      const accountName = transaction.accountTitle

      // 繰延取引（資産・負債）の計算
      if (transaction.type === "deferred") {
        const isRecord = transaction.counterparty === "record"
        const isAsset = transaction.category === "asset"

        if (isAsset && assetBalances.hasOwnProperty(accountName)) {
          if (isRecord) {
            assetBalances[accountName] += transaction.amount
          } else {
            assetBalances[accountName] -= transaction.amount
          }
        } else if (!isAsset && liabilityBalances.hasOwnProperty(accountName)) {
          if (isRecord) {
            liabilityBalances[accountName] += transaction.amount
          } else {
            liabilityBalances[accountName] -= transaction.amount
          }
        }
      }
    })

    const assetArray = Object.entries(assetBalances)
      .filter(([_, amount]) => amount !== 0)
      .map(([name, amount]) => ({ name, amount }))

    const liabilityArray = Object.entries(liabilityBalances)
      .filter(([_, amount]) => amount !== 0)
      .map(([name, amount]) => ({ name, amount }))

    const assetTotal = assetArray.reduce((sum, item) => sum + item.amount, 0)
    const liabilityTotal = liabilityArray.reduce((sum, item) => sum + item.amount, 0)

    return { assetBalances: assetArray, liabilityBalances: liabilityArray, assetTotal, liabilityTotal }
  }, [transactions])

  // 次期繰越金 = 現金預金合計 + 資産合計 - 負債合計
  const carryOverAmount = cashDepositTotal + assetTotal - liabilityTotal

  // アラート件数を計算（証憑なしの支出取引）
  const alertCount = transactions.filter(
    (t) => t.type === "expense" && !t.receiptUrl
  ).length

  // 部員数の合計
  const totalMembers = mockMemberCounts.reduce((sum, item) => sum + item.count, 0)

  // 日付フォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}/${month}/${day}`
  }

  // メッセージの未読数を計算
  const unreadMessageCount = mockMessages.filter((m) => m.isUnread).length

  // 金額フォーマット（￥なし、カンマ区切り）
  const formatAmount = (n: number): string => n.toLocaleString()

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* 年度選択バー */}
      <div className="bg-white border-b border-gray-200 px-6 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6B7280] mr-2">年度切替:</span>
          {["2023年度", "2024年度", "2025年度"].map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedYear === year
                  ? "bg-[#E66A84] text-white"
                  : "bg-gray-100 text-[#374151] hover:bg-gray-200"
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-4">
        {/* 一段目: 3カラム構成（同等幅） */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {/* 左ブロック: 現在の残高 */}
          <div className="rounded-lg border-l-[5px] border-l-[#E66A84] border border-gray-200 bg-white p-4 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-[#E66A84] border-b-2 border-[#E66A84] pb-1.5">
                現在の残高
              </h2>
              <span className="text-xs text-[#9CA3AF]">（単位：円）</span>
            </div>

            {/* 現金預金の内訳 */}
            <div className="mb-3">
              <div className="bg-[#F3F4F6] px-2 py-1 mb-1 rounded">
                <h3 className="text-xs font-semibold text-[#6B7280]">現金預金</h3>
              </div>
              <div className="space-y-1">
                {cashBalances.length > 0 ? (
                  cashBalances.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-2 cursor-pointer hover:bg-gray-50 rounded transition-colors"
                      onClick={() => router.push(`/accounting/ledger/cash-bank?account_id=${item.id}`)}
                    >
                      <span className="text-sm text-[#374151]">{item.name}</span>
                      <span className="text-sm font-semibold text-[#374151] text-right min-w-[120px] tabular-nums">
                        {formatAmount(item.currentBalance)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-2 text-sm text-[#6B7280]">データがありません</div>
                )}
                {/* 現金預金合計（現在のキャッシュ） */}
                <div
                  className="border-t border-gray-200 pt-1 mt-1 px-2 cursor-pointer hover:bg-gray-50 rounded transition-colors"
                  onClick={() => router.push("/accounting/ledger/cash-bank")}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#374151]">現金預金合計</span>
                    <span className="text-base font-bold text-[#374151] text-right min-w-[120px] tabular-nums">
                      {formatAmount(cashDepositTotal)}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5">現在のキャッシュ</p>
                </div>
              </div>
            </div>

            {/* 入る予定（資産） */}
            <div className="mb-3">
              <div className="bg-[#F3F4F6] px-2 py-1 mb-1 rounded">
                <h3 className="text-xs font-semibold text-[#6B7280]">入る予定（資産）</h3>
              </div>
              <div className="space-y-1">
                {assetBalances.length > 0 ? (
                  assetBalances.map((asset) => (
                    <div key={asset.name} className="flex items-center justify-between px-2">
                      <span className="text-sm text-[#374151]">{asset.name}</span>
                      <span className="text-sm font-semibold text-[#374151] text-right min-w-[120px] tabular-nums">
                        {formatAmount(asset.amount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-2 text-sm text-[#6B7280]">データがありません</div>
                )}
                <div className="border-t border-gray-200 pt-1 mt-1 px-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#374151]">資産合計</span>
                    <span className="text-base font-bold text-[#374151] text-right min-w-[120px] tabular-nums">
                      {formatAmount(assetTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 支払う予定（負債） */}
            <div className="mb-3">
              <div className="bg-[#F3F4F6] px-2 py-1 mb-1 rounded">
                <h3 className="text-xs font-semibold text-[#6B7280]">支払う予定（負債）</h3>
              </div>
              <div className="space-y-1">
                {liabilityBalances.length > 0 ? (
                  liabilityBalances.map((liability) => (
                    <div key={liability.name} className="flex items-center justify-between px-2">
                      <span className="text-sm text-[#374151]">{liability.name}</span>
                      <span className="text-sm font-semibold text-[#374151] text-right min-w-[120px] tabular-nums">
                        {formatAmount(liability.amount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-2 text-sm text-[#6B7280]">データがありません</div>
                )}
                <div className="border-t border-gray-200 pt-1 mt-1 px-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#374151]">負債合計</span>
                    <span className="text-base font-bold text-[#374151] text-right min-w-[120px] tabular-nums">
                      {formatAmount(liabilityTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 実質残高（次期繰越金）- 会計上の最終値（最も強調） */}
            <div className="border-2 border-[#E66A84] border-double pt-2 mt-2 bg-[#FCE7F3] rounded-lg p-2.5">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-base font-bold text-[#374151]">実質残高（次期繰越金）</span>
                <span className="text-2xl font-bold text-[#E66A84] text-right min-w-[120px] tabular-nums">
                  {formatAmount(carryOverAmount)}
                </span>
              </div>
              <p className="text-xs text-[#6B7280] mt-0.5 mb-0.5">
                (現金預金合計 + 資産合計 - 負債合計)
              </p>
              <p className="text-xs text-[#6B7280] italic">
                ※手元の現金に、入る予定を足し、支払う予定を引いた金額です
              </p>
            </div>
          </div>

          {/* 中央ブロック: お知らせ */}
          <div className="rounded-lg border-l-[5px] border-l-[#4A90E2] border border-gray-200 bg-white p-4 shadow-sm flex flex-col h-full">
            <h2 className="text-lg font-semibold mb-3 text-[#4A90E2] border-b-2 border-[#4A90E2] pb-1.5 flex-shrink-0">
              お知らせ
            </h2>
            <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
              {mockMessages.map((message) => (
                <div
                  key={message.id}
                  className="flex items-start gap-3 px-2 py-2 hover:bg-gray-50 rounded transition-colors"
                >
                  <span className="text-xs text-[#6B7280] min-w-[70px]">{message.date}</span>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`text-sm truncate ${message.isUnread ? "font-semibold text-[#374151]" : "text-[#6B7280]"}`}>
                      {message.subject}
                    </span>
                    {message.isUnread && (
                      <span className="w-2 h-2 bg-[#EF4444] rounded-full flex-shrink-0"></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {unreadMessageCount > 0 && (
              <div className="mt-3 pt-2 border-t border-gray-200 flex-shrink-0">
                <p className="text-xs text-[#6B7280]">
                  未読: <span className="font-semibold text-[#EF4444]">{unreadMessageCount}件</span>
                </p>
              </div>
            )}
          </div>

          {/* 右ブロック: エラー通知と部員数を縦に配置（各50%） */}
          <div className="flex flex-col gap-4 h-full">
            {/* 重要：未処理・エラー通知（上段、50%） */}
            <div className="rounded-lg border-l-[5px] border-l-[#FF0000] border border-gray-200 bg-white p-4 shadow-sm flex flex-col flex-1 min-h-0">
              <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#FF0000]" strokeWidth={2.5} />
                <h2 className="text-lg font-semibold text-[#FF0000] border-b-2 border-[#FF0000] pb-1">
                  重要：未処理・エラー通知
                </h2>
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-xs text-[#6B7280] mb-3">監査警告件数</p>
                <p className="text-xl font-bold text-[#FF0000]">{alertCount}件</p>
                {alertCount > 0 && (
                  <p className="text-xs text-[#FF0000] mt-2 font-medium">至急確認が必要です</p>
                )}
              </div>
            </div>

            {/* 2025年度の部員数（下段、50%） */}
            <div className="rounded-lg border-l-[5px] border-l-[#9D8CC3] border border-gray-200 bg-white p-4 shadow-sm flex flex-col flex-1 min-h-0">
              <div className="mb-2 flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-semibold text-[#9D8CC3] border-b-2 border-[#9D8CC3] pb-1">
                    2025年度の部員数
                  </h2>
                  <span className="text-xs text-[#6B7280]">
                    最終更新: {formatDate(mockMemberLastUpdated)}
                  </span>
                </div>
              </div>
              <div className="space-y-1 flex-1 flex flex-col justify-between">
                <div>
                  {mockMemberCounts.map((member) => (
                    <div key={member.grade} className="flex items-center justify-between px-2">
                      <span className="text-sm text-[#374151]">{member.grade}年生</span>
                      <span className="text-sm font-semibold text-[#374151] text-right min-w-[60px]">
                        {member.count}名
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-200 pt-1 mt-1 px-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#374151]">合計</span>
                    <span className="text-base font-bold text-[#374151] text-right min-w-[60px]">
                      {totalMembers}名
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { clubPath } from "@/lib/routes"
import { useClubSession } from "@/contexts/ClubSessionContext"
import {
  getPortalAccountTitles,
  getPortalMembers,
  getPortalMessages,
  getPortalTransactions,
} from "@/lib/clubPortalData"
import { PORTAL_MESSAGES_CHANGED_EVENT } from "@/lib/portalMessages"
import {
  CLUB_MEMBERS_CHANGED_EVENT,
  isClubMembersChangedForClub,
} from "@/lib/clubMembers"
import { ClubDashboardSettlementSummary } from "@/components/club/ClubDashboardSettlementSummary"
import { ClubDashboardVoucherStats } from "@/components/club/ClubDashboardVoucherStats"
import { ClubMessageInboxList } from "@/components/club/ClubMessageInboxList"
import { SettlementLockAlert } from "@/components/club/SettlementLockAlert"
import { useClubSettlementLock } from "@/hooks/useClubSettlementLock"
import type { ClubPortalMessageView } from "@/lib/portalMessages"
import { type Transaction, type AccountTitle, type Member } from "@/utils/localStorage"

export default function DashboardPage() {
  const router = useRouter()
  const { activeClub, isEmptyPortal, refresh } = useClubSession()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [messages, setMessages] = useState<ClubPortalMessageView[]>([])
  const isLocked = useClubSettlementLock()
  const loadPortalData = useCallback(() => {
    setTransactions(getPortalTransactions(activeClub))
    setAccountTitles(getPortalAccountTitles(activeClub))
    setMembers(getPortalMembers(activeClub))
    setMessages(getPortalMessages(activeClub))
    refresh()
  }, [activeClub, isEmptyPortal, refresh])

  useEffect(() => {
    loadPortalData()
  }, [loadPortalData])

  useEffect(() => {
    const clubId = activeClub?.id ?? ""
    const onMessagesChange = () => loadPortalData()
    const onMembersChange = (e: Event) => {
      if (!clubId || isClubMembersChangedForClub(clubId, e)) {
        loadPortalData()
      }
    }
    window.addEventListener(PORTAL_MESSAGES_CHANGED_EVENT, onMessagesChange)
    window.addEventListener(CLUB_MEMBERS_CHANGED_EVENT, onMembersChange)
    window.addEventListener("storage", onMembersChange)
    return () => {
      window.removeEventListener(PORTAL_MESSAGES_CHANGED_EVENT, onMessagesChange)
      window.removeEventListener(CLUB_MEMBERS_CHANGED_EVENT, onMembersChange)
      window.removeEventListener("storage", onMembersChange)
    }
  }, [loadPortalData, activeClub?.id])

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

  // 通常時は現金預金のみ。決算時の繰延で資産・負債残高がある場合のみ表示
  const showDeferredBalanceSections =
    assetBalances.length > 0 || liabilityBalances.length > 0

  // 部員統計（在籍中のみ）
  const activeMembers = useMemo(() => members.filter((m) => m.status === "active"), [members])
  const memberCountsByGrade = useMemo(() => {
    const counts: { grade: number; count: number }[] = [
      { grade: 4, count: 0 },
      { grade: 3, count: 0 },
      { grade: 2, count: 0 },
      { grade: 1, count: 0 },
    ]
    activeMembers.forEach((m) => {
      const entry = counts.find((c) => c.grade === m.grade)
      if (entry) entry.count++
    })
    return counts
  }, [activeMembers])
  const totalMembers = activeMembers.length

  // 部員の最終更新日
  const memberLastUpdated = useMemo(() => {
    if (members.length === 0) return null
    return members.reduce((latest, m) => {
      const d = new Date(m.createdAt).getTime()
      return d > latest ? d : latest
    }, 0)
  }, [members])

  // 日付フォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}/${month}/${day}`
  }

  const unreadMessageCount = messages.filter((m) => !m.isRead).length

  // 金額フォーマット（￥なし、カンマ区切り）
  const formatAmount = (n: number): string => n.toLocaleString()

  return (
    <div className="flex flex-col bg-[#F5F5F0]">
      <div className="px-6 pt-2">
        <SettlementLockAlert isLocked={isLocked} />
      </div>
      {/* ダッシュボード本体のみ 67vh（サイドバーには適用しない） */}
      <div className="flex h-[67vh] max-h-[67vh] min-h-0 flex-col overflow-hidden px-6 pb-3 pt-2">
        <div className="grid h-full min-h-0 grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 左ブロック: 現在の残高（科目多数時はこのカード内のみスクロール） */}
          <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 border-l-[5px] border-l-[#E66A84] bg-white p-3 shadow-sm">
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <h2 className="border-b-2 border-[#E66A84] pb-1 text-base font-semibold text-[#E66A84]">
                現在の残高
              </h2>
              <span className="text-xs text-[#9CA3AF]">（単位：円）</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {/* 現金預金の内訳 */}
            <div className="mb-2">
              <div className="bg-[#F3F4F6] px-2 py-1 mb-1 rounded">
                <h3 className="text-xs font-semibold text-[#6B7280]">現金預金</h3>
              </div>
              <div className="space-y-1">
                {cashBalances.length > 0 ? (
                  cashBalances.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-2 cursor-pointer hover:bg-gray-50 rounded transition-colors"
                      onClick={() => router.push(`/club/accounting/ledger/cash-bank?account_id=${item.id}`)}
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
                  onClick={() => router.push("/club/accounting/ledger/cash-bank")}
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

            {/* 入る予定（資産）— 繰延残高がある場合のみ */}
            {assetBalances.length > 0 ? (
              <div className="mb-2">
                <div className="bg-[#F3F4F6] px-2 py-1 mb-1 rounded">
                  <h3 className="text-xs font-semibold text-[#6B7280]">入る予定（資産）</h3>
                </div>
                <div className="space-y-1">
                  {assetBalances.map((asset) => (
                    <div key={asset.name} className="flex items-center justify-between px-2">
                      <span className="text-sm text-[#374151]">{asset.name}</span>
                      <span className="text-sm font-semibold text-[#374151] text-right min-w-[120px] tabular-nums">
                        {formatAmount(asset.amount)}
                      </span>
                    </div>
                  ))}
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
            ) : null}

            {/* 支払う予定（負債）— 繰延残高がある場合のみ */}
            {liabilityBalances.length > 0 ? (
              <div className="mb-2">
                <div className="bg-[#F3F4F6] px-2 py-1 mb-1 rounded">
                  <h3 className="text-xs font-semibold text-[#6B7280]">支払う予定（負債）</h3>
                </div>
                <div className="space-y-1">
                  {liabilityBalances.map((liability) => (
                    <div key={liability.name} className="flex items-center justify-between px-2">
                      <span className="text-sm text-[#374151]">{liability.name}</span>
                      <span className="text-sm font-semibold text-[#374151] text-right min-w-[120px] tabular-nums">
                        {formatAmount(liability.amount)}
                      </span>
                    </div>
                  ))}
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
            ) : null}

            {/* 実質残高（次期繰越金）— 繰延残高がある場合のみ */}
            {showDeferredBalanceSections ? (
              <div className="mt-2 rounded-lg border-2 border-double border-[#E66A84] bg-[#FCE7F3] p-2 pt-2">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-base font-bold text-[#374151]">実質残高（次期繰越金）</span>
                  <span className="text-2xl font-bold text-[#E66A84] text-right min-w-[120px] tabular-nums">
                    {isEmptyPortal ? "0" : formatAmount(carryOverAmount)}
                  </span>
                </div>
                <p className="text-xs text-[#6B7280] mt-0.5 mb-0.5">
                  (現金預金合計 + 資産合計 - 負債合計)
                </p>
                <p className="text-xs italic text-[#6B7280]">
                  ※手元の現金に、入る予定を足し、支払う予定を引いた金額です
                </p>
              </div>
            ) : null}
            </div>
          </div>

          {/* 中央ブロック: 現在の部員数（上）→ メッセージBOX（下） */}
          <div className="flex min-h-0 flex-col gap-3">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 border-l-[5px] border-l-[#9D8CC3] bg-white p-3 shadow-sm">
              <div className="mb-2 shrink-0">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="border-b-2 border-[#9D8CC3] pb-1 text-base font-semibold text-[#9D8CC3]">
                    現在の部員数
                  </h2>
                  {memberLastUpdated && (
                    <span className="text-xs text-[#6B7280]">
                      最終更新: {formatDate(new Date(memberLastUpdated).toISOString())}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col justify-between space-y-1">
                <div>
                  {memberCountsByGrade.map((item) => (
                    <div key={item.grade} className="flex items-center justify-between px-2">
                      <span className="text-sm text-[#374151]">{item.grade}年生</span>
                      <span className="text-sm font-semibold text-[#374151] text-right min-w-[60px] tabular-nums">
                        {item.count}名
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-1 border-t border-gray-200 px-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#374151]">合計</span>
                    <span className="text-base font-bold text-[#374151] text-right min-w-[60px] tabular-nums">
                      {totalMembers}名
                    </span>
                  </div>
                </div>
                {totalMembers === 0 && (
                  <p className="mt-1 px-2 text-xs text-[#9CA3AF]">
                    部員管理 → 部員登録から登録してください
                  </p>
                )}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 border-l-[5px] border-l-[#4A90E2] bg-white p-3 shadow-sm">
              <div className="mb-2 flex shrink-0 items-center justify-between gap-2 border-b-2 border-[#4A90E2] pb-1">
                <h2 className="text-base font-semibold text-[#4A90E2]">メッセージBOX</h2>
                <Link
                  href={clubPath("/messages")}
                  className="shrink-0 text-xs font-medium text-[#4A90E2] transition-colors hover:text-[#3A7BC8] hover:underline"
                >
                  一覧はこちら ➔
                </Link>
              </div>
              <ClubMessageInboxList
                messages={messages}
                variant="compact"
                maxItems={5}
                showUnreadSummary={unreadMessageCount > 0}
                className="min-h-0 flex-1"
              />
            </div>
          </div>

          {/* 右ブロック: 証憑未登録数（上）→ 決算ステータス（下） */}
          <div className="flex min-h-0 flex-col gap-3">
            <ClubDashboardVoucherStats
              transactions={transactions}
              isEmptyPortal={isEmptyPortal}
            />
            <ClubDashboardSettlementSummary />
          </div>
        </div>
      </div>
    </div>
  )
}

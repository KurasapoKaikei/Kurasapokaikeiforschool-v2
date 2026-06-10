"use client"

import { useMemo } from "react"
import Link from "next/link"
import { computeClubReceiptStats } from "@/lib/clubReceiptStats"
import { clubPath } from "@/lib/routes"
import type { Transaction } from "@/utils/localStorage"

type ClubDashboardVoucherStatsProps = {
  transactions: Transaction[]
  isEmptyPortal?: boolean
}

/** クラブダッシュボード：証憑未登録数（右列・下段） */
export function ClubDashboardVoucherStats({
  transactions,
  isEmptyPortal = false,
}: ClubDashboardVoucherStatsProps) {
  const { missingReceiptCount, totalExpenseEntries } = useMemo(
    () => computeClubReceiptStats(transactions),
    [transactions],
  )

  const missing = isEmptyPortal ? 0 : missingReceiptCount
  const total = isEmptyPortal ? 0 : totalExpenseEntries

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 border-l-[5px] border-l-[#EF4444] bg-white p-3 shadow-sm">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <h2 className="border-b-2 border-[#EF4444] pb-1 text-base font-semibold text-[#EF4444]">
          証憑未登録数
        </h2>
        <Link
          href={clubPath("/accounting/ledger/cash-bank")}
          className="shrink-0 text-xs font-medium text-[#EF4444] transition-colors hover:underline"
        >
          出納帳へ ➔
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <p className="mb-1 text-xs text-[#6B7280]">支出仕訳のうち証憑未登録</p>
        <p className="text-3xl font-bold tabular-nums text-[#374151]">
          <span className={missing > 0 ? "text-[#EF4444]" : ""}>{missing}</span>
          <span className="mx-1 text-2xl font-normal text-[#9CA3AF]">/</span>
          <span>{total}</span>
        </p>
        {missing > 0 ? (
          <p className="mt-2 text-xs font-medium text-[#EF4444]">
            未登録の支出は出納帳・科目別台帳で赤く表示されます
          </p>
        ) : total === 0 ? (
          <p className="mt-2 text-xs text-[#9CA3AF]">
            データ未投入時は 0 / 0 と表示されます
          </p>
        ) : null}
      </div>
    </div>
  )
}

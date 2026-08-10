"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { EditTransactionModal } from "@/components/accounting/EditTransactionModal"
import { getTransactions, type Transaction } from "@/utils/localStorage"
import {
  getEditUrl,
  resolveRegisterEditBackHref,
  REGISTER_EDIT_RETURN_QUERY,
} from "@/utils/transactionEditPath"
import { getClubLoginRole, getCurrentClub } from "@/lib/clubLoginSession"
import {
  getSettlementPeriodLockErrorMessage,
  isFullSettlementLock,
  isTransactionDateLocked,
} from "@/lib/clubSettlementPortalSync"

export default function RegisterEditTransactionPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnToParam = searchParams.get(REGISTER_EDIT_RETURN_QUERY)
  const backHref = useMemo(
    () => resolveRegisterEditBackHref(returnToParam),
    [returnToParam]
  )

  const id = typeof params.id === "string" ? params.id : ""
  const [tx, setTx] = useState<Transaction | null>(null)
  const [ready, setReady] = useState(false)
  const [periodLocked, setPeriodLocked] = useState(false)
  const [lockMessage, setLockMessage] = useState("")

  useEffect(() => {
    if (!id) {
      setTx(null)
      setReady(true)
      return
    }
    const found = getTransactions().find((t) => t.id === id) ?? null
    if (found) {
      const target = getEditUrl(found, returnToParam)
      const targetBase = target.split("?")[0] ?? target
      if (targetBase !== `/club/accounting/register/edit/${found.id}`) {
        router.replace(target)
        return
      }
      const clubId = getCurrentClub()?.id
      const blocked =
        getClubLoginRole() === "manager" ||
        (clubId != null &&
          (isFullSettlementLock(clubId) ||
            isTransactionDateLocked(clubId, found.date)))
      setPeriodLocked(blocked)
      setLockMessage(
        clubId && blocked ? getSettlementPeriodLockErrorMessage(clubId) : ""
      )
    }
    setTx(found)
    setReady(true)
  }, [id, router, returnToParam])

  if (!ready) {
    return <div className="min-h-screen bg-[#F5F5F0] px-6 py-8 text-[#6B7280]">読み込み中…</div>
  }

  if (!id || !tx) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] px-6 py-8">
        <p className="text-[#6B7280]">取引が見つかりません。</p>
        <Link
          href={backHref}
          className="text-[#A3BC68] font-semibold mt-2 inline-block hover:underline"
        >
          戻る
        </Link>
      </div>
    )
  }

  if (periodLocked) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] px-6 py-8 space-y-3">
        <p className="text-red-600 text-sm">
          {lockMessage || "ロック期間内のため編集できません。"}
        </p>
        <Link
          href={backHref}
          className="text-[#A3BC68] font-semibold inline-block hover:underline"
        >
          戻る
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="px-6 pt-6">
        <Link
          href={backHref}
          className="text-sm text-[#A3BC68] font-semibold hover:underline"
        >
          ← 戻る
        </Link>
      </div>
      <EditTransactionModal
        transaction={tx}
        isOpen={true}
        onClose={() => router.push(backHref)}
        onSuccess={() => router.push(backHref)}
      />
    </div>
  )
}

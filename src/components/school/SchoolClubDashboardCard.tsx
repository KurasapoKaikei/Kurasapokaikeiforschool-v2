"use client"



import type { ReactNode } from "react"

import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

import { useAuditorSettlementState } from "@/components/audit/useAuditorSettlementState"

import { SettlementAuditStatusBadge } from "@/components/school/SettlementAuditStatusBadge"

import {

  AUDITOR_APPROVED_CARD_CLASSES,

  type AuditorAuditBadgeVariant,

} from "@/lib/clubSettlementPortalSync"

import { useClubMemberCount } from "@/hooks/useClubMemberCount"

import { clearCurrentClub } from "@/lib/clubLoginSession"

import type { SchoolClub } from "@/lib/schoolClubs"

import { setImpersonatedClub } from "@/lib/schoolClubSession"

import {

  CLUB_BRAND_PINK,

  CLUB_PORTAL_DASHBOARD,

  schoolClubMessagesPath,

} from "@/lib/schoolTheme"

import { cn } from "@/lib/utils"



type SchoolClubDashboardCardProps = {

  club: SchoolClub

}



function DataRow({

  label,

  children,

}: {

  label: string

  children: ReactNode

}) {

  return (

    <div className="flex items-center justify-between gap-3 border-b border-gray-100 py-2.5 last:border-0">

      <span className="shrink-0 text-sm text-[#6B7280]">{label}</span>

      <span className="min-w-0 text-right text-sm">{children}</span>

    </div>

  )

}



export function SchoolClubDashboardCard({ club }: SchoolClubDashboardCardProps) {

  const router = useRouter()

  const { auditLabel, auditBadgeVariant, isApproved } = useAuditorSettlementState(

    club?.id ?? "",

  )

  const memberCount = useClubMemberCount(club?.id ?? "")

  const clubName = club?.name?.trim() || "（名称未設定）"

  const clubId = club?.id ?? "—"



  const handleNavigateToClub = () => {

    if (!club?.id) return

    clearCurrentClub()

    setImpersonatedClub({ id: club.id, name: clubName, viewer: "school" })

    router.push(CLUB_PORTAL_DASHBOARD)

  }



  const handleNavigateToMessages = () => {

    if (!club?.id) return

    router.push(schoolClubMessagesPath(club.id))

  }



  return (

    <article

      className={cn(

        "flex h-full flex-col rounded-xl border border-gray-200 p-5 shadow-md",

        isApproved ? AUDITOR_APPROVED_CARD_CLASSES : "bg-white",

        !isApproved &&

          "transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-xl",

      )}

    >

      <header className="mb-4 border-b border-orange-100 pb-4">

        <h3 className="text-lg font-bold leading-snug text-[#374151]">

          {clubName}

        </h3>

        <p className="mt-1 font-mono text-xs text-[#9CA3AF]">{clubId}</p>

      </header>



      <div

        className="mb-4 rounded-lg border border-gray-200 bg-[#FAFAF8] px-4 py-3.5"

        aria-label={`監査ステータス: ${auditLabel}`}

      >

        <div className="flex items-center justify-between gap-3">

          <span className="text-sm font-semibold text-[#374151]">

            監査ステータス

          </span>

          <SettlementAuditStatusBadge

            label={auditLabel}

            variant={auditBadgeVariant as AuditorAuditBadgeVariant}

          />

        </div>

      </div>



      <div className="flex-1">

        <DataRow label="部員数">

          <span className="font-semibold tabular-nums text-[#374151]">

            {memberCount}名

          </span>

        </DataRow>

      </div>



      <div className="mt-5 border-t border-gray-100 pt-4">

        <div className="flex gap-2">

          <Button

            type="button"

            className="h-11 min-w-0 flex-1 rounded-lg border-0 text-sm font-semibold text-white shadow-none hover:opacity-90"

            style={{ backgroundColor: CLUB_BRAND_PINK }}

            onClick={handleNavigateToClub}

          >

            クラブページへ

          </Button>

          <Button

            type="button"

            className="h-11 min-w-0 flex-1 rounded-lg border-0 bg-sky-500 text-sm font-semibold text-white shadow-none hover:bg-sky-600"

            onClick={handleNavigateToMessages}

          >

            メッセージBOX

          </Button>

        </div>

      </div>

    </article>

  )

}



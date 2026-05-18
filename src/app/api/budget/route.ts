import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { getOrCreateBudgetForCalendarYear } from "@/lib/budgetDb"
import { assertFiscalYearEditableForBudgetAndTransactions } from "@/lib/fiscalYearLock"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fy = searchParams.get("fiscalYear")
  if (fy === null) {
    return NextResponse.json({ error: "fiscalYear が必要です" }, { status: 400 })
  }
  const fiscalYear = parseInt(fy, 10)
  if (!Number.isFinite(fiscalYear)) {
    return NextResponse.json({ error: "fiscalYear が不正です" }, { status: 400 })
  }
  try {
    const ctx = await getOrCreateBudgetForCalendarYear(fiscalYear)
    if (!ctx) {
      return NextResponse.json({ items: [] })
    }
    const rows = await prisma.budgetLine.findMany({
      where: { budgetId: ctx.budget.id },
      orderBy: [{ categoryId: "asc" }, { accountTitleId: "asc" }],
    })
    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        fiscalYear,
        categoryId: r.categoryId,
        accountTitleId: r.accountTitleId,
        amount: Number(r.amount),
        updatedAt: r.updatedAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error("[GET /api/budget]", e)
    return NextResponse.json({ error: "予算データの取得に失敗しました" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      fiscalYear?: number
      categoryId?: string
      accountTitleId?: string
      amount?: number
    }
    const { fiscalYear, categoryId, accountTitleId, amount } = body
    if (
      typeof fiscalYear !== "number" ||
      typeof categoryId !== "string" ||
      typeof accountTitleId !== "string" ||
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 })
    }

    const ctx = await getOrCreateBudgetForCalendarYear(fiscalYear)
    if (!ctx) {
      return NextResponse.json(
        { error: "会計年度がデータベースに未登録です。先に会計年度を作成してください。" },
        { status: 404 }
      )
    }
    try {
      assertFiscalYearEditableForBudgetAndTransactions(ctx.fiscalYear.status)
    } catch {
      return NextResponse.json(
        { error: "この年度は提出済みまたは承認済みのため、予算を変更できません。" },
        { status: 403 }
      )
    }

    const truncated = Math.trunc(amount)
    const row = await prisma.budgetLine.upsert({
      where: {
        budgetId_categoryId_accountTitleId: {
          budgetId: ctx.budget.id,
          categoryId,
          accountTitleId,
        },
      },
      create: {
        budgetId: ctx.budget.id,
        categoryId,
        accountTitleId,
        amount: new Prisma.Decimal(truncated),
      },
      update: {
        amount: new Prisma.Decimal(truncated),
      },
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: row.id,
        fiscalYear,
        categoryId: row.categoryId,
        accountTitleId: row.accountTitleId,
        amount: Number(row.amount),
        updatedAt: row.updatedAt.toISOString(),
      },
    })
  } catch (e) {
    console.error("[POST /api/budget]", e)
    return NextResponse.json({ error: "予算の保存に失敗しました" }, { status: 500 })
  }
}

import type { Budget, FiscalYear } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/** 暫定: 単一テナント想定で、暦年度 `year` に一致する会計年度と予算ヘッダを返す（なければ Budget のみ生成） */
export async function getOrCreateBudgetForCalendarYear(
  year: number
): Promise<{ fiscalYear: FiscalYear; budget: Budget } | null> {
  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { year },
    orderBy: { id: "asc" },
  })
  if (!fiscalYear) return null

  let budget = await prisma.budget.findUnique({
    where: { fiscalYearId: fiscalYear.id },
  })
  if (!budget) {
    budget = await prisma.budget.create({
      data: {
        organizationId: fiscalYear.organizationId,
        fiscalYearId: fiscalYear.id,
      },
    })
  }
  return { fiscalYear, budget }
}

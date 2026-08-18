import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * 深いヘルスチェック（外形監視・CloudWatch アラート用）。
 *
 * DB への実接続を確認し、失敗時は 503 を返す。
 * ALB のヘルスチェックには **使わない**（理由は `/api/health` のコメント参照）。
 */

export const dynamic = "force-dynamic"
export const revalidate = 0

/** DB 疎通確認のタイムアウト（ミリ秒）。監視側のタイムアウトより短く保つ */
const DB_TIMEOUT_MS = 3000

async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const startedAt = Date.now()
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`timeout after ${DB_TIMEOUT_MS}ms`)), DB_TIMEOUT_MS)
      ),
    ])
    return { ok: true, latencyMs: Date.now() - startedAt }
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      // 接続文字列が漏れないよう、メッセージのみを返す
      error: e instanceof Error ? e.message : "unknown error",
    }
  }
}

export async function GET() {
  const database = await checkDatabase()
  const healthy = database.ok

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      service: "kurasapo-kaikei",
      revision: process.env.APP_REVISION ?? "unknown",
      uptimeSec: Math.round(process.uptime()),
      time: new Date().toISOString(),
      checks: { database },
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  )
}

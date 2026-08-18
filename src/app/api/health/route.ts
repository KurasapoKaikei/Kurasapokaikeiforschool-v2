import { NextResponse } from "next/server"

/**
 * 浅いヘルスチェック（ALB ターゲットグループ用）。
 *
 * DB 疎通は **意図的に見ない**。ALB のヘルスチェックで DB 疎通を判定すると、
 * DB が一時的に落ちた際に全タスクが unhealthy と判定されて ECS が
 * タスクを落とし続け、DB 復旧後も再起動ループから抜けられなくなる。
 * DB を含む深いチェックは `/api/health/deep`（監視・アラート用）で行う。
 */

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "kurasapo-kaikei",
      revision: process.env.APP_REVISION ?? "unknown",
      uptimeSec: Math.round(process.uptime()),
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}

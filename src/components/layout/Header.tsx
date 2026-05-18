"use client"

import { usePathname } from "next/navigation"
import { useUserInfo } from "@/contexts/UserInfoContext"
import { cn } from "@/lib/utils"

interface HeaderProps {
  title?: string
}

// パスとページタイトルのマッピング
const pageTitleMap: Record<string, string> = {
  "/dashboard": "マイページ",
  "/accounting/register": "入出金登録",
  "/accounting/input": "入出金登録",
  "/accounting/register/new": "入出金登録",
  "/accounting/register/history": "入出金登録",
  "/accounting/ledger": "集計・帳簿",
  "/accounting/summary/annual": "集計・帳簿",
  "/accounting/summary/monthly": "集計・帳簿",
  "/accounting/ledger/cash-bank": "集計・帳簿",
  "/accounting/ledger/subject": "集計・帳簿",
  "/accounting/report": "集計・帳簿",
  "/collection": "集金管理",
  "/collection/history": "集金管理",
  "/collection/schedule": "集金管理",
  "/collection/settings": "集金管理",
  "/budget": "予実管理",
  "/budget/book": "予算書",
  "/budget/comparison": "前年度比",
  "/budget/year-over-year": "前年度比",
  "/members": "部員管理",
  "/members/list": "部員管理",
  "/members/register": "部員管理",
  "/settings": "設定・マスター管理",
  "/settings/club": "設定・マスター管理",
  "/settings/staff": "設定・マスター管理",
  "/settings/category": "設定・マスター管理",
  "/settings/account-titles": "設定・マスター管理",
  "/settings/fiscal-years": "設定・マスター管理",
  "/guide": "操作ガイド",
  "/school": "学校管理",
  "/school/clubs": "学校管理",
  "/parent": "保護者マイページ",
}

// パスとテーマカラーのマッピング（仕様書準拠）
const pageColorMap: Record<string, string> = {
  "/dashboard": "#E66A84", // マイページ（ピンク）
  "/accounting/register": "#A3BC68", // 入出金登録（黄緑）
  "/accounting/input": "#A3BC68",
  "/accounting/register/new": "#A3BC68", // 入出金登録（黄緑）
  "/accounting/register/history": "#A3BC68", // 入出金登録（黄緑）
  "/accounting/ledger": "#68A384", // 集計・帳簿（青緑）
  "/accounting/summary/annual": "#68A384", // 集計・帳簿（青緑）
  "/accounting/summary/monthly": "#68A384", // 集計・帳簿（青緑）
  "/accounting/ledger/cash-bank": "#68A384", // 集計・帳簿（青緑）
  "/accounting/ledger/subject": "#68A384", // 集計・帳簿（青緑）
  "/accounting/report": "#68A384", // 集計・帳簿（青緑）
  "/collection": "#D99529", // 集金管理（オレンジ）
  "/collection/history": "#D99529", // 集金管理（オレンジ）
  "/collection/schedule": "#D99529", // 集金管理（オレンジ）
  "/collection/settings": "#D99529", // 集金管理（オレンジ）
  "/budget": "#1A237E", // 予実管理（ディープインディゴ）
  "/budget/book": "#1A237E", // 予実管理（ディープインディゴ）
  "/budget/comparison": "#1A237E", // 予実管理（ディープインディゴ）
  "/budget/year-over-year": "#1A237E", // 予実管理（ディープインディゴ）
  "/members": "#9D8CC3", // 部員管理（パープル）
  "/members/list": "#9D8CC3", // 部員管理（パープル）
  "/members/register": "#9D8CC3", // 部員管理（パープル）
  "/settings": "#77B8DA", // 設定（ブルー）
  "/settings/club": "#77B8DA", // 設定（ブルー）
  "/settings/staff": "#77B8DA", // 設定（ブルー）
  "/settings/category": "#77B8DA", // 設定（ブルー）
  "/settings/account-titles": "#77B8DA", // 設定（ブルー）
  "/settings/fiscal-years": "#77B8DA", // 設定（ブルー）
  "/guide": "#4A90E2", // 操作ガイド（少し濃いブルー）
  "/school": "#1A237E", // 学校管理（for school ・インディゴ）
  "/school/clubs": "#1A237E",
  "/parent": "#7C6BA8", // 保護者（落ち着いたパープル系）
}

export function Header({ title }: HeaderProps) {
  const pathname = usePathname()
  const { userInfo } = useUserInfo()
  
  // タイトルが明示的に渡されていない場合は、パスから自動判定
  const displayTitle =
    title ||
    (pathname.startsWith("/budget")
      ? "予実管理"
      : pathname.startsWith("/accounting/register/csv") ||
          pathname.startsWith("/accounting/register/edit")
        ? "入出金登録"
        : pathname.startsWith("/school")
        ? "学校管理"
        : pathname.startsWith("/parent")
          ? "保護者マイページ"
          : pageTitleMap[pathname] || "マイページ")

  const themeColor = pathname.startsWith("/budget")
    ? "#1A237E"
    : pathname.startsWith("/accounting/register/csv") ||
        pathname.startsWith("/accounting/register/edit")
      ? "#A3BC68"
      : pathname.startsWith("/school")
      ? "#1A237E"
      : pageColorMap[pathname] || "#E66A84"
  
  // クラブ名と会計期間（動的に変更可能）
  const organizationName = userInfo.organizationName
  const fiscalPeriod = userInfo.fiscalPeriod

  return (
    <header className="sticky top-0 z-50">
      {/* クラブ名と会計期間（ベージュ背景） */}
      <div className="bg-[#F5F5F0] px-6 py-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold text-[#374151]">{organizationName}</h1>
          <span className="text-sm text-[#6B7280]">{fiscalPeriod}</span>
        </div>
      </div>
      
      {/* カラー見出しライン（スリム化、テーマカラー適用）。予実は bg-budget（#1A237E）で Tailwind からも確実に出力 */}
      <div
        className={cn(
          "text-white",
          pathname.startsWith("/budget") || pathname.startsWith("/school") ? "bg-budget" : undefined
        )}
        style={
          pathname.startsWith("/budget") || pathname.startsWith("/school")
            ? undefined
            : { backgroundColor: themeColor }
        }
      >
        <div className="flex h-12 items-center px-6">
          <h2 className="text-lg font-semibold">{displayTitle}</h2>
        </div>
      </div>
    </header>
  )
}

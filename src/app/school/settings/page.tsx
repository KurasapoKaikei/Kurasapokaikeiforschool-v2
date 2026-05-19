import { redirect } from "next/navigation"
import { SCHOOL_ROUTES } from "@/lib/schoolTheme"

/** 設定トップ → 共通カテゴリー設定へ */
export default function SchoolSettingsIndexPage() {
  redirect(SCHOOL_ROUTES.settingsCategory)
}

/**
 * クラブポータルのアクセス種別（クラブ本人ログイン vs 学校管理者・監査人閲覧）
 */

import { getClubLoginRole, getCurrentClub } from "@/lib/clubLoginSession"
import {
  getImpersonatedClub,
  getImpersonationViewer,
} from "@/lib/schoolClubSession"
import { AUDIT_ROUTES } from "@/lib/auditorTheme"
import { SCHOOL_ROUTES } from "@/lib/schoolTheme"

/** 部活アカウントによる通常ログイン（localStorage: kurasaokaikei-current-club） */
export function hasAuthenticatedClubLogin(): boolean {
  return getCurrentClub() != null
}

/** 学校管理者・監査人が「クラブページへ」から閲覧中（なりすまし） */
export function isSchoolImpersonatingClub(): boolean {
  if (hasAuthenticatedClubLogin()) return false
  return getImpersonatedClub() != null
}

/** 監査人がクラブポータルを閲覧中 */
export function isAuditorImpersonatingClub(): boolean {
  return isSchoolImpersonatingClub() && getImpersonationViewer() === "auditor"
}

/** なりすまし閲覧時の「ダッシュボードへ戻る」リンク先 */
export function resolveClubPortalDashboardBackHref(): string {
  return getImpersonationViewer() === "auditor"
    ? AUDIT_ROUTES.home
    : SCHOOL_ROUTES.clubList
}

/** クラブポータルへログイン済みか（作業者・責任者いずれか） */
export function canOperateClubPortal(): boolean {
  return hasAuthenticatedClubLogin()
}

/** 入出金等の書き込みが可能か（作業者のみ。責任者は閲覧＋部内承認） */
export function canEditClubPortalData(): boolean {
  return hasAuthenticatedClubLogin() && getClubLoginRole() === "worker"
}

/**
 * 部内承認（責任者承認）を実行できるか。
 * 責任者ログイン、または学校／監査人のなりすまし閲覧時。
 */
export function canActAsClubManager(): boolean {
  if (getClubLoginRole() === "manager") return true
  return isSchoolImpersonatingClub()
}

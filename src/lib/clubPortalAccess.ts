/**
 * クラブポータルのアクセス種別（クラブ本人ログイン vs 学校管理者・監査人閲覧）
 */

import { getCurrentClub } from "@/lib/clubLoginSession"
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

/** クラブポータルで操作可能か（通常ログイン時のみフルアクセス） */
export function canOperateClubPortal(): boolean {
  return hasAuthenticatedClubLogin()
}

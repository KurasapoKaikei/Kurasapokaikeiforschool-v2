/**
 * クラブポータルのアクセス種別（クラブ本人ログイン vs 学校管理者閲覧）
 */

import { getCurrentClub } from "@/lib/clubLoginSession"
import { getImpersonatedClub } from "@/lib/schoolClubSession"

/** 部活アカウントによる通常ログイン（localStorage: kurasaokaikei-current-club） */
export function hasAuthenticatedClubLogin(): boolean {
  return getCurrentClub() != null
}

/** 学校管理者が「クラブページへ」から閲覧中（なりすまし） */
export function isSchoolImpersonatingClub(): boolean {
  if (hasAuthenticatedClubLogin()) return false
  return getImpersonatedClub() != null
}

/** クラブポータルで操作可能か（通常ログイン時のみフルアクセス） */
export function canOperateClubPortal(): boolean {
  return hasAuthenticatedClubLogin()
}

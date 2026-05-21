/** 現在操作中のクラブ（なりすまし > クラブログイン） */

import { getCurrentClub, type CurrentClubSession } from "@/lib/clubLoginSession"
import { getImpersonatedClub } from "@/lib/schoolClubSession"

export type ActiveClubSession = CurrentClubSession

export function resolveActiveClubSession(): ActiveClubSession | null {
  const impersonated = getImpersonatedClub()
  if (impersonated) {
    return {
      id: impersonated.id,
      name: impersonated.name,
      groupNames: [],
    }
  }
  return getCurrentClub()
}

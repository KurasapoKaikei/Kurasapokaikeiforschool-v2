/** クラブポータルからのログアウト */

import { clearLastActiveClubSession } from "@/lib/activeClubSession"
import { clearCurrentClub, getCurrentClub } from "@/lib/clubLoginSession"
import { clearCurrentWorkers } from "@/lib/currentWorkersSession"
import { clearImpersonatedClub } from "@/lib/schoolClubSession"

export function logoutClubSession(): void {
  const club = getCurrentClub()
  if (club?.id) clearCurrentWorkers(club.id)
  clearCurrentClub()
  clearImpersonatedClub()
  clearLastActiveClubSession()
}

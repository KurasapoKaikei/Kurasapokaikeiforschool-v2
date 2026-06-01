/** クラブポータルからのログアウト */

import { clearLastActiveClubSession } from "@/lib/activeClubSession"
import { clearCurrentClub } from "@/lib/clubLoginSession"
import { clearImpersonatedClub } from "@/lib/schoolClubSession"

export function logoutClubSession(): void {
  clearCurrentClub()
  clearImpersonatedClub()
  clearLastActiveClubSession()
}

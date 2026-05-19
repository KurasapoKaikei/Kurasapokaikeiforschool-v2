import { redirect } from "next/navigation"
import { clubPath } from "@/lib/routes"

/** クラブ入り口（LP から遷移）→ クラブポータルへ */
export default function ClubIndexPage() {
  redirect(clubPath("/dashboard"))
}

import { SchoolContentPanel } from "@/components/layout/school/SchoolContentPanel"
import { SCHOOL_DISPLAY_NAME } from "@/lib/schoolTheme"

/** クラブ一覧（クラブ管理 > クラブ一覧） */
export default function SchoolClubListPage() {
  return (
    <SchoolContentPanel title={`🏢 ${SCHOOL_DISPLAY_NAME} - 登録クラブ一覧`}>
      <p>（ここに登録されたクラブの一覧表が入ります）</p>
    </SchoolContentPanel>
  )
}

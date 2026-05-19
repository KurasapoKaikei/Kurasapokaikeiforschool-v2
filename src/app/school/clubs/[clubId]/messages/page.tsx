import { SchoolClubMessageView } from "@/components/school/SchoolClubMessageView"

type PageProps = {
  params: { clubId: string }
}

/** クラブ個別メッセージBOX（学校管理者用） */
export default function SchoolClubMessagesPage({ params }: PageProps) {
  return <SchoolClubMessageView clubId={params.clubId} />
}

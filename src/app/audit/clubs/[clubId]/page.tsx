import { AuditorClubReviewView } from "@/components/audit/AuditorClubReviewView"

type PageProps = {
  params: { clubId: string }
}

export default function AuditorClubReviewPage({ params }: PageProps) {
  return <AuditorClubReviewView clubId={decodeURIComponent(params.clubId)} />
}

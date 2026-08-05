export default function ApprovalsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-xl font-semibold mb-4">取引の個別承認</h2>
      <p className="text-sm text-[#6B7280] max-w-2xl leading-relaxed">
        クラサポ会計 for school では、日々の入出金・集金・振替などの取引登録に学校側／部内の個別承認フローは使いません。
        登録したデータは即時に出納帳・集計へ反映されます。承認・差戻しは
        <strong className="font-semibold text-[#374151]"> 半期決算（中間）および年度末決算の提出時 </strong>
        のみ、クラブの決算提出 → 監査人／学校管理者の査読として実施します。
      </p>
    </div>
  )
}

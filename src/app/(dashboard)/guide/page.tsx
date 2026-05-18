export default function GuidePage() {
  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2 text-[#374151]">操作ガイド</h2>
        <p className="text-sm text-[#6B7280]">システムの使い方を説明します</p>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-lg font-semibold mb-3 text-[#374151]">基本的な使い方</h3>
          <ul className="space-y-2 text-sm text-[#374151]">
            <li>• 入出金登録では、レシート画像をアップロードして取引を登録できます</li>
            <li>• 集計・帳簿では、すべての取引を確認できます</li>
            <li>• 証憑がない支出取引は赤字で表示されます</li>
          </ul>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-lg font-semibold mb-3 text-[#374151]">各機能の説明</h3>
          <div className="space-y-4 text-sm text-[#374151]">
            <div>
              <h4 className="font-semibold mb-1">マイページ</h4>
              <p className="text-[#6B7280]">会計年度情報、残高、アラートを確認できます</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">入出金登録</h4>
              <p className="text-[#6B7280]">レシート画像をアップロードして取引を登録します</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">集計・帳簿</h4>
              <p className="text-[#6B7280]">すべての取引を一覧で確認できます</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">集金管理</h4>
              <p className="text-[#6B7280]">部員ごとの集金状況を管理します</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">部員管理</h4>
              <p className="text-[#6B7280]">部員情報の登録・編集・削除ができます</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">設定</h4>
              <p className="text-[#6B7280]">勘定科目や会計年度などのマスター管理ができます</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

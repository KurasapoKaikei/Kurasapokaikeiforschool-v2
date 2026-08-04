import { mockCollectionItems } from "@/constants/mockData"
import { formatAmountDisplay } from "@/utils/formatAmountDisplay"

export default function CollectionPage() {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}/${month}/${day}`
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "PENDING":
        return "未収"
      case "COLLECTED":
        return "収納済み"
      case "OVERDUE":
        return "滞納"
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "text-yellow-600"
      case "COLLECTED":
        return "text-green-600"
      case "OVERDUE":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2 text-[#374151]">集金一覧</h2>
        <p className="text-sm text-[#6B7280]">部員ごとの集金状況管理</p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#374151]">部員名</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-[#374151]">金額</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#374151]">納付期限</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-[#374151]">状態</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#374151]">収納日</th>
            </tr>
          </thead>
          <tbody>
            {mockCollectionItems.map((item) => (
              <tr key={item.id} className="border-t border-gray-200">
                <td className="px-4 py-3 text-sm text-[#374151]">{item.memberName}</td>
                <td className="px-4 py-3 text-sm text-right text-[#374151]">
                  {formatAmountDisplay(item.amount)}
                </td>
                <td className="px-4 py-3 text-sm text-[#374151]">{formatDate(item.dueDate)}</td>
                <td className={`px-4 py-3 text-sm text-center ${getStatusColor(item.status)}`}>
                  {getStatusLabel(item.status)}
                </td>
                <td className="px-4 py-3 text-sm text-[#374151]">
                  {item.collectedAt ? formatDate(item.collectedAt) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

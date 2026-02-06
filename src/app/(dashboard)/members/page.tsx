import { mockMembers } from "@/constants/mockData"

export default function MembersPage() {
  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2 text-[#374151]">部員一覧</h2>
        <p className="text-sm text-[#6B7280]">部員情報の登録・編集・削除</p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#374151]">氏名</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#374151]">学籍番号</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#374151]">メールアドレス</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#374151]">電話番号</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-[#374151]">状態</th>
            </tr>
          </thead>
          <tbody>
            {mockMembers.map((member) => (
              <tr key={member.id} className="border-t border-gray-200">
                <td className="px-4 py-3 text-sm text-[#374151]">{member.name}</td>
                <td className="px-4 py-3 text-sm text-[#374151]">{member.studentId}</td>
                <td className="px-4 py-3 text-sm text-[#374151]">{member.email}</td>
                <td className="px-4 py-3 text-sm text-[#374151]">{member.phone}</td>
                <td className="px-4 py-3 text-sm text-center">
                  {member.isActive ? (
                    <span className="text-green-600">在籍</span>
                  ) : (
                    <span className="text-gray-400">退部</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

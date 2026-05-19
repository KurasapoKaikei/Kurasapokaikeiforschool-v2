"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ClubPasswordChangeSection } from "@/components/club/ClubPasswordChangeSection"
import { useUserInfo } from "@/contexts/UserInfoContext"

export default function ClubSettingsPage() {
  const { userInfo, updateOrganizationName } = useUserInfo()
  
  const [formData, setFormData] = useState({
    // セクション1：ご契約情報（表示専用）
    contractStartDate: "2024-04-01",
    plan: "スタンダードプラン",
    registeredMembers: 45,
    
    // セクション2：団体情報（編集可能）
    organizationName: userInfo.organizationName,
    representativeLastName: "山田",
    representativeFirstName: "太郎",
    phone: "03-1234-5678",
    postalCode: "100-0001",
    prefecture: "東京都",
    city: "千代田区",
    address: "千代田1-1-1",
    
    // セクション3：ログイン情報
    loginId: "rugby_club_001",
    email: "rugby@example.com",
  })

  // userInfoが変更されたらformDataを更新
  useEffect(() => {
    setFormData((prev) => ({ ...prev, organizationName: userInfo.organizationName }))
  }, [userInfo.organizationName])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: フォーム送信処理（API呼び出し）
    console.log("Save:", formData)
    
    // 団体名をHeaderに即座に同期
    updateOrganizationName(formData.organizationName)
    
    alert("変更を保存しました")
  }

  return (
    <div className="px-6 py-8 bg-[#F5F5F0] min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-[#374151]">クラブ設定</h2>
          <p className="text-sm text-[#6B7280]">クラブ情報の登録・編集</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* セクション1：ご契約情報（表示専用） */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-semibold mb-4 text-[#374151] border-b border-gray-200 pb-2">
              ご契約情報
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-[#6B7280]">ご利用開始日</span>
                <span className="text-sm font-medium text-[#374151]">{formData.contractStartDate}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <span className="text-sm text-[#6B7280]">利用プラン</span>
                <span className="text-sm font-medium text-[#374151]">{formData.plan}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <span className="text-sm text-[#6B7280]">登録部員数</span>
                <span className="text-sm font-medium text-[#374151]">{formData.registeredMembers}名</span>
              </div>
            </div>
          </div>

          {/* セクション2：団体情報（編集可能） */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-semibold mb-4 text-[#374151] border-b border-gray-200 pb-2">
              団体情報
            </h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="organizationName" className="block text-sm font-medium text-[#374151] mb-2">
                  学校名・団体名 <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  id="organizationName"
                  value={formData.organizationName}
                  onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#77B8DA] focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="representativeLastName" className="block text-sm font-medium text-[#374151] mb-2">
                    代表者様氏名（姓） <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="text"
                    id="representativeLastName"
                    value={formData.representativeLastName}
                    onChange={(e) => setFormData({ ...formData, representativeLastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#77B8DA] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="representativeFirstName" className="block text-sm font-medium text-[#374151] mb-2">
                    代表者様氏名（名） <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="text"
                    id="representativeFirstName"
                    value={formData.representativeFirstName}
                    onChange={(e) => setFormData({ ...formData, representativeFirstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#77B8DA] focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-[#374151] mb-2">
                  お電話番号 <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#77B8DA] focus:border-transparent"
                  placeholder="03-1234-5678"
                  required
                />
              </div>

              <div>
                <label htmlFor="postalCode" className="block text-sm font-medium text-[#374151] mb-2">
                  郵便番号 <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  id="postalCode"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#77B8DA] focus:border-transparent"
                  placeholder="100-0001"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="prefecture" className="block text-sm font-medium text-[#374151] mb-2">
                    都道府県 <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="text"
                    id="prefecture"
                    value={formData.prefecture}
                    onChange={(e) => setFormData({ ...formData, prefecture: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#77B8DA] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-[#374151] mb-2">
                    市区町村 <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="text"
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#77B8DA] focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-[#374151] mb-2">
                  以降のご住所 <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#77B8DA] focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          <ClubPasswordChangeSection />

          {/* セクション3：ログイン情報 */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-semibold mb-4 text-[#374151] border-b border-gray-200 pb-2">
              ログイン情報
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">
                  ログインID
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-[#6B7280]">
                  {formData.loginId}
                </div>
                <p className="text-xs text-[#6B7280] mt-1">ログインIDは変更できません</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">
                  メールアドレス
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-[#6B7280]">
                    {formData.email}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-sm"
                  >
                    変更
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">
                  パスワード
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-[#6B7280]">
                    ••••••••
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-sm"
                  >
                    変更
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* 保存ボタン */}
          <div className="flex justify-end">
            <Button
              type="submit"
              className="bg-[#77B8DA] hover:bg-[#77B8DA]/90 text-white px-8"
            >
              変更を保存する
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

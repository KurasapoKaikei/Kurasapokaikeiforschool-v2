"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { CheckCircle2, Users } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useUserInfo } from "@/contexts/UserInfoContext"
import {
  getCategories,
  getAccountTitles,
  getMembers,
  getCollectionSchedules,
  getCollectionRecords,
  addCollectionScheduleForMembers,
  updateCollectionSchedule,
  type Category,
  type AccountTitle,
  type Member,
  type CollectionSchedule,
} from "@/utils/localStorage"
import { SettlementLockAlert } from "@/components/club/SettlementLockAlert"

const THEME_COLOR = "#D99529"
const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const
const GRADES = [4, 3, 2, 1] as const
const GRADE_LABELS: Record<number, string> = { 1: "1年生", 2: "2年生", 3: "3年生", 4: "4年生" }

function parseFiscalStartYear(period: string): number {
  const m = period.match(/(\d{4})/)
  return m ? Number(m[1]) : new Date().getFullYear()
}

function monthToYYYYMM(startYear: number, month: number): string {
  const y = month >= 4 ? startYear : startYear + 1
  return `${y}-${String(month).padStart(2, "0")}`
}

export default function CollectionSettingsPage() {
  const { userInfo } = useUserInfo()
  const searchParams = useSearchParams()
  const router = useRouter()
  const fiscalStartYear = parseFiscalStartYear(userInfo.fiscalPeriod)

  // マスタデータ
  const [categories, setCategories] = useState<Category[]>([])
  const [accountTitles, setAccountTitles] = useState<AccountTitle[]>([])
  const [allMembers, setAllMembers] = useState<Member[]>([])


  // 編集モード
  const [editScheduleId, setEditScheduleId] = useState<string | null>(null)

  // フォーム
  const [name, setName] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [accountTitleId, setAccountTitleId] = useState("")
  const [counterpartyId, setCounterpartyId] = useState("")
  const [amount, setAmount] = useState("")
  const [memo, setMemo] = useState("")
  const [selectedMonths, setSelectedMonths] = useState<number[]>([])
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])

  // UI状態
  const [success, setSuccess] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [memberModalOpen, setMemberModalOpen] = useState(false)
  const [memberGradeTab, setMemberGradeTab] = useState<number | "all">("all")
  const [memberIdsSnapshot, setMemberIdsSnapshot] = useState<string[]>([])
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    try {
      const savedLocked = localStorage.getItem("is_club_settlement_locked")
      if (savedLocked === "true") {
        setIsLocked(true)
      }
    } catch (e) {}
  }, [])

  const resetForm = useCallback(() => {
    setName("")
    setCategoryId("")
    setAccountTitleId("")
    setCounterpartyId("")
    setAmount("")
    setMemo("")
    setSelectedMonths([])
    setSelectedMemberIds([])
    setEditScheduleId(null)
  }, [])

  useEffect(() => {
    const cats = getCategories()
    const accts = getAccountTitles()
    const members = getMembers()
    setCategories(cats)
    setAccountTitles(accts)
    setAllMembers(members)

    const activeMemberIds = new Set(
      members.filter((m) => m.status === "active").map((m) => m.id)
    )

    const editId = searchParams.get("edit")
    if (editId) {
      const target = getCollectionSchedules().find((s) => s.id === editId)
      if (target) {
        setEditScheduleId(editId)
        setName(target.name)
        setAmount(String(target.amount))
        setMemo(target.memo ?? "")

        const monthNum = target.targetMonth ? Number(target.targetMonth.split("-")[1]) : 0
        if (monthNum > 0) setSelectedMonths([monthNum])

        const matchCat = cats.find((c) => c.name === target.categoryName)
        if (matchCat) setCategoryId(matchCat.id)

        const acctStored = (target.accountTitleName ?? "").trim()
        const matchAcct = accts.find((t) => t.name.trim() === acctStored)
        if (matchAcct) setAccountTitleId(matchAcct.id)

        const cpStored = (target.counterpartyName ?? "").trim()
        const cashList = accts.filter((t) => t.group === "cash")
        let matchCp = cashList.find((t) => t.name.trim() === cpStored)
        if (!matchCp && cpStored) {
          const fuzzy = cashList.filter(
            (t) =>
              cpStored.startsWith(t.name.trim()) ||
              t.name.trim().startsWith(cpStored) ||
              cpStored.includes(t.name.trim()) ||
              t.name.trim().includes(cpStored)
          )
          if (fuzzy.length === 1) matchCp = fuzzy[0]
        }
        if (matchCp) setCounterpartyId(matchCp.id)

        let restoredIds: string[]
        if (target.memberIds && target.memberIds.length > 0) {
          restoredIds = target.memberIds.filter((id) => activeMemberIds.has(id))
        } else {
          const records = getCollectionRecords().filter(
            (r) => r.scheduleId === editId && activeMemberIds.has(r.memberId)
          )
          restoredIds = records.map((r) => r.memberId)
        }
        setSelectedMemberIds(restoredIds)
      }
    }
  }, [searchParams])

  const activeMembers = useMemo(
    () => allMembers.filter((m) => m.status === "active"),
    [allMembers]
  )

  // カテゴリー連動: 選択カテゴリーに属する収入科目のみ
  const filteredSubjects = useMemo(() => {
    const incomeOnly = accountTitles.filter((t) => t.group === "income")
    if (!categoryId) return incomeOnly.sort((a, b) => a.order - b.order)
    return incomeOnly
      .filter((t) => t.categoryIds.includes(categoryId))
      .sort((a, b) => a.order - b.order)
  }, [accountTitles, categoryId])

  // 入金先: 現金預金グループ
  const cashAccounts = useMemo(
    () => accountTitles.filter((t) => t.group === "cash").sort((a, b) => a.order - b.order),
    [accountTitles]
  )

  // カテゴリ変更時に科目リセット
  useEffect(() => {
    if (accountTitleId && !filteredSubjects.some((t) => t.id === accountTitleId)) {
      setAccountTitleId("")
    }
  }, [categoryId, filteredSubjects, accountTitleId])

  // 月チェックボックス
  const toggleMonth = (m: number) => {
    setSelectedMonths((prev) =>
      prev.includes(m) ? prev.filter((v) => v !== m) : [...prev, m]
    )
  }
  const toggleAllMonths = () => {
    if (selectedMonths.length === 12) {
      setSelectedMonths([])
    } else {
      setSelectedMonths([...FISCAL_MONTHS])
    }
  }

  // 部員モーダル内フィルタ
  const modalMembers = useMemo(() => {
    if (memberGradeTab === "all") return activeMembers
    return activeMembers.filter((m) => m.grade === memberGradeTab)
  }, [activeMembers, memberGradeTab])

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    )
  }
  const selectAllModalMembers = () => {
    const ids = modalMembers.map((m) => m.id)
    setSelectedMemberIds((prev) => {
      const set = new Set(prev)
      ids.forEach((id) => set.add(id))
      return Array.from(set)
    })
  }
  const deselectAllModalMembers = () => {
    const ids = new Set(modalMembers.map((m) => m.id))
    setSelectedMemberIds((prev) => prev.filter((id) => !ids.has(id)))
  }

  // バリデーション
  const canSubmit =
    name.trim() !== "" &&
    amount !== "" &&
    Number(amount) > 0 &&
    selectedMonths.length > 0 &&
    selectedMemberIds.length > 0

  // 重複チェック
  const checkDuplicates = (): string[] => {
    const existingRecords = getCollectionRecords()
    const existingSchedules = getCollectionSchedules()
    const warnings: string[] = []

    for (const month of selectedMonths) {
      const yyyymm = monthToYYYYMM(fiscalStartYear, month)
      const matchingSchedules = existingSchedules.filter((s) => s.targetMonth === yyyymm)
      if (matchingSchedules.length === 0) continue

      for (const s of matchingSchedules) {
        const paidMembers = existingRecords.filter(
          (r) =>
            r.scheduleId === s.id &&
            r.status !== "UNPAID" &&
            selectedMemberIds.includes(r.memberId)
        )
        if (paidMembers.length > 0) {
          warnings.push(`${month}月：${s.name} に${paidMembers.length}名の納入済みデータあり`)
        }
      }
    }
    return warnings
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isLocked) return
    if (!canSubmit) return

    const catName = categories.find((c) => c.id === categoryId)?.name ?? ""
    const acctName = filteredSubjects.find((t) => t.id === accountTitleId)?.name ?? "会費収入"
    const cpName = cashAccounts.find((t) => t.id === counterpartyId)?.name ?? "現金"

    if (editScheduleId) {
      if (selectedMonths.length === 0) {
        alert("集金月を1つ以上選択してください。")
        return
      }
      if (selectedMonths.length > 1) {
        alert("編集時の集金月は1つのみ選択できます。")
        return
      }

      const nextTargetMonth = monthToYYYYMM(fiscalStartYear, selectedMonths[0])
      const currentSchedule = getCollectionSchedules().find((s) => s.id === editScheduleId)

      // 入金済みデータが紐づく場合でも月変更は許可する（要件）。
      if (currentSchedule && currentSchedule.targetMonth !== nextTargetMonth) {
        const paidCount = getCollectionRecords().filter(
          (r) => r.scheduleId === editScheduleId && r.status !== "UNPAID"
        ).length
        if (paidCount > 0) {
          const proceed = confirm(
            `この設定には${paidCount}件の入金済みデータが紐づいています。\n集金月を変更して更新しますか？`
          )
          if (!proceed) return
        }
      }

      updateCollectionSchedule(editScheduleId, {
        name: name.trim(),
        amount: Number(amount),
        targetMonth: nextTargetMonth,
        categoryName: catName,
        accountTitleName: acctName,
        counterpartyName: cpName,
        memo: memo.trim(),
        memberCount: selectedMemberIds.length,
        memberIds: [...selectedMemberIds],
      })

      resetForm()
      router.push("/club/collection/schedule")
      return
    }

    const dupes = checkDuplicates()
    if (dupes.length > 0) {
      const proceed = confirm(
        `以下の月に既存の納入済みデータがあります：\n\n${dupes.join("\n")}\n\n続行しますか？`
      )
      if (!proceed) return
    }

    const groupId = `grp_${Date.now()}`
    let createdCount = 0
    for (const month of selectedMonths) {
      const yyyymm = monthToYYYYMM(fiscalStartYear, month)
      addCollectionScheduleForMembers(
        {
          name: name.trim(),
          amount: Number(amount),
          targetMonth: yyyymm,
          dueDate: "",
          categoryName: catName,
          accountTitleName: acctName,
          counterpartyName: cpName,
          memo: memo.trim(),
          groupId,
          memberCount: selectedMemberIds.length,
          monthCount: selectedMonths.length,
          memberIds: [...selectedMemberIds],
        },
        selectedMemberIds
      )
      createdCount++
    }

    resetForm()
    setWarning(null)
    setSuccess(
      `${createdCount}ヶ月 × ${selectedMemberIds.length}名 の集金予定を作成しました。`
    )
    setTimeout(() => setSuccess(null), 4000)
  }

  const handleCancelEdit = () => {
    resetForm()
    router.push("/club/collection/schedule")
  }

  return (
    <div className="px-6 py-8 min-h-screen bg-[#F5F5F0]">
      {/* ページタイトル */}
      <div
        className="rounded-t-lg border border-b-0 border-gray-200 px-6 py-4"
        style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR, backgroundColor: "white" }}
      >
        <h2 className="text-xl font-semibold" style={{ color: THEME_COLOR }}>
          集金設定
        </h2>
        <p className="text-sm text-[#6B7280] mt-0.5">
          {userInfo.organizationName}　{userInfo.fiscalPeriod}
        </p>
        <SettlementLockAlert isLocked={isLocked} className="mt-3" />
      </div>

      {/* 操作バー */}
      <div className="bg-white border-x border-gray-200 px-6 py-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#6B7280]">集金項目の作成・一人あたりの集金額設定・対象部員の一括指定</p>
        <span className="text-xs text-[#9CA3AF]">（単位：円）</span>
      </div>

      {/* コンテンツ */}
      <div className="bg-white border border-gray-200 rounded-b-lg overflow-hidden">
        <div className="p-6 space-y-8">
          {/* 成功メッセージ */}
          {success && (
            <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {/* フォーム */}
          <form onSubmit={handleSubmit} className="max-w-2xl">
            <h3 className="text-base font-semibold text-[#374151] mb-6">
              {editScheduleId ? "集金設定の編集" : "新規集金設定"}
            </h3>

            <div className="space-y-6">
              {/* 集金名 */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  集金名 <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D99529] focus:border-transparent bg-white text-sm"
                  placeholder="例：部費"
                  required
                />
              </div>

              {/* カテゴリー */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  カテゴリー <span className="text-[#EF4444]">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D99529] bg-white text-sm"
                >
                  <option value="">すべて</option>
                  {categories
                    .sort((a, b) => a.order - b.order)
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>

              {/* 科目 */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  科目 <span className="text-[#EF4444]">*</span>
                </label>
                <select
                  value={accountTitleId}
                  onChange={(e) => setAccountTitleId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D99529] bg-white text-sm"
                >
                  <option value="">選択してください</option>
                  {filteredSubjects.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* 入金先 */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  入金先 <span className="text-[#EF4444]">*</span>
                </label>
                <select
                  value={counterpartyId}
                  onChange={(e) => setCounterpartyId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D99529] bg-white text-sm"
                >
                  <option value="">選択してください</option>
                  {cashAccounts.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* 一人あたりの集金額 */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  一人あたりの集金額（円） <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-3 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D99529] focus:border-transparent text-right tabular-nums text-sm"
                  placeholder="例：3000"
                  min="1"
                  required
                />
              </div>

              {/* メモ */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  メモ
                </label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D99529] focus:border-transparent bg-white text-sm"
                  placeholder="例：スタッフ分"
                />
              </div>
            </div>

            {/* 集金月（チェックボックス） */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-[#374151]">
                  集金月 <span className="text-[#EF4444]">*</span>
                </label>
                <button
                  type="button"
                  onClick={toggleAllMonths}
                  className="text-xs font-medium hover:underline"
                  style={{ color: THEME_COLOR }}
                >
                  {selectedMonths.length === 12 ? "全解除" : "全選択"}
                </button>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {FISCAL_MONTHS.map((m) => {
                  const checked = selectedMonths.includes(m)
                  return (
                    <label
                      key={m}
                      className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors select-none ${
                        checked
                          ? "border-[#D99529] bg-[#D99529]/10 text-[#374151]"
                          : "border-gray-200 bg-white text-[#6B7280] hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMonth(m)}
                        className="sr-only"
                      />
                      {m}月
                    </label>
                  )
                })}
              </div>
              {selectedMonths.length > 0 && (
                <p className="text-xs text-[#6B7280] mt-1.5">
                  {selectedMonths.sort((a, b) => {
                    const ia = FISCAL_MONTHS.indexOf(a as typeof FISCAL_MONTHS[number])
                    const ib = FISCAL_MONTHS.indexOf(b as typeof FISCAL_MONTHS[number])
                    return ia - ib
                  }).map((m) => `${m}月`).join("・")} を選択中
                </p>
              )}
            </div>

            {/* 対象部員 */}
            <div className="mt-8">
              <label className="block text-sm font-medium text-[#374151] mb-2">
                対象部員 <span className="text-[#EF4444]">*</span>
              </label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => { setMemberIdsSnapshot([...selectedMemberIds]); setMemberModalOpen(true) }}
                >
                  <Users className="h-4 w-4" style={{ color: THEME_COLOR }} />
                  部員を選択する
                </Button>
                <span className="text-sm font-medium" style={{ color: THEME_COLOR }}>
                  {selectedMemberIds.length > 0
                    ? `${selectedMemberIds.length}名 選択中`
                    : "未選択"}
                </span>
              </div>
              {activeMembers.length === 0 && (
                <p className="text-xs text-[#9CA3AF] mt-1">部員管理から部員を登録してください</p>
              )}
            </div>

            {/* 送信ボタン */}
            <div className="mt-8 flex items-center gap-3">
              {editScheduleId ? (
                <>
                  <Button
                    type="submit"
                    className="text-white px-8 py-2.5 rounded-lg text-sm"
                    style={{ backgroundColor: THEME_COLOR }}
                    disabled={!canSubmit || isLocked}
                  >
                    集金を編集する
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="px-6 py-2.5 rounded-lg text-sm"
                    onClick={handleCancelEdit}
                  >
                    キャンセル
                  </Button>
                </>
              ) : (
                <Button
                  type="submit"
                  className="text-white px-8 py-2.5 rounded-lg text-sm"
                  style={{ backgroundColor: THEME_COLOR }}
                  disabled={!canSubmit || isLocked}
                >
                  集金を登録する
                </Button>
              )}
            </div>
            {!editScheduleId && canSubmit && (
              <p className="text-xs text-[#6B7280] mt-2">
                {selectedMonths.length}ヶ月 × {selectedMemberIds.length}名 ＝ 合計{selectedMonths.length * selectedMemberIds.length}件のレコードが作成されます
              </p>
            )}
          </form>

        </div>
      </div>

      {/* ===== 部員選択モーダル ===== */}
      {memberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            {/* モーダルヘッダ */}
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <h3 className="text-base font-semibold text-[#374151]">対象部員を選択</h3>
              <span className="text-sm font-medium" style={{ color: THEME_COLOR }}>
                {selectedMemberIds.length}名 選択中
              </span>
            </div>

            {/* 学年タブ */}
            <div className="px-5 pt-3 pb-2 flex gap-1 flex-shrink-0 border-b border-gray-100">
              <button
                type="button"
                onClick={() => setMemberGradeTab("all")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  memberGradeTab === "all" ? "text-white" : "bg-gray-100 text-[#374151] hover:bg-gray-200"
                }`}
                style={memberGradeTab === "all" ? { backgroundColor: THEME_COLOR } : {}}
              >
                すべて
              </button>
              {GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setMemberGradeTab(g)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    memberGradeTab === g ? "text-white" : "bg-gray-100 text-[#374151] hover:bg-gray-200"
                  }`}
                  style={memberGradeTab === g ? { backgroundColor: THEME_COLOR } : {}}
                >
                  {GRADE_LABELS[g]}
                </button>
              ))}
              <div className="flex-1" />
              <button
                type="button"
                onClick={selectAllModalMembers}
                className="text-xs font-medium hover:underline"
                style={{ color: THEME_COLOR }}
              >
                全選択
              </button>
              <button
                type="button"
                onClick={deselectAllModalMembers}
                className="text-xs font-medium text-[#6B7280] hover:underline ml-2"
              >
                全解除
              </button>
            </div>

            {/* 部員リスト */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {modalMembers.length === 0 ? (
                <p className="text-sm text-[#9CA3AF] text-center py-8">該当する部員がいません</p>
              ) : (
                <div className="space-y-1">
                  {/* ヘッダーチェックボックス（全選択/全解除） */}
                  {(() => {
                    const visibleIds = modalMembers.map((m) => m.id)
                    const selectedVisible = visibleIds.filter((id) => selectedMemberIds.includes(id))
                    const allChecked = selectedVisible.length === visibleIds.length
                    const someChecked = selectedVisible.length > 0 && !allChecked
                    return (
                      <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer bg-gray-50 border border-gray-200 mb-2">
                        <input
                          type="checkbox"
                          ref={(el) => { if (el) el.indeterminate = someChecked }}
                          checked={allChecked}
                          onChange={() => {
                            if (allChecked) {
                              deselectAllModalMembers()
                            } else {
                              selectAllModalMembers()
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300 accent-[#D99529]"
                        />
                        <span className="text-sm font-semibold text-[#374151] flex-1">
                          {memberGradeTab === "all" ? "全部員" : GRADE_LABELS[memberGradeTab as number]}を選択
                        </span>
                        <span className="text-xs text-[#6B7280]">
                          {selectedVisible.length}/{visibleIds.length}名
                        </span>
                      </label>
                    )
                  })()}
                  {modalMembers
                    .sort((a, b) => {
                      if (a.grade !== b.grade) return b.grade - a.grade
                      return a.name.localeCompare(b.name, "ja")
                    })
                    .map((m) => {
                      const checked = selectedMemberIds.includes(m.id)
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                            checked ? "bg-[#D99529]/8" : "hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleMember(m.id)}
                            className="h-4 w-4 rounded border-gray-300 accent-[#D99529]"
                          />
                          <span className="text-sm font-medium text-[#374151] flex-1">{m.name}</span>
                          <span className="text-xs text-[#6B7280]">{GRADE_LABELS[m.grade]}</span>
                        </label>
                      )
                    })}
                </div>
              )}
            </div>

            {/* モーダルフッタ */}
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-3 flex-shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setSelectedMemberIds(memberIdsSnapshot); setMemberModalOpen(false) }}
              >
                キャンセル
              </Button>
              <Button
                type="button"
                className="text-white"
                style={{ backgroundColor: THEME_COLOR }}
                onClick={() => setMemberModalOpen(false)}
              >
                決定（{selectedMemberIds.length}名）
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

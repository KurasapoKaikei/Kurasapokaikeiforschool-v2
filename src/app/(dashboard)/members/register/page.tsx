"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Download, Upload, CheckCircle2, FileSpreadsheet, UserPlus } from "lucide-react"
import { getMembers, addMember, type Member } from "@/utils/localStorage"
import { createUtf8CsvBlob, stripLeadingCsvBom } from "@/utils/csvUtf8"

const THEME_COLOR = "#9D8CC3"
const GRADE_LABELS: Record<number, string> = { 1: "1年生", 2: "2年生", 3: "3年生", 4: "4年生" }
const GRADE_OPTIONS = [1, 2, 3, 4] as const

interface CsvRow {
  name: string
  grade: number | null
  email: string
  errors: string[]
}

export default function MembersRegisterPage() {
  const router = useRouter()

  // タブ
  const [activeTab, setActiveTab] = useState<"individual" | "csv">("individual")

  // 個別登録フォーム
  const [formName, setFormName] = useState("")
  const [formGrade, setFormGrade] = useState<number | "">("")
  const [formEmail, setFormEmail] = useState("")
  const [formSuccess, setFormSuccess] = useState(false)

  // 最近の登録
  const [recentMembers, setRecentMembers] = useState<Member[]>([])

  // CSV一括登録
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [csvFileName, setCsvFileName] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)
  const [importResult, setImportResult] = useState<{ count: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refreshRecent = useCallback(() => {
    const members = getMembers()
    setRecentMembers(
      [...members]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
    )
  }, [])

  useEffect(() => {
    refreshRecent()
  }, [refreshRecent])

  // ===== 個別登録 =====
  const canSubmitIndividual = formName.trim() !== "" && formGrade !== ""

  const handleIndividualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmitIndividual) return

    addMember({
      name: formName.trim(),
      grade: formGrade as number,
      email: formEmail.trim(),
      status: "active",
      retiredAt: null,
    })

    setFormName("")
    setFormGrade("")
    setFormEmail("")
    setFormSuccess(true)
    refreshRecent()

    setTimeout(() => setFormSuccess(false), 3000)
  }

  // ===== CSVテンプレート =====
  const handleDownloadTemplate = () => {
    const header = "氏名,学年,メールアドレス\n"
    const blob = createUtf8CsvBlob(header)
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "部員登録テンプレート.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  // ===== CSV解析 =====
  const parseCsv = (text: string): CsvRow[] => {
    const lines = stripLeadingCsvBom(text).split(/\r?\n/).filter((line) => line.trim() !== "")
    if (lines.length <= 1) return []

    const existingMembers = getMembers()

    return lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim())
      const name = cols[0] ?? ""
      const gradeStr = cols[1] ?? ""
      const email = cols[2] ?? ""
      const errors: string[] = []

      if (!name) errors.push("氏名が未入力です")

      let grade: number | null = null
      if (!gradeStr) {
        errors.push("学年が未入力です")
      } else {
        const parsed = parseInt(gradeStr, 10)
        if (Number.isNaN(parsed) || parsed < 1 || parsed > 4) {
          errors.push("学年は1〜4の数値を入力してください")
        } else {
          grade = parsed
        }
      }

      if (name && existingMembers.some((m) => m.name === name && m.status === "active")) {
        errors.push("同名の在籍中部員が既に登録されています")
      }

      return { name, grade, email, errors }
    })
  }

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      alert("CSVファイルのみアップロードできます。")
      return
    }
    setCsvFileName(file.name)
    setImportResult(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setCsvRows(parseCsv(text))
    }
    reader.readAsText(file, "UTF-8")
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ""
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }
  const handleDragLeave = () => setIsDragOver(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const hasErrors = csvRows.some((r) => r.errors.length > 0)
  const validRows = csvRows.filter((r) => r.errors.length === 0)

  const handleBulkRegister = () => {
    if (hasErrors || validRows.length === 0) return

    validRows.forEach((row) => {
      addMember({
        name: row.name,
        grade: row.grade!,
        email: row.email,
        status: "active",
        retiredAt: null,
      })
    })

    setImportResult({ count: validRows.length })
    setCsvRows([])
    setCsvFileName("")
    refreshRecent()
  }

  const handleReset = () => {
    setCsvRows([])
    setCsvFileName("")
    setImportResult(null)
  }

  return (
    <div className="px-6 py-8 min-h-screen bg-[#F5F5F0]">
      {/* ページタイトル */}
      <div
        className="rounded-t-lg border border-b-0 border-gray-200 px-6 py-4"
        style={{ borderLeftWidth: 5, borderLeftColor: THEME_COLOR, backgroundColor: "white" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold" style={{ color: THEME_COLOR }}>
            部員登録
          </h2>
          <Button
            type="button"
            variant="outline"
            className="text-sm"
            onClick={() => router.push("/members/list")}
          >
            部員一覧を見る →
          </Button>
        </div>
      </div>

      {/* タブ */}
      <div className="bg-white border-x border-gray-200 px-6 pt-3 flex items-end gap-0">
        <button
          onClick={() => setActiveTab("individual")}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
            activeTab === "individual"
              ? "bg-white text-[#374151] border-gray-200 -mb-px z-10"
              : "bg-gray-50 text-[#6B7280] border-transparent hover:text-[#374151]"
          }`}
          style={activeTab === "individual" ? { borderBottomColor: "white" } : {}}
        >
          <UserPlus className="h-4 w-4" style={{ color: THEME_COLOR }} />
          個別登録
        </button>
        <button
          onClick={() => setActiveTab("csv")}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
            activeTab === "csv"
              ? "bg-white text-[#374151] border-gray-200 -mb-px z-10"
              : "bg-gray-50 text-[#6B7280] border-transparent hover:text-[#374151]"
          }`}
          style={activeTab === "csv" ? { borderBottomColor: "white" } : {}}
        >
          <FileSpreadsheet className="h-4 w-4" style={{ color: THEME_COLOR }} />
          CSV一括登録
        </button>
        <div className="flex-1" />
        <span className="text-xs text-[#9CA3AF] pb-3">（単位：人）</span>
      </div>

      {/* コンテンツ */}
      <div className="bg-white border border-gray-200 rounded-b-lg overflow-hidden">
        {/* ===== 個別登録タブ ===== */}
        {activeTab === "individual" && (
          <div className="p-6">
            {/* 成功メッセージ */}
            {formSuccess && (
              <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-800">部員を登録しました。続けて別の部員を登録できます。</p>
              </div>
            )}

            {/* インラインフォーム */}
            <form onSubmit={handleIndividualSubmit}>
              <h3 className="text-base font-semibold text-[#374151] mb-4">新しい部員を登録する</h3>

              <div className="max-w-lg space-y-5">
                {/* 氏名 */}
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    氏名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="例：山田 太郎"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9D8CC3] focus:border-[#9D8CC3]"
                    required
                  />
                </div>

                {/* 学年 */}
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    学年 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formGrade}
                    onChange={(e) => setFormGrade(e.target.value ? Number(e.target.value) : "")}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9D8CC3] focus:border-[#9D8CC3] bg-white"
                    required
                  >
                    <option value="">選択してください</option>
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {GRADE_LABELS[g]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* メールアドレス */}
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    メールアドレス <span className="text-xs text-[#9CA3AF]">（任意）</span>
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="例：taro@example.com"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9D8CC3] focus:border-[#9D8CC3]"
                  />
                </div>
              </div>

              {/* 登録ボタン */}
              <div className="mt-6">
                <Button
                  type="submit"
                  className="text-white px-8 py-2.5 rounded-lg text-sm"
                  style={{ backgroundColor: THEME_COLOR }}
                  disabled={!canSubmitIndividual}
                >
                  登録する
                </Button>
              </div>
            </form>

            {/* 最近の登録 */}
            {recentMembers.length > 0 && (
              <div className="mt-8 border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-[#374151] mb-3">最近の登録</h3>
                <div className="space-y-2">
                  {recentMembers.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-[#374151]">{m.name}</span>
                        <span className="text-xs text-[#6B7280]">{GRADE_LABELS[m.grade]}</span>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          m.status === "active" ? "text-white" : "bg-gray-200 text-gray-600"
                        }`}
                        style={m.status === "active" ? { backgroundColor: THEME_COLOR } : {}}
                      >
                        {m.status === "active" ? "在籍中" : "退部"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== CSV一括登録タブ ===== */}
        {activeTab === "csv" && (
          <div className="p-6">
            {importResult && (
              <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-800">
                  <span className="font-semibold">{importResult.count}名</span>の部員を一括登録しました。
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-auto text-xs"
                  onClick={handleReset}
                >
                  別のCSVを登録
                </Button>
              </div>
            )}

            {!importResult && (
              <div className="space-y-8">
                {/* ステップ1 */}
                <div className="flex gap-4">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: THEME_COLOR }}
                  >
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-[#374151] mb-1">テンプレートの準備</h3>
                    <p className="text-sm text-[#6B7280] mb-3">
                      専用のCSVテンプレートをダウンロードし、部員情報を入力してください。
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={handleDownloadTemplate}
                    >
                      <Download className="h-4 w-4" style={{ color: THEME_COLOR }} />
                      テンプレートをダウンロード（CSV）
                    </Button>
                  </div>
                </div>

                {/* ステップ2 */}
                <div className="flex gap-4">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: csvFileName ? THEME_COLOR : "#9CA3AF" }}
                  >
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-[#374151] mb-1">ファイルのアップロード</h3>
                    <p className="text-sm text-[#6B7280] mb-3">
                      入力済みのCSVファイルをここにドラッグ＆ドロップするか、ファイルを選択してください。
                    </p>

                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                        isDragOver
                          ? "border-[#9D8CC3] bg-[#9D8CC3]/5"
                          : csvFileName
                          ? "border-[#9D8CC3]/40 bg-[#9D8CC3]/5"
                          : "border-gray-300 hover:border-[#9D8CC3]/60"
                      }`}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleFileInput}
                      />
                      {csvFileName ? (
                        <div className="flex flex-col items-center gap-2">
                          <FileSpreadsheet className="h-8 w-8" style={{ color: THEME_COLOR }} />
                          <p className="text-sm font-medium text-[#374151]">{csvFileName}</p>
                          <p className="text-xs text-[#6B7280]">クリックまたはドロップで変更</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-8 w-8 text-[#9CA3AF]" />
                          <p className="text-sm text-[#6B7280]">
                            ここにCSVファイルをドラッグ＆ドロップ
                          </p>
                          <p className="text-xs text-[#9CA3AF]">または クリックしてファイルを選択</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ステップ3 */}
                {csvRows.length > 0 && (
                  <div className="flex gap-4">
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: hasErrors ? "#EF4444" : THEME_COLOR }}
                    >
                      3
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-[#374151] mb-1">内容の確認と実行</h3>
                      <p className="text-sm text-[#6B7280] mb-3">
                        {hasErrors
                          ? `${csvRows.filter((r) => r.errors.length > 0).length}件のエラーがあります。修正してから再アップロードしてください。`
                          : `${validRows.length}名の部員データを確認してください。`}
                      </p>

                      <div className="flex justify-center mb-4">
                        <div className="border border-gray-200 rounded-lg overflow-hidden inline-block max-w-full">
                          <div className="overflow-x-auto">
                            <table className="table-fixed border-collapse text-sm w-[22rem] sm:w-[26rem]">
                              <colgroup>
                                <col className="w-10" />
                                <col className="w-[7rem]" />
                                <col className="w-12" />
                                <col className="w-[9rem]" />
                              </colgroup>
                              <thead>
                                <tr className="bg-gray-50">
                                  <th className="px-2 py-2.5 text-center font-semibold text-[#374151] border-b border-r border-gray-200">
                                    No.
                                  </th>
                                  <th className="px-2 py-2.5 text-center font-semibold text-[#374151] border-b border-r border-gray-200">
                                    氏名
                                  </th>
                                  <th className="px-2 py-2.5 text-center font-semibold text-[#374151] border-b border-r border-gray-200">
                                    学年
                                  </th>
                                  <th className="px-2 py-2.5 text-center font-semibold text-[#374151] border-b border-gray-200">
                                    メール
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {csvRows.map((row, idx) => {
                                  const hasErr = row.errors.length > 0
                                  return (
                                    <tr
                                      key={idx}
                                      className={`border-b border-gray-100 last:border-b-0 ${hasErr ? "bg-red-50" : ""}`}
                                    >
                                      <td className="px-2 py-2.5 text-center tabular-nums text-[#6B7280] border-r border-gray-100">
                                        {idx + 1}
                                      </td>
                                      <td className="px-2 py-2.5 text-left text-[#374151] border-r border-gray-100 truncate max-w-0" title={row.name || undefined}>
                                        {row.name || <span className="text-red-400 italic">未入力</span>}
                                      </td>
                                      <td className="px-2 py-2.5 text-center tabular-nums text-[#374151] border-r border-gray-100">
                                        {row.grade != null ? row.grade : <span className="text-red-400 italic">-</span>}
                                      </td>
                                      <td className="px-2 py-2.5 text-left text-[#6B7280] truncate max-w-0" title={row.email || undefined}>
                                        {row.email || "-"}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {hasErrors && (
                        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm font-medium text-red-800 mb-2">エラー詳細：</p>
                          <ul className="text-xs text-red-700 space-y-1">
                            {csvRows
                              .filter((r) => r.errors.length > 0)
                              .map((r, idx) => (
                                <li key={idx}>
                                  行{csvRows.indexOf(r) + 1}（{r.name || "氏名なし"}）：{r.errors.join("、")}
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          className="text-white px-6 py-2.5 rounded-lg"
                          style={{ backgroundColor: THEME_COLOR }}
                          onClick={handleBulkRegister}
                          disabled={hasErrors || validRows.length === 0}
                        >
                          一括登録を実行（{validRows.length}名）
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="px-4 py-2.5 rounded-lg"
                          onClick={handleReset}
                        >
                          リセット
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

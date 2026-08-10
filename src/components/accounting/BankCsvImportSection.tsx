"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  getTransactions,
  createCsvImportBatchAndTransactions,
  findCsvImportConflict,
  getCollectionRecords,
  getCollectionSchedules,
  sumCollectionRecordNetPaid,
  updateCollectionRecord,
  type AccountTitle,
  type Category,
  type Transaction,
} from "@/utils/localStorage"
import { createUtf8CsvBlob, stripLeadingCsvBom } from "@/utils/csvUtf8"
import { normalizeCsvTextForHash, sha256HexFromString } from "@/utils/csvImportHash"
import { useUserInfo } from "@/contexts/UserInfoContext"
import {
  BANK_IMPORT_HEADER_ROW,
  bankImportHeaderRowMatch,
  buildBankImportTemplateCsvBody,
} from "@/utils/bankImportTemplate"
import {
  CsvCollectionLinkModal,
  type CsvCollectionLinkResult,
} from "@/components/accounting/CsvCollectionLinkModal"
import { formatAmountDisplay } from "@/utils/formatAmountDisplay"
import { usePortalFiscalYearOptional } from "@/contexts/PortalFiscalYearContext"
import {
  formatFiscalBoundsMessage,
  isDateWithinFiscalBounds,
  resolveFiscalDateBounds,
} from "@/lib/fiscalDateBounds"
import { getCurrentClub } from "@/lib/clubLoginSession"
import {
  getSettlementPeriodLockErrorMessage,
  isTransactionDateLocked,
} from "@/lib/clubSettlementPortalSync"

export { BANK_IMPORT_HEADER_ROW as BANK_CSV_HEADERS, BANK_IMPORT_HEADERS } from "@/utils/bankImportTemplate"

function padFour(cells: string[]): string[] {
  const row = [...cells]
  while (row.length < 4) row.push("")
  return row.slice(0, 4)
}

/** ごく簡易なCSV1行パース（ダブルクォート対応のみ） */
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && c === ",") {
      out.push(cur)
      cur = ""
      continue
    }
    cur += c
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

function normalizeDate(raw: string): string | null {
  const s = raw.trim().replace(/\./g, "/")
  const m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

function parseAmount(raw: string): number {
  const n = Number(String(raw).replace(/,/g, "").trim())
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

type TxKind = "income" | "expense"

/** CSVプレビュー行の取引区分（帳簿の Transaction.type と対応） */
type CsvRowTxType = "income" | "expense" | "transfer" | "collection"

type CsvRowState = {
  id: string
  accountName: string
  date: string
  withdrawal: number
  deposit: number
  memo: string
  category: string
  accountTitle: string
  txType: CsvRowTxType | "invalid"
  error: string | null
  /** 集金ポップアップで割当を保存済み（まだ帳簿・実績には未反映。一括登録で確定） */
  collectionDraft?: boolean
  collectionMemberId?: string
  collectionScheduleId?: string
}

const CSV_TX_LABEL: Record<CsvRowTxType, string> = {
  income: "入金",
  expense: "出金",
  transfer: "振替",
  collection: "集金",
}

function suggestionKindForRow(txType: CsvRowTxType): TxKind {
  return txType === "expense" ? "expense" : "income"
}

/** 入金額列／出金額列のどちらかに非ゼロがある行ごとに選択可能な区分 */
function allowedTxTypesForRow(r: Pick<CsvRowState, "deposit" | "withdrawal" | "txType" | "error">): CsvRowTxType[] {
  if (r.error || r.txType === "invalid") return []
  if (r.deposit !== 0) return ["income", "transfer", "collection"]
  if (r.withdrawal !== 0) return ["expense", "transfer"]
  return []
}

function defaultTxTypeForAmounts(deposit: number, withdrawal: number): CsvRowTxType {
  if (deposit !== 0) return "income"
  if (withdrawal !== 0) return "expense"
  return "income"
}

/** 摘要キーワード → 支出科目名に含めたい語（マスタに無ければ次候補へ） */
const KEYWORD_EXPENSE_HINTS: { keys: string[]; titleIncludes: string[] }[] = [
  { keys: ["振込手数料", "振込　手数料"], titleIncludes: ["支払手数料", "手数料", "通信費"] },
  { keys: ["コンビニ", "セブン", "ローソン", "ファミリーマート"], titleIncludes: ["消耗品", "雑費", "消耗品費"] },
  { keys: ["交通", "ＪＲ", "JR", "切符"], titleIncludes: ["交通費", "遠征"] },
  { keys: ["部費", "会費"], titleIncludes: ["会費", "部費"] },
]

const KEYWORD_INCOME_HINTS: { keys: string[]; titleIncludes: string[] }[] = [
  { keys: ["部費", "会費", "振込"], titleIncludes: ["会費", "部費", "雑収入"] },
  { keys: ["寄付", "Donation"], titleIncludes: ["寄付", "雑収入"] },
]

function pickTitleByHints(
  titles: AccountTitle[],
  hints: { titleIncludes: string[] }[]
): string {
  for (const h of hints) {
    for (const frag of h.titleIncludes) {
      const hit = titles.find((t) => t.name.includes(frag))
      if (hit) return hit.name
    }
  }
  return titles[0]?.name ?? ""
}

function guessFromHistory(
  transactions: Transaction[],
  memo: string,
  kind: TxKind
): { category: string; accountTitle: string } | null {
  const needle = memo.trim()
  if (needle.length < 2) return null
  const sameType = transactions.filter((t) => t.type === kind && t.memo)
  const scores = new Map<string, { category: string; accountTitle: string; n: number }>()
  for (const t of sameType) {
    const tm = t.memo
    const hit =
      needle.includes(tm.slice(0, Math.min(6, tm.length))) ||
      tm.includes(needle.slice(0, Math.min(6, needle.length)))
    if (!hit) continue
    const key = `${t.category}\t${t.accountTitle}`
    const prev = scores.get(key)
    if (prev) prev.n += 1
    else scores.set(key, { category: t.category, accountTitle: t.accountTitle, n: 1 })
  }
  let best: { category: string; accountTitle: string; n: number } | null = null
  for (const v of Array.from(scores.values())) {
    if (!best || v.n > best.n) best = v
  }
  if (best && best.n >= 1) return { category: best.category, accountTitle: best.accountTitle }
  return null
}

function guessCategoryAndTitle(
  memo: string,
  kind: TxKind,
  transactions: Transaction[],
  categories: Category[],
  expenseTitles: AccountTitle[],
  incomeTitles: AccountTitle[],
  categoryName: string | null
): { category: string; accountTitle: string } {
  const fromHist = guessFromHistory(transactions, memo, kind)
  if (fromHist) return fromHist

  const hints = kind === "expense" ? KEYWORD_EXPENSE_HINTS : KEYWORD_INCOME_HINTS
  for (const h of hints) {
    if (!h.keys.some((k) => memo.includes(k))) continue
    const pool = kind === "expense" ? expenseTitles : incomeTitles
    let titled = pickTitleByHints(pool, [h])
    if (titled && categoryName) {
      const cat = categories.find((c) => c.name === categoryName)
      if (cat) {
        const filtered = pool.filter((t) => t.categoryIds.includes(cat.id))
        if (filtered.length) titled = pickTitleByHints(filtered, [h]) || titled
      }
    }
    if (titled) {
      const titleObj = pool.find((t) => t.name === titled)
      const cat =
        titleObj && titleObj.categoryIds.length
          ? categories.find((c) => titleObj.categoryIds.includes(c.id))
          : categories[0]
      return { category: cat?.name ?? categories[0]?.name ?? "", accountTitle: titled }
    }
  }

  const firstCat = categories[0]?.name ?? ""
  const pool = kind === "expense" ? expenseTitles : incomeTitles
  const titled = pool[0]?.name ?? ""
  return { category: firstCat, accountTitle: titled }
}

type Props = {
  categories: Category[]
  accountTitles: AccountTitle[]
  cashAccountTitles: AccountTitle[]
  transactions: Transaction[]
  onImported: () => void
  registerDisabled?: boolean
}

export function BankCsvImportSection({
  categories,
  accountTitles,
  cashAccountTitles,
  transactions,
  onImported,
  registerDisabled = false,
}: Props) {
  const { currentOperatorName } = useUserInfo()
  const portalFiscalYear = usePortalFiscalYearOptional()
  const fiscalBounds = useMemo(
    () => resolveFiscalDateBounds(portalFiscalYear?.selectedYear),
    [portalFiscalYear?.selectedYear]
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadId = useId()
  const [rows, setRows] = useState<CsvRowState[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [importSource, setImportSource] = useState<{ fileName: string; contentHash: string } | null>(null)
  /** テンプレートダウンロード前に選択する現金・預金科目（A1 に書く） */
  const [templateCashAccount, setTemplateCashAccount] = useState("")
  /** 区分「集金」選択時の連携ポップアップ */
  const [collectionLinkRowId, setCollectionLinkRowId] = useState<string | null>(null)
  const [collectionLinkPrevType, setCollectionLinkPrevType] = useState<CsvRowTxType | null>(null)

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  )

  const cashNamesSorted = useMemo(
    () =>
      [...cashAccountTitles]
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ja"))
        .map((t) => t.name),
    [cashAccountTitles]
  )

  const cashNameSet = useMemo(() => new Set(cashNamesSorted), [cashNamesSorted])

  useEffect(() => {
    if (templateCashAccount && cashNameSet.has(templateCashAccount)) return
    setTemplateCashAccount(cashNamesSorted[0] ?? "")
  }, [cashNamesSorted, cashNameSet, templateCashAccount])

  const titlesForCategory = useCallback(
    (categoryName: string, kind: TxKind) => {
      const cat = sortedCategories.find((c) => c.name === categoryName)
      const group = kind === "income" ? "income" : "expense"
      let list = accountTitles.filter((t) => t.group === group)
      if (cat) list = list.filter((t) => t.categoryIds.includes(cat.id))
      return list.sort((a, b) => a.order - b.order)
    },
    [accountTitles, sortedCategories]
  )

  const downloadTemplate = () => {
    const accountName = templateCashAccount.trim()
    if (!accountName) {
      alert("テンプレートに書き込む現金・預金科目を選択してください。")
      return
    }
    if (!cashNameSet.has(accountName)) {
      alert(`「${accountName}」は登録済みの現金・預金科目にありません。`)
      return
    }
    const blob = createUtf8CsvBlob(buildBankImportTemplateCsvBody(accountName))
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "bank-import-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const applySuggestionToRow = useCallback(
    (r: CsvRowState): CsvRowState => {
      if (r.txType === "invalid" || r.collectionDraft) return r
      if (r.txType === "collection") {
        // 集金はポップアップ登録後にカテゴリー・科目・メモを確定する
        return { ...r, category: r.category || "", accountTitle: r.accountTitle || "" }
      }
      if (r.txType === "transfer") {
        const others = cashAccountTitles.filter((t) => t.name !== r.accountName)
        const pick = others[0] ?? cashAccountTitles[0]
        return { ...r, category: "", accountTitle: pick?.name ?? "" }
      }
      const expenseAll = accountTitles.filter((t) => t.group === "expense")
      const incomeAll = accountTitles.filter((t) => t.group === "income")
      const sk = suggestionKindForRow(r.txType)
      const guessed = guessCategoryAndTitle(
        r.memo,
        sk,
        transactions,
        sortedCategories,
        expenseAll,
        incomeAll,
        sortedCategories[0]?.name ?? null
      )
      return { ...r, category: guessed.category, accountTitle: guessed.accountTitle }
    },
    [accountTitles, cashAccountTitles, sortedCategories, transactions]
  )

  /** 金額パターンと不整合な区分があれば既定値へ戻す（表示・保存の整合用） */
  useEffect(() => {
    setRows((prev) => {
      let changed = false
      const next = prev.map((r) => {
        if (r.error || r.txType === "invalid") return r
        const allowed = allowedTxTypesForRow(r)
        if (allowed.length === 0) return r
        if (!allowed.includes(r.txType as CsvRowTxType)) {
          changed = true
          return applySuggestionToRow({
            ...r,
            txType: defaultTxTypeForAmounts(r.deposit, r.withdrawal),
          })
        }
        return r
      })
      return changed ? next : prev
    })
  }, [rows, applySuggestionToRow])

  const ingestFromDataRows = (accountName: string, dataRows: string[][], idPrefix: string): boolean => {
    setParseError(null)
    const next: CsvRowState[] = []
    for (let i = 0; i < dataRows.length; i++) {
      const cells = padFour(dataRows[i] ?? [])
      if (cells.every((c) => c === "" || c.trim() === "")) continue
      const dateRaw = cells[0] ?? ""
      const deposit = parseAmount(cells[1] ?? "0")
      const withdrawal = parseAmount(cells[2] ?? "0")
      const memo = (cells[3] ?? "").trim()
      const rowLabel = i + 3

      let txType: CsvRowTxType | "invalid" = "invalid"
      let error: string | null = null
      if (withdrawal !== 0 && deposit !== 0) error = "入金額・出金額の両方に金額があります"
      else if (withdrawal === 0 && deposit === 0) error = "金額がありません"
      else {
        const d = normalizeDate(dateRaw)
        if (!d) {
          error = "日付形式が不正です（YYYY/MM/DD など）"
        } else if (!isDateWithinFiscalBounds(d, fiscalBounds)) {
          error = formatFiscalBoundsMessage(fiscalBounds)
        } else {
          txType = deposit !== 0 ? "income" : "expense"
          next.push({
            id: `${idPrefix}_${rowLabel}_${Math.random().toString(36).slice(2, 9)}`,
            accountName,
            date: d,
            withdrawal,
            deposit,
            memo,
            category: "",
            accountTitle: "",
            txType,
            error,
          })
          continue
        }
      }
      next.push({
        id: `${idPrefix}_${rowLabel}_${Math.random().toString(36).slice(2, 9)}`,
        accountName,
        date: normalizeDate(dateRaw) ?? "",
        withdrawal,
        deposit,
        memo,
        category: "",
        accountTitle: "",
        txType: "invalid",
        error,
      })
    }

    if (next.length === 0) {
      setParseError(
        "取り込むデータ行がありません。テンプレートに日付・金額などを入力してください。"
      )
      setRows([])
      return false
    }
    const suggested = next.map((r) => (r.error ? r : applySuggestionToRow(r)))
    setRows(suggested)
    return true
  }

  const parseCsvText = (text: string): boolean => {
    const allLines = stripLeadingCsvBom(text).split(/\r?\n/)
    if (allLines.length < 2) {
      setParseError(
        "行が不足しています。1行目のA列に現金・預金口座名、2行目に見出し（日付・入金額・出金額・摘要）が必要です。"
      )
      setRows([])
      return false
    }

    const row0Cells = parseCsvLine(allLines[0]).map((c) => c.replace(/^\ufeff/, ""))
    const accountName = (row0Cells[0] ?? "").trim()
    if (!accountName) {
      setParseError("1行目のA列に、取込対象の現金・預金口座名を入力してください。")
      setRows([])
      return false
    }
    if (!cashNameSet.has(accountName)) {
      setParseError(`「${accountName}」は登録済みの現金・預金口座にありません。1行目を修正してください。`)
      setRows([])
      return false
    }

    const headerCells = parseCsvLine(allLines[1]).map((c) => c.replace(/^\ufeff/, ""))
    if (!bankImportHeaderRowMatch(headerCells)) {
      setParseError(
        `2行目は次の見出しにしてください: ${BANK_IMPORT_HEADER_ROW.join(", ")}`
      )
      setRows([])
      return false
    }

    const dataRows = allLines.slice(2).map((line) => parseCsvLine(line))
    return ingestFromDataRows(accountName, dataRows, "csv")
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    const f = input.files?.[0]
    if (!f) return

    const nameLower = f.name.toLowerCase()
    if (!nameLower.endsWith(".csv")) {
      setParseError("CSV ファイル（.csv）を選択してください。")
      setRows([])
      input.value = ""
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      void (async () => {
        const text = String(reader.result ?? "")
        const norm = normalizeCsvTextForHash(text)
        const hash = await sha256HexFromString(norm)
        const conflict = findCsvImportConflict(f.name, hash)
        if (conflict) {
          setParseError(conflict)
          setRows([])
          setImportSource(null)
          input.value = ""
          return
        }
        const parsedOk = parseCsvText(text)
        if (parsedOk) {
          setImportSource({ fileName: f.name, contentHash: hash })
        } else {
          setImportSource(null)
        }
        input.value = ""
      })()
    }
    reader.readAsText(f, "UTF-8")
  }

  const titlesForCsvRow = useCallback(
    (r: CsvRowState): AccountTitle[] => {
      if (r.txType === "invalid") return []
      if (r.txType === "transfer") {
        return [...cashAccountTitles]
          .filter((t) => t.name !== r.accountName)
          .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ja"))
      }
      const kind = suggestionKindForRow(r.txType)
      return titlesForCategory(r.category, kind)
    },
    [cashAccountTitles, titlesForCategory]
  )

  const setRowCategory = (id: string, category: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id || r.txType === "invalid" || r.txType === "transfer") return r
        const kind = suggestionKindForRow(r.txType)
        const titles = titlesForCategory(category, kind)
        const keep = titles.some((t) => t.name === r.accountTitle)
        return {
          ...r,
          category,
          accountTitle: keep ? r.accountTitle : titles[0]?.name ?? "",
        }
      })
    )
  }

  const setRowTxType = (id: string, txType: CsvRowTxType) => {
    const target = rows.find((r) => r.id === id)
    if (!target || target.error || target.txType === "invalid" || target.collectionDraft) return
    const allowed = allowedTxTypesForRow(target)
    if (!allowed.includes(txType)) return

    if (txType === "collection") {
      setCollectionLinkPrevType(target.txType === "invalid" ? "income" : target.txType)
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                txType: "collection",
                category: "",
                accountTitle: "",
                collectionDraft: false,
                collectionMemberId: undefined,
                collectionScheduleId: undefined,
              }
            : r
        )
      )
      setCollectionLinkRowId(id)
      return
    }

    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id || r.error || r.txType === "invalid") return r
        return applySuggestionToRow({
          ...r,
          txType,
          collectionDraft: false,
          collectionMemberId: undefined,
          collectionScheduleId: undefined,
        })
      })
    )
  }

  const closeCollectionLinkModal = () => {
    const id = collectionLinkRowId
    const prev = collectionLinkPrevType
    setCollectionLinkRowId(null)
    setCollectionLinkPrevType(null)
    if (!id) return
    setRows((current) =>
      current.map((r) => {
        if (r.id !== id || r.collectionDraft) return r
        if (r.txType !== "collection") return r
        const revertTo = prev && prev !== "collection" ? prev : "income"
        return applySuggestionToRow({ ...r, txType: revertTo })
      })
    )
  }

  const applyCollectionLinkResults = (sourceId: string, lines: CsvCollectionLinkResult[]) => {
    setCollectionLinkRowId(null)
    setCollectionLinkPrevType(null)
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === sourceId)
      if (idx < 0) return prev
      const source = prev[idx]
      const expanded: CsvRowState[] = lines.map((line, i) => ({
        id: `${sourceId}_col_${i}_${Math.random().toString(36).slice(2, 8)}`,
        accountName: source.accountName,
        date: line.date,
        withdrawal: 0,
        deposit: line.amount,
        memo: line.memo,
        category: line.category,
        accountTitle: line.accountTitle,
        txType: "collection",
        error: null,
        collectionDraft: true,
        collectionMemberId: line.memberId,
        collectionScheduleId: line.scheduleId,
      }))
      return [...prev.slice(0, idx), ...expanded, ...prev.slice(idx + 1)]
    })
  }

  const setRowAccountTitle = (id: string, accountTitle: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, accountTitle } : r)))
  }

  const rowRegisterAmount = (r: CsvRowState): number => {
    if (r.deposit !== 0) return r.deposit
    return r.withdrawal
  }

  const registerableRows = useMemo(
    () =>
      rows.filter((r) => {
        if (r.error || r.txType === "invalid") return false
        if (r.txType === "collection") {
          return Boolean(
            r.collectionDraft && r.collectionMemberId && r.collectionScheduleId
          )
        }
        return true
      }),
    [rows]
  )

  const rowIsRegisterReady = (r: CsvRowState): boolean => {
    if (r.error || r.txType === "invalid") return false
    if (r.txType === "collection") {
      return Boolean(
        r.collectionDraft &&
          r.collectionMemberId &&
          r.collectionScheduleId &&
          r.accountTitle &&
          r.date
      )
    }
    if (!r.accountTitle) return false
    if (r.txType === "transfer") {
      return Boolean(r.accountTitle && r.accountTitle !== r.accountName)
    }
    return Boolean(r.category)
  }

  const canRegister =
    registerableRows.length > 0 && registerableRows.every(rowIsRegisterReady)

  const hasPendingCollection = rows.some(
    (r) => r.txType === "collection" && !r.collectionDraft && !r.error
  )

  const collectionLinkRow = collectionLinkRowId
    ? rows.find((r) => r.id === collectionLinkRowId) ?? null
    : null

  const handleBulkRegister = () => {
    if (!canRegister) return
    if (!importSource) {
      alert("取込元ファイルの情報がありません。CSVを再度選択してください。")
      return
    }
    const conflict = findCsvImportConflict(importSource.fileName, importSource.contentHash)
    if (conflict) {
      alert(conflict)
      return
    }

    const outOfBounds = registerableRows.find(
      (r) => rowIsRegisterReady(r) && !isDateWithinFiscalBounds(r.date, fiscalBounds)
    )
    if (outOfBounds) {
      alert(formatFiscalBoundsMessage(fiscalBounds))
      return
    }

    const clubId = getCurrentClub()?.id
    if (clubId) {
      const periodLocked = registerableRows.find(
        (r) => rowIsRegisterReady(r) && isTransactionDateLocked(clubId, r.date)
      )
      if (periodLocked) {
        alert(getSettlementPeriodLockErrorMessage(clubId))
        return
      }
    }

    const partials: Omit<Transaction, "id" | "createdAt" | "csvImportId" | "originalFileName">[] =
      []
    const collectionMeta: {
      memberId: string
      scheduleId: string
      amount: number
      date: string
      memo: string
    }[] = []

    for (const r of registerableRows) {
      if (!rowIsRegisterReady(r)) continue
      const amount = rowRegisterAmount(r)

      if (r.txType === "collection") {
        partials.push({
          date: r.date,
          type: "collection",
          amount,
          counterparty: r.accountName,
          category: r.category || "集金",
          accountTitle: r.accountTitle,
          memo: r.memo || "",
          receiptUrl: null,
          collectionMemberId: r.collectionMemberId,
          collectionScheduleId: r.collectionScheduleId,
          createdBy: currentOperatorName,
        })
        collectionMeta.push({
          memberId: r.collectionMemberId!,
          scheduleId: r.collectionScheduleId!,
          amount,
          date: r.date,
          memo: r.memo || "",
        })
        continue
      }

      if (r.txType === "transfer") {
        partials.push({
          date: r.date,
          type: "transfer",
          amount,
          counterparty: r.accountName,
          category: "共通",
          accountTitle: r.accountTitle,
          memo: r.memo || "",
          receiptUrl: null,
          createdBy: currentOperatorName,
        })
        continue
      }

      const subject = accountTitles.find((t) => t.name === r.accountTitle)
      const categoryToSave = subject?.group === "cash" ? "共通" : r.category
      partials.push({
        date: r.date,
        type: r.txType,
        amount,
        counterparty: r.accountName,
        category: categoryToSave,
        accountTitle: r.accountTitle,
        memo: r.memo || "",
        receiptUrl: null,
        createdBy: currentOperatorName,
      })
    }

    if (partials.length === 0) {
      alert("一括登録できる行がありません。")
      return
    }

    const batch = createCsvImportBatchAndTransactions(importSource, partials)
    const allTxs = getTransactions()
    const createdById = new Map(
      batch.transactionIds
        .map((id) => allTxs.find((t) => t.id === id))
        .filter((t): t is Transaction => Boolean(t))
        .map((t) => [t.id, t])
    )
    const createdOrdered = batch.transactionIds
      .map((id) => createdById.get(id))
      .filter((t): t is Transaction => Boolean(t))

    // 集金ドラフト行: 一括登録時にはじめて実績・paymentHistory を更新
    let collectionPartialIndex = 0
    for (let i = 0; i < partials.length; i++) {
      if (partials[i].type !== "collection") continue
      const meta = collectionMeta[collectionPartialIndex++]
      const tx = createdOrdered[i]
      if (!meta || !tx) continue
      const schedules = getCollectionSchedules()
      const schedule = schedules.find((s) => s.id === meta.scheduleId)
      const rec = getCollectionRecords().find(
        (r) => r.memberId === meta.memberId && r.scheduleId === meta.scheduleId
      )
      if (!schedule || !rec) continue
      const newHistory = [
        ...(rec.paymentHistory ?? []),
        {
          amount: meta.amount,
          date: meta.date,
          memo: meta.memo || tx.memo,
          transactionId: tx.id,
        },
      ]
      const newPaid = sumCollectionRecordNetPaid({ ...rec, paymentHistory: newHistory })
      let status: "UNPAID" | "PARTIALLY_PAID" | "OVERPAID" | "COMPLETED" = "UNPAID"
      if (schedule.amount <= 0) status = newPaid > 0 ? "OVERPAID" : "UNPAID"
      else if (newPaid <= 0) status = "UNPAID"
      else if (newPaid < schedule.amount) status = "PARTIALLY_PAID"
      else if (newPaid > schedule.amount) status = "OVERPAID"
      else status = "COMPLETED"
      updateCollectionRecord(rec.id, {
        paidAmount: newPaid,
        paidAt: meta.date,
        linkedTransactionId: tx.id,
        paymentHistory: newHistory,
        status,
      })
    }

    getTransactions()
    setRows([])
    setParseError(null)
    setImportSource(null)
    onImported()
    alert(`${partials.length} 件を登録しました`)
  }

  return (
    <div className="flex-1 bg-white overflow-y-auto">
      <div className="px-6 py-5 max-w-[min(1600px,100%)] mx-auto space-y-5 w-full">
        <p className="text-xs text-[#6B7280]">
          <strong>手順:</strong> ①現金・預金科目を選択してテンプレートをダウンロード（A1に科目名が入ります）→
          ②「日付・入金額・出金額・摘要」を入力してアップロード → ③区分などを確認して登録。
          区分「集金」はポップアップで割当を「保存」し、最後に「登録する（一括反映）」ではじめて帳簿・集金実績に反映します。UTF-8（BOM付き）CSVで保存してください。
        </p>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[12rem]">
            <label className="block text-xs font-medium text-[#374151] mb-1">
              テンプレート用・現金預金科目 <span className="text-[#EF4444]">*</span>
            </label>
            <select
              value={templateCashAccount}
              onChange={(e) => setTemplateCashAccount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-[#374151] bg-white"
              disabled={cashNamesSorted.length === 0 || registerDisabled}
              aria-label="テンプレート用の現金・預金科目"
            >
              {cashNamesSorted.length === 0 ? (
                <option value="">科目がありません</option>
              ) : (
                cashNamesSorted.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))
              )}
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-[#A3BC68] text-[#374151]"
            onClick={downloadTemplate}
            disabled={!templateCashAccount || registerDisabled}
          >
            テンプレートをダウンロード (CSV)
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            id={uploadId}
            onChange={onFileChange}
          />
          <Button
            type="button"
            style={{ backgroundColor: "#A3BC68" }}
            className="text-white disabled:opacity-40"
            disabled={registerDisabled}
            onClick={() => fileInputRef.current?.click()}
          >
            CSVを選択
          </Button>
        </div>

        {parseError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {parseError}
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="border border-gray-200 rounded-lg overflow-y-auto overflow-x-hidden max-h-[min(72vh,44rem)]">
              <table className="w-full table-fixed text-xs border-collapse">
                <colgroup>
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "16%" }} />
                </colgroup>
                <thead>
                  <tr className="text-[#374151]">
                    <th className="sticky top-0 z-20 bg-gray-50 border border-gray-200 px-2 py-2 text-center shadow-[inset_0_-1px_0_0_#e5e7eb]">
                      #
                    </th>
                    <th className="sticky top-0 z-20 bg-gray-50 border border-gray-200 px-2 py-2 text-center shadow-[inset_0_-1px_0_0_#e5e7eb]">
                      現金・預金口座
                    </th>
                    <th className="sticky top-0 z-20 bg-gray-50 border border-gray-200 px-2 py-2 text-center shadow-[inset_0_-1px_0_0_#e5e7eb]">
                      日付
                    </th>
                    <th className="sticky top-0 z-20 bg-gray-50 border border-gray-200 px-2 py-2 text-center shadow-[inset_0_-1px_0_0_#e5e7eb]">
                      入金額
                    </th>
                    <th className="sticky top-0 z-20 bg-gray-50 border border-gray-200 px-2 py-2 text-center shadow-[inset_0_-1px_0_0_#e5e7eb]">
                      出金額
                    </th>
                    <th className="sticky top-0 z-20 bg-gray-50 border border-gray-200 px-2 py-2 text-center shadow-[inset_0_-1px_0_0_#e5e7eb]">
                      メモ
                    </th>
                    <th className="sticky top-0 z-20 bg-gray-50 border border-gray-200 px-2 py-2 text-center shadow-[inset_0_-1px_0_0_#e5e7eb]">
                      区分
                    </th>
                    <th className="sticky top-0 z-20 bg-gray-50 border border-gray-200 px-2 py-2 text-center shadow-[inset_0_-1px_0_0_#e5e7eb]">
                      カテゴリー
                    </th>
                    <th className="sticky top-0 z-20 bg-gray-50 border border-gray-200 px-2 py-2 text-center shadow-[inset_0_-1px_0_0_#e5e7eb]">
                      科目
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const allowedTypes = allowedTxTypesForRow(r)
                    const titles = r.txType === "invalid" ? [] : titlesForCsvRow(r)
                    const isTransfer = r.txType === "transfer"
                    const isCollectionDone = Boolean(r.collectionDraft)
                    const isCollectionPending = r.txType === "collection" && !isCollectionDone
                    return (
                      <tr key={r.id} className={r.error ? "bg-red-50" : isCollectionDone ? "bg-[#ECF8F2]/60" : ""}>
                        <td className="border border-gray-200 px-2 py-2 text-center">{idx + 1}</td>
                        <td className="border border-gray-200 px-2 py-2 truncate max-w-0" title={r.accountName}>
                          {r.accountName}
                        </td>
                        <td className="border border-gray-200 px-2 py-2 whitespace-nowrap text-center">
                          {r.date || "—"}
                        </td>
                        <td className="border border-gray-200 px-2 py-2 text-right tabular-nums">
                          {r.deposit !== 0 ? formatAmountDisplay(r.deposit) : "—"}
                        </td>
                        <td className="border border-gray-200 px-2 py-2 text-right tabular-nums">
                          {r.withdrawal !== 0 ? formatAmountDisplay(r.withdrawal) : "—"}
                        </td>
                        <td
                          className="border border-gray-200 px-2 py-2 text-[11px] leading-snug break-words whitespace-normal"
                          title={r.memo}
                        >
                          {r.memo || "—"}
                        </td>
                        <td className="border border-gray-200 px-2 py-2 text-center">
                          {r.txType === "invalid" ? (
                            "—"
                          ) : isCollectionDone ? (
                            <div className="text-xs font-medium text-[#3d6b54]">集金（保存済）</div>
                          ) : (
                            <div className="space-y-1">
                              <select
                                className="w-full min-w-0 border border-gray-300 rounded px-1 py-1.5 text-[#374151] text-xs"
                                value={r.txType}
                                onChange={(e) => setRowTxType(r.id, e.target.value as CsvRowTxType)}
                                aria-label="区分"
                              >
                                {allowedTypes.map((k) => (
                                  <option key={k} value={k}>
                                    {CSV_TX_LABEL[k]}
                                  </option>
                                ))}
                              </select>
                              {isCollectionPending && (
                                <button
                                  type="button"
                                  className="w-full text-[10px] text-[#3d6b54] underline"
                                  onClick={() => {
                                    setCollectionLinkPrevType("income")
                                    setCollectionLinkRowId(r.id)
                                  }}
                                >
                                  集金画面を開く
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="border border-gray-200 px-2 py-2">
                          {r.txType === "invalid" ? (
                            "—"
                          ) : isTransfer ? (
                            <div className="w-full border border-gray-200 rounded px-2 py-1.5 text-center text-xs text-[#6B7280] bg-gray-50">
                              選択なし
                            </div>
                          ) : isCollectionDone || isCollectionPending ? (
                            <div className="px-1 py-1 text-xs text-[#374151] break-words">
                              {r.category || (isCollectionPending ? "（集金登録後に確定）" : "—")}
                            </div>
                          ) : (
                            <select
                              className="w-full min-w-0 border border-gray-300 rounded px-2 py-1.5 text-[#374151]"
                              value={r.category}
                              onChange={(e) => setRowCategory(r.id, e.target.value)}
                              aria-label="カテゴリー"
                            >
                              <option value="">選択してください</option>
                              {sortedCategories.map((c) => (
                                <option key={c.id} value={c.name}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="border border-gray-200 px-2 py-2">
                          {r.txType === "invalid" ? (
                            "—"
                          ) : isCollectionDone || isCollectionPending ? (
                            <div className="px-1 py-1 text-xs text-[#374151] break-words">
                              {r.accountTitle || (isCollectionPending ? "（集金登録後に確定）" : "—")}
                            </div>
                          ) : (
                            <select
                              className="w-full min-w-0 border border-gray-300 rounded px-2 py-1.5 text-[#374151]"
                              value={r.accountTitle}
                              onChange={(e) => setRowAccountTitle(r.id, e.target.value)}
                              aria-label="科目"
                            >
                              <option value="">選択してください</option>
                              {titles.map((t) => (
                                <option key={t.id} value={t.name}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {rows.some((r) => r.error) && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                エラー行は一括登録の対象外です。テンプレートを修正するか、該当行を削除してから再アップロードしてください。
              </p>
            )}

            <p className="text-xs text-[#6B7280]">
              摘要・メモからカテゴリー・収支科目を推測した初期値を入れています（集金はポップアップで割当を保存）。誤りがあればプルダウンで修正してください。
              現金・預金口座はCSVの1行目A列の科目名が反映されます。集金の保存済行も、下の「登録する（一括反映）」ではじめて確定します。
            </p>

            {registerableRows.length > 0 ? (
              <Button
                type="button"
                disabled={!canRegister || registerDisabled}
                className="w-full max-w-md py-6 text-base font-semibold text-white rounded-lg disabled:opacity-40"
                style={{ backgroundColor: "#A3BC68" }}
                onClick={handleBulkRegister}
              >
                登録する（一括反映）
              </Button>
            ) : hasPendingCollection ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                区分「集金」の行があります。ポップアップで割当を「保存する」まで完了してください。
              </p>
            ) : null}
          </>
        )}
      </div>

      <CsvCollectionLinkModal
        open={Boolean(collectionLinkRow)}
        onClose={closeCollectionLinkModal}
        cashAccountName={collectionLinkRow?.accountName ?? ""}
        initialDate={collectionLinkRow?.date ?? ""}
        depositAmount={collectionLinkRow?.deposit ?? 0}
        csvMemo={collectionLinkRow?.memo ?? ""}
        minDate={fiscalBounds.minDate}
        maxDate={fiscalBounds.maxDate}
        onRegistered={(lines) => {
          if (collectionLinkRowId) applyCollectionLinkResults(collectionLinkRowId, lines)
        }}
      />
    </div>
  )
}

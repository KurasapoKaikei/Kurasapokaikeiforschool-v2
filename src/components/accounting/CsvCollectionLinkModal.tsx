"use client"

import {
  CollectionIndividualEntry,
  type CollectionIndividualLine,
} from "@/components/accounting/CollectionIndividualEntry"

export type CsvCollectionLinkResult = CollectionIndividualLine

type Props = {
  open: boolean
  onClose: () => void
  cashAccountName: string
  initialDate: string
  depositAmount: number
  csvMemo?: string
  onRegistered: (lines: CsvCollectionLinkResult[]) => void
}

export function CsvCollectionLinkModal({
  open,
  onClose,
  cashAccountName,
  initialDate,
  depositAmount,
  csvMemo = "",
  onRegistered,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-3 flex-shrink-0">
          <div>
            <h3 className="text-base font-semibold text-[#374151]">集金の登録（CSV連携）</h3>
            <p className="text-xs text-[#6B7280] mt-1">
              口座: <span className="font-medium text-[#374151]">{cashAccountName || "—"}</span>
              {"　"}入金日: {initialDate || "—"}
            </p>
          </div>
          <button
            type="button"
            className="text-sm text-[#6B7280] hover:text-[#374151] px-2 py-1"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1">
          <CollectionIndividualEntry
            variant="csv-draft"
            cashAccountName={cashAccountName}
            initialDate={initialDate}
            depositAmount={depositAmount}
            csvMemo={csvMemo}
            submitLabel="保存する"
            onCancel={onClose}
            onSubmit={(lines) => {
              onRegistered(lines)
              onClose()
            }}
          />
        </div>
      </div>
    </div>
  )
}

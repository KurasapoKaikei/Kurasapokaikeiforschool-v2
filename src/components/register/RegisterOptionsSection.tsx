"use client"

import {
  REGISTER_OPTION_DEFINITIONS,
  type RegisterOptionsState,
} from "@/lib/registerPricing"

const checkboxClass =
  "mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-[#005088] focus:ring-[#005088]/30"

type RegisterOptionsSectionProps = {
  options: RegisterOptionsState
  onChange: (next: RegisterOptionsState) => void
}

/** STEP3：有料オプション（チェック連動付き） */
export function RegisterOptionsSection({
  options,
  onChange,
}: RegisterOptionsSectionProps) {
  const handleAuditFlow = (checked: boolean) => {
    onChange({ ...options, auditFlow: checked })
  }

  const handleMemberMypage = (checked: boolean) => {
    if (options.onlinePayment) return
    onChange({ ...options, memberMypage: checked })
  }

  const handleOnlinePayment = (checked: boolean) => {
    onChange({
      ...options,
      onlinePayment: checked,
      memberMypage: checked ? true : options.memberMypage,
    })
  }

  return (
    <fieldset className="space-y-3 rounded-lg border border-gray-200 bg-[#FAFAF9] px-4 py-4">
      <legend className="px-1 text-sm font-semibold text-[#374151]">
        オプション（有料）
      </legend>
      {REGISTER_OPTION_DEFINITIONS.map((def) => {
        const checked = options[def.id]
        const isMypageLocked =
          def.id === "memberMypage" && options.onlinePayment
        const releaseSuffix = def.releaseNote ? (
          <span className="ml-1 text-xs font-normal text-[#9CA3AF]">
            （{def.releaseNote}）
          </span>
        ) : null

        const onToggle =
          def.id === "auditFlow"
            ? handleAuditFlow
            : def.id === "memberMypage"
              ? handleMemberMypage
              : handleOnlinePayment

        return (
          <label
            key={def.id}
            className={`flex cursor-pointer items-start gap-3 rounded-md px-1 py-1 ${
              isMypageLocked ? "cursor-not-allowed opacity-80" : ""
            }`}
          >
            <input
              type="checkbox"
              className={checkboxClass}
              checked={checked}
              disabled={isMypageLocked}
              onChange={(e) => onToggle(e.target.checked)}
            />
            <span className="text-sm leading-relaxed text-[#374151]">
              {def.label}
              {releaseSuffix}
              {def.id === "auditFlow" && def.price > 0 ? (
                <span className="ml-1 text-xs text-[#6B7280]">
                  +¥{def.price.toLocaleString("ja-JP")}/月（税込）
                </span>
              ) : null}
            </span>
          </label>
        )
      })}
      {options.onlinePayment ? (
        <p className="text-xs text-[#6B7280]">
          オンライン決済連携を選択したため、部員マイページ機能は自動で有効になります。
        </p>
      ) : null}
    </fieldset>
  )
}

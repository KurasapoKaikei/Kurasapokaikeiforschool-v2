"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

export type PasswordInputProps = {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
  disabled?: boolean
  className?: string
  inputClassName?: string
  "data-testid"?: string
  /** マウント直後のブラウザ自動入力の見え方を抑え、フォーカス時に入力可能にする */
  deferAutofillUntilFocus?: boolean
  onFocus?: () => void
}

export function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete = "current-password",
  disabled = false,
  className,
  inputClassName,
  "data-testid": dataTestId,
  deferAutofillUntilFocus = false,
  onFocus,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const [editable, setEditable] = useState(!deferAutofillUntilFocus)

  const handleFocus = () => {
    if (deferAutofillUntilFocus) setEditable(true)
    onFocus?.()
  }

  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        name={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onInput={(e) => onChange(e.currentTarget.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        readOnly={deferAutofillUntilFocus && !editable}
        onFocus={handleFocus}
        data-testid={dataTestId}
        className={cn(
          "w-full rounded-lg border border-gray-300 py-2.5 pl-3 pr-11 text-sm focus:border-transparent focus:outline-none focus:ring-2",
          inputClassName
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#6B7280] hover:bg-gray-100 hover:text-[#374151] disabled:opacity-40"
        aria-label={visible ? "パスワードを隠す" : "パスワードを表示"}
      >
        {visible ? (
          <Eye className="h-4 w-4" aria-hidden />
        ) : (
          <EyeOff className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  )
}

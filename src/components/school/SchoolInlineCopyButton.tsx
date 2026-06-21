"use client"

import { useCallback, useState } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

type SchoolInlineCopyButtonProps = {
  value: string
  label: string
  className?: string
}

/** ドラッグ行内のID/PWコピー用（mousedown伝播停止でD&D競合を回避） */
export function SchoolInlineCopyButton({
  value,
  label,
  className,
}: SchoolInlineCopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      try {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        /* クリップボード非対応環境では無視 */
      }
    },
    [value]
  )

  const stopDrag = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <span className={cn("relative inline-flex shrink-0 items-center", className)}>
      <button
        type="button"
        onClick={handleCopy}
        onMouseDown={stopDrag}
        draggable={false}
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-white text-[#374151] hover:bg-gray-50"
        aria-label={`${label}をコピー`}
        title={copied ? "コピーしました" : "コピーする"}
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-600" aria-hidden />
        ) : (
          <Copy className="h-3 w-3" aria-hidden />
        )}
      </button>
      {copied ? (
        <span
          className="pointer-events-none absolute -top-7 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-[#374151] px-2 py-0.5 text-[10px] font-medium text-white shadow-sm"
          role="status"
          aria-live="polite"
        >
          コピーしました
        </span>
      ) : null}
    </span>
  )
}

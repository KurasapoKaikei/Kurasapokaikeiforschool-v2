"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameDay,
  addDays,
  isWithinInterval,
  isValid,
} from "date-fns"
import { ja } from "date-fns/locale/ja"
import { cn } from "@/lib/utils"

export interface DatePickerFieldProps {
  value: string
  onChange: (value: string) => void
  id?: string
  className?: string
  themeColor?: string
  disabled?: boolean
  /** true のとき表示を `yyyy/MM/dd (曜)` 形式にする */
  showWeekday?: boolean
  "aria-label"?: string
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"]

/** YYYY/MM/DD 形式の文字列を yyyy-MM-dd に正規化。無効なら null */
function parseDateInput(input: string): string | null {
  const normalized = input.replace(/[／]/g, "/").replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  )
  const match = normalized.match(/^(\d{4})[\/\-]?(\d{1,2})[\/\-]?(\d{1,2})$/)
  if (!match) return null
  const [, y, m, d] = match
  const year = parseInt(y!, 10)
  const month = parseInt(m!, 10)
  const day = parseInt(d!, 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day)
  if (!isValid(date) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return format(date, "yyyy-MM-dd")
}

/** 入力制限: 半角数字とスラッシュのみ許可 */
function restrictDateInput(value: string): string {
  return value.replace(/[^\d\/]/g, "").replace(/／/g, "/")
}

export function DatePickerField({
  value,
  onChange,
  id,
  className,
  themeColor = "#68A384",
  disabled = false,
  showWeekday = false,
  "aria-label": ariaLabel,
}: DatePickerFieldProps) {
  const [open, setOpen] = React.useState(false)
  const [viewDate, setViewDate] = React.useState(() =>
    value ? new Date(value + "T12:00:00") : new Date()
  )
  const [inputStr, setInputStr] = React.useState("")
  const [isEditing, setIsEditing] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const valueDate = value ? new Date(value + "T12:00:00") : null
  const displayStr = valueDate
    ? format(valueDate, showWeekday ? "yyyy/MM/dd (EEE)" : "yyyy/MM/dd", { locale: ja })
    : ""

  React.useEffect(() => {
    if (value) setViewDate(new Date(value + "T12:00:00"))
  }, [value])

  React.useEffect(() => {
    if (!isEditing) setInputStr(displayStr)
  }, [displayStr, isEditing])

  React.useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const monthStart = startOfMonth(viewDate)
  const monthEnd = endOfMonth(viewDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const days: Date[] = []
  let d = calendarStart
  while (d <= calendarEnd) {
    days.push(d)
    d = addDays(d, 1)
  }

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setViewDate((prev) => subMonths(prev, 1))
  }

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setViewDate((prev) => addMonths(prev, 1))
  }

  const handleSelectDay = (date: Date) => {
    onChange(format(date, "yyyy-MM-dd"))
    setOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = restrictDateInput(e.target.value)
    setInputStr(v)
  }

  const handleInputBlur = () => {
    setIsEditing(false)
    const parsed = parseDateInput(inputStr)
    if (parsed) {
      onChange(parsed)
    } else {
      setInputStr(displayStr)
    }
  }

  const handleInputFocus = () => setIsEditing(true)

  const handleCalendarClick = () => {
    if (!disabled) setOpen((o) => !o)
  }

  return (
    <div ref={containerRef} className="relative inline-block w-full">
      <div className="relative flex">
        <input
          type="text"
          id={id}
          disabled={disabled}
          aria-label={ariaLabel}
          value={isEditing ? inputStr : displayStr}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder="YYYY/MM/DD"
          inputMode="numeric"
          autoComplete="off"
          lang="en"
          className={cn(
            "w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-[#374151] bg-white",
            "focus:outline-none focus:ring-2 focus:border-transparent",
            "hover:border-gray-400 transition-colors",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          style={open ? { boxShadow: "0 0 0 2px " + themeColor } : {}}
        />
        <button
          type="button"
          onClick={handleCalendarClick}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
          aria-label="カレンダーを開く"
        >
          <Calendar className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div
          className="absolute z-50 mt-1 p-3 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[280px]"
          role="dialog"
          aria-modal="true"
          aria-label="日付を選択"
        >
          {/* 月ナビゲーション: ◀ 前月 / 次月 ▶ */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2.5 rounded-md transition-colors flex items-center justify-center min-w-[40px] min-h-[40px] hover:opacity-90 text-xl font-bold"
              style={{ color: themeColor, backgroundColor: "transparent" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = themeColor + "20"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent"
              }}
              aria-label="前月"
            >
              ◀
            </button>
            <span className="text-sm font-semibold text-[#374151]">
              {format(viewDate, "yyyy年M月", { locale: ja })}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2.5 rounded-md transition-colors flex items-center justify-center min-w-[40px] min-h-[40px] hover:opacity-90 text-xl font-bold"
              style={{ color: themeColor, backgroundColor: "transparent" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = themeColor + "20"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent"
              }}
              aria-label="次月"
            >
              ▶
            </button>
          </div>

          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 gap-0.5 mb-1 text-center text-xs text-[#6B7280]">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="py-1 font-medium">
                {label}
              </div>
            ))}
          </div>

          {/* 日付グリッド */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const inMonth = isWithinInterval(day, { start: monthStart, end: monthEnd })
              const isSelected = valueDate && isSameDay(day, valueDate)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => inMonth && handleSelectDay(day)}
                  disabled={!inMonth}
                  className={cn(
                    "w-8 h-8 rounded-md text-sm transition-colors",
                    inMonth
                      ? "hover:bg-gray-100 text-[#374151]"
                      : "text-gray-300 cursor-default",
                    isSelected && "text-white font-semibold"
                  )}
                  style={
                    isSelected
                      ? { backgroundColor: themeColor }
                      : undefined
                  }
                >
                  {format(day, "d")}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

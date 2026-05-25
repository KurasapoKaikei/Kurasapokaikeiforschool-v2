"use client"

import { SCHOOL_BRAND_NAVY } from "@/lib/schoolTheme"

export type RegisterStep = {
  id: number
  label: string
}

export function RegisterStepper({
  steps,
  currentStep,
}: {
  steps: RegisterStep[]
  currentStep: number
}) {
  return (
    <nav className="mb-8" aria-label="申込ステップ">
      <ol className="flex flex-wrap justify-center gap-1 sm:gap-0">
        {steps.map((s, index) => {
          const done = currentStep > s.id
          const active = currentStep === s.id
          return (
            <li
              key={s.id}
              className="flex items-center text-xs sm:text-sm"
            >
              {index > 0 ? (
                <span
                  className={`mx-1 hidden h-px w-6 sm:inline-block sm:w-10 ${
                    done ? "bg-[#005088]" : "bg-gray-200"
                  }`}
                  aria-hidden
                />
              ) : null}
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium sm:px-3 ${
                  active
                    ? "text-white"
                    : done
                      ? "bg-[#E8EEF4] text-[#005088]"
                      : "bg-gray-100 text-[#9CA3AF]"
                }`}
                style={
                  active ? { backgroundColor: SCHOOL_BRAND_NAVY } : undefined
                }
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold sm:h-6 sm:w-6 sm:text-xs ${
                    active
                      ? "bg-white/25"
                      : done
                        ? "bg-[#005088]/15"
                        : "bg-gray-200"
                  }`}
                >
                  {s.id}
                </span>
                <span className="max-w-[4.5rem] truncate sm:max-w-none">
                  {s.label}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * 利用初年度は「初期残高」、年度繰越後の現金預金出納帳は「期首残高」
 */

import { getSystemSettings } from "@/utils/localStorage"

/** システム利用初年度（年度繰越未実施）か */
export function isSystemInitialYear(): boolean {
  if (typeof window === "undefined") return true
  return getSystemSettings().yearRolloverCompletedAt === null
}

/**
 * 現金預金出納帳のオープニング行ラベル。
 * 利用初年度: 初期残高 / 繰越後: 期首残高（前年度からの引継ぎ）
 */
export function getCashLedgerOpeningLabel(): string {
  return isSystemInitialYear() ? "初期残高" : "期首残高"
}

/** 科目別台帳（収入・支出）のオープニング行ラベル（利用初年度のみ表示） */
export function getSubjectLedgerOpeningLabel(): string {
  return "初期残高"
}

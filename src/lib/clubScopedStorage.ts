/**
 * クラブ業務データの localStorage スコープ管理。
 *
 * サッカー部・柔道部など複数クラブが同一ブラウザ（学校共有 PC 等）を使う場合、
 * `classapo_transactions` のような裸のグローバルキーを共有すると帳簿・設定が
 * クラブ間で混在してしまう。本モジュールは、業務データ用ベースキーを
 * 「アクティブなクラブ」単位で `{baseKey}__{clubId}` に分離するための
 * 読み書きヘルパーと、既存グローバルキーからの一回限りの移行処理を提供する。
 *
 * 学校側の正本（学校マスタ・登録クラブ一覧・監査人・共通カテゴリー/科目など）は
 * 対象外（グローバルのまま）。
 */

import { resolveActiveClubSession } from "@/lib/activeClubSession"
import { loadSchoolClubs } from "@/lib/schoolClubs"

/**
 * クラブ単位でスコープする業務データのベースキー一覧。
 * ここに列挙したキーのみ、一回限りの移行処理（レガシーグローバル → アクティブクラブ）の対象になる。
 */
export const CLUB_SCOPED_BASE_KEYS = [
  "classapo_categories",
  "classapo_account_titles",
  "classapo_transactions",
  "classapo_monthly_notes",
  "classapo_collection_schedules",
  "classapo_collection_records",
  "classapo_system_settings",
  "classapo_budget_settings",
  "classapo_csv_import_batches",
  "classapo_club_profile",
  "classapo_current_operator",
  "classapo_report_remarks",
  /** 集金機能データリセット（2026-02-25 実施分）の適用済みマーカー。クラブ単位で管理 */
  "classapo_collection_reset_marker",
  /** CSV 摘要カナと部員の学習データ */
  "classapo_csv_member_kana_hints",
] as const

export type ClubScopedBaseKey = (typeof CLUB_SCOPED_BASE_KEYS)[number]

/** レガシーグローバルキー → アクティブクラブへの移行が完了したかを記録するマーカー */
const MIGRATION_MARKER_KEY = "classapo_club_scope_migration_v1"

/** `{baseKey}__{clubId}` のクラブスコープ済みキーを生成 */
export function clubScopedStorageKey(baseKey: string, clubId: string): string {
  return `${baseKey}__${clubId}`
}

/** 現在操作中のクラブ ID（なりすまし／クラブログイン）。未ログインは null */
export function getActiveClubIdForStorage(): string | null {
  const active = resolveActiveClubSession()
  const id = active?.id?.trim()
  return id ? id : null
}

/** JSON として意味のあるデータを持つか（未設定・空配列・空オブジェクトは「データなし」扱い） */
function hasMeaningfulRawData(raw: string | null): boolean {
  if (raw == null) return false
  const trimmed = raw.trim()
  if (trimmed === "") return false
  if (trimmed === "[]" || trimmed === "{}") return false
  return true
}

/**
 * レガシーグローバルキー（クラブ非スコープ時代のデータ）を、初回発見時のアクティブクラブへ
 * 一回だけ複製する。マーカー設定後は、以後どのクラブに対しても再実行しない
 * （2クラブ目以降は素の空状態から開始する＝クラブ間のデータ共有を防ぐ）。
 */
function migrateLegacyGlobalKeysToClub(clubId: string): void {
  if (typeof window === "undefined") return
  for (const baseKey of CLUB_SCOPED_BASE_KEYS) {
    const scopedKey = clubScopedStorageKey(baseKey, clubId)
    if (hasMeaningfulRawData(localStorage.getItem(scopedKey))) continue
    const legacyRaw = localStorage.getItem(baseKey)
    if (!hasMeaningfulRawData(legacyRaw)) continue
    localStorage.setItem(scopedKey, legacyRaw as string)
  }
  localStorage.setItem(MIGRATION_MARKER_KEY, clubId)
}

function ensureLegacyMigrationApplied(): void {
  if (typeof window === "undefined") return
  if (localStorage.getItem(MIGRATION_MARKER_KEY)) return
  const clubId = getActiveClubIdForStorage()
  if (!clubId) return
  migrateLegacyGlobalKeysToClub(clubId)
}

/**
 * ベースキーに対応する、アクティブクラブ用のスコープ済みキーを返す。
 * - 未移行かつアクティブクラブがあれば、先にレガシーデータの移行を行う
 * - アクティブクラブが無い場合は null（呼び出し側は空既定値／no-op とする）
 */
export function resolveClubDataKey(baseKey: string): string | null {
  ensureLegacyMigrationApplied()
  const clubId = getActiveClubIdForStorage()
  if (!clubId) return null
  return clubScopedStorageKey(baseKey, clubId)
}

export function readClubScopedJson<T>(baseKey: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  const key = resolveClubDataKey(baseKey)
  if (!key) return fallback
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeClubScopedJson<T>(baseKey: string, value: T): void {
  if (typeof window === "undefined") return
  const key = resolveClubDataKey(baseKey)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(value))
}

/** JSON でない生文字列値（現在の作業者名など）用の読み書き */
export function readClubScopedRaw(baseKey: string): string | null {
  if (typeof window === "undefined") return null
  const key = resolveClubDataKey(baseKey)
  if (!key) return null
  return localStorage.getItem(key)
}

export function writeClubScopedRaw(baseKey: string, value: string | null): void {
  if (typeof window === "undefined") return
  const key = resolveClubDataKey(baseKey)
  if (!key) return
  if (value == null) {
    localStorage.removeItem(key)
  } else {
    localStorage.setItem(key, value)
  }
}

/** 学校ポータルからの一括同期用：クラブ ID を指定して直接読み書きする */
export function readClubScopedJsonForClubId<T>(
  baseKey: string,
  clubId: string,
  fallback: T
): T {
  if (typeof window === "undefined") return fallback
  const trimmed = clubId.trim()
  if (!trimmed) return fallback
  const raw = localStorage.getItem(clubScopedStorageKey(baseKey, trimmed))
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeClubScopedJsonForClubId<T>(
  baseKey: string,
  clubId: string,
  value: T
): void {
  if (typeof window === "undefined") return
  const trimmed = clubId.trim()
  if (!trimmed) return
  localStorage.setItem(clubScopedStorageKey(baseKey, trimmed), JSON.stringify(value))
}

/** 学校に登録済みの全クラブ ID（`loadSchoolClubs` 経由） */
export function listAllSchoolClubIds(): string[] {
  return loadSchoolClubs()
    .map((c) => c.id?.trim())
    .filter((id): id is string => Boolean(id))
}

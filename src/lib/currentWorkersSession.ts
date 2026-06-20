/** クラブ作業者宣言セッション（clubId ごとに localStorage 管理） */

export const CURRENT_WORKERS_CHANGED_EVENT =
  "kurasaokaikei-current-workers-changed"

const STORAGE_KEY = "kurasaokaikei-current-workers"

export type CurrentWorkersEntry = {
  workerNames: string[]
  declaredAt: string
}

type CurrentWorkersStore = Record<string, CurrentWorkersEntry>

function readStore(): CurrentWorkersStore {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as CurrentWorkersStore
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store: CurrentWorkersStore): void {
  if (typeof window === "undefined") return
  if (Object.keys(store).length === 0) {
    localStorage.removeItem(STORAGE_KEY)
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  }
  window.dispatchEvent(new Event(CURRENT_WORKERS_CHANGED_EVENT))
}

/** 複数担当者名を履歴表示用ラベル（例: 山田太郎、佐藤花子）に整形 */
export function formatWorkersLabel(names: string[]): string {
  return names.map((s) => s.trim()).filter(Boolean).join("、")
}

export function getCurrentWorkersEntry(
  clubId: string
): CurrentWorkersEntry | null {
  if (!clubId.trim()) return null
  const entry = readStore()[clubId]
  if (!entry || !Array.isArray(entry.workerNames)) return null
  const workerNames = entry.workerNames.map((s) => s.trim()).filter(Boolean)
  if (workerNames.length === 0) return null
  return {
    workerNames,
    declaredAt:
      typeof entry.declaredAt === "string" ? entry.declaredAt : new Date().toISOString(),
  }
}

export function getCurrentWorkers(clubId: string): string[] {
  return getCurrentWorkersEntry(clubId)?.workerNames ?? []
}

export function hasCurrentWorkersSession(clubId: string): boolean {
  return getCurrentWorkers(clubId).length > 0
}

export function setCurrentWorkers(clubId: string, workerNames: string[]): void {
  const id = clubId.trim()
  if (!id) return
  const trimmed = workerNames.map((s) => s.trim()).filter(Boolean)
  const store = readStore()
  if (trimmed.length === 0) {
    if (store[id]) {
      delete store[id]
      writeStore(store)
    }
    return
  }
  store[id] = {
    workerNames: trimmed,
    declaredAt: new Date().toISOString(),
  }
  writeStore(store)
}

export function clearCurrentWorkers(clubId: string): void {
  const id = clubId.trim()
  if (!id) return
  const store = readStore()
  if (!store[id]) return
  delete store[id]
  writeStore(store)
}

/** 登録・編集時に書き込む作業者ラベルを解決（未宣言時は担当者先頭 or 管理者） */
export function resolveWorkerLabelForClub(
  clubId: string,
  staffNames: string[]
): string {
  const declared = getCurrentWorkers(clubId)
  if (declared.length > 0) return formatWorkersLabel(declared)
  const firstStaff = staffNames.map((s) => s.trim()).find(Boolean)
  if (firstStaff) return firstStaff
  return "管理者"
}

import { stripLeadingCsvBom } from "@/utils/csvUtf8"

/** 二重登録判定用：改行・BOM を揃えた上でハッシュする */
export function normalizeCsvTextForHash(text: string): string {
  return stripLeadingCsvBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd()
}

export async function sha256HexFromString(text: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

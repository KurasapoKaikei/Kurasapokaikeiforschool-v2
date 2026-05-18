/** Excel が UTF-8 として認識しやすいよう、CSV 先頭に付与する BOM */
export const CSV_UTF8_BOM = "\uFEFF"

/** ダウンロード用 CSV 本文（BOM なし）の前に BOM を付け、そのまま Blob にする */
export function createUtf8CsvBlob(csvBodyWithoutBom: string): Blob {
  return new Blob([CSV_UTF8_BOM + csvBodyWithoutBom], {
    type: "text/csv;charset=utf-8",
  })
}

/** アップロードされたテキスト先頭の BOM を除去（再保存・Excel 経由でもヘッダー判定が壊れないように） */
export function stripLeadingCsvBom(text: string): string {
  return text.replace(/^\uFEFF/, "")
}

// ユーザー情報のモックデータ（実際にはAPIやコンテキストから取得）
export const mockUserInfo = {
  isForSchool: false, // true の場合、「クラブ設定」がグレーアウト（`role === "SCHOOL"` と同期させること）
  organizationName: "ラグビー部",
  fiscalPeriod: "2026.4.1～2027.3.31",
  staffNames: [] as string[],
}

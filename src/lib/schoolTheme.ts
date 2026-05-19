/** 学校管理者画面のブランドカラー（濃いネイビー・紺基調） */
export const SCHOOL_THEME = {
  navy: "#172554",
  navyLight: "#1e3a8a",
  activeBg: "#eef2ff",
  activeText: "#1e1b4b",
  iconMuted: "#6366f1",
} as const

/** 学校管理画面のブランドネイビー（グループ作成など） */
export const SCHOOL_BRAND_NAVY = "#005088"

/** クラブ画面のブランドピンク（学校ポータルからクラブへ遷移するボタン等） */
export const CLUB_BRAND_PINK = "#E66A84"

export const SCHOOL_DISPLAY_NAME = "東京都市大学"

export const SCHOOL_FISCAL_PERIOD = "2026.8.1～2027.7.31"

/** 5/27デモ用：契約状況画面の固定表示データ */
export const SCHOOL_CONTRACT_DEMO = {
  startDate: "2026年8月1日",
  plan: "クラサポ会計 for School スタンダードプラン",
  registeredClubs: "0 / 30個 （最大30部活まで）",
  fiscalPeriod: "2026.8.1 ～ 2027.7.31",
  annualFee: "¥120,000 (税込)",
  billingMonth: "毎年7月",
  paymentMethod: "銀行振込（年一括）",
  schoolName: "東京都市大学",
  representativeName: "都市 二郎 (トシ ジロウ)",
  postalCode: "158-8557",
  prefecture: "東京都",
  city: "世田谷区",
  addressLine: "玉堤1-28-1",
  phone: "03-5707-0104",
  department: "学生支援課 部活動統括係",
  contactName: "学事 太郎 (ガクジ タロウ)",
  loginId: "tc-university-admin",
  email: "admin@tcu.ac.jp",
  passwordMask: "••••••••••••",
} as const

export const SCHOOL_FISCAL_YEARS = ["2024年度", "2025年度", "2026年度"] as const

export type SchoolFiscalYearLabel = (typeof SCHOOL_FISCAL_YEARS)[number]

export const SCHOOL_PAGE_TITLES = {
  home: "管理者ポータル",
  clubs: "クラブ管理",
  clubList: "クラブ一覧",
  clubGroups: "グループ作成",
  clubRegister: "クラブ登録",
  messages: "お知らせ一覧",
  settings: "設定",
  settingsCategory: "共通カテゴリー設定",
  settingsAccountTitles: "共通科目設定",
  settingsStaff: "担当者設定",
  contract: "契約状況",
  guide: "操作ガイド",
} as const

export const SCHOOL_ROUTES = {
  home: "/school",
  clubList: "/school/clubs",
  clubGroups: "/school/clubs/groups",
  clubRegister: "/school/clubs/register",
  clubsBase: "/school/clubs",
  messages: "/school/messages",
  /** 共通カテゴリー設定（設定のデフォルト子画面） */
  settingsCategory: "/school/settings/category",
  settingsAccountTitles: "/school/settings/account-titles",
  settingsStaff: "/school/settings/staff",
  settingsBase: "/school/settings",
  contract: "/school/contract",
  guide: "/school/guide",
} as const

/** クラブ個別メッセージ（学校⇔クラブ） */
export function schoolClubMessagesPath(clubId: string): string {
  return `${SCHOOL_ROUTES.clubsBase}/${clubId}/messages`
}

export const CLUB_PORTAL_DASHBOARD = "/club/dashboard"

export function isSchoolClubPath(pathname: string): boolean {
  return (
    pathname === SCHOOL_ROUTES.clubList ||
    pathname.startsWith(`${SCHOOL_ROUTES.clubsBase}/`)
  )
}

export function isSchoolSettingsPath(pathname: string): boolean {
  return (
    pathname === SCHOOL_ROUTES.settingsBase ||
    pathname.startsWith(`${SCHOOL_ROUTES.settingsBase}/`)
  )
}

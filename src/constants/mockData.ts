// モックデータ定義

export interface Transaction {
  id: string
  date: string
  type: "INCOME" | "EXPENSE"
  amount: number
  description: string
  accountTitle: string
  receiptUrl: string | null
  isAlert: boolean
  alertReason?: string
}

export interface Member {
  id: string
  name: string
  studentId: string
  email: string
  phone: string
  isActive: boolean
}

export interface CollectionItem {
  id: string
  memberName: string
  amount: number
  dueDate: string
  status: "PENDING" | "COLLECTED" | "OVERDUE"
  collectedAt: string | null
}

export interface BalanceItem {
  accountTitle: string
  amount: number
}

// 取引データ（モック）
export const mockTransactions: Transaction[] = [
  {
    id: "1",
    date: "2025-01-15",
    type: "EXPENSE",
    amount: 5000,
    description: "備品購入",
    accountTitle: "消耗品費",
    receiptUrl: null, // 証憑なし → 赤字表示
    isAlert: true,
    alertReason: "証憑なし",
  },
  {
    id: "2",
    date: "2025-01-14",
    type: "INCOME",
    amount: 10000,
    description: "会費徴収",
    accountTitle: "会費収入",
    receiptUrl: "/receipts/receipt-001.jpg",
    isAlert: false,
  },
  {
    id: "3",
    date: "2025-01-13",
    type: "EXPENSE",
    amount: 30000,
    description: "合宿費",
    accountTitle: "旅費交通費",
    receiptUrl: "/receipts/receipt-002.jpg",
    isAlert: false,
  },
  {
    id: "4",
    date: "2025-01-12",
    type: "EXPENSE",
    amount: 15000,
    description: "練習用具購入",
    accountTitle: "消耗品費",
    receiptUrl: null, // 証憑なし → 赤字表示
    isAlert: true,
    alertReason: "証憑なし",
  },
  {
    id: "5",
    date: "2025-01-11",
    type: "INCOME",
    amount: 50000,
    description: "寄付金",
    accountTitle: "寄付金収入",
    receiptUrl: "/receipts/receipt-003.jpg",
    isAlert: false,
  },
]

// 部員データ（モック）
export const mockMembers: Member[] = [
  {
    id: "1",
    name: "山田 太郎",
    studentId: "2024001",
    email: "yamada@example.com",
    phone: "090-1234-5678",
    isActive: true,
  },
  {
    id: "2",
    name: "佐藤 花子",
    studentId: "2024002",
    email: "sato@example.com",
    phone: "090-2345-6789",
    isActive: true,
  },
  {
    id: "3",
    name: "鈴木 次郎",
    studentId: "2024003",
    email: "suzuki@example.com",
    phone: "090-3456-7890",
    isActive: true,
  },
]

// 集金データ（モック）
export const mockCollectionItems: CollectionItem[] = [
  {
    id: "1",
    memberName: "山田 太郎",
    amount: 5000,
    dueDate: "2025-01-31",
    status: "PENDING",
    collectedAt: null,
  },
  {
    id: "2",
    memberName: "佐藤 花子",
    amount: 5000,
    dueDate: "2025-01-31",
    status: "COLLECTED",
    collectedAt: "2025-01-15",
  },
  {
    id: "3",
    memberName: "鈴木 次郎",
    amount: 5000,
    dueDate: "2025-01-20",
    status: "OVERDUE",
    collectedAt: null,
  },
]

// 残高データ（モック）
export const mockBalances: BalanceItem[] = [
  {
    accountTitle: "メイン銀行",
    amount: 500000,
  },
  {
    accountTitle: "合宿用",
    amount: 200000,
  },
  {
    accountTitle: "現金",
    amount: 50000,
  },
]

// 資産残高データ（モック）
export interface AssetBalance {
  accountTitle: string
  displayName: string // 表示用の分かりやすい名称
  amount: number
}

export const mockAssetBalances: AssetBalance[] = [
  {
    accountTitle: "未収入金",
    displayName: "未収入金", // 正確性を優先
    amount: 100000,
  },
  {
    accountTitle: "仮払金",
    displayName: "仮払金",
    amount: 50000,
  },
]

// 負債残高データ（モック）
export interface LiabilityBalance {
  accountTitle: string
  displayName: string // 表示用の分かりやすい名称
  amount: number
}

export const mockLiabilityBalances: LiabilityBalance[] = [
  {
    accountTitle: "未払金",
    displayName: "未払金",
    amount: 80000,
  },
  {
    accountTitle: "仮受金",
    displayName: "仮受金",
    amount: 30000,
  },
]

// 部員数データ（モック）
export interface MemberCount {
  grade: number
  count: number
}

export const mockMemberCounts: MemberCount[] = [
  { grade: 1, count: 15 },
  { grade: 2, count: 12 },
  { grade: 3, count: 10 },
  { grade: 4, count: 8 },
]

export const mockMemberLastUpdated = "2025-01-15"

// メッセージデータ（モック）
export interface Message {
  id: string
  date: string
  subject: string
  isUnread: boolean
}

export const mockMessages: Message[] = [
  {
    id: "1",
    date: "2025.2.19",
    subject: "会計年度末の決算処理について",
    isUnread: true,
  },
  {
    id: "2",
    date: "2025.2.15",
    subject: "新年度の会費徴収について",
    isUnread: true,
  },
  {
    id: "3",
    date: "2025.2.10",
    subject: "システムメンテナンスのお知らせ",
    isUnread: false,
  },
  {
    id: "4",
    date: "2025.2.5",
    subject: "領収書の提出期限について",
    isUnread: false,
  },
]

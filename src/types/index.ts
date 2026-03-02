export type CollectionPaymentStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "OVERPAID"
  | "COMPLETED"

export const COLLECTION_STATUS_BADGE: Record<
  CollectionPaymentStatus,
  { label: string; className: string }
> = {
  UNPAID: { label: "未入金", className: "bg-red-500 text-white" },
  PARTIALLY_PAID: { label: "一部入金", className: "bg-yellow-400 text-black" },
  // 過入金は一部入金と即判別できるよう、緑系で固定
  OVERPAID: { label: "過入金", className: "bg-emerald-600 text-white" },
  COMPLETED: { label: "入金済", className: "bg-blue-600 text-white" },
}

export function getCollectionPaymentStatus(totalPaid: number, expectedAmount: number): CollectionPaymentStatus {
  if (expectedAmount <= 0) return totalPaid > 0 ? "OVERPAID" : "UNPAID"
  if (totalPaid <= 0) return "UNPAID"
  if (totalPaid < expectedAmount) return "PARTIALLY_PAID"
  if (totalPaid > expectedAmount) return "OVERPAID"
  return "COMPLETED"
}

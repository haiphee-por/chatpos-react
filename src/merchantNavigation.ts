import type { LucideIcon } from 'lucide-react'
import {
  BadgePercent,
  ClipboardList,
  Clock,
  Code,
  CreditCard,
  FileCheck2,
  Globe,
  LayoutDashboard,
  Package,
  QrCode,
  ReceiptText,
  Settings,
  ShieldAlert,
  WalletCards,
} from 'lucide-react'

export type MerchantNavItem = {
  id: string
  label: string
  icon: LucideIcon
  target: string
  permission: 'merchant'
}

export const merchantNavItems: MerchantNavItem[] = [
  { id: 'home', label: 'ภาพรวมร้านค้า', icon: LayoutDashboard, target: '#home', permission: 'merchant' },
  { id: 'pos', label: 'ขายหน้าร้าน (POS)', icon: CreditCard, target: '#pos', permission: 'merchant' },
  { id: 'payment', label: 'คิดเงินด่วน', icon: QrCode, target: '#payment', permission: 'merchant' },
  { id: 'orders', label: 'ออเดอร์', icon: ClipboardList, target: '#orders', permission: 'merchant' },
  { id: 'transactions', label: 'ประวัติธุรกรรม', icon: ReceiptText, target: '#transactions', permission: 'merchant' },
  { id: 'products', label: 'สินค้า / สต็อก', icon: Package, target: '#products', permission: 'merchant' },
  { id: 'services', label: 'บริการ', icon: Clock, target: '#services', permission: 'merchant' },
  { id: 'salespage', label: 'เซลเพจ', icon: Globe, target: '#salespage', permission: 'merchant' },
  { id: 'benefits', label: 'สิทธิพิเศษ', icon: BadgePercent, target: '#benefits', permission: 'merchant' },
  { id: 'reports', label: 'รายงานการเงิน', icon: ReceiptText, target: '#reports', permission: 'merchant' },
  { id: 'wallet', label: 'กระเป๋าเงิน', icon: WalletCards, target: '#wallet', permission: 'merchant' },
  { id: 'billing', label: 'บิล', icon: ReceiptText, target: '#billing', permission: 'merchant' },
  { id: 'stoppay', label: 'STOPPAY', icon: ShieldAlert, target: '#stoppay', permission: 'merchant' },
  { id: 'kyc', label: 'KYC และเอกสาร', icon: FileCheck2, target: '#kyc', permission: 'merchant' },
  { id: 'developer', label: 'โหมดนักพัฒนา', icon: Code, target: '#developer', permission: 'merchant' },
  { id: 'settings', label: 'ตั้งค่าร้านค้า', icon: Settings, target: '#settings', permission: 'merchant' },
]

export function getMerchantNavItem(id: string) {
  return merchantNavItems.find((item) => item.id === id) || merchantNavItems[0]
}

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
  UtensilsCrossed,
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
  { id: 'home', label: 'หน้าหลัก', icon: LayoutDashboard, target: '/merchant/home', permission: 'merchant' },
  { id: 'pos', label: 'ขายหน้าร้าน (POS)', icon: CreditCard, target: '/merchant/pos', permission: 'merchant' },
  { id: 'payment', label: 'คิดเงิน', icon: QrCode, target: '/merchant/payment', permission: 'merchant' },
  { id: 'orders', label: 'สั่งออเดอร์', icon: ClipboardList, target: '/merchant/orders', permission: 'merchant' },
  { id: 'tables', label: 'จัดการโต๊ะ', icon: UtensilsCrossed, target: '/merchant/tables', permission: 'merchant' },
  { id: 'transactions', label: 'ประวัติธุรกรรม', icon: ReceiptText, target: '/merchant/transactions', permission: 'merchant' },
  { id: 'products', label: 'สินค้า / สต็อก', icon: Package, target: '/merchant/products', permission: 'merchant' },
  { id: 'services', label: 'คิวและบริการ', icon: Clock, target: '/merchant/services', permission: 'merchant' },
  { id: 'salespage', label: 'เซลเพจ', icon: Globe, target: '/merchant/salespage', permission: 'merchant' },
  { id: 'benefits', label: 'สิทธิพิเศษ', icon: BadgePercent, target: '/merchant/benefits', permission: 'merchant' },
  { id: 'reports', label: 'รายงานการเงิน', icon: ReceiptText, target: '/merchant/reports', permission: 'merchant' },
  { id: 'wallet', label: 'กระเป๋าเงิน', icon: WalletCards, target: '/merchant/wallet', permission: 'merchant' },
  { id: 'billing', label: 'บิล', icon: ReceiptText, target: '/merchant/billing', permission: 'merchant' },
  { id: 'stoppay', label: 'STOPPAY', icon: ShieldAlert, target: '/merchant/stoppay', permission: 'merchant' },
  { id: 'kyc', label: 'KYC และเอกสาร', icon: FileCheck2, target: '/merchant/kyc', permission: 'merchant' },
  { id: 'developer', label: 'โหมดนักพัฒนา', icon: Code, target: '/merchant/developer', permission: 'merchant' },
  { id: 'settings', label: 'ตั้งค่า', icon: Settings, target: '/merchant/settings', permission: 'merchant' },
]

export const merchantBottomNavIds = ['orders', 'tables', 'home', 'pos', 'settings'] as const

export function isMerchantNavId(id: string): id is MerchantNavItem['id'] {
  return merchantNavItems.some((item) => item.id === id)
}

export function merchantNavIdFromLocation(pathname: string, hash = '') {
  const normalizedPathname = pathname.replace(/\/+$/, '') || '/'
  const routeId = normalizedPathname.startsWith('/merchant/')
    ? normalizedPathname.slice('/merchant/'.length).split('/')[0]
    : ''
  const normalizedHash = hash.replace(/^#/, '').trim()
  const routeMatch = merchantNavItems.some((item) => item.id === routeId) ? routeId : ''
  const hashMatch = merchantNavItems.some((item) => item.id === normalizedHash) ? normalizedHash : ''
  return routeMatch || (normalizedPathname === '/merchant' ? hashMatch : '') || 'home'
}

export function isMerchantBottomNavActive(activeId: string, navId: string) {
  return activeId === navId || (navId === 'pos' && activeId === 'products')
}

export function getMerchantNavItem(id: string) {
  return merchantNavItems.find((item) => item.id === id) || merchantNavItems[0]
}

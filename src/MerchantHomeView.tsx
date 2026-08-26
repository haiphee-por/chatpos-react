import { useEffect, useState } from 'react'
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Home,
  QrCode,
  RefreshCw,
  ShieldAlert,
  WalletCards,
  X,
} from 'lucide-react'
import {
  fetchDbTransactionsResult,
  type AuthUser,
  type DbFetchResult,
  type DbStoreRow,
  type DbTransactionRow,
} from './dbApi'
import { getMerchantNavItem, merchantNavItems, type MerchantNavItem } from './merchantNavigation'

type HomeLanguage = 'th' | 'en' | 'zh'
type LoadStatus = 'loading' | 'ready' | 'empty' | 'error'

export type StoreLoadState = {
  status: LoadStatus
  error: string | null
  fetchedAt: string | null
}

type TransactionLoadState = StoreLoadState

type MerchantHomeProps = {
  onNavigate: (id: string) => void
  storeId: string | null
  selectedStore: DbStoreRow | null
  currentUser: AuthUser | null
  storeState: StoreLoadState
  onRetryStores: () => void
  onOpenProfile: () => void
}

type NotificationCategory = 'orders' | 'finance' | 'kyc'

type HomeNotification = {
  id: string
  category: NotificationCategory
  title: string
  description: string
  timestamp: string
  transactionId?: string
}

const localeByLanguage: Record<HomeLanguage, string> = {
  th: 'th-TH',
  en: 'en-US',
  zh: 'zh-CN',
}

const languageLabels: Record<HomeLanguage, string> = {
  th: 'ไทย',
  en: 'English',
  zh: '中文',
}

function formatMoney(value: number | null, language: HomeLanguage) {
  if (value === null) return '—'
  return new Intl.NumberFormat(localeByLanguage[language], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDateTime(value: string, language: HomeLanguage) {
  return new Intl.DateTimeFormat(localeByLanguage[language], {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function parseAmount(value: string | null | undefined) {
  if (!value) return 0
  const amount = Number.parseFloat(value)
  return Number.isFinite(amount) ? amount : 0
}

function getTodayAmount(transactions: DbTransactionRow[]) {
  const today = new Date()
  return transactions.reduce((total, transaction) => {
    const createdAt = new Date(transaction.createdAt)
    const isToday = createdAt.getFullYear() === today.getFullYear()
      && createdAt.getMonth() === today.getMonth()
      && createdAt.getDate() === today.getDate()
    const isPaid = ['paid', 'success', 'succeeded', 'settled', 'completed'].includes(transaction.status.toLowerCase())
    return isToday && isPaid ? total + parseAmount(transaction.netAmount || transaction.amount) : total
  }, 0)
}

function getLatestTransactionTime(transactions: DbTransactionRow[]) {
  if (!transactions.length) return null
  return transactions.reduce((latest, transaction) => (
    new Date(transaction.createdAt) > new Date(latest.createdAt) ? transaction : latest
  )).createdAt
}

function getNotificationRecords(transactions: DbTransactionRow[], language: HomeLanguage): HomeNotification[] {
  return transactions.slice(0, 5).map((transaction) => ({
    id: `transaction-${transaction.id}`,
    category: 'finance',
    title: language === 'th' ? 'มีรายการรับชำระเงินใหม่' : language === 'zh' ? '收到新的付款记录' : 'New payment received',
    description: `${transaction.reference || transaction.id} · ${formatMoney(parseAmount(transaction.netAmount || transaction.amount), language)}`,
    timestamp: transaction.createdAt,
    transactionId: transaction.id,
  }))
}

function useTransactionData(storeId: string | null) {
  const [transactions, setTransactions] = useState<DbTransactionRow[]>([])
  const [state, setState] = useState<TransactionLoadState>({ status: storeId ? 'loading' : 'empty', error: null, fetchedAt: null })

  const loadTransactions = async () => {
    if (!storeId) {
      setTransactions([])
      setState({ status: 'empty', error: null, fetchedAt: null })
      return
    }

    setState((previous) => ({ ...previous, status: 'loading', error: null }))
    const result: DbFetchResult<DbTransactionRow[]> = await fetchDbTransactionsResult()
    if (result.error) {
      setState((previous) => ({ ...previous, status: previous.fetchedAt ? 'ready' : 'error', error: result.error }))
      return
    }

    setTransactions(result.data)
    setState({ status: result.data.length ? 'ready' : 'empty', error: null, fetchedAt: result.fetchedAt })
  }

  useEffect(() => {
    loadTransactions()
  }, [storeId])

  return { transactions, state, reload: loadTransactions }
}

export function MerchantHome({
  onNavigate,
  storeId,
  selectedStore,
  currentUser,
  storeState,
  onRetryStores,
  onOpenProfile,
}: MerchantHomeProps) {
  const [showBalance, setShowBalance] = useState(true)
  const [language, setLanguage] = useState<HomeLanguage>('th')
  const [now, setNow] = useState(() => new Date())
  const { transactions, state: transactionState, reload: reloadTransactions } = useTransactionData(storeId)
  const notifications = getNotificationRecords(transactions, language)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (storeState.status === 'loading' && !selectedStore) {
    return <HomeLoadingState />
  }

  if (!selectedStore) {
    return (
      <section className="mh-home-state mh-home-state-error" role="alert">
        <ShieldAlert size={28} />
        <h2>ยังไม่พบข้อมูลร้านค้า</h2>
        <p>{storeState.error || 'บัญชีนี้ยังไม่มีร้านค้าที่พร้อมใช้งาน'}</p>
        <button className="mh-state-action" onClick={onRetryStores} type="button">
          <RefreshCw size={16} /> ลองโหลดอีกครั้ง
        </button>
      </section>
    )
  }

  const merchantId = selectedStore.merchantId || selectedStore.id || currentUser?.store?.merchantId || null
  const todayAmount = getTodayAmount(transactions)
  const latestTransactionTime = getLatestTransactionTime(transactions)
  const isStoreOpen = selectedStore.isActive
  const isStale = Boolean(transactionState.error && transactionState.fetchedAt)
  const timeFormatted = now.toLocaleTimeString(localeByLanguage[language], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="merchant-home-view">
      <div className="mh-home-toolbar">
        <div>
          <p className="mh-home-eyebrow">MERCHANT HOME</p>
          <p className="mh-data-note">ข้อมูลร้านค้าและธุรกรรมตามสิทธิ์ของบัญชีที่เข้าสู่ระบบ</p>
        </div>
        <label className="mh-language-control">
          <Globe size={15} />
          <span className="sr-only">ภาษา</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value as HomeLanguage)}>
            {Object.entries(languageLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      {storeState.error && <HomeStaleNotice message={storeState.error} onRetry={onRetryStores} />}
      {transactionState.error && (
        <HomeStaleNotice
          message={isStale ? 'ข้อมูลธุรกรรมล่าสุดอาจไม่สด' : transactionState.error}
          onRetry={reloadTransactions}
        />
      )}

      <MerchantStoreHeader
        store={selectedStore}
        merchantId={merchantId}
        isOpen={isStoreOpen}
        time={timeFormatted}
        language={language}
        onOpenProfile={onOpenProfile}
      />
      <BalanceSummary
        showBalance={showBalance}
        onToggleBalance={() => setShowBalance((value) => !value)}
        todayAmount={todayAmount}
        transactionCount={transactions.length}
        latestTransactionTime={latestTransactionTime}
        language={language}
        isLoading={transactionState.status === 'loading'}
        onNavigate={onNavigate}
      />
      <QuickActions onNavigate={onNavigate} />
      <ManagementList onNavigate={onNavigate} />
      <div className="mh-home-data-footer">
        <span>{transactionState.fetchedAt ? `อัปเดตข้อมูล ${formatDateTime(transactionState.fetchedAt, language)}` : 'ยังไม่มีเวลาซิงค์ข้อมูล'}</span>
        <button className="mh-refresh-button" onClick={reloadTransactions} type="button" disabled={transactionState.status === 'loading'}>
          <RefreshCw size={14} className={transactionState.status === 'loading' ? 'spin' : ''} /> รีเฟรช
        </button>
      </div>
      <NotificationDrawer notifications={notifications} language={language} isLoading={transactionState.status === 'loading'} onNavigate={onNavigate} />
    </div>
  )
}

function HomeLoadingState() {
  return (
    <div className="mh-loading-layout" aria-busy="true" aria-label="กำลังโหลดข้อมูลร้านค้า">
      <div className="mh-skeleton mh-skeleton-header" />
      <div className="mh-skeleton mh-skeleton-balance" />
      <div className="mh-skeleton-grid">
        <div className="mh-skeleton mh-skeleton-card" />
        <div className="mh-skeleton mh-skeleton-card" />
        <div className="mh-skeleton mh-skeleton-card" />
      </div>
      <div className="mh-skeleton mh-skeleton-list" />
    </div>
  )
}

function HomeStaleNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mh-stale-notice" role="status">
      <span><ShieldAlert size={15} /> {message}</span>
      <button onClick={onRetry} type="button"><RefreshCw size={14} /> ลองใหม่</button>
    </div>
  )
}

function MerchantStoreHeader({
  store,
  merchantId,
  isOpen,
  time,
  language,
  onOpenProfile,
}: {
  store: DbStoreRow
  merchantId: string | null
  isOpen: boolean
  time: string
  language: HomeLanguage
  onOpenProfile: () => void
}) {
  const [copied, setCopied] = useState(false)
  const storeName = store.name || 'ร้านค้าของคุณ'
  const branchLabel = store.storeType === 'MAIN' ? 'สาขาหลัก' : store.storeType ? `สาขา${store.storeType}` : 'สาขาหลัก'
  const statusLabel = isOpen ? (language === 'th' ? 'เปิดให้บริการ' : language === 'zh' ? '营业中' : 'Open') : (language === 'th' ? 'ปิดให้บริการ' : language === 'zh' ? '暂停营业' : 'Closed')

  const copyMerchantId = async () => {
    if (!merchantId) return
    try {
      await navigator.clipboard?.writeText(merchantId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className={`mh-store-card ${!isOpen ? 'is-closed' : ''}`}>
      <div className="mh-store-info">
        <div className="mh-status-row">
          <span className="mh-status-pill"><span className="pulse-dot" /> {statusLabel}</span>
          <span className="mh-time-pill"><Clock size={12} /> {time}</span>
        </div>
        <div className="mh-title-row">
          <h2 className="mh-store-name">{storeName}</h2>
          <button className="mh-store-badge-btn" onClick={onOpenProfile} type="button">จัดการร้านค้า <ChevronRight size={13} /></button>
        </div>
        <button className="mh-merchant-id-pill" onClick={copyMerchantId} type="button" disabled={!merchantId}>
          <span>{merchantId ? `Merchant ID : ${merchantId}` : 'ยังไม่มี Merchant ID'}</span>
          {merchantId && (copied ? <CheckCircle2 size={13} /> : <Copy size={12} />)}
          {copied && <small className="copied-tooltip">คัดลอกแล้ว</small>}
        </button>
      </div>
      <div className="mh-store-mascot">
        <img src="/mascot/nabtang_welcome.png" className="mh-store-mascot-img" alt="น้องนับตังค์ ChatPOS" />
      </div>
    </section>
  )
}

function BalanceSummary({
  showBalance,
  onToggleBalance,
  todayAmount,
  transactionCount,
  latestTransactionTime,
  language,
  isLoading,
  onNavigate,
}: {
  showBalance: boolean
  onToggleBalance: () => void
  todayAmount: number
  transactionCount: number
  latestTransactionTime: string | null
  language: HomeLanguage
  isLoading: boolean
  onNavigate: (id: string) => void
}) {
  return (
    <section className="mh-balance-card">
      <div className="mh-balance-header">
        <div className="mh-balance-title">
          <span>ยอดเงินทั้งหมด</span>
          <button aria-label={showBalance ? 'ซ่อนยอดเงิน' : 'แสดงยอดเงิน'} className="mh-eye-toggle" onClick={onToggleBalance} type="button">
            {showBalance ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>
        <div className="mh-balance-mascot-graphic" aria-hidden="true"><span className="money-bag-emoji">💰</span></div>
      </div>
      <button className="mh-main-amount mh-main-amount-tappable" onClick={onToggleBalance} type="button">
        ฿ {showBalance ? '—' : '•••.••'}
      </button>
      <p className="mh-balance-unavailable">ยอดคงเหลือต้องมาจาก Home API ที่ได้รับการอนุมัติ ยังไม่มีข้อมูลจากระบบ</p>
      <div className="mh-balance-sub-grid">
        <div className="mh-sub-card mh-sub-green">
          <div className="mh-sub-info"><span>ยอดรับวันนี้</span><strong>{isLoading ? 'กำลังโหลด' : `฿ ${showBalance ? formatMoney(todayAmount, language) : '•••'}`}</strong></div>
          <button className="mh-sub-link" onClick={() => onNavigate('transactions')} type="button">ดูธุรกรรม <ChevronRight size={13} /></button>
        </div>
        <div className="mh-sub-card mh-sub-blue">
          <div className="mh-sub-info"><span>ธุรกรรมที่โหลดได้</span><strong>{isLoading ? 'กำลังโหลด' : (showBalance ? transactionCount : '•••')}</strong></div>
          <span className="mh-sub-meta">{latestTransactionTime ? `ล่าสุด ${formatDateTime(latestTransactionTime, language)}` : 'ยังไม่มีข้อมูล'}</span>
        </div>
      </div>
    </section>
  )
}

const quickActionIds = ['pos', 'wallet', 'stoppay', 'transactions', 'benefits']
const quickActionImages: Record<string, string> = {
  pos: '/mascot/pay_3_holding_credit_card.png',
  wallet: '/mascot/pay_5_wallet.png',
  stoppay: '/mascot/kyc_8_holding_shield.png',
  transactions: '/mascot/trans_3_viewing_history.png',
  benefits: '/mascot/nabtang_celebrating.png',
}

function QuickActions({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <section className="mh-app-grid" aria-label="ทางลัดร้านค้า">
      {quickActionIds.map((id) => {
        const item = getMerchantNavItem(id)
        const Icon = item.icon
        return (
          <button className={`mh-app-card mh-app-${id}`} key={id} onClick={() => onNavigate(item.id)} type="button">
            <span className="mh-app-icon-wrap"><Icon size={24} /></span>
            <strong>{item.label}</strong>
            <img className="mh-app-mascot-img" src={quickActionImages[id]} alt="" />
          </button>
        )
      })}
    </section>
  )
}

const managementIds = ['products', 'services', 'reports', 'salespage', 'settings', 'billing']

function ManagementList({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <section className="mh-mgmt-section">
      <h3 className="mh-mgmt-heading">ระบบจัดการร้านค้า</h3>
      <div className="mh-mgmt-list">
        {managementIds.map((id) => {
          const item = getMerchantNavItem(id)
          const Icon = item.icon
          const descriptions: Record<string, string> = {
            products: 'จัดการสินค้าในคลัง ยอดคงเหลือ และการเตือนสต็อกต่ำ',
            services: 'จัดการบริการ คิวคุมเวลา และประวัติรายการชำระแล้ว',
            reports: 'รายงานสรุปยอดขาย กำไร และสถิติวิเคราะห์เชิงลึก',
            salespage: 'ลิงก์สั่งซื้อออนไลน์สำหรับลูกค้า และหน้าร้านค้าเซลเพจ',
            settings: 'ตั้งค่าร้านค้า ทีมงาน อุปกรณ์ และสิทธิ์การใช้งาน',
            billing: 'ตรวจสอบบิล ค่าบริการแพลตฟอร์ม และรอบเคลียร์ริ่ง',
          }
          return (
            <button className="mh-mgmt-item" key={id} onClick={() => onNavigate(item.id)} type="button">
              <span className="mh-mgmt-icon-wrap"><Icon size={22} /></span>
              <span className="mh-mgmt-text"><strong>{item.label}</strong><span>{descriptions[id]}</span></span>
              <ChevronRight className="mh-mgmt-arrow" size={18} />
            </button>
          )
        })}
      </div>
    </section>
  )
}

function NotificationDrawer({
  notifications,
  language,
  isLoading,
  onNavigate,
}: {
  notifications: HomeNotification[]
  language: HomeLanguage
  isLoading: boolean
  onNavigate: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | NotificationCategory>('all')
  const [readIds, setReadIds] = useState<string[]>([])
  const unreadCount = notifications.filter((item) => !readIds.includes(item.id)).length
  const visibleNotifications = filter === 'all' ? notifications : notifications.filter((item) => item.category === filter)
  const filterLabels: Array<{ id: 'all' | NotificationCategory; label: string }> = [
    { id: 'all', label: `ทั้งหมด (${notifications.length})` },
    { id: 'finance', label: `การเงิน (${notifications.filter((item) => item.category === 'finance').length})` },
    { id: 'orders', label: `ออเดอร์ (${notifications.filter((item) => item.category === 'orders').length})` },
    { id: 'kyc', label: `KYC (${notifications.filter((item) => item.category === 'kyc').length})` },
  ]

  const markAllRead = () => setReadIds(notifications.map((item) => item.id))
  const markRead = (id: string) => setReadIds((current) => current.includes(id) ? current : [...current, id])

  return (
    <>
      <button className="mh-notification-trigger" onClick={() => setOpen(true)} type="button" aria-label="เปิดการแจ้งเตือน">
        <Bell size={16} />
        {unreadCount > 0 && <b>{unreadCount}</b>}
      </button>
      {open && (
        <div className="mn-fullscreen-overlay">
          <button className="mn-fullscreen-backdrop" aria-label="ปิดการแจ้งเตือน" onClick={() => setOpen(false)} type="button" />
          <section className="mn-fullscreen-card" aria-label="ศูนย์แจ้งเตือน" aria-modal="true" role="dialog">
            <div className="mn-header">
              <div className="mn-header-left"><div className="mn-bell-wrap"><Bell size={22} color="#ffffff" /></div><div><h2>ศูนย์แจ้งเตือนร้านค้า</h2><p>{notifications.length ? 'รายการแจ้งเตือนจากข้อมูลธุรกรรมที่โหลดได้' : 'ยังไม่มี Notification API หรือรายการแจ้งเตือนสำหรับร้านค้านี้'}</p></div></div>
              <button className="mn-close-btn" onClick={() => setOpen(false)} type="button" aria-label="ปิดการแจ้งเตือน"><X size={20} /></button>
            </div>
            <div className="mn-filter-bar">
              {filterLabels.map((item) => <button className={`mn-filter-tab ${filter === item.id ? 'active' : ''}`} key={item.id} onClick={() => setFilter(item.id)} type="button">{item.label}</button>)}
            </div>
            <div className="mn-list">
              {isLoading ? <div className="mn-loading" aria-busy="true"><RefreshCw size={22} className="spin" /><span>กำลังโหลดการแจ้งเตือน</span></div> : visibleNotifications.length ? visibleNotifications.map((item) => {
                const isRead = readIds.includes(item.id)
                return (
                  <button className={`mn-item ${isRead ? '' : 'unread'}`} key={item.id} onClick={() => { markRead(item.id); if (item.transactionId) onNavigate('transactions') }} type="button">
                    <div className="mn-item-icon blue"><WalletCards size={22} /></div>
                    <div className="mn-item-body"><div className="mn-item-top"><strong>{item.title}</strong><span className="mn-time">{formatDateTime(item.timestamp, language)}</span></div><p>{item.description}</p><span className="mn-tag blue">การเงิน</span></div>
                    {!isRead && <span className="mn-unread-dot" />}
                  </button>
                )
              }) : <div className="mn-empty"><Bell size={28} /><strong>ไม่มีรายการแจ้งเตือน</strong><span>เมื่อมีข้อมูลจากระบบ รายการจะแสดงในหน้านี้</span></div>}
            </div>
            <div className="mn-footer"><button className="mn-footer-action" onClick={markAllRead} type="button" disabled={!unreadCount}><CheckCircle2 size={16} /> ทำเครื่องหมายอ่านแล้วทั้งหมด</button><button className="mn-footer-close" onClick={() => setOpen(false)} type="button">ปิดหน้าต่างแจ้งเตือน</button></div>
          </section>
        </div>
      )}
    </>
  )
}

export function MerchantBottomNavigation({ active, onNavigate }: { active: string; onNavigate: (id: string) => void }) {
  const bottomIds = ['orders', 'services', 'home', 'payment', 'salespage', 'settings']
  const items = bottomIds.map((id) => getMerchantNavItem(id))
  const renderItem = (item: MerchantNavItem, className = '') => {
    const Icon = item.icon
    return <button className={`mh-bottom-item ${className} ${active === item.id ? 'active' : ''}`} key={item.id} onClick={() => onNavigate(item.id)} type="button"><Icon size={18} /><span>{item.label}</span></button>
  }

  return (
    <nav className="mh-global-bottom-bar" aria-label="เมนูร้านค้าบนมือถือ">
      {renderItem(items[0])}
      {renderItem(items[1])}
      <div className="mh-bottom-center-group">{renderItem({ ...items[2], icon: Home }, 'mh-bottom-home-btn')}{renderItem({ ...items[3], icon: QrCode }, 'mh-bottom-pay-btn')}</div>
      {renderItem(items[4])}
      {renderItem(items[5])}
    </nav>
  )
}

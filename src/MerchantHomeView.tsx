import { useEffect, useState } from 'react'
import {
  Bell,
  CheckCircle2,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Copy,
  Home,
  QrCode,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  User,
  WalletCards,
  X,
} from 'lucide-react'
import {
  fetchDbHomeResult,
  fetchDbNotificationsResult,
  markAllDbNotificationsRead,
  markDbNotificationRead,
  type AuthUser,
  type DbFetchResult,
  type DbHomeReadModel,
  type DbNotificationRow,
  type DbStoreRow,
} from './dbApi'
import { getMerchantNavItem, merchantNavItems, type MerchantNavItem } from './merchantNavigation'

type HomeLanguage = 'th' | 'en' | 'zh'
type LoadStatus = 'loading' | 'ready' | 'empty' | 'error'

export type StoreLoadState = {
  status: LoadStatus
  error: string | null
  fetchedAt: string | null
}

type HomeLoadState = StoreLoadState

type MerchantHomeProps = {
  onNavigate: (id: string) => void
  storeId: string | null
  selectedStore: DbStoreRow | null
  currentUser: AuthUser | null
  availableStores: DbStoreRow[]
  storeState: StoreLoadState
  onStoreChange: (storeId: string) => void
  onRetryStores: () => void
  onOpenProfile: () => void
}

type NotificationCategory = 'orders' | 'finance' | 'kyc' | 'system'

const localeByLanguage: Record<HomeLanguage, string> = {
  th: 'th-TH',
  en: 'en-US',
  zh: 'zh-CN',
}

function formatMoney(value: string | number | null, language: HomeLanguage) {
  if (value === null || value === undefined || value === '') return '—'
  const numericValue = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(numericValue)) return '—'
  return new Intl.NumberFormat(localeByLanguage[language], {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericValue)
}

function formatDateTime(value: string, language: HomeLanguage) {
  return new Intl.DateTimeFormat(localeByLanguage[language], {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function useHomeData(storeId: string | null) {
  const [home, setHome] = useState<DbHomeReadModel | null>(null)
  const [state, setState] = useState<HomeLoadState>({ status: storeId ? 'loading' : 'empty', error: null, fetchedAt: null })

  const loadHome = async () => {
    if (!storeId) {
      setHome(null)
      setState({ status: 'empty', error: null, fetchedAt: null })
      return
    }

    setState((previous) => ({ ...previous, status: 'loading', error: null }))
    const result: DbFetchResult<DbHomeReadModel | null> = await fetchDbHomeResult(storeId)
    if (result.error) {
      setState((previous) => ({ ...previous, status: previous.fetchedAt ? 'ready' : 'error', error: result.error }))
      return
    }

    setHome(result.data)
    setState({ status: result.data ? 'ready' : 'empty', error: null, fetchedAt: result.fetchedAt })
  }

  useEffect(() => {
    loadHome()
  }, [storeId])

  return { home, state, reload: loadHome }
}

function useNotificationData(storeId: string | null) {
  const [notifications, setNotifications] = useState<DbNotificationRow[]>([])
  const [state, setState] = useState<StoreLoadState>({ status: storeId ? 'loading' : 'empty', error: null, fetchedAt: null })

  const loadNotifications = async () => {
    if (!storeId) {
      setNotifications([])
      setState({ status: 'empty', error: null, fetchedAt: null })
      return
    }

    setState((previous) => ({ ...previous, status: 'loading', error: null }))
    const result = await fetchDbNotificationsResult(storeId, { limit: 50 })
    if (result.error) {
      setState((previous) => ({ ...previous, status: previous.fetchedAt ? 'ready' : 'error', error: result.error }))
      return
    }

    setNotifications(result.data)
    setState({ status: result.data.length ? 'ready' : 'empty', error: null, fetchedAt: result.fetchedAt })
  }

  useEffect(() => {
    loadNotifications()
  }, [storeId])

  return { notifications, state, reload: loadNotifications }
}

export function MerchantHome({
  onNavigate,
  storeId,
  selectedStore,
  currentUser,
  availableStores,
  storeState,
  onStoreChange,
  onRetryStores,
  onOpenProfile,
}: MerchantHomeProps) {
  const language: HomeLanguage = 'th'
  const [now, setNow] = useState(() => new Date())
  const { home, state: homeState, reload: reloadHome } = useHomeData(storeId)
  const { notifications, state: notificationState, reload: reloadNotifications } = useNotificationData(storeId)

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

  const displayStore = home?.store || selectedStore
  const merchantId = displayStore.merchantId || currentUser?.store?.merchantId || null
  const isStale = Boolean(homeState.error && homeState.fetchedAt)
  const timeFormatted = formatClock(now, language, displayStore.timezone)
  const unreadNotificationCount = home?.unreadNotificationCount ?? notifications.filter((item) => !item.readAt).length

  return (
    <div className="merchant-home-view">
      <HomeStatusBar time={timeFormatted} />
      <div className="mh-top-zone">
        <HomeHeader
          unreadCount={unreadNotificationCount}
          notifications={notifications}
          notificationState={notificationState}
          storeId={storeId}
          language={language}
          onReloadNotifications={reloadNotifications}
          onNavigate={onNavigate}
          onOpenProfile={onOpenProfile}
        />
        <MerchantStoreHeader store={displayStore} availableStores={availableStores} onStoreChange={onStoreChange} />
        <PaymentHero
          count={home?.summary.todayTransactionCount ?? null}
          isLoading={homeState.status === 'loading'}
          isStoreOpen={displayStore.isActive}
          onNavigate={onNavigate}
        />
        <MerchantIdentityStrip store={displayStore} merchantId={merchantId} time={timeFormatted} />
      </div>
      <div className="mh-content-zone">
        <HomeSummary summary={home?.summary || null} isLoading={homeState.status === 'loading'} />
        <MainMenu home={home} onNavigate={onNavigate} />
        <BenefitsAction enabled={home?.capabilities.canUseBenefits ?? false} onNavigate={onNavigate} />
        <SystemStatus homeState={homeState} notificationState={notificationState} />
        <ManagementList onNavigate={onNavigate} />
        <div className="mh-home-data-footer">
          <span>{homeState.error ? (isStale ? 'ข้อมูลหน้าหลักล่าสุดอาจไม่สด' : homeState.error) : homeState.fetchedAt ? `อัปเดตข้อมูล ${formatDateTime(homeState.fetchedAt, language)}` : 'ยังไม่มีเวลาซิงค์ข้อมูล'}</span>
          <button className="mh-refresh-button" onClick={reloadHome} type="button" disabled={homeState.status === 'loading'}>
            <RefreshCw size={14} className={homeState.status === 'loading' ? 'spin' : ''} /> รีเฟรช
          </button>
        </div>
        {storeState.error && <HomeStaleNotice message={storeState.error} onRetry={onRetryStores} />}
      </div>
    </div>
  )
}

function formatClock(value: Date, language: HomeLanguage, timeZone?: string) {
  try {
    return new Intl.DateTimeFormat(localeByLanguage[language], {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timeZone || undefined,
    }).format(value)
  } catch {
    return value.toLocaleTimeString(localeByLanguage[language], { hour: '2-digit', minute: '2-digit' })
  }
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

function HomeStatusBar({ time }: { time: string }) {
  return (
    <div className="mh-status-bar" aria-label="สถานะอุปกรณ์">
      <strong>{time}</strong>
      <span>5G&nbsp; ▮▮▮ &nbsp;71%</span>
    </div>
  )
}

function HomeHeader({
  unreadCount,
  notifications,
  notificationState,
  storeId,
  language,
  onReloadNotifications,
  onNavigate,
  onOpenProfile,
}: {
  unreadCount: number
  notifications: DbNotificationRow[]
  notificationState: StoreLoadState
  storeId: string | null
  language: HomeLanguage
  onReloadNotifications: () => void
  onNavigate: (id: string) => void
  onOpenProfile: () => void
}) {
  return (
    <header className="mh-reference-header">
      <button className="mh-brand-lockup" onClick={() => onNavigate('home')} type="button" aria-label="ChatPOS เวอร์ชัน 2">
        <img src="/logo.png" alt="" />
        <span>ChatPOS</span>
        <small>v2</small>
      </button>
      <div className="mh-header-actions">
        <NotificationDrawer
          notifications={notifications}
          initialUnreadCount={unreadCount}
          language={language}
          isLoading={notificationState.status === 'loading'}
          error={notificationState.error}
          storeId={storeId}
          onReload={onReloadNotifications}
          onNavigate={onNavigate}
        />
        <button className="mh-profile-button" onClick={onOpenProfile} type="button" aria-label="โปรไฟล์ร้านค้า">
          <User size={19} />
        </button>
      </div>
    </header>
  )
}

function MerchantStoreHeader({
  store,
  availableStores,
  onStoreChange,
}: {
  store: DbStoreRow
  availableStores: DbStoreRow[]
  onStoreChange: (storeId: string) => void
}) {
  const storeName = store.name || 'ร้านค้าของคุณ'

  return (
    <div className="mh-store-selector">
      <span className="mh-store-selector-icon"><Store size={20} /></span>
      <span className="mh-store-selector-copy">
        <span>ร้านที่กำลังใช้งาน</span>
        {availableStores.length > 1 ? (
          <select value={store.id} onChange={(event) => onStoreChange(event.target.value)} aria-label={`ร้านที่กำลังใช้งาน ${storeName}`}>
            {availableStores.map((availableStore) => <option key={availableStore.id} value={availableStore.id}>{availableStore.name}</option>)}
          </select>
        ) : (
          <strong>{storeName}</strong>
        )}
      </span>
      <ChevronDown size={19} aria-hidden="true" />
    </div>
  )
}

function PaymentHero({ count, isLoading, isStoreOpen, onNavigate }: { count: number | null; isLoading: boolean; isStoreOpen: boolean; onNavigate: (id: string) => void }) {
  return (
    <article className="mh-payment-card">
      <div className="mh-pos-screen">
        <div className="mh-payment-copy">
          <p>เครื่อง POS ออนไลน์</p>
          <h1>พร้อมรับชำระ</h1>
          <span>รับเงินเข้าร้านได้ทันที ทุกช่องทาง</span>
        </div>
        <img className="mh-payment-mascot" src="/mascot/pay_9_tap_to_pay.png" alt="" />
        <div className="mh-payment-actions">
          <button className="mh-payment-action mh-payment-qr" onClick={() => onNavigate('payment')} type="button">
            <QrCode size={24} />
            <strong>สร้าง QR<small>พร้อมเพย์และโมบายแบงก์กิ้ง</small></strong>
          </button>
          <button className="mh-payment-action mh-payment-card-action" onClick={() => onNavigate('payment')} type="button">
            <CreditCard size={24} />
            <strong>รับผ่านบัตร<small>แตะ · รูด · ชำระออนไลน์</small></strong>
          </button>
        </div>
        <div className="mh-payment-channels" aria-label="ช่องทางรับชำระที่พร้อมใช้งาน">
          <span><Check size={12} /> QR พร้อมเพย์</span>
          <span><Check size={12} /> บัตรเครดิต</span>
          <span><Check size={12} /> Mobile Banking</span>
        </div>
      </div>
      <div className="mh-pos-drawer">
        <UsageStrip count={count} isLoading={isLoading} isStoreOpen={isStoreOpen} />
      </div>
    </article>
  )
}

function UsageStrip({ count, isLoading, isStoreOpen }: { count: number | null; isLoading: boolean; isStoreOpen: boolean }) {
  return (
    <div className="mh-usage-strip" aria-label={`ใช้งานวันนี้ ${count ?? 'ยังไม่มีข้อมูล'} รายการ ${isStoreOpen ? 'ลิ้นชักพร้อมใช้งาน' : 'ร้านค้าปิดให้บริการ'}`}>
      <div className="mh-usage-count">
        <ReceiptText size={18} />
        <span><small>ใช้งานวันนี้</small><strong>{isLoading ? '—' : count ?? '—'}<em>รายการ</em></strong></span>
      </div>
      <span className={isStoreOpen ? '' : 'is-unavailable'}><CheckCircle2 size={15} /> {isStoreOpen ? 'ลิ้นชักพร้อมใช้งาน' : 'ร้านค้าปิดให้บริการ'}</span>
    </div>
  )
}

function MerchantIdentityStrip({ store, merchantId, time }: { store: DbStoreRow; merchantId: string | null; time: string }) {
  const [copied, setCopied] = useState(false)

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
    <div className="mh-merchant-strip">
      <span className="mh-merchant-store"><Store size={15} /> {store.name || 'ร้านค้าของคุณ'}</span>
      <button className="mh-merchant-id" onClick={copyMerchantId} type="button" disabled={!merchantId}>
        {merchantId ? `Merchant ID · ${merchantId}` : 'Merchant ID · —'}
        {merchantId && (copied ? <CheckCircle2 size={12} /> : <Copy size={11} />)}
        {copied && <small className="copied-tooltip">คัดลอกแล้ว</small>}
      </button>
      <time dateTime={new Date().toISOString()}>{time}</time>
    </div>
  )
}

function HomeSummary({ summary, isLoading }: { summary: DbHomeReadModel['summary'] | null; isLoading: boolean }) {
  return (
    <section className="mh-summary-strip" aria-label="สรุปยอดวันนี้">
      <div className="mh-summary-item mh-summary-green">
        <WalletCards size={20} />
        <p><span>ยอดรับวันนี้</span><strong>{isLoading ? '—' : formatMoney(summary?.receivedToday ?? null, 'th')}</strong><small>บาท</small></p>
      </div>
      <div className="mh-summary-item mh-summary-blue">
        <WalletCards size={20} />
        <p><span>เงินพร้อมถอน</span><strong>{isLoading ? '—' : formatMoney(summary?.availableToWithdraw ?? null, 'th')}</strong><small>บาท</small></p>
      </div>
    </section>
  )
}

const mainMenuDefinitions = [
  { id: 'pos', label: 'POS', description: 'ขายหน้าร้านและจัดการออเดอร์', image: '/mascot/menu_pay.png' },
  { id: 'wallet', label: 'บัญชีฉัน', description: 'ดูยอดเงินและบัญชีรับเงิน', image: '/mascot/menu_withdraw.png' },
  { id: 'stoppay', label: 'Stop Pay', description: 'ตรวจสอบและระงับการจ่าย', image: '/mascot/menu_stoppay.png' },
  { id: 'transactions', label: 'ประวัติธุรกรรม', description: 'ดูรายการรับชำระย้อนหลัง', image: '/mascot/menu_transactions.png' },
]

function MainMenu({ home, onNavigate }: { home: DbHomeReadModel | null; onNavigate: (id: string) => void }) {
  const isEnabled = (id: string) => {
    if (id === 'pos' || id === 'wallet') return true
    if (!home) return false
    if (id === 'stoppay') return home.capabilities.canUseStopPay
    return home.capabilities.canViewTransactions
  }

  return (
    <section className="mh-menu-section" aria-label="เมนูหลัก">
      <div className="mh-section-heading">
        <div><span>บริการของร้าน</span><h2>เมนูหลัก</h2></div>
        <img src="/mascot/nabtang_pointing.png" alt="" />
      </div>
      <div className="mh-feature-grid">
        {mainMenuDefinitions.map((item) => (
          <button className={`mh-feature-card mh-feature-${item.id} ${isEnabled(item.id) ? '' : 'is-disabled'}`} key={item.id} onClick={() => onNavigate(item.id)} type="button" disabled={!isEnabled(item.id)}>
            <span className="mh-feature-art"><img src={item.image} alt="" /></span>
            <span className="mh-feature-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  )
}

function BenefitsAction({ enabled, onNavigate }: { enabled: boolean; onNavigate: (id: string) => void }) {
  return (
    <button className={`mh-benefits-card ${enabled ? '' : 'is-disabled'}`} onClick={() => onNavigate('benefits')} type="button" disabled={!enabled}>
      <span className="mh-benefits-copy"><strong><Sparkles size={17} /> สิทธิประโยชน์</strong><small>ดูแพ็กเกจสมาชิก ส่วนลด และสิทธิพิเศษสำหรับร้านค้า</small></span>
      <span className="mh-benefits-art"><img src="/mascot/nabtang_celebrating.png" alt="" /></span>
      <ChevronRight size={20} aria-hidden="true" />
    </button>
  )
}

function SystemStatus({ homeState, notificationState }: { homeState: StoreLoadState; notificationState: StoreLoadState }) {
  const healthy = !homeState.error && !notificationState.error
  return (
    <div className="mh-system-status" aria-label="สถานะระบบ">
      <span className={healthy ? '' : 'is-warning'}><CheckCircle2 size={15} /> {healthy ? 'ระบบปกติ' : 'กำลังตรวจสอบระบบ'}</span>
      <span><ShieldCheck size={15} /> ข้อมูลปลอดภัย</span>
      <span className={notificationState.error ? 'is-warning' : ''}><Bell size={15} /> แจ้งเตือนเรียลไทม์</span>
    </div>
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

function notificationCategory(value: string): NotificationCategory {
  return value === 'orders' || value === 'finance' || value === 'kyc' ? value : 'system'
}

function NotificationDrawer({
  notifications,
  initialUnreadCount,
  language,
  isLoading,
  error,
  storeId,
  onReload,
  onNavigate,
}: {
  notifications: DbNotificationRow[]
  initialUnreadCount: number
  language: HomeLanguage
  isLoading: boolean
  error: string | null
  storeId: string | null
  onReload: () => void
  onNavigate: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | NotificationCategory>('all')
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [actionError, setActionError] = useState('')
  const visibleNotifications = filter === 'all' ? notifications : notifications.filter((item) => notificationCategory(item.category) === filter)
  const filterLabels: Array<{ id: 'all' | NotificationCategory; label: string }> = [
    { id: 'all', label: `ทั้งหมด (${notifications.length})` },
    { id: 'finance', label: `การเงิน (${notifications.filter((item) => notificationCategory(item.category) === 'finance').length})` },
    { id: 'orders', label: `ออเดอร์ (${notifications.filter((item) => notificationCategory(item.category) === 'orders').length})` },
    { id: 'kyc', label: `KYC (${notifications.filter((item) => notificationCategory(item.category) === 'kyc').length})` },
    { id: 'system', label: `ระบบ (${notifications.filter((item) => notificationCategory(item.category) === 'system').length})` },
  ]

  useEffect(() => {
    setUnreadCount(initialUnreadCount)
  }, [initialUnreadCount])

  const markAllRead = async () => {
    if (!storeId || unreadCount === 0) return
    setActionError('')
    try {
      await markAllDbNotificationsRead(storeId)
      setUnreadCount(0)
      onReload()
    } catch (markError) {
      setActionError(markError instanceof Error ? markError.message : 'ทำเครื่องหมายอ่านแล้วไม่สำเร็จ')
    }
  }

  const markRead = async (item: DbNotificationRow) => {
    setActionError('')
    if (!item.readAt && storeId) {
      try {
        await markDbNotificationRead(item.id, storeId)
        setUnreadCount((current) => Math.max(0, current - 1))
        onReload()
      } catch (markError) {
        setActionError(markError instanceof Error ? markError.message : 'ทำเครื่องหมายอ่านแล้วไม่สำเร็จ')
      }
    }
    const target = item.actionTarget?.replace(/^#/, '').split('/').pop()
    if (target && merchantNavItems.some((navItem) => navItem.id === target)) onNavigate(target)
  }

  const badgeLabel = unreadCount > 9 ? '9+' : unreadCount > 0 ? String(unreadCount) : ''

  return (
    <>
      <button className="mh-notification-trigger" onClick={() => setOpen(true)} type="button" aria-label={unreadCount > 0 ? `การแจ้งเตือน ${unreadCount} รายการใหม่` : 'การแจ้งเตือน'}>
        <Bell size={16} />
        {badgeLabel && <b>{badgeLabel}</b>}
      </button>
      {open && (
        <div className="mn-fullscreen-overlay">
          <button className="mn-fullscreen-backdrop" aria-label="ปิดการแจ้งเตือน" onClick={() => setOpen(false)} type="button" />
          <section className="mn-fullscreen-card" aria-label="ศูนย์แจ้งเตือน" aria-modal="true" role="dialog">
            <div className="mn-header">
              <div className="mn-header-left"><div className="mn-bell-wrap"><Bell size={22} color="#ffffff" /></div><div><h2>ศูนย์แจ้งเตือนร้านค้า</h2><p>{error || (notifications.length ? 'รายการแจ้งเตือนจากระบบร้านค้า' : 'ยังไม่มีรายการแจ้งเตือนสำหรับร้านค้านี้')}</p></div></div>
              <button className="mn-close-btn" onClick={() => setOpen(false)} type="button" aria-label="ปิดการแจ้งเตือน"><X size={20} /></button>
            </div>
            <div className="mn-filter-bar">
              {filterLabels.map((item) => <button className={`mn-filter-tab ${filter === item.id ? 'active' : ''}`} key={item.id} onClick={() => setFilter(item.id)} type="button">{item.label}</button>)}
            </div>
            <div className="mn-list">
              {isLoading ? <div className="mn-loading" aria-busy="true"><RefreshCw size={22} className="spin" /><span>กำลังโหลดการแจ้งเตือน</span></div> : visibleNotifications.length ? visibleNotifications.map((item) => {
                const category = notificationCategory(item.category)
                const isRead = Boolean(item.readAt)
                return (
                  <button className={`mn-item ${isRead ? '' : 'unread'}`} key={item.id} onClick={() => { void markRead(item) }} type="button">
                    <div className="mn-item-icon blue"><WalletCards size={22} /></div>
                    <div className="mn-item-body"><div className="mn-item-top"><strong>{item.title}</strong><span className="mn-time">{formatDateTime(item.createdAt, language)}</span></div><p>{item.message}</p><span className="mn-tag blue">{category === 'finance' ? 'การเงิน' : category === 'orders' ? 'ออเดอร์' : category === 'kyc' ? 'KYC' : 'ระบบ'}</span></div>
                    {!isRead && <span className="mn-unread-dot" />}
                  </button>
                )
              }) : <div className="mn-empty"><Bell size={28} /><strong>{error ? 'ยังโหลดการแจ้งเตือนไม่ได้' : 'ไม่มีรายการแจ้งเตือน'}</strong><span>{error || 'เมื่อมีข้อมูลจากระบบ รายการจะแสดงในหน้านี้'}</span><button className="mn-footer-action" onClick={onReload} type="button"><RefreshCw size={15} /> ลองโหลดอีกครั้ง</button></div>}
            </div>
            {actionError && <p className="mn-action-error" role="alert">{actionError}</p>}
            <div className="mn-footer"><button className="mn-footer-action" onClick={() => { void markAllRead() }} type="button" disabled={!unreadCount}><CheckCircle2 size={16} /> ทำเครื่องหมายอ่านแล้วทั้งหมด</button><button className="mn-footer-close" onClick={() => setOpen(false)} type="button">ปิดหน้าต่างแจ้งเตือน</button></div>
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

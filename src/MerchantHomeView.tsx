import { useEffect, useState, type PointerEvent } from 'react'
import {
  BadgePercent,
  Banknote,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Copy,
  Eye,
  EyeOff,
  FileClock,
  Gift,
  Globe,
  Home,
  LockKeyhole,
  LogOut,
  Menu,
  QrCode,
  ReceiptText,
  RefreshCw,
  ScanLine,
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
  fetchDbTransactionsResult,
  markAllDbNotificationsRead,
  markDbNotificationRead,
  type AuthUser,
  type DbFetchResult,
  type DbHomeReadModel,
  type DbNotificationRow,
  type DbStoreRow,
  type DbTransactionRow,
} from './dbApi'
import { getMerchantNavItem, isMerchantBottomNavActive, isMerchantNavAllowed, merchantBottomNavIds, merchantNavItems, type MerchantNavCapabilities, type MerchantNavItem } from './merchantNavigation'

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
  onLogout: () => Promise<void>
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

function triggerButtonPress(event: PointerEvent<HTMLButtonElement>) {
  const button = event.currentTarget
  button.classList.remove('is-pressed')
  void button.offsetWidth
  button.classList.add('is-pressed')
  window.setTimeout(() => button.classList.remove('is-pressed'), 220)
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

function useRecentTransactions(storeId: string | null) {
  const [transactions, setTransactions] = useState<DbTransactionRow[]>([])
  const [state, setState] = useState<StoreLoadState>({ status: storeId ? 'loading' : 'empty', error: null, fetchedAt: null })

  const loadTransactions = async () => {
    if (!storeId) {
      setTransactions([])
      setState({ status: 'empty', error: null, fetchedAt: null })
      return
    }

    setState((previous) => ({ ...previous, status: 'loading', error: null }))
    const result = await fetchDbTransactionsResult({ storeId })
    if (result.error) {
      setState((previous) => ({ ...previous, status: previous.fetchedAt ? 'ready' : 'error', error: result.error }))
      return
    }

    setTransactions(result.data.slice(0, 3))
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
  availableStores,
  storeState,
  onStoreChange,
  onRetryStores,
  onOpenProfile,
  onLogout,
}: MerchantHomeProps) {
  const language: HomeLanguage = 'th'
  const [now, setNow] = useState(() => new Date())
  const { home, state: homeState, reload: reloadHome } = useHomeData(storeId)
  const { notifications, state: notificationState, reload: reloadNotifications } = useNotificationData(storeId)
  const { transactions, state: transactionState, reload: reloadTransactions } = useRecentTransactions(storeId)

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
    <div className="merchant-home-view reference-page">
      <header className="app-header">
        <HomeHeader
          unreadCount={unreadNotificationCount}
          notifications={notifications}
          notificationState={notificationState}
          storeId={storeId}
          selectedStore={displayStore}
          availableStores={availableStores}
          onStoreChange={onStoreChange}
          language={language}
          onReloadNotifications={reloadNotifications}
          onNavigate={onNavigate}
          onOpenProfile={onOpenProfile}
          currentUser={currentUser}
          onLogout={onLogout}
        />
      </header>
      <div className="screen">
        <section className="home-hero reference-home">
          <WalletHero store={displayStore} merchantId={merchantId} time={timeFormatted} isStoreOpen={displayStore.isActive} summary={home?.summary || null} capabilities={home?.capabilities} isLoading={homeState.status === 'loading'} />
        </section>
        <section className="home-content reference-content">
          <MainMenu home={home} onNavigate={onNavigate} />
          <ChannelPanel />
          <RecentPayments transactions={transactions} state={transactionState} onRetry={reloadTransactions} onNavigate={onNavigate} />
          <SystemStatus homeState={homeState} notificationState={notificationState} />
          {homeState.error && <HomeStaleNotice message={isStale ? 'ข้อมูลหน้าหลักล่าสุดอาจไม่สด' : homeState.error} onRetry={reloadHome} />}
          {storeState.error && <HomeStaleNotice message={storeState.error} onRetry={onRetryStores} />}
        </section>
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

function WalletHero({ store, merchantId, time, isStoreOpen, summary, capabilities, isLoading }: { store: DbStoreRow; merchantId: string | null; time: string; isStoreOpen: boolean; summary: DbHomeReadModel['summary'] | null; capabilities?: DbHomeReadModel['capabilities']; isLoading: boolean }) {
  const [balanceVisible, setBalanceVisible] = useState(true)
  const canViewBalance = capabilities?.canViewBalance === true
  const balance = isLoading
    ? '—'
    : !canViewBalance
      ? 'ไม่มีสิทธิ์'
      : summary?.balanceStatus === 'available'
        ? formatMoney(summary.availableBalance, 'th')
        : 'ยังไม่พร้อม'

  return (
    <section className="merchant-wallet-card">
      <div className="merchant-wallet-topline">
        <span><WalletCards size={16} /> กระเป๋าเงินร้านค้า</span>
        <span className={isStoreOpen ? 'is-ready' : 'is-closed'}><i />{isStoreOpen ? 'พร้อมใช้งาน' : 'ปิดบริการ'}</span>
      </div>
      <div className="merchant-wallet-balance">
        <span>ยอดเงินพร้อมใช้</span>
        <div><strong>{balanceVisible ? balance : '••••••'}</strong><em>THB</em><button onClick={() => setBalanceVisible((visible) => !visible)} type="button" disabled={isLoading || !canViewBalance} aria-label={balanceVisible ? 'ซ่อนยอดเงิน' : 'แสดงยอดเงิน'}>{balanceVisible ? <Eye size={18} /> : <EyeOff size={18} />}</button></div>
      </div>
      <HomeSummary summary={summary} capabilities={capabilities} isLoading={isLoading} variant="wallet" />
      <div className="merchant-wallet-meta"><span>{store.name || 'ร้านค้าของคุณ'}</span><span>{merchantId || 'Merchant'}</span><time>{time}</time></div>
    </section>
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

function HomeHeader({
  unreadCount,
  notifications,
  notificationState,
  storeId,
  selectedStore,
  availableStores,
  onStoreChange,
  language,
  onReloadNotifications,
  onNavigate,
  onOpenProfile,
  currentUser,
  onLogout,
}: {
  unreadCount: number
  notifications: DbNotificationRow[]
  notificationState: StoreLoadState
  storeId: string | null
  selectedStore: DbStoreRow
  availableStores: DbStoreRow[]
  onStoreChange: (storeId: string) => void
  language: HomeLanguage
  onReloadNotifications: () => void
  onNavigate: (id: string) => void
  onOpenProfile: () => void
  currentUser: AuthUser | null
  onLogout: () => Promise<void>
}) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const displayName = currentUser?.name || 'เจ้าของร้านค้า'
  const userInitials = displayName.slice(0, 2).toUpperCase()

  const openProfile = () => {
    setProfileMenuOpen(false)
    onOpenProfile()
  }

  const requestLogout = () => {
    setProfileMenuOpen(false)
    setLogoutConfirmOpen(true)
  }

  const confirmLogout = () => {
    setLogoutConfirmOpen(false)
    void onLogout()
  }

  return (
    <>
      <div className="app-header-row">
      <button className="brand-button" onClick={() => onNavigate('home')} type="button" aria-label="ChatPOS">
        <span className="brand"><span className="brand-bubble"><Store size={19} /></span><b>Chat</b><strong>POS</strong></span>
      </button>
      <div className="home-header-actions">
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
        <MerchantStoreHeader store={selectedStore} availableStores={availableStores} onStoreChange={onStoreChange} onOpenProfileMenu={() => setProfileMenuOpen((open) => !open)} profileMenuOpen={profileMenuOpen} />
      </div>
      </div>
      {profileMenuOpen && <>
        <button className="home-profile-dismiss" onClick={() => setProfileMenuOpen(false)} type="button" aria-label="ปิดเมนูโปรไฟล์" />
        <section className="home-profile-menu" aria-label="เมนูโปรไฟล์">
          <div className="home-profile-summary"><span className="home-profile-large-avatar">{userInitials}</span><span><strong>{displayName}</strong><small>{currentUser?.role === 'owner' ? 'Merchant Owner' : currentUser?.role || 'Merchant Owner'}</small></span></div>
          <div className="home-profile-actions"><button onClick={openProfile} type="button"><User size={18} /><span>โปรไฟล์ของฉัน</span><ChevronRight size={15} /></button><button onClick={requestLogout} type="button" className="is-danger"><LogOut size={18} /><span>ออกจากระบบ</span><ChevronRight size={15} /></button></div>
        </section>
      </>}
      {logoutConfirmOpen && <div className="home-logout-dialog-overlay"><button className="home-logout-dialog-backdrop" onClick={() => setLogoutConfirmOpen(false)} type="button" aria-label="ยกเลิกการออกจากระบบ" /><section className="home-logout-dialog" role="dialog" aria-modal="true" aria-labelledby="home-logout-title"><span className="home-logout-icon"><LogOut size={22} /></span><h2 id="home-logout-title">ออกจากระบบ?</h2><p>คุณต้องการออกจากระบบ Merchant ใช่หรือไม่</p><div><button onClick={() => setLogoutConfirmOpen(false)} type="button">ยกเลิก</button><button className="is-confirm" onClick={confirmLogout} type="button"><LogOut size={16} />ออกจากระบบ</button></div></section></div>}
    </>
  )
}

function MerchantStoreHeader({
  store,
  availableStores,
  onStoreChange,
  onOpenProfileMenu,
  profileMenuOpen,
}: {
  store: DbStoreRow
  availableStores: DbStoreRow[]
  onStoreChange: (storeId: string) => void
  onOpenProfileMenu: () => void
  profileMenuOpen: boolean
}) {
  const storeName = store.name || 'ร้านค้าของคุณ'

  return (
    <div className={`merchant-switcher ${profileMenuOpen ? 'is-open' : ''}`} title="เปิดเมนูโปรไฟล์และเลือกสาขาร้านค้า" role="button" tabIndex={0} aria-expanded={profileMenuOpen} onClick={onOpenProfileMenu} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenProfileMenu() } }}>
      <Store size={24} aria-hidden="true" />
      <span>
        <small>ร้านที่ใช้งาน</small>
        {availableStores.length > 1 ? (
          <select value={store.id} onClick={(event) => event.stopPropagation()} onChange={(event) => onStoreChange(event.target.value)} aria-label={`ร้านที่กำลังใช้งาน ${storeName}`}>
            {availableStores.map((availableStore) => <option key={availableStore.id} value={availableStore.id}>{availableStore.name}</option>)}
          </select>
        ) : (
          <b>{storeName}</b>
        )}
      </span>
      <ChevronDown size={16} aria-hidden="true" />
    </div>
  )
}

function PaymentTerminal({ count, isLoading, isStoreOpen, onNavigate }: { count: number | null; isLoading: boolean; isStoreOpen: boolean; onNavigate: (id: string) => void }) {
  return (
    <article className="home-terminal">
      <div className="home-terminal-status">
        <span><i /> เครื่อง POS ออนไลน์</span>
        <b><CheckCircle2 size={17} /> {isStoreOpen ? 'พร้อมรับชำระ' : 'ร้านค้าปิดบริการ'}</b>
      </div>
      <button onClick={() => onNavigate('payment')} type="button">
        <span className="terminal-scan"><ScanLine size={34} /></span>
        <span><b>รับเงิน / สร้าง QR</b><small>แตะเพื่อเริ่มรับชำระทันที</small></span>
        <ChevronRight size={19} />
      </button>
      <div className="terminal-methods" aria-label="ช่องทางรับชำระที่พร้อมใช้งาน">
        <span>QR พร้อมเพย์</span>
        <span>บัตรเครดิต</span>
        <span>Mobile Banking</span>
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
    <button className="merchant-line" onClick={copyMerchantId} type="button" disabled={!merchantId}>
      <span><Store size={24} /><b>{store.name || 'ร้านค้าของคุณ'}</b></span>
      <small>{merchantId ? `Merchant ID · ${merchantId}` : 'Merchant ID · —'} {merchantId && (copied ? '✓' : '⧉')}</small>
      <time dateTime={new Date().toISOString()}>{time}</time>
    </button>
  )
}

function HomeSummary({ summary, capabilities, isLoading, variant = 'default' }: { summary: DbHomeReadModel['summary'] | null; capabilities?: DbHomeReadModel['capabilities']; isLoading: boolean; variant?: 'default' | 'wallet' }) {
  const canViewBalance = capabilities?.canViewBalance === true
  const canViewTransactions = capabilities?.canViewTransactions === true
  const displayValue = (value: string | number | null, allowed: boolean) => {
    if (!allowed) return 'ไม่มีสิทธิ์'
    if (isLoading) return '—'
    return formatMoney(value, 'th')
  }
  const values = [
    { label: 'ยอดรับวันนี้', value: canViewBalance ? summary?.receivedToday : null, unit: 'บาท', className: 'green', icon: Banknote },
    { label: 'เงินพร้อมถอน', value: canViewBalance ? summary?.availableToWithdraw : null, unit: 'บาท', className: 'blue', icon: WalletCards },
    { label: 'รายการวันนี้', value: canViewTransactions ? summary?.todayTransactionCount : null, unit: 'รายการ', className: 'purple', icon: ReceiptText },
  ]

  return (
    <div className={`summary-grid reference-summary ${variant === 'wallet' ? 'wallet-summary' : ''}`} aria-label="สรุปยอดวันนี้">
      {values.map(({ label, value, unit, className, icon: Icon }) => (
        <button key={label} type="button">
          <span className={`stat-icon ${className}`}><Icon size={23} /></span>
          <small>{label}</small>
          <strong>{displayValue(value ?? null, className === 'purple' ? canViewTransactions : canViewBalance)}</strong>
          <em>{unit}</em>
        </button>
      ))}
    </div>
  )
}

const mainMenuDefinitions = [
  { id: 'payment', label: 'เก็บเงิน', className: 'green', icon: QrCode },
  { id: 'wallet', label: 'ถอนเงิน', className: 'orange', icon: WalletCards },
  { id: 'orders', label: 'รับออเดอร์', className: 'blue', icon: ClipboardList },
  { id: 'reports', label: 'รายงาน', className: 'teal', icon: BarChart3 },
  { id: 'salespage', label: 'SalePage', className: 'purple', icon: Globe },
  { id: 'stoppay', label: 'Stop Pay', className: 'red', icon: LockKeyhole },
]

function MainMenu({ home, onNavigate }: { home: DbHomeReadModel | null; onNavigate: (id: string) => void }) {
  const getAvailability = (id: string) => {
    if (!home) return { enabled: false, reason: 'กำลังโหลดสิทธิ์การใช้งาน' }
    const quickAction = home.quickActions.find((action) => action.id === id)
    if (quickAction) return { enabled: quickAction.enabled, reason: quickAction.disabledReason }
    if (id === 'payment') return { enabled: home.store.isActive, reason: home.store.isActive ? null : 'STORE_CLOSED' }
    if (id === 'wallet') return { enabled: home.capabilities.canViewBalance, reason: home.capabilities.canViewBalance ? null : 'BALANCE_VIEW_FORBIDDEN' }
    return { enabled: true, reason: null }
  }

  return (
    <section className="mh-menu-section feature-section" aria-label="เมนูหลัก">
      <div className="mh-section-heading section-title">
        <div><span>บริการของร้าน</span><h2>เมนูหลัก</h2></div>
        <Menu size={30} aria-hidden="true" />
      </div>
      <div className="mh-feature-grid feature-grid">
        {mainMenuDefinitions.map((item) => {
          const Icon = item.icon
          const availability = getAvailability(item.id)
          return (
          <button aria-label={availability.enabled ? item.label : `${item.label} ไม่พร้อมใช้งาน`} className={`feature-card ${item.className} ${availability.enabled ? '' : 'is-disabled'}`} key={item.id} onClick={() => onNavigate(item.id)} onPointerDown={triggerButtonPress} title={availability.reason || undefined} type="button" disabled={!availability.enabled}>
            <span className="feature-icon"><Icon size={34} /></span>
            <span><b>{item.label}</b></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          )
        })}
      </div>
    </section>
  )
}

function BenefitsAction({ enabled, onNavigate }: { enabled: boolean; onNavigate: (id: string) => void }) {
  return (
    <button className={`benefit-banner ${enabled ? '' : 'is-disabled'}`} onClick={() => onNavigate('benefits')} type="button" disabled={!enabled}>
      <span className="benefit-icon"><Gift size={25} /></span>
      <span><b>สิทธิประโยชน์สมาชิก</b><small>แพ็กเกจ Subscribe 295 บาท/เดือน</small></span>
      <BadgePercent size={36} aria-hidden="true" />
    </button>
  )
}

function SystemStatus({ homeState, notificationState }: { homeState: StoreLoadState; notificationState: StoreLoadState }) {
  const healthy = !homeState.error && !notificationState.error
  return (
    <div className="system-status" aria-label="สถานะระบบ">
      <span className={healthy ? '' : 'is-warning'}><CheckCircle2 size={16} /><b>{healthy ? 'ระบบปกติ' : 'กำลังตรวจสอบระบบ'}</b></span>
      <span><ShieldCheck size={16} /><b>ข้อมูลปลอดภัย</b></span>
      <span className={notificationState.error ? 'is-warning' : ''}><Bell size={16} /><b>แจ้งเตือนทันที</b></span>
    </div>
  )
}

function ChannelPanel() {
  const channels = [
    ['PromptPay', '/payments/promptpay_front.png', 'c1'],
    ['VISA / Mastercard', '/payments/visamasaster.png', 'c2'],
    ['VISA ต่างประเทศ', '/payments/mastercard_visa_combined.png', 'c9'],
    ['WeChat Pay', '/payments/wechatpay_front.png', 'c3'],
    ['Alipay', '/payments/alipay_front.png', 'c4'],
    ['TrueMoney', '/payments/truemoney_front.png', 'c6'],
    ['LINE Pay', '/payments/linepay_front.png', 'c7'],
    ['ShopeePay', '/payments/shopeepay_front.png', 'c8'],
  ]

  return (
    <section className="channel-panel" aria-labelledby="channels-title">
      <div className="section-title compact"><div><span>รองรับในระบบ</span><h2 id="channels-title">ช่องทางรับชำระ</h2></div></div>
      <div className="channel-grid">
        {channels.map(([label, source, className]) => <span key={label} aria-label={label} title={label}><i className={`channel-logo ${className}`}><img src={source} alt={`${label} logo`} /></i></span>)}
      </div>
    </section>
  )
}

function RecentPayments({ transactions, state, onRetry, onNavigate }: { transactions: DbTransactionRow[]; state: StoreLoadState; onRetry: () => void; onNavigate: (id: string) => void }) {
  const [selectedPayment, setSelectedPayment] = useState<DbTransactionRow | null>(null)
  const statusLabel = (status: string) => ['paid', 'completed', 'succeeded', 'settled'].includes(status.toLowerCase()) ? 'สำเร็จ' : status
  const paymentLabel = (transaction: DbTransactionRow) => transaction.paymentMethod || transaction.channel || 'การชำระเงิน'

  return (
    <section className="recent-payments" aria-labelledby="recent-payments-title">
      <div className="section-title compact"><div><span>รับเงินเข้าร้าน</span><h2 id="recent-payments-title">รายการรับเงินล่าสุด</h2></div><button type="button" onClick={() => onNavigate('transactions')}>ดูทั้งหมด <ChevronRight size={14} /></button></div>
      <div className="recent-payment-list">
        {state.status === 'loading' && <div className="mn-loading" aria-busy="true"><RefreshCw size={22} className="spin" /><span>กำลังโหลดรายการรับเงิน</span></div>}
        {state.status !== 'loading' && transactions.map((transaction) => <button className="recent-payment-row" key={transaction.id} onClick={() => setSelectedPayment(transaction)} onPointerDown={triggerButtonPress} type="button" aria-label={`ดูรายละเอียด ${paymentLabel(transaction)}`}><i className="channel-logo c1"><ReceiptText size={20} /></i><span><b>{paymentLabel(transaction)}</b><small>{transaction.occurredAt ? formatDateTime(transaction.occurredAt, 'th') : formatDateTime(transaction.createdAt, 'th')}</small></span><strong>+{formatMoney(transaction.amount, 'th')}</strong><em>{statusLabel(transaction.status)}</em></button>)}
        {state.status === 'empty' && <div className="mn-empty"><ReceiptText size={28} /><strong>ยังไม่มีรายการรับเงิน</strong><span>เมื่อมีธุรกรรม รายการล่าสุดจะแสดงในหน้านี้</span></div>}
        {state.status === 'error' && <div className="mn-empty"><ShieldAlert size={28} /><strong>ยังโหลดรายการรับเงินไม่ได้</strong><span>{state.error}</span><button className="mn-footer-action" onClick={onRetry} type="button"><RefreshCw size={15} /> ลองโหลดอีกครั้ง</button></div>}
      </div>
      {state.error && <HomeStaleNotice message={transactions.length ? 'รายการรับเงินล่าสุดอาจไม่สด' : state.error} onRetry={onRetry} />}
      {selectedPayment && <div className="recent-payment-dialog-overlay"><button className="recent-payment-dialog-backdrop" onClick={() => setSelectedPayment(null)} type="button" aria-label="ปิดรายละเอียดรายการรับเงิน" /><section className="recent-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="recent-payment-dialog-title"><button className="recent-payment-dialog-close" onClick={() => setSelectedPayment(null)} type="button" aria-label="ปิดรายละเอียด"><X size={18} /></button><div className="recent-payment-dialog-logo c1"><ReceiptText size={26} /></div><span className="recent-payment-dialog-status">{statusLabel(selectedPayment.status)}</span><h3 id="recent-payment-dialog-title">รายละเอียดการรับเงิน</h3><strong className="recent-payment-dialog-amount">{formatMoney(selectedPayment.amount, 'th')} บาท</strong><dl><div><dt>ช่องทาง</dt><dd>{paymentLabel(selectedPayment)}</dd></div><div><dt>เวลา</dt><dd>{selectedPayment.occurredAt ? formatDateTime(selectedPayment.occurredAt, 'th') : formatDateTime(selectedPayment.createdAt, 'th')}</dd></div><div><dt>เลขอ้างอิง</dt><dd>{selectedPayment.reference}</dd></div></dl><button className="recent-payment-dialog-action" onClick={() => setSelectedPayment(null)} type="button">ปิด</button></section></div>}
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
      <button className="mh-notification-trigger" onClick={(event) => { event.stopPropagation(); setOpen(true) }} type="button" aria-label={unreadCount > 0 ? `การแจ้งเตือน ${unreadCount} รายการใหม่` : 'การแจ้งเตือน'}>
        <Bell size={16} />
        {badgeLabel && <b>{badgeLabel}</b>}
      </button>
      {open && (
        <div className="mn-fullscreen-overlay" onClick={(event) => event.stopPropagation()}>
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

export function MerchantBottomNavigation({ active, onNavigate, capabilities = null }: { active: string; onNavigate: (id: string) => void; capabilities?: MerchantNavCapabilities | null }) {
  const items = merchantBottomNavIds.filter((id) => isMerchantNavAllowed(id, capabilities)).map((id) => getMerchantNavItem(id))
  const labels: Record<string, string> = {
    orders: 'ออเดอร์',
    tables: 'จัดการโต๊ะ',
    home: 'หน้าหลัก',
    pos: 'POS',
    settings: 'ตั้งค่า',
  }
  const renderItem = (item: MerchantNavItem, className = '') => {
    const Icon = item.icon
    return <button aria-current={isMerchantBottomNavActive(active, item.id) ? 'page' : undefined} className={`mh-bottom-item ${className} ${isMerchantBottomNavActive(active, item.id) ? 'active' : ''}`} key={item.id} onClick={() => onNavigate(item.id)} onPointerDown={triggerButtonPress} type="button"><Icon size={18} /><span>{labels[item.id] ?? item.label}</span></button>
  }

  return (
    <nav className="mh-global-bottom-bar" aria-label="เมนูร้านค้าบนมือถือ">
      {renderItem(items[0])}
      {renderItem(items[1])}
      <div className="mh-bottom-center-group">{renderItem({ ...items[2], icon: Home }, 'mh-bottom-home-btn')}</div>
      {renderItem(items[3])}
      {renderItem(items[4])}
    </nav>
  )
}

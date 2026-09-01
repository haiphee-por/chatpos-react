import { useState, useEffect } from 'react'
import { ProfileSettingsModal } from './ProfileSettingsModal'
import { MerchantKycView } from './MerchantKycView'
import { DeveloperConsoleView } from './DeveloperConsoleView'
import { createDbProduct, fetchDbAssignments, fetchDbProducts, fetchDbProductsResult, fetchDbStoresResult, fetchDbTransactionsResult, updateDbProduct, clearStoredUser, getStoredUser, logoutUser, type AuthUser, type DbAssignmentRow, type DbProductRow, type DbStoreRow, type DbTransactionRow } from './dbApi'
import { MerchantHome as MerchantHomeDashboard, MerchantBottomNavigation, type StoreLoadState } from './MerchantHomeView'
import { QuickPayView as RoutedQuickPayView } from './QuickPayView'
import { getMerchantNavItem, isMerchantNavId, merchantNavIdFromLocation, merchantNavItems } from './merchantNavigation'
import { generatePromptPayQrDataUrl, generateUrlQrDataUrl, getStoredPromptPayId, setStoredPromptPayId } from './promptpay'
import { checkTransactionStatus, createTransactionCommand, quickPayMethodToChannel, transactionQrImageUrl } from './chatposApi'
import {
  LogOut,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Clock,
  Copy,
  CreditCard,
  Delete,
  Eye,
  EyeOff,
  Globe,
  Languages,
  Image as ImageIcon,
  LayoutDashboard,
  Lock,
  Menu,
  Package,
  Plus,
  Printer,
  QrCode,
  ReceiptText,
  Search,
  Settings,
  Store,
  Trash2,
  WalletCards,
  X,
  Check,
  Tag,
  Sparkles,
  SlidersHorizontal,
  ShieldAlert,
  Link,
  LayoutGrid,
  Pencil,
  ShoppingBag,
  Truck,
  ArrowUpDown,
  Filter,
  Home,
  ShoppingCart,
  Minus,
  Receipt,
  BarChart3,
  TrendingUp,
  ArrowUpRight,
  User,
  Phone,
  MessageCircle,
  ShieldCheck,
  Key,
  Fingerprint,
  Volume2,
  Palette,
  Database,
  Code,
  HelpCircle,
  Utensils,
  BadgePercent,
  Share2,
  RefreshCw,
  FileCheck2,
} from 'lucide-react'

/* ==========================================================================
   WEB AUDIO API SOUND SYNTHESIZER (Tap / Click / Pop / Chime Audio Effects)
   ========================================================================== */
let audioCtx: AudioContext | null = null

function playTapSound(type: 'click' | 'pop' | 'success' | 'delete' | 'nav' = 'click') {
  try {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioContextClass) audioCtx = new AudioContextClass()
    }
    if (!audioCtx) return
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const now = audioCtx.currentTime
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)

    if (type === 'click') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(600, now)
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.04)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
      osc.start(now)
      osc.stop(now + 0.04)
    } else if (type === 'pop') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(400, now)
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.06)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
      osc.start(now)
      osc.stop(now + 0.06)
    } else if (type === 'nav') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(520, now)
      osc.frequency.exponentialRampToValueAtTime(650, now + 0.05)
      gain.gain.setValueAtTime(0.1, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
      osc.start(now)
      osc.stop(now + 0.05)
    } else if (type === 'success') {
      const osc2 = audioCtx.createOscillator()
      const gain2 = audioCtx.createGain()
      osc2.connect(gain2)
      gain2.connect(audioCtx.destination)

      osc.type = 'sine'
      osc.frequency.setValueAtTime(523.25, now)
      osc.frequency.setValueAtTime(659.25, now + 0.08)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)

      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(783.99, now + 0.08)
      gain2.gain.setValueAtTime(0.12, now + 0.08)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

      osc.start(now)
      osc.stop(now + 0.2)
      osc2.start(now + 0.08)
      osc2.stop(now + 0.25)
    } else if (type === 'delete') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(320, now)
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.08)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
      osc.start(now)
      osc.stop(now + 0.08)
    }
  } catch (err) {
    // Audio safeguard
  }
}

/** Speech Synthesis: พูดยอดเงินเป็นภาษาไทยเมื่อกด */
function speakBalance(amount: string) {
  try {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()

    // Strip currency symbol & commas for clean number
    const cleanNum = amount.replace(/[^0-9.]/g, '')
    const num = parseFloat(cleanNum)
    if (isNaN(num)) return

    // Format text e.g. "ยอดเงินของคุณคือ ห้าสิบ บาท ศูนย์ สตางค์"
    const baht = Math.floor(num)
    const satang = Math.round((num - baht) * 100)

    let text = `ยอดเงินของคุณคือ ${baht.toLocaleString()} บาท`
    if (satang > 0) {
      text += ` ${satang} สตางค์`
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'th-TH'
    utterance.rate = 0.95
    utterance.pitch = 1.1
    utterance.volume = 1

    // Try to pick a Thai voice if available
    const voices = window.speechSynthesis.getVoices()
    const thaiVoice = voices.find((v) => v.lang.startsWith('th'))
    if (thaiVoice) utterance.voice = thaiVoice

    playTapSound('success')
    window.speechSynthesis.speak(utterance)
  } catch (_) {
    // Speech safeguard
  }
}

const navItems = merchantNavItems

export type CatalogItem = {
  id: string
  name: string
  nameTh?: string
  nameEn?: string
  nameCn?: string
  category: string
  type: 'service' | 'product'
  price: number
  stock: number | null
  soldCount: number
  status: 'active' | 'out_of_stock' | 'paused'
  // Multi-language descriptions (Short & Detailed)
  shortDescTh?: string
  shortDescEn?: string
  shortDescCn?: string
  fullDescTh?: string
  fullDescEn?: string
  fullDescCn?: string
  // Multiple images gallery
  images?: string[]
  updatedAt?: string
}

export type PaidTransaction = {
  id: string
  method: string
  customer: string
  amount: number
  status: 'paid'
}

const initialCatalog: CatalogItem[] = [
  {
    id: '1',
    name: 'ชาไทยเย็น (แก้วใหญ่)',
    nameTh: 'ชาไทยเย็น (แก้วใหญ่)',
    nameEn: 'Thai Iced Tea (Large)',
    nameCn: '泰式冰奶茶 (大杯)',
    shortDescTh: 'ชาไทยรสเข้มข้น หอมกลิ่นชาตรามือแท้',
    shortDescEn: 'Rich authentic Thai tea with smooth condensed milk',
    shortDescCn: '地道泰式手标奶茶 浓郁香甜',
    fullDescTh: 'ชาไทยโบราณสูตรพิเศษ ใช้ใบชาคุณภาพเกรดพรีเมียม ชงสดใหม่ทุกแก้ว เสิร์ฟพร้อมน้ำแข็งเย็นชื่นใจ',
    fullDescEn: 'Premium grade authentic Thai tea leaves brewed fresh per order. Served with ice and sweetened condensed milk.',
    fullDescCn: '采用优质泰茶茶叶，现点现冲，配以特调鲜奶与浓缩炼乳，冰爽可口。',
    images: ['/mascot/pos_1_scanning_barcode.png', '/mascot/pay_1_holding_coin.png'],
    category: 'เครื่องดื่ม',
    type: 'product',
    price: 70,
    stock: 42,
    soldCount: 142,
    status: 'active'
  },
  {
    id: '2',
    name: 'บริการตัดผมชาย + สระเซ็ต',
    nameTh: 'บริการตัดผมชาย + สระเซ็ต',
    nameEn: 'Men\'s Haircut + Wash & Styling',
    nameCn: '男士理发 + 洗发造型',
    shortDescTh: 'ตัดแต่งทรงผมสไตล์เกาหลี/วินเทจ พร้อมสระเซ็ต',
    shortDescEn: 'Professional hair trimming, washing, and pomade styling',
    shortDescCn: '专业男士剪发 洗发与抓发造型',
    fullDescTh: 'บริการตัดผมชายโดยช่างผู้เชี่ยวชาญ วิเคราะห์ทรงผมให้เข้ากับรูปหน้า พร้อมสระผมด้วยแชมพูสูตรเย็นและจัดแต่งทรงด้วยผลิตภัณฑ์พรีเมียม',
    fullDescEn: 'Complete men styling session including hair analysis, scalp wash, precision cutting, and wax/pomade finish.',
    fullDescCn: '由专业理发师量身打造发型，包含凉感洗发、精细修剪及定型产品整发服务。',
    images: ['/mascot/kyc_10_holding_pen.png', '/mascot/nabtang_welcome.png'],
    category: 'บริการคิว',
    type: 'service',
    price: 250,
    stock: null,
    soldCount: 89,
    status: 'active'
  },
  { id: '3', name: 'ครัวซองต์เนยสดฝรั่งเศส', category: 'เบเกอรี่', type: 'product', price: 80, stock: 8, soldCount: 65, status: 'active' },
  { id: '4', name: 'บริการสปาเท้ารวมนวดกดจุด 45 นาที', category: 'บริการคิว', type: 'service', price: 350, stock: null, soldCount: 34, status: 'active' },
  { id: '5', name: 'อเมริกาโน่คั่วกลาง (Hot/Ice)', category: 'เครื่องดื่ม', type: 'product', price: 70, stock: 55, soldCount: 120, status: 'active' },
  { id: '6', name: 'บริการล้างรถดูดฝุ่นเคลือบสี (SUV)', category: 'บริการคิว', type: 'service', price: 400, stock: null, soldCount: 52, status: 'active' }
]

const initialPaidList: PaidTransaction[] = [
  { id: 'tx-1', method: 'รับชำระเงินผ่าน PromptPay QR', customer: 'คุณสมชาย ใจดี · วันนี้, 10:35 น.', amount: 50, status: 'paid' },
  { id: 'tx-2', method: 'รับชำระเงินผ่าน PromptPay QR', customer: 'คุณอนันต์ สุขใจ · เมื่อวาน, 18:20 น.', amount: 180, status: 'paid' },
  { id: 'tx-3', method: 'รับชำระเงิน POS - เงินสด', customer: 'ลูกค้าหน้าร้าน · 22 ก.ค. 2569, 12:45 น.', amount: 250, status: 'paid' }
]

export function MerchantView({ currentUser }: { currentUser: AuthUser | null }) {
  const getInitialTab = () => {
    return merchantNavIdFromLocation(window.location.pathname, window.location.hash)
  }

  const [active, setActive] = useState(getInitialTab)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)

  // Real Database Session & Store State
  const [selectedStore, setSelectedStore] = useState<DbStoreRow | null>(null)
  const [availableStores, setAvailableStores] = useState<DbStoreRow[]>([])
  const [storeState, setStoreState] = useState<StoreLoadState>({ status: 'loading', error: null, fetchedAt: null })

  const loadStores = async () => {
    setStoreState((previous) => ({ ...previous, status: 'loading', error: null }))
    const result = await fetchDbStoresResult()
    if (result.error) {
      setStoreState((previous) => ({ ...previous, status: previous.fetchedAt ? 'ready' : 'error', error: result.error }))
      return
    }
    const stores = result.data
    setAvailableStores(stores)
    setStoreState({ status: stores.length ? 'ready' : 'empty', error: null, fetchedAt: result.fetchedAt })
    if (stores.length > 0) {
      const userStoreId = currentUser?.store?.id
      const matched = userStoreId ? stores.find((s) => s.id === userStoreId) : stores[0]
      setSelectedStore(matched || stores[0])
    } else {
      setSelectedStore(null)
    }
  }

  useEffect(() => {
    loadStores()
  }, [currentUser])

  const handleStoreChange = (storeId: string) => {
    const nextStore = availableStores.find((store) => store.id === storeId)
    if (nextStore) setSelectedStore(nextStore)
  }

  useEffect(() => {
    if (availableStores.length && !selectedStore) {
      const userStoreId = currentUser?.store?.id
      const matched = userStoreId ? availableStores.find((store) => store.id === userStoreId) : availableStores[0]
      setSelectedStore(matched || availableStores[0])
    }
  }, [availableStores, currentUser, selectedStore])

  // Dynamic names & metadata from DB
  const displayStoreName = currentUser?.store?.name || selectedStore?.name || 'สาขาใหญ่'
  const displayStoreBranch = selectedStore?.storeType === 'MAIN' ? 'สาขาหลัก' : (selectedStore?.storeType ? `สาขา${selectedStore.storeType}` : 'สาขาหลัก')
  const displayStoreCode = selectedStore?.merchantId ? `${selectedStore.merchantId}` : (selectedStore?.id ? `S-${selectedStore.id.slice(0, 6).toUpperCase()}` : 'M-001')
  
  const displayUserName = currentUser?.name || selectedStore?.owner_name || 'เจ้าของร้านค้า'
  const displayUserRole = currentUser?.role === 'owner' ? 'Merchant Owner' : (currentUser?.role ? `${currentUser.role.toUpperCase()} Owner` : 'Merchant Owner')
  const userInitials = (displayUserName.slice(0, 2) || 'MB').toUpperCase()

  const handleLogout = async () => {
    try {
      await logoutUser()
    } catch {
      clearStoredUser()
    }
    window.location.href = '/'
  }

  useEffect(() => {
    localStorage.setItem('merchant_active_tab', active)
    const target = getMerchantNavItem(active).target
    if (window.location.pathname !== target || window.location.hash) {
      window.history.replaceState({}, '', target)
    }
  }, [active])

  useEffect(() => {
    const handleLocationChange = () => {
      setActive(merchantNavIdFromLocation(window.location.pathname, window.location.hash))
    }
    window.addEventListener('popstate', handleLocationChange)
    window.addEventListener('hashchange', handleLocationChange)
    return () => {
      window.removeEventListener('popstate', handleLocationChange)
      window.removeEventListener('hashchange', handleLocationChange)
    }
  }, [])

  const current = navItems.find((item) => item.id === active) ?? navItems[0]
  const navigate = (id: string) => {
    if (!isMerchantNavId(id)) return
    const target = getMerchantNavItem(id).target
    setActive(id)
    localStorage.setItem('merchant_active_tab', id)
    if (window.location.pathname !== target || window.location.hash) {
      window.history.pushState({}, '', target)
    }
    setMobileOpen(false)
  }

  const sidebar = (
    <aside className="merchant-sidebar">
      <div className="merchant-brand" onClick={() => (window.location.href = '/')} style={{ cursor: 'pointer' }}>
        <img src="/logo.png" alt="Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
        <div>
          <strong>ChatPOS</strong>
          <span>MERCHANT PORTAL</span>
        </div>
      </div>
      <div className="merchant-store" title="เลือกสาขาร้านค้า">
        <Store size={16} />
        <div>
          <span>สาขาปัจจุบัน</span>
          {availableStores.length > 1 ? (
            <select className="merchant-store-select" value={selectedStore?.id || ''} onChange={(event) => handleStoreChange(event.target.value)} aria-label="เลือกสาขาร้านค้า">
              {availableStores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
            </select>
          ) : (
            <button className="merchant-store-name-button" onClick={() => setProfileModalOpen(true)} type="button">{displayStoreName}</button>
          )}
          <small>{displayStoreBranch} · {displayStoreCode}</small>
        </div>
        <button className="merchant-store-settings" onClick={() => setProfileModalOpen(true)} type="button" aria-label="เปิดการตั้งค่าร้านค้า"><ChevronRight size={15} /></button>
      </div>
      <nav>
        {navItems.map(({ id, label, icon: NavIcon, target }) => (
          <a
            className={active === id ? 'active' : ''}
            href={target}
            key={id}
            onClick={(event) => {
              event.preventDefault()
              navigate(id)
            }}
            aria-current={active === id ? 'page' : undefined}
          >
            <NavIcon size={17} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      <div className="merchant-user" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, cursor: 'pointer', flex: 1 }} onClick={() => setProfileModalOpen(true)} title="ดูโปรไฟล์ผู้ใช้งาน">
          <div className="merchant-avatar" style={{ flexShrink: 0 }}>{userInitials}</div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <strong style={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '11px' }}>{displayUserName}</strong>
            <span style={{ display: 'block', fontSize: '9px', color: '#82aa9b', marginTop: '2px' }}>{displayUserRole}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          title="ออกจากระบบ"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
        >
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  )

  return (
    <div className={`merchant-app ${active === 'home' ? 'merchant-app-home' : ''}`}>
      {active !== 'home' && sidebar}
      {active !== 'home' && mobileOpen && (
        <div className="merchant-mobile">
          <button className="merchant-backdrop" aria-label="ปิดเมนู" onClick={() => setMobileOpen(false)} type="button" />
          <div>
            {sidebar}
            <button className="merchant-close" aria-label="ปิดเมนู" onClick={() => setMobileOpen(false)} type="button">
              <X size={20} />
            </button>
          </div>
        </div>
      )}
      <div className="merchant-main">
        {active !== 'home' && <header className="merchant-topbar">
          <button className="merchant-menu-button" aria-label="เปิดเมนู" onClick={() => setMobileOpen(true)} type="button">
            <Menu size={20} />
          </button>
          <div>
            <p>Merchant Portal</p>
            <h1>{current.label}</h1>
          </div>
          <div className="merchant-actions">
            <button aria-label="การแจ้งเตือนจะแสดงในหน้า Home" className="merchant-icon-button" onClick={() => navigate('home')} type="button">
              <Bell size={18} />
            </button>
            <div className="merchant-top-avatar">PB</div>
          </div>
        </header>}
        <main className={`merchant-content ${active === 'home' ? 'merchant-home-content' : ''}`}>
          {active === 'home' ? (
            <MerchantHomeDashboard
              onNavigate={navigate}
              storeId={selectedStore?.id || currentUser?.store?.id || null}
              selectedStore={selectedStore}
              currentUser={currentUser}
              availableStores={availableStores}
              storeState={storeState}
              onStoreChange={handleStoreChange}
              onRetryStores={loadStores}
              onOpenProfile={() => setProfileModalOpen(true)}
              onLogout={handleLogout}
            />
          ) : active === 'pos' ? (
            <PosView onNavigate={navigate} />
          ) : active === 'payment' ? (
            <RoutedQuickPayView storeName={displayStoreName} />
          ) : active === 'products' ? (
            <ProductsView storeId={selectedStore?.id || currentUser?.store?.id || null} />
          ) : active === 'services' ? (
            <ServicesView />
          ) : active === 'salespage' ? (
            <SalesPageView />
          ) : active === 'orders' ? (
            <OrdersView onNavigate={navigate} />
          ) : active === 'transactions' ? (
            <TransactionsView storeId={selectedStore?.id || currentUser?.store?.id || null} onNavigate={navigate} />
          ) : active === 'tables' ? (
            <MerchantSection active={active} label={current.label} />
          ) : active === 'reports' ? (
            <ReportsView />
          ) : active === 'wallet' ? (
            <WalletView />
          ) : active === 'kyc' ? (
            <MerchantKycView storeId={selectedStore?.id || currentUser?.store?.id || null} />
          ) : active === 'developer' ? (
            <DeveloperConsoleView embedded={true} />
          ) : active === 'settings' ? (
            <SettingsView onOpenProfile={() => setProfileModalOpen(true)} onNavigate={navigate} />
          ) : (
            <MerchantSection active={active} label={current.label} />
          )}
        </main>

        {false && <nav className="mh-global-bottom-bar">
          <button
            className={`mh-bottom-item ${active === 'orders' ? 'active' : ''}`}
            onClick={() => navigate('orders')}
            type="button"
          >
            <ClipboardList size={18} />
            <span>ออเดอร์</span>
          </button>

          <button
            className={`mh-bottom-item ${active === 'services' ? 'active' : ''}`}
            onClick={() => navigate('services')}
            type="button"
          >
            <Clock size={18} />
            <span>บริการ</span>
          </button>

          <div className="mh-bottom-center-group">
            <button
              className={`mh-bottom-home-btn ${active === 'home' ? 'active' : ''}`}
              onClick={() => navigate('home')}
              type="button"
            >
              <Home size={20} />
              <span>หน้าแรก</span>
            </button>

            <button
              className={`mh-bottom-pay-btn ${active === 'payment' ? 'active' : ''}`}
              onClick={() => navigate('payment')}
              type="button"
            >
              <QrCode size={20} />
              <span>คิดเงินด่วน</span>
            </button>
          </div>

          <button
            className={`mh-bottom-item ${active === 'salespage' ? 'active' : ''}`}
            onClick={() => navigate('salespage')}
            type="button"
          >
            <Globe size={18} />
            <span>เซลเพจ</span>
          </button>

          <button
            className={`mh-bottom-item ${active === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
            type="button"
          >
            <Settings size={18} />
            <span>ตั้งค่า</span>
          </button>
        </nav>}
        <MerchantBottomNavigation active={active} onNavigate={navigate} />
      </div>

      {/* Full-Screen Notifications Overlay (Root Portal Level) */}
      {false && notificationsOpen && (
        <div className="mn-fullscreen-overlay">
          <div className="mn-fullscreen-backdrop" onClick={() => setNotificationsOpen(false)} />
          <div className="mn-fullscreen-card">
            {/* Header */}
            <div className="mn-header">
              <div className="mn-header-left">
                <div className="mn-bell-wrap">
                  <Bell size={22} color="#ffffff" />
                  <span className="mn-badge-num">3</span>
                </div>
                <div>
                  <h2>ศูนย์แจ้งเตือนร้านค้า (Notifications)</h2>
                  <p>อัปเดตออเดอร์ใหม่ ยอดเงินเข้า และการยืนยันตัวตนแบบ Real-time</p>
                </div>
              </div>
              <button
                className="mn-close-btn"
                onClick={() => setNotificationsOpen(false)}
                type="button"
                aria-label="ปิดการแจ้งเตือน"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="mn-filter-bar">
              <button className="mn-filter-tab active" type="button">ทั้งหมด (5)</button>
              <button className="mn-filter-tab" type="button">🛍️ ออเดอร์ (1)</button>
              <button className="mn-filter-tab" type="button">💰 การเงิน (1)</button>
              <button className="mn-filter-tab" type="button">🔒 KYC และความปลอดภัย (1)</button>
            </div>

            {/* Notification List */}
            <div className="mn-list">
              {/* Item 1: Order */}
              <div className="mn-item unread">
                <div className="mn-item-icon green">
                  <ShoppingBag size={22} />
                </div>
                <div className="mn-item-body">
                  <div className="mn-item-top">
                    <strong>มีออเดอร์ใหม่ 4 รายการรอจัดส่ง</strong>
                    <span className="mn-time">10:35 น.</span>
                  </div>
                  <p>รายการสั่งซื้อใหม่จากลูกค้าหน้าร้าน ยอดรวม ฿580.00 บาท (ออเดอร์ #ORD-2026-089)</p>
                  <div className="mn-tags">
                    <span className="mn-tag green">🛍️ ออเดอร์ใหม่</span>
                    <span className="mn-tag-branch">สาขาหลัก · M-001</span>
                  </div>
                </div>
                <span className="mn-unread-dot" />
              </div>

              {/* Item 2: Wallet */}
              <div className="mn-item unread">
                <div className="mn-item-icon blue">
                  <WalletCards size={22} />
                </div>
                <div className="mn-item-body">
                  <div className="mn-item-top">
                    <strong>ยอดเงินเข้าวันนี้อัปเดตแล้ว +฿4,850.00</strong>
                    <span className="mn-time">09:12 น.</span>
                  </div>
                  <p>โอนชำระเงินผ่าน PromptPay QR Code เข้ากระเป๋าเงินร้านค้าสำเร็จ 100%</p>
                  <div className="mn-tags">
                    <span className="mn-tag blue">💰 รับชำระเงิน</span>
                    <span className="mn-tag-branch">พร้อมเพย์ QR</span>
                  </div>
                </div>
                <span className="mn-unread-dot" />
              </div>

              {/* Item 3: KYC */}
              <div className="mn-item unread amber-border">
                <div className="mn-item-icon amber">
                  <ShieldAlert size={22} />
                </div>
                <div className="mn-item-body">
                  <div className="mn-item-top">
                    <strong className="amber-text">จำเป็นต้องยืนยันตัวตน (KYC)</strong>
                    <span className="mn-time">เมื่อวาน</span>
                  </div>
                  <p>กรุณาอัปโหลดบัตรประชาชนและเอกสารร้านค้าเพื่อปลดล็อกการรับชำระเงินทุกช่องทาง</p>
                  <button
                    className="mn-action-btn"
                    onClick={() => {
                      setNotificationsOpen(false)
                      navigate('payment')
                    }}
                    type="button"
                  >
                    ไปที่หน้ายืนยันตัวตน KYC ›
                  </button>
                </div>
                <span className="mn-unread-dot" />
              </div>

              {/* Item 4: Stock */}
              <div className="mn-item">
                <div className="mn-item-icon orange">
                  <Package size={22} />
                </div>
                <div className="mn-item-body">
                  <div className="mn-item-top">
                    <strong>เตือนสต็อกสินค้าใกล้หมด</strong>
                    <span className="mn-time">05 ส.ค.</span>
                  </div>
                  <p>เมล็ดกาแฟ อาราบิก้า พรีเมียม (250g) เหลือเพียง 3 ชิ้นในสต็อก</p>
                </div>
              </div>

              {/* Item 5: System */}
              <div className="mn-item">
                <div className="mn-item-icon teal">
                  <CheckCircle2 size={22} />
                </div>
                <div className="mn-item-body">
                  <div className="mn-item-top">
                    <strong>ระบบซิงค์ข้อมูล ChatPOS สำเร็จ</strong>
                    <span className="mn-time">04 ส.ค.</span>
                  </div>
                  <p>ซิงค์ข้อมูลรายการสินค้า สต็อก และประวัติการขายประจำวันเรียบร้อยแล้ว</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mn-footer">
              <button className="mn-footer-action" onClick={() => alert('ทำเครื่องหมายอ่านแล้วทั้งหมด')} type="button">
                <CheckCircle2 size={16} /> ทำเครื่องหมายอ่านแล้วทั้งหมด
              </button>
              <button className="mn-footer-close" onClick={() => setNotificationsOpen(false)} type="button">
                ปิดหน้าต่างแจ้งเตือน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merchant Profile Settings Modal */}
      <ProfileSettingsModal
        isOpen={profileModalOpen}
        role="merchant"
        onClose={() => setProfileModalOpen(false)}
      />
    </div>
  )
}

const assignmentStatusLabels: Record<string, { label: string; nextAction: string; color: string; background: string }> = {
  PENDING_ADMIN_ASSIGNMENT: { label: 'รอ Admin จัดสรร Agent', nextAction: 'ทีม Operations กำลังเลือก Agent และ PD ที่รับผิดชอบ', color: '#b45309', background: '#fffbeb' },
  PENDING_AGENT_ACCEPTANCE: { label: 'รอ Agent กดยอมรับ', nextAction: 'รอ Agent ยืนยันการรับดูแล Merchant', color: '#0369a1', background: '#f0f9ff' },
  ACCEPTED: { label: 'ผูก Agent แล้ว', nextAction: 'Agent และ PD ยืนยันการดูแลแล้ว', color: '#047857', background: '#ecfdf5' },
  REJECTED: { label: 'Agent ปฏิเสธคำขอ', nextAction: 'ตรวจเหตุผลและส่งคำขอใหม่ตาม policy', color: '#b91c1c', background: '#fef2f2' },
  EXPIRED: { label: 'คำขอหมดอายุ', nextAction: 'ส่งคำขอ assignment ใหม่เมื่อพร้อม', color: '#b91c1c', background: '#fef2f2' },
  REASSIGNED: { label: 'กำลังจัดสรร Agent ใหม่', nextAction: 'รอ callback ยืนยัน Agent คนใหม่', color: '#7c3aed', background: '#f5f3ff' },
  REQUEST_FAILED: { label: 'ส่งคำขอไม่สำเร็จ', nextAction: 'ตรวจการเชื่อมต่อก่อนลองใหม่', color: '#b91c1c', background: '#fef2f2' },
}

function MerchantAssignmentStatus({ storeId }: { storeId: string | null }) {
  const [assignments, setAssignments] = useState<DbAssignmentRow[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(storeId))
  const [lastError, setLastError] = useState('')

  const loadAssignments = async () => {
    if (!storeId) return
    setIsLoading(true)
    setLastError('')
    try {
      const rows = await fetchDbAssignments(storeId)
      setAssignments(rows)
    } catch {
      setLastError('ยังโหลดสถานะ assignment ไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAssignments()
  }, [storeId])

  if (!storeId) return null

  const latest = assignments[0]
  const statusCopy = assignmentStatusLabels[latest?.status || ''] || {
    label: latest?.status || 'ยังไม่มีสถานะ assignment',
    nextAction: 'ยังไม่มีคำขอผูก Agent สำหรับร้านค้านี้',
    color: '#64748b',
    background: '#f8fafc',
  }

  return (
    <section style={{ marginBottom: 18, padding: '16px 18px', border: '1px solid #dbe9e2', borderRadius: 12, background: statusCopy.background }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <span style={{ display: 'block', color: '#648076', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase' }}>Merchant-Agent assignment</span>
          <strong style={{ display: 'block', marginTop: 5, color: statusCopy.color, fontSize: 16 }}>{isLoading ? 'กำลังโหลดสถานะ...' : statusCopy.label}</strong>
        </div>
        <button type="button" onClick={loadAssignments} disabled={isLoading} title="รีเฟรชสถานะ assignment" style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, border: '1px solid #cfe1d8', borderRadius: 7, background: '#ffffffaa', color: '#28745c', cursor: isLoading ? 'wait' : 'pointer' }}>
          <RefreshCw size={15} className={isLoading ? 'spin' : ''} />
        </button>
      </div>
      <p style={{ margin: '8px 0 0', color: '#4f6f63', fontSize: 12 }}>{lastError || statusCopy.nextAction}</p>
      {latest?.status === 'ACCEPTED' && (latest.agent_code || latest.pd_code) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {latest.agent_code && <span style={{ padding: '5px 9px', borderRadius: 6, background: '#ffffffaa', color: '#166534', fontSize: 11, fontWeight: 700 }}>Agent {latest.agent_code}</span>}
          {latest.pd_code && <span style={{ padding: '5px 9px', borderRadius: 6, background: '#ffffffaa', color: '#166534', fontSize: 11, fontWeight: 700 }}>PD {latest.pd_code}{latest.pd_name ? ` · ${latest.pd_name}` : ''}</span>}
        </div>
      )}
      {latest && <small style={{ display: 'block', marginTop: 10, color: '#78968a', fontSize: 10 }}>อัปเดตล่าสุด {new Date(latest.updatedAt).toLocaleString('th-TH')}</small>}
    </section>
  )
}

function LegacyMerchantHome({ onNavigate, storeId }: { onNavigate: (id: string) => void; storeId: string | null }) {
  const [showBalance, setShowBalance] = useState(true)
  const [copiedId, setCopiedId] = useState(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleCopyMerchantId = () => {
    navigator.clipboard?.writeText('S072609429')
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  // Calculate formatted time and period icon
  const hours = now.getHours()
  const timeFormatted = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  let timeEmoji = '☀️'
  if (hours >= 6 && hours < 12) {
    timeEmoji = '🌅' // เช้า
  } else if (hours >= 12 && hours < 17) {
    timeEmoji = '☀️' // บ่าย
  } else if (hours >= 17 && hours < 19) {
    timeEmoji = '🌆' // เย็น
  } else {
    timeEmoji = '🌙' // ดึก / กลางคืน
  }

  return (
    <div className="merchant-home-view">
      <MerchantAssignmentStatus storeId={storeId} />
      {/* 1. Top Green Store Status Card (GORRADA) */}
      <section className="mh-store-card">
        <div className="mh-store-info">
          <div className="mh-status-row">
            <span className="mh-status-pill">
              <span className="pulse-dot" /> เปิดให้บริการ
            </span>
            <span className="mh-time-pill">
              <Clock size={12} /> {timeFormatted} {timeEmoji}
            </span>
          </div>

          <div className="mh-title-row">
            <h2 className="mh-store-name">GORRADA</h2>
            <button className="mh-store-badge-btn" type="button">
              สมัครร้าน ›
            </button>
          </div>

          <div className="mh-merchant-id-pill" onClick={handleCopyMerchantId} role="button" tabIndex={0}>
            <span>Merchant ID : S072609429</span>
            <Copy size={12} />
            {copiedId && <small className="copied-tooltip">คัดลอกแล้ว!</small>}
          </div>
        </div>

        <div className="mh-store-mascot">
          <img
            src="/mascot/nabtang_welcome.png"
            className="mh-store-mascot-img"
            alt="น้องนับตังค์ ChatPOS"
          />
        </div>
      </section>

      {/* 2. Total Balance Overview Card */}
      <section className="mh-balance-card">
        <div className="mh-balance-header">
          <div className="mh-balance-title">
            <span>ยอดเงินทั้งหมด</span>
            <button
              aria-label="ซ่อน/แสดงยอดเงิน"
              className="mh-eye-toggle"
              onClick={() => setShowBalance(!showBalance)}
              type="button"
            >
              {showBalance ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          </div>

          <div className="mh-balance-mascot-graphic">
            <div className="money-bag-graphic">
              <span className="money-bag-emoji">💰</span>
              <div className="mini-character-head" />
            </div>
          </div>
        </div>

        <div
          className="mh-main-amount mh-main-amount-tappable"
          onClick={() => { if (showBalance) speakBalance('50.00') }}
          role="button"
          tabIndex={0}
          title="กดเพื่อฟังยอดเงิน"
        >
          ฿ {showBalance ? '50.00' : '•••.••'}
          {showBalance && <span className="mh-speak-hint">🔊</span>}
        </div>

        <div className="mh-balance-sub-grid">
          <div className="mh-sub-card mh-sub-green">
            <div className="mh-sub-info">
              <span>ยอดรับวันนี้</span>
              <strong>฿ {showBalance ? '0.00' : '•••'}</strong>
            </div>
            <button className="mh-sub-link" onClick={() => onNavigate('reports')} type="button">
              ดูรายการ ›
            </button>
          </div>

          <div className="mh-sub-card mh-sub-blue">
            <div className="mh-sub-info">
              <span>ยอดพร้อมถอน</span>
              <strong>฿ {showBalance ? '0.00' : '•••'}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* 3. 5 Main Feature App Buttons Grid */}
      <section className="mh-app-grid">
        {/* Row 1: POS, บัญชี, STOPPAY */}
        <div className="mh-app-card mh-app-pos" onClick={() => onNavigate('pos')} role="button" tabIndex={0}>
          <div className="mh-app-icon-wrap">
            <CreditCard size={24} />
          </div>
          <strong>POS</strong>
          <img src="/mascot/pay_3_holding_credit_card.png" className="mh-app-mascot-img" alt="POS" />
        </div>

        <div className="mh-app-card mh-app-account" onClick={() => onNavigate('wallet')} role="button" tabIndex={0}>
          <div className="mh-app-icon-wrap">
            <WalletCards size={24} />
          </div>
          <strong>บัญชี</strong>
          <img src="/mascot/pay_5_wallet.png" className="mh-app-mascot-img" alt="บัญชี" />
        </div>

        <div className="mh-app-card mh-app-stoppay" onClick={() => onNavigate('settings')} role="button" tabIndex={0}>
          <div className="mh-app-icon-wrap">
            <ShieldAlert size={24} />
          </div>
          <strong>STOPPAY</strong>
          <img src="/mascot/kyc_8_holding_shield.png" className="mh-app-mascot-img" alt="STOPPAY" />
        </div>

        {/* Row 2: ประวัติ, สิทธิพิเศษ */}
        <div className="mh-app-card mh-app-history" onClick={() => onNavigate('orders')} role="button" tabIndex={0}>
          <div className="mh-app-icon-wrap">
            <ClipboardList size={24} />
          </div>
          <strong>ประวัติ</strong>
          <img src="/mascot/trans_3_viewing_history.png" className="mh-app-mascot-img" alt="ประวัติ" />
        </div>

        <div className="mh-app-card mh-app-perks" onClick={() => onNavigate('reports')} role="button" tabIndex={0}>
          <div className="mh-app-icon-wrap">
            <Sparkles size={24} />
          </div>
          <strong>สิทธิพิเศษ</strong>
          <img src="/mascot/nabtang_celebrating.png" className="mh-app-mascot-img" alt="สิทธิพิเศษ" />
        </div>
      </section>

      {/* 4. Store Management System List ("ระบบจัดการร้านค้า") */}
      <section className="mh-mgmt-section">
        <h3 className="mh-mgmt-heading">ระบบจัดการร้านค้า</h3>

        <div className="mh-mgmt-list">
          {/* Item 1: สินค้า / สต็อก */}
          <div className="mh-mgmt-item" onClick={() => onNavigate('products')} role="button" tabIndex={0}>
            <div className="mh-mgmt-icon-wrap icon-green">
              <Package size={22} />
            </div>
            <div className="mh-mgmt-text">
              <strong>สินค้า / สต็อก</strong>
              <span>จัดการสินค้าในคลัง ยอดคงเหลือ และการเตือนสต็อกต่ำ</span>
            </div>
            <ChevronRight className="mh-mgmt-arrow" size={18} />
          </div>

          {/* Item 2: บริการร้านค้า */}
          <div className="mh-mgmt-item" onClick={() => onNavigate('services')} role="button" tabIndex={0}>
            <div className="mh-mgmt-icon-wrap icon-blue">
              <Clock size={22} />
            </div>
            <div className="mh-mgmt-text">
              <strong>บริการร้านค้า</strong>
              <span>จัดการบริการ คิวคุมเวลา และประวัติรายการชำระแล้ว</span>
            </div>
            <ChevronRight className="mh-mgmt-arrow" size={18} />
          </div>

          {/* Item 2: รายงาน */}
          <div className="mh-mgmt-item" onClick={() => onNavigate('reports')} role="button" tabIndex={0}>
            <div className="mh-mgmt-icon-wrap icon-emerald">
              <ReceiptText size={22} />
            </div>
            <div className="mh-mgmt-text">
              <strong>รายงาน</strong>
              <span>รายงานสรุปยอดขาย กำไร และสถิติวิเคราะห์เชิงลึก</span>
            </div>
            <ChevronRight className="mh-mgmt-arrow" size={18} />
          </div>

          {/* Item 3: เซลเพจ */}
          <div className="mh-mgmt-item" onClick={() => onNavigate('settings')} role="button" tabIndex={0}>
            <div className="mh-mgmt-icon-wrap icon-teal">
              <Globe size={22} />
            </div>
            <div className="mh-mgmt-text">
              <strong>เซลเพจ</strong>
              <span>ลิงก์สั่งซื้อออนไลน์สำหรับลูกค้า และหน้าร้านค้าเซลเพจ</span>
            </div>
            <ChevronRight className="mh-mgmt-arrow" size={18} />
          </div>


          {/* Item 5: ฮาร์ดแวร์ */}
          <div className="mh-mgmt-item" onClick={() => onNavigate('settings')} role="button" tabIndex={0}>
            <div className="mh-mgmt-icon-wrap icon-blue">
              <Printer size={22} />
            </div>
            <div className="mh-mgmt-text">
              <strong>ฮาร์ดแวร์</strong>
              <span>ตั้งค่าเครื่องพิมพ์สลิปความร้อน เครื่องสแกนบาร์โค้ด และอุปกรณ์</span>
            </div>
            <ChevronRight className="mh-mgmt-arrow" size={18} />
          </div>

          {/* Item 6: บิล */}
          <div className="mh-mgmt-item" onClick={() => onNavigate('wallet')} role="button" tabIndex={0}>
            <div className="mh-mgmt-icon-wrap icon-mint">
              <ReceiptText size={22} />
            </div>
            <div className="mh-mgmt-text">
              <strong>บิล</strong>
              <span>ตรวจสอบบิล ค่าบริการแพลตฟอร์มรายวัน และรอบเคลียร์ริ่งโอนเงิน</span>
            </div>
            <ChevronRight className="mh-mgmt-arrow" size={18} />
          </div>
        </div>
      </section>
    </div>
  )
}

/* ==========================================================================
   MULTI-LANGUAGE & MULTI-IMAGE ITEM FORM & DETAILS MODALS
   ========================================================================== */
function ItemFormModal({
  isOpen,
  onClose,
  type,
  onSave,
  categories = [],
  onAddCategory,
  isSaving = false,
}: {
  isOpen: boolean
  onClose: () => void
  type: 'product' | 'service'
  onSave: (item: CatalogItem) => void | Promise<void>
  categories?: string[]
  onAddCategory?: (cat: string) => void
  isSaving?: boolean
}) {
  const [activeLang, setActiveLang] = useState<'th' | 'en' | 'cn'>('th')

  const [nameTh, setNameTh] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [nameCn, setNameCn] = useState('')

  const [shortDescTh, setShortDescTh] = useState('')
  const [shortDescEn, setShortDescEn] = useState('')
  const [shortDescCn, setShortDescCn] = useState('')

  const [fullDescTh, setFullDescTh] = useState('')
  const [fullDescEn, setFullDescEn] = useState('')
  const [fullDescCn, setFullDescCn] = useState('')

  const defaultList = type === 'product'
    ? ['เครื่องดื่ม', 'เบเกอรี่', 'อาหาร', 'ขนมทานเล่น', 'สินค้าทั่วไป']
    : ['บริการคิว', 'นวดสปา', 'ความงาม / ซาลอน', 'ล้างรถ / คาร์แคร์', 'บริการซ่อม / ช่าง']

  const availableCategories = Array.from(new Set([...defaultList, ...(categories || [])]))

  const [category, setCategory] = useState(availableCategories[0] || (type === 'product' ? 'เครื่องดื่ม' : 'บริการคิว'))
  const [isCustomCategory, setIsCustomCategory] = useState(false)
  const [customCategoryName, setCustomCategoryName] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')

  const [images, setImages] = useState<string[]>([])
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [formError, setFormError] = useState('')

  if (!isOpen) return null

  const handleAddImage = () => {
    if (!imageUrlInput.trim()) return
    playTapSound('pop')
    setImages((prev) => [...prev, imageUrlInput.trim()])
    setImageUrlInput('')
  }

  const handleRemoveImage = (index: number) => {
    playTapSound('delete')
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddPresetImage = (url: string) => {
    playTapSound('pop')
    if (images.includes(url)) return
    setImages((prev) => [...prev, url])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    const parsedPrice = Number(price)
    const parsedStock = Number(stock)
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0 || (type === 'product' && (!Number.isFinite(parsedStock) || parsedStock < 0))) {
      setFormError('กรุณาตรวจสอบราคาและสต็อกให้เป็นจำนวนที่ถูกต้อง')
      return
    }
    const finalCat = isCustomCategory && customCategoryName.trim()
      ? customCategoryName.trim()
      : (category || (type === 'product' ? 'สินค้าทั่วไป' : 'บริการทั่วไป'))

    if (isCustomCategory && customCategoryName.trim() && onAddCategory) {
      onAddCategory(customCategoryName.trim())
    }

    const mainName = nameTh || nameEn || nameCn || (type === 'product' ? 'สินค้าใหม่' : 'บริการใหม่')
    const newItem: CatalogItem = {
      id: Date.now().toString(),
      name: mainName,
      nameTh,
      nameEn,
      nameCn,
      category: finalCat,
      type,
      price: parsedPrice,
      stock: type === 'product' ? parsedStock : null,
      shortDescTh,
      shortDescEn,
      shortDescCn,
      fullDescTh,
      fullDescEn,
      fullDescCn,
      images,
      soldCount: 0,
      status: 'active'
    }
    try {
      await onSave(newItem)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'บันทึกข้อมูลไม่สำเร็จ')
      return
    }
    playTapSound('success')

    // Clear form
    setNameTh('')
    setNameEn('')
    setNameCn('')
    setShortDescTh('')
    setShortDescEn('')
    setShortDescCn('')
    setFullDescTh('')
    setFullDescEn('')
    setFullDescCn('')
    setCustomCategoryName('')
    setIsCustomCategory(false)
    setPrice('')
    setStock('')
    setImages([])
    setFormError('')
    onClose()
  }

  return (
    <div className="qs-modal-overlay">
      <div className="qs-modal qs-modal-large">
        <div className="qs-modal-header">
          <div className="qs-modal-header-left">
            <div className={`qs-modal-icon-badge ${type === 'product' ? 'orange' : 'emerald'}`}>
              {type === 'product' ? <Package size={22} /> : <Sparkles size={22} />}
            </div>
            <div>
              <h3>{type === 'product' ? 'เพิ่มสินค้าใหม่ (3 ภาษา & คลังภาพ)' : 'เพิ่มบริการใหม่ (3 ภาษา & คลังภาพ)'}</h3>
              <p>กรอกข้อมูล 3 ภาษา (ไทย/อังกฤษ/จีน), หมวดหมู่, ราคาขาย และแนบรูปภาพหลายรูป</p>
            </div>
          </div>
          <button className="qs-modal-close" onClick={() => { playTapSound('click'); onClose() }} type="button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="qs-modal-body">
            {formError && <div className="merchant-data-alert" role="alert"><ShieldAlert size={18} /><span>{formError}</span></div>}
            {/* 1. Language Tabs Bar */}
            <div className="qs-lang-tabs-container">
              <div className="qs-lang-tabs-header">
                <Languages size={17} color="#059669" />
                <span>ภาษาข้อมูลชื่อและคำอธิบาย (3 ภาษา):</span>
              </div>
              <div className="qs-lang-pills">
                <button
                  type="button"
                  className={`qs-lang-pill ${activeLang === 'th' ? 'active' : ''}`}
                  onClick={() => { playTapSound('pop'); setActiveLang('th') }}
                >
                  <span className="qs-flag-icon">🇹🇭</span>
                  <span>ไทย (TH)</span>
                  {nameTh && <span className="qs-lang-check">✓</span>}
                </button>
                <button
                  type="button"
                  className={`qs-lang-pill ${activeLang === 'en' ? 'active' : ''}`}
                  onClick={() => { playTapSound('pop'); setActiveLang('en') }}
                >
                  <span className="qs-flag-icon">🇬🇧</span>
                  <span>English (EN)</span>
                  {nameEn && <span className="qs-lang-check">✓</span>}
                </button>
                <button
                  type="button"
                  className={`qs-lang-pill ${activeLang === 'cn' ? 'active' : ''}`}
                  onClick={() => { playTapSound('pop'); setActiveLang('cn') }}
                >
                  <span className="qs-flag-icon">🇨🇳</span>
                  <span>中文 (CN)</span>
                  {nameCn && <span className="qs-lang-check">✓</span>}
                </button>
              </div>
            </div>

            {/* 2. Active Language Form Fields */}
            {activeLang === 'th' && (
              <div className="qs-lang-form-box">
                <div className="qs-form-group">
                  <label htmlFor="name-th">ชื่อ{type === 'product' ? 'สินค้า' : 'บริการ'} (ภาษาไทย) *</label>
                  <input
                    id="name-th"
                    value={nameTh}
                    onChange={(e) => setNameTh(e.target.value)}
                    placeholder="เช่น ชาไทยเย็น (แก้วใหญ่) หรือ บริการสปาเท้า"
                    required
                  />
                </div>
                <div className="qs-form-group">
                  <label htmlFor="short-desc-th">คำอธิบายแบบย่อ (Short Description - ไทย)</label>
                  <input
                    id="short-desc-th"
                    value={shortDescTh}
                    onChange={(e) => setShortDescTh(e.target.value)}
                    placeholder="เช่น ชาไทยรสเข้มข้น หอมกลิ่นชาตรามือแท้"
                  />
                </div>
                <div className="qs-form-group">
                  <label htmlFor="full-desc-th">คำอธิบายแบบรายละเอียด (Full Detailed Description - ไทย)</label>
                  <textarea
                    id="full-desc-th"
                    rows={3}
                    value={fullDescTh}
                    onChange={(e) => setFullDescTh(e.target.value)}
                    placeholder="เช่น ชาไทยโบราณสูตรพิเศษ ใช้ใบชาคุณภาพเกรดพรีเมียม ชงสดใหม่ทุกแก้ว เสิร์ฟพร้อมน้ำแข็งเย็นชื่นใจ เลือกระดับความหวานได้ตามใจชอบ"
                  />
                </div>
              </div>
            )}

            {activeLang === 'en' && (
              <div className="qs-lang-form-box">
                <div className="qs-form-group">
                  <label htmlFor="name-en">Name (English)</label>
                  <input
                    id="name-en"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="e.g. Thai Iced Tea (Large) / Foot Spa Massage"
                  />
                </div>
                <div className="qs-form-group">
                  <label htmlFor="short-desc-en">Short Description (English)</label>
                  <input
                    id="short-desc-en"
                    value={shortDescEn}
                    onChange={(e) => setShortDescEn(e.target.value)}
                    placeholder="e.g. Rich authentic Thai tea with condensed milk"
                  />
                </div>
                <div className="qs-form-group">
                  <label htmlFor="full-desc-en">Detailed Description (English)</label>
                  <textarea
                    id="full-desc-en"
                    rows={3}
                    value={fullDescEn}
                    onChange={(e) => setFullDescEn(e.target.value)}
                    placeholder="e.g. Premium grade authentic Thai tea leaves brewed fresh per order. Served with ice and sweetened condensed milk..."
                  />
                </div>
              </div>
            )}

            {activeLang === 'cn' && (
              <div className="qs-lang-form-box">
                <div className="qs-form-group">
                  <label htmlFor="name-cn">名称 (Chinese)</label>
                  <input
                    id="name-cn"
                    value={nameCn}
                    onChange={(e) => setNameCn(e.target.value)}
                    placeholder="例如：泰式冰奶茶 (大杯) / 水疗足按摩"
                  />
                </div>
                <div className="qs-form-group">
                  <label htmlFor="short-desc-cn">简短描述 (Short Description - Chinese)</label>
                  <input
                    id="short-desc-cn"
                    value={shortDescCn}
                    onChange={(e) => setShortDescCn(e.target.value)}
                    placeholder="例如：地道泰式手标奶茶 浓郁香甜"
                  />
                </div>
                <div className="qs-form-group">
                  <label htmlFor="full-desc-cn">详细描述 (Detailed Description - Chinese)</label>
                  <textarea
                    id="full-desc-cn"
                    rows={3}
                    value={fullDescCn}
                    onChange={(e) => setFullDescCn(e.target.value)}
                    placeholder="例如：采用优质泰茶茶叶，现点现冲，配以特调鲜奶与浓缩炼乳，冰爽可口..."
                  />
                </div>
              </div>
            )}

            {/* 3. Category & Price / Stock Grid */}
            <div className="qs-category-price-grid">
              {/* Category Column */}
              <div className="qs-form-category-group">
                <div className="qs-cat-label-row">
                  <label htmlFor="item-cat">
                    <Tag size={14} /> หมวดหมู่{type === 'product' ? 'สินค้า' : 'บริการ'}
                  </label>
                  <button
                    type="button"
                    className="qs-cat-toggle-custom-btn"
                    onClick={() => {
                      playTapSound('pop')
                      setIsCustomCategory(!isCustomCategory)
                    }}
                  >
                    {isCustomCategory ? '‹ เลือกจากหมวดที่มีอยู่' : '+ พิมพ์เพิ่มหมวดใหม่'}
                  </button>
                </div>

                {!isCustomCategory ? (
                  <div className="qs-cat-select-wrap">
                    <select
                      id="item-cat"
                      value={category}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsCustomCategory(true)
                        } else {
                          setCategory(e.target.value)
                        }
                      }}
                    >
                      {availableCategories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="__custom__">✨ + พิมพ์เพิ่มหมวดหมู่ใหม่เอง...</option>
                    </select>
                  </div>
                ) : (
                  <div className="qs-custom-cat-input-box">
                    <input
                      type="text"
                      value={customCategoryName}
                      onChange={(e) => setCustomCategoryName(e.target.value)}
                      placeholder="ระบุชื่อหมวดหมู่ใหม่ เช่น อาหารคลีน, นวดอโรม่า..."
                      autoFocus
                    />
                    <button
                      type="button"
                      className="qs-save-custom-cat-btn"
                      onClick={() => {
                        if (customCategoryName.trim()) {
                          const trimmed = customCategoryName.trim()
                          setCategory(trimmed)
                          if (onAddCategory) onAddCategory(trimmed)
                          setIsCustomCategory(false)
                          setCustomCategoryName('')
                          playTapSound('success')
                        }
                      }}
                    >
                      ใช้หมวดนี้
                    </button>
                  </div>
                )}

                {/* Quick Category Chips */}
                <div className="qs-cat-chips-list">
                  {availableCategories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`qs-cat-chip-btn ${category === c && !isCustomCategory ? 'active' : ''}`}
                      onClick={() => {
                        playTapSound('click')
                        setCategory(c)
                        setIsCustomCategory(false)
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price & Stock Column */}
              <div className="qs-price-stock-box">
                <div className="qs-form-group">
                  <label htmlFor="item-price">ราคาขาย (บาท) *</label>
                  <div className="qs-price-input-wrapper">
                    <span className="qs-currency-prefix">฿</span>
                    <input
                      id="item-price"
                      type="number"
                      min="0"
                      step="any"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                {type === 'product' && (
                  <div className="qs-form-group">
                    <label htmlFor="item-stock">จำนวนสต็อกเริ่มต้น *</label>
                    <div className="qs-stock-input-wrapper">
                      <input
                        id="item-stock"
                        type="number"
                        min="0"
                        value={stock}
                        onChange={(e) => setStock(e.target.value)}
                        placeholder="0"
                        required
                      />
                      <span className="qs-unit-suffix">ชิ้น</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Multiple Images Section */}
            <div className="qs-images-section">
              <div className="qs-images-header">
                <div className="qs-img-header-left">
                  <ImageIcon size={17} color="#059669" />
                  <span>คลังรูปภาพประกอบ (แนบได้หลายภาพ):</span>
                </div>
                {images.length > 0 && (
                  <span className="qs-img-count-chip">{images.length} ภาพ</span>
                )}
              </div>

              <div className="qs-image-input-row">
                <input
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="วาง URL รูปภาพสินค้า หรือคลิกเลือกภาพตัวอย่างด้านล่าง..."
                />
                <button type="button" className="qs-add-img-btn" onClick={handleAddImage}>
                  <Plus size={15} /> เพิ่มรูป
                </button>
              </div>

              {/* Sample Presets */}
              <div className="qs-preset-chips">
                <span className="qs-preset-label">คลิกเลือกภาพตัวอย่าง:</span>
                <button
                  type="button"
                  className="qs-chip-btn"
                  onClick={() => handleAddPresetImage('/mascot/pos_1_scanning_barcode.png')}
                >
                  📸 สแกนสินค้า
                </button>
                <button
                  type="button"
                  className="qs-chip-btn"
                  onClick={() => handleAddPresetImage('/mascot/kyc_10_holding_pen.png')}
                >
                  ✍️ ปากกาบริการ
                </button>
                <button
                  type="button"
                  className="qs-chip-btn"
                  onClick={() => handleAddPresetImage('/mascot/pay_1_holding_coin.png')}
                >
                  🪙 เหรียญชำระเงิน
                </button>
                <button
                  type="button"
                  className="qs-chip-btn"
                  onClick={() => handleAddPresetImage('/mascot/nabtang_welcome.png')}
                >
                  🌟 น้องนับตังค์ 3D
                </button>
              </div>

              {/* Gallery List */}
              {images.length > 0 && (
                <div className="qs-image-thumbnails-grid">
                  {images.map((imgUrl, idx) => (
                    <div key={idx} className="qs-thumb-box">
                      <img src={imgUrl} alt={`ภาพที่ ${idx + 1}`} />
                      <button
                        type="button"
                        className="qs-thumb-del"
                        onClick={() => handleRemoveImage(idx)}
                        title="ลบรูปนี้"
                      >
                        <Trash2 size={12} />
                      </button>
                      <span className="qs-thumb-index">รูปที่ {idx + 1}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="qs-modal-footer">
            <button type="button" className="qs-btn-cancel" onClick={() => { playTapSound('click'); onClose() }}>
              ยกเลิก
            </button>
            <button type="submit" className="qs-btn-submit" disabled={isSaving}>
              {isSaving ? 'กำลังบันทึก...' : `บันทึก${type === 'product' ? 'สินค้า' : 'บริการ'} (${images.length} รูปภาพ)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ItemDetailsModal({
  item,
  onClose
}: {
  item: CatalogItem | null
  onClose: () => void
}) {
  const [activeLang, setActiveLang] = useState<'th' | 'en' | 'cn'>('th')

  if (!item) return null

  const getName = () => {
    if (activeLang === 'en' && item.nameEn) return item.nameEn
    if (activeLang === 'cn' && item.nameCn) return item.nameCn
    return item.nameTh || item.name
  }

  const getShortDesc = () => {
    if (activeLang === 'en' && item.shortDescEn) return item.shortDescEn
    if (activeLang === 'cn' && item.shortDescCn) return item.shortDescCn
    return item.shortDescTh || 'ไม่มีคำอธิบายย่อ'
  }

  const getFullDesc = () => {
    if (activeLang === 'en' && item.fullDescEn) return item.fullDescEn
    if (activeLang === 'cn' && item.fullDescCn) return item.fullDescCn
    return item.fullDescTh || 'ไม่มีคำอธิบายแบบรายละเอียด'
  }

  return (
    <div className="qs-modal-overlay">
      <div className="qs-modal qs-modal-large">
        <div className="qs-modal-header">
          <div>
            <h3>รายละเอียด{item.type === 'product' ? 'สินค้า' : 'บริการ'}: {item.name}</h3>
            <p>หมวดหมู่: {item.category} · ราคา ฿{item.price.toLocaleString()}</p>
          </div>
          <button className="qs-modal-close" onClick={() => { playTapSound('click'); onClose() }} type="button">
            <X size={20} />
          </button>
        </div>

        <div className="qs-modal-body">
          {/* Gallery view */}
          {item.images && item.images.length > 0 && (
            <div className="qs-details-gallery-box">
              <label className="qs-field-group-label">🖼️ คลังรูปภาพประกอบ ({item.images.length} ภาพ):</label>
              <div className="qs-gallery-row">
                {item.images.map((img, idx) => (
                  <div className="qs-gallery-thumb-item" key={idx}>
                    <img src={img} alt={`รูปที่ ${idx + 1}`} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3-Language switcher bar */}
          <div className="qs-lang-tabs-container">
            <div className="qs-lang-tabs-header">
              <Languages size={16} color="#059669" />
              <span>สลับดูข้อมูลภาษาต่าง ๆ (3 ภาษา):</span>
            </div>
            <div className="qs-lang-pills">
              <button
                type="button"
                className={`qs-lang-pill ${activeLang === 'th' ? 'active' : ''}`}
                onClick={() => { playTapSound('pop'); setActiveLang('th') }}
              >
                🇹🇭 ไทย (TH)
              </button>
              <button
                type="button"
                className={`qs-lang-pill ${activeLang === 'en' ? 'active' : ''}`}
                onClick={() => { playTapSound('pop'); setActiveLang('en') }}
              >
                🇬🇧 English (EN) {item.nameEn ? '✓' : ''}
              </button>
              <button
                type="button"
                className={`qs-lang-pill ${activeLang === 'cn' ? 'active' : ''}`}
                onClick={() => { playTapSound('pop'); setActiveLang('cn') }}
              >
                🇨🇳 中文 (CN) {item.nameCn ? '✓' : ''}
              </button>
            </div>
          </div>

          <div className="qs-details-content-card">
            <h4 style={{ margin: '0 0 12px', fontSize: '20px', color: '#0f172a', fontWeight: 900 }}>
              {getName()}
            </h4>

            <div className="qs-desc-block">
              <h5>📝 คำอธิบายแบบย่อ (Short Description):</h5>
              <p>{getShortDesc()}</p>
            </div>

            <div className="qs-desc-block">
              <h5>📄 คำอธิบายแบบรายละเอียด (Full Detailed Description):</h5>
              <p>{getFullDesc()}</p>
            </div>

            {/* Direct Booking Link Section */}
            <div style={{ marginTop: '16px', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '12px', padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '13px', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Globe size={15} color="#16a34a" /> ลิงก์หน้าร้านสำหรับจอง {item.type === 'service' ? 'บริการ' : 'สินค้า'} นี้:
                </strong>
                <span style={{ fontSize: '11px', color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                  Online Live
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/booking?service=${item.id}`}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #86efac',
                    background: '#ffffff',
                    fontSize: '12px',
                    color: '#0f172a',
                    fontFamily: 'monospace'
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(`${window.location.origin}/booking?service=${item.id}`)
                    playTapSound('success')
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Copy size={13} /> คัดลอกลิงก์
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playTapSound('nav')
                    window.open(`/booking?service=${item.id}`, '_blank')
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <ArrowUpRight size={13} /> เปิดดูหน้าเว็บ
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="qs-modal-footer">
          <button type="button" className="qs-btn-submit" onClick={() => { playTapSound('click'); onClose() }}>
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   PRODUCTS VIEW (หน้าจัดการสินค้าและคลังสต็อก)
   ========================================================================== */
function catalogItemFromDb(product: DbProductRow): CatalogItem {
  return {
    id: product.id,
    name: product.name,
    nameTh: product.name,
    category: product.category || 'สินค้าทั่วไป',
    type: 'product',
    price: Number(product.price) || 0,
    stock: Number(product.stock) || 0,
    soldCount: 0,
    status: product.isActive ? ((Number(product.stock) || 0) === 0 ? 'out_of_stock' : 'active') : 'paused',
    shortDescTh: product.description || '',
    images: product.image ? [product.image] : [],
    updatedAt: product.updatedAt,
  }
}

function ProductsView({ storeId }: { storeId: string | null }) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [productCategories, setProductCategories] = useState<string[]>(['เครื่องดื่ม', 'เบเกอรี่', 'อาหาร', 'ขนมทานเล่น', 'สินค้าทั่วไป'])
  const [productState, setProductState] = useState<'loading' | 'ready' | 'empty' | 'error'>(storeId ? 'loading' : 'empty')
  const [productError, setProductError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const [activeFilter, setActiveFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [isQuickAddCatOpen, setIsQuickAddCatOpen] = useState(false)
  const [newCatInput, setNewCatInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const loadProducts = async () => {
    if (!storeId) {
      setCatalog([])
      setProductState('empty')
      return
    }
    setProductState('loading')
    setProductError('')
    const result = await fetchDbProductsResult(storeId)
    if (result.error) {
      setProductState('error')
      setProductError(result.error)
      return
    }
    const products = result.data.map(catalogItemFromDb)
    setCatalog(products)
    setProductCategories((current) => Array.from(new Set([...current, ...products.map((product) => product.category)])))
    setProductState(products.length ? 'ready' : 'empty')
  }

  useEffect(() => {
    void loadProducts()
  }, [storeId])

  const handleAddCategory = (newCat: string) => {
    const trimmed = newCat.trim()
    if (!trimmed) return
    if (!productCategories.includes(trimmed)) {
      const updated = [...productCategories, trimmed]
      setProductCategories(updated)
    }
  }

  const handleSaveProduct = async (newItem: CatalogItem) => {
    if (!storeId) throw new Error('ยังไม่มี Store ที่เลือก')
    setIsSaving(true)
    try {
      const response = await createDbProduct({
        storeId,
        name: newItem.name,
        description: newItem.fullDescTh || newItem.shortDescTh || null,
        price: newItem.price,
        stock: newItem.stock ?? 0,
        category: newItem.category,
        image: newItem.images?.[0] || null,
        isActive: true,
        trackStock: true,
      })
      const savedProduct = catalogItemFromDb(response.product)
      setCatalog((current) => [savedProduct, ...current])
      if (savedProduct.category) handleAddCategory(savedProduct.category)
      setProductState('ready')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateProduct = async (updates: { name: string; price: number; stock: number; category: string; image: string | null }) => {
    if (!selectedItem) return
    const currentProduct = catalog.find((product) => product.id === selectedItem.id)
    if (!currentProduct) return
    setIsSaving(true)
    try {
      const response = await updateDbProduct(selectedItem.id, { ...updates, expectedUpdatedAt: (selectedItem as CatalogItem & { updatedAt?: string }).updatedAt })
      const updatedProduct = catalogItemFromDb(response.product)
      setCatalog((current) => current.map((product) => product.id === updatedProduct.id ? updatedProduct : product))
      setSelectedItem(updatedProduct)
      if (updatedProduct.category) handleAddCategory(updatedProduct.category)
      setIsEditModalOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  const filteredProducts = catalog.filter((item) => {
    const matchesQuery =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.nameEn && item.nameEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.nameCn && item.nameCn.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory

    if (!matchesCategory) return false

    if (activeFilter === 'in_stock') return matchesQuery && (item.stock ?? 0) > 10
    if (activeFilter === 'low_stock') return matchesQuery && (item.stock ?? 0) > 0 && (item.stock ?? 0) <= 10
    if (activeFilter === 'out_of_stock') return matchesQuery && (item.stock ?? 0) === 0
    return matchesQuery
  })

  return (
    <div className="queue-services-page">
      {productError && <div className="merchant-data-alert" role="alert"><ShieldAlert size={18} /><span>{productError}</span><button type="button" onClick={() => { void loadProducts() }} disabled={productState === 'loading'}><RefreshCw size={14} /> ลองใหม่</button></div>}
      {productState === 'loading' && <div className="merchant-transaction-state" aria-busy="true"><RefreshCw size={24} className="spin" /><span>กำลังโหลดสินค้าและสต็อก</span></div>}
      {/* Action Hero Cards */}
      <section className="ov-hero-action-cards">
        <div
          className="qs-card qs-card-orange"
          onClick={() => { playTapSound('pop'); setIsAddModalOpen(true) }}
          role="button"
          tabIndex={0}
        >
          <div className="qs-card-icon-wrap qs-plus-icon">
            <Plus size={22} />
          </div>
          <div className="qs-card-text">
            <h3>เพิ่มสินค้าใหม่</h3>
            <p>รองรับ 3 ภาษา & คลังภาพ</p>
          </div>
          <img src="/mascot/pos_1_scanning_barcode.png" className="qs-card-mascot-img" alt="เพิ่มสินค้า" />
        </div>

        <div
          className="qs-card qs-card-blue"
          onClick={() => { playTapSound('click'); alert('จัดการคลังสินค้า') }}
          role="button"
          tabIndex={0}
        >
          <div className="qs-card-icon-wrap">
            <Package size={22} />
          </div>
          <div className="qs-card-text">
            <h3>สต็อกสินค้าคงเหลือ</h3>
          </div>
          <img src="/mascot/pos_5_inventory_check.png" className="qs-card-mascot-img" alt="สต็อก" />
        </div>
      </section>

      {/* Main Section Header */}
      <section className="qs-section-header">
        <div className="qs-section-title-wrap">
          <div>
            <h2>คลังสินค้าและสต็อก (Products & Stock)</h2>
            <span className="qs-count-badge">
              <Package size={13} />
              {filteredProducts.length} รายการ
            </span>
          </div>

          <div className="qs-excel-actions">
            <button
              type="button"
              className="qs-excel-btn import"
              onClick={() => {
                playTapSound('pop')
                const fileInput = document.createElement('input')
                fileInput.type = 'file'
                fileInput.accept = '.csv,.xlsx'
                fileInput.onchange = () => {
                  playTapSound('success')
                  alert('นำเข้าข้อมูลสินค้าผ่าน Excel/CSV สำเร็จ! อัปเดตรายการสินค้าใหม่เรียบร้อยแล้ว')
                }
                fileInput.click()
              }}
            >
              📥 นำเข้า Excel/CSV
            </button>

            <button
              type="button"
              className="qs-excel-btn export"
              onClick={() => {
                playTapSound('success')
                alert('ดาวน์โหลดไฟล์รายการสินค้าคลังสต็อก (Products_Export.xlsx) สำเร็จ!')
              }}
            >
              📤 ส่งออก Excel
            </button>
          </div>
        </div>

        <div className="qs-tab-pills">
          <button
            className={activeFilter === 'all' ? 'active' : ''}
            onClick={() => { playTapSound('pop'); setActiveFilter('all') }}
            type="button"
          >
            สินค้าทั้งหมด ({catalog.length})
          </button>
          <button
            className={activeFilter === 'in_stock' ? 'active' : ''}
            onClick={() => { playTapSound('pop'); setActiveFilter('in_stock') }}
            type="button"
          >
            พร้อมขาย ({catalog.filter((p) => (p.stock ?? 0) > 10).length})
          </button>
          <button
            className={activeFilter === 'low_stock' ? 'active' : ''}
            onClick={() => { playTapSound('pop'); setActiveFilter('low_stock') }}
            type="button"
          >
            สต็อกใกล้หมด ({catalog.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 10).length})
          </button>
          <button
            className={activeFilter === 'out_of_stock' ? 'active' : ''}
            onClick={() => { playTapSound('pop'); setActiveFilter('out_of_stock') }}
            type="button"
          >
            สินค้าหมด ({catalog.filter((p) => (p.stock ?? 0) === 0).length})
          </button>
        </div>

        {/* Category Filter & Quick Add Row */}
        <div className="qs-category-filter-bar">
          <span className="qs-cat-filter-label">
            <Tag size={13} /> หมวดหมู่:
          </span>
          <button
            type="button"
            className={`qs-cat-filter-chip ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => { playTapSound('pop'); setActiveCategory('all') }}
          >
            ทั้งหมด
          </button>
          {productCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`qs-cat-filter-chip ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => { playTapSound('pop'); setActiveCategory(cat) }}
            >
              {cat}
            </button>
          ))}
          
          {!isQuickAddCatOpen ? (
            <button
              type="button"
              className="qs-add-cat-badge-btn"
              onClick={() => { playTapSound('pop'); setIsQuickAddCatOpen(true) }}
            >
              <Plus size={13} /> เพิ่มหมวดใหม่
            </button>
          ) : (
            <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="text"
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                placeholder="ชื่อหมวดใหม่..."
                style={{
                  padding: '4px 10px',
                  borderRadius: '16px',
                  border: '1.5px solid #0284c7',
                  fontSize: '12px',
                  outline: 'none',
                  width: '140px',
                  background: '#ffffff'
                }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCatInput.trim()) {
                    handleAddCategory(newCatInput.trim())
                    setActiveCategory(newCatInput.trim())
                    setNewCatInput('')
                    setIsQuickAddCatOpen(false)
                    playTapSound('success')
                  }
                }}
              />
              <button
                type="button"
                className="qs-save-custom-cat-btn"
                style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '14px' }}
                onClick={() => {
                  if (newCatInput.trim()) {
                    handleAddCategory(newCatInput.trim())
                    setActiveCategory(newCatInput.trim())
                    setNewCatInput('')
                    setIsQuickAddCatOpen(false)
                    playTapSound('success')
                  }
                }}
              >
                เพิ่ม
              </button>
              <button
                type="button"
                style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
                onClick={() => { setIsQuickAddCatOpen(false); setNewCatInput('') }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Table Section */}
      <section className="qs-catalog-panel">
        <div className="qs-search-toolbar">
          <div className="qs-search-box">
            <Search size={16} />
            <input
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อสินค้า (ไทย / EN / 中文)..."
              value={searchQuery}
            />
          </div>
          <button className="qs-filter-btn" onClick={() => playTapSound('click')} type="button">
            <SlidersHorizontal size={15} />
            ตัวกรอง
          </button>
        </div>

        <div className="table-scroll">
          <table className="qs-table">
            <thead>
              <tr>
                <th>รูปภาพ / สินค้า</th>
                <th>รายละเอียด & ภาษา</th>
                <th>ราคาขาย</th>
                <th>จำนวนสต็อก</th>
                <th>ยอดขาย</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((item) => (
                <tr key={item.id} onClick={() => { playTapSound('pop'); setSelectedItem(item) }}>
                  <td>
                    <div className="qs-table-img-cell">
                      {item.images && item.images.length > 0 ? (
                        <div className="qs-table-thumb-wrap">
                          <img src={item.images[0]} alt={item.name} />
                          {item.images.length > 1 && (
                            <span className="qs-thumb-count-badge">+{item.images.length - 1}</span>
                          )}
                        </div>
                      ) : (
                        <div className="qs-no-img-badge">
                          <Package size={16} color="#94a3b8" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="qs-item-info">
                      <strong className="qs-item-title-link">{item.name}</strong>
                      {item.shortDescTh && (
                        <span className="qs-short-desc-line">{item.shortDescTh}</span>
                      )}
                      <div className="qs-lang-badges-row">
                        <span className="qs-lang-tag active">🇹🇭 TH</span>
                        {item.nameEn && <span className="qs-lang-tag active">🇬🇧 EN</span>}
                        {item.nameCn && <span className="qs-lang-tag active">🇨🇳 CN</span>}
                        <span className="qs-cat-tag">หมวด: {item.category}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong className="qs-price">฿{item.price.toLocaleString()}</strong>
                  </td>
                  <td>
                    {(item.stock ?? 0) === 0 ? (
                      <span className="qs-stock-status qs-stock-low">
                        ❌ สินค้าหมด (0 ชิ้น)
                      </span>
                    ) : (item.stock ?? 0) <= 10 ? (
                      <span className="qs-stock-status qs-stock-low">
                        ⚠️ สต็อกต่ำ ({item.stock} ชิ้น)
                      </span>
                    ) : (
                      <span className="qs-stock-status qs-stock-ok">
                        คงเหลือ {item.stock} ชิ้น
                      </span>
                    )}
                  </td>
                  <td className="muted">{item.soldCount} ชิ้น</td>
                  <td>
                    <button
                      className="qs-edit-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        playTapSound('pop')
                        setSelectedItem(item)
                        setIsEditModalOpen(true)
                      }}
                      type="button"
                    >
                      ดูข้อมูล/แก้ไข
                    </button>
                  </td>
                </tr>
              ))}
              {productState === 'empty' && <tr><td colSpan={6}><div className="merchant-transaction-state">ยังไม่มีสินค้าใน Store นี้</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Item Form Modal */}
      <ItemFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        type="product"
        onSave={handleSaveProduct}
        categories={productCategories}
        onAddCategory={handleAddCategory}
        isSaving={isSaving}
      />

      {/* Item Details Modal */}
      <ItemDetailsModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
      <ProductEditModal
        item={isEditModalOpen ? selectedItem : null}
        isSaving={isSaving}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleUpdateProduct}
      />
    </div>
  )
}


function ProductEditModal({ item, isSaving, onClose, onSave }: { item: CatalogItem | null; isSaving: boolean; onClose: () => void; onSave: (updates: { name: string; price: number; stock: number; category: string; image: string | null }) => Promise<void> }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [category, setCategory] = useState('')
  const [image, setImage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!item) return
    setName(item.name)
    setPrice(String(item.price))
    setStock(String(item.stock ?? 0))
    setCategory(item.category)
    setImage(item.images?.[0] || '')
    setError('')
  }, [item])

  if (!item) return null

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const parsedPrice = Number(price)
    const parsedStock = Number(stock)
    if (!name.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0 || !Number.isFinite(parsedStock) || parsedStock < 0 || image.startsWith('data:')) {
      setError('กรุณาตรวจสอบชื่อ ราคา สต็อก และรูปภาพให้ถูกต้อง')
      return
    }
    setError('')
    try {
      await onSave({ name: name.trim(), price: parsedPrice, stock: parsedStock, category: category.trim(), image: image.trim() || null })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'บันทึกสินค้าไม่สำเร็จ')
    }
  }

  return (
    <div className="qs-modal-overlay" role="presentation">
      <div className="qs-modal" role="dialog" aria-modal="true" aria-labelledby="product-edit-title">
        <div className="qs-modal-header"><div><h3 id="product-edit-title">แก้ไขสินค้า</h3><p>บันทึกข้อมูลกลับไปยัง Product API ของ Store</p></div><button className="qs-modal-close" onClick={onClose} type="button" aria-label="ปิด"><X size={20} /></button></div>
        <form onSubmit={(event) => { void handleSubmit(event) }}>
          <div className="qs-modal-body">
            {error && <div className="merchant-data-alert" role="alert"><ShieldAlert size={18} /><span>{error}</span></div>}
            <div className="qs-form-group"><label htmlFor="product-edit-name">ชื่อสินค้า</label><input id="product-edit-name" value={name} onChange={(event) => setName(event.target.value)} required /></div>
            <div className="qs-category-price-grid"><div className="qs-form-group"><label htmlFor="product-edit-price">ราคาขาย</label><input id="product-edit-price" type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required /></div><div className="qs-form-group"><label htmlFor="product-edit-stock">สต็อก</label><input id="product-edit-stock" type="number" min="0" step="1" value={stock} onChange={(event) => setStock(event.target.value)} required /></div></div>
            <div className="qs-form-group"><label htmlFor="product-edit-category">หมวดหมู่</label><input id="product-edit-category" value={category} onChange={(event) => setCategory(event.target.value)} /></div>
            <div className="qs-form-group"><label htmlFor="product-edit-image">URL รูปภาพ</label><input id="product-edit-image" type="url" value={image} onChange={(event) => setImage(event.target.value)} placeholder="https://... หรือ /assets/..." /></div>
          </div>
          <div className="qs-modal-footer"><button type="button" className="qs-btn-cancel" onClick={onClose}>ยกเลิก</button><button type="submit" className="qs-btn-submit" disabled={isSaving}>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}</button></div>
        </form>
      </div>
    </div>
  )
}
/* ==========================================================================
   SERVICES VIEW (หน้าจัดการบริการและคิวลูกค้า)
   ========================================================================== */
function ServicesView() {
  const [catalog, setCatalog] = useState<CatalogItem[]>(
    initialCatalog.filter((i) => i.type === 'service')
  )
  const [serviceCategories, setServiceCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('merchant_service_categories')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error(e)
      }
    }
    return ['บริการคิว', 'นวดสปา', 'ความงาม / ซาลอน', 'ล้างรถ / คาร์แคร์', 'บริการซ่อม / ช่าง']
  })

  // Online Bookings State (Synced with localStorage from /booking)
  const [bookings, setBookings] = useState<any[]>(() => {
    const saved = localStorage.getItem('merchant_service_bookings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      } catch (e) {
        console.error(e)
      }
    }
    // Default initial mock bookings if none
    return [
      {
        id: 'BK-89421',
        serviceId: '2',
        serviceName: 'บริการตัดผมชาย + สระเซ็ต',
        servicePrice: 250,
        customerName: 'คุณกิตติศักดิ์ ชัยมงคล',
        customerPhone: '081-998-7766',
        guestCount: 1,
        bookingDate: new Date().toISOString().split('T')[0],
        bookingTime: '14:00',
        specialNotes: 'ขอช่างตัดสไตล์เกาหลี',
        paymentMethod: 'promptpay',
        isPaid: true,
        status: 'confirmed',
        createdAt: new Date().toISOString()
      },
      {
        id: 'BK-89422',
        serviceId: '4',
        serviceName: 'บริการสปาเท้ารวมนวดกดจุด 45 นาที',
        servicePrice: 350,
        customerName: 'คุณวริศรา นภากุล',
        customerPhone: '089-123-4567',
        guestCount: 2,
        bookingDate: new Date().toISOString().split('T')[0],
        bookingTime: '16:30',
        specialNotes: 'จองพร้อมกัน 2 ท่าน',
        paymentMethod: 'store',
        isPaid: false,
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    ]
  })

  const [activeTab, setActiveTab] = useState<'services' | 'bookings' | 'paid'>('services')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [bookingFilterStatus, setBookingFilterStatus] = useState<string>('all')
  const [isQuickAddCatOpen, setIsQuickAddCatOpen] = useState(false)
  const [newCatInput, setNewCatInput] = useState('')
  const [paidList] = useState<PaidTransaction[]>(initialPaidList)
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null)

  // Booking Link & QR Code Modal States
  const [copiedServiceId, setCopiedServiceId] = useState<string | null>(null)
  const [serviceQrModal, setServiceQrModal] = useState<{ title: string; subtitle: string; url: string; qrDataUrl?: string } | null>(null)

  // Management Form States
  const [isManualBookingOpen, setIsManualBookingOpen] = useState(false)
  const [editingBooking, setEditingBooking] = useState<any | null>(null)
  const [isBookingSettingsOpen, setIsBookingSettingsOpen] = useState(false)

  // Listen to live booking additions from Customer /booking tab
  useEffect(() => {
    const handleSyncBookings = () => {
      try {
        const saved = localStorage.getItem('merchant_service_bookings')
        if (saved) {
          setBookings(JSON.parse(saved))
        }
      } catch (e) {
        console.error(e)
      }
    }
    window.addEventListener('storage', handleSyncBookings)
    return () => window.removeEventListener('storage', handleSyncBookings)
  }, [])

  useEffect(() => {
    if (serviceQrModal?.url) {
      generateUrlQrDataUrl(serviceQrModal.url, 260)
        .then((qr) => setServiceQrModal((prev) => prev ? { ...prev, qrDataUrl: qr } : null))
        .catch(console.error)
    }
  }, [serviceQrModal?.url])

  const handleCopyBookingLink = (url: string, id: string) => {
    navigator.clipboard?.writeText(url)
    setCopiedServiceId(id)
    playTapSound('success')
    setTimeout(() => setCopiedServiceId(null), 2000)
  }

  const handleAddCategory = (newCat: string) => {
    const trimmed = newCat.trim()
    if (!trimmed) return
    if (!serviceCategories.includes(trimmed)) {
      const updated = [...serviceCategories, trimmed]
      setServiceCategories(updated)
      localStorage.setItem('merchant_service_categories', JSON.stringify(updated))
    }
  }

  const handleSaveService = (newItem: CatalogItem) => {
    setCatalog([newItem, ...catalog])
    if (newItem.category) {
      handleAddCategory(newItem.category)
    }
  }

  const handleSaveManualBooking = (newRecord: any) => {
    const updated = [newRecord, ...bookings]
    setBookings(updated)
    localStorage.setItem('merchant_service_bookings', JSON.stringify(updated))
    window.dispatchEvent(new Event('storage'))
    playTapSound('success')
  }

  const handleSaveEditBooking = (updatedRecord: any) => {
    const updated = bookings.map(b => b.id === updatedRecord.id ? updatedRecord : b)
    setBookings(updated)
    localStorage.setItem('merchant_service_bookings', JSON.stringify(updated))
    window.dispatchEvent(new Event('storage'))
    playTapSound('success')
  }

  const handleDeleteBooking = (bookingId: string) => {
    if (window.confirm(`ยืนยันการลบรายการจองคิว #${bookingId} ใช่หรือไม่?`)) {
      const updated = bookings.filter(b => b.id !== bookingId)
      setBookings(updated)
      localStorage.setItem('merchant_service_bookings', JSON.stringify(updated))
      window.dispatchEvent(new Event('storage'))
      playTapSound('delete')
    }
  }

  const handleUpdateBookingStatus = (bookingId: string, newStatus: 'pending' | 'confirmed' | 'in_service' | 'completed' | 'cancelled') => {
    const updated = bookings.map(b => b.id === bookingId ? { ...b, status: newStatus } : b)
    setBookings(updated)
    localStorage.setItem('merchant_service_bookings', JSON.stringify(updated))
    window.dispatchEvent(new Event('storage'))
    playTapSound('success')
  }

  const filteredServices = catalog.filter((item) => {
    const matchesQuery =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.nameEn && item.nameEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.nameCn && item.nameCn.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory

    return matchesQuery && matchesCategory
  })

  const filteredBookings = bookings.filter((b) => {
    const matchStatus = bookingFilterStatus === 'all' || b.status === bookingFilterStatus
    const matchQuery =
      b.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.customerPhone.includes(searchQuery) ||
      b.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.id.toLowerCase().includes(searchQuery.toLowerCase())
    return matchStatus && matchQuery
  })

  const pendingBookingsCount = bookings.filter(b => b.status === 'pending').length
  const activeBookingsCount = bookings.filter(b => b.status === 'pending' || b.status === 'confirmed').length

  return (
    <div className="queue-services-page">
      {/* Hero Cards */}
      <section className="qs-hero-cards">
        <div
          className={`qs-card qs-card-green ${activeTab === 'bookings' ? 'active' : ''}`}
          onClick={() => { playTapSound('nav'); setActiveTab('bookings') }}
          role="button"
          tabIndex={0}
        >
          <div className="qs-card-icon-wrap" style={{ position: 'relative' }}>
            <Calendar size={22} />
            {pendingBookingsCount > 0 && (
              <span className="qs-hero-badge-pill">{pendingBookingsCount}</span>
            )}
          </div>
          <div className="qs-card-text">
            <h3>คิวจองออนไลน์</h3>
            <p>{activeBookingsCount} คิวรอดำเนินการ</p>
          </div>
          <img src="/mascot/nabtang_welcome.png" className="qs-card-mascot-img" alt="คิวจองออนไลน์" />
        </div>

        <div
          className={`qs-card qs-card-blue ${activeTab === 'services' ? 'active' : ''}`}
          onClick={() => { playTapSound('nav'); setActiveTab('services') }}
          role="button"
          tabIndex={0}
        >
          <div className="qs-card-icon-wrap">
            <Settings size={22} />
          </div>
          <div className="qs-card-text">
            <h3>จัดการบริการ</h3>
            <p>{catalog.length} รายการบริการ</p>
          </div>
          <img src="/mascot/pos_5_inventory_check.png" className="qs-card-mascot-img" alt="จัดการบริการ" />
        </div>

        <div
          className="qs-card qs-card-emerald"
          onClick={() => { playTapSound('pop'); setIsManualBookingOpen(true) }}
          role="button"
          tabIndex={0}
          style={{ background: 'linear-gradient(135deg, #057a44 0%, #034b29 100%)', color: '#ffffff' }}
        >
          <div className="qs-card-icon-wrap qs-plus-icon" style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff' }}>
            <Plus size={24} />
          </div>
          <div className="qs-card-text">
            <h3 style={{ color: '#ffffff' }}>+ บันทึกคิวจอง</h3>
            <p style={{ color: '#bbf7d0' }}>Walk-in / โทรจองหน้าร้าน</p>
          </div>
          <img src="/mascot/mascot_1_pos_terminal.png" className="qs-card-mascot-img" alt="บันทึกคิวจอง" />
        </div>

        <div
          className="qs-card qs-card-orange"
          onClick={() => { playTapSound('pop'); setIsAddModalOpen(true) }}
          role="button"
          tabIndex={0}
        >
          <div className="qs-card-icon-wrap qs-plus-icon">
            <Plus size={24} />
          </div>
          <div className="qs-card-text">
            <h3>เพิ่มบริการใหม่</h3>
            <p>รองรับ 3 ภาษา & คลังภาพ</p>
          </div>
          <img src="/mascot/kyc_10_holding_pen.png" className="qs-card-mascot-img" alt="เพิ่มบริการใหม่" />
        </div>
      </section>

      {/* Online Booking Portal Quick Banner */}
      <div className="qs-booking-portal-bar">
        <div className="qs-portal-left">
          <div className="qs-portal-icon">
            <Globe size={22} color="#0284c7" />
          </div>
          <div className="qs-portal-info">
            <div className="qs-portal-badge-row">
              <strong>🌐 ลิงก์หน้ารวมจองบริการออนไลน์ (Online Booking Portal)</strong>
              <span className="qs-portal-live-pill">🟢 ลิงก์พร้อมใช้งาน</span>
            </div>
            <p className="qs-portal-url-text">{window.location.origin}/booking</p>
          </div>
        </div>
        <div className="qs-portal-actions">
          <button
            type="button"
            className="qs-portal-action-btn settings"
            style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155' }}
            onClick={() => {
              playTapSound('pop')
              setIsBookingSettingsOpen(true)
            }}
          >
            <Settings size={14} /> <span>ตั้งค่าหน้าจอง</span>
          </button>
          <button
            type="button"
            className="qs-portal-action-btn copy"
            onClick={() => handleCopyBookingLink(`${window.location.origin}/booking`, 'portal-link')}
          >
            {copiedServiceId === 'portal-link' ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedServiceId === 'portal-link' ? 'คัดลอกสำเร็จ!' : 'คัดลอกลิงก์จอง'}</span>
          </button>
          <button
            type="button"
            className="qs-portal-action-btn qr"
            onClick={() => {
              playTapSound('pop')
              setServiceQrModal({
                title: 'QR Code จองบริการทั้งหมด',
                subtitle: 'สแกนเพื่อเปิดหน้ารวมบริการและจองคิวออนไลน์',
                url: `${window.location.origin}/booking`
              })
            }}
          >
            <QrCode size={14} /> <span>QR Code</span>
          </button>
          <button
            type="button"
            className="qs-portal-action-btn open"
            onClick={() => {
              playTapSound('nav')
              window.open('/booking', '_blank')
            }}
          >
            <ArrowUpRight size={14} /> <span>เปิดดูหน้าจองจริง</span>
          </button>
        </div>
      </div>

      {/* Main Section Header */}
      <section className="qs-section-header">
        <div className="qs-section-title-wrap">
          <h2>
            {activeTab === 'bookings'
              ? 'รายการคิวจองออนไลน์ (Online Bookings)'
              : activeTab === 'paid'
              ? 'รายการชำระแล้ว'
              : 'รายการบริการร้านค้า (Services)'}
          </h2>
          <span className="qs-count-badge">
            <Tag size={13} />
            {activeTab === 'bookings'
              ? `${filteredBookings.length} คิว`
              : activeTab === 'paid'
              ? `${paidList.length} รายการ`
              : `${filteredServices.length} รายการ`}
          </span>
        </div>

        <div className="qs-tab-pills">
          <button
            className={activeTab === 'bookings' ? 'active' : ''}
            onClick={() => { playTapSound('nav'); setActiveTab('bookings') }}
            type="button"
          >
            📅 คิวจองออนไลน์ ({bookings.length})
            {pendingBookingsCount > 0 && <span className="qs-tab-count-bubble">{pendingBookingsCount}</span>}
          </button>
          <button
            className={activeTab === 'services' ? 'active' : ''}
            onClick={() => { playTapSound('nav'); setActiveTab('services') }}
            type="button"
          >
            บริการคิวทั้งหมด ({catalog.length})
          </button>
          <button
            className={activeTab === 'paid' ? 'active' : ''}
            onClick={() => { playTapSound('nav'); setActiveTab('paid') }}
            type="button"
          >
            รายการชำระแล้ว ({paidList.length})
          </button>
        </div>

        {/* Status Filter for Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="qs-category-filter-bar">
            <span className="qs-cat-filter-label">
              <Clock size={13} /> สถานะคิว:
            </span>
            <button
              type="button"
              className={`qs-cat-filter-chip ${bookingFilterStatus === 'all' ? 'active' : ''}`}
              onClick={() => { playTapSound('pop'); setBookingFilterStatus('all') }}
            >
              ทั้งหมด ({bookings.length})
            </button>
            <button
              type="button"
              className={`qs-cat-filter-chip ${bookingFilterStatus === 'pending' ? 'active' : ''}`}
              onClick={() => { playTapSound('pop'); setBookingFilterStatus('pending') }}
            >
              🟡 รอรับบริการ ({bookings.filter(b => b.status === 'pending').length})
            </button>
            <button
              type="button"
              className={`qs-cat-filter-chip ${bookingFilterStatus === 'confirmed' ? 'active' : ''}`}
              onClick={() => { playTapSound('pop'); setBookingFilterStatus('confirmed') }}
            >
              🟢 ยืนยันแล้ว ({bookings.filter(b => b.status === 'confirmed').length})
            </button>
            <button
              type="button"
              className={`qs-cat-filter-chip ${bookingFilterStatus === 'in_service' ? 'active' : ''}`}
              onClick={() => { playTapSound('pop'); setBookingFilterStatus('in_service') }}
            >
              ⏳ กำลังให้บริการ ({bookings.filter(b => b.status === 'in_service').length})
            </button>
            <button
              type="button"
              className={`qs-cat-filter-chip ${bookingFilterStatus === 'completed' ? 'active' : ''}`}
              onClick={() => { playTapSound('pop'); setBookingFilterStatus('completed') }}
            >
              ✅ เสร็จสิ้น ({bookings.filter(b => b.status === 'completed').length})
            </button>
            <button
              type="button"
              className={`qs-cat-filter-chip ${bookingFilterStatus === 'cancelled' ? 'active' : ''}`}
              onClick={() => { playTapSound('pop'); setBookingFilterStatus('cancelled') }}
            >
              ❌ ยกเลิก ({bookings.filter(b => b.status === 'cancelled').length})
            </button>
          </div>
        )}

        {/* Category Filter & Quick Add Row (Services Tab) */}
        {activeTab === 'services' && (
          <div className="qs-category-filter-bar">
            <span className="qs-cat-filter-label">
              <Tag size={13} /> หมวดบริการ:
            </span>
            <button
              type="button"
              className={`qs-cat-filter-chip ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => { playTapSound('pop'); setActiveCategory('all') }}
            >
              ทั้งหมด
            </button>
            {serviceCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`qs-cat-filter-chip ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => { playTapSound('pop'); setActiveCategory(cat) }}
              >
                {cat}
              </button>
            ))}
            
            {!isQuickAddCatOpen ? (
              <button
                type="button"
                className="qs-add-cat-badge-btn"
                onClick={() => { playTapSound('pop'); setIsQuickAddCatOpen(true) }}
              >
                <Plus size={13} /> เพิ่มหมวดบริการใหม่
              </button>
            ) : (
              <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  placeholder="ชื่อหมวดบริการใหม่..."
                  style={{
                    padding: '4px 10px',
                    borderRadius: '16px',
                    border: '1.5px solid #0284c7',
                    fontSize: '12px',
                    outline: 'none',
                    width: '140px',
                    background: '#ffffff'
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCatInput.trim()) {
                      handleAddCategory(newCatInput.trim())
                      setActiveCategory(newCatInput.trim())
                      setNewCatInput('')
                      setIsQuickAddCatOpen(false)
                      playTapSound('success')
                    }
                  }}
                />
                <button
                  type="button"
                  className="qs-save-custom-cat-btn"
                  style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '14px' }}
                  onClick={() => {
                    if (newCatInput.trim()) {
                      handleAddCategory(newCatInput.trim())
                      setActiveCategory(newCatInput.trim())
                      setNewCatInput('')
                      setIsQuickAddCatOpen(false)
                      playTapSound('success')
                    }
                  }}
                >
                  เพิ่ม
                </button>
                <button
                  type="button"
                  style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
                  onClick={() => { setIsQuickAddCatOpen(false); setNewCatInput('') }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {activeTab === 'bookings' ? (
        /* ONLINE BOOKINGS QUEUE PANEL */
        <section className="qs-catalog-panel">
          <div className="qs-search-toolbar">
            <div className="qs-search-box">
              <Search size={16} />
              <input
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, หรือรหัสการจอง..."
                value={searchQuery}
              />
            </div>
            <button
              className="qs-filter-btn"
              onClick={() => {
                const url = `${window.location.origin}/booking`
                window.open(url, '_blank')
              }}
              type="button"
            >
              <ArrowUpRight size={15} />
              เปิดหน้าจองฝั่งลูกค้า
            </button>
          </div>

          <div className="qs-bookings-grid-list">
            {filteredBookings.map((b) => {
              const statusLabels: Record<string, { label: string; color: string; bg: string; border: string }> = {
                pending: { label: '🟡 รอรับบริการ', color: '#854d0e', bg: '#fef9c3', border: '#fef08a' },
                confirmed: { label: '🟢 ยืนยันคิวแล้ว', color: '#15803d', bg: '#dcfce7', border: '#bbf7d0' },
                in_service: { label: '⏳ กำลังให้บริการ', color: '#0369a1', bg: '#e0f2fe', border: '#bae6fd' },
                completed: { label: '✅ เสร็จสิ้นแล้ว', color: '#475569', bg: '#f1f5f9', border: '#e2e8f0' },
                cancelled: { label: '❌ ยกเลิกคิว', color: '#b91c1c', bg: '#fee2e2', border: '#fecaca' }
              }
              const st = statusLabels[b.status] || statusLabels.pending

              return (
                <div key={b.id} className="qs-booking-card">
                  <div className="qs-booking-card-top">
                    <div className="qs-bk-ref-group">
                      <span className="qs-bk-ref-id">#{b.id}</span>
                      <span className="qs-bk-time-badge">
                        <Clock size={12} /> {b.bookingDate} เวลา {b.bookingTime} น.
                      </span>
                    </div>
                    <span
                      className="qs-bk-status-pill"
                      style={{ color: st.color, background: st.bg, borderColor: st.border }}
                    >
                      {st.label}
                    </span>
                  </div>

                  <div className="qs-booking-card-main">
                    <div className="qs-bk-cust-info">
                      <strong className="qs-bk-cust-name">{b.customerName}</strong>
                      <div className="qs-bk-cust-meta">
                        <span>📞 {b.customerPhone}</span>
                        <span>👥 {b.guestCount || 1} ท่าน</span>
                      </div>
                    </div>

                    <div className="qs-bk-service-info">
                      <div className="qs-bk-srv-title">
                        <strong>{b.serviceName}</strong>
                        <span className="qs-bk-srv-price">฿{Number(b.servicePrice).toLocaleString()}</span>
                      </div>
                      <div className="qs-bk-pay-tag">
                        {b.paymentMethod === 'promptpay' ? (
                          <span className="qs-pay-tag-pill paid">🟢 จ่ายแล้ว (PromptPay QR)</span>
                        ) : b.paymentMethod === 'truemoney' ? (
                          <span className="qs-pay-tag-pill paid" style={{ background: '#ffedd5', color: '#c2410c', borderColor: '#fed7aa' }}>🟠 TrueMoney Wallet</span>
                        ) : b.paymentMethod === 'credit_card' ? (
                          <span className="qs-pay-tag-pill paid" style={{ background: '#f3e8ff', color: '#7e22ce', borderColor: '#e9d5ff' }}>💳 บัตรเครดิต/เดบิต</span>
                        ) : b.paymentMethod === 'bank_transfer' ? (
                          <span className="qs-pay-tag-pill unpaid" style={{ background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}>🏦 โอนเงินธนาคาร</span>
                        ) : (
                          <span className="qs-pay-tag-pill unpaid">⚪ ชำระที่หน้าร้าน</span>
                        )}
                      </div>
                    </div>

                    {b.specialNotes && (
                      <div className="qs-bk-notes-box">
                        <small>หมายเหตุ:</small> <span>{b.specialNotes}</span>
                      </div>
                    )}
                  </div>

                  <div className="qs-booking-card-footer">
                    <div className="qs-bk-contact-btns">
                      <a href={`tel:${b.customerPhone}`} className="qs-bk-contact-btn tel" title="โทรหาลูกค้า">
                        <Phone size={13} /> โทร
                      </a>
                      <a
                        href={`https://line.me/ti/p/~@chatpos?text=${encodeURIComponent(
                          `สวัสดีครับ คุณ ${b.customerName} ทางร้านขอแจ้งความคืบหน้าการจองคิว #${b.id}`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="qs-bk-contact-btn line"
                        title="ติดต่อผ่าน LINE"
                      >
                        <MessageCircle size={13} /> LINE
                      </a>
                    </div>

                    <div className="qs-bk-status-action-btns">
                      <button
                        type="button"
                        className="qs-bk-act-btn edit"
                        style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155' }}
                        onClick={() => {
                          playTapSound('pop')
                          setEditingBooking(b)
                        }}
                        title="แก้ไขข้อมูลการจอง"
                      >
                        ✏️ แก้ไข
                      </button>

                      {b.status === 'pending' && (
                        <button
                          type="button"
                          className="qs-bk-act-btn confirm"
                          onClick={() => handleUpdateBookingStatus(b.id, 'confirmed')}
                        >
                          🟢 ยืนยันคิว
                        </button>
                      )}
                      {b.status === 'confirmed' && (
                        <button
                          type="button"
                          className="qs-bk-act-btn inservice"
                          onClick={() => handleUpdateBookingStatus(b.id, 'in_service')}
                        >
                          ⏳ เริ่มบริการ
                        </button>
                      )}
                      {b.status === 'in_service' && (
                        <button
                          type="button"
                          className="qs-bk-act-btn complete"
                          onClick={() => handleUpdateBookingStatus(b.id, 'completed')}
                        >
                          ✅ เสร็จสิ้น
                        </button>
                      )}
                      {b.status !== 'completed' && b.status !== 'cancelled' && (
                        <button
                          type="button"
                          className="qs-bk-act-btn cancel"
                          onClick={() => handleUpdateBookingStatus(b.id, 'cancelled')}
                        >
                          ยกเลิก
                        </button>
                      )}

                      <button
                        type="button"
                        className="qs-bk-act-btn delete"
                        style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c', padding: '4px 8px' }}
                        onClick={() => handleDeleteBooking(b.id)}
                        title="ลบรายการจอง"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {filteredBookings.length === 0 && (
              <div className="qs-empty-bookings-box">
                <Calendar size={40} color="#94a3b8" />
                <h4>ยังไม่มีรายการคิวจองในสถานะนี้</h4>
                <p>เมื่อลูกค้าจองคิวผ่านลิงก์ /booking รายการจะแสดงขึ้นที่นี่โดยอัตโนมัติ</p>
                <button
                  type="button"
                  className="qs-btn-submit"
                  onClick={() => window.open('/booking', '_blank')}
                  style={{ marginTop: '10px' }}
                >
                  <ArrowUpRight size={14} /> ทดสอบเปิดหน้าจองออนไลน์
                </button>
              </div>
            )}
          </div>
        </section>
      ) : activeTab === 'paid' ? (
        <section className="qs-paid-transactions-list">
          {paidList.map((tx) => (
            <div className="qs-paid-card" key={tx.id} onClick={() => playTapSound('click')}>
              <div className="qs-paid-check-wrap">
                <Check size={22} strokeWidth={3} />
              </div>
              <div className="qs-paid-details">
                <strong>{tx.method}</strong>
                <span>{tx.customer}</span>
              </div>
              <div className="qs-paid-amount-wrap">
                <b className="qs-paid-amount">+฿{tx.amount.toFixed(2)}</b>
                <span className="qs-paid-badge">ชำระแล้ว</span>
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="qs-catalog-panel">
          <div className="qs-search-toolbar">
            <div className="qs-search-box">
              <Search size={16} />
              <input
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อบริการ (ไทย / EN / 中文)..."
                value={searchQuery}
              />
            </div>
            <button className="qs-filter-btn" onClick={() => playTapSound('click')} type="button">
              <SlidersHorizontal size={15} />
              ตัวกรอง
            </button>
          </div>

          <div className="table-scroll">
            <table className="qs-table">
              <thead>
                <tr>
                  <th>รูปภาพ / บริการ</th>
                  <th>รายละเอียด & ภาษา</th>
                  <th>ราคาบริการ</th>
                  <th>สถานะบริการ</th>
                  <th>ยอดขาย</th>
                  <th>ลิงก์ & การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((item) => (
                  <tr key={item.id} onClick={() => { playTapSound('pop'); setSelectedItem(item) }}>
                    <td>
                      <div className="qs-table-img-cell">
                        {item.images && item.images.length > 0 ? (
                          <div className="qs-table-thumb-wrap">
                            <img src={item.images[0]} alt={item.name} />
                            {item.images.length > 1 && (
                              <span className="qs-thumb-count-badge">+{item.images.length - 1}</span>
                            )}
                          </div>
                        ) : (
                          <div className="qs-no-img-badge">
                            <Sparkles size={16} color="#0d7850" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="qs-item-info">
                        <strong className="qs-item-title-link">{item.name}</strong>
                        {item.shortDescTh && (
                          <span className="qs-short-desc-line">{item.shortDescTh}</span>
                        )}
                        <div className="qs-lang-badges-row">
                          <span className="qs-lang-tag active">🇹🇭 TH</span>
                          {item.nameEn && <span className="qs-lang-tag active">🇬🇧 EN</span>}
                          {item.nameCn && <span className="qs-lang-tag active">🇨🇳 CN</span>}
                          <span className="qs-cat-tag">หมวด: {item.category}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong className="qs-price">฿{item.price.toLocaleString()}</strong>
                    </td>
                    <td>
                      <span className="qs-stock-status qs-stock-unlimited">
                        <CheckCircle2 size={13} /> เปิดให้บริการ
                      </span>
                    </td>
                    <td className="muted">{item.soldCount} ครั้ง</td>
                    <td>
                      <div className="qs-action-btn-group" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          className="qs-portal-btn-inline open"
                          onClick={(e) => {
                            e.stopPropagation()
                            playTapSound('nav')
                            window.open(`/booking?service=${item.id}`, '_blank')
                          }}
                          title="เปิดหน้าจองบริการนี้ในแท็บใหม่"
                          type="button"
                          style={{
                            padding: '5px 9px',
                            borderRadius: '8px',
                            background: '#0f172a',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <ArrowUpRight size={12} /> เปิดจอง
                        </button>
                        <button
                          className="qs-portal-btn-inline copy"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopyBookingLink(`${window.location.origin}/booking?service=${item.id}`, item.id)
                          }}
                          title="คัดลอกลิงก์จองบริการนี้"
                          type="button"
                          style={{
                            padding: '5px 9px',
                            borderRadius: '8px',
                            background: '#f0fdf4',
                            border: '1px solid #86efac',
                            color: '#166534',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {copiedServiceId === item.id ? <Check size={12} /> : <Link size={12} />}
                          <span>{copiedServiceId === item.id ? 'คัดลอกแล้ว' : 'ลิงก์'}</span>
                        </button>
                        <button
                          className="qs-portal-btn-inline qr"
                          onClick={(e) => {
                            e.stopPropagation()
                            playTapSound('pop')
                            setServiceQrModal({
                              title: `QR Code: ${item.name}`,
                              subtitle: `ราคา ฿${item.price.toLocaleString()} · สแกนเพื่อเปิดหน้าจองทันที`,
                              url: `${window.location.origin}/booking?service=${item.id}`
                            })
                          }}
                          title="ดู QR Code สำหรับจองบริการนี้"
                          type="button"
                          style={{
                            padding: '5px 8px',
                            borderRadius: '8px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            color: '#475569',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <QrCode size={12} />
                        </button>
                        <button
                          className="qs-edit-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            playTapSound('pop')
                            setSelectedItem(item)
                          }}
                          type="button"
                        >
                          ดู/แก้ไข
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Item Form Modal */}
      <ItemFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        type="service"
        onSave={handleSaveService}
        categories={serviceCategories}
        onAddCategory={handleAddCategory}
      />

      {/* Item Details Modal */}
      <ItemDetailsModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />

      {/* Manual Booking Modal (Walk-in / Phone-in) */}
      <ManualBookingModal
        isOpen={isManualBookingOpen}
        onClose={() => setIsManualBookingOpen(false)}
        services={catalog}
        onSave={handleSaveManualBooking}
      />

      {/* Edit Booking Modal */}
      <EditBookingModal
        booking={editingBooking}
        services={catalog}
        onClose={() => setEditingBooking(null)}
        onSave={handleSaveEditBooking}
        onDelete={handleDeleteBooking}
      />

      {/* Booking Portal Settings Modal */}
      <BookingSettingsModal
        isOpen={isBookingSettingsOpen}
        onClose={() => setIsBookingSettingsOpen(false)}
      />

      {/* Service Booking QR Code Modal */}
      {serviceQrModal && (
        <div className="qs-modal-overlay" style={{ zIndex: 100050 }}>
          <div className="qs-modal" style={{ maxWidth: 400, textAlign: 'center' }}>
            <div className="qs-modal-header">
              <div>
                <h3>{serviceQrModal.title}</h3>
                <p>{serviceQrModal.subtitle}</p>
              </div>
              <button
                type="button"
                className="qs-modal-close"
                onClick={() => setServiceQrModal(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="qs-modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
              <div style={{ background: '#ffffff', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.06)' }}>
                {serviceQrModal.qrDataUrl ? (
                  <img src={serviceQrModal.qrDataUrl} alt="Booking QR Code" style={{ width: '220px', height: '220px', display: 'block' }} />
                ) : (
                  <div style={{ width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>กำลังสร้าง QR Code...</div>
                )}
              </div>

              <div style={{ margin: '16px 0 8px', width: '100%', wordBreak: 'break-all', fontSize: '12px', color: '#0284c7', background: '#f0f9ff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                {serviceQrModal.url}
              </div>
            </div>

            <div className="qs-modal-footer" style={{ justifyContent: 'center', gap: '10px' }}>
              <button
                type="button"
                className="qs-btn-cancel"
                onClick={() => {
                  navigator.clipboard?.writeText(serviceQrModal.url)
                  playTapSound('success')
                }}
              >
                <Copy size={14} /> คัดลอกลิงก์
              </button>
              <button
                type="button"
                className="qs-btn-submit"
                onClick={() => {
                  playTapSound('nav')
                  window.open(serviceQrModal.url, '_blank')
                }}
              >
                <ArrowUpRight size={14} /> เปิดหน้าเว็บ ›
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ==========================================================================
   MANUAL BOOKING MODAL (ฟอร์มบันทึกการจอง Walk-in / โทรจองหน้าร้าน)
   ========================================================================== */
function ManualBookingModal({
  isOpen,
  onClose,
  services,
  onSave
}: {
  isOpen: boolean
  onClose: () => void
  services: CatalogItem[]
  onSave: (booking: any) => void
}) {
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().split('T')[0])
  const [bookingTime, setBookingTime] = useState('14:00')
  const [guestCount, setGuestCount] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState('store')
  const [isPaid, setIsPaid] = useState(false)
  const [specialNotes, setSpecialNotes] = useState('')
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'in_service'>('confirmed')

  useEffect(() => {
    if (services.length > 0 && !selectedServiceId) {
      setSelectedServiceId(services[0].id)
    }
  }, [services, selectedServiceId])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName.trim()) {
      alert('กรุณากรอกชื่อลูกค้า')
      return
    }
    const targetService = services.find(s => s.id === selectedServiceId) || services[0] || { name: 'บริการทั่วไป', price: 500 }
    const newRecord = {
      id: `BK-${Math.floor(10000 + Math.random() * 90000)}`,
      serviceId: targetService.id || 'custom',
      serviceName: targetService.name,
      servicePrice: targetService.price,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || '-',
      guestCount,
      bookingDate,
      bookingTime,
      specialNotes: specialNotes.trim(),
      paymentMethod,
      isPaid: isPaid || paymentMethod === 'promptpay',
      status,
      createdAt: new Date().toISOString()
    }
    onSave(newRecord)
    onClose()
  }

  return (
    <div className="qs-modal-overlay" style={{ zIndex: 100050 }}>
      <div className="qs-modal qs-modal-large" style={{ maxWidth: 540 }}>
        <div className="qs-modal-header">
          <div className="qs-modal-header-left">
            <div className="qs-modal-icon-badge emerald">
              <Calendar size={20} />
            </div>
            <div>
              <h3>+ บันทึกการจองคิวใหม่ (Walk-in / โทรจอง)</h3>
              <p>สร้างรายการนัดหมายบริการจากหน้าร้านโดยตรง</p>
            </div>
          </div>
          <button type="button" className="qs-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="qs-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <div className="qs-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="qs-form-group" style={{ gridColumn: 'span 2' }}>
                <label>ชื่อ-นามสกุล ลูกค้า <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  placeholder="เช่น คุณสมศักดิ์ ชื่นใจ"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>

              <div className="qs-form-group">
                <label>เบอร์โทรศัพท์ติดต่อ</label>
                <input
                  type="tel"
                  placeholder="เช่น 081-234-5678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>

              <div className="qs-form-group">
                <label>จำนวนผู้รับบริการ</label>
                <select value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))}>
                  <option value={1}>1 ท่าน</option>
                  <option value={2}>2 ท่าน</option>
                  <option value={3}>3 ท่าน</option>
                  <option value={4}>4 ท่านขึ้นไป (กรุ๊ป)</option>
                </select>
              </div>

              <div className="qs-form-group" style={{ gridColumn: 'span 2' }}>
                <label>เลือกบริการ</label>
                <select value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)}>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} (฿{s.price.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="qs-form-group">
                <label>วันที่นัดหมาย</label>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  required
                />
              </div>

              <div className="qs-form-group">
                <label>เวลานัดหมาย</label>
                <select value={bookingTime} onChange={(e) => setBookingTime(e.target.value)}>
                  {['09:00', '10:00', '11:00', '11:30', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'].map(t => (
                    <option key={t} value={t}>{t} น.</option>
                  ))}
                </select>
              </div>

              <div className="qs-form-group">
                <label>วิธีชำระเงิน</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="store">ชำระที่หน้าร้าน</option>
                  <option value="promptpay">พร้อมเพย์ QR</option>
                  <option value="truemoney">TrueMoney Wallet</option>
                  <option value="bank_transfer">โอนเงินธนาคาร</option>
                  <option value="credit_card">บัตรเครดิต / เดบิต</option>
                </select>
              </div>

              <div className="qs-form-group">
                <label>สถานะเริ่มต้น</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
                  <option value="confirmed">🟢 ยืนยันคิวแล้ว</option>
                  <option value="pending">🟡 รอรับบริการ</option>
                  <option value="in_service">⏳ กำลังให้บริการ</option>
                </select>
              </div>

              <div className="qs-form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isPaid}
                    onChange={(e) => setIsPaid(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>ชำระเงินเรียบร้อยแล้ว (Paid)</span>
                </label>
              </div>

              <div className="qs-form-group" style={{ gridColumn: 'span 2' }}>
                <label>หมายเหตุ / ข้อมูลเพิ่มเติม</label>
                <textarea
                  placeholder="เช่น ลูกค้าขอโต๊ะติดหน้าต่าง, นัดหมายผ่านโทรศัพท์"
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  rows={2}
                  style={{ width: '100%', borderRadius: '10px', padding: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>
          </div>

          <div className="qs-modal-footer">
            <button type="button" className="qs-btn-cancel" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="submit" className="qs-btn-submit">
              <Check size={16} /> บันทึกการจอง
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ==========================================================================
   EDIT BOOKING MODAL (ฟอร์มแก้ไขข้อมูลการจองคิว)
   ========================================================================== */
function EditBookingModal({
  booking,
  services,
  onClose,
  onSave,
  onDelete
}: {
  booking: any | null
  services: CatalogItem[]
  onClose: () => void
  onSave: (updated: any) => void
  onDelete: (id: string) => void
}) {
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [bookingDate, setBookingDate] = useState('')
  const [bookingTime, setBookingTime] = useState('')
  const [guestCount, setGuestCount] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState('store')
  const [isPaid, setIsPaid] = useState(false)
  const [specialNotes, setSpecialNotes] = useState('')
  const [status, setStatus] = useState<string>('pending')

  useEffect(() => {
    if (booking) {
      setCustomerName(booking.customerName || '')
      setCustomerPhone(booking.customerPhone || '')
      setSelectedServiceId(booking.serviceId || '')
      setBookingDate(booking.bookingDate || new Date().toISOString().split('T')[0])
      setBookingTime(booking.bookingTime || '14:00')
      setGuestCount(booking.guestCount || 1)
      setPaymentMethod(booking.paymentMethod || 'store')
      setIsPaid(Boolean(booking.isPaid))
      setSpecialNotes(booking.specialNotes || '')
      setStatus(booking.status || 'pending')
    }
  }, [booking])

  if (!booking) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const targetService = services.find(s => s.id === selectedServiceId)
    const updated = {
      ...booking,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      serviceId: targetService?.id || booking.serviceId,
      serviceName: targetService?.name || booking.serviceName,
      servicePrice: targetService ? targetService.price : booking.servicePrice,
      bookingDate,
      bookingTime,
      guestCount,
      paymentMethod,
      isPaid,
      specialNotes: specialNotes.trim(),
      status
    }
    onSave(updated)
    onClose()
  }

  return (
    <div className="qs-modal-overlay" style={{ zIndex: 100050 }}>
      <div className="qs-modal qs-modal-large" style={{ maxWidth: 540 }}>
        <div className="qs-modal-header">
          <div className="qs-modal-header-left">
            <div className="qs-modal-icon-badge orange">
              <Calendar size={20} />
            </div>
            <div>
              <h3>✏️ แก้ไขข้อมูลการจอง #{booking.id}</h3>
              <p>ปรับปรุงวันเวลา รายละเอียดลูกค้า หรือสถานะคิว</p>
            </div>
          </div>
          <button type="button" className="qs-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="qs-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <div className="qs-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="qs-form-group" style={{ gridColumn: 'span 2' }}>
                <label>ชื่อลูกค้า</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>

              <div className="qs-form-group">
                <label>เบอร์โทร</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>

              <div className="qs-form-group">
                <label>จำนวนท่าน</label>
                <select value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))}>
                  <option value={1}>1 ท่าน</option>
                  <option value={2}>2 ท่าน</option>
                  <option value={3}>3 ท่าน</option>
                  <option value={4}>4 ท่านขึ้นไป</option>
                </select>
              </div>

              <div className="qs-form-group" style={{ gridColumn: 'span 2' }}>
                <label>บริการที่จอง</label>
                <select value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)}>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} (฿{s.price.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="qs-form-group">
                <label>วันที่</label>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  required
                />
              </div>

              <div className="qs-form-group">
                <label>เวลา</label>
                <select value={bookingTime} onChange={(e) => setBookingTime(e.target.value)}>
                  {['09:00', '10:00', '11:00', '11:30', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'].map(t => (
                    <option key={t} value={t}>{t} น.</option>
                  ))}
                </select>
              </div>

              <div className="qs-form-group">
                <label>สถานะคิว</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="pending">🟡 รอรับบริการ</option>
                  <option value="confirmed">🟢 ยืนยันคิวแล้ว</option>
                  <option value="in_service">⏳ กำลังให้บริการ</option>
                  <option value="completed">✅ เสร็จสิ้นแล้ว</option>
                  <option value="cancelled">❌ ยกเลิกคิว</option>
                </select>
              </div>

              <div className="qs-form-group">
                <label>วิธีชำระเงิน</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="store">ชำระที่หน้าร้าน</option>
                  <option value="promptpay">พร้อมเพย์ QR</option>
                  <option value="truemoney">TrueMoney Wallet</option>
                  <option value="bank_transfer">โอนเงินธนาคาร</option>
                  <option value="credit_card">บัตรเครดิต / เดบิต</option>
                </select>
              </div>

              <div className="qs-form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isPaid}
                    onChange={(e) => setIsPaid(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>ชำระเงินเรียบร้อยแล้ว (Paid)</span>
                </label>
              </div>

              <div className="qs-form-group" style={{ gridColumn: 'span 2' }}>
                <label>หมายเหตุ</label>
                <textarea
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  rows={2}
                  style={{ width: '100%', borderRadius: '10px', padding: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>
          </div>

          <div className="qs-modal-footer" style={{ justifyContent: 'space-between' }}>
            <button
              type="button"
              className="qs-btn-cancel"
              style={{ color: '#b91c1c', borderColor: '#fecaca', background: '#fee2e2' }}
              onClick={() => {
                onDelete(booking.id)
                onClose()
              }}
            >
              🗑️ ลบรายการ
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="qs-btn-cancel" onClick={onClose}>
                ยกเลิก
              </button>
              <button type="submit" className="qs-btn-submit">
                <Check size={16} /> บันทึกการแก้ไข
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ==========================================================================
   BOOKING SETTINGS MODAL (ฟอร์มตั้งค่าหน้าร้านจองออนไลน์ /booking)
   ========================================================================== */
function BookingSettingsModal({
  isOpen,
  onClose
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('merchant_booking_settings')
    if (saved) {
      try { return JSON.parse(saved) } catch (e) {}
    }
    return {
      storeName: 'POP CAFE & SERVICES ✨',
      welcomeSub: 'ยินดีต้อนรับสู่',
      namePrefix: 'POP CAFE',
      nameSuffix: '& SERVICES ✨',
      slogan: 'ระบบนัดหมายออนไลน์ บริการสะดวกรวดเร็ว ยืนยันคิวทันที',
      openHours: 'เปิดบริการทุกวัน 08:00 - 20:00 น.',
      phone: '082-345-6789',
      lineUrl: 'https://line.me/ti/p/~@chatpos',
      location: '128 ถ. สุขุมวิท ซอย 24 แขวงคลองตัน เขตคลองเตย กรุงเทพมหานคร 10110',
      coverImg: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1600&auto=format&fit=crop&q=80',
      logoImg: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80'
    }
  })

  if (!isOpen) return null

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    localStorage.setItem('merchant_booking_settings', JSON.stringify(settings))
    window.dispatchEvent(new Event('storage'))
    playTapSound('success')
    onClose()
  }

  return (
    <div className="qs-modal-overlay" style={{ zIndex: 100050 }}>
      <div className="qs-modal qs-modal-large" style={{ maxWidth: 580 }}>
        <div className="qs-modal-header">
          <div className="qs-modal-header-left">
            <div className="qs-modal-icon-badge emerald">
              <Settings size={20} />
            </div>
            <div>
              <h3>⚙️ ตั้งค่าหน้าร้านจองออนไลน์ (/booking)</h3>
              <p>ปรับแต่งข้อมูลร้านค้า เวลาเปิด-ปิด และข้อมูลติดต่อที่แสดงบนหน้าจอง</p>
            </div>
          </div>
          <button type="button" className="qs-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="qs-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <div className="qs-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="qs-form-group" style={{ gridColumn: 'span 2' }}>
                <label>ชื่อร้านค้า (Store Name) <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  value={settings.storeName}
                  onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                  required
                />
              </div>

              <div className="qs-form-group">
                <label>คำโปรยต้อนรับ</label>
                <input
                  type="text"
                  value={settings.welcomeSub}
                  onChange={(e) => setSettings({ ...settings, welcomeSub: e.target.value })}
                  placeholder="เช่น ยินดีต้อนรับสู่"
                />
              </div>

              <div className="qs-form-group">
                <label>เวลาเปิด-ปิดบริการ</label>
                <input
                  type="text"
                  value={settings.openHours}
                  onChange={(e) => setSettings({ ...settings, openHours: e.target.value })}
                  placeholder="เช่น เปิดบริการทุกวัน 08:00 - 20:00 น."
                />
              </div>

              <div className="qs-form-group" style={{ gridColumn: 'span 2' }}>
                <label>สโลแกน / คำอธิบายบริการ</label>
                <input
                  type="text"
                  value={settings.slogan}
                  onChange={(e) => setSettings({ ...settings, slogan: e.target.value })}
                  placeholder="เช่น ระบบนัดหมายออนไลน์ บริการสะดวกรวดเร็ว ยืนยันคิวทันที"
                />
              </div>

              <div className="qs-form-group">
                <label>เบอร์โทรศัพท์ติดต่อ</label>
                <input
                  type="tel"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="เช่น 082-345-6789"
                />
              </div>

              <div className="qs-form-group">
                <label>ลิงก์ LINE Official</label>
                <input
                  type="url"
                  value={settings.lineUrl}
                  onChange={(e) => setSettings({ ...settings, lineUrl: e.target.value })}
                  placeholder="https://line.me/ti/p/~@chatpos"
                />
              </div>

              <div className="qs-form-group" style={{ gridColumn: 'span 2' }}>
                <label>ที่อยู่ร้านค้า / สถานที่ตั้ง</label>
                <input
                  type="text"
                  value={settings.location}
                  onChange={(e) => setSettings({ ...settings, location: e.target.value })}
                  placeholder="เช่น 128 ถ. สุขุมวิท ซอย 24 แขวงคลองตัน เขตคลองเตย กรุงเทพมหานคร 10110"
                />
              </div>

              <div className="qs-form-group" style={{ gridColumn: 'span 2' }}>
                <label>URL รูปภาพปก (Cover Image)</label>
                <input
                  type="url"
                  value={settings.coverImg}
                  onChange={(e) => setSettings({ ...settings, coverImg: e.target.value })}
                />
              </div>

              <div className="qs-form-group" style={{ gridColumn: 'span 2' }}>
                <label>URL รูปภาพโลโก้ร้าน (Logo Image)</label>
                <input
                  type="url"
                  value={settings.logoImg}
                  onChange={(e) => setSettings({ ...settings, logoImg: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="qs-modal-footer">
            <button type="button" className="qs-btn-cancel" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="submit" className="qs-btn-submit">
              <Check size={16} /> บันทึกการตั้งค่า
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MerchantSection({ active, label }: { active: string; label: string }) {
  const content: Record<string, { title: string; description: string; icon: typeof Store }> = {
    pos: { title: 'ขายหน้าร้าน (POS)', description: 'เลือกสินค้าและสร้างรายการขายใหม่', icon: CreditCard },
    payment: { title: 'คิดเงินด่วน', description: 'สร้าง QR หรือรับชำระเงินสำหรับออเดอร์', icon: QrCode },
    orders: { title: 'ออเดอร์ทั้งหมด', description: 'ติดตามรายการสั่งซื้อและสถานะการชำระเงิน', icon: ClipboardList },
    tables: { title: 'จัดการโต๊ะ', description: 'จัดการโต๊ะและ QR สำหรับรับออเดอร์จากลูกค้า', icon: Utensils },
    products: { title: 'คลังสินค้าและสต็อก', description: 'จัดการรายการสินค้า ราคา และจำนวนคงเหลือ', icon: Package },
    services: { title: 'บริการคิวร้านค้า', description: 'จัดการบริการคิว และรายการชำระแล้ว', icon: Clock },
    reports: { title: 'รายงานการเงิน', description: 'วิเคราะห์ยอดขายตามช่วงเวลาและช่องทาง', icon: ReceiptText },
    wallet: { title: 'กระเป๋าเงิน', description: 'ยอดรายรับ ยอดถอนได้ และประวัติการถอนเงิน', icon: WalletCards },
    transactions: { title: 'ประวัติธุรกรรม', description: 'ค้นหาและตรวจสอบสถานะการชำระเงินตามรายการจริง', icon: ReceiptText },
    benefits: { title: 'สิทธิพิเศษ', description: 'จัดการสิทธิประโยชน์และแคมเปญที่เปิดให้ร้านค้า', icon: Sparkles },
    stoppay: { title: 'STOPPAY', description: 'ตรวจสอบสถานะการรับเงินและเหตุผลเมื่อมีการระงับตาม policy', icon: ShieldAlert },
    billing: { title: 'บิล', description: 'ตรวจสอบค่าบริการแพลตฟอร์มและรอบเคลียร์ริ่ง', icon: ReceiptText },
    settings: { title: 'ตั้งค่าร้านค้า', description: 'จัดการข้อมูลร้าน สาขา และสิทธิ์ทีมงาน', icon: Settings }
  }
  const item = content[active] ?? { title: label, description: 'จัดการข้อมูลร้านค้าของคุณ', icon: Store }
  const SectionIcon = item.icon
  const isUnavailable = active === 'tables'
  return (
    <section className="merchant-placeholder">
      <div className="merchant-placeholder-icon">
        <SectionIcon size={28} />
      </div>
      <p className="merchant-eyebrow">MERCHANT WORKSPACE</p>
      <h2>{item.title}</h2>
      <p>{item.description}</p>
      <div className="merchant-demo-note">
        <Checkmark /> {isUnavailable ? 'ยังไม่พร้อมใช้งาน: ต้องมี Table/Order API และ persistence ของ Store ก่อน' : 'หน้านี้พร้อมต่อเข้ากับ workflow จาก apps/merchant และ API จริง'}
      </div>
    </section>
  )
}

type TransactionStatusFilter = 'all' | 'pending' | 'paid' | 'failed'

function transactionStatusLabel(status: string) {
  const normalizedStatus = status.toLowerCase()
  if (['paid', 'completed', 'succeeded', 'settled'].includes(normalizedStatus)) return 'สำเร็จ'
  if (['pending', 'processing'].includes(normalizedStatus)) return 'รอดำเนินการ'
  if (['failed', 'cancelled', 'canceled'].includes(normalizedStatus)) return 'ไม่สำเร็จ'
  if (normalizedStatus === 'refunded') return 'คืนเงิน'
  return status || 'ไม่ทราบสถานะ'
}

function transactionStatusMatches(status: string, filter: TransactionStatusFilter) {
  if (filter === 'all') return true
  const normalizedStatus = status.toLowerCase()
  if (filter === 'paid') return ['paid', 'completed', 'succeeded', 'settled'].includes(normalizedStatus)
  if (filter === 'pending') return ['pending', 'processing'].includes(normalizedStatus)
  return ['failed', 'cancelled', 'canceled'].includes(normalizedStatus)
}

function TransactionsView({ storeId, onNavigate }: { storeId: string | null; onNavigate: (id: string) => void }) {
  const [transactions, setTransactions] = useState<DbTransactionRow[]>([])
  const [statusFilter, setStatusFilter] = useState<TransactionStatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(Boolean(storeId))
  const [error, setError] = useState<string | null>(null)

  const loadTransactions = async () => {
    if (!storeId) {
      setTransactions([])
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    const result = await fetchDbTransactionsResult({ storeId, limit: 100 })
    if (result.error) {
      setError(result.error)
    } else {
      setTransactions(result.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!storeId) {
        if (active) {
          setTransactions([])
          setError(null)
          setIsLoading(false)
        }
        return
      }
      setIsLoading(true)
      setError(null)
      const result = await fetchDbTransactionsResult({ storeId, limit: 100 })
      if (!active) return
      if (result.error) setError(result.error)
      else setTransactions(result.data)
      setIsLoading(false)
    }
    void load()
    return () => { active = false }
  }, [storeId])

  const filteredTransactions = transactions.filter((transaction) => {
    if (!transactionStatusMatches(transaction.status, statusFilter)) return false
    const query = searchQuery.trim().toLowerCase()
    if (!query) return true
    return [transaction.reference, transaction.id, transaction.channel, transaction.paymentMethod, transaction.customerName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })

  if (!storeId) {
    return <section className="merchant-placeholder"><div className="merchant-placeholder-icon"><ReceiptText size={28} /></div><p className="merchant-eyebrow">TRANSACTION HISTORY</p><h2>ยังไม่มีร้านค้าที่เลือก</h2><p>เลือก Store ที่มีสิทธิ์เข้าถึงเพื่อดูประวัติธุรกรรม</p><button className="merchant-primary" type="button" onClick={() => onNavigate('home')}><Home size={16} /> กลับหน้าหลัก</button></section>
  }

  return (
    <section className="merchant-transactions-view" aria-labelledby="transactions-title">
      <div className="merchant-heading">
        <div><p className="merchant-eyebrow">TRANSACTION HISTORY</p><h2 id="transactions-title">ประวัติธุรกรรม</h2><p>ข้อมูลจาก Transaction API ของ Store ที่กำลังใช้งาน</p></div>
        <button className="merchant-secondary" type="button" onClick={() => { void loadTransactions() }} disabled={isLoading}><RefreshCw size={15} className={isLoading ? 'spin' : ''} /> รีเฟรช</button>
      </div>
      <div className="merchant-transaction-toolbar">
        <label className="merchant-transaction-search"><Search size={16} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="ค้นหา reference หรือชื่อลูกค้า" /></label>
        <div className="merchant-transaction-filters" role="group" aria-label="กรองสถานะธุรกรรม">
          {(['all', 'pending', 'paid', 'failed'] as TransactionStatusFilter[]).map((filter) => <button key={filter} className={statusFilter === filter ? 'active' : ''} type="button" onClick={() => setStatusFilter(filter)}>{filter === 'all' ? 'ทั้งหมด' : filter === 'pending' ? 'รอดำเนินการ' : filter === 'paid' ? 'สำเร็จ' : 'ไม่สำเร็จ'}</button>)}
        </div>
      </div>
      {error && <div className="merchant-data-alert" role="alert"><ShieldAlert size={18} /><span>{error}</span><button type="button" onClick={() => { void loadTransactions() }} disabled={isLoading}><RefreshCw size={14} /> ลองใหม่</button></div>}
      {isLoading && <div className="merchant-transaction-state" aria-busy="true"><RefreshCw size={24} className="spin" /><span>กำลังโหลดประวัติธุรกรรม</span></div>}
      {!isLoading && !error && filteredTransactions.length === 0 && <div className="merchant-transaction-state"><ReceiptText size={34} /><strong>{transactions.length === 0 ? 'ยังไม่มีธุรกรรม' : 'ไม่พบธุรกรรมตามตัวกรอง'}</strong><span>{transactions.length === 0 ? 'เมื่อมีรายการจาก Store นี้ จะแสดงในหน้านี้' : 'ลองเปลี่ยนสถานะหรือคำค้นหา'}</span></div>}
      {!isLoading && filteredTransactions.length > 0 && <div className="merchant-transaction-table-wrap"><table className="merchant-transaction-table"><thead><tr><th>Reference</th><th>วันที่</th><th>ช่องทาง</th><th>ลูกค้า</th><th>ยอดเงิน</th><th>สถานะ</th></tr></thead><tbody>{filteredTransactions.map((transaction) => <tr key={transaction.id}><td><strong>{transaction.reference}</strong><small>{transaction.id}</small></td><td>{new Date(transaction.occurredAt || transaction.createdAt).toLocaleString('th-TH')}</td><td>{transaction.paymentMethod || transaction.channel || '—'}</td><td>{transaction.customerName || 'ลูกค้าหน้าร้าน'}</td><td className="merchant-transaction-amount">฿{Number(transaction.amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td><span className={`merchant-transaction-status ${transactionStatusMatches(transaction.status, 'paid') ? 'is-paid' : transactionStatusMatches(transaction.status, 'pending') ? 'is-pending' : 'is-failed'}`}>{transactionStatusLabel(transaction.status)}</span></td></tr>)}</tbody></table></div>}
    </section>
  )
}

function Checkmark() {
  return <span className="merchant-check">✓</span>
}

/* ==========================================================================
   SALES PAGES VIEW (Sales Pages / Link Page)
   ========================================================================== */
export type SalesPage = {
  id: string
  avatarText: string
  title: string
  slug: string
  enabled: boolean
  clicks: number
  sales: number
  data?: WizardFormData
}

type WizardFormData = {
  // Step 1
  template: string
  pageName: string
  domain: string
  slug: string
  // Step 2
  seoTitle: string
  seoDescription: string
  seoKeywords: string
  ogImage: string
  products: { name: string; price: string; image: string }[]
  // Step 3
  heroImage: string
  contentText: string
  // Step 4
  paymentChannels: string[]
  // Step 5
  shippingEnabled: boolean
  shippingCost: string
  shippingProviders: string[]
  // Step 6
  bannerImage: string
  bannerUrl: string
  bannerText: string
  // Step 7 (review) — no extra data
  // Step 8 (stats) — no extra data
}

const defaultWizardData: WizardFormData = {
  template: 'shopfront',
  pageName: '',
  domain: 'chatpos.link',
  slug: '',
  seoTitle: '',
  seoDescription: '',
  seoKeywords: '',
  ogImage: '',
  products: [],
  heroImage: '',
  contentText: '',
  paymentChannels: ['promptpay'],
  shippingEnabled: false,
  shippingCost: '0',
  shippingProviders: [],
  bannerImage: '',
  bannerUrl: '',
  bannerText: ''
}

const STEP_LABELS = [
  'เลือกรูปแบบ',
  'สินค้า & SEO',
  'เนื้อหา & สื่อ',
  'ชำระเงิน',
  'จัดส่ง',
  'แบนเนอร์',
  'ตรวจสอบ',
  'สถิติ'
]

const initialSalesPages: SalesPage[] = [
  {
    id: 'sp-1',
    avatarText: 'POP',
    title: 'POP CAFE Official Catalog',
    slug: 'catalog-page',
    enabled: true,
    clicks: 1240,
    sales: 24500,
    data: {
      template: 'shopfront',
      pageName: 'POP CAFE ✨ หน้าร้าน & แค็ตตาล็อกสินค้า',
      domain: 'chatpos.link',
      slug: 'catalog-page',
      seoTitle: 'POP CAFE - Official Online Catalog & Menu Showcase',
      seoDescription: 'ค้นพบเมนูเครื่องดื่ม ซิกเนเจอร์ และเบเกอรี่โฮมเมดอบใหม่ทุกวัน ณ POP CAFE',
      seoKeywords: 'cafe, coffee, bakery, pop cafe, bangkok cafe',
      ogImage: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&auto=format&fit=crop&q=80',
      products: [],
      heroImage: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&auto=format&fit=crop&q=80',
      contentText: 'ยินดีต้อนรับสู่ POP CAFE พื้นที่พักผ่อนใจกลางเมืองที่เสิร์ฟกาแฟ Specialty คัดสรรเมล็ดพันธุ์ชั้นดีและเบเกอรี่เนยสดฝรั่งเศสอบสดใหม่ทุกเช้า',
      paymentChannels: ['promptpay', 'truemoney', 'visa_th', 'wechat', 'linepay'],
      shippingEnabled: true,
      shippingCost: '40',
      shippingProviders: ['Flash Express', 'GrabExpress', 'Lineman'],
      bannerImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&auto=format&fit=crop&q=80',
      bannerUrl: '#',
      bannerText: '🎉 ต้อนรับเทศกาล Special Beans Month ชิมเมล็ดกาแฟนำเข้า Single Origin ฟรีเมื่อสั่งเมนูเซ็ต!'
    }
  }
]

function SalesPageView() {
  const [pages, setPages] = useState<SalesPage[]>(() => {
    try {
      const saved = localStorage.getItem('merchant_sales_pages')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch (e) {}
    return initialSalesPages
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Wizard state
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardData, setWizardData] = useState<WizardFormData>({ ...defaultWizardData })
  const [editingPage, setEditingPage] = useState<SalesPage | null>(null)

  // Product form state (Step 2)
  const [tempProductName, setTempProductName] = useState('')
  const [tempProductPrice, setTempProductPrice] = useState('')

  // Modals & Social Meta state
  const [showCustomerPreviewModal, setShowCustomerPreviewModal] = useState(false)
  const [showOgMetaModal, setShowOgMetaModal] = useState(false)
  const [ogTitle, setOgTitle] = useState('POP CAFE ✨ - สั่งอาหารออนไลน์')
  const [ogDesc, setOgDesc] = useState('สั่งอาหารและเครื่องดื่มผ่าน LINE OA หรือสแกน QR Code รับส่วนลดพิเศษทันที')

  const handleToggle = (id: string) => {
    const updated = pages.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    setPages(updated)
    localStorage.setItem('merchant_sales_pages', JSON.stringify(updated))
  }

  const handleCopyLink = (page: SalesPage) => {
    const fullUrl = `${window.location.origin}/${page.slug}`
    navigator.clipboard?.writeText(fullUrl)
    setCopiedId(page.id)
    playTapSound('success')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleOpenLink = (page: SalesPage) => {
    const fullUrl = `/${page.slug}`
    window.open(fullUrl, '_blank')
  }

  const handleOpenCreateWizard = () => {
    playTapSound('pop')
    setEditingPage(null)
    setWizardData({ ...defaultWizardData })
    setWizardStep(1)
    setShowWizard(true)
  }

  const handleOpenEditWizard = (page: SalesPage) => {
    playTapSound('pop')
    setEditingPage(page)
    setWizardData({
      ...defaultWizardData,
      ...(page.data || {}),
      pageName: page.title,
      slug: page.slug
    })
    setWizardStep(1)
    setShowWizard(true)
  }

  const handleNextStep = () => {
    playTapSound('nav')
    setWizardStep((s) => Math.min(s + 1, 8))
  }

  const handlePrevStep = () => {
    playTapSound('nav')
    setWizardStep((s) => Math.max(s - 1, 1))
  }

  const handlePublish = () => {
    playTapSound('success')
    let updatedPages: SalesPage[] = []
    if (editingPage) {
      updatedPages = pages.map((p) =>
        p.id === editingPage.id
          ? {
              ...p,
              title: wizardData.pageName || p.title,
              slug: wizardData.slug || p.slug,
              data: { ...wizardData }
            }
          : p
      )
    } else {
      const newPage: SalesPage = {
        id: `sp-${Date.now()}`,
        avatarText: (wizardData.pageName || 'SP').slice(0, 3).toUpperCase(),
        title: wizardData.pageName || 'เซลเพจใหม่',
        slug: wizardData.slug || `page-${Date.now()}`,
        enabled: true,
        clicks: 0,
        sales: 0,
        data: { ...wizardData }
      }
      updatedPages = [newPage, ...pages]
    }
    setPages(updatedPages)
    localStorage.setItem('merchant_sales_pages', JSON.stringify(updatedPages))
    setWizardStep(8)
  }

  const handleAddProduct = () => {
    if (!tempProductName) return
    playTapSound('pop')
    setWizardData({
      ...wizardData,
      products: [
        ...wizardData.products,
        { name: tempProductName, price: tempProductPrice || '0', image: '' }
      ]
    })
    setTempProductName('')
    setTempProductPrice('')
  }

  const handleRemoveProduct = (idx: number) => {
    playTapSound('delete')
    setWizardData({
      ...wizardData,
      products: wizardData.products.filter((_, i) => i !== idx)
    })
  }

  const togglePayChannel = (ch: string) => {
    playTapSound('pop')
    const arr = wizardData.paymentChannels
    setWizardData({
      ...wizardData,
      paymentChannels: arr.includes(ch) ? arr.filter((c) => c !== ch) : [...arr, ch]
    })
  }

  const toggleShipProvider = (p: string) => {
    playTapSound('pop')
    const arr = wizardData.shippingProviders
    setWizardData({
      ...wizardData,
      shippingProviders: arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p]
    })
  }

  const filteredPages = pages.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchQuery.toLowerCase())
  )

  /* ====================== WIZARD STEP RENDERER ====================== */
  const renderWizardStep = () => {
    switch (wizardStep) {
      /* -------- STEP 1: Template & Name -------- */
      case 1:
        return (
          <div className="spw-step-content">
            <div className="spw-section-card">
              <div className="spw-section-header">
                <Store size={18} color="#059669" />
                <h4>ขั้นตอนที่ 1: เลือกรูปแบบและตั้งชื่อหน้า</h4>
              </div>
              <p className="spw-section-desc">เลือกเทมเพลตและตั้งชื่อเว็บไซต์ร้านค้าของคุณ</p>

              <div className="spw-form-group">
                <label>เลือกเทมเพลต (Template)</label>
                <div className="spw-template-grid">
                  <div
                    className={`spw-template-card ${wizardData.template === 'shopfront' ? 'selected' : ''}`}
                    onClick={() => { playTapSound('pop'); setWizardData({ ...wizardData, template: 'shopfront' }) }}
                  >
                    <div className="spw-template-icon">
                      <Store size={28} color="#059669" />
                    </div>
                    <strong>ShopFront</strong>
                    <span>หน้าร้านค้าออนไลน์มาตรฐาน</span>
                    {wizardData.template === 'shopfront' && <span className="spw-check-badge"><Check size={14} /></span>}
                  </div>
                  <div
                    className={`spw-template-card ${wizardData.template === 'landing' ? 'selected' : ''}`}
                    onClick={() => { playTapSound('pop'); setWizardData({ ...wizardData, template: 'landing' }) }}
                  >
                    <div className="spw-template-icon">
                      <Globe size={28} color="#6366f1" />
                    </div>
                    <strong>Landing Page</strong>
                    <span>หน้าแลนดิ้งเพจโปรโมชั่น</span>
                    {wizardData.template === 'landing' && <span className="spw-check-badge"><Check size={14} /></span>}
                  </div>
                  <div
                    className={`spw-template-card ${wizardData.template === 'catalog' ? 'selected' : ''}`}
                    onClick={() => { playTapSound('pop'); setWizardData({ ...wizardData, template: 'catalog' }) }}
                  >
                    <div className="spw-template-icon">
                      <LayoutGrid size={28} color="#f59e0b" />
                    </div>
                    <strong>Catalog</strong>
                    <span>แค็ตตาล็อกสินค้าแบบกริด</span>
                    {wizardData.template === 'catalog' && <span className="spw-check-badge"><Check size={14} /></span>}
                  </div>
                </div>
              </div>

              <div className="spw-form-group">
                <label htmlFor="wz-page-name">ตั้งชื่อหน้าเว็บไซต์ *</label>
                <input
                  id="wz-page-name"
                  value={wizardData.pageName}
                  onChange={(e) => setWizardData({ ...wizardData, pageName: e.target.value })}
                  placeholder="เช่น ร้านกาแฟบ้านสวน Official Shop"
                />
              </div>

              <div className="spw-form-group">
                <label htmlFor="wz-slug">เลือกโดเมนสำหรับ URL *</label>
                <div className="spw-slug-row">
                  <span className="spw-slug-prefix">https://{wizardData.domain}/</span>
                  <input
                    id="wz-slug"
                    value={wizardData.slug}
                    onChange={(e) => setWizardData({ ...wizardData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    placeholder="my-shop-page"
                  />
                </div>
              </div>
            </div>
          </div>
        )

      /* -------- STEP 2: Products & SEO -------- */
      case 2:
        return (
          <div className="spw-step-content">
            <div className="spw-section-card">
              <div className="spw-section-header">
                <ShoppingBag size={18} color="#059669" />
                <h4>ขั้นตอนที่ 2: สินค้าหรือ SEO</h4>
              </div>
              <p className="spw-section-desc">เพิ่มรายการสินค้าเข้าเซลเพจ และตั้งค่า SEO เพื่อให้ค้นหาเจอง่าย</p>

              {/* Product List */}
              <div className="spw-mini-section">
                <label>เพิ่มรายการสินค้า</label>
                <div className="spw-product-add-row">
                  <input
                    value={tempProductName}
                    onChange={(e) => setTempProductName(e.target.value)}
                    placeholder="ชื่อสินค้า เช่น ชาไทยเย็น"
                  />
                  <input
                    value={tempProductPrice}
                    onChange={(e) => setTempProductPrice(e.target.value)}
                    placeholder="ราคา"
                    type="number"
                    style={{ maxWidth: 100 }}
                  />
                  <button type="button" className="spw-add-btn" onClick={handleAddProduct}>
                    <Plus size={14} /> เพิ่ม
                  </button>
                </div>
                {wizardData.products.length > 0 && (
                  <div className="spw-product-list">
                    {wizardData.products.map((p, idx) => (
                      <div className="spw-product-item" key={idx}>
                        <div>
                          <strong>{p.name}</strong>
                          <span>฿{parseFloat(p.price || '0').toLocaleString()}</span>
                        </div>
                        <button type="button" onClick={() => handleRemoveProduct(idx)} className="spw-remove-btn">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SEO Fields */}
              <div className="spw-seo-divider">
                <Search size={14} />
                <span>ตั้งค่า SEO (Search Engine Optimization)</span>
              </div>

              <div className="spw-form-group">
                <label htmlFor="wz-seo-title">SEO Title</label>
                <input
                  id="wz-seo-title"
                  value={wizardData.seoTitle}
                  onChange={(e) => setWizardData({ ...wizardData, seoTitle: e.target.value })}
                  placeholder="ชื่อที่จะแสดงบน Google เช่น ร้านกาแฟบ้านสวน"
                />
              </div>

              <div className="spw-form-group">
                <label htmlFor="wz-seo-desc">SEO Description</label>
                <textarea
                  id="wz-seo-desc"
                  rows={2}
                  value={wizardData.seoDescription}
                  onChange={(e) => setWizardData({ ...wizardData, seoDescription: e.target.value })}
                  placeholder="คำอธิบายสั้น ๆ 150-160 ตัวอักษร สำหรับ Google"
                />
              </div>

              <div className="spw-form-group">
                <label htmlFor="wz-seo-kw">Keywords (คั่นด้วยเครื่องหมายจุลภาค)</label>
                <input
                  id="wz-seo-kw"
                  value={wizardData.seoKeywords}
                  onChange={(e) => setWizardData({ ...wizardData, seoKeywords: e.target.value })}
                  placeholder="กาแฟ, ชาไทย, เครื่องดื่ม, ร้านกาแฟ"
                />
              </div>

              <div className="spw-form-group">
                <label htmlFor="wz-og-img">Social Media OG Image URL</label>
                <input
                  id="wz-og-img"
                  value={wizardData.ogImage}
                  onChange={(e) => setWizardData({ ...wizardData, ogImage: e.target.value })}
                  placeholder="https://example.com/og-image.jpg"
                />
                {wizardData.ogImage && (
                  <div className="spw-og-preview">
                    <img src={wizardData.ogImage} alt="OG Preview" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      /* -------- STEP 3: Content & Media -------- */
      case 3:
        return (
          <div className="spw-step-content">
            <div className="spw-section-card">
              <div className="spw-section-header">
                <ImageIcon size={18} color="#059669" />
                <h4>ขั้นตอนที่ 3: เนื้อหาและสื่อประชาสัมพันธ์</h4>
              </div>
              <p className="spw-section-desc">เพิ่มรูปภาพหลักและเนื้อหาข้อความสำหรับหน้าเซลเพจ</p>

              <div className="spw-form-group">
                <label htmlFor="wz-hero-img">รูปภาพหลัก (Hero Banner) URL</label>
                <input
                  id="wz-hero-img"
                  value={wizardData.heroImage}
                  onChange={(e) => setWizardData({ ...wizardData, heroImage: e.target.value })}
                  placeholder="ใส่ URL รูปแบนเนอร์หลัก"
                />
                <div className="spw-preset-row">
                  <span>ภาพตัวอย่าง:</span>
                  <button type="button" className="qs-chip-btn" onClick={() => { playTapSound('pop'); setWizardData({ ...wizardData, heroImage: '/mascot/nabtang_welcome.png' }) }}>
                    + น้องนับตังค์ 3D
                  </button>
                  <button type="button" className="qs-chip-btn" onClick={() => { playTapSound('pop'); setWizardData({ ...wizardData, heroImage: '/mascot/pos_1_scanning_barcode.png' }) }}>
                    + สแกนสินค้า
                  </button>
                </div>
                {wizardData.heroImage && (
                  <div className="spw-hero-preview">
                    <img src={wizardData.heroImage} alt="Hero Preview" />
                  </div>
                )}
              </div>

              <div className="spw-form-group">
                <label htmlFor="wz-content">ข้อความเนื้อหาเซลเพจ</label>
                <textarea
                  id="wz-content"
                  rows={4}
                  value={wizardData.contentText}
                  onChange={(e) => setWizardData({ ...wizardData, contentText: e.target.value })}
                  placeholder="เขียนเนื้อหาอธิบายร้านค้า สินค้า หรือโปรโมชั่นของคุณ..."
                />
              </div>

              {/* Mascot decoration */}
              <div className="spw-mascot-decor">
                <img src="/mascot/nabtang_welcome.png" alt="น้องนับตังค์" />
                <span>เพิ่มรูปภาพและเนื้อหาช่วยให้เซลเพจดูน่าสนใจขึ้น!</span>
              </div>
            </div>
          </div>
        )

      /* -------- STEP 4: Payment -------- */
      case 4:
        return (
          <div className="spw-step-content">
            <div className="spw-section-card">
              <div className="spw-section-header">
                <CreditCard size={18} color="#059669" />
                <h4>ขั้นตอนที่ 4: ตั้งค่าระบบรับชำระเงิน (PAYMENT)</h4>
              </div>
              <p className="spw-section-desc">เลือกช่องทางรับชำระเงินที่ต้องการเปิดบนหน้าเซลเพจ</p>

              <div className="spw-payment-grid">
                {[
                  { id: 'promptpay', name: 'PromptPay', img: '/payments/promptpay_front.png' },
                  { id: 'truemoney', name: 'TrueMoney', img: '/payments/truemoney_front.png' },
                  { id: 'visa_th', name: 'VISA / MasterCard', img: '/payments/mastercard_visa_combined.png' },
                  { id: 'wechat', name: 'WeChat Pay', img: '/payments/wechatpay_front.png' },
                  { id: 'linepay', name: 'LINE Pay', img: '/payments/linepay_front.png' },
                  { id: 'alipay', name: 'Alipay', img: '/payments/alipay_front.png' },
                  { id: 'shopeepay', name: 'ShopeePay', img: '/payments/shopeepay_front.png' }
                ].map((ch) => (
                  <div
                    key={ch.id}
                    className={`spw-pay-card ${wizardData.paymentChannels.includes(ch.id) ? 'selected' : ''}`}
                    onClick={() => togglePayChannel(ch.id)}
                  >
                    <img src={ch.img} alt={ch.name} />
                    <span>{ch.name}</span>
                    {wizardData.paymentChannels.includes(ch.id) && (
                      <span className="spw-pay-check"><CheckCircle2 size={18} /></span>
                    )}
                  </div>
                ))}
              </div>

              <div className="spw-selected-summary">
                <Check size={14} />
                <span>เลือกแล้ว {wizardData.paymentChannels.length} ช่องทาง</span>
              </div>
            </div>
          </div>
        )

      /* -------- STEP 5: Shipping -------- */
      case 5:
        return (
          <div className="spw-step-content">
            <div className="spw-section-card">
              <div className="spw-section-header">
                <Truck size={18} color="#059669" />
                <h4>ขั้นตอนที่ 5: ตั้งค่าจัดส่งสินค้า (SHIPPING)</h4>
              </div>
              <p className="spw-section-desc">กำหนดค่าจัดส่งและเลือกผู้ให้บริการขนส่ง</p>

              <div className="spw-toggle-row">
                <span>เปิดระบบจัดส่งสินค้า</span>
                <button
                  type="button"
                  className={`st-ios-switch ${wizardData.shippingEnabled ? 'active' : ''}`}
                  onClick={() => { playTapSound('pop'); setWizardData({ ...wizardData, shippingEnabled: !wizardData.shippingEnabled }) }}
                >
                  <span className="st-switch-thumb" />
                </button>
              </div>

              {wizardData.shippingEnabled && (
                <>
                  <div className="spw-form-group">
                    <label htmlFor="wz-ship-cost">ค่าจัดส่งเริ่มต้น (บาท)</label>
                    <input
                      id="wz-ship-cost"
                      type="number"
                      min="0"
                      value={wizardData.shippingCost}
                      onChange={(e) => setWizardData({ ...wizardData, shippingCost: e.target.value })}
                      placeholder="เช่น 50"
                    />
                  </div>

                  <div className="spw-form-group">
                    <label>เลือกผู้ให้บริการขนส่ง</label>
                    <div className="spw-ship-providers">
                      {[
                        { id: 'kerry', name: 'Kerry Express', emoji: '📦' },
                        { id: 'flash', name: 'Flash Express', emoji: '⚡' },
                        { id: 'thaipost', name: 'ไปรษณีย์ไทย', emoji: '📮' },
                        { id: 'jt', name: 'J&T Express', emoji: '🚚' },
                        { id: 'grab', name: 'Grab Delivery', emoji: '🏍️' }
                      ].map((p) => (
                        <div
                          key={p.id}
                          className={`spw-ship-item ${wizardData.shippingProviders.includes(p.id) ? 'selected' : ''}`}
                          onClick={() => toggleShipProvider(p.id)}
                        >
                          <span className="spw-ship-emoji">{p.emoji}</span>
                          <span>{p.name}</span>
                          {wizardData.shippingProviders.includes(p.id) && <Check size={14} color="#059669" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )

      /* -------- STEP 6: Promo Banner -------- */
      case 6:
        return (
          <div className="spw-step-content">
            <div className="spw-section-card">
              <div className="spw-section-header">
                <Sparkles size={18} color="#059669" />
                <h4>ขั้นตอนที่ 6: แบนเนอร์โปรโมชั่น (PROMO BANNER)</h4>
              </div>
              <p className="spw-section-desc">เพิ่มแบนเนอร์โปรโมชั่นเพื่อดึงดูดลูกค้า</p>

              <div className="spw-form-group">
                <label htmlFor="wz-banner-img">URL รูปแบนเนอร์</label>
                <input
                  id="wz-banner-img"
                  value={wizardData.bannerImage}
                  onChange={(e) => setWizardData({ ...wizardData, bannerImage: e.target.value })}
                  placeholder="https://example.com/banner.jpg"
                />
                {wizardData.bannerImage && (
                  <div className="spw-banner-preview">
                    <img src={wizardData.bannerImage} alt="Banner Preview" />
                  </div>
                )}
              </div>

              <div className="spw-form-group">
                <label htmlFor="wz-banner-text">ข้อความบนแบนเนอร์</label>
                <input
                  id="wz-banner-text"
                  value={wizardData.bannerText}
                  onChange={(e) => setWizardData({ ...wizardData, bannerText: e.target.value })}
                  placeholder="เช่น ลดสูงสุด 50% เฉพาะวันนี้!"
                />
              </div>

              <div className="spw-form-group">
                <label htmlFor="wz-banner-url">ลิงก์เมื่อกดแบนเนอร์ (ถ้ามี)</label>
                <input
                  id="wz-banner-url"
                  value={wizardData.bannerUrl}
                  onChange={(e) => setWizardData({ ...wizardData, bannerUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>
        )

      /* -------- STEP 7: Review & Confirm -------- */
      case 7:
        return (
          <div className="spw-step-content">
            <div className="spw-section-card">
              <div className="spw-section-header">
                <CheckCircle2 size={18} color="#059669" />
                <h4>ขั้นตอนที่ 7: ตรวจสอบและยืนยัน</h4>
              </div>
              <p className="spw-section-desc">ตรวจสอบข้อมูลทั้งหมดก่อนเผยแพร่เซลเพจ</p>

              <div className="spw-review-grid">
                <div className="spw-review-item">
                  <label>เทมเพลต</label>
                  <span>{wizardData.template === 'shopfront' ? 'ShopFront' : wizardData.template === 'landing' ? 'Landing Page' : 'Catalog'}</span>
                </div>
                <div className="spw-review-item">
                  <label>ชื่อหน้า</label>
                  <span>{wizardData.pageName || '—'}</span>
                </div>
                <div className="spw-review-item">
                  <label>URL</label>
                  <span>https://{wizardData.domain}/{wizardData.slug || '—'}</span>
                </div>
                <div className="spw-review-item">
                  <label>สินค้า</label>
                  <span>{wizardData.products.length} รายการ</span>
                </div>
                <div className="spw-review-item">
                  <label>SEO Title</label>
                  <span>{wizardData.seoTitle || '—'}</span>
                </div>
                <div className="spw-review-item">
                  <label>ช่องทางชำระเงิน</label>
                  <span>{wizardData.paymentChannels.length} ช่องทาง</span>
                </div>
                <div className="spw-review-item">
                  <label>ระบบจัดส่ง</label>
                  <span>{wizardData.shippingEnabled ? `เปิด (฿${wizardData.shippingCost})` : 'ปิด'}</span>
                </div>
                <div className="spw-review-item">
                  <label>แบนเนอร์</label>
                  <span>{wizardData.bannerText || (wizardData.bannerImage ? 'มีรูปแบนเนอร์' : '—')}</span>
                </div>
              </div>

              {/* Live Preview Mascot */}
              <div className="spw-review-mascot">
                <img src="/mascot/kyc_10_holding_pen.png" alt="Review" />
                <div>
                  <strong>พร้อมเผยแพร่หน้าเซลเพจ!</strong>
                  <span>กดปุ่ม "เผยแพร่เซลเพจ" ด้านล่างเพื่อเริ่มใช้งาน</span>
                </div>
              </div>
            </div>
          </div>
        )

      /* -------- STEP 8: Statistics (Post-Publish) -------- */
      case 8:
        return (
          <div className="spw-step-content">
            <div className="spw-section-card spw-stats-card">
              <div className="spw-section-header">
                <BarChart3 size={18} color="#059669" />
                <h4>ขั้นตอนที่ 8: สถิติเซลเพจ (STATISTICS)</h4>
              </div>
              <p className="spw-section-desc">ข้อมูลสถิติหลังจากเผยแพร่เซลเพจสำเร็จ</p>

              <div className="spw-stats-success-banner">
                <CheckCircle2 size={28} color="#059669" />
                <div>
                  <strong>เผยแพร่เซลเพจสำเร็จแล้ว! 🎉</strong>
                  <span>https://{wizardData.domain}/{wizardData.slug || 'my-page'}</span>
                </div>
              </div>

              <div className="spw-stats-grid">
                <div className="spw-stat-box">
                  <div className="spw-stat-icon blue"><Eye size={20} /></div>
                  <div className="spw-stat-info">
                    <span>จำนวนเข้าชม</span>
                    <strong>0</strong>
                  </div>
                </div>
                <div className="spw-stat-box">
                  <div className="spw-stat-icon green"><ShoppingBag size={20} /></div>
                  <div className="spw-stat-info">
                    <span>ยอดขาย</span>
                    <strong>฿0.00</strong>
                  </div>
                </div>
                <div className="spw-stat-box">
                  <div className="spw-stat-icon orange"><TrendingUp size={20} /></div>
                  <div className="spw-stat-info">
                    <span>Conversion Rate</span>
                    <strong>0.00%</strong>
                  </div>
                </div>
              </div>

              <div className="spw-chart-placeholder">
                <BarChart3 size={40} color="#cbd5e1" />
                <span>กราฟแสดงผลเมื่อมีข้อมูลสถิติ</span>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  /* ====================== MAIN RENDER ====================== */
  if (showWizard) {
    return (
      <div className="spw-wizard-container">
        {/* Wizard Header */}
        <div className="spw-wizard-header">
          <button className="spw-back-btn" onClick={() => { playTapSound('click'); setShowWizard(false) }} type="button">
            <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
            ย้อนกลับ
          </button>
          <h3>{editingPage ? `แก้ไข: ${editingPage.title}` : 'สร้างเซลเพจใหม่'}</h3>
        </div>

        {/* Step Progress Bar */}
        <div className="spw-step-bar">
          {STEP_LABELS.map((label, idx) => {
            const stepNum = idx + 1
            const isActive = stepNum === wizardStep
            const isDone = stepNum < wizardStep
            return (
              <div
                key={idx}
                className={`spw-step-dot ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                onClick={() => { if (isDone || isActive) { playTapSound('pop'); setWizardStep(stepNum) } }}
              >
                <div className="spw-dot-circle">
                  {isDone ? <Check size={12} /> : stepNum}
                </div>
                <span className="spw-dot-label">{label}</span>
              </div>
            )
          })}
        </div>

        {/* Step Content */}
        {renderWizardStep()}

        {/* Bottom Navigation */}
        <div className="spw-wizard-footer">
          {wizardStep > 1 && wizardStep < 8 && (
            <button type="button" className="spw-btn-prev" onClick={handlePrevStep}>
              ← ย้อนกลับ
            </button>
          )}
          {wizardStep < 7 && (
            <button type="button" className="spw-btn-next" onClick={handleNextStep}>
              ถัดไป →
            </button>
          )}
          {wizardStep === 7 && (
            <button type="button" className="spw-btn-publish" onClick={handlePublish}>
              <CheckCircle2 size={16} /> เผยแพร่เซลเพจ
            </button>
          )}
          {wizardStep === 8 && (
            <button type="button" className="spw-btn-next" onClick={() => { playTapSound('click'); setShowWizard(false) }}>
              กลับไปรายการเซลเพจ
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="salespage-container">
      {/* 1. Title & Subtitle */}
      <div className="sp-page-title-wrap">
        <div>
          <h2>รายการเซลเพจ & หน้าร้านออนไลน์</h2>
          <p>จัดการหน้าร้านออนไลน์และตกแต่งลิงก์สำหรับส่งให้ลูกค้า</p>
        </div>
        <div className="sp-preview-actions">
          <button
            type="button"
            className="sp-preview-btn live"
            onClick={() => { playTapSound('pop'); setShowCustomerPreviewModal(true) }}
          >
            👁️ ดูตัวอย่างหน้าร้านฝั่งลูกค้าจริง (Live Preview)
          </button>
          <button
            type="button"
            className="sp-preview-btn meta"
            onClick={() => { playTapSound('click'); setShowOgMetaModal(true) }}
          >
            📲 ตั้งค่า Social Share (LINE/FB)
          </button>
        </div>
      </div>

      {/* 2. Quota Summary Card */}
      <div className="sp-quota-card">
        <div className="sp-quota-top">
          <span className="sp-quota-label">โควต้าการสร้างเซลเพจ</span>
          <span className="sp-premium-badge">แผน Premium</span>
        </div>
        <div className="sp-quota-number">
          <strong>{pages.length}</strong> <span>/ 10 หน้า</span>
        </div>
        <div className="sp-quota-progress-track">
          <div className="sp-quota-progress-bar" style={{ width: `${(pages.length / 10) * 100}%` }} />
        </div>
        <span className="sp-quota-foot-text">คุณสามารถสร้างได้อีก {10 - pages.length} หน้า</span>
      </div>

      {/* 3. Primary Green Create Button */}
      <button className="sp-main-create-btn" onClick={handleOpenCreateWizard} type="button">
        <Plus size={20} />
        <span>สร้างเซลเพจใหม่</span>
      </button>

      {/* 4. Search & Filter Bar */}
      <div className="sp-toolbar-row">
        <div className="sp-search-input-box">
          <Search size={18} color="#94a3b8" />
          <input
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาเซลเพจ..."
            value={searchQuery}
          />
        </div>
        <button className="sp-filter-btn" type="button" aria-label="ตัวกรอง" onClick={() => playTapSound('click')}>
          <SlidersHorizontal size={20} color="#334155" />
        </button>
      </div>

      {/* 5. Sales Page Cards List */}
      <div className="sp-cards-list">
        {filteredPages.map((page) => (
          <div className="sp-new-item-card" key={page.id}>
            <div className="sp-card-top-row">
              <div className="sp-icon-box">
                <LayoutGrid size={22} color="#4f46e5" />
              </div>
              <div className="sp-card-info">
                <div className="sp-card-title-line">
                  <strong>{page.title}</strong>
                  <span className={`sp-status-pill ${page.enabled ? 'active' : ''}`} onClick={() => handleToggle(page.id)} style={{ cursor: 'pointer' }}>
                    <span className="dot" /> {page.enabled ? 'เปิดใช้งานอยู่' : 'ปิดใช้งาน'}
                  </span>
                </div>
                <div className="sp-card-sub-line">
                  <Link size={13} color="#94a3b8" />
                  <span>Catalog Page</span>
                </div>
              </div>
            </div>

            <div className="sp-card-divider" />

            <div className="sp-card-bottom-actions">
              <button className="sp-act-edit" onClick={() => handleOpenEditWizard(page)} type="button">
                <Pencil size={15} /> แก้ไข
              </button>
              <button className="sp-act-copy" onClick={() => handleCopyLink(page)} type="button">
                <Copy size={15} /> {copiedId === page.id ? 'คัดลอกแล้ว!' : 'คัดลอกลิงก์'}
              </button>
              <button
                className="sp-act-open"
                onClick={() => handleOpenLink(page)}
                type="button"
                aria-label="คัดลอกและเปิดลิงก์"
              >
                <ArrowUpRight size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Action Button (FAB) */}
      <button className="sp-fab-btn" onClick={handleOpenCreateWizard} type="button" aria-label="สร้างเซลเพจใหม่">
        <Plus size={28} />
      </button>

      {/* Customer Live Mobile Preview Modal */}
      {showCustomerPreviewModal && (
        <div className="qs-modal-overlay" style={{ zIndex: 100030 }}>
          <div className="qs-modal sp-customer-preview-modal" style={{ maxWidth: 420 }}>
            <div className="qs-modal-header">
              <div>
                <h3>📱 ตัวอย่างหน้าร้านฝั่งลูกค้าจริง (Live Customer View)</h3>
                <p>มุมมองโทรศัพท์มือถือเมื่อลูกค้าสแกนสั่งซื้อ</p>
              </div>
              <button
                aria-label="ปิด"
                className="qs-modal-close"
                onClick={() => setShowCustomerPreviewModal(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="qs-modal-body sp-customer-phone-frame">
              {/* iPhone Mockup Status Bar */}
              <div className="sp-phone-top-bar">
                <span>9:41</span>
                <div className="sp-phone-notch" />
                <span>5G 🔋</span>
              </div>

              {/* Store Header */}
              <div className="sp-cust-store-header">
                <img src="/logo.png" alt="Logo" className="sp-cust-logo" />
                <div>
                  <h4>POP CAFE ✨</h4>
                  <p>เปิดให้บริการ · สั่งอาหาร & เครื่องดื่ม</p>
                </div>
              </div>

              {/* Search Bar */}
              <div className="sp-cust-search">
                <Search size={14} color="#94a3b8" />
                <input placeholder="ค้นหาเมนูอร่อย..." readOnly />
              </div>

              {/* Sample Product Grid */}
              <div className="sp-cust-prod-grid">
                <div className="sp-cust-card">
                  <div className="sp-cust-img">☕</div>
                  <h5>Iced Americano</h5>
                  <strong>฿65</strong>
                  <button type="button">+ สั่งซื้อ</button>
                </div>
                <div className="sp-cust-card">
                  <div className="sp-cust-img">🥐</div>
                  <h5>Croissant เนยสด</h5>
                  <strong>฿65</strong>
                  <button type="button">+ สั่งซื้อ</button>
                </div>
              </div>

              {/* Cart Banner */}
              <div className="sp-cust-cart-banner">
                <div className="sp-cust-cart-text">
                  <ShoppingBag size={16} />
                  <span>2 รายการในตะกร้า</span>
                </div>
                <strong>฿130.00 ›</strong>
              </div>
            </div>

            <div className="qs-modal-footer">
              <button
                className="qs-btn-submit"
                onClick={() => setShowCustomerPreviewModal(false)}
                type="button"
              >
                เสร็จสิ้น
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Social Open Graph Meta Modal */}
      {showOgMetaModal && (
        <div className="qs-modal-overlay" style={{ zIndex: 100030 }}>
          <div className="qs-modal" style={{ maxWidth: 460 }}>
            <div className="qs-modal-header">
              <div>
                <h3>📲 ตั้งค่า Social Share (LINE / Facebook)</h3>
                <p>กำหนดข้อความและรูปภาพพรีวิวเมื่อส่งลิงก์แชร์ในโซเชียล</p>
              </div>
              <button
                aria-label="ปิด"
                className="qs-modal-close"
                onClick={() => setShowOgMetaModal(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="qs-modal-body">
              <div className="qs-form-group">
                <label>หัวข้อเว็บไซต์ (Social Title)</label>
                <input
                  type="text"
                  value={ogTitle}
                  onChange={(e) => setOgTitle(e.target.value)}
                />
              </div>

              <div className="qs-form-group">
                <label>คำอธิบายย่อ (Meta Description)</label>
                <textarea
                  rows={3}
                  value={ogDesc}
                  onChange={(e) => setOgDesc(e.target.value)}
                />
              </div>

              {/* Social Snippet Card Preview */}
              <div className="sp-og-preview-card">
                <div className="sp-og-preview-img">
                  <span>🖼️ รูปภาพพรีวิวแชร์ (1200 x 630 px)</span>
                </div>
                <div className="sp-og-preview-text">
                  <strong>{ogTitle}</strong>
                  <p>{ogDesc}</p>
                  <small>chatpos.link</small>
                </div>
              </div>
            </div>

            <div className="qs-modal-footer">
              <button
                className="qs-btn-cancel"
                onClick={() => setShowOgMetaModal(false)}
                type="button"
              >
                ยกเลิก
              </button>
              <button
                className="qs-btn-submit"
                onClick={() => {
                  playTapSound('success')
                  alert('บันทึกการตั้งค่า Social Open Graph Meta เรียบร้อยแล้ว!')
                  setShowOgMetaModal(false)
                }}
                type="button"
              >
                บันทึกการตั้งค่า
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ==========================================================================
   ORDERS VIEW (All Orders Dashboard)
   ========================================================================== */
export type OrderItem = {
  id: string
  orderNo: string
  customer: string
  avatarText?: string
  isVip?: boolean
  date: string
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  amount: number
  paymentMethod: string
  cancelNote?: string
}

const initialOrders: OrderItem[] = [
  {
    id: 'ord-1',
    orderNo: '#ORD250625-01',
    customer: 'Coffee Shop Official',
    isVip: true,
    date: '25 มิ.ย. 2567 17:44',
    status: 'pending',
    amount: 102.00,
    paymentMethod: 'PromptPay'
  },
  {
    id: 'ord-2',
    orderNo: '#ORD250625-02',
    customer: 'Sweet Bakery',
    avatarText: 'S',
    date: '25 มิ.ย. 2567 17:30',
    status: 'processing',
    amount: 350.00,
    paymentMethod: 'โอนเงิน 🏛️'
  },
  {
    id: 'ord-3',
    orderNo: '#ORD250625-03',
    customer: 'Mook Shop',
    avatarText: 'M',
    date: '25 มิ.ย. 2567 16:58',
    status: 'completed',
    amount: 480.00,
    paymentMethod: 'PromptPay'
  },
  {
    id: 'ord-4',
    orderNo: '#ORD250625-04',
    customer: 'Nana Beauty',
    avatarText: 'N',
    date: '25 มิ.ย. 2567 16:15',
    status: 'completed',
    amount: 890.00,
    paymentMethod: 'บัตรเครดิต 💳'
  },
  {
    id: 'ord-5',
    orderNo: '#ORD250625-05',
    customer: 'Ploy Stationery',
    avatarText: 'P',
    date: '25 มิ.ย. 2567 15:40',
    status: 'cancelled',
    amount: 150.00,
    paymentMethod: 'PromptPay',
    cancelNote: 'ยกเลิกโดยลูกค้า'
  }
]

export type SubQrItem = {
  id: string
  title: string
  subtitle: string
  slug: string
  qrImgUrl: string
  badgeText: string
  badgeClass: string
  canCustomAmount?: boolean
}

function OrdersView({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const [orders] = useState<OrderItem[]>(initialOrders)
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'processing' | 'completed' | 'cancelled'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Custom /xx Slugs State
  const [qrSlugs, setQrSlugs] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('merchant_qr_slugs')
    if (saved) {
      try { return JSON.parse(saved) } catch (e) {}
    }
    return {
      'channel-shop': 'shop',
      'channel-table': 'table',
      'channel-delivery': 'delivery',
      'channel-booking': 'booking',
      'channel-custom': 'custom',
      'qr-salespage': 'shop',
      'qr-table': 'table',
      'qr-delivery': 'delivery',
      'qr-booking': 'booking',
      'qr-custom': 'custom',
      'qr-promptpay': 'pay',
      'qr-stoppay': 'stoppay',
      'qr-truemoney': 'truemoney',
      'qr-wechat': 'wechat',
      'qr-card': 'card'
    }
  })

  // QR Code Center Modal State with refresh persistence
  const [isQrModalOpen, setIsQrModalOpen] = useState(() => {
    return localStorage.getItem('merchant_qr_modal_open') === 'true'
  })
  const [selectedQr, setSelectedQr] = useState<any | null>(null)
  const [customAmountInput, setCustomAmountInput] = useState('')
  const [generatedAmount, setGeneratedAmount] = useState<number | null>(null)
  const [copiedQrId, setCopiedQrId] = useState<string | null>(null)
  const [realQrDataUrl, setRealQrDataUrl] = useState<string>('')

  // Generate live scannable QR Code Data URL whenever selectedQr or generatedAmount changes
  useEffect(() => {
    if (!selectedQr) {
      setRealQrDataUrl('')
      return
    }

    const currentSlug = qrSlugs[selectedQr.id] || selectedQr.slug || 'shop'
    const fullUrl = `${window.location.origin}/${currentSlug}`

    if (generatedAmount && generatedAmount > 0) {
      generatePromptPayQrDataUrl(getStoredPromptPayId(), generatedAmount, 320)
        .then(setRealQrDataUrl)
        .catch(() => {})
    } else {
      generateUrlQrDataUrl(fullUrl, 320)
        .then(setRealQrDataUrl)
        .catch(() => {})
    }
  }, [selectedQr, generatedAmount, qrSlugs])
  // Sub-QR Channel State
  const [selectedChannel, setSelectedChannel] = useState<any | null>(null)
  const [isAddSubModalOpen, setIsAddSubModalOpen] = useState(false)
  const [newSubTitle, setNewSubTitle] = useState('')
  const [newSubDesc, setNewSubDesc] = useState('')
  const [newSubSlug, setNewSubSlug] = useState('')

  // Channel Groups with Sub-QR Items
  const [channelGroups, setChannelGroups] = useState<any[]>(() => {
    const saved = localStorage.getItem('merchant_channel_groups')
    if (saved) {
      try { return JSON.parse(saved) } catch (e) {}
    }
    return [
      {
        id: 'channel-shop',
        title: 'หน้าร้านค้าออนไลน์',
        badgeText: 'สั่งของจากหน้าร้าน',
        badgeClass: 'green',
        mascotImg: '/mascot/nabtang_holding_phone.png',
        defaultSlug: 'shop',
        description: 'ลูกค้ากดตัวเลขระบุยอดเงิน แล้วเลือกช่องทางชำระเงิน',
        subItems: [
          {
            id: 'sub-promptpay',
            title: 'PromptPay QR (พร้อมเพย์รับชำระ)',
            subtitle: 'รับเงินโอนเข้ากระเป๋าร้านค้า (Merchant ID: S072609429)',
            slug: 'shop-promptpay',
            qrImgUrl: '/payments/promptpay_front.png',
            badgeText: '🟢 พร้อมใช้งาน',
            badgeClass: 'green',
            canCustomAmount: true
          },
          {
            id: 'sub-truemoney',
            title: 'TrueMoney Wallet QR Code',
            subtitle: 'รับชำระเงินผ่าน TrueMoney Wallet',
            slug: 'shop-truemoney',
            qrImgUrl: '/payments/truemoney_front.png',
            badgeText: '🟠 TrueMoney',
            badgeClass: 'orange'
          },
          {
            id: 'sub-wechat',
            title: 'WeChat Pay / Alipay QR Code',
            subtitle: 'รองรับนักท่องเที่ยวจีนและกระเป๋าเงินต่างประเทศ',
            slug: 'shop-wechat',
            qrImgUrl: '/payments/wechatpay_front.png',
            badgeText: '🇨🇳 Global Pay',
            badgeClass: 'blue'
          },
          {
            id: 'sub-card',
            title: 'Credit Card QR (บัตรเครดิตออนไลน์)',
            subtitle: 'รับชำระเงินผ่านบัตรเครดิต/เดบิต VISA & MasterCard',
            slug: 'shop-card',
            qrImgUrl: '/payments/mastercard_visa_combined.png',
            badgeText: '💳 บัตรเครดิต',
            badgeClass: 'blue'
          }
        ]
      },
      {
        id: 'channel-table',
        title: 'สแกนสั่งอาหารที่โต๊ะ',
        badgeText: 'สั่งตามโต๊ะ',
        badgeClass: 'green',
        mascotImg: '/mascot/menu_stoppay.png',
        defaultSlug: 'table',
        description: 'ลูกค้าเลือกอาหารหรือเมนูก่อน แล้วกรอกเฉพาะหมายเหตุ ระบบจะระบุหมายเลขโต๊ะให้อัตโนมัติ',
        subItems: [
          {
            id: 'sub-t01',
            title: 'คิวอาร์ประจำ โต๊ะที่ 1 (Table #01)',
            subtitle: 'โซนห้องแอร์ด้านใน - พักได้ 4 ท่าน',
            slug: 't01',
            qrImgUrl: '/payments/promptpay_front.png',
            badgeText: '🍽️ โต๊ะ 01',
            badgeClass: 'green'
          },
          {
            id: 'sub-t02',
            title: 'คิวอาร์ประจำ โต๊ะที่ 2 (Table #02)',
            subtitle: 'โซนห้องแอร์ด้านใน - พักได้ 4 ท่าน',
            slug: 't02',
            qrImgUrl: '/payments/promptpay_front.png',
            badgeText: '🍽️ โต๊ะ 02',
            badgeClass: 'green'
          },
          {
            id: 'sub-t03',
            title: 'คิวอาร์ประจำ โต๊ะที่ 3 (Table #03)',
            subtitle: 'โซนระเบียงริมสวน (Outdoor Garden)',
            slug: 't03',
            qrImgUrl: '/payments/promptpay_front.png',
            badgeText: '🌿 โต๊ะ 03',
            badgeClass: 'green'
          },
          {
            id: 'sub-vip01',
            title: 'คิวอาร์ประจำ โต๊ะ VIP 1 (VIP Room 1)',
            subtitle: 'ห้องปาร์ตี้ส่วนตัว VIP 1 (รองรับ 10 ท่าน)',
            slug: 'vip01',
            qrImgUrl: '/payments/promptpay_front.png',
            badgeText: '👑 VIP 01',
            badgeClass: 'purple'
          }
        ]
      },
      {
        id: 'channel-delivery',
        title: 'เดลิเวอรี & รับเองที่ร้าน',
        badgeText: 'ส่งบ้าน / รับเอง',
        badgeClass: 'blue',
        mascotImg: '/mascot/pay_channel_4_wechat.png',
        defaultSlug: 'delivery',
        description: 'เลือกเมนู กรอกชื่อ เบอร์ และหมายเหตุ พร้อมเลือกวันที่และเวลาจัดส่งหรือรับสินค้าเองที่ร้าน',
        subItems: [
          {
            id: 'sub-deliv-home',
            title: 'จัดส่งถึงบ้าน (Home Delivery)',
            subtitle: 'สั่งไรเดอร์จัดส่งอาหารและสินค้าถึงที่พัก',
            slug: 'delivery-home',
            qrImgUrl: '/payments/promptpay_front.png',
            badgeText: '🚚 Delivery',
            badgeClass: 'blue'
          },
          {
            id: 'sub-pickup-store',
            title: 'รับสินค้าเองที่ร้าน (Self-Pickup)',
            subtitle: 'สั่งล่วงหน้า ชำระเงิน แล้วมารับที่เคาน์เตอร์',
            slug: 'pickup-store',
            qrImgUrl: '/payments/promptpay_front.png',
            badgeText: '🛍️ Self-Pickup',
            badgeClass: 'green'
          },
          {
            id: 'sub-drivethru',
            title: 'สั่งผ่านช่อง Drive-Thru',
            subtitle: 'สั่งล่วงหน้า รับสินค้าที่ช่องรับสินค้าไดร์ฟทรู',
            slug: 'drivethru',
            qrImgUrl: '/payments/promptpay_front.png',
            badgeText: '🚗 Drive-Thru',
            badgeClass: 'orange'
          }
        ]
      },
      {
        id: 'channel-booking',
        title: 'จองโต๊ะ & สั่งล่วงหน้า',
        badgeText: 'จองโต๊ะ / สั่งล่วงหน้า',
        badgeClass: 'purple',
        mascotImg: '/mascot/pay_channel_2_card.png',
        defaultSlug: 'booking',
        description: 'จองโต๊ะหรือสั่งล่วงหน้า กรอกข้อมูลและเลือกวันเวลา โดยจะเลือกเมนูตอนนี้หรือเลือกทีหลังก็ได้',
        subItems: [
          {
            id: 'sub-reserve-table',
            title: 'คิวอาร์จองโต๊ะทานอาหารล่วงหน้า',
            subtitle: 'เลือกจำนวนท่าน วันและเวลารับบริการ',
            slug: 'reserve-table',
            qrImgUrl: '/payments/promptpay_front.png',
            badgeText: '📅 จองโต๊ะ',
            badgeClass: 'purple'
          },
          {
            id: 'sub-preorder-food',
            title: 'คิวอาร์สั่งเมนูอาหารล่วงหน้า (Pre-order)',
            subtitle: 'เลือกเมนู มัดจำ/จ่ายล่วงหน้า มาถึงทานได้ทันที',
            slug: 'preorder-food',
            qrImgUrl: '/payments/promptpay_front.png',
            badgeText: '🍱 สั่งล่วงหน้า',
            badgeClass: 'green'
          },
          {
            id: 'sub-reserve-vip',
            title: 'คิวอาร์จองห้องรับรอง VIP / จัดเลี้ยง',
            subtitle: 'จองห้องจัดเลี้ยงส่วนตัวสำหรับกลุ่มคณะ',
            slug: 'reserve-vip',
            qrImgUrl: '/payments/promptpay_front.png',
            badgeText: '👑 จองห้อง VIP',
            badgeClass: 'purple'
          }
        ]
      },
      {
        id: 'channel-custom',
        title: 'คิวอาร์ลิงก์กำหนดเอง',
        badgeText: 'ตั้งค่าอิสระ',
        badgeClass: 'slate',
        mascotImg: '/mascot/pay_channel_1_promptpay.png',
        defaultSlug: 'custom',
        description: 'สร้างคิวอาร์สั่งสินค้า สำหรับทำแคมเปญการตลาด โปรโมชันเฉพาะกลุ่ม หรือเมนูพิเศษๆ',
        subItems: [
          {
            id: 'sub-line-promo',
            title: 'แคมเปญโปรโมชัน Line OA Official',
            subtitle: 'แจกโค้ดส่วนลดสำหรับลูกค้าที่สแกนจาก Line OA',
            slug: 'line-promo',
            qrImgUrl: '/payments/promptpay_front.png',
            badgeText: '💚 Line OA',
            badgeClass: 'green'
          },
          {
            id: 'sub-discount-100',
            title: 'แคมเปญคูปองลด 100 บาท',
            subtitle: 'รับส่วนลด 100 บาท เมื่อซื้อสินค้าครบ 500 บาท',
            slug: 'coupon-100',
            qrImgUrl: '/payments/promptpay_front.png',
            badgeText: '🎉 ลด 100.-',
            badgeClass: 'orange'
          },
          {
            id: 'sub-festive-menu',
            title: 'คิวอาร์เมนูพิเศษประจำเทศกาล',
            subtitle: 'เมนูฤดูกาล Seasonal & Special Festive Menu',
            slug: 'festive-menu',
            qrImgUrl: '/payments/promptpay_front.png',
            badgeText: '✨ Seasonal',
            badgeClass: 'purple'
          }
        ]
      }
    ]
  })

  const [subSearch, setSubSearch] = useState('')
  const [isBatchPrintModalOpen, setIsBatchPrintModalOpen] = useState(false)

  const handleDeleteSubQr = (subId: string) => {
    if (!selectedChannel) return
    const updatedGroups = channelGroups.map((group) => {
      if (group.id === selectedChannel.id) {
        return {
          ...group,
          subItems: group.subItems.filter((item: SubQrItem) => item.id !== subId)
        }
      }
      return group
    })

    setChannelGroups(updatedGroups)
    localStorage.setItem('merchant_channel_groups', JSON.stringify(updatedGroups))
    const updatedSel = updatedGroups.find((g) => g.id === selectedChannel.id)
    setSelectedChannel(updatedSel)
    playTapSound('pop')
  }

  const handleAddSubQr = () => {
    if (!newSubTitle.trim()) return
    const cleanSlug = (newSubSlug.trim() || 'qr-' + Date.now()).replace(/^\/+/, '').toLowerCase()
    const newSub: SubQrItem = {
      id: 'sub-' + Date.now(),
      title: newSubTitle.trim(),
      subtitle: newSubDesc.trim() || 'คิวอาร์รับออเดอร์สร้างใหม่',
      slug: cleanSlug,
      qrImgUrl: '/payments/promptpay_front.png',
      badgeText: '✨ คิวอาร์ใหม่',
      badgeClass: 'green'
    }

    const updatedGroups = channelGroups.map((group) => {
      if (group.id === selectedChannel.id) {
        return { ...group, subItems: [...group.subItems, newSub] }
      }
      return group
    })

    setChannelGroups(updatedGroups)
    localStorage.setItem('merchant_channel_groups', JSON.stringify(updatedGroups))
    const updatedSelectedChannel = updatedGroups.find((g) => g.id === selectedChannel.id)
    setSelectedChannel(updatedSelectedChannel)

    setNewSubTitle('')
    setNewSubDesc('')
    setNewSubSlug('')
    setIsAddSubModalOpen(false)
    playTapSound('success')
  }
  const [editingSlugId, setEditingSlugId] = useState<string | null>(null)
  const [slugInputVal, setSlugInputVal] = useState('')

  useEffect(() => {
    localStorage.setItem('merchant_qr_modal_open', isQrModalOpen ? 'true' : 'false')
  }, [isQrModalOpen])

  const handleSaveSlug = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const cleanSlug = slugInputVal.trim().replace(/^\/+/, '').toLowerCase()
    if (!cleanSlug) return
    const updated = { ...qrSlugs, [id]: cleanSlug }
    setQrSlugs(updated)
    localStorage.setItem('merchant_qr_slugs', JSON.stringify(updated))
    setEditingSlugId(null)
    playTapSound('success')
  }

  const filteredOrders = orders.filter((ord) => {
    const matchesSearch =
      ord.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.customer.toLowerCase().includes(searchQuery.toLowerCase())
    if (activeFilter === 'all') return matchesSearch
    return matchesSearch && ord.status === activeFilter
  })

  const handleCopyQrLink = (url: string, id: string) => {
    navigator.clipboard?.writeText(url)
    setCopiedQrId(id)
    playTapSound('success')
    setTimeout(() => setCopiedQrId(null), 2000)
  }

  const handleGenerateCustomQr = (item: any) => {
    const num = parseFloat(customAmountInput)
    if (isNaN(num) || num <= 0) return
    playTapSound('success')
    setGeneratedAmount(num)
    setSelectedQr({ ...item })
  }

  return (
    <div className="orders-view">
      {/* Top 4 Status Metric Cards */}
      <section className="ov-status-grid">
        <div
          className={`ov-metric-card ov-card-all ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveFilter('all')}
          role="button"
          tabIndex={0}
        >
          <div className="ov-card-icon icon-green">
            <ShoppingBag size={20} />
          </div>
          <div className="ov-card-text">
            <span>ทั้งหมด</span>
            <strong>{orders.length}</strong>
            <small>ออเดอร์</small>
          </div>
        </div>

        <div
          className={`ov-metric-card ov-card-yellow ${activeFilter === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveFilter('pending')}
          role="button"
          tabIndex={0}
        >
          <div className="ov-card-icon icon-yellow">
            <Clock size={20} />
          </div>
          <div className="ov-card-text">
            <span>รอชำระเงิน</span>
            <strong>{orders.filter(o => o.status === 'pending').length}</strong>
            <small>ออเดอร์</small>
          </div>
        </div>

        <div
          className={`ov-metric-card ov-card-blue ${activeFilter === 'processing' ? 'active' : ''}`}
          onClick={() => setActiveFilter('processing')}
          role="button"
          tabIndex={0}
        >
          <div className="ov-card-icon icon-blue">
            <Truck size={20} />
          </div>
          <div className="ov-card-text">
            <span>กำลังดำเนินการ</span>
            <strong>{orders.filter(o => o.status === 'processing').length}</strong>
            <small>ออเดอร์</small>
          </div>
        </div>

        <div
          className={`ov-metric-card ov-card-mint ${activeFilter === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveFilter('completed')}
          role="button"
          tabIndex={0}
        >
          <div className="ov-card-icon icon-mint">
            <CheckCircle2 size={20} />
          </div>
          <div className="ov-card-text">
            <span>เสร็จสิ้น</span>
            <strong>{orders.filter(o => o.status === 'completed').length}</strong>
            <small>ออเดอร์</small>
          </div>
        </div>
      </section>

      {/* Top Action Cards */}
      <section className="ov-hero-action-cards">
        <div
          className="qs-card qs-card-orange"
          onClick={() => (onNavigate ? onNavigate('products') : alert('เปิดหน้ารายการสินค้า'))}
          role="button"
          tabIndex={0}
        >
          <div className="qs-card-icon-wrap qs-plus-icon">
            <Plus size={22} />
          </div>
          <div className="qs-card-text">
            <h3>เพิ่มสินค้าใหม่</h3>
          </div>
          <img src="/mascot/pos_1_scanning_barcode.png" className="qs-card-mascot-img" alt="เพิ่มสินค้า" />
        </div>

        <div
          className="qs-card qs-card-blue"
          onClick={() => { playTapSound('pop'); setIsQrModalOpen(true) }}
          role="button"
          tabIndex={0}
        >
          <div className="qs-card-icon-wrap">
            <QrCode size={22} />
          </div>
          <div className="qs-card-text">
            <h3>คิวอาร์โค้ด</h3>
          </div>
          <img src="/mascot/pay_2_scanning_qr.png" className="qs-card-mascot-img" alt="QR Codes" />
        </div>
      </section>

      {/* Search Toolbar & Filter */}
      <section className="ov-search-row">
        <div className="ov-search-box">
          <Search size={16} />
          <input
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาออเดอร์ / ชื่อลูกค้า / หมายเลขออเดอร์..."
            value={searchQuery}
          />
        </div>
        <button className="ov-filter-btn" type="button">
          <Filter size={15} /> ตัวกรอง
        </button>
      </section>

      {/* Filter Tabs */}
      <section className="ov-tab-pills">
        <button
          className={activeFilter === 'all' ? 'active' : ''}
          onClick={() => setActiveFilter('all')}
          type="button"
        >
          ☰ ทั้งหมด
        </button>
        <button
          className={activeFilter === 'pending' ? 'active' : ''}
          onClick={() => setActiveFilter('pending')}
          type="button"
        >
          🕒 รอชำระเงิน
        </button>
        <button
          className={activeFilter === 'processing' ? 'active' : ''}
          onClick={() => setActiveFilter('processing')}
          type="button"
        >
          📥 กำลังดำเนินการ
        </button>
        <button
          className={activeFilter === 'completed' ? 'active' : ''}
          onClick={() => setActiveFilter('completed')}
          type="button"
        >
          ✓ เสร็จสิ้น
        </button>
        <button
          className={activeFilter === 'cancelled' ? 'active' : ''}
          onClick={() => setActiveFilter('cancelled')}
          type="button"
        >
          🔴 ยกเลิก
        </button>
      </section>

      {/* Order Cards List Panel */}
      <section className="ov-orders-panel">
        <div className="ov-panel-toolbar">
          <button className="ov-sort-btn" type="button">
            <ArrowUpDown size={13} /> ล่าสุด ↑↓
          </button>
          <button className="ov-manage-btn" type="button">
            ⚙️ จัดการออเดอร์
          </button>
        </div>

        <div className="ov-orders-list">
          {filteredOrders.map((ord) => (
            <div className="ov-order-card" key={ord.id}>
              {/* Left Avatar Icon */}
              <div className={`ov-avatar-wrap ${ord.avatarText ? `avatar-${ord.avatarText.toLowerCase()}` : 'avatar-green'}`}>
                {ord.avatarText ? (
                  <span>{ord.avatarText}</span>
                ) : (
                  <ShoppingBag size={20} />
                )}
              </div>

              {/* Order Info */}
              <div className="ov-order-info">
                <div className="ov-order-no-row">
                  <strong>{ord.orderNo}</strong>
                  {ord.isVip && <span className="ov-vip-badge">VIP</span>}
                </div>
                <span className="ov-customer-name">{ord.customer}</span>
                <span className="ov-date-time">📅 {ord.date}</span>
              </div>

              {/* Status & Amount */}
              <div className="ov-order-status-col">
                {ord.status === 'pending' && (
                  <span className="ov-status-badge badge-pending">🕒 รอชำระเงิน</span>
                )}
                {ord.status === 'processing' && (
                  <span className="ov-status-badge badge-processing">🚚 กำลังดำเนินการ</span>
                )}
                {ord.status === 'completed' && (
                  <span className="ov-status-badge badge-completed">🟢 เสร็จสิ้น</span>
                )}
                {ord.status === 'cancelled' && (
                  <span className="ov-status-badge badge-cancelled">🔴 ยกเลิก</span>
                )}

                <div className={`ov-amount ${ord.status === 'cancelled' ? 'cancelled-amount' : ''}`}>
                  ฿{ord.amount.toFixed(2)}
                </div>

                <div className="ov-payment-method">
                  <span>{ord.paymentMethod}</span>
                  {ord.cancelNote && <small className="ov-cancel-note">{ord.cancelNote}</small>}
                </div>
              </div>

              {/* Right Arrow */}
              <button aria-label="ดูรายละเอียดออเดอร์" className="ov-arrow-btn" type="button">
                <ChevronRight size={18} />
              </button>
            </div>
          ))}

          {filteredOrders.length === 0 && (
            <div className="empty-state">ไม่พบออเดอร์ตามเงื่อนไขที่เลือก</div>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="ov-pagination">
          <button className="ov-page-btn disabled" disabled type="button">
            ‹ ก่อนหน้า
          </button>
          <span className="ov-page-indicator">1 / 4</span>
          <button className="ov-page-btn" type="button">
            ถัดไป ›
          </button>
        </div>
      </section>

      {/* QR Code Management Modal (Matching User Design Mockup 100%) */}
      {isQrModalOpen && (
        <div className="qrm-modal-overlay">
          <div className="qrm-modal-card">
            {/* Header Banner with Emerald Green Gradient */}
            <div className="qrm-header">
              <div className="qrm-header-top-row">
                <button
                  className="qrm-back-btn"
                  onClick={() => { playTapSound('click'); setIsQrModalOpen(false) }}
                  type="button"
                  aria-label="ย้อนกลับ"
                >
                  <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
                </button>
                <span className="qrm-badge-tag">QR MANAGEMENT</span>
              </div>

              <div className="qrm-title-row">
                <div className="qrm-title-icon-box">
                  <QrCode size={26} color="#059669" />
                </div>
                <div className="qrm-title-text">
                  <h2>ตั้งค่า QR Code</h2>
                  <p>POP CAFE ✨ · ตั้งค่าช่องทางคิวอาร์รับออเดอร์</p>
                </div>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="qrm-body">
              {selectedChannel ? (
                /* Sub-Channel QR Code List View */
                <div className="qrm-subchannel-view">
                  <div className="qrm-subchannel-top-bar">
                    <button
                      type="button"
                      className="qrm-sub-back-btn"
                      onClick={() => { playTapSound('click'); setSelectedChannel(null) }}
                    >
                      <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /> ย้อนกลับหมวดหมู่
                    </button>
                    <div className="qrm-top-right-group">
                      <button
                        type="button"
                        className="qrm-print-sheet-btn"
                        onClick={() => { playTapSound('pop'); setIsBatchPrintModalOpen(true) }}
                      >
                        <Printer size={14} /> 🖨️ พิมพ์สติ๊กเกอร์ QR ทุกโต๊ะ/ช่องทาง
                      </button>
                      <span className={`qrm-pill ${selectedChannel.badgeClass}`}>{selectedChannel.badgeText}</span>
                    </div>
                  </div>

                  <div className="qrm-subchannel-heading">
                    <h3>{selectedChannel.title}</h3>
                    <p>{selectedChannel.description}</p>
                  </div>

                  {/* Search Sub-QR Bar */}
                  <div className="qrm-sub-search-box">
                    <Search size={15} />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อคิวอาร์ หรือ /xx slug..."
                      value={subSearch}
                      onChange={(e) => setSubSearch(e.target.value)}
                    />
                  </div>

                  <div className="qrm-sub-tip-banner">
                    💡 รายการคิวอาร์โค้ดประจำช่องทางนี้ (มีทั้งหมด {selectedChannel.subItems.length} รายการ)
                  </div>

                  {/* Sub QR Items List */}
                  <div className="qrm-menu-list">
                    {selectedChannel.subItems
                      .filter((item: any) =>
                        item.title.toLowerCase().includes(subSearch.toLowerCase()) ||
                        item.slug.toLowerCase().includes(subSearch.toLowerCase()) ||
                        (qrSlugs[item.id] || '').toLowerCase().includes(subSearch.toLowerCase())
                      )
                      .map((sub: any) => (
                        <div key={sub.id} className="qrm-menu-card qrm-sub-card">
                          <div className={`qrm-card-icon-box ${sub.badgeClass || 'green'}`}>
                            <QrCode size={22} />
                          </div>
                          <div className="qrm-card-body">
                            <div className="qrm-card-title-row">
                              <h3>{sub.title}</h3>
                            </div>
                            <span className={`qrm-pill ${sub.badgeClass || 'green'}`}>{sub.badgeText}</span>
                            <p>{sub.subtitle}</p>

                            {/* URL Slug /xx Bar */}
                            <div className="qrm-slug-bar" onClick={(e) => e.stopPropagation()}>
                              <span className="qrm-slug-tag">🔗 chatpos.link/<strong>{qrSlugs[sub.id] || sub.slug}</strong></span>
                              {editingSlugId === sub.id ? (
                                <div className="qrm-slug-edit-row">
                                  <span className="qrm-slash">/</span>
                                  <input
                                    type="text"
                                    className="qrm-slug-input"
                                    value={slugInputVal}
                                    onChange={(e) => setSlugInputVal(e.target.value)}
                                    placeholder="ระบุ /xx"
                                    autoFocus
                                  />
                                  <button type="button" className="qrm-slug-save-btn" onClick={(e) => handleSaveSlug(sub.id, e)}>บันทึก</button>
                                  <button type="button" className="qrm-slug-cancel-btn" onClick={() => setEditingSlugId(null)}>ยกเลิก</button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="qrm-slug-edit-btn"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingSlugId(sub.id)
                                    setSlugInputVal(qrSlugs[sub.id] || sub.slug)
                                  }}
                                >
                                  ✏️ ตั้งค่า /xx
                                </button>
                              )}
                            </div>

                            {/* Action Buttons Row */}
                            <div className="qrm-sub-actions-row">
                              <button
                                type="button"
                                className="qrm-sub-action-btn view-qr"
                                onClick={() => { playTapSound('pop'); setSelectedQr(sub) }}
                              >
                                👁️ ดูรูป QR Code
                              </button>
                              <button
                                type="button"
                                className="qrm-sub-action-btn copy-link"
                                onClick={() => handleCopyQrLink('https://chatpos.link/' + (qrSlugs[sub.id] || sub.slug), sub.id)}
                              >
                                <Copy size={13} /> {copiedQrId === sub.id ? 'คัดลอกแล้ว!' : 'คัดลอกลิงก์'}
                              </button>
                              <button
                                type="button"
                                className="qrm-sub-action-btn delete-btn"
                                onClick={() => {
                                  if (confirm(`คุณต้องการลบ "${sub.title}" หรือไม่?`)) {
                                    handleDeleteSubQr(sub.id)
                                  }
                                }}
                              >
                                🗑️ ลบ
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Add New Sub-QR Button */}
                  <button
                    type="button"
                    className="qrm-add-sub-qr-btn"
                    onClick={() => { playTapSound('pop'); setIsAddSubModalOpen(true) }}
                  >
                    ➕ สร้าง / เพิ่ม คิวอาร์โค้ดใหม่ในหมวดนี้
                  </button>
                </div>
              ) : (
                /* 5 Main Channel Cards List */
                <>
                  <div className="qrm-tip-card">
                    <div className="qrm-tip-icon">💡</div>
                    <div className="qrm-tip-text">
                      <strong>เลือกประเภท QR ที่ต้องการจัดการ</strong>
                      <p>สร้างและตั้งค่า QR สำหรับหน้าร้าน โต๊ะออเดอร์ เดลิเวอรี หรือแคมเปญได้จากเมนูด้านล่าง</p>
                    </div>
                  </div>

                  <div className="qrm-menu-list">
                    {/* 1. หน้าร้านค้าออนไลน์ */}
                    <div
                      className="qrm-menu-card"
                      onClick={() => {
                        playTapSound('pop')
                        const currentSlug = qrSlugs['channel-shop'] || 'shop'
                        setSelectedQr({
                          id: 'channel-shop',
                          title: 'หน้าร้านค้าออนไลน์',
                          subtitle: 'สแกนเพื่อเปิดหน้าคิดเงินและชำระเงิน',
                          slug: currentSlug,
                          linkUrl: window.location.origin + '/' + currentSlug,
                          qrImgUrl: '/payments/promptpay_front.png',
                          canCustomAmount: true,
                          badgeText: '🟢 พร้อมใช้งาน',
                          badgeClass: 'green'
                        })
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="qrm-card-icon-box green">
                        <QrCode size={22} color="#059669" />
                      </div>
                      <div className="qrm-card-body">
                        <div className="qrm-card-title-row">
                          <h3>หน้าร้านค้าออนไลน์</h3>
                        </div>
                        <span className="qrm-pill green">สั่งของจากหน้าร้าน · {channelGroups[0]?.subItems?.length || 4} รายการ</span>
                        <p>ลูกค้ากดตัวเลขระบุยอดเงิน แล้วเลือกช่องทางชำระเงิน</p>

                        <div className="qrm-slug-bar" onClick={(e) => e.stopPropagation()}>
                          <span className="qrm-slug-tag">🔗 chatpos.link/<strong>{qrSlugs['channel-shop'] || 'shop'}</strong></span>
                          {editingSlugId === 'channel-shop' ? (
                            <div className="qrm-slug-edit-row">
                              <span className="qrm-slash">/</span>
                              <input
                                type="text"
                                className="qrm-slug-input"
                                value={slugInputVal}
                                onChange={(e) => setSlugInputVal(e.target.value)}
                                placeholder="ระบุ /xx เช่น shop"
                                autoFocus
                              />
                              <button type="button" className="qrm-slug-save-btn" onClick={(e) => handleSaveSlug('channel-shop', e)}>บันทึก</button>
                              <button type="button" className="qrm-slug-cancel-btn" onClick={() => setEditingSlugId(null)}>ยกเลิก</button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="qrm-slug-edit-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingSlugId('channel-shop')
                                setSlugInputVal(qrSlugs['channel-shop'] || 'shop')
                              }}
                            >
                              ✏️ ตั้งค่า /xx
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="qrm-card-arrow">
                        <ChevronRight size={18} />
                      </div>
                    </div>

                    {/* 2. สแกนสั่งอาหารที่โต๊ะ */}
                    <div
                      className="qrm-menu-card"
                      onClick={() => { playTapSound('pop'); setSelectedChannel(channelGroups[1]) }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="qrm-card-icon-box green">
                        <Utensils size={22} color="#059669" />
                      </div>
                      <div className="qrm-card-body">
                        <div className="qrm-card-title-row">
                          <h3>สแกนสั่งอาหารที่โต๊ะ</h3>
                        </div>
                        <span className="qrm-pill green">สั่งตามโต๊ะ · {channelGroups[1]?.subItems?.length || 4} รายการ</span>
                        <p>ลูกค้าเลือกอาหารหรือเมนูก่อน แล้วกรอกเฉพาะหมายเหตุ ระบบจะระบุหมายเลขโต๊ะให้อัตโนมัติ</p>

                        <div className="qrm-slug-bar" onClick={(e) => e.stopPropagation()}>
                          <span className="qrm-slug-tag">🔗 chatpos.link/<strong>{qrSlugs['channel-table'] || 'table'}</strong></span>
                          {editingSlugId === 'channel-table' ? (
                            <div className="qrm-slug-edit-row">
                              <span className="qrm-slash">/</span>
                              <input
                                type="text"
                                className="qrm-slug-input"
                                value={slugInputVal}
                                onChange={(e) => setSlugInputVal(e.target.value)}
                                placeholder="ระบุ /xx เช่น table"
                                autoFocus
                              />
                              <button type="button" className="qrm-slug-save-btn" onClick={(e) => handleSaveSlug('channel-table', e)}>บันทึก</button>
                              <button type="button" className="qrm-slug-cancel-btn" onClick={() => setEditingSlugId(null)}>ยกเลิก</button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="qrm-slug-edit-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingSlugId('channel-table')
                                setSlugInputVal(qrSlugs['channel-table'] || 'table')
                              }}
                            >
                              ✏️ ตั้งค่า /xx
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="qrm-card-arrow">
                        <ChevronRight size={18} />
                      </div>
                    </div>

                    {/* 3. เดลิเวอรี & รับเองที่ร้าน */}
                    <div
                      className="qrm-menu-card"
                      onClick={() => { playTapSound('pop'); setSelectedChannel(channelGroups[2]) }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="qrm-card-icon-box blue">
                        <Truck size={22} color="#2563eb" />
                      </div>
                      <div className="qrm-card-body">
                        <div className="qrm-card-title-row">
                          <h3>เดลิเวอรี & รับเองที่ร้าน</h3>
                        </div>
                        <span className="qrm-pill blue">ส่งบ้าน / รับเอง · {channelGroups[2]?.subItems?.length || 3} รายการ</span>
                        <p>เลือกเมนู กรอกชื่อ เบอร์ และหมายเหตุ พร้อมเลือกวันที่และเวลาจัดส่งหรือรับสินค้าเองที่ร้าน</p>

                        <div className="qrm-slug-bar" onClick={(e) => e.stopPropagation()}>
                          <span className="qrm-slug-tag">🔗 chatpos.link/<strong>{qrSlugs['channel-delivery'] || 'delivery'}</strong></span>
                          {editingSlugId === 'channel-delivery' ? (
                            <div className="qrm-slug-edit-row">
                              <span className="qrm-slash">/</span>
                              <input
                                type="text"
                                className="qrm-slug-input"
                                value={slugInputVal}
                                onChange={(e) => setSlugInputVal(e.target.value)}
                                placeholder="ระบุ /xx เช่น delivery"
                                autoFocus
                              />
                              <button type="button" className="qrm-slug-save-btn" onClick={(e) => handleSaveSlug('channel-delivery', e)}>บันทึก</button>
                              <button type="button" className="qrm-slug-cancel-btn" onClick={() => setEditingSlugId(null)}>ยกเลิก</button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="qrm-slug-edit-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingSlugId('channel-delivery')
                                setSlugInputVal(qrSlugs['channel-delivery'] || 'delivery')
                              }}
                            >
                              ✏️ ตั้งค่า /xx
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="qrm-card-arrow">
                        <ChevronRight size={18} />
                      </div>
                    </div>

                    {/* 4. จองโต๊ะ & สั่งล่วงหน้า */}
                    <div
                      className="qrm-menu-card"
                      onClick={() => { playTapSound('pop'); setSelectedChannel(channelGroups[3]) }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="qrm-card-icon-box purple">
                        <Calendar size={22} color="#7c3aed" />
                      </div>
                      <div className="qrm-card-body">
                        <div className="qrm-card-title-row">
                          <h3>จองโต๊ะ & สั่งล่วงหน้า</h3>
                        </div>
                        <span className="qrm-pill purple">จองโต๊ะ / สั่งล่วงหน้า · {channelGroups[3]?.subItems?.length || 3} รายการ</span>
                        <p>จองโต๊ะหรือสั่งล่วงหน้า กรอกข้อมูลและเลือกวันเวลา โดยจะเลือกเมนูตอนนี้หรือเลือกทีหลังก็ได้</p>

                        <div className="qrm-slug-bar" onClick={(e) => e.stopPropagation()}>
                          <span className="qrm-slug-tag">🔗 chatpos.link/<strong>{qrSlugs['channel-booking'] || 'booking'}</strong></span>
                          {editingSlugId === 'channel-booking' ? (
                            <div className="qrm-slug-edit-row">
                              <span className="qrm-slash">/</span>
                              <input
                                type="text"
                                className="qrm-slug-input"
                                value={slugInputVal}
                                onChange={(e) => setSlugInputVal(e.target.value)}
                                placeholder="ระบุ /xx เช่น booking"
                                autoFocus
                              />
                              <button type="button" className="qrm-slug-save-btn" onClick={(e) => handleSaveSlug('channel-booking', e)}>บันทึก</button>
                              <button type="button" className="qrm-slug-cancel-btn" onClick={() => setEditingSlugId(null)}>ยกเลิก</button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="qrm-slug-edit-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingSlugId('channel-booking')
                                setSlugInputVal(qrSlugs['channel-booking'] || 'booking')
                              }}
                            >
                              ✏️ ตั้งค่า /xx
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="qrm-card-arrow">
                        <ChevronRight size={18} />
                      </div>
                    </div>

                    {/* 5. คิวอาร์ลิงก์กำหนดเอง */}
                    <div
                      className="qrm-menu-card"
                      onClick={() => { playTapSound('pop'); setSelectedChannel(channelGroups[4]) }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="qrm-card-icon-box slate">
                        <Sparkles size={22} color="#475569" />
                      </div>
                      <div className="qrm-card-body">
                        <div className="qrm-card-title-row">
                          <h3>คิวอาร์ลิงก์กำหนดเอง</h3>
                        </div>
                        <span className="qrm-pill slate">ตั้งค่าอิสระ · {channelGroups[4]?.subItems?.length || 3} รายการ</span>
                        <p>สร้างคิวอาร์สั่งสินค้า สำหรับทำแคมเปญการตลาด โปรโมชันเฉพาะกลุ่ม หรือเมนูพิเศษๆ</p>

                        <div className="qrm-slug-bar" onClick={(e) => e.stopPropagation()}>
                          <span className="qrm-slug-tag">🔗 chatpos.link/<strong>{qrSlugs['channel-custom'] || 'custom'}</strong></span>
                          {editingSlugId === 'channel-custom' ? (
                            <div className="qrm-slug-edit-row">
                              <span className="qrm-slash">/</span>
                              <input
                                type="text"
                                className="qrm-slug-input"
                                value={slugInputVal}
                                onChange={(e) => setSlugInputVal(e.target.value)}
                                placeholder="ระบุ /xx เช่น promo"
                                autoFocus
                              />
                              <button type="button" className="qrm-slug-save-btn" onClick={(e) => handleSaveSlug('channel-custom', e)}>บันทึก</button>
                              <button type="button" className="qrm-slug-cancel-btn" onClick={() => setEditingSlugId(null)}>ยกเลิก</button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="qrm-slug-edit-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingSlugId('channel-custom')
                                setSlugInputVal(qrSlugs['channel-custom'] || 'custom')
                              }}
                            >
                              ✏️ ตั้งค่า /xx
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="qrm-card-arrow">
                        <ChevronRight size={18} />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add New Sub-QR Modal Form */}
      {isAddSubModalOpen && selectedChannel && (
        <div className="qs-modal-overlay" style={{ zIndex: 100010 }}>
          <div className="qs-modal" style={{ maxWidth: 440 }}>
            <div className="qs-modal-header">
              <div>
                <h3>➕ เพิ่ม คิวอาร์โค้ดใหม่</h3>
                <p>หมวดหมู่: {selectedChannel.title}</p>
              </div>
              <button
                aria-label="ปิด"
                className="qs-modal-close"
                onClick={() => { playTapSound('click'); setIsAddSubModalOpen(false) }}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="qs-modal-body">
              <div className="qs-form-group">
                <label>ชื่อรายการคิวอาร์โค้ด</label>
                <input
                  type="text"
                  placeholder="เช่น คิวอาร์ประจำ โต๊ะที่ 4, แคมเปญ TikTok"
                  value={newSubTitle}
                  onChange={(e) => setNewSubTitle(e.target.value)}
                />
              </div>

              <div className="qs-form-group">
                <label>คำอธิบายย่อ</label>
                <input
                  type="text"
                  placeholder="เช่น โซนระเบียง VIP, ส่วนลด 50 บาท"
                  value={newSubDesc}
                  onChange={(e) => setNewSubDesc(e.target.value)}
                />
              </div>

              <div className="qs-form-group">
                <label>URL Slug (/xx)</label>
                <input
                  type="text"
                  placeholder="เช่น t04 หรือ tiktok-promo"
                  value={newSubSlug}
                  onChange={(e) => setNewSubSlug(e.target.value)}
                />
              </div>
            </div>

            <div className="qs-modal-footer">
              <button
                className="qs-btn-cancel"
                onClick={() => setIsAddSubModalOpen(false)}
                type="button"
              >
                ยกเลิก
              </button>
              <button
                className="qs-btn-submit"
                onClick={handleAddSubQr}
                type="button"
              >
                บันทึกคิวอาร์ใหม่
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch QR Print Sticker Sheet Modal */}
      {isBatchPrintModalOpen && selectedChannel && (
        <div className="qs-modal-overlay" style={{ zIndex: 100020 }}>
          <div className="qs-modal qs-modal-large" style={{ maxWidth: 820 }}>
            <div className="qs-modal-header no-print">
              <div>
                <h3>🖨️ พิมพ์สติ๊กเกอร์ QR Code ทุกโต๊ะ / ช่องทาง</h3>
                <p>หมวดหมู่: {selectedChannel.title} ({selectedChannel.subItems.length} รายการ)</p>
              </div>
              <button
                aria-label="ปิด"
                className="qs-modal-close"
                onClick={() => { playTapSound('click'); setIsBatchPrintModalOpen(false) }}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="qs-modal-body qrm-print-sheet-body">
              <div className="qrm-print-banner no-print">
                💡 คำแนะนำ: กดปุ่ม "สั่งพิมพ์สติ๊กเกอร์" ด้านล่าง ระบบจะเปิดหน้าสั่งพิมพ์สติ๊กเกอร์ขนาดมาตรฐานสำหรับนำไปแปะบนโต๊ะอาหารหรือแผ่นป้ายประจำร้าน
              </div>

              <div className="qrm-sticker-grid">
                {selectedChannel.subItems.map((sub: SubQrItem) => (
                  <div key={sub.id} className="qrm-sticker-card">
                    <div className="qrm-sticker-header">
                      <img src="/logo.png" alt="ChatPOS Logo" className="qrm-sticker-logo" />
                      <div>
                        <h4>POP CAFE ✨</h4>
                        <p>สแกนสั่งอาหาร / ชำระเงิน</p>
                      </div>
                    </div>
                    <div className="qrm-sticker-title">{sub.title}</div>
                    <div className="qrm-sticker-qr-box">
                      <img src={sub.qrImgUrl || '/payments/promptpay_front.png'} alt={sub.title} />
                    </div>
                    <div className="qrm-sticker-slug">
                      🔗 chatpos.link/<strong>{qrSlugs[sub.id] || sub.slug}</strong>
                    </div>
                    <div className="qrm-sticker-footer">
                      Merchant ID: S072609429
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="qs-modal-footer no-print">
              <button
                className="qs-btn-cancel"
                onClick={() => setIsBatchPrintModalOpen(false)}
                type="button"
              >
                ยกเลิก
              </button>
              <button
                className="qs-btn-submit"
                onClick={() => { playTapSound('success'); window.print() }}
                type="button"
              >
                <Printer size={15} /> สั่งพิมพ์สติ๊กเกอร์ (Print)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected QR Code Detail Overlay */}
      {selectedQr && (
        <div className="qs-modal-overlay" style={{ zIndex: 100005 }}>
          <div className="qs-modal" style={{ maxWidth: 420 }}>
            <div className="qs-modal-header">
              <div>
                <h3>{selectedQr.title}</h3>
                <p>{selectedQr.subtitle}</p>
              </div>
              <button
                aria-label="ปิด"
                className="qs-modal-close"
                onClick={() => { playTapSound('click'); setSelectedQr(null); setGeneratedAmount(null) }}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="qs-modal-body" style={{ textAlign: 'center', padding: '16px 20px 20px' }}>
              <div className="qrm-detail-qr-box" style={{ width: '210px', height: '210px', margin: '0 auto 12px', padding: '10px', background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)' }}>
                {realQrDataUrl ? (
                  <img
                    src={realQrDataUrl}
                    alt={selectedQr.title}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  />
                ) : (
                  <img src={selectedQr.qrImgUrl} alt={selectedQr.title} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                )}
              </div>

              {generatedAmount && (
                <div className="qrm-custom-amount-badge" style={{ margin: '0 0 10px', padding: '6px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', color: '#059669', fontSize: '13px', fontWeight: 700 }}>
                  ยอดชำระ: <strong>฿{generatedAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</strong>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Merchant ID: <strong>S072609429</strong> · 🔗 <strong>chatpos.link/{qrSlugs[selectedQr.id] || selectedQr.slug || 'shop'}</strong>
                </div>

                <a
                  href={'/' + (qrSlugs[selectedQr.id] || selectedQr.slug || 'shop')}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    width: '100%',
                    maxWidth: '300px',
                    padding: '11px 16px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '14px',
                    textDecoration: 'none',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  🚀 เปิดหน้าร้านค้าออนไลน์ ➔
                </a>

                {selectedQr.id === 'channel-shop' && (
                  <button
                    type="button"
                    onClick={() => { setSelectedQr(null); setSelectedChannel(channelGroups[0]) }}
                    style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: '2px 6px', textDecoration: 'underline' }}
                  >
                    ⚙️ จัดการช่องทางย่อย (PromptPay / TrueMoney)
                  </button>
                )}
              </div>

              {/* Custom Amount Form (Concise) */}
              {selectedQr.canCustomAmount && (
                <div className="qrm-custom-input-group" style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '14px', border: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <label htmlFor="qrm-amount-in" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    ระบุยอดเงิน (บาท)
                  </label>
                  <div className="qrm-input-btn-row">
                    <input
                      id="qrm-amount-in"
                      type="number"
                      placeholder="เช่น 150"
                      value={customAmountInput}
                      onChange={(e) => setCustomAmountInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="qrm-btn-gen"
                      onClick={() => handleGenerateCustomQr(selectedQr)}
                    >
                      สร้าง QR
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="qs-modal-footer">
              <button
                className="qs-btn-cancel"
                onClick={() => handleCopyQrLink(selectedQr.linkUrl || 'https://chatpos.link/qr', selectedQr.id)}
                type="button"
              >
                <Copy size={14} /> {copiedQrId === selectedQr.id ? 'คัดลอกแล้ว!' : 'คัดลอกลิงก์'}
              </button>
              <button
                className="qs-btn-submit"
                onClick={() => { playTapSound('success'); alert('เริ่มดาวน์โหลดรูปภาพ QR Code สำเร็จ') }}
                type="button"
              >
                ดาวน์โหลด QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ==========================================================================
   1. POS VIEW (ขายหน้าร้าน)
   ========================================================================== */
export type PosItem = {
  id: string
  name: string
  category: 'drink' | 'bakery' | 'service'
  price: number
  stock: number
  tag?: string
  image?: string
  icon?: string
}

export type HeldOrder = {
  id: string
  tableName: string
  items: { product: PosItem; qty: number }[]
  total: number
  time: string
}

const posProducts: PosItem[] = [
  {
    id: 'p-1',
    name: 'Espresso ร้อน (Hot Espresso)',
    category: 'drink',
    price: 55,
    stock: 99,
    tag: 'HOT',
    icon: '☕',
    image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=300&auto=format&fit=crop&q=80'
  },
  {
    id: 'p-2',
    name: 'Iced Americano (กาแฟดำเย็น)',
    category: 'drink',
    price: 65,
    stock: 80,
    tag: 'BEST',
    icon: '🧊☕',
    image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=300&auto=format&fit=crop&q=80'
  },
  {
    id: 'p-3',
    name: 'Iced Matcha Latte (มัทฉะลาเต้)',
    category: 'drink',
    price: 75,
    stock: 45,
    tag: 'POPULAR',
    icon: '🍵',
    image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=300&auto=format&fit=crop&q=80'
  },
  {
    id: 'p-4',
    name: 'Croissant เนยสดแท้ (Butter Croissant)',
    category: 'bakery',
    price: 65,
    stock: 18,
    tag: 'FRESH',
    icon: '🥐',
    image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=300&auto=format&fit=crop&q=80'
  },
  {
    id: 'p-5',
    name: 'Cheesecake หน้าไหม้ (Basque Cheesecake)',
    category: 'bakery',
    price: 120,
    stock: 12,
    tag: 'DELICIOUS',
    icon: '🍰',
    image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=300&auto=format&fit=crop&q=80'
  },
  {
    id: 'p-6',
    name: 'บริการจองโต๊ะจัดเลี้ยง VIP',
    category: 'service',
    price: 500,
    stock: 999,
    tag: 'SERVICE',
    icon: '👑',
    image: '/mascot/nabtang_welcome.png'
  }
]

function PosView({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [category, setCategory] = useState('all' as 'all' | 'drink' | 'bakery' | 'service')
  const [search, setSearch] = useState('')
  


  // Table Status & Interactive Floor Map State
  const [tables, setTables] = useState([
    { id: 't01', name: 'โต๊ะ 01', zone: 'โซนในร้าน A', status: 'occupied', total: 850, itemsCount: 3, time: '12:15 น.' },
    { id: 't02', name: 'โต๊ะ 02', zone: 'โซนในร้าน A', status: 'vacant', total: 0, itemsCount: 0, time: '-' },
    { id: 't03', name: 'โต๊ะ 03', zone: 'โซนริมสวน B', status: 'occupied', total: 420, itemsCount: 2, time: '12:35 น.' },
    { id: 'tvip01', name: 'โต๊ะ VIP 01', zone: 'ห้อง VIP', status: 'vacant', total: 0, itemsCount: 0, time: '-' }
  ])
  const [activeTableId, setActiveTableId] = useState('t01')
  const [tableFilter, setTableFilter] = useState<'all' | 'occupied' | 'vacant'>('all')
  const [showFullMapModal, setShowFullMapModal] = useState(false)
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false)
  const [newTableName, setNewTableName] = useState('')
  const [newTableZone, setNewTableZone] = useState('โซนในร้าน A')

  const handleAddNewTable = () => {
    if (!newTableName.trim()) return
    playTapSound('success')
    const newT = {
      id: 't-' + Date.now(),
      name: newTableName.trim(),
      zone: newTableZone,
      status: 'vacant',
      total: 0,
      itemsCount: 0,
      time: '-'
    }
    setTables([...tables, newT])
    setActiveTableId(newT.id)
    setNewTableName('')
    setIsAddTableModalOpen(false)
  }
  
  const [cart, setCart] = useState([
    { product: posProducts[0], qty: 2 },
    { product: posProducts[3], qty: 1 }
  ])
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [lastPaidMethod, setLastPaidMethod] = useState('')

  // POS Toast Notification State
  const [posToast, setPosToast] = useState<{
    visible: boolean
    message: string
    count: number
    total: number
    lastProduct?: string
  } | null>(null)

  // Mobile Cart Drawer Modal State
  const [showMobileCartModal, setShowMobileCartModal] = useState(false)

  // Sync posToast with cart: stays visible (sticky) while items are selected
  useEffect(() => {
    if (cart.length === 0) {
      setPosToast(null)
      setShowMobileCartModal(false)
    }
  }, [cart])

  // Hold Order State
  const [heldOrders, setHeldOrders] = useState(() => {
    const saved = localStorage.getItem('pos_held_orders')
    if (saved) {
      try { return JSON.parse(saved) as HeldOrder[] } catch (e) {}
    }
    return [] as HeldOrder[]
  })
  const [showHeldOrdersModal, setShowHeldOrdersModal] = useState(false)

  // Split Bill State
  const [showSplitModal, setShowSplitModal] = useState(false)
  const [splitCount, setSplitCount] = useState(2)

  // Live Customer Orders Sync
  const [liveCustomerOrders, setLiveCustomerOrders] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('merchant_live_orders') || '[]')
    } catch (e) {
      return []
    }
  })

  // Sync products catalog to localStorage and load from DB
  useEffect(() => {
    localStorage.setItem('pos_products_catalog', JSON.stringify(posProducts))
    fetchDbProducts().then((dbItems) => {
      if (dbItems && dbItems.length > 0) {
        const formatted: PosItem[] = dbItems.map((p) => ({
          id: p.id,
          name: p.name,
          category: (p.category as any) || 'drink',
          price: Number(p.price) || 50,
          stock: p.stock || 99,
          tag: p.trackStock ? 'IN STOCK' : 'READY',
          icon: '📦',
          image: p.image || 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=300&auto=format&fit=crop&q=80',
        }))
        localStorage.setItem('pos_products_catalog', JSON.stringify(formatted))
      }
    }).catch(() => {})
  }, [])

  // Listen to Live Customer Orders
  useEffect(() => {
    const handleSync = () => {
      try {
        const orders = JSON.parse(localStorage.getItem('merchant_live_orders') || '[]')
        setLiveCustomerOrders(orders)
      } catch (e) {}
    }
    window.addEventListener('storage', handleSync)
    const timer = setInterval(handleSync, 2000)
    return () => {
      window.removeEventListener('storage', handleSync)
      clearInterval(timer)
    }
  }, [])

  // Listen to Live Table Service Calls from Customers
  const [liveServiceCalls, setLiveServiceCalls] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('merchant_service_calls') || '[]')
    } catch (e) {
      return []
    }
  })

  useEffect(() => {
    const handleServiceSync = () => {
      try {
        const calls = JSON.parse(localStorage.getItem('merchant_service_calls') || '[]')
        setLiveServiceCalls(calls)
      } catch (e) {}
    }
    window.addEventListener('storage', handleServiceSync)
    const timer = setInterval(handleServiceSync, 2000)
    return () => {
      window.removeEventListener('storage', handleServiceSync)
      clearInterval(timer)
    }
  }, [])

  const handleDismissServiceCall = (callId: string) => {
    playTapSound('success')
    const updated = liveServiceCalls.filter(c => c.id !== callId)
    setLiveServiceCalls(updated)
    localStorage.setItem('merchant_service_calls', JSON.stringify(updated))
    window.dispatchEvent(new Event('storage'))
  }

  const handleUpdateCustomerOrderStatus = (orderId: string, nextStatus: string) => {
    playTapSound('success')
    const updated = liveCustomerOrders.map(o => o.id === orderId ? { ...o, status: nextStatus } : o)
    setLiveCustomerOrders(updated)
    localStorage.setItem('merchant_live_orders', JSON.stringify(updated))
    localStorage.setItem('cust_orders_t01', JSON.stringify(updated.filter(o => o.tableNo === 'โต๊ะ 01')))
    window.dispatchEvent(new Event('storage'))
  }

  const handleAddToCart = (product: PosItem) => {
    playTapSound('pop')
    let nextCart = []
    const existing = cart.find((item) => item.product.id === product.id)
    if (existing) {
      nextCart = cart.map((item) => (item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item))
    } else {
      nextCart = [...cart, { product, qty: 1 }]
    }
    setCart(nextCart)

    const count = nextCart.reduce((sum, item) => sum + item.qty, 0)
    const sub = nextCart.reduce((sum, item) => sum + item.product.price * item.qty, 0)
    const tot = sub * 1.07
    const shortName = product.name.split(' (')[0]

    setPosToast({
      visible: true,
      message: `เพิ่ม "${shortName}" แล้ว`,
      count,
      total: tot,
      lastProduct: shortName,
    })
  }

  const handleUpdateQty = (id: string, delta: number) => {
    playTapSound('click')
    const nextCart = cart
      .map((item) => (item.product.id === id ? { ...item, qty: item.qty + delta } : item))
      .filter((item) => item.qty > 0)
    setCart(nextCart)

    if (nextCart.length > 0) {
      const count = nextCart.reduce((sum, item) => sum + item.qty, 0)
      const sub = nextCart.reduce((sum, item) => sum + item.product.price * item.qty, 0)
      const tot = sub * 1.07
      const targetItem = cart.find(i => i.product.id === id)
      const shortName = (targetItem?.product.name || '').split(' (')[0]

      setPosToast({
        visible: true,
        message: delta > 0 ? `เพิ่ม "${shortName}"` : `ลด "${shortName}"`,
        count,
        total: tot,
      })
    } else {
      setPosToast(null)
    }
  }

  const handleClearCart = () => {
    playTapSound('pop')
    setCart([])
    setPosToast(null)
  }

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0)
  const vat = subtotal * 0.07
  const total = subtotal + vat

  const handleHoldOrder = () => {
    if (cart.length === 0) return
    playTapSound('success')
    const activeTableObj = tables.find(t => t.id === activeTableId)
    const newHeld = {
      id: 'hold-' + Date.now(),
      tableName: activeTableObj ? activeTableObj.name : 'หน้าร้าน',
      items: [...cart],
      total: total,
      time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    }
    const updated = [newHeld, ...heldOrders]
    setHeldOrders(updated)
    localStorage.setItem('pos_held_orders', JSON.stringify(updated))
    setCart([])
    alert(`พักออเดอร์ของ ${newHeld.tableName} เรียบร้อยแล้ว!`)
  }

  const handleResumeHeldOrder = (heldId: string) => {
    playTapSound('pop')
    const target = heldOrders.find(h => h.id === heldId)
    if (target) {
      setCart(target.items)
      const updated = heldOrders.filter(h => h.id !== heldId)
      setHeldOrders(updated)
      localStorage.setItem('pos_held_orders', JSON.stringify(updated))
      setShowHeldOrdersModal(false)
    }
  }

  const handleProceedToQuickPay = (method: string = 'promptpay') => {
    if (cart.length === 0) return
    playTapSound('success')
    setLastPaidMethod(method)
    const activeTableObj = tables.find(t => t.id === activeTableId)
    const orderPayload = {
      id: 'pos-' + Date.now(),
      tableName: activeTableObj ? activeTableObj.name : 'ขายหน้าร้าน',
      items: cart.map(i => ({
        id: i.product.id,
        name: i.product.name,
        qty: i.qty,
        price: i.product.price,
        total: i.product.price * i.qty
      })),
      subtotal,
      vat,
      total,
      method,
      time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    }
    localStorage.setItem('pending_pos_checkout', JSON.stringify(orderPayload))
    window.dispatchEvent(new Event('storage'))
    if (onNavigate) {
      onNavigate('payment')
    } else {
      window.location.hash = 'payment'
    }
  }

  const filtered = posProducts.filter(
    (p) =>
      (category === 'all' || p.category === category) &&
      p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="pos-view-container">
      {/* 2. Metric Status Cards (Style หน้าบริการ) */}
      <section className="ov-status-grid" style={{ marginBottom: '18px' }}>
        <div className="ov-metric-card ov-card-all">
          <div className="ov-card-icon icon-green">
            <ShoppingBag size={20} />
          </div>
          <div className="ov-card-text">
            <span>ยอดขาย POS วันนี้</span>
            <strong>฿18,450.00</strong>
            <small>42 รายการสำเร็จ</small>
          </div>
        </div>

        <div className="ov-metric-card ov-card-yellow">
          <div className="ov-card-icon icon-yellow">
            <Utensils size={20} />
          </div>
          <div className="ov-card-text">
            <span>ผังโต๊ะอาหาร</span>
            <strong>2 / 4 โต๊ะ</strong>
            <small>โต๊ะ 01, โต๊ะ 03</small>
          </div>
        </div>

        <div className="ov-metric-card ov-card-blue">
          <div className="ov-card-icon icon-blue">
            <QrCode size={20} />
          </div>
          <div className="ov-card-text">
            <span>ออเดอร์ QR สั่งเข้ามา</span>
            <strong>{liveCustomerOrders.length} ออเดอร์</strong>
            <small>ซิงก์เรียลไทม์กับจอลูกค้า</small>
          </div>
        </div>

        <div className="ov-metric-card ov-card-mint">
          <div className="ov-card-icon icon-mint">
            <Clock size={20} />
          </div>
          <div className="ov-card-text">
            <span>ออเดอร์พักไว้</span>
            <strong>{heldOrders.length} รายการ</strong>
            <small>รอดึงมาคิดเงินต่อ</small>
          </div>
        </div>
      </section>

      {/* Top Table Selection Map Bar (Clean 2-Row Structured Layout) */}
      <div className="pos-table-map-bar">
        <div className="pos-table-map-top-row">
          <div className="pos-table-map-left">
            <div className="pos-table-map-label">
              <Utensils size={16} /> <strong>ผังโต๊ะอาหาร ({tables.length})</strong>
            </div>

            {/* Quick Filter Pills */}
            <div className="pos-table-filter-pills">
              <button
                type="button"
                className={`pos-tf-pill ${tableFilter === 'all' ? 'active' : ''}`}
                onClick={() => setTableFilter('all')}
              >
                ทั้งหมด ({tables.length})
              </button>
              <button
                type="button"
                className={`pos-tf-pill occupied ${tableFilter === 'occupied' ? 'active' : ''}`}
                onClick={() => setTableFilter('occupied')}
              >
                🔴 ไม่ว่าง ({tables.filter(t => t.status === 'occupied').length})
              </button>
              <button
                type="button"
                className={`pos-tf-pill vacant ${tableFilter === 'vacant' ? 'active' : ''}`}
                onClick={() => setTableFilter('vacant')}
              >
                🟢 โต๊ะว่าง ({tables.filter(t => t.status === 'vacant').length})
              </button>
            </div>
          </div>

          <div className="pos-table-actions-right">
            <button
              type="button"
              className="pos-action-btn-map"
              onClick={() => { playTapSound('pop'); setShowFullMapModal(true) }}
            >
              🗺️ ผังโต๊ะใหญ่
            </button>
            <button
              type="button"
              className="pos-action-btn-add"
              onClick={() => { playTapSound('pop'); setIsAddTableModalOpen(true) }}
            >
              <Plus size={14} /> เพิ่มโต๊ะ
            </button>
          </div>
        </div>

        {/* Table Selector Pills Grid (Full width below header) */}
        <div className="pos-table-pills-wrap">
          <div className="pos-table-pills">
            {tables
              .filter(t => tableFilter === 'all' || t.status === tableFilter)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`pos-table-pill ${activeTableId === t.id ? 'active' : ''} ${t.status}`}
                  onClick={() => { playTapSound('pop'); setActiveTableId(t.id) }}
                >
                  <span className={`pos-table-dot ${t.status}`} />
                  <div className="pos-table-pill-text">
                    <strong>{t.name}</strong>
                    {t.status === 'occupied' ? (
                      <span className="pos-table-badge occupied">฿{t.total}</span>
                    ) : (
                      <span className="pos-table-badge vacant">ว่าง</span>
                    )}
                  </div>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Live Table Service Call Alert Banner */}
      {liveServiceCalls.length > 0 && (
        <div className="pos-live-service-banner" style={{ background: '#fffbeb', border: '1.5px solid #fde68a', padding: '12px 16px', borderRadius: '14px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🔔</span>
            <div>
              <strong style={{ fontSize: '13px', color: '#b45309' }}>
                {liveServiceCalls[0].tableNo || 'โต๊ะ 01'} เรียกพนักงาน ({liveServiceCalls[0].timestamp} น.)
              </strong>
              <p style={{ margin: 0, fontSize: '12px', color: '#92400e', fontWeight: 600 }}>
                คำขอ: {liveServiceCalls[0].reason}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="pos-btn-resume"
            style={{ background: '#f59e0b', color: '#fff', fontWeight: 800, padding: '8px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}
            onClick={() => handleDismissServiceCall(liveServiceCalls[0].id)}
          >
            ✅ รับทราบ / ไปบริการแล้ว
          </button>
        </div>
      )}

      {/* Live Customer Order Alert Banner */}
      {liveCustomerOrders.length > 0 && (
        <div className="pos-live-order-banner" style={{ background: '#f0fdf4', border: '1.5px solid #a7f3d0', padding: '12px 16px', borderRadius: '14px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🔔</span>
            <div>
              <strong style={{ fontSize: '13px', color: '#047857' }}>ออเดอร์ใหม่ทาง QR จาก {liveCustomerOrders[0].tableNo || 'โต๊ะ 01'} ({liveCustomerOrders[0].orderNo})</strong>
              <p style={{ margin: 0, fontSize: '11px', color: '#065f46' }}>
                {liveCustomerOrders[0].items.map((i: any) => `${i.menuItem.name} x${i.qty}`).join(', ')} · ยอด ฿{liveCustomerOrders[0].totalAmount.toFixed(2)} ({liveCustomerOrders[0].paymentMethod})
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {liveCustomerOrders[0].status === 'received' && (
              <button
                type="button"
                className="pos-btn-resume"
                style={{ background: '#059669' }}
                onClick={() => handleUpdateCustomerOrderStatus(liveCustomerOrders[0].id, 'cooking')}
              >
                👨‍🍳 รับออเดอร์ ➔ เริ่มปรุง
              </button>
            )}
            {liveCustomerOrders[0].status === 'cooking' && (
              <button
                type="button"
                className="pos-btn-resume"
                style={{ background: '#3b82f6' }}
                onClick={() => handleUpdateCustomerOrderStatus(liveCustomerOrders[0].id, 'ready')}
              >
                🔔 พร้อมเสิร์ฟ
              </button>
            )}
            {liveCustomerOrders[0].status === 'ready' && (
              <button
                type="button"
                className="pos-btn-resume"
                style={{ background: '#10b981' }}
                onClick={() => handleUpdateCustomerOrderStatus(liveCustomerOrders[0].id, 'completed')}
              >
                ✅ เช็คบิล / ปิดออเดอร์
              </button>
            )}
            {liveCustomerOrders[0].status === 'completed' && (
              <span className="wv-ready-badge" style={{ background: '#dcfce7', color: '#15803d', padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 800 }}>
                ✅ ชำระเงินแล้ว
              </span>
            )}
          </div>
        </div>
      )}

      <div className="pos-main-body">
        {/* Left Column: Catalog & Categories */}
        <div className="pos-catalog-section">
          <div className="pos-toolbar">
            <div className="pos-search-box">
              <Search size={16} />
              <input
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อสินค้า / รหัสบาร์โค้ด..."
                value={search}
              />
            </div>
          </div>

          <div className="pos-category-tabs">
            <button className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')} type="button">
              ทั้งหมด ({posProducts.length})
            </button>
            <button className={category === 'drink' ? 'active' : ''} onClick={() => setCategory('drink')} type="button">
              ☕ เครื่องดื่ม
            </button>
            <button className={category === 'bakery' ? 'active' : ''} onClick={() => setCategory('bakery')} type="button">
              🥐 เบเกอรี่
            </button>
            <button className={category === 'service' ? 'active' : ''} onClick={() => setCategory('service')} type="button">
              ✨ บริการ
            </button>
          </div>

          <div className="pos-products-grid">
            {filtered.map((prod) => (
              <div className="pos-product-card" key={prod.id} onClick={() => handleAddToCart(prod)}>
                {prod.tag && <span className="pos-card-tag">{prod.tag}</span>}
                <div className="pos-card-img-wrap">
                  {prod.image ? (
                    <img
                      src={prod.image}
                      alt={prod.name}
                      className="pos-card-img"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/mascot/pos_1_scanning_barcode.png'
                      }}
                    />
                  ) : (
                    <div className="pos-card-img-placeholder">
                      {prod.icon || '☕'}
                    </div>
                  )}
                  {prod.icon && <span className="pos-card-icon-badge">{prod.icon}</span>}
                </div>
                <h4>{prod.name}</h4>
                <div className="pos-card-footer">
                  <strong className="pos-card-price">฿{prod.price}</strong>
                  <button className="pos-add-btn" type="button">
                    <Plus size={14} /> เพิ่ม
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Interactive Cart */}
        <div className="pos-cart-section">
          <div className="pos-cart-header">
            <div className="pos-cart-title">
              <ShoppingCart size={18} />
              <h3>รายการในตะกร้า ({cart.reduce((s, i) => s + i.qty, 0)})</h3>
            </div>
            {cart.length > 0 && (
              <button className="pos-clear-btn" onClick={handleClearCart} type="button">
                <Trash2 size={14} /> ล้างรายการ
              </button>
            )}
          </div>

          <div className="pos-cart-items">
            {cart.map((item) => (
              <div className="pos-cart-row" key={item.product.id}>
                <div className="pos-cart-item-name">
                  <strong>{item.product.name}</strong>
                  <small>฿{item.product.price} / ชิ้น</small>
                </div>
                <div className="pos-qty-controls">
                  <button onClick={() => handleUpdateQty(item.product.id, -1)} type="button">
                    <Minus size={12} />
                  </button>
                  <span>{item.qty}</span>
                  <button onClick={() => handleUpdateQty(item.product.id, 1)} type="button">
                    <Plus size={12} />
                  </button>
                </div>
                <strong className="pos-cart-item-total">฿{item.product.price * item.qty}</strong>
              </div>
            ))}

            {cart.length === 0 && (
              <div className="pos-empty-cart">
                <ShoppingCart size={32} />
                <p>ยังไม่มีสินค้าในตะกร้า</p>
                <small>เลือกรายการสินค้าจากด้านซ้ายเพื่อคิดเงิน</small>
              </div>
            )}
          </div>

          <div className="pos-cart-summary">
            <div className="pos-summary-row">
              <span>ยอดรวมสินค้า</span>
              <strong>฿{subtotal.toFixed(2)}</strong>
            </div>
            <div className="pos-summary-row">
              <span>ภาษี VAT (7%)</span>
              <strong>฿{vat.toFixed(2)}</strong>
            </div>
            <div className="pos-summary-total">
              <span>ยอดชำระสุทธิ</span>
              <strong>฿{total.toFixed(2)}</strong>
            </div>

            {/* Quick Actions Row: Hold & Split Bill */}
            <div className="pos-cart-secondary-actions">
              <button
                type="button"
                className="pos-secondary-btn hold"
                disabled={cart.length === 0}
                onClick={handleHoldOrder}
              >
                ⏸️ พักออเดอร์
              </button>
              <button
                type="button"
                className="pos-secondary-btn split"
                disabled={cart.length === 0}
                onClick={() => { playTapSound('pop'); setShowSplitModal(true) }}
              >
                ✂️ แยกบิล / หารชำระ
              </button>
            </div>

            <div className="pos-pay-actions">
              <button
                className="pos-pay-btn btn-summary-next"
                disabled={cart.length === 0}
                onClick={() => handleProceedToQuickPay('promptpay')}
                type="button"
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 900,
                  padding: '14px 18px',
                  borderRadius: '14px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 6px 18px rgba(16, 185, 129, 0.3)',
                  border: 'none',
                  cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: cart.length === 0 ? 0.5 : 1
                }}
              >
                <ReceiptText size={18} /> {"⚡ ไปหน้าคิดเงินด่วนเลือกช่องทางชำระเงิน (฿" + total.toFixed(2) + ") ›"}
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', width: '100%' }}>
                <button
                  className="pos-pay-btn btn-promptpay"
                  disabled={cart.length === 0}
                  onClick={() => handleProceedToQuickPay('promptpay')}
                  type="button"
                >
                  <img
                    src="/payments/promptpay_front.png"
                    alt="PromptPay"
                    style={{ height: '20px', width: 'auto', objectFit: 'contain', borderRadius: '3px', filter: 'brightness(0) invert(1)' }}
                  />
                  PromptPay
                </button>
                <button
                  className="pos-pay-btn btn-cash"
                  disabled={cart.length === 0}
                  onClick={() => handleProceedToQuickPay('cash')}
                  type="button"
                >
                  <img
                    src="/mascot/pay_7_holding_banknotes.png"
                    alt="Cash"
                    style={{ height: '22px', width: 'auto', objectFit: 'contain' }}
                  />
                  เงินสด
                </button>
                <button
                  className="pos-pay-btn btn-card"
                  disabled={cart.length === 0}
                  onClick={() => handleProceedToQuickPay('card')}
                  type="button"
                >
                  <img
                    src="/payments/mastercard_visa_combined.png"
                    alt="Credit Card"
                    style={{ height: '18px', width: 'auto', objectFit: 'contain', borderRadius: '3px' }}
                  />
                  บัตรเครดิต
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification Banner for POS selection */}
      {posToast && posToast.visible && (
        <div
          className="pos-toast-floating-banner"
          onClick={() => {
            playTapSound('pop')
            setShowMobileCartModal(true)
          }}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
        >
          <div className="pos-toast-icon">
            <ShoppingCart size={22} />
          </div>
          <div className="pos-toast-body">
            <div className="pos-toast-title">
              <strong>{posToast.count} รายการ</strong>
              <span className="pos-toast-dot">•</span>
              <strong className="pos-toast-total-price">฿{posToast.total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
            <span className="pos-toast-msg">{posToast.message}</span>
          </div>
          <div className="pos-toast-right">
            <span className="pos-toast-view-pill">
              ดูตะกร้า ›
            </span>
            <button
              type="button"
              className="pos-toast-close"
              onClick={(e) => {
                e.stopPropagation()
                setPosToast(prev => prev ? { ...prev, visible: false } : null)
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Cart Drawer Bottom Sheet Modal */}
      {showMobileCartModal && (
        <div className="qs-modal-overlay" style={{ zIndex: 100060, alignItems: 'flex-end', padding: 0 }}>
          <div
            className="qs-modal"
            style={{
              maxWidth: 520,
              width: '100%',
              borderRadius: '24px 24px 0 0',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              animation: 'posModalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div className="qs-modal-header" style={{ padding: '16px 20px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingCart size={20} style={{ color: '#059669' }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>รายการในตะกร้า ({cart.reduce((s, i) => s + i.qty, 0)})</h3>
                  <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>ตรวจสอบและชำระเงินสำหรับออเดอร์นี้</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {cart.length > 0 && (
                  <button
                    className="pos-clear-btn"
                    onClick={() => { handleClearCart(); setShowMobileCartModal(false); }}
                    type="button"
                    style={{ padding: '4px 8px', fontSize: 11 }}
                  >
                    <Trash2 size={13} /> ล้างรายการ
                  </button>
                )}
                <button
                  aria-label="ปิด"
                  className="qs-modal-close"
                  onClick={() => setShowMobileCartModal(false)}
                  type="button"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="qs-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 20px' }}>
              {/* Cart Items List */}
              <div className="pos-cart-items" style={{ maxHeight: 'none' }}>
                {cart.map((item) => (
                  <div className="pos-cart-row" key={item.product.id}>
                    <div className="pos-cart-item-name">
                      <strong>{item.product.name}</strong>
                      <small>฿{item.product.price} / ชิ้น</small>
                    </div>
                    <div className="pos-qty-controls">
                      <button onClick={() => handleUpdateQty(item.product.id, -1)} type="button">
                        <Minus size={12} />
                      </button>
                      <span>{item.qty}</span>
                      <button onClick={() => handleUpdateQty(item.product.id, 1)} type="button">
                        <Plus size={12} />
                      </button>
                    </div>
                    <strong className="pos-cart-item-total">฿{item.product.price * item.qty}</strong>
                  </div>
                ))}

                {cart.length === 0 && (
                  <div className="pos-empty-cart">
                    <ShoppingCart size={32} />
                    <p>ยังไม่มีสินค้าในตะกร้า</p>
                    <small>เลือกรายการสินค้าเพื่อคิดเงิน</small>
                  </div>
                )}
              </div>

              {/* Cart Summary & Pay Actions */}
              {cart.length > 0 && (
                <div className="pos-cart-summary" style={{ marginTop: 16 }}>
                  <div className="pos-summary-row">
                    <span>ยอดรวมสินค้า</span>
                    <strong>฿{subtotal.toFixed(2)}</strong>
                  </div>
                  <div className="pos-summary-row">
                    <span>ภาษี VAT (7%)</span>
                    <strong>฿{vat.toFixed(2)}</strong>
                  </div>
                  <div className="pos-summary-total">
                    <span>ยอดชำระสุทธิ</span>
                    <strong>฿{total.toFixed(2)}</strong>
                  </div>

                  <div className="pos-cart-secondary-actions" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="pos-secondary-btn hold"
                      disabled={cart.length === 0}
                      onClick={() => { handleHoldOrder(); setShowMobileCartModal(false); }}
                    >
                      ⏸️ พักออเดอร์
                    </button>
                    <button
                      type="button"
                      className="pos-secondary-btn split"
                      disabled={cart.length === 0}
                      onClick={() => { playTapSound('pop'); setShowMobileCartModal(false); setShowSplitModal(true); }}
                    >
                      ✂️ แยกบิล / หารชำระ
                    </button>
                  </div>

                  <div className="pos-pay-actions" style={{ marginTop: 12 }}>
                    <button
                      className="pos-pay-btn btn-summary-next"
                      disabled={cart.length === 0}
                      onClick={() => { setShowMobileCartModal(false); handleProceedToQuickPay('promptpay'); }}
                      type="button"
                      style={{
                        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                        color: '#ffffff',
                        fontSize: '15px',
                        fontWeight: 900,
                        padding: '14px 18px',
                        borderRadius: '14px',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 6px 18px rgba(16, 185, 129, 0.3)',
                        border: 'none',
                        cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                        opacity: cart.length === 0 ? 0.5 : 1
                      }}
                    >
                      <ReceiptText size={18} /> {"⚡ ไปหน้าคิดเงินด่วน (฿" + total.toFixed(2) + ") ›"}
                    </button>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', width: '100%' }}>
                      <button
                        className="pos-pay-btn btn-promptpay"
                        disabled={cart.length === 0}
                        onClick={() => { setShowMobileCartModal(false); handleProceedToQuickPay('promptpay'); }}
                        type="button"
                      >
                        <img
                          src="/payments/promptpay_front.png"
                          alt="PromptPay"
                          style={{ height: '20px', width: 'auto', objectFit: 'contain', borderRadius: '3px', filter: 'brightness(0) invert(1)' }}
                        />
                        PromptPay
                      </button>
                      <button
                        className="pos-pay-btn btn-cash"
                        disabled={cart.length === 0}
                        onClick={() => { setShowMobileCartModal(false); handleProceedToQuickPay('cash'); }}
                        type="button"
                      >
                        <img
                          src="/mascot/pay_7_holding_banknotes.png"
                          alt="Cash"
                          style={{ height: '22px', width: 'auto', objectFit: 'contain' }}
                        />
                        เงินสด
                      </button>
                      <button
                        className="pos-pay-btn btn-card"
                        disabled={cart.length === 0}
                        onClick={() => { setShowMobileCartModal(false); handleProceedToQuickPay('card'); }}
                        type="button"
                      >
                        <img
                          src="/payments/mastercard_visa_combined.png"
                          alt="Credit Card"
                          style={{ height: '18px', width: 'auto', objectFit: 'contain', borderRadius: '3px' }}
                        />
                        บัตรเครดิต
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Held Orders Modal */}
      {showHeldOrdersModal && (
        <div className="qs-modal-overlay" style={{ zIndex: 100015 }}>
          <div className="qs-modal" style={{ maxWidth: 480 }}>
            <div className="qs-modal-header">
              <div>
                <h3>📋 ออเดอร์ที่พักไว้ ({heldOrders.length} รายการ)</h3>
                <p>เลือกออเดอร์ที่ต้องการดึงกลับมาคิดเงินต่อ</p>
              </div>
              <button
                aria-label="ปิด"
                className="qs-modal-close"
                onClick={() => setShowHeldOrdersModal(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="qs-modal-body">
              {heldOrders.map((held) => (
                <div key={held.id} className="pos-held-card">
                  <div className="pos-held-header">
                    <strong>{held.tableName}</strong>
                    <span>พักเมื่อ {held.time} น.</span>
                  </div>
                  <div className="pos-held-items-preview">
                    {held.items.map((i, idx) => (
                      <span key={idx}>{i.product.name} x{i.qty}</span>
                    ))}
                  </div>
                  <div className="pos-held-footer">
                    <strong className="pos-held-total">฿{held.total.toFixed(2)}</strong>
                    <button
                      type="button"
                      className="pos-btn-resume"
                      onClick={() => handleResumeHeldOrder(held.id)}
                    >
                      ▶️ ดึงกลับมาคิดเงิน
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="qs-modal-footer">
              <button
                className="qs-btn-cancel"
                onClick={() => setShowHeldOrdersModal(false)}
                type="button"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Interactive Floor Plan Map Modal */}
      {showFullMapModal && (
        <div className="qs-modal-overlay" style={{ zIndex: 100020 }}>
          <div className="qs-modal qs-modal-large" style={{ maxWidth: 720 }}>
            <div className="qs-modal-header">
              <div>
                <h3>🗺️ ผังโต๊ะอาหารจำลอง (Interactive Table Map)</h3>
                <p>คลิกเลือกโต๊ะเพื่อเปิดบิล สั่งอาหารเพิ่ม หรือเช็คบิลได้ทันที</p>
              </div>
              <button
                aria-label="ปิด"
                className="qs-modal-close"
                onClick={() => setShowFullMapModal(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="qs-modal-body">
              <div className="pos-floor-grid">
                {tables.map((t) => (
                  <div
                    key={t.id}
                    className={`pos-floor-card ${t.status} ${activeTableId === t.id ? 'selected' : ''}`}
                    onClick={() => {
                      playTapSound('pop')
                      setActiveTableId(t.id)
                      setShowFullMapModal(false)
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="pos-fc-header">
                      <strong>{t.name}</strong>
                      <span className={`pos-fc-badge ${t.status}`}>
                        {t.status === 'occupied' ? '🔴 มีลูกค้า' : '🟢 ว่าง'}
                      </span>
                    </div>
                    <div className="pos-fc-zone">{t.zone || 'โซนในร้าน'}</div>
                    <div className="pos-fc-body">
                      {t.status === 'occupied' ? (
                        <>
                          <div className="pos-fc-amount">฿{t.total.toFixed(2)}</div>
                          <div className="pos-fc-meta">{t.itemsCount || 3} รายการ · เปิด {t.time || '12:00 น.'}</div>
                        </>
                      ) : (
                        <div className="pos-fc-vacant-text">พร้อมให้บริการ</div>
                      )}
                    </div>
                    <div className="pos-fc-footer">
                      <button type="button" className="pos-fc-btn">
                        {t.status === 'occupied' ? '🛒 เลือกโต๊ะนี้' : '✨ เปิดโต๊ะนี้'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="qs-modal-footer">
              <button
                type="button"
                className="qs-btn-primary"
                onClick={() => {
                  playTapSound('pop')
                  setIsAddTableModalOpen(true)
                  setShowFullMapModal(false)
                }}
              >
                <Plus size={16} /> เพิ่มโต๊ะใหม่
              </button>
              <button
                type="button"
                className="qs-btn-cancel"
                onClick={() => setShowFullMapModal(false)}
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Table Modal */}
      {isAddTableModalOpen && (
        <div className="qs-modal-overlay" style={{ zIndex: 100025 }}>
          <div className="qs-modal" style={{ maxWidth: 420 }}>
            <div className="qs-modal-header">
              <div>
                <h3>➕ เพิ่มโต๊ะอาหารใหม่</h3>
                <p>สร้างโต๊ะอาหารใหม่สำหรับสาขาหน้าร้าน</p>
              </div>
              <button
                aria-label="ปิด"
                className="qs-modal-close"
                onClick={() => setIsAddTableModalOpen(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="qs-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                  ชื่อโต๊ะอาหาร *
                </label>
                <input
                  type="text"
                  placeholder="เช่น โต๊ะ 05, โต๊ะ Outdoor 01, VIP 02..."
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #cbd5e1', outline: 'none', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                  เลือกโซน *
                </label>
                <select
                  value={newTableZone}
                  onChange={(e) => setNewTableZone(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #cbd5e1', outline: 'none', fontSize: 13, background: '#ffffff' }}
                >
                  <option value="โซนในร้าน A">โซนในร้าน A</option>
                  <option value="โซนริมสวน B">โซนริมสวน B</option>
                  <option value="ห้อง VIP">ห้อง VIP</option>
                  <option value="โซน Outdoor">โซน Outdoor</option>
                </select>
              </div>
            </div>

            <div className="qs-modal-footer">
              <button
                type="button"
                className="qs-btn-primary"
                onClick={handleAddNewTable}
              >
                บันทึกสร้างโต๊ะ
              </button>
              <button
                type="button"
                className="qs-btn-cancel"
                onClick={() => setIsAddTableModalOpen(false)}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split Bill Modal */}
      {showSplitModal && (
        <div className="qs-modal-overlay" style={{ zIndex: 100020 }}>
          <div className="qs-modal" style={{ maxWidth: 440 }}>
            <div className="qs-modal-header">
              <div>
                <h3>✂️ แยกบิล / หารชำระเงิน</h3>
                <p>คำนวณยอดชำระเงินต่อคนสำหรับโต๊ะนี้</p>
              </div>
              <button
                aria-label="ปิด"
                className="qs-modal-close"
                onClick={() => setShowSplitModal(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="qs-modal-body">
              <div className="pos-split-calculator">
                <div className="pos-split-total-banner">
                  <span>ยอดสุทธิทั้งสิ้น:</span>
                  <strong>฿{total.toFixed(2)}</strong>
                </div>

                <div className="qs-form-group">
                  <label>จำนวนคนหาร (Persons)</label>
                  <div className="pos-split-stepper">
                    <button type="button" onClick={() => setSplitCount(Math.max(1, splitCount - 1))}>-</button>
                    <span>{splitCount} คน</span>
                    <button type="button" onClick={() => setSplitCount(splitCount + 1)}>+</button>
                  </div>
                </div>

                <div className="pos-split-result-box">
                  <span>ยอดที่ต้องจ่ายต่อคน:</span>
                  <strong className="pos-split-per-person">฿{(total / splitCount).toFixed(2)}</strong>
                </div>
              </div>
            </div>

            <div className="qs-modal-footer">
              <button
                className="qs-btn-cancel"
                onClick={() => setShowSplitModal(false)}
                type="button"
              >
                ยกเลิก
              </button>
              <button
                className="qs-btn-submit"
                onClick={() => {
                  playTapSound('success')
                  alert(`หารจ่ายเท่ากันคนละ ฿${(total / splitCount).toFixed(2)} สำเร็จ!`)
                  setShowSplitModal(false)
                }}
                type="button"
              >
                ยืนยันการแยกบิล
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && (
        <div className="qs-modal-overlay">
          <div className="qs-modal">
            <div className="qs-modal-header">
              <div>
                <h3>ใบเสร็จรับเงิน (Receipt)</h3>
                <p>ชำระสำเร็จผ่าน {lastPaidMethod}</p>
              </div>
              <button className="qs-modal-close" onClick={() => { setShowReceiptModal(false); handleClearCart(); }} type="button">
                <X size={20} />
              </button>
            </div>
            <div className="qs-modal-body text-center">
              <div className="receipt-box">
                <h4>ร้านกาแฟบ้านสวน (ChatPOS)</h4>
                <small>สาขาหลัก M-001 · เลขประจำตัวผู้เสียภาษี 010556209429</small>
                <hr />
                {cart.map((i) => (
                  <div className="receipt-line" key={i.product.id}>
                    <span>{i.product.name} x{i.qty}</span>
                    <strong>฿{i.product.price * i.qty}</strong>
                  </div>
                ))}
                <hr />
                <div className="receipt-line total-line">
                  <strong>ยอดรวมสุทธิ</strong>
                  <strong>฿{total.toFixed(2)}</strong>
                </div>
              </div>
            </div>
            <div className="qs-modal-footer">
              <button className="qs-btn-cancel" onClick={() => { setShowReceiptModal(false); handleClearCart(); }} type="button">
                ปิด
              </button>
              <button className="qs-btn-submit" onClick={() => alert('ส่งสั่งพิมพ์ไปยังเครื่องพิมพ์สลิปแล้ว!')} type="button">
                <Printer size={15} /> พิมพ์ใบเสร็จ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export type QuickPayMethod = 'promptpay' | 'truemoney' | 'visa_th' | 'visa_int' | 'wechat' | 'linepay' | 'alipay' | 'shopeepay'
export type VoiceGender = 'female' | 'male'
export type QrPayMode = 'pay_first' | 'pay_later' | 'table_controlled'

/* ==========================================================================
   2. QUICK PAY VIEW (คิดเงินด่วน / STOPPAY QR)
   ========================================================================== */
function QuickPayView() {
  const [pendingPosOrder, setPendingPosOrder] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('pending_pos_checkout')
      return saved ? JSON.parse(saved) : null
    } catch (e) {
      return null
    }
  })

  const [amountStr, setAmountStr] = useState(() => {
    try {
      const saved = localStorage.getItem('pending_pos_checkout')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && parsed.total) return parsed.total.toString()
      }
    } catch (e) {}
    return '0'
  })

  useEffect(() => {
    const syncPendingOrder = () => {
      try {
        const saved = localStorage.getItem('pending_pos_checkout')
        if (saved) {
          const parsed = JSON.parse(saved)
          setPendingPosOrder(parsed)
          if (parsed && parsed.total) setAmountStr(parsed.total.toString())
        } else {
          setPendingPosOrder(null)
        }
      } catch (e) {}
    }
    syncPendingOrder()
    window.addEventListener('storage', syncPendingOrder)
    return () => window.removeEventListener('storage', syncPendingOrder)
  }, [])

  const handleClearPendingPosOrder = () => {
    localStorage.removeItem('pending_pos_checkout')
    setPendingPosOrder(null)
    setAmountStr('0')
    playTapSound('pop')
  }

  const [selectedMethod, setSelectedMethod] = useState('promptpay' as QuickPayMethod)
  const [isKycModalOpen, setIsKycModalOpen] = useState(false)
  const [isKycVerified, setIsKycVerified] = useState(true)
  const [operator, setOperator] = useState<string | null>(null)
  const [prevAmount, setPrevAmount] = useState<number | null>(null)

  // Bill Summary, Discount & Payment QR Modal States
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false)
  const [summaryStep, setSummaryStep] = useState<'summary' | 'qr' | 'success'>('summary')
  const [discountType, setDiscountType] = useState<'baht' | 'percent'>('baht')
  const [discountValue, setDiscountValue] = useState<number>(0)
  const [discountNote, setDiscountNote] = useState('')
  const [qrCountdown, setQrCountdown] = useState(300)
  const [copiedPayLink, setCopiedPayLink] = useState(false)
  const [paymentSuccessData, setPaymentSuccessData] = useState<any>(null)

  // Real PromptPay Generation & Developer Mode Sync
  const [activePaymentRef, setActivePaymentRef] = useState<string>('')
  const [activeIdempotencyKey, setActiveIdempotencyKey] = useState<string>('')
  const [promptPayQrUrl, setPromptPayQrUrl] = useState<string>('')
  const [checkoutRedirectUrl, setCheckoutRedirectUrl] = useState<string>('')
  const [merchantPromptPayId, setMerchantPromptPayId] = useState<string>(() => {
    const user = getStoredUser()
    return user?.phone || getStoredPromptPayId('0823456789')
  })
  const [isEditingPromptPay, setIsEditingPromptPay] = useState(false)
  const [promptPayInput, setPromptPayInput] = useState('')

  const numAmount = parseFloat(amountStr) || 0
  const baseSubtotal = (pendingPosOrder && pendingPosOrder.total) ? Number(pendingPosOrder.total) : numAmount
  const calculatedDiscount = discountType === 'percent'
    ? (baseSubtotal * (Number(discountValue) || 0)) / 100
    : (Number(discountValue) || 0)
  const finalDiscount = Math.min(baseSubtotal, Math.max(0, calculatedDiscount))
  const netPayable = Math.max(0, baseSubtotal - finalDiscount)

  // 1. Request the payment QR through Backoffice transaction routing
  useEffect(() => {
    let isMounted = true
    if (isSummaryModalOpen && summaryStep === 'qr') {
      if (!activeIdempotencyKey) {
        setActiveIdempotencyKey(`merchant:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`)
        return () => {
          isMounted = false
        }
      }

      createTransactionCommand({
        amount: netPayable,
        channel: quickPayMethodToChannel(selectedMethod),
        customerName: pendingPosOrder?.tableName ? `ลูกค้า ${pendingPosOrder.tableName}` : 'ลูกค้าหน้าร้าน',
        note: `ชำระเงินผ่าน POS / Backoffice Transaction (ยอดเงิน ฿${netPayable.toFixed(2)})`,
        tableName: pendingPosOrder?.tableName || 'คิดเงินหน้าร้าน',
      }, activeIdempotencyKey)
        .then((res) => {
          const transaction = res?.transaction
          if (isMounted && transaction) {
            const checkoutUrl = transaction.checkoutRedirectUrl || ''
            setPromptPayQrUrl(transactionQrImageUrl(transaction))
            setCheckoutRedirectUrl(checkoutUrl)
            setActivePaymentRef(transaction.paymentReference || transaction.clientReference || transaction.reference || '')
          }
        })
        .catch((err) => {
          console.warn('Backoffice transaction routing unavailable:', err)
          if (isMounted) setPromptPayQrUrl('')
        })
    }
    return () => {
      isMounted = false
    }
  }, [isSummaryModalOpen, summaryStep, netPayable, selectedMethod, pendingPosOrder?.tableName, activeIdempotencyKey])

  // 2. Auto-polling the routed transaction status
  useEffect(() => {
    let pollTimer: any
    if (isSummaryModalOpen && summaryStep === 'qr' && activePaymentRef) {
      pollTimer = setInterval(async () => {
        try {
          const res = await checkTransactionStatus(activePaymentRef)
          if (res?.transaction?.status === 'completed') {
            clearInterval(pollTimer)
            handleConfirmPaymentSuccess()
          }
        } catch {
          // ignore polling network errors
        }
      }, 2500)
    }
    return () => {
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [isSummaryModalOpen, summaryStep, activePaymentRef])

  // QR Countdown Timer
  useEffect(() => {
    let timer: any
    if (isSummaryModalOpen && summaryStep === 'qr' && qrCountdown > 0) {
      timer = setInterval(() => {
        setQrCountdown((prev) => (prev > 0 ? prev - 1 : 0))
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [isSummaryModalOpen, summaryStep, qrCountdown])

  const getChannelInfo = (method: QuickPayMethod) => {
    switch (method) {
      case 'promptpay':
        return { name: 'PromptPay พร้อมเพย์ QR', sub: 'สแกนผ่าน Mobile Banking ทุกธนาคาร', img: '/payments/promptpay_front.png', badgeTone: 'blue' }
      case 'truemoney':
        return { name: 'TrueMoney Wallet', sub: 'สแกนชำระผ่านแอป TrueMoney', img: '/payments/truemoney_front.png', badgeTone: 'orange' }
      case 'visa_th':
        return { name: 'บัตรเครดิต/เดบิต (ไทย)', sub: 'VISA / MasterCard ไทย', img: '/payments/mastercard_visa_combined.png', badgeTone: 'blue' }
      case 'visa_int':
        return { name: 'บัตรต่างประเทศ (Inter Cards)', sub: 'VISA / MasterCard / JCB', img: '/payments/mastercard_visa_combined.png', badgeTone: 'indigo' }
      case 'wechat':
        return { name: 'WeChat Pay (微信支付)', sub: 'สแกนด้วยกระเป๋าเงิน WeChat', img: '/payments/wechatpay_front.png', badgeTone: 'green' }
      case 'linepay':
        return { name: 'Rabbit LINE Pay', sub: 'สแกนผ่านแอป LINE', img: '/payments/linepay_front.png', badgeTone: 'green' }
      case 'alipay':
        return { name: 'Alipay (支付宝)', sub: 'สแกนด้วย Alipay และ Alipay+', img: '/payments/alipay_front.png', badgeTone: 'blue' }
      case 'shopeepay':
        return { name: 'ShopeePay', sub: 'สแกนผ่าน ShopeePay Wallet', img: '/payments/shopeepay_front.png', badgeTone: 'orange' }
      default:
        return { name: 'PromptPay พร้อมเพย์ QR', sub: 'สแกนผ่าน Mobile Banking', img: '/payments/promptpay_front.png', badgeTone: 'blue' }
    }
  }

  const handleOpenSummaryModal = () => {
    playTapSound('pop')
    if (baseSubtotal <= 0) {
      alert('กรุณากดระบุยอดเงิน หรือเลือกออเดอร์ก่อนสร้าง QR รับเงิน')
      return
    }
    setSummaryStep('summary')
    setDiscountValue(0)
    setDiscountNote('')
    setQrCountdown(300)
    setIsSummaryModalOpen(true)
  }

  const handleConfirmPaymentSuccess = () => {
    playTapSound('success')
    const successInfo = {
      orderId: activePaymentRef || `ORD-${Date.now().toString().slice(-6)}`,
      amount: netPayable,
      channel: getChannelInfo(selectedMethod).name,
      time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      table: pendingPosOrder?.tableName || 'คิดเงินหน้าร้าน'
    }

    try {
      const existing = JSON.parse(localStorage.getItem('merchant_live_paid_txns') || '[]')
      existing.unshift({
        id: `tx-${Date.now()}`,
        method: `รับชำระผ่าน ${getChannelInfo(selectedMethod).name}`,
        customer: `${pendingPosOrder?.tableName || 'ลูกค้าหน้าร้าน'} · วันนี้ ${successInfo.time} น.`,
        amount: netPayable,
        status: 'paid'
      })
      localStorage.setItem('merchant_live_paid_txns', JSON.stringify(existing.slice(0, 30)))
      window.dispatchEvent(new Event('storage'))
    } catch (e) {
      console.error('Error saving transaction:', e)
    }
    setPaymentSuccessData(successInfo)
    setSummaryStep('success')
    handleClearPendingPosOrder()
  }

  const handleCopyPayLink = () => {
    navigator.clipboard?.writeText(`https://chatpos.app/pay?ref=ORD-${Date.now()}&amount=${netPayable}`)
    setCopiedPayLink(true)
    setTimeout(() => setCopiedPayLink(false), 2000)
  }

  const handleKeyClick = (val: string) => {
    if (val === 'ล้าง') {
      setAmountStr('0')
      setOperator(null)
      setPrevAmount(null)
      return
    }
    if (val === 'ลบ') {
      setAmountStr(amountStr.length > 1 ? amountStr.slice(0, -1) : '0')
      return
    }
    if (val === '+' || val === '-' || val === '*' || val === '/') {
      setPrevAmount(parseFloat(amountStr) || 0)
      setOperator(val)
      setAmountStr('0')
      return
    }
    if (val === '=') {
      if (operator && prevAmount !== null) {
        const current = parseFloat(amountStr) || 0
        let result = current
        if (operator === '+') result = prevAmount + current
        if (operator === '-') result = prevAmount - current
        if (operator === '*') result = prevAmount * current
        if (operator === '/') result = current !== 0 ? prevAmount / current : 0
        if (result > 10000000) result = 10000000
        if (result < 0) result = 0
        setAmountStr(result.toString())
        setOperator(null)
        setPrevAmount(null)
      }
      return
    }

    if (val === '00') {
      if (amountStr !== '0') {
        const next = amountStr + '00'
        if (parseFloat(next) <= 10000000) setAmountStr(next)
      }
      return
    }

    if (val === '.') {
      if (!amountStr.includes('.')) {
        setAmountStr(amountStr + '.')
      }
      return
    }

    const nextStr = amountStr === '0' ? val : amountStr + val
    if (parseFloat(nextStr) <= 10000000) {
      setAmountStr(nextStr)
    }
  }

  const handleAddPreset = (addVal: number) => {
    const current = parseFloat(amountStr) || 0
    const next = current + addVal
    if (next <= 10000000) setAmountStr(next.toString())
  }

  const handleChannelClick = (method: QuickPayMethod) => {
    if (!isKycVerified) {
      setIsKycModalOpen(true)
    } else {
      setSelectedMethod(method)
    }
  }

  return (
    <div className="qp-full-container">
      {/* 0. Pre-filled POS Order Banner (Redesigned & Premium) */}
      {pendingPosOrder && (
        <div className="qp-pos-imported-card">
          <div className="qp-pos-ic-header">
            <div className="qp-pos-ic-badge-title">
              <div className="qp-pos-ic-icon">
                <ReceiptText size={20} />
              </div>
              <div>
                <strong className="qp-pos-ic-tableName">
                  ออเดอร์ส่งตรงจาก POS · {pendingPosOrder.tableName || 'ขายหน้าร้าน'}
                </strong>
                <span className="qp-pos-ic-item-count">
                  {pendingPosOrder.items ? pendingPosOrder.items.length : 0} รายการสินค้า
                </span>
              </div>
            </div>
            <button
              type="button"
              className="qp-pos-ic-cancel-btn"
              onClick={handleClearPendingPosOrder}
            >
              <X size={14} /> ยกเลิกรายการนี้
            </button>
          </div>

          {/* Items Summary Pills */}
          <div className="qp-pos-ic-items-row">
            {pendingPosOrder.items && pendingPosOrder.items.map((i: any, idx: number) => (
              <span key={idx} className="qp-pos-ic-item-pill">
                {i.name.split(' (')[0]} <strong className="qp-pos-ic-item-qty">x{i.qty}</strong>
              </span>
            ))}
          </div>

          {/* Total Price Row */}
          <div className="qp-pos-ic-footer">
            <span className="qp-pos-ic-total-label">ยอดชำระสุทธิ (นำเข้าจาก POS)</span>
            <strong className="qp-pos-ic-total-amount">
              ฿{pendingPosOrder.total ? pendingPosOrder.total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
            </strong>
          </div>
        </div>
      )}

      {/* 2. Amount Display Section */}
      <div className="qp-amount-section" style={{ position: 'relative', overflow: 'hidden' }}>
        <div>
          <span className="qp-amount-label">ยอดที่ต้องชำระ</span>
          <div className="qp-amount-row">
            <strong className={`qp-amount-val ${numAmount >= 100000 ? 'qp-amount-shrink' : ''} ${numAmount >= 1000000 ? 'qp-amount-shrink-more' : ''}`}>
              {numAmount.toLocaleString('th-TH', { minimumFractionDigits: numAmount % 1 !== 0 ? 2 : 0 })}
            </strong>
            <span className="qp-amount-currency">บาท</span>
          </div>
        </div>

        <img
          src="/mascot/nabtang_thinking.png"
          alt="นับตังค์"
          style={{
            position: 'absolute',
            right: '12px',
            top: '4px',
            height: '64px',
            width: 'auto',
            objectFit: 'contain',
            filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.08))',
            pointerEvents: 'none'
          }}
        />

        {/* Quick Presets */}
        <div className="qp-preset-row">
          {[20, 50, 100, 200, 500, 1000].map((preset) => (
            <button key={preset} onClick={() => handleAddPreset(preset)} type="button">
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Payment Channels Container (Locked when not KYC) */}
      <div className={`qp-channel-card ${!isKycVerified ? 'is-locked' : 'is-unlocked'}`}>
        {!isKycVerified && (
          <div className="qp-lock-overlay-badge">
            <Lock size={14} /> <span>ช่องทางชำระเงินถูกล็อก (รอ KYC)</span>
          </div>
        )}

        <div className="qp-channel-header">
          <span>ช่องทางรับชำระเงิน</span>
          <div className="qp-channel-tags">
            <span className="qp-tag-badge">🇹🇭 ไทย</span>
            <span className="qp-tag-badge">🌐 ต่างชาติ</span>
          </div>
        </div>

        <div className="qp-channel-grid">
          {/* 1. PromptPay */}
          <button
            className={`qp-method-btn ${selectedMethod === 'promptpay' ? 'active' : ''}`}
            onClick={() => handleChannelClick('promptpay')}
            type="button"
          >
            {selectedMethod === 'promptpay' && <span className="qp-check-badge">✓</span>}
            <div className="qp-logo-box pp-logo">
              <img src="/payments/promptpay_front.png" alt="PromptPay" style={{ height: '48px', width: 'auto', maxWidth: '85%', objectFit: 'contain' }} />
            </div>
          </button>

          {/* 2. TrueMoney Wallet */}
          <button
            className={`qp-method-btn ${selectedMethod === 'truemoney' ? 'active' : ''}`}
            onClick={() => handleChannelClick('truemoney')}
            type="button"
          >
            {selectedMethod === 'truemoney' && <span className="qp-check-badge">✓</span>}
            <div className="qp-logo-box tm-logo">
              <img src="/payments/truemoney_front.png" alt="TrueMoney" style={{ height: '48px', width: 'auto', maxWidth: '85%', objectFit: 'contain' }} />
            </div>
          </button>

          {/* 3. VISA ไทย */}
          <button
            className={`qp-method-btn ${selectedMethod === 'visa_th' ? 'active' : ''}`}
            onClick={() => handleChannelClick('visa_th')}
            type="button"
          >
            {selectedMethod === 'visa_th' && <span className="qp-check-badge">✓</span>}
            <div className="qp-logo-box visa-logo">
              <img src="/payments/mastercard_visa_combined.png" alt="VISA / MC" style={{ height: '44px', width: 'auto', maxWidth: '85%', objectFit: 'contain' }} />
            </div>
          </button>

          {/* 4. VISA ต่างชาติ */}
          <button
            className={`qp-method-btn ${selectedMethod === 'visa_int' ? 'active' : ''}`}
            onClick={() => handleChannelClick('visa_int')}
            type="button"
          >
            {selectedMethod === 'visa_int' && <span className="qp-check-badge">✓</span>}
            <div className="qp-logo-box visa-logo">
              <img src="/payments/mastercard_visa_combined.png" alt="VISA Inter" style={{ height: '44px', width: 'auto', maxWidth: '85%', objectFit: 'contain' }} />
            </div>
          </button>

          {/* 5. WeChat Pay */}
          <button
            className={`qp-method-btn ${selectedMethod === 'wechat' ? 'active' : ''}`}
            onClick={() => handleChannelClick('wechat')}
            type="button"
          >
            {selectedMethod === 'wechat' && <span className="qp-check-badge">✓</span>}
            <div className="qp-logo-box wechat-logo">
              <img src="/payments/wechatpay_front.png" alt="WeChat Pay" style={{ height: '48px', width: 'auto', maxWidth: '85%', objectFit: 'contain' }} />
            </div>
          </button>

          {/* 6. LINE Pay */}
          <button
            className={`qp-method-btn ${selectedMethod === 'linepay' ? 'active' : ''}`}
            onClick={() => handleChannelClick('linepay')}
            type="button"
          >
            {selectedMethod === 'linepay' && <span className="qp-check-badge">✓</span>}
            <div className="qp-logo-box line-logo">
              <img src="/payments/linepay_front.png" alt="LINE Pay" style={{ height: '48px', width: 'auto', maxWidth: '85%', objectFit: 'contain' }} />
            </div>
          </button>

          {/* 7. Alipay */}
          <button
            className={`qp-method-btn ${selectedMethod === 'alipay' ? 'active' : ''}`}
            onClick={() => handleChannelClick('alipay')}
            type="button"
          >
            {selectedMethod === 'alipay' && <span className="qp-check-badge">✓</span>}
            <div className="qp-logo-box alipay-logo">
              <img src="/payments/alipay_front.png" alt="Alipay" style={{ height: '48px', width: 'auto', maxWidth: '85%', objectFit: 'contain' }} />
            </div>
          </button>

          {/* 8. ShopeePay */}
          <button
            className={`qp-method-btn ${selectedMethod === 'shopeepay' ? 'active' : ''}`}
            onClick={() => handleChannelClick('shopeepay')}
            type="button"
          >
            {selectedMethod === 'shopeepay' && <span className="qp-check-badge">✓</span>}
            <div className="qp-logo-box shopee-logo">
              <img src="/payments/shopeepay_front.png" alt="ShopeePay" style={{ height: '48px', width: 'auto', maxWidth: '85%', objectFit: 'contain' }} />
            </div>
          </button>
        </div>
      </div>

      {/* 4. Calculator Numpad (5x4 Grid) */}
      <div className="qp-calc-grid">
        {/* Row 1 */}
        <button onClick={() => handleKeyClick('7')} type="button">7</button>
        <button onClick={() => handleKeyClick('8')} type="button">8</button>
        <button onClick={() => handleKeyClick('9')} type="button">9</button>
        <button className="qp-op-btn" onClick={() => handleKeyClick('/')} type="button">/</button>
        <button className="qp-clear-btn" onClick={() => handleKeyClick('ล้าง')} type="button">
          <Trash2 size={16} /> <span>ล้าง</span>
        </button>

        {/* Row 2 */}
        <button onClick={() => handleKeyClick('4')} type="button">4</button>
        <button onClick={() => handleKeyClick('5')} type="button">5</button>
        <button onClick={() => handleKeyClick('6')} type="button">6</button>
        <button className="qp-op-btn" onClick={() => handleKeyClick('*')} type="button">*</button>
        <button className="qp-backspace-btn" onClick={() => handleKeyClick('ลบ')} type="button">
          <Delete size={16} /> <span>ลบ</span>
        </button>

        {/* Row 3 */}
        <button onClick={() => handleKeyClick('1')} type="button">1</button>
        <button onClick={() => handleKeyClick('2')} type="button">2</button>
        <button onClick={() => handleKeyClick('3')} type="button">3</button>
        <button className="qp-op-btn" onClick={() => handleKeyClick('-')} type="button">-</button>
        <button className="qp-op-btn" onClick={() => handleKeyClick('=')} type="button">=</button>

        {/* Row 4 */}
        <button onClick={() => handleKeyClick('0')} type="button">0</button>
        <button onClick={() => handleKeyClick('00')} type="button">00</button>
        <button onClick={() => handleKeyClick('.')} type="button">.</button>
        <button className="qp-op-btn" onClick={() => handleKeyClick('+')} type="button">+</button>
        
        {!isKycVerified ? (
          <button className="qp-lock-btn" onClick={() => setIsKycModalOpen(true)} type="button">
            <Lock size={16} />
            <span>ล็อกคิดเงิน (KYC)</span>
          </button>
        ) : (
          <button className="qp-pay-active-btn" onClick={handleOpenSummaryModal} type="button">
            <QrCode size={18} />
            <span>สร้าง QR รับเงิน</span>
          </button>
        )}
      </div>

      {/* 5. Comprehensive Bill Summary, Discount & Payment QR Modal */}
      {isSummaryModalOpen && (
        <div className="qp-summary-modal-overlay" onClick={() => setIsSummaryModalOpen(false)}>
          <div className="qp-summary-modal-card" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="qp-summary-header">
              <div className="qp-summary-header-title">
                {summaryStep === 'summary' && (
                  <>
                    <div className="qp-header-icon-wrap">
                      <ReceiptText size={20} />
                    </div>
                    <div>
                      <h3>สรุปรายการ & ใส่ส่วนลด</h3>
                      <p>ออเดอร์: {pendingPosOrder?.tableName || 'คิดเงินหน้าร้าน'} · ช่องทาง: {getChannelInfo(selectedMethod).name}</p>
                    </div>
                  </>
                )}
                {summaryStep === 'qr' && (
                  <>
                    <div className="qp-header-icon-wrap qr-active">
                      <QrCode size={20} />
                    </div>
                    <div>
                      <h3>{selectedMethod === 'promptpay' ? 'สแกน QR เพื่อชำระเงิน' : 'กำลังเปิดหน้าชำระเงิน'}</h3>
                      <p>{getChannelInfo(selectedMethod).name} · {pendingPosOrder?.tableName || 'คิดเงินหน้าร้าน'}</p>
                    </div>
                  </>
                )}
                {summaryStep === 'success' && (
                  <>
                    <div className="qp-header-icon-wrap success">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h3>รับชำระเงินสำเร็จ</h3>
                      <p>บันทึกยอดขายเข้าระบบเรียบร้อยแล้ว</p>
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                className="qp-summary-close-btn"
                onClick={() => { playTapSound('click'); setIsSummaryModalOpen(false) }}
              >
                <X size={18} />
              </button>
            </div>

            {/* STEP 1: BILL SUMMARY & DISCOUNT EDITOR */}
            {summaryStep === 'summary' && (
              <div className="qp-summary-body">
                {/* 1.1 Itemized Breakdown Card */}
                <div className="qp-bill-items-card">
                  <div className="qp-card-section-label">
                    <Utensils size={14} /> รายการสั่งซื้อ / ยอดคิดเงิน
                  </div>
                  
                  {pendingPosOrder?.items && pendingPosOrder.items.length > 0 ? (
                    <div className="qp-items-scroll-list">
                      {pendingPosOrder.items.map((item: any, idx: number) => (
                        <div key={idx} className="qp-item-row">
                          <div className="qp-item-info">
                            <strong>{item.name}</strong>
                            <span className="qp-item-unit-price">฿{(item.price || 0).toLocaleString()} x {item.qty}</span>
                          </div>
                          <span className="qp-item-total-price">
                            ฿{((item.price || 0) * (item.qty || 1)).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="qp-manual-amount-item">
                      <div>
                        <strong>ยอดคิดเงินด่วน (QuickPay Numpad)</strong>
                        <span>ป้อนตัวเลขยอดเงินโดยตรงจากแป้นพิมพ์</span>
                      </div>
                      <strong className="qp-item-total-price">
                        ฿{numAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>
                    </div>
                  )}

                  <div className="qp-subtotal-line">
                    <span>ยอดรวมสินค้า (Subtotal)</span>
                    <strong>฿{baseSubtotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                </div>

                {/* 1.2 Discount Editor Section */}
                <div className="qp-discount-card">
                  <div className="qp-discount-head">
                    <div className="qp-card-section-label">
                      <BadgePercent size={15} color="#ea580c" /> ใส่ส่วนลดร้านค้า (Discount)
                    </div>
                    {/* Discount Type Toggle */}
                    <div className="qp-discount-type-toggle">
                      <button
                        type="button"
                        className={`qp-dtype-btn ${discountType === 'baht' ? 'active' : ''}`}
                        onClick={() => { playTapSound('pop'); setDiscountType('baht'); setDiscountValue(0) }}
                      >
                        ฿ บาท
                      </button>
                      <button
                        type="button"
                        className={`qp-dtype-btn ${discountType === 'percent' ? 'active' : ''}`}
                        onClick={() => { playTapSound('pop'); setDiscountType('percent'); setDiscountValue(0) }}
                      >
                        % เปอร์เซ็นต์
                      </button>
                    </div>
                  </div>

                  {/* Preset Discount Chips */}
                  <div className="qp-discount-preset-chips">
                    {discountType === 'baht' ? (
                      <>
                        <button type="button" className={`qp-chip ${discountValue === 0 ? 'active' : ''}`} onClick={() => setDiscountValue(0)}>0 (ไม่ลด)</button>
                        <button type="button" className={`qp-chip ${discountValue === 10 ? 'active' : ''}`} onClick={() => setDiscountValue(10)}>฿10</button>
                        <button type="button" className={`qp-chip ${discountValue === 20 ? 'active' : ''}`} onClick={() => setDiscountValue(20)}>฿20</button>
                        <button type="button" className={`qp-chip ${discountValue === 50 ? 'active' : ''}`} onClick={() => setDiscountValue(50)}>฿50</button>
                        <button type="button" className={`qp-chip ${discountValue === 100 ? 'active' : ''}`} onClick={() => setDiscountValue(100)}>฿100</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className={`qp-chip ${discountValue === 0 ? 'active' : ''}`} onClick={() => setDiscountValue(0)}>0% (ไม่ลด)</button>
                        <button type="button" className={`qp-chip ${discountValue === 5 ? 'active' : ''}`} onClick={() => setDiscountValue(5)}>5%</button>
                        <button type="button" className={`qp-chip ${discountValue === 10 ? 'active' : ''}`} onClick={() => setDiscountValue(10)}>10%</button>
                        <button type="button" className={`qp-chip ${discountValue === 15 ? 'active' : ''}`} onClick={() => setDiscountValue(15)}>15%</button>
                        <button type="button" className={`qp-chip ${discountValue === 20 ? 'active' : ''}`} onClick={() => setDiscountValue(20)}>20%</button>
                      </>
                    )}
                  </div>

                  {/* Custom Discount Input Fields */}
                  <div className="qp-discount-inputs-row">
                    <div className="qp-input-group">
                      <label>จำนวนส่วนลด ({discountType === 'baht' ? 'บาท' : '%'})</label>
                      <input
                        type="number"
                        min="0"
                        max={discountType === 'percent' ? 100 : baseSubtotal}
                        placeholder="0"
                        value={discountValue || ''}
                        onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))}
                        className="qp-disc-input"
                      />
                    </div>
                    <div className="qp-input-group" style={{ flex: 1.5 }}>
                      <label>เหตุผลส่วนลด (ไม่บังคับ)</label>
                      <input
                        type="text"
                        placeholder="เช่น ลูกค้าประจำ, คูปองวันเกิด..."
                        value={discountNote}
                        onChange={(e) => setDiscountNote(e.target.value)}
                        className="qp-disc-input"
                      />
                    </div>
                  </div>
                </div>

                {/* 1.3 Selected Payment Method Info (Inherited from QuickPay) */}
                <div className="qp-selected-channel-card">
                  <div className="qp-card-section-label">
                    <WalletCards size={14} /> ช่องทางรับชำระเงิน (ที่เลือกไว้)
                  </div>
                  <div className="qp-selected-ch-box">
                    <div className="qp-selected-ch-logo-wrap">
                      <img
                        src={getChannelInfo(selectedMethod).img}
                        alt={getChannelInfo(selectedMethod).name}
                        className="qp-selected-ch-img"
                      />
                    </div>
                    <div className="qp-selected-ch-details">
                      <div className="qp-selected-ch-badge">
                        <Check size={11} strokeWidth={3} /> ช่องทางที่เลือกจากหน้าคิดเงิน
                      </div>
                      <strong className="qp-selected-ch-title">{getChannelInfo(selectedMethod).name}</strong>
                      <span className="qp-selected-ch-sub">{getChannelInfo(selectedMethod).sub}</span>
                    </div>
                  </div>
                </div>

                {/* 1.4 Calculation Summary Box */}
                <div className="qp-calc-summary-card">
                  <div className="qp-calc-row">
                    <span>ยอดรวมบิล</span>
                    <span>฿{baseSubtotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {finalDiscount > 0 && (
                    <div className="qp-calc-row discount">
                      <span>ส่วนลด ({discountType === 'percent' ? `${discountValue}%` : '฿' + discountValue}) {discountNote ? `· ${discountNote}` : ''}</span>
                      <span>-฿{finalDiscount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="qp-calc-row net-total">
                    <div>
                      <strong>ยอดชำระสุทธิ (Net Total)</strong>
                      <small>พร้อมคิดเงินผ่าน {getChannelInfo(selectedMethod).name}</small>
                    </div>
                    <strong className="qp-net-price">
                      ฿{netPayable.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>

                {/* Action Footer Button */}
                <div className="qp-summary-actions-foot">
                  <button
                    type="button"
                    className="qp-btn-secondary"
                    onClick={() => { playTapSound('click'); setIsSummaryModalOpen(false) }}
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    className="qp-btn-generate-qr-action"
                    onClick={() => {
                      playTapSound('success')
                      setPromptPayQrUrl('')
                      setCheckoutRedirectUrl('')
                      setActivePaymentRef('')
                      setActiveIdempotencyKey('')
                      setSummaryStep('qr')
                    }}
                  >
                    <QrCode size={18} />
                    <span>รับคิวอาร์โค้ดชำระเงิน (฿{netPayable.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) ›</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: ACTIVE PAYMENT QR CODE SCREEN */}
            {summaryStep === 'qr' && (
              <div className="qp-qr-presentation-wrap">
                <div className="qp-qr-card-container">
                  {/* Channel Tag Header */}
                  <div className="qp-qr-top-badge" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={getChannelInfo(selectedMethod).img} alt="Channel" className="qp-qr-channel-logo" />
                      <div>
                        <strong>{getChannelInfo(selectedMethod).name}</strong>
                        <small>{getChannelInfo(selectedMethod).sub}</small>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, border: '1px solid #a7f3d0' }}>
                        ⚡ Live Dev API
                      </span>
                      {activePaymentRef && (
                        <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                          Ref: {activePaymentRef.length > 16 ? activePaymentRef.slice(0, 16) + '...' : activePaymentRef}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* QR Image Frame */}
                  <div className="qp-qr-display-box">
                    <div className="qp-qr-code-art" style={{ background: '#ffffff', padding: '12px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', display: 'inline-block' }}>
                      {promptPayQrUrl ? (
                        <img
                          src={promptPayQrUrl}
                          alt={selectedMethod === 'promptpay' ? 'PromptPay QR Code' : 'Checkout QR Code'}
                          style={{ width: '220px', height: '220px', display: 'block', margin: '0 auto', imageRendering: 'pixelated' }}
                        />
                      ) : (
                        <div style={{ width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                          <Clock size={20} className="animate-spin" /> กำลังสร้าง QR Code จริง...
                        </div>
                      )}
                    </div>
                    {selectedMethod !== 'promptpay' && checkoutRedirectUrl && (
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
                        <a
                          href={checkoutRedirectUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 18px',
                            borderRadius: '10px',
                            background: '#0284c7',
                            color: '#ffffff',
                            fontWeight: 700,
                            textDecoration: 'none',
                            boxShadow: '0 2px 8px rgba(2,132,199,0.25)',
                          }}
                        >
                          เปิดหน้าชำระเงิน
                        </a>
                      </div>
                    )}
                    
                    {/* PromptPay Target ID & Quick Account Switch */}
                    <div style={{ marginTop: '10px', fontSize: '13px', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {selectedMethod === 'promptpay' && <>
                        <span>พร้อมเพย์รับเงิน: <b style={{ color: '#0f766e', letterSpacing: '0.5px' }}>{merchantPromptPayId}</b></span>
                        <button
                        type="button"
                        onClick={() => {
                          setPromptPayInput(merchantPromptPayId)
                          setIsEditingPromptPay(!isEditingPromptPay)
                        }}
                        style={{ border: 'none', background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', padding: '2px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                      >
                        {isEditingPromptPay ? 'ยกเลิก' : '⚙️ เปลี่ยนบัญชีรับเงิน'}
                      </button>
                    </>}
                    </div>

                    {isEditingPromptPay && (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '6px', justifyContent: 'center', padding: '8px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <input
                          type="text"
                          value={promptPayInput}
                          onChange={(e) => setPromptPayInput(e.target.value)}
                          placeholder="เบอร์โทร / เลข ปชช. / e-Wallet"
                          style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '180px', outline: 'none' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (promptPayInput.trim()) {
                              const clean = promptPayInput.trim()
                              setMerchantPromptPayId(clean)
                              setStoredPromptPayId(clean)
                              setIsEditingPromptPay(false)
                            }
                          }}
                          style={{ padding: '6px 14px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          บันทึก
                        </button>
                      </div>
                    )}

                    {selectedMethod === 'promptpay' && <p className="qp-qr-scan-guide" style={{ marginTop: '10px' }}>
                      📱 ลูกค้าเปิดแอปธนาคารสแกนจ่ายได้ทันที ยอดเงินตรงไม่ต้องกรอกเอง
                    </p>}
                  </div>

                  {/* Amount Highlight */}
                  <div className="qp-qr-payable-banner">
                    <span className="qp-pay-label">{selectedMethod === 'promptpay' ? 'ยอดเงินที่ต้องสแกนชำระ' : 'ยอดเงินที่ต้องชำระ'}</span>
                    <strong className="qp-pay-amount">
                      ฿{netPayable.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                    {finalDiscount > 0 && (
                      <span className="qp-pay-discount-saved">✨ ประหยัดไป ฿{finalDiscount.toLocaleString()}</span>
                    )}
                  </div>

                  {/* Countdown Timer */}
                  <div className="qp-qr-countdown-row">
                    <Clock size={15} className="amber-text" />
                    <span>{selectedMethod === 'promptpay' ? 'QR หมดอายุใน' : 'Session หมดอายุใน'} <b>{Math.floor(qrCountdown / 60)}:{(qrCountdown % 60).toString().padStart(2, '0')} นาที</b></span>
                  </div>

                  {/* Interactive Quick Actions */}
                  <div className="qp-qr-actions-row">
                    {selectedMethod === 'promptpay' && <button type="button" className="qp-action-btn-glass" onClick={() => alert('ส่งคำสั่งพิมพ์ใบแจ้งยอด / QR Slip ไปยังเครื่องพิมพ์เรียบร้อย')}>
                      <Printer size={15} /> พิมพ์สลิป QR
                    </button>}
                    <button type="button" className="qp-action-btn-glass" onClick={handleCopyPayLink}>
                      <Share2 size={15} /> {copiedPayLink ? 'คัดลอกลิงก์แล้ว! ✨' : 'แชร์ลิงก์จ่ายเงิน'}
                    </button>
                  </div>

                  <button
                    type="button"
                    className="qp-btn-back-link"
                    onClick={() => { playTapSound('pop'); setSummaryStep('summary') }}
                  >
                    ‹ ย้อนกลับไปแก้ไขรายการ / ส่วนลด
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: PAYMENT SUCCESS CELEBRATION */}
            {summaryStep === 'success' && paymentSuccessData && (
              <div className="qp-success-wrap">
                <div className="qp-success-icon-animation">
                  <CheckCircle2 size={64} color="#10b981" />
                </div>
                <h2>รับชำระเงินสำเร็จ! ✨</h2>
                <p className="qp-success-sub">บันทึกรายการขายและส่งข้อมูลเข้าบัญชีเรียบร้อย</p>

                <div className="qp-success-receipt-card">
                  <div className="qp-receipt-row">
                    <span>เลขที่บิล</span>
                    <strong>{paymentSuccessData.orderId}</strong>
                  </div>
                  <div className="qp-receipt-row">
                    <span>โต๊ะ / ลูกค้า</span>
                    <strong>{paymentSuccessData.table}</strong>
                  </div>
                  <div className="qp-receipt-row">
                    <span>ช่องทางชำระเงิน</span>
                    <strong>{paymentSuccessData.channel}</strong>
                  </div>
                  <div className="qp-receipt-row">
                    <span>เวลาทำรายการ</span>
                    <strong>{paymentSuccessData.time} น.</strong>
                  </div>
                  <div className="qp-receipt-divider" />
                  <div className="qp-receipt-row total">
                    <strong>ยอดเงินที่ได้รับ</strong>
                    <strong className="green-text">฿{paymentSuccessData.amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                </div>

                <div className="qp-success-actions">
                  <button
                    type="button"
                    className="qp-btn-print-receipt"
                    onClick={() => alert('กำลังพิมพ์ใบเสร็จรับเงินฉบับย่อ... 🖨️')}
                  >
                    <Printer size={16} /> พิมพ์ใบเสร็จ
                  </button>
                  <button
                    type="button"
                    className="qp-btn-finish"
                    onClick={() => { playTapSound('pop'); setIsSummaryModalOpen(false) }}
                  >
                    ✓ เสร็จสิ้น / คิดเงินรายการถัดไป
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* KYC Modal */}
      {isKycModalOpen && (
        <div className="qs-modal-overlay">
          <div className="qs-modal-card">
            <div className="qs-modal-header">
              <h3>ยืนยันตัวตนร้านค้า (KYC)</h3>
              <button className="qs-modal-close" onClick={() => setIsKycModalOpen(false)} type="button">
                <X size={20} />
              </button>
            </div>
            <div className="qp-kyc-modal-body">
              <div className="qp-kyc-modal-icon">
                <ShieldAlert size={48} color="#f59e0b" />
              </div>
              <h4>ต้องทำการยืนยันตัวตนก่อนรับชำระเงิน</h4>
              <p>กรุณาอัปโหลดเอกสารบัตรประชาชนและข้อมูลร้านค้าเพื่อเริ่มรับชำระเงินผ่าน PromptPay และช่องทางต่างๆ</p>
              <button
                className="merchant-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }}
                onClick={() => {
                  setIsKycVerified(true)
                  setIsKycModalOpen(false)
                }}
                type="button"
              >
                ยืนยันตัวตนสำเร็จ (ทดสอบปลดล็อก)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ==========================================================================
   3. REPORTS VIEW (รายงานการเงิน & วิเคราะห์ยอดขาย)
   ========================================================================== */
function ReportsView() {
  return (
    <div className="reports-view">
      <section className="merchant-metrics">
        <div className="merchant-metric">
          <p>ยอดขายวันนี้</p>
          <strong>฿ 18,450.00</strong>
          <span className="merchant-green-text">↑ +14.2% จากเมื่อวาน</span>
          <div className="merchant-metric-icon green">
            <TrendingUp size={20} />
          </div>
        </div>
        <div className="merchant-metric">
          <p>จำนวนออเดอร์</p>
          <strong>42 รายการ</strong>
          <span>เฉลี่ย ฿439.28 / ออเดอร์</span>
          <div className="merchant-metric-icon blue">
            <ShoppingBag size={20} />
          </div>
        </div>
        <div className="merchant-metric">
          <p>ช่องทางยอดขายสูงสุด</p>
          <strong>POS หน้าร้าน</strong>
          <span>คิดเป็น 68% ของยอดขาย</span>
          <div className="merchant-metric-icon violet">
            <BarChart3 size={20} />
          </div>
        </div>
        <div className="merchant-metric">
          <p>กำไรสุทธิประเมิน</p>
          <strong>฿ 11,200.00</strong>
          <span className="merchant-green-text">Margin 60.7%</span>
          <div className="merchant-metric-icon amber">
            <Receipt size={20} />
          </div>
        </div>
      </section>

      <section className="merchant-grid">
        <div className="merchant-panel">
          <div className="merchant-panel-heading">
            <div>
              <h3>สรุปยอดขายสัปดาห์นี้</h3>
              <p>เปรียบเทียบยอดขายรายวัน (บาท)</p>
            </div>
            <button className="merchant-link" type="button">ดาวน์โหลดรายงาน Excel</button>
          </div>
          <div className="sales-chart">
            <div className="chart-y">
              <span>20k</span>
              <span>15k</span>
              <span>10k</span>
              <span>5k</span>
              <span>0</span>
            </div>
            <div className="chart-bars">
              <div className="chart-bar-column">
                <div className="chart-bar" style={{ height: '55%' }} />
                <span>จ.</span>
              </div>
              <div className="chart-bar-column">
                <div className="chart-bar" style={{ height: '70%' }} />
                <span>อ.</span>
              </div>
              <div className="chart-bar-column">
                <div className="chart-bar" style={{ height: '60%' }} />
                <span>พ.</span>
              </div>
              <div className="chart-bar-column">
                <div className="chart-bar" style={{ height: '85%' }} />
                <span>พฤ.</span>
              </div>
              <div className="chart-bar-column">
                <div className="chart-bar" style={{ height: '95%' }} />
                <span>ศ.</span>
              </div>
              <div className="chart-bar-column">
                <div className="chart-bar" style={{ height: '80%' }} />
                <span>ส.</span>
              </div>
              <div className="chart-bar-column">
                <div className="chart-bar" style={{ height: '65%' }} />
                <span>อา.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="merchant-panel">
          <div className="merchant-panel-heading">
            <div>
              <h3>สินค้าขายดี 5 อันดับแรก</h3>
              <p>สถิติยอดขายตามจำนวนชิ้น</p>
            </div>
          </div>
          <div className="product-list">
            <div className="product-row">
              <span className="product-rank">#1</span>
              <div>
                <strong>Iced Americano</strong>
                <span>124 ชิ้น · เครื่องดื่ม</span>
              </div>
              <b>฿ 8,060</b>
            </div>
            <div className="product-row">
              <span className="product-rank">#2</span>
              <div>
                <strong>Croissant เนยสดแท้</strong>
                <span>86 ชิ้น · เบเกอรี่</span>
              </div>
              <b>฿ 5,590</b>
            </div>
            <div className="product-row">
              <span className="product-rank">#3</span>
              <div>
                <strong>Iced Matcha Latte</strong>
                <span>65 ชิ้น · เครื่องดื่ม</span>
              </div>
              <b>฿ 4,875</b>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

/* ==========================================================================
   4. WALLET VIEW (กระเป๋าเงิน & ถอนเงิน)
   ========================================================================== */
function WalletView() {
  const [showBalance, setShowBalance] = useState(true)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [dateRange, setDateRange] = useState('7 วันที่ผ่านมา')

  // Auto Payout State
  const [isAutoPayoutEnabled, setIsAutoPayoutEnabled] = useState(() => {
    return localStorage.getItem('merchant_auto_payout_enabled') !== 'false'
  })
  const [autoPayoutTime, setAutoPayoutTime] = useState(() => {
    return localStorage.getItem('merchant_auto_payout_time') || '23:59'
  })

  return (
    <div className="wallet-page-container">
      {/* 0. Top KYC Warning Banner */}
      <div className="wv-sticky-kyc-bar">
        <div className="wv-kyc-bar-left">
          <ShieldAlert size={20} color="#ffffff" />
          <span>ร้านนี้ยังไม่ได้ยืนยันตัวตน (KYC)</span>
        </div>
        <button className="wv-kyc-action-btn" onClick={() => alert('เริ่มขั้นตอนยืนยันตัวตน (KYC)')} type="button">
          ยืนยันตัวตน <ChevronRight size={14} />
        </button>
      </div>

      {/* 1. Wallet Balance Hero Card */}
      <section className="wv-balance-hero-card">
        <div className="wv-balance-left">
          <div className="wv-balance-title-row">
            <span>ยอดเงินในวอลเล็ต</span>
            <button
              aria-label="ซ่อน/แสดงยอดเงิน"
              className="wv-eye-btn"
              onClick={() => setShowBalance(!showBalance)}
              type="button"
            >
              {showBalance ? <Eye size={17} /> : <EyeOff size={17} />}
            </button>
          </div>
          <h1
            className="wv-balance-amount wv-balance-amount-tappable"
            onClick={() => { if (showBalance) speakBalance('0.00') }}
            role="button"
            tabIndex={0}
            title="กดเพื่อฟังยอดเงิน"
          >
            {showBalance ? '฿0.00' : '฿ ••••••'}
            {showBalance && <span className="wv-speak-hint">🔊</span>}
          </h1>
          <span className="wv-update-time">อัปเดตล่าสุด 20 พ.ค. 2567 09:41 น.</span>
        </div>

        <div className="wv-balance-right-graphic">
          <div className="wv-card-icon-box">
            <CreditCard size={32} color="#ffffff" />
            <div className="wv-check-badge">
              <Check size={12} color="#ffffff" strokeWidth={3} />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Summary Section */}
      <section className="wv-summary-section">
        <div className="wv-summary-header">
          <div>
            <h2>สรุปยอด</h2>
            <p>ภาพรวมเงินเข้า - ออก</p>
          </div>

          <div className="wv-date-dropdown">
            <Calendar size={14} color="#64748b" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="wv-date-select"
            >
              <option value="7 วันที่ผ่านมา">7 วันที่ผ่านมา</option>
              <option value="30 วันที่ผ่านมา">30 วันที่ผ่านมา</option>
              <option value="เดือนนี้">เดือนนี้</option>
            </select>
            <ChevronDown size={14} color="#64748b" />
          </div>
        </div>

        <div className="wv-summary-grid">
          {/* Card 1: เงินเข้า */}
          <div className="wv-summary-card wv-summary-green">
            <div className="wv-summary-icon icon-green">
              <ArrowDown size={16} />
            </div>
            <span>เงินเข้า</span>
            <strong className="green-txt">฿25,420.00</strong>
          </div>

          {/* Card 2: เงินออก */}
          <div className="wv-summary-card wv-summary-red">
            <div className="wv-summary-icon icon-red">
              <ArrowUp size={16} />
            </div>
            <span>เงินออก</span>
            <strong className="red-txt">฿6,670.00</strong>
          </div>

          {/* Card 3: คงเหลือ */}
          <div className="wv-summary-card wv-summary-blue">
            <div className="wv-summary-icon icon-blue">
              <CreditCard size={16} />
            </div>
            <span>คงเหลือ</span>
            <strong className="blue-txt">฿18,750.00</strong>
          </div>
        </div>
      </section>

      {/* 2.5 Auto Daily Payout Schedule Card */}
      <section className="wv-auto-payout-card">
        <div className="wv-auto-payout-left">
          <div className="wv-auto-payout-title">
            <Clock size={18} color="#059669" />
            <strong>⏱️ ตั้งเวลาโอนเงินเข้าบัญชีอัตโนมัติประจำวัน</strong>
          </div>
          <p>ระบบจะทำการสรุปยอดและโอนเงินเข้าบัญชีธนาคารร้านค้าอัตโนมัติทุกวัน</p>
        </div>
        <div className="wv-auto-payout-right">
          <select
            value={autoPayoutTime}
            onChange={(e) => {
              setAutoPayoutTime(e.target.value)
              localStorage.setItem('merchant_auto_payout_time', e.target.value)
              playTapSound('pop')
            }}
            className="wv-payout-time-select"
          >
            <option value="18:00">ทุกวัน เวลา 18:00 น.</option>
            <option value="21:00">ทุกวัน เวลา 21:00 น.</option>
            <option value="23:59">ทุกวัน เวลา 23:59 น. (ปิดกะ)</option>
          </select>
          <button
            type="button"
            className={`wv-payout-toggle-btn ${isAutoPayoutEnabled ? 'active' : ''}`}
            onClick={() => {
              const next = !isAutoPayoutEnabled
              setIsAutoPayoutEnabled(next)
              localStorage.setItem('merchant_auto_payout_enabled', String(next))
              playTapSound('success')
            }}
          >
            {isAutoPayoutEnabled ? '🟢 เปิดใช้งาน' : '⚪ ปิดใช้งาน'}
          </button>
        </div>
      </section>

      {/* 3. Three Transfer Action Cards */}
      <section className="wv-action-cards-list">
        {/* Card 1: โอนเข้าบัญชีหลัก */}
        <div className="wv-action-card" onClick={() => alert('ต้องยืนยันตัวตน (KYC) ก่อนทำรายการ')} role="button" tabIndex={0}>
          <div className="wv-ac-icon-box">
            <Lock size={20} color="#64748b" />
          </div>
          <div className="wv-ac-text">
            <div className="wv-ac-title-row">
              <h3>โอนเข้าบัญชีหลัก</h3>
              <span className="wv-kyc-pill">
                🔒 ต้องยืนยันตัวตน (KYC)
              </span>
            </div>
            <p>ยืนยันตัวตนร้านค้าก่อนทำรายการถอนเงิน</p>
          </div>
          <ChevronRight className="wv-ac-arrow" size={20} />
        </div>

        {/* Card 2: โอนไปยังซัพพลายเออร์ */}
        <div className="wv-action-card" onClick={() => alert('ต้องยืนยันตัวตน (KYC) ก่อนทำรายการ')} role="button" tabIndex={0}>
          <div className="wv-ac-icon-box">
            <Lock size={20} color="#64748b" />
          </div>
          <div className="wv-ac-text">
            <div className="wv-ac-title-row">
              <h3>โอนไปยังซัพพลายเออร์</h3>
              <span className="wv-kyc-pill">
                🔒 ต้องยืนยันตัวตน (KYC)
              </span>
            </div>
            <p>เลือกโอนคนเดียว หรือแบ่งจ่ายหลายคนพร้อมกัน</p>
          </div>
          <ChevronRight className="wv-ac-arrow" size={20} />
        </div>

        {/* Card 3: โอนระหว่างร้าน */}
        <div className="wv-action-card" onClick={() => alert('ต้องยืนยันตัวตน (KYC) ก่อนทำรายการ')} role="button" tabIndex={0}>
          <div className="wv-ac-icon-box">
            <Lock size={20} color="#64748b" />
          </div>
          <div className="wv-ac-text">
            <div className="wv-ac-title-row">
              <h3>โอนระหว่างร้าน</h3>
              <span className="wv-kyc-pill">
                🔒 ต้องยืนยันตัวตน (KYC)
              </span>
            </div>
            <p>โยกย้ายเงินหมุนเวียนหรือต้นทุนระหว่างสาขา</p>
          </div>
          <ChevronRight className="wv-ac-arrow" size={20} />
        </div>
      </section>

      {/* 4. Main Bank Account Card */}
      <section className="wv-bank-account-card">
        <div className="wv-bank-header">
          <h3>บัญชีธนาคารหลัก</h3>
          <button className="wv-bank-edit-link" onClick={() => alert('แก้ไขบัญชีหลัก')} type="button">
            เพิ่ม/แก้ไขบัญชีหลัก <Settings size={14} />
          </button>
        </div>

        <div className="wv-bank-inner-box">
          <div className="wv-bank-logo scb">
            <span>SCB</span>
          </div>

          <div className="wv-bank-details">
            <h4>ธนาคารไทยพาณิชย์</h4>
            <p>ออมทรัพย์ 123-4-56789-0 · ชื่อบัญชี สมชาย ใจดี</p>
          </div>

          <div className="wv-bank-right">
            <span className="wv-ready-badge">พร้อมใช้งาน</span>
            <button className="wv-bank-pencil-btn" onClick={() => alert('แก้ไขบัญชี')} type="button">
              <Pencil size={15} color="#64748b" />
            </button>
          </div>
        </div>
      </section>

      {/* 5. Bank Change Request History Accordion */}
      <section className="wv-accordion-card">
        <div
          className="wv-accordion-header"
          onClick={() => setIsHistoryOpen(!isHistoryOpen)}
          role="button"
          tabIndex={0}
        >
          <div className="wv-accordion-left">
            <span>📜 ประวัติการขอเปลี่ยนบัญชีหลัก</span>
            <span className="wv-count-tag">1 รายการ</span>
          </div>
          <span className="wv-accordion-sub">คลิกเพื่อขยายดูประวัติบันทึกย้อนหลัง</span>
          <ChevronDown className={`wv-accordion-chevron ${isHistoryOpen ? 'open' : ''}`} size={18} />
        </div>

        {isHistoryOpen && (
          <div className="wv-accordion-body">
            <div className="wv-history-log-item">
              <div>
                <strong>คำขอเปลี่ยนเป็น ธนาคารไทยพาณิชย์ (123-4-56789-0)</strong>
                <span>อนุมัติแล้ว · 15 พ.ค. 2567 14:20 น.</span>
              </div>
              <span className="wv-log-status approved">อนุมัติแล้ว</span>
            </div>
          </div>
        )}
      </section>

      {/* 6. Recent Transactions List */}
      <section className="wv-recent-transactions-card">
        <div className="wv-tx-header">
          <h3>ประวัติรายการล่าสุด</h3>
          <button className="wv-see-all-link" onClick={() => alert('ดูประวัติทั้งหมด')} type="button">
            ดูทั้งหมด <ChevronRight size={14} />
          </button>
        </div>

        <div className="wv-tx-list">
          {/* Tx 1 */}
          <div className="wv-tx-item">
            <div className="wv-tx-icon green">
              <ArrowDown size={18} />
            </div>
            <div className="wv-tx-info">
              <strong>รับชำระเงินจาก QR พร้อมเพย์</strong>
              <span>20 พ.ค. 2567 09:41</span>
            </div>
            <div className="wv-tx-amount">
              <strong className="green-txt">+฿650.00</strong>
              <small>คงเหลือ ฿18,750.00</small>
            </div>
            <ChevronRight size={16} color="#cbd5e1" />
          </div>

          {/* Tx 2 */}
          <div className="wv-tx-item">
            <div className="wv-tx-icon green">
              <ArrowDown size={18} />
            </div>
            <div className="wv-tx-info">
              <strong>รับชำระเงินจากบัตรเครดิต</strong>
              <span>20 พ.ค. 2567 08:22</span>
            </div>
            <div className="wv-tx-amount">
              <strong className="green-txt">+฿1250.00</strong>
              <small>คงเหลือ ฿18,100.00</small>
            </div>
            <ChevronRight size={16} color="#cbd5e1" />
          </div>

          {/* Tx 3 */}
          <div className="wv-tx-item">
            <div className="wv-tx-icon blue">
              <CreditCard size={18} />
            </div>
            <div className="wv-tx-info">
              <strong>โอนเข้าบัญชีหลัก (SCB)</strong>
              <span>19 พ.ค. 2567 14:35</span>
            </div>
            <div className="wv-tx-amount">
              <strong className="red-txt">-฿5000.00</strong>
              <small>คงเหลือ ฿16,850.00</small>
            </div>
            <ChevronRight size={16} color="#cbd5e1" />
          </div>

          {/* Tx 4 */}
          <div className="wv-tx-item">
            <div className="wv-tx-icon green">
              <ArrowDown size={18} />
            </div>
            <div className="wv-tx-info">
              <strong>รับชำระเงินจาก e-Wallet</strong>
              <span>19 พ.ค. 2567 11:08</span>
            </div>
            <div className="wv-tx-amount">
              <strong className="green-txt">+฿850.00</strong>
              <small>คงเหลือ ฿21,850.00</small>
            </div>
            <ChevronRight size={16} color="#cbd5e1" />
          </div>
        </div>
      </section>
    </div>
  )
}

/* ==========================================================================
   5. SETTINGS VIEW (ตั้งค่าร้านค้า & ฮาร์ดแวร์)
   ========================================================================== */
function SettingsView({ onOpenProfile, onNavigate }: { onOpenProfile?: () => void; onNavigate?: (id: string) => void }) {
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [speechSpeed, setSpeechSpeed] = useState('1.0x')
  const [voiceGender, setVoiceGender] = useState('female' as VoiceGender)
  const [volumeLevel, setVolumeLevel] = useState(10)
  const [qrPayMode, setQrPayMode] = useState('pay_first' as QrPayMode)

  const speedPresets = ['0.5x', '1.0x', '1.5x', '2.0x', '2.5x', '3.0x']

  const playTestVoice = () => {
    alert(
      `🔊 เล่นเสียงทดสอบ (${voiceGender === 'female' ? 'ผู้หญิง' : 'ผู้ชาย'}, ความเร็ว ${speechSpeed}, ความดังระดับ ${volumeLevel}): "พร้อมเพย์ 100 บาท"`
    )
  }

  return (
    <div className="settings-container">
      {/* Card 1: บัญชีและความปลอดภัย */}
      <div className="st-card">
        <div className="st-card-header-row" onClick={onOpenProfile} role="button" tabIndex={0}>
          <div className="st-card-icon-wrap green">
            <User size={20} />
          </div>
          <div className="st-card-title-area">
            <h3>บัญชีและความปลอดภัย ⚙️</h3>
            <p>จัดการบัญชี ภาพโปรไฟล์ รหัสผ่าน ข้อมูลร้านค้า และการแจ้งเตือน</p>
          </div>
          <ChevronRight size={18} color="#94a3b8" />
        </div>

        <div className="st-quick-actions-grid">
          <button className="st-qa-item" onClick={onOpenProfile} type="button">
            <div className="st-qa-icon"><User size={18} /></div>
            <span>ข้อมูลบัญชี</span>
          </button>
          <button className="st-qa-item" onClick={onOpenProfile} type="button">
            <div className="st-qa-icon"><ShieldCheck size={18} /></div>
            <span>ความปลอดภัย</span>
          </button>
          <button className="st-qa-item" onClick={onOpenProfile} type="button">
            <div className="st-qa-icon"><Key size={18} /></div>
            <span>รหัสผ่าน</span>
          </button>
          <button className="st-qa-item" onClick={onOpenProfile} type="button">
            <div className="st-qa-icon"><Fingerprint size={18} /></div>
            <span>สแกนลายนิ้วมือ</span>
          </button>
        </div>
      </div>

      {/* Card 2: รายการตั้งค่าทั่วไป */}
      <div className="st-card st-menu-list-card">
        {/* 1. ภาษา */}
        <div className="st-menu-row" onClick={() => alert('เลือกภาษา')} role="button" tabIndex={0}>
          <div className="st-menu-icon green"><Globe size={18} /></div>
          <div className="st-menu-label">
            <strong>ภาษา</strong>
          </div>
          <div className="st-menu-value">
            <span>ไทย</span>
            <ChevronRight size={16} color="#94a3b8" />
          </div>
        </div>

        <div className="st-row-divider" />

        {/* 2. การแจ้งเตือน */}
        <div className="st-menu-row" onClick={() => alert('จัดการการแจ้งเตือน')} role="button" tabIndex={0}>
          <div className="st-menu-icon green"><Bell size={18} /></div>
          <div className="st-menu-label">
            <strong>การแจ้งเตือน</strong>
            <small>จัดการการแจ้งเตือนและการเตือนต่างๆ</small>
          </div>
          <div className="st-menu-value">
            <ChevronRight size={16} color="#94a3b8" />
          </div>
        </div>

        <div className="st-row-divider" />

        {/* 3. เสียงแจ้งเตือนเงินเข้า */}
        <div className="st-audio-section">
          <div className="st-menu-row no-hover">
            <div className="st-menu-icon green"><Volume2 size={18} /></div>
            <div className="st-menu-label">
              <strong>เสียงแจ้งเตือนเงินเข้า</strong>
              <small>อ่านช่องทางและยอดเงินเมื่อมีเงินเข้า</small>
            </div>
            <div className="st-menu-value">
              <button
                className={`st-ios-switch ${audioEnabled ? 'active' : ''}`}
                onClick={() => setAudioEnabled(!audioEnabled)}
                type="button"
                aria-label="เปิด/ปิดเสียงเตือน"
              >
                <span className="st-switch-thumb" />
              </button>
            </div>
          </div>

          {audioEnabled && (
            <div className="st-audio-subpanel">
              {/* ความเร็วเสียงพูด */}
              <div className="st-subpanel-group">
                <div className="st-subpanel-label-row">
                  <span>ความเร็วเสียงพูด</span>
                  <span className="st-tag-green">{speechSpeed}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.5"
                  value={parseFloat(speechSpeed)}
                  onChange={(e) => setSpeechSpeed(`${parseFloat(e.target.value).toFixed(1)}x`)}
                  className="st-slider"
                />
                <div className="st-speed-presets">
                  {speedPresets.map((speed) => (
                    <button
                      key={speed}
                      className={`st-speed-btn ${speechSpeed === speed ? 'active' : ''}`}
                      onClick={() => setSpeechSpeed(speed)}
                      type="button"
                    >
                      {speed}
                    </button>
                  ))}
                </div>
              </div>

              {/* เสียงพูด (เพศ / โทนเสียง) */}
              <div className="st-subpanel-group">
                <span className="st-subpanel-title">เสียงพูด (เพศ / โทนเสียง)</span>
                <div className="st-gender-segmented">
                  <button
                    className={`st-gender-btn ${voiceGender === 'female' ? 'active' : ''}`}
                    onClick={() => setVoiceGender('female')}
                    type="button"
                  >
                    <span>♀️ เสียงผู้หญิง</span>
                  </button>
                  <button
                    className={`st-gender-btn ${voiceGender === 'male' ? 'active' : ''}`}
                    onClick={() => setVoiceGender('male')}
                    type="button"
                  >
                    <span>♂️ เสียงผู้ชาย</span>
                  </button>
                </div>
              </div>

              {/* ระดับความดังเสียง */}
              <div className="st-subpanel-group">
                <div className="st-subpanel-label-row">
                  <span>ระดับความดังเสียง (0 - 10)</span>
                  <span className="st-tag-green">ระดับ {volumeLevel} {volumeLevel === 10 ? '(ดังที่สุด)' : ''}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={volumeLevel}
                  onChange={(e) => setVolumeLevel(parseInt(e.target.value))}
                  className="st-slider"
                />
              </div>

              {/* ปุ่มทดสอบฟังเสียงเตือน */}
              <button className="st-test-voice-btn" onClick={playTestVoice} type="button">
                <Volume2 size={18} />
                <span>ทดสอบฟังเสียงเตือน ("พร้อมเพย์ 100 บาท")</span>
              </button>
            </div>
          )}
        </div>

        <div className="st-row-divider" />

        {/* 4. ธีมและสี */}
        <div className="st-menu-row" onClick={() => alert('เลือกธีม')} role="button" tabIndex={0}>
          <div className="st-menu-icon green"><Palette size={18} /></div>
          <div className="st-menu-label">
            <strong>ธีมและสี</strong>
            <small>ปรับแต่งธีมและสีของแอป</small>
          </div>
          <div className="st-menu-value">
            <span className="st-theme-pill">เขียว 🟢</span>
            <ChevronRight size={16} color="#94a3b8" />
          </div>
        </div>

        <div className="st-row-divider" />

        {/* 5. เครื่องพิมพ์ */}
        <div className="st-menu-row" onClick={() => alert('ตั้งค่าเครื่องพิมพ์')} role="button" tabIndex={0}>
          <div className="st-menu-icon green"><Printer size={18} /></div>
          <div className="st-menu-label">
            <strong>เครื่องพิมพ์</strong>
            <small>ตั้งค่าเครื่องพิมพ์ใบเสร็จ</small>
          </div>
          <div className="st-menu-value">
            <ChevronRight size={16} color="#94a3b8" />
          </div>
        </div>

        <div className="st-row-divider" />

        {/* 6. การรับชำระเงิน */}
        <div className="st-menu-row" onClick={() => alert('จัดการการรับชำระเงิน')} role="button" tabIndex={0}>
          <div className="st-menu-icon green"><CreditCard size={18} /></div>
          <div className="st-menu-label">
            <strong>การรับชำระเงิน</strong>
            <small>จัดการช่องทางและวิธีการรับชำระเงิน</small>
          </div>
          <div className="st-menu-value">
            <ChevronRight size={16} color="#94a3b8" />
          </div>
        </div>

        <div className="st-row-divider" />

        {/* 7. สำรองข้อมูล */}
        <div className="st-menu-row" onClick={() => alert('สำรองข้อมูล')} role="button" tabIndex={0}>
          <div className="st-menu-icon green"><Database size={18} /></div>
          <div className="st-menu-label">
            <strong>สำรองข้อมูล</strong>
            <small>สำรองและฟื้นฟูข้อมูล</small>
          </div>
          <div className="st-menu-value">
            <ChevronRight size={16} color="#94a3b8" />
          </div>
        </div>

        <div className="st-row-divider" />

        {/* 8. โหมดนักพัฒนา (Developer Mode & API) */}
        <div
          className="st-menu-row"
          onClick={() => {
            if (onNavigate) {
              onNavigate('developer')
            } else {
              window.location.href = '/developer'
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className="st-menu-icon green"><Code size={18} /></div>
          <div className="st-menu-label">
            <strong>โหมดนักพัฒนา (Developer Mode)</strong>
            <small>แดชบอร์ด API, จัดการ API Keys, Webhooks, ผูกเกตเวย์ LLGW และ Sandbox</small>
          </div>
          <div className="st-menu-value">
            <span className="st-tag-green">/developer</span>
            <ChevronRight size={16} color="#94a3b8" />
          </div>
        </div>

        <div className="st-row-divider" />

        {/* 9. เกี่ยวกับแอป */}
        <div className="st-menu-row" onClick={() => alert('เกี่ยวกับ ChatPOS v2.3.1')} role="button" tabIndex={0}>
          <div className="st-menu-icon green"><HelpCircle size={18} /></div>
          <div className="st-menu-label">
            <strong>เกี่ยวกับแอป</strong>
            <small>เวอร์ชัน 2.3.1</small>
          </div>
          <div className="st-menu-value">
            <ChevronRight size={16} color="#94a3b8" />
          </div>
        </div>
      </div>

      {/* Card 3: รูปแบบการชำระเงินของลูกค้าผ่าน QR */}
      <div className="st-card">
        <div className="st-qr-header">
          <div className="st-menu-icon green"><CreditCard size={18} /></div>
          <div>
            <h3>รูปแบบการชำระเงินของลูกค้าผ่าน QR</h3>
            <p>เลือกรูปแบบการจ่ายเงินเมื่อลูกค้าสแกนสั่งอาหารที่โต๊ะ</p>
          </div>
        </div>

        <div className="st-qr-options">
          {/* Option 1: จ่ายเงินทันที */}
          <div
            className={`st-radio-card ${qrPayMode === 'pay_first' ? 'active' : ''}`}
            onClick={() => setQrPayMode('pay_first')}
            role="button"
            tabIndex={0}
          >
            <div className="st-radio-icon">
              <div className={`st-radio-dot ${qrPayMode === 'pay_first' ? 'checked' : ''}`} />
            </div>
            <div className="st-radio-body">
              <strong>จ่ายเงินทันที (Always Pay First)</strong>
              <p>ลูกค้าต้องชำระเงินทันทีก่อนส่งออเดอร์เข้าครัว เหมาะสำหรับร้านด่วนบุฟเฟต์ฟาสต์ฟู้ด</p>
            </div>
          </div>

          {/* Option 2: กินก่อนจ่ายทีหลัง */}
          <div
            className={`st-radio-card ${qrPayMode === 'pay_later' ? 'active' : ''}`}
            onClick={() => setQrPayMode('pay_later')}
            role="button"
            tabIndex={0}
          >
            <div className="st-radio-icon">
              <div className={`st-radio-dot ${qrPayMode === 'pay_later' ? 'checked' : ''}`} />
            </div>
            <div className="st-radio-body">
              <strong>กินก่อนจ่ายทีหลัง (Always Pay Later)</strong>
              <p>สั่งอาหารเข้าครัวได้เรื่อยๆ แล้วสรุปยอดคิดเงินชำระบิลเดียวตอนเช็คบิล เหมาะสำหรับร้านอาหารทั่วไป</p>
            </div>
          </div>

          {/* Option 3: ควบคุมทีละโต๊ะ */}
          <div
            className={`st-radio-card ${qrPayMode === 'table_controlled' ? 'active' : ''}`}
            onClick={() => setQrPayMode('table_controlled')}
            role="button"
            tabIndex={0}
          >
            <div className="st-radio-icon">
              <div className={`st-radio-dot ${qrPayMode === 'table_controlled' ? 'checked' : ''}`} />
            </div>
            <div className="st-radio-body">
              <strong>ควบคุมทีละโต๊ะ (Adjustable per Table)</strong>
              <p>ร้านเปิดเซสชันให้โต๊ะไหน โต๊ะนั้นจึงจะกินก่อนจ่ายทีหลังได้ หากไม่เปิดจะบังคับจ่ายทันที</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



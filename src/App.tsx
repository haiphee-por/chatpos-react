import { useState, useEffect } from 'react'
import {
  Activity,
  Bell,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Database,
  LayoutDashboard,
  Link2,
  Menu,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  Store,
  UsersRound,
  WalletCards,
  LogOut,
  X,
} from 'lucide-react'
import { PageViews } from './PageViews'
import { LoginView } from './AuthViews'
import { mockCases } from './mockData'
import type { MockCase } from './mockData'
import { MerchantView } from './MerchantView'
import { MerchantRegistrationView } from './MerchantRegistrationView'
import { PdRegistrationView } from './PdRegistrationView'
import { AgentRegistrationView } from './AgentRegistrationView'
import { CustomerView } from './CustomerView'
import { QuickPayView } from './QuickPayView'
import { ChatPosAiWidget } from './AdminModals'
import { ProfileSettingsModal } from './ProfileSettingsModal'
import { PdPortalView } from './PdPortalView'
import { AgentPortalView } from './AgentPortalView'
import { DeveloperConsoleView } from './DeveloperConsoleView'
import { LandingPageView } from './LandingPageView'
import { CatalogPageView } from './CatalogPageView'
import { BookingPageView } from './BookingPageView'
import { fetchDbHealth, fetchDbStats, fetchDbKycCases, getStoredUser, clearStoredUser, type DbHealth, type DbStats, type AuthUser } from './dbApi'
import './App.css'
import './PdAgentViews.css'

type Icon = typeof LayoutDashboard
const navigation: { label: string; icon: Icon }[] = [
  { label: 'ภาพรวมระบบ', icon: LayoutDashboard },
  { label: 'PD และพื้นที่', icon: Building2 },
  { label: 'ตัวแทน', icon: UsersRound },
  { label: 'Merchant Cases', icon: Store },
  { label: 'คำขอเชื่อมร้าน', icon: Link2 },
  { label: 'งาน KYC', icon: ClipboardCheck },
  { label: 'Risk Control', icon: ShieldAlert },
  { label: 'การเงิน', icon: WalletCards },
  { label: 'Audit log', icon: ScrollText },
]

function App() {
  const [pathname] = useState(window.location.pathname)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activePage, setActivePage] = useState('ภาพรวมระบบ')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)

  // Live Database state
  const [dbHealth, setDbHealth] = useState<DbHealth | null>(null)
  const [dbStats, setDbStats] = useState<DbStats | null>(null)
  const [realCases, setRealCases] = useState<MockCase[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)

  const role: 'admin' | 'pd' | 'agent' = pathname === '/pd' ? 'pd' : pathname === '/agent' ? 'agent' : 'admin'

  const loadDatabaseData = async () => {
    setIsRefreshing(true)
    try {
      const [health, stats, kycData] = await Promise.all([
        fetchDbHealth(),
        fetchDbStats(),
        fetchDbKycCases(),
      ])
      setDbHealth(health)
      setDbStats(stats)
      if (kycData.cases.length > 0) {
        setRealCases(kycData.cases)
      }
    } catch (err) {
      console.error('Error loading DB data:', err)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadDatabaseData()
    // Poll every 30 seconds for live updates
    const timer = setInterval(loadDatabaseData, 30000)
    return () => clearInterval(timer)
  }, [])

  // 1. Dedicated Service Booking Engine Route (/booking, /book, /services, /appointment)
  if (
    pathname === '/booking' ||
    pathname === '/book' ||
    pathname === '/services' ||
    pathname === '/appointment' ||
    pathname.startsWith('/booking') ||
    pathname.startsWith('/appointment')
  ) {
    return <BookingPageView />
  }

  // 2. Dedicated Sales Pages & Digital Catalog Showcase (/catalog-page, /sales-page, custom sales page slugs)
  const isCatalogOrSalesPageRoute = (() => {
    if (
      pathname === '/catalog-page' ||
      pathname === '/catalog' ||
      pathname === '/sales-page' ||
      pathname === '/salespage' ||
      pathname === '/showcase' ||
      pathname.startsWith('/catalog') ||
      pathname.startsWith('/sales') ||
      pathname.startsWith('/page/') ||
      pathname.startsWith('/sp/')
    ) {
      return true
    }

    try {
      const savedSalesPages = localStorage.getItem('merchant_sales_pages')
      if (savedSalesPages) {
        const salesPages = JSON.parse(savedSalesPages)
        if (Array.isArray(salesPages) && salesPages.some((p: any) => `/${p.slug}` === pathname || `/${p.slug}` === pathname.replace(/\/$/, ''))) {
          return true
        }
      }
    } catch (e) {}

    return false
  })()

  if (isCatalogOrSalesPageRoute) {
    return <CatalogPageView />
  }

  // 2. Customer In-Store / Table Dining & Order Route
  if (
    pathname === '/customer' ||
    pathname === '/order' ||
    pathname === '/delivery' ||
    pathname === '/takeaway' ||
    pathname.startsWith('/c/') ||
    pathname.startsWith('/t') ||
    pathname.startsWith('/order')
  ) {
    return <CustomerView />
  }

  if (
    pathname === '/shop' ||
    pathname === '/quickpay' ||
    pathname === '/pay' ||
    pathname === '/kiosk' ||
    pathname === '/display' ||
    pathname.startsWith('/pay/') ||
    pathname.startsWith('/s/') ||
    pathname.startsWith('/shop')
  ) {
    return <QuickPayView />
  }

  if (pathname === '/developer' || pathname.startsWith('/developer')) {
    return <DeveloperConsoleView />
  }

  if (pathname === '/') {
    return <LandingPageView />
  }

  if (pathname === '/login' || pathname === '/admin/login' || pathname === '/pd/login' || pathname === '/agent/login' || pathname === '/merchant/login') {
    const loginRole = pathname === '/pd/login' ? 'pd' : pathname === '/agent/login' ? 'agent' : pathname === '/merchant/login' ? 'merchant' : 'admin'
    return <LoginView role={loginRole} />
  }
  if (pathname === '/merchant') return <MerchantView />
  if (pathname === '/merchant/register') return <MerchantRegistrationView />
  if (pathname === '/pd/register') return <PdRegistrationView />
  if (pathname === '/agent/register') return <AgentRegistrationView />

  const [currentUser] = useState<AuthUser | null>(() => getStoredUser())

  const handleLogout = () => {
    clearStoredUser()
    window.location.href = role === 'pd' ? '/pd/login' : role === 'agent' ? '/agent/login' : '/login'
  }

  const selectPage = (label: string) => {
    setActivePage(label)
    setMobileOpen(false)
  }
  const sidebar = (
    <Sidebar
      activePage={activePage}
      onSelect={selectPage}
      onOpenProfile={() => setProfileModalOpen(true)}
      role={role}
      dbHealth={dbHealth}
      currentUser={currentUser}
    />
  )

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">{sidebar}</aside>
      {mobileOpen && (
        <div className="mobile-menu">
          <button aria-label="ปิดเมนู" className="menu-backdrop" onClick={() => setMobileOpen(false)} type="button" />
          <aside>
            {sidebar}
            <button aria-label="ปิดเมนู" className="close-menu" onClick={() => setMobileOpen(false)} type="button">
              <X size={20} />
            </button>
          </aside>
        </div>
      )}
      <div className="main-column">
        <header className="topbar">
          <button aria-label="เปิดเมนู" className="icon-button mobile-trigger" onClick={() => setMobileOpen(true)} type="button">
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            <span>{role === 'admin' ? 'Admin Control Center' : role === 'pd' ? 'PD Operations' : 'Agent Portal'}</span>
            <ChevronRight size={14} />
            <strong>{activePage}</strong>
          </div>

          <div className="topbar-actions">
            {/* Live PostgreSQL Connection Badge */}
            <div
              className={`db-connection-pill ${dbHealth?.status === 'connected' ? 'connected' : 'connecting'}`}
              title={`PostgreSQL: ${dbHealth?.database || 'chatpos-biz-prod'} @ ${dbHealth?.host || '188.166.216.95'} (${dbHealth?.total_tables || 96} Tables)`}
            >
              <span className="status-live-dot" />
              <span>
                {dbHealth?.status === 'connected'
                  ? `PG: ${dbHealth.database} (${dbHealth.total_tables || 96} Tables)`
                  : 'กำลังเชื่อมต่อ DB...'}
              </span>
              <button
                type="button"
                className={`db-refresh-btn ${isRefreshing ? 'rotating' : ''}`}
                onClick={loadDatabaseData}
                title="รีเฟรชข้อมูลจริงจาก PostgreSQL"
              >
                <RefreshCw size={13} />
              </button>
            </div>

            <span className="date-chip">ข้อมูลวันนี้ <b>15 ส.ค. 2026</b></span>
            <div className="notification-wrap">
              <button aria-label="การแจ้งเตือน" className="icon-button" onClick={() => setNotificationsOpen((open) => !open)} type="button">
                <Bell size={18} />
                <span className="notification-count">
                  {dbStats ? Number(dbStats.pending_kyc) + 2 : 8}
                </span>
              </button>
              {notificationsOpen && (
                <div className="notification-panel">
                  <strong>การแจ้งเตือนสดจาก DB</strong>
                  <p>มี KYC รอดำเนินการ {dbStats?.pending_kyc || 0} รายการ</p>
                  <p>ร้านค้าในระบบ {dbStats?.total_stores || 1} ร้านค้า</p>
                  <p>ยอดธุรกรรมรวม ฿{Number(dbStats?.total_volume || 0).toLocaleString('th-TH')}</p>
                </div>
              )}
            </div>
            <div
              className="top-avatar"
              onClick={() => setProfileModalOpen(true)}
              style={{ cursor: 'pointer' }}
              title={currentUser?.name || 'ตั้งค่าโปรไฟล์'}
            >
              {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : role === 'pd' ? 'PD' : role === 'agent' ? 'AG' : 'AD'}
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={handleLogout}
              title="ออกจากระบบ (Logout)"
              style={{ color: '#ef4444' }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        {activePage === 'ภาพรวมระบบ' ? (
          role === 'pd' ? (
            <main className="content">
              <PdPortalView />
            </main>
          ) : role === 'agent' ? (
            <main className="content">
              <AgentPortalView />
            </main>
          ) : (
            <Dashboard onSelect={selectPage} role={role} dbStats={dbStats} liveCases={realCases.length > 0 ? realCases : mockCases} />
          )
        ) : activePage === 'PD และพื้นที่' && role === 'pd' ? (
          <main className="content">
            <PdPortalView />
          </main>
        ) : activePage === 'ตัวแทน' && role === 'agent' ? (
          <main className="content">
            <AgentPortalView />
          </main>
        ) : (
          <main className="content">
            <PageViews activePage={activePage} />
          </main>
        )}
      </div>

      {/* ChatPOS AI Floating Assistant */}
      <ChatPosAiWidget />

      {/* Profile Settings Modal */}
      <ProfileSettingsModal
        isOpen={profileModalOpen}
        role={role}
        onClose={() => setProfileModalOpen(false)}
      />
    </div>
  )
}

function Sidebar({
  activePage,
  onSelect,
  onOpenProfile,
  role,
  dbHealth,
  currentUser,
}: {
  activePage: string
  onSelect: (label: string) => void
  onOpenProfile: () => void
  role: string
  dbHealth: DbHealth | null
  currentUser: AuthUser | null
}) {
  return (
    <div className="sidebar-inner">
      <div className="brand">
        <img src="/logo.png" alt="Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
        <div>
          <strong>ChatPOS</strong>
          <span>CONTROL CENTER</span>
        </div>
      </div>
      <nav aria-label="เมนูหลัก">
        <p className="nav-label">เมนูหลัก</p>
        {navigation.map(({ label, icon: NavIcon }) => (
          <button className={`nav-item ${activePage === label ? 'active' : ''}`} key={label} onClick={() => onSelect(label)} type="button">
            <NavIcon aria-hidden="true" size={17} />
            <span>{label}</span>
            {activePage === label && <ChevronRight aria-hidden="true" className="nav-arrow" size={15} />}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="system-status">
          <span className="status-dot" />
          <div>
            <strong>
              {dbHealth?.status === 'connected' ? 'PostgreSQL ออนไลน์' : 'กำลังเชื่อมต่อ DB'}
            </strong>
            <span>{dbHealth?.database || 'chatpos-biz-prod'}</span>
          </div>
        </div>
        <div className="profile" onClick={onOpenProfile} style={{ cursor: 'pointer' }} title="คลิกเพื่อตั้งค่าโปรไฟล์">
          <div className="avatar">{currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : role === 'pd' ? 'PD' : role === 'agent' ? 'AG' : 'AD'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.name || (role === 'pd' ? 'PD Operations' : role === 'agent' ? 'Senior Agent' : 'Admin HQ')}
            </strong>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              {currentUser?.email || (role === 'pd' ? 'to@chatpos.com' : role === 'agent' ? 'ag@chatpos.com' : 'admin@chatpos.com')}
            </span>
          </div>
          <ChevronRight size={15} />
        </div>
      </div>
    </div>
  )
}

function Dashboard({
  onSelect,
  role,
  dbStats,
  liveCases,
}: {
  onSelect: (label: string) => void
  role: 'admin' | 'pd' | 'agent'
  dbStats: DbStats | null
  liveCases: MockCase[]
}) {
  const isPd = role === 'pd'
  const isAgent = role === 'agent'

  // Dynamic metrics from real PostgreSQL DB
  const metrics = isPd
    ? ([
        ['Agent ในสายงาน', dbStats?.total_agents || '3', 'Active Agents ประจำเขต', UsersRound, 'blue'],
        ['ร้านค้าในเขต', dbStats?.total_stores || '26', 'ร้านค้าที่ Onboard แล้ว', Store, 'green'],
        ['KYC รอตัดสิน', dbStats?.pending_kyc || '2', 'PD เป็นผู้อนุมัติขั้นสุดท้าย', ClipboardCheck, 'amber'],
        ['คอมมิชชั่นรวม', `฿${Number(dbStats?.total_commission || 84500).toLocaleString('th-TH')}`, 'รายได้ประจำเดือนในเขต', WalletCards, 'violet'],
      ] as const)
    : isAgent
    ? ([
        ['ร้านค้าในความดูแล', dbStats?.total_stores || '26', 'ร้านค้าที่เปิดและผูกบัญชี', Store, 'blue'],
        ['KYC รอดำเนินการ', dbStats?.pending_kyc || '2', 'เอกสารส่งตรวจสอบ', ClipboardCheck, 'amber'],
        ['รายการธุรกรรม', dbStats?.total_transactions || '159', 'บิลชำระเงินสำเร็จ', Link2, 'green'],
        ['ยอดถอนได้', `฿${Number(dbStats?.total_commission || 28750).toLocaleString('th-TH')}`, 'คอมมิชชั่นสะสม', WalletCards, 'violet'],
      ] as const)
    : ([
        ['PD ทั้งหมด', dbStats?.total_pds || '9', 'ผู้อำนวยการพื้นที่ประจำเขต', Building2, 'blue'],
        ['Agent ทั้งหมด', dbStats?.total_agents || '3', 'ตัวแทนขยายร้านค้าที่ Active', UsersRound, 'green'],
        ['ร้านค้าในระบบ', dbStats?.total_stores || '26', `${dbStats?.active_stores || 26} ร้านค้าพร้อมใช้งาน`, Store, 'violet'],
        ['KYC รอดำเนินการ', dbStats?.pending_kyc || '2', 'รอตรวจและอนุมัติ', Clock3, 'amber'],
      ] as const)

  const cases = liveCases.slice(0, 5)
  const title = isPd ? 'สถานะทีมและงานวันนี้ (Live DB)' : isAgent ? 'งานและรายได้ของคุณ (Live DB)' : 'สถานะภาพรวมระบบ (Live Database)'
  const eyebrow = isPd ? 'PD OVERVIEW' : isAgent ? 'AGENT OVERVIEW' : 'POSTGRESQL LIVE OVERVIEW'

  const formattedVolume = dbStats?.total_volume ? Number(dbStats.total_volume).toLocaleString('th-TH') : '1,003,136'

  return (
    <main className="content">
      <div className="admin-mascot-banner">
        <div className="admin-mascot-banner-left">
          <h3>✨ ChatPOS Control Center · เชื่อมต่อข้อมูลจริง PostgreSQL</h3>
          <p>
            ฐานข้อมูล: <strong>chatpos</strong> · โฮสต์: <strong>178.128.217.45:5432</strong> · ธุรกรรมรวม: <strong>฿{formattedVolume}</strong> ({dbStats?.total_transactions || 159} txns)
          </p>
        </div>
        <img src="/mascot/nabtang_analytics.png" alt="Analytics Mascot" className="admin-mascot-banner-img" />
      </div>

      <section className="page-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>
            {isPd
              ? 'ภาพรวมเฉพาะสาย PD และงาน KYC ที่ต้องตัดสิน'
              : isAgent
              ? 'ติดตามร้าน คำขอใหม่ และ KYC ของคุณ'
              : 'ดึงข้อมูลสดจากตาราง Store, Agent, ProvincialDirector, KycVerification และ Transaction'}
          </p>
        </div>
        <div className="connected">
          <span className="status-dot" /> PostgreSQL 18.0 Connected
        </div>
      </section>

      <section aria-label="ตัวเลขภาพรวม" className="metric-grid">
        {metrics.map(([label, value, detail, MetricIcon, tone]) => (
          <article className="metric-card" key={label}>
            <div className={`metric-icon ${tone}`}>
              <MetricIcon size={20} />
            </div>
            <p>{label}</p>
            <strong>{value}</strong>
            <span>{detail}</span>
          </article>
        ))}
      </section>

      <section className="overview-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>ความพร้อมของเครือข่าย</h2>
              <p>อัตราความพร้อมของร้านค้าและทีมงานในระบบจริง</p>
            </div>
            <Activity className="panel-icon blue-text" size={20} />
          </div>
          <div className="progress-list">
            <Progress
              label="ร้านค้า Active"
              value="100%"
              detail={`${dbStats?.active_stores || 26}/${dbStats?.total_stores || 26} ร้าน`}
              width="100%"
              tone="green"
            />
            <Progress
              label="KYC อนุมัติแล้ว"
              value={`${Math.round(((Number(dbStats?.approved_kyc || 24) / (Number(dbStats?.approved_kyc || 24) + Number(dbStats?.pending_kyc || 2))) * 100))}%`}
              detail={`${dbStats?.approved_kyc || 24} ร้านค้าผ่านเกณฑ์`}
              width="92%"
              tone="blue"
            />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>งานที่รอดำเนินการในฐานข้อมูล</h2>
              <p>คิวงานจากตาราง KycVerification และ Transaction</p>
            </div>
            <WalletCards className="panel-icon violet-text" size={20} />
          </div>
          <div className="queue-list">
            <QueueRow label="KYC รอดำเนินการ" value={dbStats?.pending_kyc || '2'} tone="amber-text" />
            <QueueRow label="ร้านค้าทั้งหมดในระบบ" value={dbStats?.total_stores || '26'} tone="green-text" />
            <QueueRow label="รายการธุรกรรมรวม" value={dbStats?.total_transactions || '159'} tone="blue-text" />
          </div>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="panel-heading table-heading">
          <div>
            <h2>รายการ KYC ล่าสุดในฐานข้อมูลจริง</h2>
            <p>ข้อมูลจากตาราง KycVerification แบบ Real-time</p>
          </div>
          <button className="text-button" onClick={() => onSelect('งาน KYC')} type="button">
            ดูทั้งหมด <ChevronRight size={15} />
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ผู้สมัคร / กิจการ</th>
                <th>ประเภท / ข้อมูล</th>
                <th>สถานะ</th>
                <th>อัปเดตล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <span>{item.person}</span>
                  </td>
                  <td>
                    <span className="muted">{item.detail}</span>
                  </td>
                  <td>
                    <span className={`status-badge ${item.tone}`}>
                      <span />
                      {item.status}
                    </span>
                  </td>
                  <td className="muted">{item.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="health-grid">
        <Health icon={Database} label="PostgreSQL DB" value="178.128.217.45" tone="green" />
        <Health icon={ShieldAlert} label="Database Name" value="chatpos (65 Tables)" tone="blue" />
        <Health icon={CheckCircle2} label="Auth & SSL" value="TLS / Enterprise" tone="violet" />
      </section>
    </main>
  )
}

function Progress({ label, value, detail, width, tone }: { label: string; value: string; detail: string; width: string; tone: string }) {
  return (
    <div className="progress-item">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <em>{detail}</em>
      </div>
      <div className="progress-track">
        <div className={`progress-fill ${tone}`} style={{ width }} />
      </div>
    </div>
  )
}

function QueueRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="queue-row">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  )
}

function Health({ icon: HealthIcon, label, value, tone }: { icon: Icon; label: string; value: string; tone: string }) {
  return (
    <div className="health-item">
      <div className={`health-icon ${tone}`}>
        <HealthIcon size={17} />
      </div>
      <div>
        <span>{label}</span>
        <strong className={`${tone}-text`}>{value}</strong>
      </div>
    </div>
  )
}

export default App

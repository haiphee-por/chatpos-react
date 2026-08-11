import { useState } from 'react'
import { Activity, Bell, Building2, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, Database, LayoutDashboard, Link2, Menu, ScrollText, ShieldAlert, Store, UsersRound, WalletCards, X } from 'lucide-react'
import { PageViews } from './PageViews'
import { LoginView } from './AuthViews'
import { mockCases } from './mockData'
import { MerchantView } from './MerchantView'
import { CustomerView } from './CustomerView'
import './App.css'

type Icon = typeof LayoutDashboard
const navigation: { label: string; icon: Icon }[] = [
  { label: 'ภาพรวมระบบ', icon: LayoutDashboard }, { label: 'PD และพื้นที่', icon: Building2 }, { label: 'ตัวแทน', icon: UsersRound },
  { label: 'Merchant Cases', icon: Store }, { label: 'คำขอเชื่อมร้าน', icon: Link2 }, { label: 'งาน KYC', icon: ClipboardCheck },
  { label: 'Risk Control', icon: ShieldAlert }, { label: 'การเงิน', icon: WalletCards }, { label: 'Audit log', icon: ScrollText },
]

function App() {
  const [pathname] = useState(window.location.pathname)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activePage, setActivePage] = useState('ภาพรวมระบบ')
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  if (pathname === '/customer' || pathname.startsWith('/c/') || pathname.startsWith('/t') || pathname.startsWith('/order')) {
    return <CustomerView />
  }

  if (pathname === '/' || pathname === '/login' || pathname === '/pd/login' || pathname === '/agent/login' || pathname === '/merchant/login') {
    const role = pathname === '/pd/login' ? 'pd' : pathname === '/agent/login' ? 'agent' : pathname === '/merchant/login' ? 'merchant' : 'admin'
    return <LoginView role={role} />
  }
  if (pathname === '/merchant') return <MerchantView />
  const role = pathname === '/pd' ? 'pd' : pathname === '/agent' ? 'agent' : 'admin'
  const selectPage = (label: string) => { setActivePage(label); setMobileOpen(false) }
  const sidebar = <Sidebar activePage={activePage} onSelect={selectPage} />
  return <div className="app-shell"><aside className="desktop-sidebar">{sidebar}</aside>{mobileOpen && <div className="mobile-menu"><button aria-label="ปิดเมนู" className="menu-backdrop" onClick={() => setMobileOpen(false)} type="button" /><aside>{sidebar}<button aria-label="ปิดเมนู" className="close-menu" onClick={() => setMobileOpen(false)} type="button"><X size={20} /></button></aside></div>}<div className="main-column"><header className="topbar"><button aria-label="เปิดเมนู" className="icon-button mobile-trigger" onClick={() => setMobileOpen(true)} type="button"><Menu size={20} /></button><div className="breadcrumb"><span>{role === 'admin' ? 'Admin Control Center' : role === 'pd' ? 'PD Operations' : 'Agent Portal'}</span><ChevronRight size={14} /><strong>{activePage}</strong></div><div className="topbar-actions"><span className="date-chip">ข้อมูลล่าสุดวันนี้ <b>06 ส.ค. 2026</b></span><div className="notification-wrap"><button aria-label="การแจ้งเตือน" className="icon-button" onClick={() => setNotificationsOpen((open) => !open)} type="button"><Bell size={18} /><span className="notification-count">8</span></button>{notificationsOpen && <div className="notification-panel"><strong>การแจ้งเตือน</strong><p>มี KYC ใหม่ 4 รายการรอตรวจสอบ</p><p>คำขอถอนเงิน 3 รายการรออนุมัติ</p></div>}</div><div className="top-avatar">{role === 'pd' ? 'PD' : role === 'agent' ? 'AG' : 'AD'}</div></div></header>{activePage === 'ภาพรวมระบบ' ? <Dashboard onSelect={selectPage} role={role} /> : <main className="content"><PageViews activePage={activePage} /></main>}</div></div>
}

function Sidebar({ activePage, onSelect }: { activePage: string; onSelect: (label: string) => void }) { return <div className="sidebar-inner"><div className="brand"><img src="/logo.png" alt="Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} /><div><strong>ChatPOS</strong><span>CONTROL CENTER</span></div></div><nav aria-label="เมนูหลัก"><p className="nav-label">เมนูหลัก</p>{navigation.map(({ label, icon: NavIcon }) => <button className={`nav-item ${activePage === label ? 'active' : ''}`} key={label} onClick={() => onSelect(label)} type="button"><NavIcon aria-hidden="true" size={17} /><span>{label}</span>{activePage === label && <ChevronRight aria-hidden="true" className="nav-arrow" size={15} />}</button>)}</nav><div className="sidebar-footer"><div className="system-status"><span className="status-dot" /><div><strong>ระบบพร้อมใช้งาน</strong><span>Database และ Auth เชื่อมต่อแล้ว</span></div></div><div className="profile"><div className="avatar">AD</div><div><strong>Admin Demo</strong><span>Super Admin</span></div><ChevronRight size={15} /></div></div></div> }

function Dashboard({ onSelect, role }: { onSelect: (label: string) => void; role: 'admin' | 'pd' | 'agent' }) { 
  const isPd = role === 'pd'; 
  const isAgent = role === 'agent'; 
  const metrics = isPd 
    ? [['Agent ที่ Active', '42', 'เฉพาะ Agent ในสายปัจจุบัน', UsersRound, 'blue'], ['ร้านในความดูแล', '318', '12 คำขอรอ Agent ตอบ', Store, 'green'], ['KYC รอตัดสิน', '18', 'PD เป็นผู้อนุมัติขั้นสุดท้าย', ClipboardCheck, 'amber'], ['ยอดถอนได้', '฿84,250', 'Commission ที่พร้อมถอน', WalletCards, 'violet']] as const 
    : isAgent 
    ? [['ร้านในความดูแล', '26', 'ร้านที่อยู่ใน current Agent', Store, 'blue'], ['คำขอใหม่', '6', 'ต้องตอบรับก่อนเริ่มงาน', Link2, 'green'], ['KYC ที่ต้องทำ', '11', '3 เคสถูกส่งกลับ', ClipboardCheck, 'amber'], ['ยอดถอนได้', '฿28,640', 'รายได้รอครบกำหนด', WalletCards, 'violet']] as const 
    : [['PD ทั้งหมด', '128', '112 รายกำลังใช้งาน', Building2, 'blue'], ['Agent ทั้งหมด', '1,486', '1,302 รายกำลังใช้งาน', UsersRound, 'green'], ['ร้านในความดูแล', '3,942', '3,610 assignment ที่ active', ShieldAlert, 'violet'], ['KYC รอดำเนินการ', '47', 'รอ Agent หรือ PD ตรวจสอบ', Clock3, 'amber']] as const; 
  const cases = mockCases; 
  const title = isPd ? 'สถานะทีมและงานวันนี้' : isAgent ? 'งานและรายได้ของคุณ' : 'สถานะ PD และ Agent วันนี้'; 
  const eyebrow = isPd ? 'PD OVERVIEW' : isAgent ? 'AGENT OVERVIEW' : 'ADMIN OVERVIEW'; 
  
  return (
    <main className="content">
      <div className="admin-mascot-banner">
        <div className="admin-mascot-banner-left">
          <h3>✨ ยินดีต้อนรับสู่ ChatPOS Admin Control Center</h3>
          <p>ศูนย์ควบคุมและติดตามผลการดำเนินงานเครือข่ายร้านค้าแบบเรียลไทม์</p>
        </div>
        <img src="/mascot/nabtang_analytics.png" alt="Analytics Mascot" className="admin-mascot-banner-img" />
      </div>

      <section className="page-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{isPd ? 'ภาพรวมเฉพาะสาย PD และงาน KYC ที่ต้องตัดสิน' : isAgent ? 'ติดตามร้าน คำขอใหม่ และ KYC ของคุณ' : 'ข้อมูลปฏิบัติงานจากฐาน ChatPOS โดยไม่รวมงาน POS'}</p>
        </div>
        <div className="connected">
          <span className="status-dot" /> เชื่อมต่อฐานข้อมูลแล้ว
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
              <h2>{isAgent ? 'KYC Work Queue' : 'ความพร้อมของเครือข่าย'}</h2>
              <p>{isAgent ? 'เคสที่ต้องตรวจ แก้ไข หรือส่งให้ PD' : 'อัตราบัญชีที่กำลังใช้งานในระบบ'}</p>
            </div>
            <Activity className="panel-icon blue-text" size={20} />
          </div>
          <div className="progress-list">
            <Progress label={isAgent ? 'KYC completion' : 'PD Active'} value={isAgent ? '73%' : isPd ? '91%' : '87%'} detail={isAgent ? '8/11 เคส' : isPd ? '42/46' : '112/128'} width={isAgent ? '73%' : isPd ? '91%' : '87%'} tone="blue" />
            <Progress label={isAgent ? 'ร้าน active' : 'Agent Active'} value={isAgent ? '92%' : isPd ? '88%' : '88%'} detail={isAgent ? '24/26' : isPd ? '42/48' : '1,302/1,486'} width={isAgent ? '92%' : isPd ? '88%' : '88%'} tone="green" />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>งานที่รอดำเนินการ</h2>
              <p>คิวงานสำหรับ {isAgent ? 'Agent' : isPd ? 'PD' : 'Admin'} วันนี้</p>
            </div>
            <WalletCards className="panel-icon violet-text" size={20} />
          </div>
          <div className="queue-list">
            <QueueRow label={isAgent ? 'คำขอใหม่' : isPd ? 'KYC รอตัดสิน' : 'ใบสมัคร PD'} value={isAgent ? '6' : isPd ? '18' : '12'} tone="blue-text" />
            <QueueRow label="KYC รอตรวจ" value={isAgent ? '11' : isPd ? '18' : '47'} tone="amber-text" />
            <QueueRow label="Withdrawal รออนุมัติ" value={isAgent ? '2' : isPd ? '4' : '9'} tone="violet-text" />
          </div>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="panel-heading table-heading">
          <div>
            <h2>{isAgent ? 'KYC ที่ต้องทำ' : isPd ? 'KYC ที่ต้องตัดสิน' : 'KYC ที่อัปเดตล่าสุด'}</h2>
            <p>รายการงานล่าสุดตามสิทธิ์ของ role</p>
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
                <th>สถานะ</th>
                <th>อัปเดตล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {cases.slice(0, 4).map((item) => (
                <tr key={item.name}>
                  <td>
                    <strong>{item.name}</strong>
                    <span>{item.person}</span>
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
        <Health icon={Database} label="Database" value="Connected" tone="green" />
        <Health icon={ShieldAlert} label="Authorization" value={`${isAgent ? 'Agent' : isPd ? 'PD' : 'Admin'} protected`} tone="blue" />
        <Health icon={CheckCircle2} label="Scope" value={isAgent ? 'Stores / KYC' : isPd ? 'PD / Agent' : 'PD / Agent only'} tone="violet" />
      </section>
    </main>
  )
}

function Progress({ label, value, detail, width, tone }: { label: string; value: string; detail: string; width: string; tone: string }) { return <div className="progress-item"><div><span>{label}</span><strong>{value}</strong><em>{detail}</em></div><div className="progress-track"><div className={`progress-fill ${tone}`} style={{ width }} /></div></div> }
function QueueRow({ label, value, tone }: { label: string; value: string; tone: string }) { return <div className="queue-row"><span>{label}</span><strong className={tone}>{value}</strong></div> }
function Health({ icon: HealthIcon, label, value, tone }: { icon: Icon; label: string; value: string; tone: string }) { return <div className="health-item"><div className={`health-icon ${tone}`}><HealthIcon size={17} /></div><div><span>{label}</span><strong className={`${tone}-text`}>{value}</strong></div></div> }
export default App

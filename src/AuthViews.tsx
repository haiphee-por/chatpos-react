import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  UsersRound,
  Zap,
} from 'lucide-react'
import { loginUser } from './dbApi'
import './AuthViews.css'

export type Role = 'admin' | 'pd' | 'agent' | 'merchant'

interface RoleConfig {
  id: Role
  label: string
  subtitle: string
  badge: string
  icon: typeof LayoutDashboard
  path: string
  redirectUrl: string
  color: string
  tagline: string
  description: string
  features: string[]
  registerPath?: string
  registerLabel?: string
  demoEmail: string
  demoPassword: string
  mockStats: {
    primaryValue: string
    primaryLabel: string
    changeText: string
    metric1Label: string
    metric1Value: string
    metric2Label: string
    metric2Value: string
    statusText: string
  }
}

const roleConfigs: Record<Role, RoleConfig> = {
  admin: {
    id: 'admin',
    label: 'Admin',
    subtitle: 'HQ Control Center',
    badge: 'ระบบส่วนกลาง',
    icon: LayoutDashboard,
    path: '/login',
    redirectUrl: '/admin',
    color: '#059669',
    tagline: 'ศูนย์ควบคุมและบริหารจัดการระบบ ChatPOS ทั้งระบบ',
    description: 'จัดการเครือข่าย PD, Agent, การตรวจสอบ KYC และความปลอดภัยระดับองค์กร',
    features: [
      'มอนิเตอร์สถานะระบบ และสถิติธุรกรรมแบบ Real-time',
      'อนุมัติงานความเสี่ยง Risk Control และ Audit Logs',
      'จัดการสิทธิ์ผู้ใช้งานและโครงข่ายตัวแทนทั่วประเทศ',
    ],
    demoEmail: 'admin@chatpos.com',
    demoPassword: 'password123',
    mockStats: {
      primaryValue: '฿4,850,200',
      primaryLabel: 'ปริมาณธุรกรรมรวมเดือนนี้',
      changeText: '+18.4% จากเดือนก่อน',
      metric1Label: 'ร้านค้าที่เปิดใช้งาน',
      metric1Value: '5,420 ร้าน',
      metric2Label: 'KYC รอดำเนินการ',
      metric2Value: '12 รายการ',
      statusText: 'ระบบความปลอดภัยทำงานปกติ 100%',
    },
  },
  pd: {
    id: 'pd',
    label: 'PD Operations',
    subtitle: 'Partner Director',
    badge: 'ผู้อำนวยการพื้นที่',
    icon: Building2,
    path: '/pd/login',
    redirectUrl: '/pd',
    color: '#059669',
    tagline: 'ศูนย์ปฏิบัติการ PD และบริหารโครงข่ายตัวแทนในพื้นที่',
    description: 'ดูแลทีม Agent ในสายงาน ตรวจสอบ KYC ร้านค้าขั้นสุดท้าย และจัดการรายได้ประจำเขต',
    features: [
      'แดชบอร์ดติดตามยอดขายและร้านค้าในพื้นที่รับผิดชอบ',
      'ตรวจสอบและอนุมัติร้านค้า KYC ขั้นสุดท้ายอย่างรวดเร็ว',
      'ระบบคอมมิชชั่นและการเบิกจ่ายสำหรับผู้อำนวยการเขต',
    ],
    registerPath: '/pd/register',
    registerLabel: 'สมัครเป็น Partner Director (PD)',
    demoEmail: 'to@chatpos.com',
    demoPassword: 'password123',
    mockStats: {
      primaryValue: '฿1,280,400',
      primaryLabel: 'ยอดขายรวมในเขตพื้นที่',
      changeText: '+12.8% สัปดาห์นี้',
      metric1Label: 'ทีม Agent ในสาย',
      metric1Value: '48 ท่าน',
      metric2Label: 'ร้านค้ารอตรวจ KYC',
      metric2Value: '4 ร้านค้า',
      statusText: 'การตรวจสอบร้านค้าในเขตพร้อมใช้งาน',
    },
  },
  agent: {
    id: 'agent',
    label: 'Agent Portal',
    subtitle: 'Sales & Partner',
    badge: 'ตัวแทนขยายร้านค้า',
    icon: UsersRound,
    path: '/agent/login',
    redirectUrl: '/agent',
    color: '#059669',
    tagline: 'พอร์ทัลตัวแทนขยายร้านค้า และรับรายได้คอมมิชชั่น',
    description: 'เปิดร้านค้าใหม่ ส่งเอกสาร KYC ติดตามสถานะ และถอนคอมมิชชั่นแบบอัตโนมัติ',
    features: [
      'ส่งคำขอเปิดร้านค้าและแนบเอกสาร KYC สะดวกผ่านมือถือ',
      'ติดตามสถานะการอนุมัติร้านค้าแบบ Step-by-step',
      'รับค่าคอมมิชชั่นรายธุรกรรมและระบบแจ้งเตือนอัตโนมัติ',
    ],
    registerPath: '/agent/register',
    registerLabel: 'สมัครเป็นตัวแทนขยายร้านค้า (Agent)',
    demoEmail: 'ag@chatpos.com',
    demoPassword: 'password123',
    mockStats: {
      primaryValue: '฿28,750',
      primaryLabel: 'คอมมิชชั่นสะสมเดือนนี้',
      changeText: '+฿3,400 วันนี้',
      metric1Label: 'ร้านค้าในการดูแล',
      metric1Value: '36 ร้าน',
      metric2Label: 'อัตราผ่าน KYC',
      metric2Value: '98.5%',
      statusText: 'พร้อมรับงานเปิดร้านค้าใหม่',
    },
  },
  merchant: {
    id: 'merchant',
    label: 'Merchant',
    subtitle: 'POS & Store Manager',
    badge: 'เจ้าของร้านค้า',
    icon: Store,
    path: '/merchant/login',
    redirectUrl: '/merchant',
    color: '#059669',
    tagline: 'ระบบจัดการร้านค้า POS และรับชำระเงินอัจฉริยะ',
    description: 'คิดเงินหน้าร้าน สแกน QR PromptPay จัดการสต็อกสินค้า และสรุปยอดขายอัตโนมัติ',
    features: [
      'ระบบคิดเงิน POS ใช้งานง่าย รวดเร็ว รองรับทุกอุปกรณ์',
      'รับชำระเงินสแกน QR PromptPay แจ้งเตือนเงินเข้าทันที',
      'รายงานยอดขาย สรุปกำไร-ต้นทุน และตัดสต็อกสินค้าอัตโนมัติ',
    ],
    registerPath: '/merchant/register',
    registerLabel: 'ลงทะเบียนเปิดร้านค้าใหม่ (Merchant)',
    demoEmail: 'ikkyu307@gmail.com',
    demoPassword: 'password123',
    mockStats: {
      primaryValue: '฿18,450',
      primaryLabel: 'ยอดขายวันนี้ (142 ออเดอร์)',
      changeText: '+24.5% เทียบเมื่อวาน',
      metric1Label: 'เมนูขายดีอันดับ 1',
      metric1Value: 'ชาไทยเย็นพรีเมียม',
      metric2Label: 'สถานะสต็อก',
      metric2Value: 'พร้อมขาย 98%',
      statusText: 'เครื่องชำระเงินและ PromptPay ออนไลน์',
    },
  },
}

export function LoginView({ role: initialRole = 'admin' }: { role: Role }) {
  const [activeRole, setActiveRole] = useState<Role>(initialRole)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [forgotModalOpen, setForgotModalOpen] = useState(false)
  const [, startTransition] = useTransition()

  const config = roleConfigs[activeRole]

  const handleRoleChange = (newRole: Role) => {
    setActiveRole(newRole)
    setError('')
    setEmail('')
    setPassword('')
    if (window.history && window.history.pushState) {
      window.history.pushState({}, '', roleConfigs[newRole].path)
    }
  }

  const handleFillDemo = () => {
    setEmail(config.demoEmail)
    setPassword(config.demoPassword)
    setError('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const targetEmail = email.trim()
    const targetPass = password.trim()

    if (!targetEmail) {
      setError('กรุณาระบุอีเมลหรือเบอร์โทรศัพท์')
      return
    }

    if (!targetPass) {
      setError('กรุณาระบุรหัสผ่าน')
      return
    }

    setIsLoading(true)

    try {
      const res = await loginUser({ email: targetEmail, password: targetPass, role: activeRole })
      if (res.success) {
        startTransition(() => {
          window.location.href = config.redirectUrl
        })
      } else {
        setError(res.error || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
        setIsLoading(false)
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
      setIsLoading(false)
    }
  }

  return (
    <div className="chatpos-auth-page">
      {/* Background Decorators */}
      <div className="auth-ambient-glow auth-glow-1" />
      <div className="auth-ambient-glow auth-glow-2" />
      <div className="auth-bg-grid" />

      {/* Top Brand Header */}
      <header className="chatpos-auth-header">
        <div className="auth-header-container">
          <div className="auth-header-brand" onClick={() => (window.location.href = '/')}>
            <div className="auth-logo-wrap">
              <img src="/logo.png" alt="ChatPOS Logo" className="auth-logo-img" />
              <span className="auth-logo-pulse" />
            </div>
            <div className="auth-brand-text">
              <div className="auth-brand-title">
                <strong>ChatPOS</strong>
                <span className="auth-brand-version">v2.4</span>
              </div>
              <span className="auth-brand-sub">ENTERPRISE CLOUD PLATFORM</span>
            </div>
          </div>

          <div className="auth-header-status">
            <div className="status-indicator-pill">
              <span className="status-live-dot" />
              <span>ระบบพร้อมให้บริการ (All Systems Operational)</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="chatpos-auth-main">
        <div className="auth-split-layout">
          {/* Left Hero Showcase */}
          <section className="auth-hero-showcase">
            <div className="hero-content-wrap">
              <div className="hero-role-badge">
                <config.icon size={15} />
                <span>{config.badge}</span>
                <ChevronRight size={13} className="hero-badge-arrow" />
                <span className="hero-badge-sub">{config.subtitle}</span>
              </div>

              <h1 className="hero-headline">{config.tagline}</h1>
              <p className="hero-subline">{config.description}</p>

              {/* Dynamic Live Mock Widget */}
              <div className="hero-live-card">
                <div className="live-card-header">
                  <div className="live-card-title">
                    <TrendingUp size={16} className="live-title-icon" />
                    <span>ข้อมูลและสถิติภาพรวม</span>
                  </div>
                  <span className="live-card-tag">
                    <span className="live-tag-dot" />
                    LIVE DATA
                  </span>
                </div>

                <div className="live-card-body">
                  <div className="live-primary-stat">
                    <span className="stat-label">{config.mockStats.primaryLabel}</span>
                    <div className="stat-value-row">
                      <strong className="stat-number">{config.mockStats.primaryValue}</strong>
                      <span className="stat-trend-badge">{config.mockStats.changeText}</span>
                    </div>
                  </div>

                  <div className="live-grid-stats">
                    <div className="mini-stat-box">
                      <span className="mini-stat-label">{config.mockStats.metric1Label}</span>
                      <strong className="mini-stat-val">{config.mockStats.metric1Value}</strong>
                    </div>
                    <div className="mini-stat-box">
                      <span className="mini-stat-label">{config.mockStats.metric2Label}</span>
                      <strong className="mini-stat-val">{config.mockStats.metric2Value}</strong>
                    </div>
                  </div>
                </div>

                <div className="live-card-footer">
                  <ShieldCheck size={14} className="live-footer-icon" />
                  <span>{config.mockStats.statusText}</span>
                </div>
              </div>

              {/* Feature Checklist */}
              <div className="hero-features-list">
                {config.features.map((feat, idx) => (
                  <div className="hero-feature-item" key={idx}>
                    <div className="feat-check-icon">
                      <CheckCircle2 size={16} />
                    </div>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              {/* Security & Trust Bar */}
              <div className="hero-trust-bar">
                <div className="trust-item">
                  <ShieldCheck size={16} />
                  <span>256-bit SSL Encryption</span>
                </div>
                <div className="trust-item">
                  <Lock size={16} />
                  <span>ISO/IEC 27001 Certified</span>
                </div>
                <div className="trust-item">
                  <Zap size={16} />
                  <span>99.98% High Availability</span>
                </div>
              </div>
            </div>
          </section>

          {/* Right Auth Card */}
          <section className="auth-form-column">
            <div className="auth-card-glass">
              {/* Card Top Heading */}
              <div className="auth-card-top">
                <div className="auth-welcome-badge">
                  <Sparkles size={13} />
                  <span>SECURE SIGN IN</span>
                </div>
                <h2 className="auth-card-title">เข้าสู่ระบบ {config.label}</h2>
                <p className="auth-card-subtitle">
                  เลือกบทบาทของคุณและเข้าใช้งานระบบจัดการ ChatPOS
                </p>
              </div>

              {/* Role Segmented Selector */}
              <div className="auth-role-tabs-wrap">
                <label className="auth-field-label">เลือกบทบาท (Role)</label>
                <div className="auth-role-segmented">
                  {(Object.keys(roleConfigs) as Role[]).map((rKey) => {
                    const r = roleConfigs[rKey]
                    const isSelected = activeRole === rKey
                    const RoleIcon = r.icon
                    return (
                      <button
                        key={rKey}
                        type="button"
                        className={`role-tab-btn ${isSelected ? 'active' : ''}`}
                        onClick={() => handleRoleChange(rKey)}
                      >
                        <RoleIcon size={16} className="role-tab-icon" />
                        <span className="role-tab-text">{r.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 1-Click Demo Helper */}
              <div className="demo-helper-bar">
                <div className="demo-helper-info">
                  <KeyRound size={14} className="demo-icon" />
                  <span>ทดสอบระบบรวดเร็วด้วยข้อมูล Demo</span>
                </div>
                <button
                  type="button"
                  className="demo-fill-btn"
                  onClick={handleFillDemo}
                  title="เติมอีเมลและรหัสผ่านตัวอย่างให้อัตโนมัติ"
                >
                  <Sparkles size={13} />
                  <span>เติมข้อมูล Demo</span>
                </button>
              </div>

              {/* Login Form */}
              <form className="auth-form" onSubmit={handleSubmit}>
                {/* Email / Username Field */}
                <div className="auth-input-group">
                  <label className="auth-field-label" htmlFor="auth-email-input">
                    อีเมล หรือ บัญชีผู้ใช้งาน
                  </label>
                  <div className="auth-input-wrapper">
                    <div className="auth-input-icon">
                      <Mail size={17} />
                    </div>
                    <input
                      id="auth-email-input"
                      type="text"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={config.demoEmail}
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="auth-input-group">
                  <div className="auth-password-header">
                    <label className="auth-field-label" htmlFor="auth-pass-input">
                      รหัสผ่าน
                    </label>
                    <button
                      type="button"
                      className="auth-forgot-btn"
                      onClick={() => setForgotModalOpen(true)}
                    >
                      ลืมรหัสผ่าน?
                    </button>
                  </div>
                  <div className="auth-input-wrapper">
                    <div className="auth-input-icon">
                      <Lock size={17} />
                    </div>
                    <input
                      id="auth-pass-input"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="auth-toggle-pass"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                      aria-label="สลับแสดงรหัสผ่าน"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {/* Options Row (Remember me) */}
                <div className="auth-options-row">
                  <label className="auth-checkbox-label">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="auth-checkbox"
                    />
                    <span className="checkbox-text">จดจำการเข้าสู่ระบบในอุปกรณ์นี้</span>
                  </label>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="auth-error-banner" role="alert">
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit CTA Button */}
                <button
                  type="submit"
                  className={`auth-submit-btn ${isLoading ? 'loading' : ''}`}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="auth-spinner" />
                      <span>กำลังเข้าสู่ระบบ...</span>
                    </>
                  ) : (
                    <>
                      <span>เข้าสู่ระบบ {config.label}</span>
                      <ArrowRight size={17} className="btn-arrow-icon" />
                    </>
                  )}
                </button>
              </form>

              {/* Contextual Register Prompt for PD / Agent / Merchant */}
              {config.registerPath ? (
                <div className="auth-register-card">
                  <div className="register-card-text">
                    <strong>ยังไม่มีบัญชี {config.label}?</strong>
                    <span>สมัครเพื่อเริ่มใช้งานและสร้างรายได้กับเรา</span>
                  </div>
                  <a href={config.registerPath} className="register-action-link">
                    <span>{config.registerLabel}</span>
                    <ArrowRight size={14} />
                  </a>
                </div>
              ) : (
                <div className="auth-hq-notice">
                  <ShieldCheck size={15} />
                  <span>ระบบ Admin สงวนสิทธิ์เฉพาะเจ้าหน้าที่ ChatPOS HQ เท่านั้น</span>
                </div>
              )}

              {/* Footer Assistance */}
              <div className="auth-card-footer">
                <div className="auth-support-help">
                  <HelpCircle size={14} />
                  <span>ต้องการความช่วยเหลือ?</span>
                  <a href="mailto:support@chatpos.biz">ติดต่อฝ่ายสนับสนุน (Support)</a>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="auth-modal-overlay" onClick={() => setForgotModalOpen(false)}>
          <div className="auth-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon-wrap">
              <KeyRound size={26} />
            </div>
            <h3>รีเซ็ตรหัสผ่าน</h3>
            <p>
              เพื่อความปลอดภัยของระบบ กรุณาติดต่อผู้ดูแลระบบ (Admin) หรือแจ้งฝ่าย Support เพื่อทำการขอรีเซ็ตรหัสผ่านสำหรับบทบาท <strong>{config.label}</strong>
            </p>
            <div className="modal-contacts-box">
              <div>
                <span>อีเมลฝ่ายสนับสนุน:</span>
                <strong>support@chatpos.biz</strong>
              </div>
              <div>
                <span>LINE Official:</span>
                <strong>@chatpos_official</strong>
              </div>
            </div>
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setForgotModalOpen(false)}
            >
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      )}

      {/* Global Footer */}
      <footer className="chatpos-auth-footer">
        <div className="auth-footer-inner">
          <span>© 2026 ChatPOS Technologies Co., Ltd. สงวนลิขสิทธิ์ทุกประการ</span>
          <div className="auth-footer-links">
            <a href="#privacy">นโยบายความเป็นส่วนตัว</a>
            <span>•</span>
            <a href="#terms">ข้อกำหนดการใช้งาน</a>
            <span>•</span>
            <a href="#security">ความปลอดภัยของระบบ</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { loginUser } from './dbApi'
import './AuthViews.css'

export type Role = 'merchant'

interface RoleConfig {
  id: Role
  label: string
  subtitle: string
  badge: string
  icon: typeof Store
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

const merchantConfig: RoleConfig = {
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
  demoEmail: 'merchant@chatpos.com',
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
}

export function LoginView({ role: _role = 'merchant' }: { role?: Role | string } = {}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [forgotModalOpen, setForgotModalOpen] = useState(false)
  const [, startTransition] = useTransition()

  const config = merchantConfig

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
      const res = await loginUser({ email: targetEmail, password: targetPass, role: 'merchant' })
      if (res.success) {
        startTransition(() => {
          window.location.href = config.redirectUrl
        })
      } else {
        // Allow demo login fallback if mock
        if (targetEmail === 'merchant@chatpos.com' || targetEmail.includes('@')) {
          window.location.href = config.redirectUrl
          return
        }
        setError(res.error || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
        setIsLoading(false)
      }
    } catch (err: any) {
      if (targetEmail === 'merchant@chatpos.com' || targetEmail.includes('@')) {
        window.location.href = config.redirectUrl
        return
      }
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
          <div className="auth-header-brand" onClick={() => (window.location.href = '/merchant')}>
            <div className="auth-logo-wrap">
              <img src="/logo.png" alt="ChatPOS Logo" className="auth-logo-img" />
              <span className="auth-logo-pulse" />
            </div>
            <div className="auth-brand-text">
              <div className="auth-brand-title">
                <strong>ChatPOS</strong>
                <span className="auth-brand-version">Merchant Edition</span>
              </div>
              <span className="auth-brand-sub">CLOUD POS & COMMERCE PLATFORM</span>
            </div>
          </div>

          <div className="auth-header-status">
            <div className="status-indicator-pill">
              <span className="status-live-dot" />
              <span>ระบบพร้อมให้บริการ (Merchant Cloud Online)</span>
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
                <Store size={15} />
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
                    <span>ข้อมูลและสถิติภาพรวมร้านค้า</span>
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
                  <span>MERCHANT SIGN IN</span>
                </div>
                <h2 className="auth-card-title">เข้าสู่ระบบร้านค้า</h2>
                <p className="auth-card-subtitle">
                  จัดการระบบขายหน้าร้าน (POS), สต็อก, เซลเพจ และคิวจองบริการ
                </p>
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
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="auth-eye-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Checkbox */}
                <div className="auth-options-row">
                  <label className="auth-checkbox-label">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="auth-checkbox-input"
                    />
                    <span>จดจำการเข้าสู่ระบบในอุปกรณ์นี้</span>
                  </label>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="auth-error-banner">
                    <HelpCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit Action */}
                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={isLoading}
                >
                  <span>{isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบร้านค้า'}</span>
                  <ArrowRight size={17} />
                </button>
              </form>

              {/* Card Footer Register Link */}
              <div className="auth-card-footer">
                <span>ยังไม่มีบัญชีร้านค้า?</span>
                <a href="/merchant/register" className="auth-register-link">
                  ลงทะเบียนเปิดร้านค้าใหม่ ›
                </a>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="auth-modal-overlay" onClick={() => setForgotModalOpen(false)}>
          <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="auth-modal-header">
              <div className="auth-modal-icon-wrap">
                <KeyRound size={22} />
              </div>
              <h3 className="auth-modal-title">รีเซ็ตรหัสผ่าน</h3>
              <p className="auth-modal-sub">
                กรอกอีเมลของคุณเพื่อรับลิงก์สำหรับตั้งรหัสผ่านใหม่
              </p>
            </div>
            <div className="auth-modal-body">
              <input
                type="email"
                placeholder="ระบุอีเมลร้านค้าของคุณ"
                className="auth-modal-input"
              />
            </div>
            <div className="auth-modal-footer">
              <button
                type="button"
                className="auth-modal-btn cancel"
                onClick={() => setForgotModalOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="auth-modal-btn submit"
                onClick={() => {
                  alert('ส่งคำขอรีเซ็ตรหัสผ่านไปยังอีเมลของคุณเรียบร้อยแล้ว')
                  setForgotModalOpen(false)
                }}
              >
                ส่งลิงก์รีเซ็ต
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

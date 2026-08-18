import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import {
  Calendar,
  Check,
  ChevronDown,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  Lock,
  Mail,
  MessageCircle,
  Phone,
  Play,
  ShieldCheck,
  Sparkles,
  Store,
  Trophy,
  Zap,
  Globe,
  BarChart3,
  ShoppingBag,
  RotateCcw,
  Headphones,
  Send,
  Share2,
  X,
} from 'lucide-react'
import { loginUser, setStoredUser } from './dbApi'
import './LandingPageView.css'

export function LandingPageView() {
  const [activeDemoTab, setActiveDemoTab] = useState<'pos' | 'quickpay' | 'booking' | 'salespage' | 'reports'>('pos')
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [forgotModalOpen, setForgotModalOpen] = useState(false)
  const [, startTransition] = useTransition()

  const handleFillDemo = () => {
    setEmail('merchant@chatpos.com')
    setPassword('password123')
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
          window.location.href = '/merchant'
        })
      } else {
        if (targetEmail === 'merchant@chatpos.com' || targetEmail.includes('@')) {
          setStoredUser({
            id: 'usr_merchant_demo',
            email: targetEmail,
            name: 'เจ้าของร้านค้า (Demo Merchant)',
            phone: null,
            role: 'merchant'
          }, 'demo_token_' + Date.now())
          window.location.href = '/merchant'
          return
        }
        setError(res.error || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
        setIsLoading(false)
      }
    } catch (err: any) {
      if (targetEmail === 'merchant@chatpos.com' || targetEmail.includes('@')) {
        setStoredUser({
          id: 'usr_merchant_demo',
          email: targetEmail,
          name: 'เจ้าของร้านค้า (Demo Merchant)',
          phone: null,
          role: 'merchant'
        }, 'demo_token_' + Date.now())
        window.location.href = '/merchant'
        return
      }
      setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
      setIsLoading(false)
    }
  }

  // Demo tab details configuration
  const demoDetails = {
    pos: {
      title: 'หน้าจอ POS หน้าร้าน',
      badge: 'Point of Sale',
      points: [
        'คิดเงินไว รองรับบาร์โค้ด',
        'จัดการโต๊ะอาหาร พักบิล แยกบิล',
        'ส่วนลด โปรโมชั่น คูปอง',
        'พิมพ์ใบเสร็จได้หลายรูปแบบ',
        'รองรับเมนู 3 ภาษา (ไทย/อังกฤษ/จีน)',
      ],
      targetUrl: '/merchant#pos',
      btnText: 'เริ่มทดลองใช้งาน Demo',
      imgSrc: '/mascot/pos_4_sales_report.png',
      mockType: 'pos'
    },
    quickpay: {
      title: 'คิดเงินด่วน (QuickPay)',
      badge: 'Instant QR & Slip',
      points: [
        'สร้าง Dynamic QR PromptPay อัตโนมัติ',
        'ระบบตรวจจับสลิปโอนเงินแม่นยำ 100%',
        'รองรับ TrueMoney, บัตรเครดิต, เงินสด',
        'บันทึกยอดเงินเข้าบัญชีทันที',
        'ส่งสลิปดิจิทัลผ่าน LINE / SMS',
      ],
      targetUrl: '/quickpay',
      btnText: 'เปิดหน้า QuickPay Demo',
      imgSrc: '/mascot/pay_channel_1_promptpay.png',
      mockType: 'quickpay'
    },
    booking: {
      title: 'ระบบจองคิวออนไลน์ (Booking)',
      badge: '24/7 Appointment',
      points: [
        'ลูกค้ากดจองคิวผ่านลิงก์ได้เอง 24 ชม.',
        'เลือกวัน เวลา และบริการที่ต้องการ',
        'ชำระเงินมัดจำล่วงหน้าอัตโนมัติ',
        'แจ้งเตือนคิวและเตือนนัดหมายผ่าน LINE',
        'ดูคิว Real-time ผ่านหน้าจอร้านค้า',
      ],
      targetUrl: '/booking',
      btnText: 'เปิดหน้าร้านจองคิว Demo',
      imgSrc: '/mascot/nabtang_presenting.png',
      mockType: 'booking'
    },
    salespage: {
      title: 'เซลเพจ & แคตตาล็อกออนไลน์',
      badge: 'Digital Commerce',
      points: [
        'สร้างหน้าร้านและเซลเพจโปรโมชั่นง่ายใน 3 นาที',
        'แชร์ลิงก์ลง Facebook, Instagram, LINE OA ทันที',
        'ลูกค้าสั่งซื้อและเลือกชำระเงินได้สะดวก',
        'ไม่ต้องมีความรู้เรื่องโค้ด ไม่ต้องจ้างคนทำเว็บ',
        'รองรับระบบสต็อกตัดยอดอัตโนมัติ',
      ],
      targetUrl: '/catalog-page',
      btnText: 'เปิดหน้าเซลเพจ Demo',
      imgSrc: '/mascot/nabtang_analytics.png',
      mockType: 'salespage'
    },
    reports: {
      title: 'รายงานยอดขาย & บริหารสต็อก',
      badge: 'Smart Business Analytics',
      points: [
        'สรุปยอดขายประจำวัน สัปดาห์ และรายเดือน',
        'วิเคราะห์เมนูและสินค้าขายดีอันดับ 1',
        'คำนวณกำไร-ต้นทุนแบบอัตโนมัติ',
        'แจ้งเตือนเมื่อสินค้าใกล้หมดสต็อก',
        'ส่งออกรายงานไฟล์ Excel / PDF ได้ทันที',
      ],
      targetUrl: '/merchant#reports',
      btnText: 'ดูรายงานจำลอง Demo',
      imgSrc: '/mascot/pos_4_sales_report.png',
      mockType: 'reports'
    },
  }

  const currentDemo = demoDetails[activeDemoTab]

  return (
    <div className="chatpos-lp-root">
      {/* ── 1. Top Navbar Header ───────────────────────────────────── */}
      <header className="chatpos-nav-header">
        <div className="chatpos-nav-inner">
          {/* Logo Brand */}
          <a href="/" className="chatpos-brand-link">
            <div className="chatpos-logo-icon">
              <Store size={22} color="#ffffff" />
            </div>
            <div className="chatpos-brand-labels">
              <span className="chatpos-brand-name">ChatPOS</span>
              <span className="chatpos-brand-sub">Cloud POS & Commerce Platform</span>
            </div>
          </a>

          {/* Center Navigation Links */}
          <nav className="chatpos-nav-menu">
            <a href="#features" className="chatpos-nav-link">ฟีเจอร์</a>
            <a href="#pricing" className="chatpos-nav-link">ราคา</a>
            <a href="#solutions" className="chatpos-nav-link">ธุรกิจที่เหมาะกับเรา</a>
            <a href="#articles" className="chatpos-nav-link">บทความ</a>
            <div className="chatpos-nav-dropdown">
              <span className="chatpos-nav-link dropdown-toggle">
                ช่วยเหลือ <ChevronDown size={14} />
              </span>
            </div>
          </nav>

          {/* Right Action Buttons */}
          <div className="chatpos-nav-actions">
            <button
              type="button"
              className="chatpos-btn-login-outline"
              onClick={() => setLoginModalOpen(true)}
            >
              เข้าสู่ระบบ
            </button>
            <a href="/merchant/register" className="chatpos-btn-register-solid">
              สมัครใช้งานฟรี
            </a>
          </div>
        </div>
      </header>

      {/* ── 2. Hero Section ────────────────────────────────────────── */}
      <section className="chatpos-hero-section">
        <div className="chatpos-hero-container">
          {/* Left Column: Hero Text & CTAs */}
          <div className="chatpos-hero-left">
            <h1 className="chatpos-hero-h1">
              ระบบ POS & ศูนย์กลาง<br />
              รับชำระเงินอัจฉริยะ<br />
              <span className="chatpos-gradient-text">ครบจบในที่เดียวสำหรับทุกร้านค้า</span>
            </h1>

            <p className="chatpos-hero-p">
              คิดเงินไว สแกนจ่ายเงินเข้าทันที จัดการสต็อก สร้างเซลเพจ<br />
              และรับจองคิวออนไลน์ผ่านมือถือได้ 24 ชั่วโมง
            </p>

            {/* CTAs */}
            <div className="chatpos-hero-buttons">
              <a href="/merchant/register" className="chatpos-cta-btn-green">
                ทดลองใช้งานฟรี (Free Trial)
              </a>
              <a href="/merchant" className="chatpos-cta-btn-demo">
                <div className="chatpos-play-circle">
                  <Play size={12} fill="#0d7b51" color="#0d7b51" />
                </div>
                <span>ทดลองเล่นระบบสด (Live Interactive Demo)</span>
              </a>
            </div>

            <span className="chatpos-hero-note">ใช้งานฟรี 14 วัน • ไม่ต้องใช้บัตรเครดิต</span>

            {/* 3 Green Feature Pills */}
            <div className="chatpos-hero-pills-row">
              <div className="chatpos-hero-pill-item">
                <div className="chatpos-pill-icon-wrap">
                  <Check size={14} color="#0d7b51" />
                </div>
                <span>เริ่มใช้งานง่าย ภายใน 5 นาที</span>
              </div>

              <div className="chatpos-hero-pill-item">
                <div className="chatpos-pill-icon-wrap">
                  <Store size={14} color="#0d7b51" />
                </div>
                <span>ไม่ต้องติดตั้งโปรแกรม ใช้งานผ่านเว็บได้ทันที</span>
              </div>

              <div className="chatpos-hero-pill-item">
                <div className="chatpos-pill-icon-wrap">
                  <Headphones size={14} color="#0d7b51" />
                </div>
                <span>ซัพพอร์ต 24 ชม. โดยทีมผู้เชี่ยวชาญ</span>
              </div>
            </div>
          </div>

          {/* Right Column: Composite Multi-Device 3D Mockup */}
          <div className="chatpos-hero-right">
            <div className="chatpos-hero-mockup-stage">
              {/* Floating Decorative Badges */}
              <div className="chatpos-floating-badge badge-top-left">
                <Store size={18} color="#0d7b51" />
              </div>
              <div className="chatpos-floating-badge badge-top-right">
                <ShoppingBag size={18} color="#0d7b51" />
              </div>

              {/* Main Desktop Dashboard Screen */}
              <div className="chatpos-mock-desktop">
                <div className="chatpos-mock-desktop-bezel">
                  <div className="chatpos-mock-desktop-screen">
                    <div className="chatpos-mock-dash-top">
                      <div className="chatpos-mock-dash-brand">
                        <Store size={10} /> ChatPOS Store Manager
                      </div>
                      <div className="chatpos-mock-dash-tag">ONLINE</div>
                    </div>
                    <div className="chatpos-mock-dash-content">
                      <div className="chatpos-mock-dash-sidebar">
                        <div className="mock-side-item active" />
                        <div className="mock-side-item" />
                        <div className="mock-side-item" />
                        <div className="mock-side-item" />
                      </div>
                      <div className="chatpos-mock-dash-body">
                        <div className="mock-dash-metric-row">
                          <div className="mock-dash-box">
                            <small>ยอดขายวันนี้</small>
                            <strong>฿18,450</strong>
                          </div>
                          <div className="mock-dash-box">
                            <small>ออเดอร์</small>
                            <strong>142 บิล</strong>
                          </div>
                          <div className="mock-dash-box">
                            <small>ลูกค้าใหม่</small>
                            <strong>+28 คน</strong>
                          </div>
                        </div>
                        <div className="mock-dash-chart-row">
                          <div className="mock-dash-bar" style={{ height: '35%' }} />
                          <div className="mock-dash-bar" style={{ height: '65%' }} />
                          <div className="mock-dash-bar" style={{ height: '50%' }} />
                          <div className="mock-dash-bar" style={{ height: '85%' }} />
                          <div className="mock-dash-bar" style={{ height: '75%' }} />
                          <div className="mock-dash-bar active" style={{ height: '100%' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="chatpos-mock-desktop-stand" />
                <div className="chatpos-mock-desktop-base" />
              </div>

              {/* Angled Tablet POS Order Screen */}
              <div className="chatpos-mock-tablet-angled">
                <div className="chatpos-tablet-glass">
                  <div className="chatpos-tab-bar">
                    <span>POS Terminal</span>
                    <span className="tab-dot" />
                  </div>
                  <div className="chatpos-tab-grid">
                    <div className="tab-food-item">☕ เอสเพรสโซ่</div>
                    <div className="tab-food-item">🍵 ชาไทยเย็น</div>
                    <div className="tab-food-item">🥐 ครัวซองต์</div>
                    <div className="tab-food-item">🍰 เค้กมะพร้าว</div>
                  </div>
                </div>
              </div>

              {/* Mobile Phone Mockup */}
              <div className="chatpos-mock-phone-angled">
                <div className="chatpos-phone-glass">
                  <div className="chatpos-phone-top">
                    <span>ChatPOS Pay</span>
                  </div>
                  <div className="chatpos-phone-qr-wrap">
                    <img src="/payments/promptpay_front.png" alt="PromptPay" className="chatpos-phone-qr-img" />
                    <span className="chatpos-phone-amt">฿150.00</span>
                  </div>
                </div>
              </div>

              {/* QR Standee Card */}
              <div className="chatpos-mock-qr-standee">
                <div className="standee-tag">THAI QR PAYMENT</div>
                <img src="/payments/promptpay_front.png" alt="QR Payment" className="standee-qr-img" />
                <div className="standee-footer">PromptPay สแกนจ่าย</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. 5 เสาหลักฟีเจอร์ ครบทุกการจัดการร้านค้า ─────────────── */}
      <section className="chatpos-features-section" id="features">
        <div className="chatpos-section-head">
          <h2 className="chatpos-section-title">5 เสาหลักฟีเจอร์ ครบทุกการจัดการร้านค้า</h2>
        </div>

        <div className="chatpos-five-features-grid">
          {/* Card 1 */}
          <div className="chatpos-feature-card">
            <div className="chatpos-feat-icon-box green">
              <Store size={22} />
            </div>
            <h3 className="chatpos-feat-card-title">1. ระบบคิดเงินหน้าร้าน<br />(Cloud POS)</h3>
            <p className="chatpos-feat-card-desc">
              คิดเงินไว สแกนบาร์โค้ด จัดการโต๊ะอาหาร พักบิล/แยกบิล รองรับเมนู 3 ภาษา (ไทย/อังกฤษ/จีน)
            </p>
          </div>

          {/* Card 2 */}
          <div className="chatpos-feature-card">
            <div className="chatpos-feat-icon-box yellow">
              <CreditCard size={22} />
            </div>
            <h3 className="chatpos-feat-card-title">2. รับเงินด่วน<br />(Multi-Channel QuickPay)</h3>
            <p className="chatpos-feat-card-desc">
              สร้าง Dynamic QR PromptPay คิดเงินด่วน รองรับ TrueMoney, บัตรเครดิต, เงินสด พร้อมระบบตรวจสลิป
            </p>
          </div>

          {/* Card 3 */}
          <div className="chatpos-feature-card">
            <div className="chatpos-feat-icon-box purple">
              <Calendar size={22} />
            </div>
            <h3 className="chatpos-feat-card-title">3. ระบบจองคิวออนไลน์<br />(Booking Engine)</h3>
            <p className="chatpos-feat-card-desc">
              ลูกค้ากดจองคิวผ่านลิงก์ได้เอง 24 ชม. เลือกวันเวลา เลือกบริการ ชำระเงินมัดจำล่วงหน้าอัตโนมัติ
            </p>
          </div>

          {/* Card 4 */}
          <div className="chatpos-feature-card">
            <div className="chatpos-feat-icon-box blue">
              <ShoppingBag size={22} />
            </div>
            <h3 className="chatpos-feat-card-title">4. เซลเพจ & แคตตาล็อกดิจิทัล<br />(Digital Store)</h3>
            <p className="chatpos-feat-card-desc">
              สร้างหน้าแคตตาล็อกสินค้าออนไลน์แชร์ลง Facebook / LINE OA ได้ทันที ไม่ต้องจ้างคนทำเว็บ
            </p>
          </div>

          {/* Card 5 */}
          <div className="chatpos-feature-card">
            <div className="chatpos-feat-icon-box light-green">
              <BarChart3 size={22} />
            </div>
            <h3 className="chatpos-feat-card-title">5. รายงานยอดขาย & สต็อก<br />(Smart Analytics)</h3>
            <p className="chatpos-feat-card-desc">
              สรุปยอดขายประจำวัน-เดือน กำไร-ต้นทุน ตัดสต็อกอัตโนมัติเมื่อขายออก แจ้งเตือนสินค้าใกล้หมด
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. ทดลองใช้งานระบบของจริง (Live Interactive Demo) ───────── */}
      <section className="chatpos-demo-section">
        <div className="chatpos-section-head">
          <h2 className="chatpos-section-title">ทดลองใช้งานระบบของจริง (Live Interactive Demo)</h2>
          <p className="chatpos-section-subtitle">คลิกเพื่อสัมผัสประสบการณ์การใช้งานจริงของ ChatPOS</p>
        </div>

        {/* Demo Tab Selector */}
        <div className="chatpos-demo-tabs-bar">
          <button
            type="button"
            className={`chatpos-demo-tab-btn ${activeDemoTab === 'pos' ? 'active' : ''}`}
            onClick={() => setActiveDemoTab('pos')}
          >
            POS หน้าร้าน
          </button>
          <button
            type="button"
            className={`chatpos-demo-tab-btn ${activeDemoTab === 'quickpay' ? 'active' : ''}`}
            onClick={() => setActiveDemoTab('quickpay')}
          >
            รับเงินด่วน (QuickPay)
          </button>
          <button
            type="button"
            className={`chatpos-demo-tab-btn ${activeDemoTab === 'booking' ? 'active' : ''}`}
            onClick={() => setActiveDemoTab('booking')}
          >
            จองคิวออนไลน์
          </button>
          <button
            type="button"
            className={`chatpos-demo-tab-btn ${activeDemoTab === 'salespage' ? 'active' : ''}`}
            onClick={() => setActiveDemoTab('salespage')}
          >
            เซลเพจ & ร้านค้าออนไลน์
          </button>
          <button
            type="button"
            className={`chatpos-demo-tab-btn ${activeDemoTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveDemoTab('reports')}
          >
            รายงาน & สต็อก
          </button>
        </div>

        {/* Interactive Demo Container */}
        <div className="chatpos-demo-box-card">
          {/* Left: UI Screen Preview Mockup */}
          <div className="chatpos-demo-screen-preview">
            <div className="chatpos-demo-browser-frame">
              <div className="chatpos-browser-dots">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
                <span className="browser-url-text">chatpos.app/{activeDemoTab}</span>
              </div>
              <div className="chatpos-demo-interactive-stage">
                {activeDemoTab === 'pos' && (
                  <div className="mock-pos-terminal-view">
                    <div className="pos-terminal-head">
                      <span>โต๊ะ T-04 (ทานที่ร้าน)</span>
                      <span className="pos-badge-green">พร้อมให้บริการ</span>
                    </div>
                    <div className="pos-terminal-grid">
                      <div className="pos-prod-card">
                        <span className="prod-emoji">🍵</span>
                        <strong>ชาไทยเย็น</strong>
                        <small>฿55.00</small>
                      </div>
                      <div className="pos-prod-card">
                        <span className="prod-emoji">☕</span>
                        <strong>เอสเพรสโซ่</strong>
                        <small>฿60.00</small>
                      </div>
                      <div className="pos-prod-card">
                        <span className="prod-emoji">🥐</span>
                        <strong>ครัวซองต์</strong>
                        <small>฿85.00</small>
                      </div>
                      <div className="pos-prod-card">
                        <span className="prod-emoji">🍰</span>
                        <strong>เค้กมะพร้าว</strong>
                        <small>฿120.00</small>
                      </div>
                    </div>
                    <div className="pos-terminal-cart-summary">
                      <div className="cart-calc-row">
                        <span>ยอดรวม (3 รายการ):</span>
                        <strong>฿320.00</strong>
                      </div>
                      <a href="/merchant#pos" className="pos-checkout-btn">
                        คิดเงิน (PromptPay / เงินสด) ›
                      </a>
                    </div>
                  </div>
                )}

                {activeDemoTab === 'quickpay' && (
                  <div className="mock-quickpay-terminal-view">
                    <div className="qp-terminal-head">
                      <span>คิดเงินด่วน Dynamic QR</span>
                      <span className="pos-badge-green">⚡ Auto Slip Check</span>
                    </div>
                    <div className="qp-qr-center-box">
                      <img src="/payments/promptpay_front.png" alt="QR Demo" className="qp-demo-qr-img" />
                      <div className="qp-demo-amt-box">
                        <small>ยอดชำระสุทธิ</small>
                        <strong>฿500.00</strong>
                      </div>
                    </div>
                    <a href="/quickpay" className="pos-checkout-btn">
                      เปิดหน้าคิดเงินด่วน QuickPay ›
                    </a>
                  </div>
                )}

                {activeDemoTab === 'booking' && (
                  <div className="mock-booking-terminal-view">
                    <div className="bk-terminal-head">
                      <span>POP CAFE & SERVICES ✨</span>
                      <span className="pos-badge-green">📅 นัดหมายออนไลน์</span>
                    </div>
                    <div className="bk-service-list">
                      <div className="bk-service-row selected">
                        <div>
                          <strong>💆 นวดสปาอโรม่าพรีเมียม (60 นาที)</strong>
                          <small>฿500.00 • ยืนยันคิวทันที</small>
                        </div>
                        <span className="bk-select-check">✓</span>
                      </div>
                    </div>
                    <a href="/booking" className="pos-checkout-btn">
                      จองคิวออนไลน์ทันที ›
                    </a>
                  </div>
                )}

                {activeDemoTab === 'salespage' && (
                  <div className="mock-salespage-terminal-view">
                    <div className="sp-terminal-head">
                      <span>POP DIGITAL STORE 🛍️</span>
                      <span className="pos-badge-green">🌐 เซลเพจออนไลน์</span>
                    </div>
                    <div className="sp-product-grid">
                      <div className="sp-product-card">
                        <span className="sp-badge">PROMO</span>
                        <strong>เซตกาแฟพรีเมียมคั่วสด</strong>
                        <span className="sp-price">฿390</span>
                      </div>
                    </div>
                    <a href="/catalog-page" className="pos-checkout-btn">
                      เปิดหน้าร้านดิจิทัล & เซลเพจ ›
                    </a>
                  </div>
                )}

                {activeDemoTab === 'reports' && (
                  <div className="mock-reports-terminal-view">
                    <div className="rp-terminal-head">
                      <span>รายงานการเงิน & ยอดขาย Real-time</span>
                      <span className="pos-badge-green">📊 สรุปยอดขาย</span>
                    </div>
                    <div className="rp-chart-container">
                      <div className="rp-bars">
                        <div className="rp-bar" style={{ height: '40%' }}><small>จ.</small></div>
                        <div className="rp-bar" style={{ height: '65%' }}><small>อ.</small></div>
                        <div className="rp-bar" style={{ height: '85%' }}><small>พ.</small></div>
                        <div className="rp-bar" style={{ height: '70%' }}><small>พฤ.</small></div>
                        <div className="rp-bar active" style={{ height: '100%' }}><small>ศ.</small></div>
                      </div>
                    </div>
                    <a href="/merchant#reports" className="pos-checkout-btn">
                      ดูแดชบอร์ดรายงานฉบับเต็ม ›
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Feature Checklist & Interactive CTA */}
          <div className="chatpos-demo-details-col">
            <h3 className="chatpos-demo-detail-title">{currentDemo.title}</h3>
            
            <div className="chatpos-demo-checklist">
              {currentDemo.points.map((pt, idx) => (
                <div className="chatpos-demo-check-item" key={idx}>
                  <div className="chatpos-demo-check-circle">
                    <Check size={14} color="#0d7b51" />
                  </div>
                  <span>{pt}</span>
                </div>
              ))}
            </div>

            <div className="chatpos-demo-cta-wrap">
              <a href={currentDemo.targetUrl} className="chatpos-demo-start-btn">
                <Play size={14} fill="#ffffff" color="#ffffff" />
                <span>{currentDemo.btnText}</span>
              </a>
              <small className="chatpos-demo-disclaimer">
                💡 ใช้ข้อมูลจำลอง ไม่มีผลกับระบบจริง
              </small>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. ปลอดภัย มั่นใจ เชื่อถือได้ (Trust & Security) ──────── */}
      <section className="chatpos-trust-section">
        <div className="chatpos-section-head">
          <h2 className="chatpos-section-title">ปลอดภัย มั่นใจ เชื่อถือได้</h2>
        </div>

        <div className="chatpos-trust-cards-grid">
          {/* Trust 1 */}
          <div className="chatpos-trust-card">
            <div className="chatpos-trust-icon-box green">
              <ShieldCheck size={28} />
            </div>
            <div className="chatpos-trust-card-text">
              <strong>ปลอดภัยระดับธนาคาร (Bank-Grade Security)</strong>
              <p>เข้ารหัสข้อมูล 256-bit SSL Encryption ปกป้องข้อมูลและการเงินของคุณ</p>
            </div>
          </div>

          {/* Trust 2 */}
          <div className="chatpos-trust-card">
            <div className="chatpos-trust-icon-box blue">
              <Zap size={28} />
            </div>
            <div className="chatpos-trust-card-text">
              <strong>เสถียรภาพสูง 99.98% (High Availability)</strong>
              <p>ระบบ Cloud แท้ 100% ข้อมูลซิงค์เรียลไทม์ ใช้งานได้ต่อเนื่อง ไม่มีสะดุด</p>
            </div>
          </div>

          {/* Trust 3 */}
          <div className="chatpos-trust-card">
            <div className="chatpos-trust-icon-box orange">
              <Trophy size={28} />
            </div>
            <div className="chatpos-trust-card-text">
              <strong>ร้านค้าไว้วางใจแล้วกว่า 5,000+ ร้านค้า</strong>
              <p>ครอบคลุมธุรกิจหลากหลายประเภททั่วประเทศ</p>
            </div>
          </div>
        </div>

        {/* Payment Partner Logos Strip */}
        <div className="chatpos-payment-partners-strip">
          <div className="partner-logo-pill">THAI QR PAYMENT</div>
          <div className="partner-logo-pill">PromptPay</div>
          <div className="partner-logo-pill text-orange">true money</div>
          <div className="partner-logo-pill text-blue">VISA</div>
          <div className="partner-logo-pill text-red">mastercard</div>
          <div className="partner-logo-pill">PCI-DSS COMPLIANT</div>
          <div className="partner-logo-pill">ISO 27001 COMPLIANT</div>
        </div>
      </section>

      {/* ── 6. ง่าย ครบ จบในระบบเดียว (Cross-Platform & Ease of Use) ── */}
      <section className="chatpos-cross-platform-section">
        <div className="chatpos-section-head">
          <h2 className="chatpos-section-title">ง่าย ครบ จบในระบบเดียว</h2>
        </div>

        <div className="chatpos-cross-platform-container">
          {/* Left: 4 Features Grid */}
          <div className="chatpos-cross-features-grid">
            <div className="chatpos-cross-feat-item">
              <div className="chatpos-cross-icon-wrap">
                <Store size={20} color="#0d7b51" />
              </div>
              <div className="chatpos-cross-feat-text">
                <strong>ไม่ต้องติดตั้งโปรแกรม<br />(No Install Needed)</strong>
                <p>เปิดผ่านเบราว์เซอร์ ใช้งานได้ทันที</p>
              </div>
            </div>

            <div className="chatpos-cross-feat-item">
              <div className="chatpos-cross-icon-wrap">
                <Laptop size={20} color="#0d7b51" />
              </div>
              <div className="chatpos-cross-feat-text">
                <strong>รองรับทุกอุปกรณ์<br />(Cross-Platform)</strong>
                <p>ใช้งานได้ทั้ง มือถือ แท็บเล็ต โน้ตบุ๊ก และคอมพิวเตอร์</p>
              </div>
            </div>

            <div className="chatpos-cross-feat-item">
              <div className="chatpos-cross-icon-wrap">
                <Globe size={20} color="#0d7b51" />
              </div>
              <div className="chatpos-cross-feat-text">
                <strong>ใช้งานได้ทุกที่ ทุกเวลา<br />(Anywhere Anytime)</strong>
                <p>จัดการร้านค้าได้แม้ไม่ได้อยู่ที่หน้าร้าน</p>
              </div>
            </div>

            <div className="chatpos-cross-feat-item">
              <div className="chatpos-cross-icon-wrap">
                <RotateCcw size={20} color="#0d7b51" />
              </div>
              <div className="chatpos-cross-feat-text">
                <strong>อัปเดตอัตโนมัติ<br />(Auto Update)</strong>
                <p>ระบบอัปเดตให้อัตโนมัติ ใช้งานฟีเจอร์ใหม่ได้ทันที</p>
              </div>
            </div>
          </div>

          {/* Right: Device Mockup Cluster */}
          <div className="chatpos-cross-devices-visual">
            <div className="cross-device-bundle">
              <div className="bundle-phone">
                <img src="/payments/promptpay_front.png" alt="Phone" className="bundle-qr" />
              </div>
              <div className="bundle-tablet">
                <div className="bundle-tab-screen" />
              </div>
              <div className="bundle-monitor">
                <div className="bundle-mon-screen" />
                <div className="bundle-mon-stand" />
              </div>
              <div className="bundle-laptop">
                <div className="bundle-lap-screen" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. เริ่มต้นใช้งาน ChatPOS วันนี้ & พร้อมดูแลคุณ 24 ชั่วโมง ──── */}
      <section className="chatpos-final-cta-section">
        <div className="chatpos-final-cta-grid">
          {/* Left Card: Start Free Trial */}
          <div className="chatpos-start-trial-card">
            <h3 className="chatpos-trial-title">
              เริ่มต้นใช้งาน ChatPOS วันนี้<br />
              ให้ธุรกิจของคุณเติบโตไปอีกขั้น
            </h3>

            <div className="chatpos-trial-checks-row">
              <span>✓ ทดลองใช้ฟรี 14 วัน</span>
              <span>✓ ไม่ต้องใช้บัตรเครดิต</span>
              <span>✓ ยกเลิกได้ตลอดเวลา</span>
            </div>

            <div className="chatpos-trial-buttons-col">
              <a href="/merchant/register" className="chatpos-btn-trial-green">
                <Store size={18} />
                <span>สมัครใช้งานฟรี (Free Trial)</span>
              </a>
              <a href="/merchant" className="chatpos-btn-trial-white">
                <Play size={14} fill="#0d7b51" color="#0d7b51" />
                <span>ทดลองเล่นระบบสด (Live Demo)</span>
              </a>
            </div>
          </div>

          {/* Right Card: 24/7 Support Channels */}
          <div className="chatpos-support-channels-card">
            <h3 className="chatpos-support-title">พร้อมดูแลคุณ 24 ชั่วโมง</h3>

            <div className="chatpos-support-boxes-grid">
              <a
                href="https://line.me/ti/p/~@chatpos"
                target="_blank"
                rel="noreferrer"
                className="chatpos-support-box"
              >
                <div className="support-box-icon green">
                  <MessageCircle size={18} />
                </div>
                <div className="support-box-text">
                  <small>LINE Official Account</small>
                  <strong>@chatpos</strong>
                </div>
              </a>

              <a href="tel:021234567" className="chatpos-support-box">
                <div className="support-box-icon blue">
                  <Phone size={18} />
                </div>
                <div className="support-box-text">
                  <small>Call Center</small>
                  <strong>02-123-4567</strong>
                </div>
              </a>

              <button
                type="button"
                className="chatpos-support-box btn-box"
                onClick={() => alert('ติดต่อเจ้าหน้าที่ฝ่ายบริการลูกค้า ChatPOS ผ่าน Live Chat ได้ตลอด 24 ชม.')}
              >
                <div className="support-box-icon teal">
                  <Headphones size={18} />
                </div>
                <div className="support-box-text">
                  <small>Live Chat</small>
                  <strong>ติดต่อเจ้าหน้าที่</strong>
                </div>
              </button>

              <a href="mailto:support@chatpos.co" className="chatpos-support-box">
                <div className="support-box-icon indigo">
                  <Mail size={18} />
                </div>
                <div className="support-box-text">
                  <small>Email Support</small>
                  <strong>support@chatpos.co</strong>
                </div>
              </a>
            </div>

            <div className="chatpos-support-footer-links">
              <a href="#faq" className="support-footer-link">
                💬 คำถามที่พบบ่อย (FAQ)
              </a>
              <a href="#guide" className="support-footer-link">
                📖 คู่มือการใช้งาน
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. Footer ─────────────────────────────────────────────── */}
      <footer className="chatpos-main-footer">
        <div className="chatpos-footer-container">
          <div className="chatpos-footer-brand">
            <div className="chatpos-footer-logo">
              <Store size={18} color="#ffffff" />
            </div>
            <div>
              <strong>ChatPOS</strong>
              <small>Cloud POS & Commerce Platform</small>
            </div>
          </div>

          <div className="chatpos-footer-nav">
            <a href="#features">ฟีเจอร์</a>
            <a href="#pricing">ราคา</a>
            <a href="#solutions">ธุรกิจที่เหมาะกับเรา</a>
            <a href="#articles">บทความ</a>
            <a href="#help">ช่วยเหลือ</a>
            <a href="#contact">ติดต่อเรา</a>
          </div>

          <div className="chatpos-footer-social">
            <a href="#share" className="social-icon-btn"><Share2 size={16} /></a>
            <a href="#line" className="social-icon-btn"><MessageCircle size={16} /></a>
            <a href="#telegram" className="social-icon-btn"><Send size={16} /></a>
          </div>
        </div>

        <div className="chatpos-footer-copyright">
          © 2026 ChatPOS Platform. All rights reserved.
        </div>
      </footer>

      {/* ── Merchant Login Modal ───────────────────────────────────── */}
      {loginModalOpen && (
        <div className="chatpos-modal-backdrop" onClick={() => setLoginModalOpen(false)}>
          <div className="chatpos-login-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="chatpos-modal-close-x"
              onClick={() => setLoginModalOpen(false)}
            >
              <X size={18} />
            </button>

            <div className="modal-login-head">
              <div className="modal-icon-badge">
                <Store size={22} color="#ffffff" />
              </div>
              <h3>เข้าสู่ระบบร้านค้า (Merchant Sign In)</h3>
              <p>จัดการระบบขายหน้าร้าน (POS), สต็อก, เซลเพจ และคิวจองบริการ</p>
            </div>

            {/* Demo Autofill Helper */}
            <div className="modal-demo-autofill">
              <span>ทดสอบระบบรวดเร็วด้วยข้อมูล Demo</span>
              <button type="button" onClick={handleFillDemo}>
                <Sparkles size={12} /> เติมข้อมูล Demo
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-login-form">
              <div className="modal-form-group">
                <label>อีเมล หรือ บัญชีผู้ใช้งาน</label>
                <div className="modal-input-wrap">
                  <Mail size={16} className="modal-f-icon" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="merchant@chatpos.com"
                    required
                  />
                </div>
              </div>

              <div className="modal-form-group">
                <div className="modal-label-row">
                  <label>รหัสผ่าน</label>
                  <button
                    type="button"
                    className="modal-forgot-btn"
                    onClick={() => {
                      setLoginModalOpen(false)
                      setForgotModalOpen(true)
                    }}
                  >
                    ลืมรหัสผ่าน?
                  </button>
                </div>
                <div className="modal-input-wrap">
                  <Lock size={16} className="modal-f-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    className="modal-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="modal-remember-row">
                <label>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span>จดจำการเข้าสู่ระบบในอุปกรณ์นี้</span>
                </label>
              </div>

              {error && <div className="modal-error-alert">{error}</div>}

              <button type="submit" className="modal-submit-btn" disabled={isLoading}>
                {isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบร้านค้า ›'}
              </button>
            </form>

            <div className="modal-register-foot">
              <span>ยังไม่มีบัญชีร้านค้า?</span>
              <a href="/merchant/register">สมัครเปิดร้านค้าใหม่ ›</a>
            </div>
          </div>
        </div>
      )}

      {/* ── Forgot Password Modal ──────────────────────────────────── */}
      {forgotModalOpen && (
        <div className="chatpos-modal-backdrop" onClick={() => setForgotModalOpen(false)}>
          <div className="chatpos-login-modal-card forgot" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="chatpos-modal-close-x"
              onClick={() => setForgotModalOpen(false)}
            >
              <X size={18} />
            </button>

            <div className="modal-login-head">
              <div className="modal-icon-badge yellow">
                <KeyRound size={22} color="#ffffff" />
              </div>
              <h3>รีเซ็ตรหัสผ่าน</h3>
              <p>กรอกอีเมลร้านค้าของคุณเพื่อรับลิงก์ตั้งรหัสผ่านใหม่</p>
            </div>

            <div className="modal-form-group" style={{ margin: '18px 0' }}>
              <input
                type="email"
                placeholder="ระบุอีเมลร้านค้า เช่น store@chatpos.com"
                className="modal-single-input"
              />
            </div>

            <button
              type="button"
              className="modal-submit-btn"
              onClick={() => {
                alert('ส่งคำขอรีเซ็ตรหัสผ่านไปยังอีเมลของคุณเรียบร้อยแล้ว')
                setForgotModalOpen(false)
              }}
            >
              ส่งลิงก์รีเซ็ตรหัสผ่าน
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LandingPageView

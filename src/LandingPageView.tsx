import { useState } from 'react'
import {
  ArrowRight,
  Play,
  ShieldCheck,
  Globe,
  Zap,
  Tag,
  Database,
  Users,
  Store,
  Building2,
  Code2,
  ChevronRight,
  X,
  CreditCard,
  QrCode,
  Headphones,
  Award,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Activity,
} from 'lucide-react'
import './LandingPageView.css'

export function LandingPageView() {
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [demoModalOpen, setDemoModalOpen] = useState(false)
  const [activeSolutionsMenu, setActiveSolutionsMenu] = useState(false)
  const [demoTab, setDemoTab] = useState<'pos' | 'qr' | 'ledger'>('pos')

  const playTapSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, audioCtx.currentTime)
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.08)
    } catch {}
  }

  return (
    <div className="lp-page">
      {/* ── 1. Top Navigation Bar ────────────────────────────────────────── */}
      <header className="lp-header">
        <div className="lp-nav-container">
          {/* Brand Logo */}
          <a href="/" className="lp-logo" onClick={() => playTapSound()}>
            <img src="/logo.png" alt="ChatPOS Logo" className="lp-logo-image" />
          </a>

          {/* Center Navigation Links */}
          <nav className="lp-nav-links">
            <a href="#features" className="lp-nav-item">ฟีเจอร์</a>
            
            <div 
              className="lp-nav-dropdown-wrap"
              onMouseEnter={() => setActiveSolutionsMenu(true)}
              onMouseLeave={() => setActiveSolutionsMenu(false)}
            >
              <button type="button" className="lp-nav-item lp-nav-dropdown-btn">
                ระบบสำหรับคุณ <ChevronDown size={14} />
              </button>
              {activeSolutionsMenu && (
                <div className="lp-nav-dropdown-menu">
                  <a href="/merchant" className="lp-dropdown-item">
                    <div className="lp-dropdown-icon orange"><Store size={16} /></div>
                    <div>
                      <strong>ร้านค้า (Merchant)</strong>
                      <span>ระบบ POS, สต็อก และรับเงิน</span>
                    </div>
                  </a>
                  <a href="/agent/login" className="lp-dropdown-item">
                    <div className="lp-dropdown-icon green"><Users size={16} /></div>
                    <div>
                      <strong>ตัวแทน (Agent)</strong>
                      <span>สร้างเครือข่าย รับคอมมิชชัน</span>
                    </div>
                  </a>
                  <a href="/pd/login" className="lp-dropdown-item">
                    <div className="lp-dropdown-icon blue"><Building2 size={16} /></div>
                    <div>
                      <strong>ผู้บริหารเขต (PD)</strong>
                      <span>กำกับดูแลพื้นที่ & Sign-off</span>
                    </div>
                  </a>
                  <a href="/login" className="lp-dropdown-item">
                    <div className="lp-dropdown-icon purple"><Award size={16} /></div>
                    <div>
                      <strong>ศูนย์กลาง (Admin HQ)</strong>
                      <span>มอนิเตอร์และอนุมัติการเงิน</span>
                    </div>
                  </a>
                </div>
              )}
            </div>

            <a href="#pricing" className="lp-nav-item">ราคา</a>
            <a href="/developer" className="lp-nav-item">นักพัฒนา</a>
            <a href="#about" className="lp-nav-item">เกี่ยวกับเรา</a>
            <a href="#contact" className="lp-nav-item">ติดต่อเรา</a>
          </nav>

          {/* Right Action Buttons */}
          <div className="lp-nav-actions">
            <button 
              type="button" 
              className="lp-btn-login"
              onClick={() => { playTapSound(); setLoginModalOpen(true) }}
            >
              เข้าสู่ระบบ
            </button>
            <a 
              href="/merchant/register" 
              className="lp-btn-trial"
              onClick={() => playTapSound()}
            >
              ทดลองใช้ฟรี
            </a>
          </div>
        </div>
      </header>

      {/* ── 2. Hero Section ──────────────────────────────────────────────── */}
      <section className="lp-hero-section">
        <div className="lp-hero-container">
          {/* Left Column: Text & CTAs */}
          <div className="lp-hero-content">
            {/* All-in-One Badge */}
            <div className="lp-pill-badge">
              <span className="lp-pill-dot" />
              <span>All-in-One Smart POS & Multi-Channel Payment Hub</span>
            </div>

            {/* Main Headline */}
            <h1 className="lp-hero-title">
              ระบบจัดการร้านค้าและ<br />
              <span className="lp-title-gradient">การชำระเงินอัจฉริยะ</span><br />
              ครบจบในที่เดียว
            </h1>

            {/* Subtitle */}
            <p className="lp-hero-desc">
              ChatPOS ช่วยให้ธุรกิจของคุณขายง่าย รับเงินไว บริหารจัดการได้ทุกที่ 
              รองรับหน้าร้าน, ขายผ่านแชท, เครือข่ายตัวแทน และเชื่อมต่อผ่าน API
            </p>

            {/* CTA Button Group */}
            <div className="lp-hero-cta-group">
              <a href="/merchant/register" className="lp-hero-btn-primary" onClick={() => playTapSound()}>
                <span>เริ่มต้นใช้งานฟรี</span>
                <ArrowRight size={17} />
              </a>
              <button 
                type="button" 
                className="lp-hero-btn-secondary"
                onClick={() => { playTapSound(); setDemoModalOpen(true) }}
              >
                <div className="lp-play-icon-wrap">
                  <Play size={13} fill="#4f46e5" />
                </div>
                <span>ดูวิดีโอแนะนำ</span>
              </button>
            </div>

            {/* Value Props Row */}
            <div className="lp-hero-props-row">
              <div className="lp-prop-item">
                <div className="lp-prop-icon green">
                  <Zap size={15} />
                </div>
                <div>
                  <strong>ติดตั้งง่าย</strong>
                  <span>ใช้งานได้ทันที</span>
                </div>
              </div>

              <div className="lp-prop-item">
                <div className="lp-prop-icon blue">
                  <ShieldCheck size={15} />
                </div>
                <div>
                  <strong>ปลอดภัย มาตรฐานการเงิน</strong>
                  <span>KYC & Anti-Fraud</span>
                </div>
              </div>

              <div className="lp-prop-item">
                <div className="lp-prop-icon purple">
                  <Globe size={15} />
                </div>
                <div>
                  <strong>ซัพพอร์ต 3 ภาษา</strong>
                  <span>ไทย • English • 中文</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Device Showcase */}
          <div className="lp-hero-visual">
            <div className="lp-device-stage">
              {/* Decorative Ambient Glow Orbs */}
              <div className="lp-hero-glow-1" />
              <div className="lp-hero-glow-2" />

              {/* 1. Laptop Showcase Container (Merchant POS Dashboard) */}
              <div className="lp-laptop-mockup">
                <div className="lp-laptop-screen">
                  {/* Laptop Top Bar */}
                  <div className="lp-laptop-topbar">
                    <div className="lp-window-dots">
                      <span className="dot red" />
                      <span className="dot yellow" />
                      <span className="dot green" />
                    </div>
                    <div className="lp-laptop-brand">
                      <Sparkles size={11} color="#6366f1" /> ChatPOS Merchant Hub
                    </div>
                    <div className="lp-laptop-status">
                      <span className="live-dot" /> ออนไลน์
                    </div>
                  </div>

                  {/* Dashboard Content Mockup */}
                  <div className="lp-laptop-body">
                    {/* Left Mini Sidebar */}
                    <div className="lp-laptop-side">
                      <div className="lp-side-icon active"><Store size={13} /></div>
                      <div className="lp-side-icon"><CreditCard size={13} /></div>
                      <div className="lp-side-icon"><Tag size={13} /></div>
                      <div className="lp-side-icon"><Activity size={13} /></div>
                    </div>

                    {/* Main POS Stats Screen */}
                    <div className="lp-laptop-main">
                      <div className="lp-dash-header-row">
                        <div>
                          <small>ยอดขายวันนี้</small>
                          <strong>฿ 128,450.00 <span className="green-tag">+12.5%</span></strong>
                        </div>
                        <div className="lp-dash-date-pill">15 ส.ค. 2026</div>
                      </div>

                      {/* Mini Chart Mockup */}
                      <div className="lp-dash-chart-mock">
                        <div className="lp-chart-curve" />
                      </div>

                      {/* Recent Orders List */}
                      <div className="lp-dash-orders-box">
                        <div className="lp-dash-orders-title">รายการล่าสุด</div>
                        <div className="lp-dash-order-row">
                          <span>☕ ชาไทยพรีเมียม (x2)</span>
                          <strong>฿150.00 <small className="paid">สำเร็จ</small></strong>
                        </div>
                        <div className="lp-dash-order-row">
                          <span>💆 นวดสปาอโรม่า 60 นาที</span>
                          <strong>฿850.00 <small className="paid">สำเร็จ</small></strong>
                        </div>
                        <div className="lp-dash-order-row">
                          <span>🍰 เค้กมะพร้าวอ่อน</span>
                          <strong>฿120.00 <small className="paid">สำเร็จ</small></strong>
                        </div>
                      </div>
                    </div>

                    {/* Right Payment Channels Widget */}
                    <div className="lp-laptop-right-panel">
                      <div className="lp-mini-panel-head">ช่องทางชำระเงิน</div>
                      <div className="lp-mini-pay-row active">
                        <span className="pay-tag pp">PromptPay</span>
                        <span>›</span>
                      </div>
                      <div className="lp-mini-pay-row">
                        <span className="pay-tag tm">TrueMoney</span>
                        <span>›</span>
                      </div>
                      <div className="lp-mini-pay-row">
                        <span className="pay-tag ap">Alipay</span>
                        <span>›</span>
                      </div>
                      <div className="lp-mini-pay-row">
                        <span className="pay-tag wc">WeChat Pay</span>
                        <span>›</span>
                      </div>
                      <div className="lp-mini-pay-row">
                        <span className="pay-tag card">บัตรเครดิต/เดบิต</span>
                        <span>›</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="lp-laptop-base" />
              </div>

              {/* 2. Floating Smartphone Mockup (Dynamic QR Code Payment) */}
              <div className="lp-phone-mockup">
                <div className="lp-phone-notch" />
                <div className="lp-phone-screen">
                  <div className="lp-phone-header">
                    <Sparkles size={12} color="#4f46e5" />
                    <span>ChatPOS</span>
                  </div>
                  <div className="lp-phone-amount-box">
                    <small>ชำระเงิน</small>
                    <h3>THB 2,450.00</h3>
                  </div>
                  {/* Dynamic QR Code Screen */}
                  <div className="lp-phone-qr-frame">
                    <img 
                      src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https://chatpos.biz/pay/demo" 
                      alt="PromptPay QR Code" 
                      className="lp-phone-qr-img"
                    />
                    <div className="lp-phone-qr-logo">
                      <QrCode size={14} color="#003d79" />
                    </div>
                  </div>
                  <div className="lp-phone-timer-bar">
                    <small>สแกนเพื่อชำระเงิน</small>
                    <strong>09:59</strong>
                  </div>
                  <div className="lp-phone-channels-strip">
                    <span className="dot pp">PP</span>
                    <span className="dot tm">TM</span>
                    <span className="dot wc">WC</span>
                    <span className="dot ap">AL</span>
                    <span className="dot card">VS</span>
                  </div>
                </div>
              </div>

              {/* 3. Floating POS Thermal Printer Mockup with Printed Receipt */}
              <div className="lp-printer-mockup">
                <div className="lp-printer-body">
                  <div className="lp-printer-slot" />
                  <div className="lp-printer-light" />
                </div>
                {/* Paper Receipt Sliding Out */}
                <div className="lp-receipt-paper">
                  <div className="lp-receipt-header">
                    <Sparkles size={10} color="#4f46e5" />
                    <strong>ChatPOS</strong>
                  </div>
                  <div className="lp-receipt-divider" />
                  <div className="lp-receipt-row">
                    <span>ยอดรวม</span>
                    <strong>2,450.00</strong>
                  </div>
                  <div className="lp-receipt-row">
                    <span>ส่วนลด</span>
                    <span>-0.00</span>
                  </div>
                  <div className="lp-receipt-row total">
                    <span>สุทธิ</span>
                    <strong>2,450</strong>
                  </div>
                  <div className="lp-receipt-qr">
                    <QrCode size={30} color="#0f172a" />
                  </div>
                  <small className="lp-receipt-foot">ขอบคุณที่ใช้บริการ</small>
                </div>
              </div>

              {/* ChatPOS Mascot Peek */}
              <img 
                src="/mascot/nabtang_welcome.png" 
                alt="ChatPOS Mascot" 
                className="lp-hero-mascot-peek"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Supported Payment Channels Marquee ────────────────────────── */}
      <section className="lp-payment-marquee-section">
        <div className="lp-marquee-container">
          <span className="lp-marquee-label">รองรับทุกช่องทางการชำระเงิน</span>
          <div className="lp-marquee-logos">
            {/* PromptPay */}
            <div className="lp-channel-chip pp">
              <span className="chip-logo-txt pp">PromptPay</span>
            </div>
            {/* TrueMoney */}
            <div className="lp-channel-chip tm">
              <span className="chip-logo-txt tm">truemoney</span>
            </div>
            {/* PromptPay Any ID */}
            <div className="lp-channel-chip anyid">
              <span className="chip-logo-txt anyid">PromptPay Any ID</span>
            </div>
            {/* WeChat Pay */}
            <div className="lp-channel-chip wc">
              <span className="chip-badge-icon wc">微信支付</span>
              <span className="chip-logo-txt wc">WeChat Pay</span>
            </div>
            {/* Alipay */}
            <div className="lp-channel-chip ap">
              <span className="chip-badge-icon ap">支</span>
              <span className="chip-logo-txt ap">ALIPAY</span>
            </div>
            {/* VISA */}
            <div className="lp-channel-chip visa">
              <span className="chip-logo-txt visa">VISA</span>
            </div>
            {/* Mastercard */}
            <div className="lp-channel-chip mc">
              <div className="mc-circles">
                <span className="mc-c red" />
                <span className="mc-c orange" />
              </div>
              <span className="chip-logo-txt mc">mastercard</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Why ChatPOS? (5 Value Cards) ─────────────────────────────── */}
      <section className="lp-why-section" id="features">
        <div className="lp-section-container">
          <div className="lp-section-header">
            <h2>ทำไมต้อง <span className="lp-text-brand">ChatPOS</span>?</h2>
            <p>ยกระดับธุรกิจของคุณด้วยเทคโนโลยีการชำระเงินและจัดการร้านค้าที่ตอบโจทย์ยุคดิจิทัล</p>
          </div>

          <div className="lp-why-grid">
            {/* 1. Smart Payment */}
            <article className="lp-why-card">
              <div className="lp-why-icon-wrap purple">
                <QrCode size={24} />
              </div>
              <h3>รับเงินอัจฉริยะ</h3>
              <p>QR Dynamic อัตโนมัติทุกช่องทาง ตรวจจับสลิปไว แม่นยำ ไม่ต้องรอยืนยันยอด</p>
            </article>

            {/* 2. 3 Languages */}
            <article className="lp-why-card">
              <div className="lp-why-icon-wrap blue">
                <Globe size={24} />
              </div>
              <h3>รองรับ 3 ภาษา</h3>
              <p>ระบบ 3 ภาษาเต็มรูปแบบ ไทย • English • 中文 รองรับนักท่องเที่ยวและต่างชาติ</p>
            </article>

            {/* 3. Flexible Categories */}
            <article className="lp-why-card">
              <div className="lp-why-icon-wrap pink">
                <Tag size={24} />
              </div>
              <h3>หมวดหมู่ยืดหยุ่น</h3>
              <p>สร้างหมวดหมู่สินค้า/บริการได้เอง จัดการง่าย ค้นหาสินค้าเร็ว เพิ่มได้ไม่จำกัด</p>
            </article>

            {/* 4. Real-time Ledger */}
            <article className="lp-why-card">
              <div className="lp-why-icon-wrap amber">
                <Database size={24} />
              </div>
              <h3>Real-time Ledger</h3>
              <p>บันทึกธุรกรรมแบบ Real-time ด้วย PostgreSQL ปลอดภัย บัญชีแม่นยำ ไม่สูญหาย</p>
            </article>

            {/* 5. Safe & Verified */}
            <article className="lp-why-card">
              <div className="lp-why-icon-wrap green">
                <ShieldCheck size={24} />
              </div>
              <h3>ปลอดภัย มั่นใจ</h3>
              <p>KYC หลายขั้นตอน มาตรฐานสถาบันการเงิน ป้องกันการทุจริตและการฟอกเงิน</p>
            </article>
          </div>
        </div>
      </section>

      {/* ── 5. Ecosystem & Roles Interactive Flow ───────────────────────── */}
      <section className="lp-ecosystem-section" id="solutions">
        <div className="lp-section-container">
          <div className="lp-section-header">
            <h2>ระบบนิเวศของ <span className="lp-text-brand">ChatPOS</span></h2>
            <p>รองรับทุกบทบาทในธุรกิจของคุณ ตั้งแต่ระดับปฏิบัติการจนถึงศูนย์บริหาร</p>
          </div>

          <div className="lp-eco-flow-wrap">
            {/* Row of 5 Main Business Roles */}
            <div className="lp-eco-cards-row">
              {/* 1. Admin HQ */}
              <div className="lp-eco-card purple">
                <div className="lp-eco-card-head">
                  <Award size={20} />
                  <div>
                    <strong>Admin HQ</strong>
                    <small>ศูนย์บริหารส่วนกลาง</small>
                  </div>
                </div>
                <ul className="lp-eco-list">
                  <li>• อนุมัติ KYC ขั้นสุดท้าย</li>
                  <li>• มอนิเตอร์ระบบ & Anti-Fraud</li>
                  <li>• จัดการการเงิน & Withdrawals</li>
                  <li>• ตรวจสอบความปลอดภัยระบบ</li>
                </ul>
              </div>

              <div className="lp-eco-arrow">→</div>

              {/* 2. PD */}
              <div className="lp-eco-card blue">
                <div className="lp-eco-card-head">
                  <Building2 size={20} />
                  <div>
                    <strong>PD</strong>
                    <small>Provincial Director</small>
                  </div>
                </div>
                <ul className="lp-eco-list">
                  <li>• บริหารทีม Agent</li>
                  <li>• อนุมัติ KYC ในเขตพื้นที่</li>
                  <li>• รับ PD Royalty</li>
                  <li>• ติดตามยอดขายในเขต</li>
                </ul>
              </div>

              <div className="lp-eco-arrow">→</div>

              {/* 3. Agent */}
              <div className="lp-eco-card green">
                <div className="lp-eco-card-head">
                  <Users size={20} />
                  <div>
                    <strong>Agent</strong>
                    <small>ตัวแทนขยายร้านค้า</small>
                  </div>
                </div>
                <ul className="lp-eco-list">
                  <li>• แนะนำร้านค้าใหม่</li>
                  <li>• ติดตาม KYC ร้านค้า</li>
                  <li>• รับคอมมิชชัน Real-time</li>
                  <li>• ถอนเงินค่าคอมฯ เข้าบัญชี</li>
                </ul>
              </div>

              <div className="lp-eco-arrow">→</div>

              {/* 4. Merchant */}
              <div className="lp-eco-card orange">
                <div className="lp-eco-card-head">
                  <Store size={20} />
                  <div>
                    <strong>Merchant</strong>
                    <small>เจ้าของร้านค้า</small>
                  </div>
                </div>
                <ul className="lp-eco-list">
                  <li>• ระบบ POS & ออกใบเสร็จ</li>
                  <li>• จัดการสินค้า & คลัง</li>
                  <li>• รับชำระเงิน & รายงานยอดขาย</li>
                  <li>• บริหารร้านค้าทุกที่ ทุกเวลา</li>
                </ul>
              </div>

              <div className="lp-eco-arrow">→</div>

              {/* 5. Customer */}
              <div className="lp-eco-card violet">
                <div className="lp-eco-card-head">
                  <Users size={20} />
                  <div>
                    <strong>ลูกค้า</strong>
                    <small>ผู้ซื้อสินค้า & บริการ</small>
                  </div>
                </div>
                <ul className="lp-eco-list">
                  <li>• ชำระเงินง่าย ปลอดภัย</li>
                  <li>• หลากหลายช่องทาง</li>
                  <li>• ได้รับใบเสร็จทันที</li>
                  <li>• ประสบการณ์ที่ดีเยี่ยม</li>
                </ul>
              </div>
            </div>

            {/* Bottom Developer Layer Card */}
            <div className="lp-eco-dev-card">
              <div className="lp-dev-card-left">
                <div className="lp-dev-icon-box">
                  <Code2 size={24} color="#0284c7" />
                </div>
                <div>
                  <div className="lp-dev-title-row">
                    <strong>💻 Developer / นักพัฒนา</strong>
                    <a href="/developer" className="lp-dev-link">ไปยัง Developer Console <ExternalLink size={13} /></a>
                  </div>
                  <p>เชื่อมต่อผ่าน API, Webhook, SDK • รองรับ ERP, POS เดิม, Chatbot (LINE / Facebook)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Call-to-Action & Real-time Live Stats Banner ──────────────── */}
      <section className="lp-cta-section" id="pricing">
        <div className="lp-section-container">
          <div className="lp-cta-banner-card">
            {/* Left Content */}
            <div className="lp-cta-banner-left">
              <h2>เริ่มต้นธุรกิจยุคใหม่<br />ไปกับ ChatPOS</h2>
              <p>ระบบที่ช่วยให้คุณขายง่าย รับเงินไว เติบโตได้อย่างมั่นคงและยั่งยืน</p>
              <div className="lp-cta-banner-actions">
                <a href="/merchant/register" className="lp-cta-btn-white" onClick={() => playTapSound()}>
                  เริ่มต้นใช้งานฟรี
                </a>
                <a href="#contact" className="lp-cta-btn-glass" onClick={() => playTapSound()}>
                  ติดต่อฝ่ายขาย
                </a>
              </div>
            </div>

            {/* Right 4 Stats Blocks */}
            <div className="lp-cta-stats-grid">
              <div className="lp-stat-box">
                <div className="lp-stat-icon-wrap"><Store size={20} /></div>
                <strong>10,000+</strong>
                <span>ร้านค้าที่ใช้งาน</span>
              </div>
              <div className="lp-stat-box">
                <div className="lp-stat-icon-wrap"><Zap size={20} /></div>
                <strong>500K+</strong>
                <span>ธุรกรรมต่อเดือน</span>
              </div>
              <div className="lp-stat-box">
                <div className="lp-stat-icon-wrap"><ShieldCheck size={20} /></div>
                <strong>99.9%</strong>
                <span>ความเสถียรของระบบ</span>
              </div>
              <div className="lp-stat-box">
                <div className="lp-stat-icon-wrap"><Headphones size={20} /></div>
                <strong>24/7</strong>
                <span>ซัพพอร์ตตลอดเวลา</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. Trusted By Businesses ────────────────────────────────────── */}
      <section className="lp-trusted-section" id="about">
        <div className="lp-section-container">
          <span className="lp-trusted-title">เชื่อถือโดยธุรกิจชั้นนำมากมาย</span>
          <div className="lp-trusted-badges-row">
            <div className="lp-biz-badge">☕ Coffee World</div>
            <div className="lp-biz-badge">💆 Massage & Spa</div>
            <div className="lp-biz-badge">🎁 Souvenir Shop</div>
            <div className="lp-biz-badge">🍽️ Restaurant</div>
            <div className="lp-biz-badge">💅 Beauty Clinic</div>
            <div className="lp-biz-badge">🏨 Hotel & Resort</div>
            <div className="lp-biz-badge">🛍️ Fashion Store</div>
            <div className="lp-biz-badge">➕ Pharmacy</div>
          </div>
        </div>
      </section>

      {/* ── 8. Footer ───────────────────────────────────────────────────── */}
      <footer className="lp-footer" id="contact">
        <div className="lp-footer-container">
          <div className="lp-footer-top">
            <div className="lp-footer-brand">
              <div className="lp-logo">
                <img src="/logo.png" alt="ChatPOS Logo" className="lp-logo-image" style={{ height: '36px' }} />
              </div>
              <p>ระบบจัดการร้านค้าและการชำระเงินอัจฉริยะครบวงจร พร้อมยกระดับธุรกิจของคุณสู่อนาคต</p>
            </div>

            <div className="lp-footer-links-grid">
              <div className="lp-footer-col">
                <strong>ระบบงาน</strong>
                <a href="/merchant">Merchant Portal (ร้านค้า)</a>
                <a href="/agent/login">Agent Portal (ตัวแทน)</a>
                <a href="/pd/login">PD Operations (เขต)</a>
                <a href="/login">Admin HQ (ศูนย์กลาง)</a>
              </div>
              <div className="lp-footer-col">
                <strong>นักพัฒนา</strong>
                <a href="/developer">Developer Console</a>
                <a href="/developer">REST API Docs</a>
                <a href="/developer">Webhooks & SDKs</a>
                <a href="/developer">Sandbox Testing</a>
              </div>
              <div className="lp-footer-col">
                <strong>ช่วยเหลือ & ติดต่อ</strong>
                <a href="mailto:support@chatpos.biz">support@chatpos.biz</a>
                <a href="tel:021234567">02-123-4567</a>
                <span>LINE Official: @chatpos</span>
                <span>กรุงเทพฯ, ประเทศไทย</span>
              </div>
            </div>
          </div>

          <div className="lp-footer-bottom">
            <p>© {new Date().getFullYear()} ChatPOS. All rights reserved. Powered by PostgreSQL & Secure FinTech Engine.</p>
            <div className="lp-footer-legal">
              <a href="#privacy">นโยบายความเป็นส่วนตัว</a>
              <span>•</span>
              <a href="#terms">ข้อกำหนดการใช้งาน</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Modal 1: Role Switcher / Quick Login ────────────────────────── */}
      {loginModalOpen && (
        <div className="lp-modal-overlay" onClick={() => setLoginModalOpen(false)}>
          <div className="lp-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="lp-modal-head">
              <div>
                <h3>เข้าสู่ระบบ ChatPOS</h3>
                <p>เลือกบทบาทผู้ใช้งานของคุณเพื่อเข้าสู่ระบบงาน</p>
              </div>
              <button 
                type="button" 
                className="lp-modal-close" 
                onClick={() => setLoginModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="lp-role-grid">
              <a href="/merchant/login" className="lp-role-card orange">
                <div className="lp-role-icon orange"><Store size={22} /></div>
                <div className="lp-role-info">
                  <strong>ร้านค้า (Merchant)</strong>
                  <span>ระบบหน้าร้าน POS, สินค้า & บิล</span>
                </div>
                <ChevronRight size={18} className="lp-role-arrow" />
              </a>

              <a href="/agent/login" className="lp-role-card green">
                <div className="lp-role-icon green"><Users size={22} /></div>
                <div className="lp-role-info">
                  <strong>ตัวแทน (Agent)</strong>
                  <span>บริหารเครือข่ายร้านค้า & ค่าคอมฯ</span>
                </div>
                <ChevronRight size={18} className="lp-role-arrow" />
              </a>

              <a href="/pd/login" className="lp-role-card blue">
                <div className="lp-role-icon blue"><Building2 size={22} /></div>
                <div className="lp-role-info">
                  <strong>ผู้อำนวยการเขต (PD)</strong>
                  <span>กำกับดูแลพื้นที่ & Sign-off</span>
                </div>
                <ChevronRight size={18} className="lp-role-arrow" />
              </a>

              <a href="/login" className="lp-role-card purple">
                <div className="lp-role-icon purple"><Award size={22} /></div>
                <div className="lp-role-info">
                  <strong>ศูนย์บริหาร (Admin HQ)</strong>
                  <span>ระบบส่วนกลางและการเงิน</span>
                </div>
                <ChevronRight size={18} className="lp-role-arrow" />
              </a>

              <a href="/developer" className="lp-role-card cyan">
                <div className="lp-role-icon cyan"><Code2 size={22} /></div>
                <div className="lp-role-info">
                  <strong>นักพัฒนา (Developer Mode)</strong>
                  <span>API Keys, Webhooks & Sandbox</span>
                </div>
                <ChevronRight size={18} className="lp-role-arrow" />
              </a>
            </div>

            <div className="lp-modal-footer">
              <span>ยังไม่มีบัญชีร้านค้า?</span>
              <a href="/merchant/register" className="lp-register-link">สมัครเปิดร้านค้าทันที</a>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Interactive Demo Video / Showcase Preview ───────────── */}
      {demoModalOpen && (
        <div className="lp-modal-overlay" onClick={() => setDemoModalOpen(false)}>
          <div className="lp-demo-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="lp-modal-head">
              <div className="lp-demo-title-group">
                <div className="lp-demo-badge">
                  <Sparkles size={14} /> LIVE DEMO PREVIEW
                </div>
                <h3>สาธิตการใช้งาน ChatPOS อัจฉริยะ</h3>
              </div>
              <button 
                type="button" 
                className="lp-modal-close" 
                onClick={() => setDemoModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Interactive Preview Tabs */}
            <div className="lp-demo-tabs-bar">
              <button 
                type="button" 
                className={`lp-demo-tab ${demoTab === 'pos' ? 'active' : ''}`}
                onClick={() => setDemoTab('pos')}
              >
                <Store size={15} /> 1. หน้าคิดเงิน POS & สต็อก
              </button>
              <button 
                type="button" 
                className={`lp-demo-tab ${demoTab === 'qr' ? 'active' : ''}`}
                onClick={() => setDemoTab('qr')}
              >
                <QrCode size={15} /> 2. ชำระเงิน Dynamic QR
              </button>
              <button 
                type="button" 
                className={`lp-demo-tab ${demoTab === 'ledger' ? 'active' : ''}`}
                onClick={() => setDemoTab('ledger')}
              >
                <Database size={15} /> 3. Real-time PostgreSQL Ledger
              </button>
            </div>

            {/* Demo Screen Showcase */}
            <div className="lp-demo-body">
              {demoTab === 'pos' && (
                <div className="lp-demo-screen-box">
                  <div className="lp-demo-screen-header">
                    <h4>🏪 ระบบขายหน้าร้าน (Point of Sale)</h4>
                    <span className="lp-live-badge">🟢 Real-time Sync</span>
                  </div>
                  <p>คิดเงินสะดวก จัดการโต๊ะ สแกนบาร์โค้ด และรองรับรายการสินค้า 3 ภาษา (ไทย/อังกฤษ/จีน)</p>
                  <div className="lp-demo-preview-img-wrap">
                    <img src="/mascot/pos_4_sales_report.png" alt="POS Sales Report" className="lp-demo-screen-img" />
                  </div>
                </div>
              )}

              {demoTab === 'qr' && (
                <div className="lp-demo-screen-box">
                  <div className="lp-demo-screen-header">
                    <h4>💳 ระบบรับชำระเงินอัจฉริยะ (Multi-Channel QuickPay)</h4>
                    <span className="lp-live-badge">⚡ Auto Slip Detect</span>
                  </div>
                  <p>สร้าง QR Code รับเงินอัตโนมัติ รองรับ PromptPay, TrueMoney, Alipay, WeChat และบัตรเครดิต</p>
                  <div className="lp-demo-preview-img-wrap">
                    <img src="/mascot/pay_channel_1_promptpay.png" alt="Payment QR" className="lp-demo-screen-img" />
                  </div>
                </div>
              )}

              {demoTab === 'ledger' && (
                <div className="lp-demo-screen-box">
                  <div className="lp-demo-screen-header">
                    <h4>📊 ฐานข้อมูล Real-time Financial Ledger</h4>
                    <span className="lp-live-badge">🛡️ Bank Grade Security</span>
                  </div>
                  <p>บันทึกทุกยอดขายและคำนวณส่วนแบ่งค่าคอมมิชชันให้ Agent & PD อัตโนมัติทันที</p>
                  <div className="lp-demo-preview-img-wrap">
                    <img src="/mascot/nabtang_analytics.png" alt="Ledger Analytics" className="lp-demo-screen-img" />
                  </div>
                </div>
              )}
            </div>

            <div className="lp-demo-footer">
              <a href="/merchant" className="lp-demo-action-btn primary">
                เข้าทดลองระบบจริง (Live Interactive Demo) <ArrowRight size={16} />
              </a>
              <button type="button" className="lp-demo-action-btn secondary" onClick={() => setDemoModalOpen(false)}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

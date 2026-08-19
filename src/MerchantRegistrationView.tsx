import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  FileText,
  Landmark,
  LogOut,
  Package,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Store,
  Trash2,
  AlertTriangle,
  Users,
  Sparkles,
} from 'lucide-react'
import { useMerchantT, type Lang } from './registrationI18n'
import { registerMerchant, requestMerchantAssignment } from './dbApi'

type TFn = (key: string) => string

type Supplier = {
  id: string
  name: string
  taxId: string
  bankName: string
  bankAccount: string
  accountHolder: string
}

const initialSuppliers: Supplier[] = [
  { id: 's1', name: 'บริษัท ซัพพลาย จำกัด', taxId: '0105XXXXXXX', bankName: 'ธนาคารกรุงเทพ', bankAccount: '123-4-56789-0', accountHolder: 'บริษัท ซัพพลาย จำกัด' },
  { id: 's2', name: 'ห้างหุ้นส่วนจำกัด ไทยเทรด', taxId: '0105YYYYYYY', bankName: 'ธนาคารกสิกรไทย', bankAccount: '098-7-65432-1', accountHolder: 'หจก. ไทยเทรด' },
]

const productOptions = ['QR Cash', 'QR Credit Card', 'EDC']

export function MerchantRegistrationView() {
  // Registration Flow Stage: 'quick' (Simple Initial Sign-up) or 'wizard' (Detailed Business KYC)
  const [stage, setStage] = useState<'quick' | 'wizard'>('quick')
  const [showDecisionModal, setShowDecisionModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quickError, setQuickError] = useState('')

  // Quick Sign-up Form State
  const [quickData, setQuickData] = useState({
    storeName: '',
    ownerName: '',
    phone: '',
    agentPhone: '',
    email: '',
    password: '',
    referralCode: '',
  })

  const [currentStep, setCurrentStep] = useState(0)
  const [lang, setLang] = useState<Lang>('TH')
  const t = useMerchantT(lang)

  const [bizType, setBizType] = useState('individual')
  const [channel, setChannel] = useState('online')
  const [purposes, setPurposes] = useState<Set<number>>(new Set([0, 3, 4, 5]))
  const [products, setProducts] = useState<Set<number>>(new Set([0]))
  const [restricted, setRestricted] = useState<Set<number>>(new Set())
  const [sameAddress, setSameAddress] = useState(true)
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)

  const steps = [t('step1'), t('step2'), t('step3'), t('step4'), t('step5')]
  const pct = Math.round(((currentStep + 1) / steps.length) * 100)
  const stepperFill = currentStep === 0 ? 0 : (currentStep / (steps.length - 1)) * 100
  const goNext = () => { if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const goBack = () => { if (currentStep > 0) setCurrentStep(currentStep - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const toggleSet = (set: Set<number>, idx: number, setter: (s: Set<number>) => void) => { const n = new Set(set); n.has(idx) ? n.delete(idx) : n.add(idx); setter(n) }
  const removeSupplier = (id: string) => setSuppliers(suppliers.filter(s => s.id !== id))
  const addSupplier = () => setSuppliers([...suppliers, { id: `s${Date.now()}`, name: '', taxId: '', bankName: '', bankAccount: '', accountHolder: '' }])

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setQuickError('')

    if (!quickData.storeName.trim()) {
      setQuickError('กรุณาระบุชื่อร้านค้า')
      return
    }
    if (!quickData.ownerName.trim()) {
      setQuickError('กรุณาระบุชื่อ-นามสกุล เจ้าของร้าน')
      return
    }
    if (!quickData.phone.trim()) {
      setQuickError('กรุณาระบุเบอร์โทรศัพท์')
      return
    }
    if (!quickData.email.trim()) {
      setQuickError('กรุณาระบุอีเมล')
      return
    }
    if (!quickData.password || quickData.password.length < 6) {
      setQuickError('กรุณากำหนดรหัสผ่านอย่างน้อย 6 ตัวอักษร')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await registerMerchant({
        name: quickData.ownerName.trim(),
        email: quickData.email.trim(),
        password: quickData.password,
        phone: quickData.phone.trim(),
        storeName: quickData.storeName.trim(),
        referralCode: quickData.referralCode.trim() || undefined,
        storeType: 'MAIN',
      })

      if (res.success) {
        if (res.storeId) {
          const assignment = await requestMerchantAssignment({
            storeId: res.storeId,
            sourceRequestId: `merchant-registration-${res.storeId}`,
            agentPhone: quickData.agentPhone.trim() || undefined,
          })
          if (assignment.success && assignment.data?.status) {
            try {
              localStorage.setItem('merchant_assignment_status', assignment.data.status)
            } catch {}
          } else if (assignment.code && assignment.code !== 'ASSIGNMENT_INTEGRATION_DISABLED') {
            console.warn('Merchant registration succeeded but assignment request failed:', assignment.code)
          }
        }
        setShowDecisionModal(true)
      } else {
        setQuickError(res.error || 'ไม่สามารถลงทะเบียนได้ กรุณาลองใหม่อีกครั้ง')
      }
    } catch (err: any) {
      setQuickError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="reg-shell">
      <header className="reg-header">
        <div className="reg-header-inner">
          <div className="reg-brand" onClick={() => (window.location.href = '/')}>
            <div className="reg-logo-mark">
              <Sparkles size={18} className="reg-logo-sparkle" />
            </div>
            <div className="reg-brand-text"><strong>ChatPOS</strong><span>{t('headerSub')}</span></div>
          </div>
          <div className="reg-header-actions">
            <div className="reg-lang-switch">
              <button className={lang === 'TH' ? 'active' : ''} onClick={() => setLang('TH')} type="button">TH</button>
              <button className={lang === 'EN' ? 'active' : ''} onClick={() => setLang('EN')} type="button">EN</button>
            </div>
            <button className="reg-logout-btn" type="button" onClick={() => { window.location.href = '/merchant/login' }}>
              <span>{t('logout')}</span><LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="reg-main">
        {/* PHASE 1: Quick & Easy Registration */}
        {stage === 'quick' ? (
          <div className="reg-quick-card">
            <div className="reg-quick-hero">
              <div className="reg-stage-badge">
                <Store size={15} /> สเต็ปที่ 1: สมัครเปิดร้านค้าเริ่มต้น (1 นาที)
              </div>
              <h1>เปิดร้านค้า ChatPOS ฟรี</h1>
              <p>กรอกข้อมูลเบื้องต้นเพื่อสร้างบัญชีร้านค้าและเข้าใช้งานระบบ POS ได้ทันที</p>
            </div>

            {quickError && (
              <div className="reg-notice" style={{ background: '#fef2f2', borderColor: '#fca5a5', marginBottom: '20px' }}>
                <AlertTriangle className="reg-notice-icon" style={{ color: '#dc2626' }} size={20} />
                <div style={{ color: '#b91c1c', fontWeight: 600, fontSize: '13px' }}>
                  {quickError}
                  {quickError.includes('อีเมลนี้ถูกใช้งานแล้ว') && (
                    <span style={{ marginLeft: '6px' }}>
                      👉 <a href="/merchant/login" style={{ color: '#b91c1c', textDecoration: 'underline', fontWeight: 700 }}>คลิกที่นี่เพื่อเข้าสู่ระบบ</a>
                    </span>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleQuickSubmit} className="reg-quick-form">
              <div className="reg-grid reg-grid-2">
                <div className="reg-field reg-col-span-2">
                  <span className="reg-label">ชื่อร้านค้า / ธุรกิจ <span className="reg-required">*</span></span>
                  <input
                    className="reg-input"
                    type="text"
                    placeholder="เช่น คาเฟ่อเมซอน สาขาลาดพร้าว หรือ ร้านตามสั่งป้าสมร"
                    value={quickData.storeName}
                    onChange={(e) => setQuickData({ ...quickData, storeName: e.target.value })}
                    required
                  />
                </div>

                <div className="reg-field">
                  <span className="reg-label">ชื่อ-นามสกุล เจ้าของร้าน <span className="reg-required">*</span></span>
                  <input
                    className="reg-input"
                    type="text"
                    placeholder="เช่น สมศักดิ์ มีสุข"
                    value={quickData.ownerName}
                    onChange={(e) => setQuickData({ ...quickData, ownerName: e.target.value })}
                    required
                  />
                </div>

                <div className="reg-field">
                  <span className="reg-label">เบอร์โทรศัพท์มือถือ <span className="reg-required">*</span></span>
                  <input
                    className="reg-input"
                    type="tel"
                    placeholder="08X-XXX-XXXX"
                    value={quickData.phone}
                    onChange={(e) => setQuickData({ ...quickData, phone: e.target.value })}
                    required
                  />
                </div>

                <div className="reg-field">
                  <span className="reg-label">อีเมลสำหรับเข้าสู่ระบบ <span className="reg-required">*</span></span>
                  <input
                    className="reg-input"
                    type="email"
                    placeholder="owner@yourshop.com"
                    value={quickData.email}
                    onChange={(e) => setQuickData({ ...quickData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="reg-field">
                  <span className="reg-label">กำหนดรหัสผ่าน (อย่างน้อย 6 ตัวอักษร) <span className="reg-required">*</span></span>
                  <input
                    className="reg-input"
                    type="password"
                    placeholder="••••••••"
                    value={quickData.password}
                    onChange={(e) => setQuickData({ ...quickData, password: e.target.value })}
                    required
                  />
                </div>

                <div className="reg-field reg-col-span-2">
                  <span className="reg-label">รหัสตัวแทนแนะนำ / Agent Code (ถ้ามี)</span>
                  <input
                    className="reg-input"
                    type="text"
                    placeholder="เช่น AG-001 หรือเว้นว่างไว้"
                    value={quickData.referralCode}
                    onChange={(e) => setQuickData({ ...quickData, referralCode: e.target.value })}
                  />
                </div>

                <div className="reg-field reg-col-span-2">
                  <span className="reg-label">เบอร์โทรศัพท์ Agent ผู้ดูแล (ถ้ามี)</span>
                  <input
                    className="reg-input"
                    type="tel"
                    placeholder="08X-XXX-XXXX หรือเว้นว่างให้ Admin จัดสรร"
                    value={quickData.agentPhone}
                    onChange={(e) => setQuickData({ ...quickData, agentPhone: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" className="reg-quick-submit-btn" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span>กำลังสร้างบัญชีร้านค้า...</span>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>สร้างบัญชีและเปิดร้านค้าทันที 🚀</span>
                  </>
                )}
              </button>

              <div className="reg-quick-footer-link">
                มีบัญชีร้านค้าอยู่แล้ว? <a href="/merchant/login">เข้าสู่ระบบที่นี่</a>
              </div>
            </form>
          </div>
        ) : (
          /* PHASE 2: Detailed Business KYC Wizard */
          <div className="reg-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div className="reg-stage-badge">
                <FileText size={14} /> สเต็ปที่ 2: กรอกข้อมูลธุรกิจ & เอกสารยืนยันตัวตน (KYC)
              </div>
              <button
                type="button"
                onClick={() => (window.location.href = '/merchant')}
                style={{ background: 'transparent', border: '0', color: 'var(--reg-primary)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                ข้ามไปหน้าร้านค้าก่อน ➔
              </button>
            </div>

            <h1 className="reg-title">{t('pageTitle')}</h1>
            <div className="reg-stepper">
              <div className="reg-stepper-line"><div className="reg-stepper-fill" style={{ width: `${stepperFill}%` }} /></div>
              {steps.map((label, i) => (
                <div key={i} className={`reg-step ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''}`}
                  onClick={() => i < currentStep && setCurrentStep(i)} style={{ cursor: i < currentStep ? 'pointer' : 'default' }}>
                  <div className="reg-step-circle">{i < currentStep ? <Check size={16} /> : i + 1}</div>
                  <span className="reg-step-label">{label}</span>
                </div>
              ))}
            </div>
            <div className="reg-progress">
              <div className="reg-progress-header">
                <span className="reg-progress-step">{t('step')} {currentStep + 1}/{steps.length}</span>
                <span className="reg-progress-pct">{pct}%</span>
              </div>
              <div className="reg-progress-track"><div className="reg-progress-fill" style={{ width: `${pct}%` }} /></div>
            </div>

            <div className="reg-step-content" key={`${currentStep}-${lang}`}>
              {currentStep === 0 && <Step1 t={t} bizType={bizType} setBizType={setBizType} channel={channel} setChannel={setChannel}
                purposes={purposes} togglePurpose={(i: number) => toggleSet(purposes, i, setPurposes)}
                products={products} toggleProduct={(i: number) => toggleSet(products, i, setProducts)}
                restricted={restricted} toggleRestricted={(i: number) => toggleSet(restricted, i, setRestricted)}
                sameAddress={sameAddress} setSameAddress={setSameAddress} />}
              {currentStep === 1 && <Step2 t={t} />}
              {currentStep === 2 && <Step3 t={t} />}
              {currentStep === 3 && <Step4 t={t} />}
              {currentStep === 4 && <Step5 t={t} suppliers={suppliers} onRemove={removeSupplier} onAdd={addSupplier} />}
            </div>

            <div className="reg-nav-buttons">
              <button className="reg-btn-back" onClick={goBack} disabled={currentStep === 0} type="button"><ArrowLeft size={16} /> {t('back')}</button>
              {currentStep < steps.length - 1 ? (
                <button className="reg-btn-next" onClick={goNext} type="button">{t('next')} <ArrowRight size={16} /></button>
              ) : (
                <button
                  className="reg-btn-next"
                  onClick={() => {
                    try {
                      localStorage.setItem('merchant_kyc_status', 'pending')
                      localStorage.setItem('merchant_is_registered', 'true')
                    } catch {}
                    alert(lang === 'TH'
                      ? '🎉 บันทึกเอกสาร KYC เข้าสู่ระบบเรียบร้อย!\n\nเจ้าหน้าที่จะดำเนินการตรวจสอบเอกสารภายใน 24 ชม. ระบบ POS และเมนูสินค้าพร้อมใช้งานทันที'
                      : '🎉 KYC documents submitted successfully!\n\nOur compliance team will review within 24 hours. Your POS is ready for setup.')
                    window.location.href = '/merchant'
                  }}
                  type="button"
                >
                  <ShieldCheck size={16} /> {t('submitBtn')}
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Decision Modal after Quick Registration */}
      {showDecisionModal && (
        <div className="reg-modal-backdrop">
          <div className="reg-decision-modal">
            <img src="/mascot/nabtang_celebrating.png" alt="Success Mascot" className="reg-decision-mascot" />
            <h2 className="reg-decision-title">🎉 สร้างบัญชีร้านค้าสำเร็จแล้ว!</h2>
            <p className="reg-decision-desc">
              ร้านค้า <strong>"{quickData.storeName}"</strong> ถูกบันทึกเข้าสู่ระบบฐานข้อมูล ChatPOS เรียบร้อยแล้ว คุณสามารถเลือกดำเนินการต่อได้ดังนี้:
            </p>

            <div className="reg-decision-options">
              <div
                className="reg-decision-card-btn primary"
                onClick={() => {
                  setShowDecisionModal(false)
                  setStage('wizard')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                role="button"
                tabIndex={0}
              >
                <div className="reg-card-btn-text">
                  <strong>📄 กรอกข้อมูลธุรกิจและยืนยันตัวตน KYC (แนะนำ)</strong>
                  <span>อัปโหลดเอกสารเพื่อเปิดรับชำระเงิน QR PromptPay และ EDC เต็มรูปแบบ</span>
                </div>
                <ArrowRight size={20} style={{ color: 'var(--reg-primary)' }} />
              </div>

              <div
                className="reg-decision-card-btn secondary"
                onClick={() => {
                  window.location.href = '/merchant'
                }}
                role="button"
                tabIndex={0}
              >
                <div className="reg-card-btn-text">
                  <strong>🏪 เข้าสู่ระบบจัดการร้านค้า POS ทันที</strong>
                  <span>เริ่มตั้งค่าเมนูสินค้า จัดโต๊ะ และทดลองใช้งาน (สามารถยืนยัน KYC ภายหลังได้)</span>
                </div>
                <ArrowRight size={20} style={{ color: 'var(--reg-muted)' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="reg-footer">
        <div className="reg-footer-inner">
          <p>{t('copyright')}</p>
          <div className="reg-footer-links">
            <a href="#">{t('privacyPolicy')}</a>
            <a href="#">{t('termsOfService')}</a>
            <a href="#">{t('helpCenter')}</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ========== STEP 1 ========== */
function Step1({ t, bizType, setBizType, channel, setChannel, purposes, togglePurpose, products, toggleProduct, restricted, toggleRestricted, sameAddress, setSameAddress }: {
  t: TFn; bizType: string; setBizType: (v: string) => void; channel: string; setChannel: (v: string) => void
  purposes: Set<number>; togglePurpose: (i: number) => void; products: Set<number>; toggleProduct: (i: number) => void
  restricted: Set<number>; toggleRestricted: (i: number) => void; sameAddress: boolean; setSameAddress: (v: boolean) => void
}) {
  const noticeKeys = ['notice1','notice2','notice3','notice4','notice5','notice6'] as const
  const purposeKeys = ['purpose1','purpose2','purpose3','purpose4','purpose5','purpose6'] as const
  const restrictedKeys = Array.from({ length: 25 }, (_, i) => `restricted${i + 1}`)

  return (
    <>
      <div className="reg-notice">
        <AlertTriangle className="reg-notice-icon" size={22} />
        <div>
          <h3>{t('noticeTitle')}</h3>
          <ul>{noticeKeys.map((k, i) => <li key={i}>{i + 1}. {t(k)}</li>)}</ul>
        </div>
      </div>

      <section className="reg-section">
        <h2 className="reg-section-title">{t('shopInfoTitle')}</h2>
        <p className="reg-section-desc">{t('shopInfoDesc')}</p>
        <div className="reg-grid">
          <div className="reg-field">
            <span className="reg-label">{t('bizType')}<span className="reg-required">*</span></span>
            <div className="reg-radio-group">
              <label className="reg-radio-label"><input type="radio" name="biz_type" checked={bizType === 'individual'} onChange={() => setBizType('individual')} /> {t('individual')}</label>
              <label className="reg-radio-label"><input type="radio" name="biz_type" checked={bizType === 'juristic'} onChange={() => setBizType('juristic')} /> {t('juristic')}</label>
            </div>
          </div>
          <div className="reg-field">
            <span className="reg-label">{t('channel')}<span className="reg-required">*</span></span>
            <div className="reg-radio-group">
              <label className="reg-radio-label"><input type="radio" name="channel" checked={channel === 'online'} onChange={() => setChannel('online')} /> {t('online')}</label>
              <label className="reg-radio-label"><input type="radio" name="channel" checked={channel === 'offline'} onChange={() => setChannel('offline')} /> {t('offline')}</label>
            </div>
          </div>
          <div className="reg-field"><span className="reg-label">{t('partnerId')}</span><input className="reg-input" type="text" defaultValue="AE000006" /></div>
          <div className="reg-field"><span className="reg-label">{t('email')}<span className="reg-required">*</span></span><input className="reg-input" type="email" placeholder="infinitypickshop@gmail.com" /></div>
          <div className="reg-field"><span className="reg-label">{t('shopNameTh')}<span className="reg-required">*</span></span><input className="reg-input" type="text" placeholder="อินฟินิตี้พิกช็อป" /></div>
          <div className="reg-field"><span className="reg-label">{t('shopNameEn')}<span className="reg-required">*</span></span><input className="reg-input" type="text" placeholder="InfinityPickShop" /></div>
          <div className="reg-field">
            <span className="reg-label">{t('bizCategory')}<span className="reg-required">*</span></span>
            <select className="reg-select" defaultValue="other">
              <option value="other">{t('bizCatOther')}</option>
              <option value="ecommerce">{t('bizCatEcom')}</option>
              <option value="service">{t('bizCatService')}</option>
              <option value="retail">{t('bizCatRetail')}</option>
              <option value="food">{t('bizCatFood')}</option>
            </select>
          </div>
          <div className="reg-field reg-col-span-2"><span className="reg-label">{t('bizDetail')}<span className="reg-required">*</span></span><input className="reg-input" type="text" placeholder="E-commerce" /></div>
        </div>
      </section>

      <section className="reg-section">
        <h2 className="reg-section-title">{t('purposeTitle')}</h2>
        <p className="reg-section-desc">{t('purposeDesc')}</p>
        <div className="reg-selectable-grid">
          {purposeKeys.map((k, i) => (
            <label className="reg-selectable-card" key={i}>
              <input type="checkbox" checked={purposes.has(i)} onChange={() => togglePurpose(i)} />
              <div className="reg-selectable-inner"><span className="reg-circle-icon"><Check size={14} /></span><span>{t(k)}</span></div>
            </label>
          ))}
        </div>
      </section>

      <section className="reg-section">
        <h2 className="reg-section-title">{t('shopAddress')}</h2>
        <div className="reg-grid">
          <div className="reg-field"><span className="reg-label">{t('buildingNo')}<span className="reg-required">*</span></span><input className="reg-input" type="text" defaultValue="3/196" /></div>
          <div className="reg-field"><span className="reg-label">{t('moo')}</span><input className="reg-input" type="text" defaultValue="9" /></div>
          <div className="reg-field"><span className="reg-label">{t('building')}</span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('floor')}</span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('soi')}</span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('road')}</span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('province')}<span className="reg-required">*</span></span><select className="reg-select"><option>สุโขทัย</option><option>กรุงเทพมหานคร</option></select></div>
          <div className="reg-field"><span className="reg-label">{t('district')}<span className="reg-required">*</span></span><select className="reg-select"><option>เมืองสุโขทัย</option></select></div>
          <div className="reg-field"><span className="reg-label">{t('subDistrict')}<span className="reg-required">*</span></span><select className="reg-select"><option>ปากแคว</option></select></div>
        </div>
      </section>

      <section className="reg-section">
        <h2 className="reg-section-title">{t('productTitle')}</h2>
        <div className="reg-grid-2" style={{ marginBottom: 24 }}>
          <div className="reg-field"><span className="reg-label">{t('postalCode')}</span><input className="reg-input" type="text" defaultValue="64000" /></div>
          <div className="reg-field" style={{ justifyContent: 'flex-end' }}>
            <label className="reg-address-check"><input type="checkbox" checked={sameAddress} onChange={(e) => setSameAddress(e.target.checked)} /><span>{t('sameAddress')}</span></label>
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <span className="reg-label" style={{ marginBottom: 12, display: 'block' }}>{t('productUsage')}<span className="reg-required">*</span></span>
          <div className="reg-selectable-grid">
            {productOptions.map((item, i) => (
              <label className="reg-selectable-card" key={i}>
                <input type="checkbox" checked={products.has(i)} onChange={() => toggleProduct(i)} />
                <div className="reg-selectable-inner"><span className="reg-check-icon"><Check size={12} /></span><span>{item}</span></div>
              </label>
            ))}
          </div>
        </div>
        <div className="reg-grid-2" style={{ marginBottom: 24 }}>
          <div className="reg-field"><span className="reg-label">{t('productService')}<span className="reg-required">*</span></span><input className="reg-input" type="text" defaultValue="แพลตฟอร์มขายสินค้าแบบครบวงจร (Marketplace)" /></div>
          <div className="reg-grid-2">
            <div className="reg-field"><span className="reg-label">{t('priceMin')}<span className="reg-required">*</span></span><input className="reg-input" type="number" defaultValue="62" /></div>
            <div className="reg-field"><span className="reg-label">{t('priceMax')}</span><input className="reg-input" type="number" defaultValue="3627" /></div>
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <span className="reg-label" style={{ marginBottom: 12, display: 'block' }}>{t('estimateTitle')}<span className="reg-required">*</span></span>
          <div className="reg-estimate-box">
            <div className="reg-grid-2">
              <div className="reg-field"><span className="reg-label" style={{ fontSize: 12, color: '#64748b' }}>{t('estimateValue')}</span><input className="reg-input" type="text" defaultValue="10,000,000" /></div>
              <div className="reg-field"><span className="reg-label" style={{ fontSize: 12, color: '#64748b' }}>{t('estimateCount')}</span><input className="reg-input" type="text" defaultValue="10,000,000" /></div>
            </div>
          </div>
        </div>
        <div className="reg-field" style={{ marginBottom: 40 }}>
          <span className="reg-label">{t('productDetail')}<span className="reg-required">*</span></span>
          <textarea className="reg-input reg-textarea" defaultValue={`- เสื้อผ้าแฟชั่น\n- เครื่องสำอางและสกินแคร์\n- อาหารเสริมและวิตามิน`} />
        </div>
      </section>

      <section className="reg-checklist-section">
        <div className="reg-checklist-header">
          <h3>{t('restrictedTitle')}</h3>
          <span className="reg-checklist-badge">{t('selectedCount')} {restricted.size} {t('itemsOf')} {restrictedKeys.length} {t('itemsLabel')}</span>
        </div>
        <p className="reg-checklist-desc">{t('restrictedDesc')}</p>
        <div className="reg-selectable-grid">
          {restrictedKeys.map((k, i) => (
            <label className="reg-selectable-card" key={i}>
              <input type="checkbox" checked={restricted.has(i)} onChange={() => toggleRestricted(i)} />
              <div className="reg-selectable-inner"><span className="reg-check-icon"><Check size={12} /></span><span style={{ fontSize: 12 }}>{t(k)}</span></div>
            </label>
          ))}
        </div>
      </section>
    </>
  )
}

/* ========== STEP 2 ========== */
function Step2({ t }: { t: TFn }) {
  return (
    <>
      <section className="reg-section">
        <h2 className="reg-section-title">{t('contactTitle')}</h2>
        <div className="reg-grid">
          <div className="reg-field"><span className="reg-label">{t('prefix')}<span className="reg-required">*</span></span>
            <select className="reg-select"><option value="">{t('selectPrefix')}</option><option>{t('prefixMr')}</option><option>{t('prefixMs')}</option><option>{t('prefixMrs')}</option></select>
          </div>
          <div className="reg-field"><span className="reg-label">{t('nameThLabel')}<span className="reg-required">*</span></span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('nameEnLabel')}<span className="reg-required">*</span></span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('idCard')}<span className="reg-required">*</span></span><input className="reg-input" type="text" placeholder={t('idCardPlaceholder')} /></div>
          <div className="reg-field"><span className="reg-label">{t('idCardExpiry')}<span className="reg-required">*</span></span>
            <div className="reg-date-wrap"><input className="reg-input" type="text" placeholder={t('datePlaceholder')} /><Calendar className="reg-date-icon" size={18} /></div>
          </div>
          <div className="reg-field"><span className="reg-label">{t('dobShort')}<span className="reg-required">*</span></span>
            <div className="reg-date-wrap"><input className="reg-input" type="text" placeholder={t('datePlaceholder')} /><Calendar className="reg-date-icon" size={18} /></div>
          </div>
          <div className="reg-field"><span className="reg-label">{t('phone')}<span className="reg-required">*</span></span><input className="reg-input" type="text" placeholder={t('phonePlaceholder')} /></div>
          <div className="reg-field"><span className="reg-label">{t('nationality')}<span className="reg-required">*</span></span>
            <div className="reg-radio-group"><label className="reg-radio-label"><input type="radio" name="nationality" defaultChecked /> {t('thai')}</label></div>
          </div>
        </div>
      </section>
      <hr className="reg-divider" />
      <section className="reg-section">
        <h2 className="reg-section-title">{t('addressByIdCard')}</h2>
        <div className="reg-grid">
          <div className="reg-field"><span className="reg-label">{t('addressNo')}<span className="reg-required">*</span></span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('moo')}</span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('building')}</span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('floor')}</span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('soi')}</span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('road')}</span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('province')}<span className="reg-required">*</span></span><select className="reg-select"><option value="">{t('selectProvince')}</option><option>กรุงเทพมหานคร</option></select></div>
          <div className="reg-field"><span className="reg-label">{t('district')}<span className="reg-required">*</span></span><select className="reg-select"><option value="">{t('selectDistrict')}</option></select></div>
          <div className="reg-field"><span className="reg-label">{t('subDistrict')}<span className="reg-required">*</span></span><select className="reg-select"><option value="">{t('selectSubDistrict')}</option></select></div>
          <div className="reg-field"><span className="reg-label">{t('postalCode')}<span className="reg-required">*</span></span><input className="reg-input" type="text" /></div>
        </div>
      </section>
      <hr className="reg-divider" />
      <section className="reg-consent">
        <div className="reg-consent-item"><input type="checkbox" id="pdpa" /><label htmlFor="pdpa">{t('pdpaLong')} <a href="#">{t('viewMore')}</a></label></div>
        <div className="reg-consent-item"><input type="checkbox" id="consent_form" /><label htmlFor="consent_form">{t('consentForm')} <a href="#">{t('viewMore')}</a></label></div>
      </section>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <button className="reg-btn-draft" type="button"><Save size={16} /> {t('saveDraft')}</button>
      </div>
    </>
  )
}

/* ========== STEP 3 ========== */
function Step3({ t }: { t: TFn }) {
  return (
    <section className="reg-section">
      <h2 className="reg-section-title">{t('bankTitle')}</h2>
      <p className="reg-section-desc">{t('bankDesc')}</p>
      <div className="reg-grid">
        <div className="reg-field"><span className="reg-label">{t('bank')}<span className="reg-required">*</span></span>
          <select className="reg-select"><option value="">{t('selectBank')}</option><option>{t('bankBkk')}</option><option>{t('bankKbank')}</option><option>{t('bankKtb')}</option><option>{t('bankScb')}</option><option>{t('bankBay')}</option><option>{t('bankTtb')}</option></select>
        </div>
        <div className="reg-field"><span className="reg-label">{t('accountNo')}<span className="reg-required">*</span></span><input className="reg-input" type="text" /></div>
        <div className="reg-field"><span className="reg-label">{t('accountName')}<span className="reg-required">*</span></span><input className="reg-input" type="text" /></div>
        <div className="reg-field"><span className="reg-label">{t('accountType')}<span className="reg-required">*</span></span>
          <select className="reg-select"><option value="">{t('selectAccountType')}</option><option>{t('savings')}</option><option>{t('current')}</option></select>
        </div>
        <div className="reg-field"><span className="reg-label">{t('branch')}<span className="reg-required">*</span></span><input className="reg-input" type="text" /></div>
      </div>
      <div style={{ marginTop: 24 }}>
        <span className="reg-label" style={{ display: 'block', marginBottom: 12 }}>{t('supportingDocs')}</span>
        <p className="reg-section-desc">{t('bankDocDesc')}</p>
        <div style={{ border: '2px dashed #d1d5db', borderRadius: 10, padding: '40px 20px', textAlign: 'center', color: '#94a3b8', cursor: 'pointer' }}>
          <FileText size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p style={{ margin: 0, fontSize: 14 }}>{t('dragOrClick')} <span style={{ color: '#059669', fontWeight: 700 }}>{t('clickToSelect')}</span></p>
          <p style={{ margin: '4px 0 0', fontSize: 12 }}>{t('fileFormats')}</p>
        </div>
      </div>
    </section>
  )
}

/* ========== STEP 4 ========== */
function Step4({ t }: { t: TFn }) {
  const docs = [t('docIdCard'), t('docHouseReg'), t('docCertificate'), t('docShopPhoto'), t('docWebScreenshot'), t('docDomainReg')]
  return (
    <section className="reg-section">
      <h2 className="reg-section-title">{t('confirmDocTitle')}</h2>
      <p className="reg-section-desc">{t('confirmDocDesc')}</p>
      <div className="reg-grid-2" style={{ marginBottom: 24 }}>
        <SummaryCard icon={<Store size={20} />} title={t('cardShopInfo')} items={[[t('shopNameLabel'), 'อินฟินิตี้พิกช็อป'], [t('shopNameEnLabel'), 'InfinityPickShop'], [t('categoryLabel'), `${t('individual')} · ${t('online')}`], [t('bizCategoryLabel'), 'E-commerce']]} />
        <SummaryCard icon={<Users size={20} />} title={t('cardContactInfo')} items={[[t('name'), t('na')], [t('phone'), t('na')], [t('email'), 'infinitypickshop@gmail.com']]} />
        <SummaryCard icon={<Landmark size={20} />} title={t('cardBankInfo')} items={[[t('bank'), t('na')], [t('accountNo'), t('na')], [t('accountName'), t('na')]]} />
        <SummaryCard icon={<Package size={20} />} title={t('cardProductInfo')} items={[[t('productLabel'), 'Marketplace'], [t('priceRange'), '฿62 — ฿3,627'], [t('productUsage'), 'QR Cash']]} />
      </div>
      <div style={{ marginTop: 24 }}>
        <span className="reg-label" style={{ display: 'block', marginBottom: 12 }}>{t('uploadDocs')}</span>
        <div className="reg-grid">
          {docs.map((doc, i) => (
            <div key={i} style={{ border: '2px dashed #d1d5db', borderRadius: 8, padding: '24px 16px', textAlign: 'center', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>
              <FileText size={24} style={{ marginBottom: 6, opacity: 0.5 }} />
              <p style={{ margin: 0, fontWeight: 600 }}>{doc}</p>
              <p style={{ margin: '4px 0 0', fontSize: 11 }}>{t('clickToUpload')}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SummaryCard({ icon, title, items }: { icon: React.ReactNode; title: string; items: [string, string][] }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, background: '#f8fafc' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: '#047857' }}>{icon}<strong style={{ fontSize: 14, color: '#0f172a' }}>{title}</strong></div>
      {items.map(([label, value], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: i < items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
          <span style={{ color: '#64748b' }}>{label}</span><span style={{ fontWeight: 600, color: '#0f172a' }}>{value}</span>
        </div>
      ))}
    </div>
  )
}

/* ========== STEP 5 ========== */
function Step5({ t, suppliers, onRemove, onAdd }: { t: TFn; suppliers: Supplier[]; onRemove: (id: string) => void; onAdd: () => void }) {
  return (
    <section className="reg-section">
      <h2 className="reg-section-title">{t('supplierTitle')}</h2>
      <p className="reg-section-desc">{t('supplierDesc')}</p>
      {suppliers.length > 0 && (
        <div className="reg-supplier-table-wrap">
          <table className="reg-supplier-table">
            <thead><tr><th>{t('colNo')}</th><th>{t('colSupplierName')}</th><th>{t('colTaxId')}</th><th>{t('colBank')}</th><th>{t('colAccountNo')}</th><th>{t('colAccountName')}</th><th>{t('colActions')}</th></tr></thead>
            <tbody>
              {suppliers.map((s, i) => (
                <tr key={s.id}>
                  <td>{i + 1}</td><td>{s.name || '—'}</td><td>{s.taxId || '—'}</td><td>{s.bankName || '—'}</td><td>{s.bankAccount || '—'}</td><td>{s.accountHolder || '—'}</td>
                  <td><div className="reg-supplier-actions"><button className="reg-supplier-btn" type="button"><Pencil size={15} /></button><button className="reg-supplier-btn delete" type="button" onClick={() => onRemove(s.id)}><Trash2 size={15} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button className="reg-add-supplier-btn" type="button" onClick={onAdd}><Plus size={16} /> {t('addSupplier')}</button>
      <hr className="reg-divider" />
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#0f172a' }}>{t('addSupplierNew')}</h3>
        <div className="reg-grid">
          <div className="reg-field"><span className="reg-label">{t('companyName')}<span className="reg-required">*</span></span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('taxId')}<span className="reg-required">*</span></span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('bank')}<span className="reg-required">*</span></span>
            <select className="reg-select"><option value="">{t('selectBank')}</option><option>{t('bankBkk')}</option><option>{t('bankKbank')}</option><option>{t('bankKtb')}</option><option>{t('bankScb')}</option><option>{t('bankBay')}</option><option>{t('bankTtb')}</option></select>
          </div>
          <div className="reg-field"><span className="reg-label">{t('accountNo')}<span className="reg-required">*</span></span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('accountName')}<span className="reg-required">*</span></span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('accountType')}</span><select className="reg-select"><option>{t('savings')}</option><option>{t('current')}</option></select></div>
        </div>
      </div>
    </section>
  )
}

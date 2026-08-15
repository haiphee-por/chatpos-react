import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Calendar,
  Check,
  FileText,
  Landmark,
  LogOut,
  MapPin,
  ShieldCheck,
  Upload,
  Users,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'
import './MerchantRegistrationView.css'
import { usePdT, type Lang } from './registrationI18n'
import { registerPd } from './dbApi'

type TFn = (key: string) => string

export function PdRegistrationView() {
  const [stage, setStage] = useState<'quick' | 'wizard'>('quick')
  const [showDecisionModal, setShowDecisionModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quickError, setQuickError] = useState('')

  const [quickData, setQuickData] = useState({
    name: '',
    territory: '',
    phone: '',
    email: '',
    password: '',
  })

  const [currentStep, setCurrentStep] = useState(0)
  const [lang, setLang] = useState<Lang>('TH')
  const t = usePdT(lang)
  const [experiences, setExperiences] = useState<Set<number>>(new Set())
  const [regions, setRegions] = useState<Set<number>>(new Set())

  const pdSteps = [t('step1'), t('step2'), t('step3'), t('step4'), t('step5')]
  const pct = Math.round(((currentStep + 1) / pdSteps.length) * 100)
  const stepperFill = currentStep === 0 ? 0 : (currentStep / (pdSteps.length - 1)) * 100

  const goNext = () => { if (currentStep < pdSteps.length - 1) setCurrentStep(currentStep + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const goBack = () => { if (currentStep > 0) setCurrentStep(currentStep - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const toggleSet = (set: Set<number>, idx: number, setter: (s: Set<number>) => void) => {
    const n = new Set(set)
    n.has(idx) ? n.delete(idx) : n.add(idx)
    setter(n)
  }

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setQuickError('')

    if (!quickData.name.trim()) {
      setQuickError('กรุณาระบุชื่อ-นามสกุล')
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
      const res = await registerPd({
        name: quickData.name.trim(),
        email: quickData.email.trim(),
        password: quickData.password,
        phone: quickData.phone.trim(),
        displayName: quickData.name.trim(),
        investmentAmount: 25000,
      })

      if (res.success) {
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
            <button className="reg-logout-btn" type="button" onClick={() => { window.location.href = '/pd/login' }}>
              <span>{t('logout')}</span><LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="reg-main">
        {/* PHASE 1: Quick PD Sign-up */}
        {stage === 'quick' ? (
          <div className="reg-quick-card">
            <div className="reg-quick-hero">
              <div className="reg-stage-badge">
                <Briefcase size={15} /> สเต็ปที่ 1: สมัครเป็น Partner Director (1 นาที)
              </div>
              <h1>ร่วมเป็น Partner Director (PD)</h1>
              <p>กรอกข้อมูลเบื้องต้นเพื่อสร้างบัญชีผู้ดูแลพื้นที่และเข้าสู่แดชบอร์ดบริหาร</p>
            </div>

            {quickError && (
              <div className="reg-notice" style={{ background: '#fef2f2', borderColor: '#fca5a5', marginBottom: '20px' }}>
                <AlertTriangle className="reg-notice-icon" style={{ color: '#dc2626' }} size={20} />
                <div style={{ color: '#b91c1c', fontWeight: 600, fontSize: '13px' }}>
                  {quickError}
                  {quickError.includes('อีเมลนี้ถูกใช้งานแล้ว') && (
                    <span style={{ marginLeft: '6px' }}>
                      👉 <a href="/pd/login" style={{ color: '#b91c1c', textDecoration: 'underline', fontWeight: 700 }}>คลิกที่นี่เพื่อเข้าสู่ระบบ</a>
                    </span>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleQuickSubmit} className="reg-quick-form">
              <div className="reg-grid reg-grid-2">
                <div className="reg-field reg-col-span-2">
                  <span className="reg-label">ชื่อ-นามสกุล <span className="reg-required">*</span></span>
                  <input
                    className="reg-input"
                    type="text"
                    placeholder="เช่น นายนพดล บริหารกิจ"
                    value={quickData.name}
                    onChange={(e) => setQuickData({ ...quickData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="reg-field reg-col-span-2">
                  <span className="reg-label">พื้นที่จังหวัดหรือเขตที่ต้องการบริหาร <span className="reg-required">*</span></span>
                  <input
                    className="reg-input"
                    type="text"
                    placeholder="เช่น กรุงเทพฯ เขตจตุจักร / นนทบุรี / ชลบุรี"
                    value={quickData.territory}
                    onChange={(e) => setQuickData({ ...quickData, territory: e.target.value })}
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
                    placeholder="pd@yourcompany.com"
                    value={quickData.email}
                    onChange={(e) => setQuickData({ ...quickData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="reg-field reg-col-span-2">
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
              </div>

              <button type="submit" className="reg-quick-submit-btn" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span>กำลังสร้างบัญชี PD...</span>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>สมัครเป็น Partner Director ทันที 🚀</span>
                  </>
                )}
              </button>

              <div className="reg-quick-footer-link">
                มีบัญชี PD อยู่แล้ว? <a href="/pd/login">เข้าสู่ระบบที่นี่</a>
              </div>
            </form>
          </div>
        ) : (
          /* PHASE 2: Detailed PD Business & KYC Wizard */
          <div className="reg-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div className="reg-stage-badge">
                <FileText size={14} /> สเต็ปที่ 2: กรอกข้อมูลสัญญา & บัญชีรับผลประโยชน์ PD (KYC)
              </div>
              <button
                type="button"
                onClick={() => (window.location.href = '/pd')}
                style={{ background: 'transparent', border: '0', color: 'var(--reg-primary)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                ข้ามไปหน้าแดชบอร์ดก่อน ➔
              </button>
            </div>

            <h1 className="reg-title">{t('pageTitle')}</h1>
            <div className="reg-stepper">
              <div className="reg-stepper-line"><div className="reg-stepper-fill" style={{ width: `${stepperFill}%` }} /></div>
              {pdSteps.map((label, i) => (
                <div key={i} className={`reg-step ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''}`}
                  onClick={() => i < currentStep && setCurrentStep(i)} style={{ cursor: i < currentStep ? 'pointer' : 'default' }}>
                  <div className="reg-step-circle">{i < currentStep ? <Check size={16} /> : i + 1}</div>
                  <span className="reg-step-label">{label}</span>
                </div>
              ))}
            </div>
            <div className="reg-progress">
              <div className="reg-progress-header">
                <span className="reg-progress-step">{t('step')} {currentStep + 1}/{pdSteps.length}</span>
                <span className="reg-progress-pct">{pct}%</span>
              </div>
              <div className="reg-progress-track"><div className="reg-progress-fill" style={{ width: `${pct}%` }} /></div>
            </div>

            <div className="reg-step-content" key={`${currentStep}-${lang}`}>
              {currentStep === 0 && <PdStep1Personal t={t} />}
              {currentStep === 1 && <PdStep2Business t={t} experiences={experiences} toggleExp={(i: number) => toggleSet(experiences, i, setExperiences)} />}
              {currentStep === 2 && <PdStep3Territory t={t} regions={regions} toggleRegion={(i: number) => toggleSet(regions, i, setRegions)} />}
              {currentStep === 3 && <PdStep4Bank t={t} />}
              {currentStep === 4 && <PdStep5Confirm t={t} />}
            </div>

            <div className="reg-nav-buttons">
              <button className="reg-btn-back" onClick={goBack} disabled={currentStep === 0} type="button"><ArrowLeft size={16} /> {t('back')}</button>
              {currentStep < pdSteps.length - 1 ? (
                <button className="reg-btn-next" onClick={goNext} type="button">{t('next')} <ArrowRight size={16} /></button>
              ) : (
                <button
                  className="reg-btn-next"
                  onClick={() => {
                    alert('🎉 ส่งเอกสารสัญญา PD และยืนยันตัวตนเรียบร้อยแล้ว!\n\nเจ้าหน้าที่จะประสานงานเปิดเขตพื้นที่ให้ท่านภายใน 24 ชม.')
                    window.location.href = '/pd'
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

      {/* Decision Modal after Quick PD Registration */}
      {showDecisionModal && (
        <div className="reg-modal-backdrop">
          <div className="reg-decision-modal">
            <img src="/mascot/nabtang_presenting.png" alt="PD Mascot" className="reg-decision-mascot" />
            <h2 className="reg-decision-title">🎉 สมัครเป็น Partner Director สำเร็จ!</h2>
            <p className="reg-decision-desc">
              บัญชี PD สำหรับคุณ <strong>"{quickData.name}"</strong> ถูกสร้างในระบบแล้ว คุณสามารถเลือกดำเนินการต่อได้ดังนี้:
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
                  <strong>📄 กรอกสัญญาและบัญชีรับผลประโยชน์ PD (KYC)</strong>
                  <span>ระบุพื้นที่ดูแลและผูกบัญชีรับค่าบริหารส่วนกลางทันที</span>
                </div>
                <ArrowRight size={20} style={{ color: 'var(--reg-primary)' }} />
              </div>

              <div
                className="reg-decision-card-btn secondary"
                onClick={() => {
                  window.location.href = '/pd'
                }}
                role="button"
                tabIndex={0}
              >
                <div className="reg-card-btn-text">
                  <strong>🏢 เข้าสู่ระบบ PD Operations Center ทันที</strong>
                  <span>เริ่มดูภาพรวมสายงานและเครื่องมือบริหาร (ส่งเอกสาร KYC ภายหลังได้)</span>
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

function PdStep1Personal({ t }: { t: TFn }) {
  return (
    <>
      <div className="reg-notice">
        <AlertTriangle className="reg-notice-icon" size={22} />
        <div>
          <h3>{t('noticeTitle')}</h3>
          <ul>
            <li>1. {t('notice1')}</li>
            <li>2. {t('notice2')}</li>
            <li>3. {t('notice3')}</li>
            <li>4. {t('notice4')}</li>
          </ul>
        </div>
      </div>

      <section className="reg-section">
        <h2 className="reg-section-title">{t('personalTitle')}</h2>
        <p className="reg-section-desc">{t('personalDesc')}</p>
        <div className="reg-grid">
          <div className="reg-field"><span className="reg-label">{t('prefix')}<span className="reg-required">*</span></span>
            <select className="reg-select"><option value="">{t('selectPrefix')}</option><option>{t('prefixMr')}</option><option>{t('prefixMs')}</option><option>{t('prefixMrs')}</option></select>
          </div>
          <div className="reg-field"><span className="reg-label">{t('firstNameTh')}<span className="reg-required">*</span></span><input className="reg-input" type="text" placeholder={t('enterText')} /></div>
          <div className="reg-field"><span className="reg-label">{t('lastNameTh')}<span className="reg-required">*</span></span><input className="reg-input" type="text" placeholder={t('enterText')} /></div>
          <div className="reg-field"><span className="reg-label">{t('firstNameEn')}<span className="reg-required">*</span></span><input className="reg-input" type="text" placeholder="First Name" /></div>
          <div className="reg-field"><span className="reg-label">{t('lastNameEn')}<span className="reg-required">*</span></span><input className="reg-input" type="text" placeholder="Last Name" /></div>
          <div className="reg-field"><span className="reg-label">{t('idCard')}<span className="reg-required">*</span></span><input className="reg-input" type="text" placeholder={t('idCardPlaceholder')} /></div>
          <div className="reg-field"><span className="reg-label">{t('idCardExpiry')}<span className="reg-required">*</span></span>
            <div className="reg-date-wrap"><input className="reg-input" type="text" placeholder={t('datePlaceholder')} /><Calendar className="reg-date-icon" size={18} /></div>
          </div>
          <div className="reg-field"><span className="reg-label">{t('dob')}<span className="reg-required">*</span></span>
            <div className="reg-date-wrap"><input className="reg-input" type="text" placeholder={t('datePlaceholder')} /><Calendar className="reg-date-icon" size={18} /></div>
          </div>
          <div className="reg-field"><span className="reg-label">{t('nationality')}<span className="reg-required">*</span></span>
            <div className="reg-radio-group"><label className="reg-radio-label"><input type="radio" name="pd_nat" defaultChecked /> {t('thai')}</label><label className="reg-radio-label"><input type="radio" name="pd_nat" /> {t('other')}</label></div>
          </div>
        </div>
      </section>

      <hr className="reg-divider" />

      <section className="reg-section">
        <h2 className="reg-section-title">{t('contactTitle')}</h2>
        <div className="reg-grid">
          <div className="reg-field"><span className="reg-label">{t('phone')}<span className="reg-required">*</span></span><input className="reg-input" type="text" placeholder={t('phonePlaceholder')} /></div>
          <div className="reg-field"><span className="reg-label">{t('email')}<span className="reg-required">*</span></span><input className="reg-input" type="email" placeholder="email@example.com" /></div>
          <div className="reg-field"><span className="reg-label">{t('lineId')}</span><input className="reg-input" type="text" placeholder={t('lineId')} /></div>
        </div>
      </section>

      <hr className="reg-divider" />

      <section className="reg-section">
        <h2 className="reg-section-title">{t('currentAddress')}</h2>
        <div className="reg-grid">
          <div className="reg-field"><span className="reg-label">{t('addressNo')}<span className="reg-required">*</span></span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('moo')}</span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('building')}</span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('soi')}</span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('road')}</span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('province')}<span className="reg-required">*</span></span><select className="reg-select"><option value="">{t('selectProvince')}</option><option>กรุงเทพมหานคร</option></select></div>
          <div className="reg-field"><span className="reg-label">{t('district')}<span className="reg-required">*</span></span><select className="reg-select"><option value="">{t('selectDistrict')}</option></select></div>
          <div className="reg-field"><span className="reg-label">{t('subDistrict')}<span className="reg-required">*</span></span><select className="reg-select"><option value="">{t('selectSubDistrict')}</option></select></div>
          <div className="reg-field"><span className="reg-label">{t('postalCode')}<span className="reg-required">*</span></span><input className="reg-input" type="text" /></div>
        </div>
      </section>
    </>
  )
}

function PdStep2Business({ t, experiences, toggleExp }: { t: TFn; experiences: Set<number>; toggleExp: (i: number) => void }) {
  const expKeys = ['exp1','exp2','exp3','exp4','exp5','exp6'] as const

  return (
    <>
      <section className="reg-section">
        <h2 className="reg-section-title">{t('bizTitle')}</h2>
        <p className="reg-section-desc">{t('bizDesc')}</p>
        <div className="reg-grid">
          <div className="reg-field"><span className="reg-label">{t('type')}<span className="reg-required">*</span></span>
            <div className="reg-radio-group"><label className="reg-radio-label"><input type="radio" name="pd_biz" defaultChecked /> {t('individual')}</label><label className="reg-radio-label"><input type="radio" name="pd_biz" /> {t('juristic')}</label></div>
          </div>
          <div className="reg-field"><span className="reg-label">{t('companyName')}</span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('regNo')}</span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('position')}<span className="reg-required">*</span></span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('experience')}<span className="reg-required">*</span></span>
            <select className="reg-select">
              <option value="">{t('selectExperience')}</option>
              <option>{t('expLess1')}</option><option>{t('exp1to3')}</option><option>{t('exp3to5')}</option><option>{t('exp5to10')}</option><option>{t('expMore10')}</option>
            </select>
          </div>
          <div className="reg-field"><span className="reg-label">{t('agentCount')}</span>
            <select className="reg-select">
              <option value="">{t('selectCount')}</option>
              <option>{t('count1to10')}</option><option>{t('count11to30')}</option><option>{t('count31to50')}</option><option>{t('count51to100')}</option><option>{t('countMore100')}</option>
            </select>
          </div>
        </div>
      </section>

      <hr className="reg-divider" />

      <section className="reg-section">
        <h2 className="reg-section-title">{t('expTitle')}</h2>
        <p className="reg-section-desc">{t('expDesc')}</p>
        <div className="reg-selectable-grid">
          {expKeys.map((k, i) => (
            <label className="reg-selectable-card" key={i}>
              <input type="checkbox" checked={experiences.has(i)} onChange={() => toggleExp(i)} />
              <div className="reg-selectable-inner"><span className="reg-circle-icon"><Check size={14} /></span><span>{t(k)}</span></div>
            </label>
          ))}
        </div>
      </section>

      <hr className="reg-divider" />

      <section className="reg-section">
        <h2 className="reg-section-title">{t('motivationTitle')}</h2>
        <div className="reg-field">
          <span className="reg-label">{t('motivationLabel')}<span className="reg-required">*</span></span>
          <textarea className="reg-input reg-textarea" placeholder={t('motivationPlaceholder')} />
        </div>
      </section>
    </>
  )
}

function PdStep3Territory({ t, regions, toggleRegion }: { t: TFn; regions: Set<number>; toggleRegion: (i: number) => void }) {
  const regionKeys = ['region1','region2','region3','region4','region5','region6','region7','region8'] as const

  return (
    <>
      <section className="reg-section">
        <h2 className="reg-section-title">{t('territoryTitle')}</h2>
        <p className="reg-section-desc">{t('territoryDesc')}</p>
        <div className="reg-selectable-grid">
          {regionKeys.map((k, i) => (
            <label className="reg-selectable-card" key={i}>
              <input type="checkbox" checked={regions.has(i)} onChange={() => toggleRegion(i)} />
              <div className="reg-selectable-inner"><span className="reg-circle-icon"><Check size={14} /></span><span>{t(k)}</span></div>
            </label>
          ))}
        </div>
      </section>

      <hr className="reg-divider" />

      <section className="reg-section">
        <h2 className="reg-section-title">{t('areaDetailTitle')}</h2>
        <div className="reg-grid">
          <div className="reg-field"><span className="reg-label">{t('mainProvince')}<span className="reg-required">*</span></span>
            <select className="reg-select"><option value="">{t('selectMainProvince')}</option><option>กรุงเทพมหานคร</option><option>เชียงใหม่</option><option>ขอนแก่น</option><option>สงขลา</option><option>ชลบุรี</option></select>
          </div>
          <div className="reg-field"><span className="reg-label">{t('shopEstimate')}</span>
            <select className="reg-select"><option value="">{t('selectCount')}</option><option>{t('shop1to50')}</option><option>{t('shop51to200')}</option><option>{t('shop201to500')}</option><option>{t('shopMore500')}</option></select>
          </div>
          <div className="reg-field"><span className="reg-label">{t('hasVehicle')}<span className="reg-required">*</span></span>
            <div className="reg-radio-group"><label className="reg-radio-label"><input type="radio" name="pd_car" defaultChecked /> {t('yes')}</label><label className="reg-radio-label"><input type="radio" name="pd_car" /> {t('no')}</label></div>
          </div>
        </div>
      </section>

      <hr className="reg-divider" />

      <section className="reg-section">
        <h2 className="reg-section-title">{t('referralTitle')}</h2>
        <p className="reg-section-desc">{t('referralDesc')}</p>
        <div className="reg-grid">
          <div className="reg-field"><span className="reg-label">{t('referralCode')}</span><input className="reg-input" type="text" placeholder="PD-001" /></div>
          <div className="reg-field"><span className="reg-label">{t('referralName')}</span><input className="reg-input" type="text" /></div>
          <div className="reg-field"><span className="reg-label">{t('referralPhone')}</span><input className="reg-input" type="text" placeholder={t('phonePlaceholder')} /></div>
        </div>
      </section>
    </>
  )
}

function PdStep4Bank({ t }: { t: TFn }) {
  return (
    <section className="reg-section">
      <h2 className="reg-section-title">{t('bankTitle')}</h2>
      <p className="reg-section-desc">{t('bankForRoyalty')}</p>
      <div className="reg-grid">
        <div className="reg-field"><span className="reg-label">{t('bank')}<span className="reg-required">*</span></span>
          <select className="reg-select"><option value="">{t('selectBank')}</option><option>{t('bankBkk')}</option><option>{t('bankKbank')}</option><option>{t('bankKtb')}</option><option>{t('bankScb')}</option><option>{t('bankBay')}</option><option>{t('bankTtb')}</option></select>
        </div>
        <div className="reg-field"><span className="reg-label">{t('accountNo')}<span className="reg-required">*</span></span><input className="reg-input" type="text" /></div>
        <div className="reg-field"><span className="reg-label">{t('accountName')}<span className="reg-required">*</span></span><input className="reg-input" type="text" placeholder={t('accountMatchNote')} /></div>
        <div className="reg-field"><span className="reg-label">{t('accountType')}<span className="reg-required">*</span></span>
          <select className="reg-select"><option>{t('savings')}</option><option>{t('current')}</option></select>
        </div>
        <div className="reg-field"><span className="reg-label">{t('branch')}<span className="reg-required">*</span></span><input className="reg-input" type="text" /></div>
      </div>
      <div style={{ marginTop: 24 }}>
        <span className="reg-label" style={{ display: 'block', marginBottom: 12 }}>{t('uploadBookbank')}</span>
        <div style={{ border: '2px dashed #d1d5db', borderRadius: 10, padding: '40px 20px', textAlign: 'center', color: '#94a3b8', cursor: 'pointer' }}>
          <Upload size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p style={{ margin: 0, fontSize: 14 }}>{t('dragOrClick')} <span style={{ color: '#059669', fontWeight: 700 }}>{t('clickToSelect')}</span></p>
          <p style={{ margin: '4px 0 0', fontSize: 12 }}>{t('fileFormats')}</p>
        </div>
      </div>
    </section>
  )
}

function PdStep5Confirm({ t }: { t: TFn }) {
  const docs = [t('docIdCard'), t('docHouseReg'), t('docCertificate'), t('docBookbank'), t('docResume'), t('docPhoto')]

  return (
    <>
      <section className="reg-section">
        <h2 className="reg-section-title">{t('confirmTitle')}</h2>
        <p className="reg-section-desc">{t('confirmDesc')}</p>
        <div className="reg-grid-2" style={{ marginBottom: 24 }}>
          <SummaryCard icon={<Users size={20} />} title={t('cardPersonal')} items={[[t('name'), t('na')], [t('cardNo'), t('na')], [t('phone'), t('na')], [t('email'), t('na')]]} />
          <SummaryCard icon={<Briefcase size={20} />} title={t('cardBusiness')} items={[[t('type'), t('na')], [t('positionLabel'), t('na')], [t('expLabel'), t('na')]]} />
          <SummaryCard icon={<MapPin size={20} />} title={t('cardTerritory')} items={[[t('regionLabel'), t('na')], [t('mainProvinceLabel'), t('na')], [t('targetShops'), t('na')]]} />
          <SummaryCard icon={<Landmark size={20} />} title={t('cardBank')} items={[[t('bank'), t('na')], [t('accountNo'), t('na')], [t('accountName'), t('na')]]} />
        </div>
      </section>

      <hr className="reg-divider" />

      <section className="reg-section">
        <h2 className="reg-section-title">{t('documentsTitle')}</h2>
        <p className="reg-section-desc">{t('documentsDesc')}</p>
        <div className="reg-grid">
          {docs.map((doc, i) => (
            <div key={i} style={{ border: '2px dashed #d1d5db', borderRadius: 8, padding: '24px 16px', textAlign: 'center', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>
              <FileText size={24} style={{ marginBottom: 6, opacity: 0.5 }} />
              <p style={{ margin: 0, fontWeight: 600 }}>{doc}</p>
              <p style={{ margin: '4px 0 0', fontSize: 11 }}>{t('clickToUpload')}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="reg-divider" />

      <section className="reg-consent">
        <div className="reg-consent-item"><input type="checkbox" id="pd_pdpa" /><label htmlFor="pd_pdpa">{t('pdpaConsent')} <a href="#">{t('viewDetails')}</a></label></div>
        <div className="reg-consent-item"><input type="checkbox" id="pd_terms" /><label htmlFor="pd_terms">{t('termsConsent')} <a href="#">{t('viewDetails')}</a></label></div>
        <div className="reg-consent-item"><input type="checkbox" id="pd_verify" /><label htmlFor="pd_verify">{t('verifyInfo')}</label></div>
      </section>
    </>
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

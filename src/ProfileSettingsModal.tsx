import React, { useState, useEffect } from 'react'
import { Bell, Camera, CheckCircle2, KeyRound, Shield, Store, User, X, Key, RefreshCw, Server, AlertCircle, Code, Copy, Check } from 'lucide-react'
import { getStoredApiKey, setStoredApiKey, fetchBalance, createTransactionCommand, checkTransactionStatus, authenticateApi, transactionQrImageUrl } from './chatposApi'
import { getStoredUser } from './dbApi'

export type ProfileData = {
  role: 'admin' | 'pd' | 'agent' | 'merchant' | 'customer'
  name: string
  title: string
  email: string
  phone: string
  avatarUrl: string
  storeName?: string
  promptPayId?: string
  bankName?: string
  bankAccount?: string
  lineNotify?: boolean
  emailNotify?: boolean
  twoFactor?: boolean
  apiKey?: string
}

const defaultProfiles: Record<string, ProfileData> = {
  admin: {
    role: 'admin',
    name: '',
    title: 'HQ System Administrator',
    email: '',
    phone: '',
    avatarUrl: '/mascot/nabtang_holding_gold.png',
    lineNotify: true,
    emailNotify: true,
    twoFactor: true
  },
  pd: {
    role: 'pd',
    name: '',
    title: 'Partner Director (PD)',
    email: '',
    phone: '',
    avatarUrl: '/mascot/nabtang_presenting.png',
    lineNotify: true,
    emailNotify: true,
    twoFactor: false
  },
  agent: {
    role: 'agent',
    name: '',
    title: 'ตัวแทนขยายร้านค้า (Agent)',
    email: '',
    phone: '',
    avatarUrl: '/mascot/nabtang_analytics.png',
    lineNotify: true,
    emailNotify: false,
    twoFactor: false
  },
  merchant: {
    role: 'merchant',
    name: '',
    title: 'เจ้าของร้าน (Merchant Owner)',
    email: '',
    phone: '',
    avatarUrl: '/mascot/pos_1_front.png',
    storeName: '',
    promptPayId: '',
    bankName: '',
    bankAccount: '',
    lineNotify: true,
    emailNotify: true,
    twoFactor: false
  }
}

export function ProfileSettingsModal({
  isOpen,
  role = 'admin',
  onClose
}: {
  isOpen: boolean
  role?: 'admin' | 'pd' | 'agent' | 'merchant'
  onClose: () => void
}) {
  const initial = defaultProfiles[role] ?? defaultProfiles.admin
  const [profile, setProfile] = useState<ProfileData>(initial)
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'business' | 'api'>('profile')

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // API Key fields & Testing
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [selectedEndpoint, setSelectedEndpoint] = useState<'balance' | 'create_qr' | 'check_payment' | 'auth' | 'create_payout'>('balance')
  const [paramRef, setParamRef] = useState('PAY-REF-100293')
  const [paramAmount, setParamAmount] = useState('100')
  const [paramDescription, setParamDescription] = useState('ชำระค่าสินค้า POS')
  const [apiLoading, setApiLoading] = useState(false)
  const [apiResult, setApiResult] = useState<any>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)

  // Status banners
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      const savedKey = getStoredApiKey()
      setApiKeyInput(savedKey)

      const stored = getStoredUser()
      if (stored) {
        setProfile((prev) => ({
          ...prev,
          name: stored.name || prev.name,
          email: stored.email || prev.email,
          phone: stored.phone || prev.phone,
          storeName: stored.store?.name || prev.storeName,
          title: stored.role === 'owner' ? 'เจ้าของร้านค้า (Merchant Owner)' : (stored.role === 'pd' ? 'ผู้อำนวยการพื้นที่ (PD)' : (stored.role === 'agent' ? 'ตัวแทนขยายร้านค้า (Agent)' : prev.title)),
        }))
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    setToastMessage('การบันทึกโปรไฟล์ยังไม่พร้อมใช้งาน กรุณาใช้ Merchant profile API ที่ผ่าน server integration')
    setTimeout(() => setToastMessage(null), 2500)
  }

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      setPasswordError('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน')
      return
    }

    setPasswordError(null)
    setToastMessage('การเปลี่ยนรหัสผ่านยังไม่พร้อมใช้งานในหน้านี้')
    setTimeout(() => setToastMessage(null), 2500)
  }

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault()
    setStoredApiKey(apiKeyInput)
    setToastMessage('API Key จะถูกใช้ชั่วคราวและไม่ถูกบันทึกในเบราว์เซอร์')
    setTimeout(() => setToastMessage(null), 2500)
  }

  const handleTestEndpoint = async () => {
    setApiLoading(true)
    setApiError(null)
    setApiResult(null)

    const keyToUse = apiKeyInput.trim()
    if (keyToUse) {
      setStoredApiKey(keyToUse)
    }

    try {
      let data: any
      if (selectedEndpoint === 'balance') {
        data = await fetchBalance(keyToUse)
      } else if (selectedEndpoint === 'create_qr') {
        data = await createTransactionCommand({
          amount: Number(paramAmount) || 100,
          note: paramDescription || 'Payment QR Test',
          orderId: `ORD-${Date.now()}`
        }, `profile-test:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`, keyToUse)
      } else if (selectedEndpoint === 'check_payment') {
        data = await checkTransactionStatus(paramRef || 'PAY-REF-100293', keyToUse)
      } else if (selectedEndpoint === 'auth') {
        data = await authenticateApi({}, keyToUse)
      } else if (selectedEndpoint === 'create_payout') {
        throw new Error('Payout ยังไม่พร้อมใช้งาน: ต้องรอ withdrawal และ provider reconciliation contract')
      }

      setApiResult(data)
      setToastMessage(`เรียกใช้ API [${selectedEndpoint.toUpperCase()}] สำเร็จ! 🚀`)
      setTimeout(() => setToastMessage(null), 3000)
    } catch (err: any) {
      setApiError(err?.message || 'ไม่สามารถเชื่อมต่อ API ได้ หรือ API Key / Parameters ไม่ถูกต้อง')
    } finally {
      setApiLoading(false)
    }
  }

  const generateCodeSnippet = () => {
    const keyStr = apiKeyInput.trim() || 'YOUR_API_KEY'
    if (selectedEndpoint === 'balance') {
      return `fetch('https://chatpos.biz/api/v1/balance', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ${keyStr}'
  }
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));`
    }

    if (selectedEndpoint === 'create_qr') {
      return `fetch('https://chatpos.biz/api/v1/transactions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${keyStr}',
    'Content-Type': 'application/json',
    'Idempotency-Key': 'transaction-demo-001'
  },
  body: JSON.stringify({
    amount: ${paramAmount || '100'},
    orderId: 'ORD-${Date.now()}',
    description: '${paramDescription || 'ชำระค่าสินค้า POS'}'
  })
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));`
    }

    if (selectedEndpoint === 'check_payment') {
      return `fetch('https://chatpos.biz/api/v1/transactions/${paramRef || 'PAY-REF-100293'}', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ${keyStr}'
  }
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));`
    }

    if (selectedEndpoint === 'auth') {
      return `fetch('https://chatpos.biz/api/v1/auth', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${keyStr}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    clientId: 'YOUR_CLIENT_ID',
    clientSecret: 'YOUR_CLIENT_SECRET'
  })
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));`
    }

    if (selectedEndpoint === 'create_payout') {
      return `fetch('https://chatpos.biz/api/v1/payouts', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${keyStr}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: ${paramAmount || '500'},
    remark: 'คำขอถอนเงินผ่านระบบ POS'
  })
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));`
    }

    return ''
  }

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(generateCodeSnippet())
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const avatarOptions = [
    '/mascot/nabtang_presenting.png',
    '/mascot/kyc_3_checking_documents.png',
    '/mascot/nabtang_analytics.png',
    '/mascot/pos_1_front.png',
    '/mascot/pay_4_money_bag.png',
    '/mascot/nabtang_security.png'
  ]

  return (
    <div className="admin-modal-overlay">
      <button aria-label="Close profile modal backdrop" className="admin-modal-backdrop" onClick={onClose} type="button" />
      <div className="admin-modal-card profile-modal-card">
        <div className="admin-modal-header">
          <div className="modal-title-group">
            <span className="badge-pill green">PROFILE & ACCOUNT SETTINGS</span>
            <h2>⚙️ ตั้งค่าโปรไฟล์และบัญชีผู้ใช้งาน ({role.toUpperCase()})</h2>
            <p className="muted-text">จัดการข้อมูลส่วนตัว ภาพโปรไฟล์ รหัสผ่าน การแจ้งเตือน และ API Key Integration</p>
          </div>
          <button aria-label="Close modal" className="close-modal-btn" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        {toastMessage && (
          <div className="admin-toast-banner">
            <CheckCircle2 size={18} /> {toastMessage}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="profile-tabs">
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={16} /> ข้อมูลส่วนตัว
          </button>

          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <KeyRound size={16} /> รหัสผ่าน & ความปลอดภัย
          </button>

          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveTab('api')}
          >
            <Key size={16} /> ChatPOS API Key
          </button>

          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell size={16} /> การแจ้งเตือน
          </button>

          {role === 'merchant' && (
            <button
              type="button"
              className={`profile-tab-btn ${activeTab === 'business' ? 'active' : ''}`}
              onClick={() => setActiveTab('business')}
            >
              <Store size={16} /> ข้อมูลร้านค้า & การรับเงิน
            </button>
          )}
        </div>

        {/* TAB 1: Profile Info */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="profile-form">
            <div className="avatar-picker-section">
              <div className="avatar-preview-wrap">
                <img src={profile.avatarUrl} alt="Avatar" className="avatar-large" />
                <div className="avatar-cam-badge">
                  <Camera size={14} />
                </div>
              </div>

              <div className="avatar-picker-list">
                <small>เลือกภาพโปรไฟล์ / Mascot:</small>
                <div className="avatar-grid">
                  {avatarOptions.map((url) => (
                    <button
                      type="button"
                      key={url}
                      className={`avatar-option-btn ${profile.avatarUrl === url ? 'selected' : ''}`}
                      onClick={() => setProfile((prev) => ({ ...prev, avatarUrl: url }))}
                    >
                      <img src={url} alt="Mascot avatar" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>ชื่อ-นามสกุลจริง</label>
                <input
                  required
                  value={profile.name}
                  onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>ตำแหน่ง / สิทธิ์ในระบบ</label>
                <input
                  value={profile.title}
                  onChange={(e) => setProfile((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>อีเมลติดต่อ (Email)</label>
                <input
                  type="email"
                  required
                  value={profile.email}
                  onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>เบอร์โทรศัพท์ (Phone)</label>
                <input
                  required
                  value={profile.phone}
                  onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </div>

            <div className="broadcast-footer">
              <button type="button" className="secondary-button" onClick={onClose}>
                ยกเลิก
              </button>
              <button type="submit" className="primary-button">
                บันทึกการเปลี่ยนแปลง
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: Security & Password */}
        {activeTab === 'security' && (
          <form onSubmit={handleChangePassword} className="profile-form">
            {passwordError && (
              <div className="password-error-banner">
                ⚠️ {passwordError}
              </div>
            )}

            <div className="form-group">
              <label>รหัสผ่านปัจจุบัน</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านเดิมเพื่อยืนยันตัวตน"
              />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>รหัสผ่านใหม่ (New Password)</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                />
              </div>

              <div className="form-group">
                <label>ยืนยันรหัสผ่านใหม่ (Confirm Password)</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านใหมีกครั้ง"
                />
              </div>
            </div>

            <div className="two-factor-card">
              <div className="two-factor-left">
                <Shield size={20} className="green-text" />
                <div>
                  <strong>การยืนยันตัวตน 2 ขั้นตอน (Two-Factor Authentication)</strong>
                  <p className="muted-text">เพิ่มความปลอดภัยด้วยการรับรหัส OTP ผ่าน LINE / App Authenticator</p>
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={profile.twoFactor}
                  onChange={(e) => setProfile((prev) => ({ ...prev, twoFactor: e.target.checked }))}
                />
                <span className="slider-round" />
              </label>
            </div>

            <div className="broadcast-footer">
              <button type="button" className="secondary-button" onClick={onClose}>
                ยกเลิก
              </button>
              <button type="submit" className="primary-button">
                อัปเดตรหัสผ่านใหม่
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: ChatPOS API Key Integration & Tester */}
        {activeTab === 'api' && (
          <div className="profile-form">
            {process.env.NODE_ENV === 'production' ? (
              <div className="api-result-box" role="status">
                <div className="api-result-header">
                  <AlertCircle size={18} />
                  <strong>Integration Tester ยังไม่พร้อมใช้งานใน Production</strong>
                </div>
                <p>การทดสอบ API ที่ใช้ Bearer credential ต้องทำจาก server-side integration หรือ environment สำหรับ development/test เท่านั้น</p>
              </div>
            ) : <>
            <form onSubmit={handleSaveApiKey} className="api-key-config-section">
              <div className="api-header-info">
                <div className="api-icon-badge">
                  <Server size={22} />
                </div>
                <div>
                  <strong>การเชื่อมต่อ ChatPOS API (https://chatpos.biz)</strong>
                  <p className="muted-text">กรอก Bearer API Key สำหรับใช้กับเส้นทาง API ทั้งหมดในระบบ ChatPOS</p>
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Authorization Bearer Token / API Key</span>
                  {getStoredApiKey() && <span className="api-key-status-badge">บันทึกเรียบร้อย</span>}
                </label>
                <div className="api-input-wrap">
                  <Key size={18} className="api-input-icon" />
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="ป้อน API Key (เช่น chatpos_live_secret_key_...)"
                    className="api-key-input"
                  />
                  {apiKeyInput && (
                    <button
                      type="button"
                      className="clear-key-btn"
                      onClick={() => setApiKeyInput('')}
                      title="ล้างข้อมูล"
                    >
                      ล้าง
                    </button>
                  )}
                </div>
                <small className="muted-text">คีย์นี้ใช้เฉพาะคำขอทดสอบใน session นี้ ไม่ถูกบันทึกใน browser; production secret ต้องอยู่ใน server-side secret manager</small>
              </div>

              <div className="broadcast-footer" style={{ borderTop: 'none', padding: 0, marginTop: 4 }}>
                <button type="submit" className="primary-button">
                  <CheckCircle2 size={16} /> บันทึก API Key
                </button>
              </div>
            </form>

            <hr style={{ border: 'none', borderTop: '1px dashed #e2e8f0', margin: '20px 0' }} />

            {/* Quick Reference API Tester Console */}
            <div className="api-tester-card">
              <div className="api-tester-title">
                <Server size={18} className="green-text" />
                <strong>🚀 Quick Reference API Console Tester</strong>
              </div>

              <div className="form-group" style={{ marginTop: 12 }}>
                <label>เลือกเส้นทาง API (Endpoint)</label>
                <select
                  value={selectedEndpoint}
                  onChange={(e) => {
                    setSelectedEndpoint(e.target.value as any)
                    setApiResult(null)
                    setApiError(null)
                  }}
                  className="api-endpoint-select"
                >
                  <option value="balance">GET /api/v1/balance (Check account balance)</option>
                  <option value="create_qr">POST /api/v1/transactions (Create routed transaction)</option>
                  <option value="check_payment">GET /api/v1/transactions/&#123;reference&#125; (Check payment status)</option>
                  <option value="auth" disabled>POST /api/v1/auth (deprecated)</option>
                  <option value="create_payout" disabled>POST /api/v1/payouts (ยังไม่พร้อมใช้งาน)</option>
                </select>
              </div>

              {/* Dynamic Parameter Inputs depending on Endpoint */}
              {selectedEndpoint === 'check_payment' && (
                <div className="form-group">
                  <label>Payment Reference ID (เลขที่อ้างอิงชำระเงิน)</label>
                  <input
                    value={paramRef}
                    onChange={(e) => setParamRef(e.target.value)}
                    placeholder="เช่น PAY-REF-100293"
                  />
                </div>
              )}

              {(selectedEndpoint === 'create_qr' || selectedEndpoint === 'create_payout') && (
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>จำนวนเงิน (Amount - บาท)</label>
                    <input
                      type="number"
                      value={paramAmount}
                      onChange={(e) => setParamAmount(e.target.value)}
                      placeholder="100"
                    />
                  </div>
                  <div className="form-group">
                    <label>รายละเอียด / หมายเหตุ</label>
                    <input
                      value={paramDescription}
                      onChange={(e) => setParamDescription(e.target.value)}
                      placeholder="เช่น ชำระค่าสินค้า"
                    />
                  </div>
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="primary-button test-api-btn"
                  onClick={handleTestEndpoint}
                  disabled={apiLoading}
                >
                  {apiLoading ? (
                    <>
                      <RefreshCw size={16} className="spin-icon" /> กำลังเรียกใช้ API...
                    </>
                  ) : (
                    <>
                      <Server size={16} /> ส่งคำขอ (Execute Request)
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Test Results Output Section */}
            {apiError && (
              <div className="api-result-box error" style={{ marginTop: 16 }}>
                <div className="api-result-header">
                  <AlertCircle size={18} />
                  <strong>ผลการทดสอบ: เกิดข้อผิดพลาด</strong>
                </div>
                <p>{apiError}</p>
                <small className="muted-text">ข้อแนะนำ: ตรวจสอบความถูกต้องของ API Key และ Request Parameters</small>
              </div>
            )}

            {apiResult && (
              <div className="api-result-box success" style={{ marginTop: 16 }}>
                <div className="api-result-header">
                  <CheckCircle2 size={18} />
                  <strong>ผลการทดสอบ: เรียกใช้ API สำเร็จ!</strong>
                </div>
                {apiResult.balance !== undefined && (
                  <div className="balance-highlight-card">
                    <small>ยอดเงินคงเหลือปัจจุบัน (Balance):</small>
                    <h3>{Number(apiResult.balance).toLocaleString()} {apiResult.currency || 'THB'}</h3>
                  </div>
                )}
                {(() => {
                  const tx = apiResult.transaction || apiResult.data?.transaction || apiResult
                  const qrImg = transactionQrImageUrl(tx)
                  const checkoutUrl = tx?.checkoutRedirectUrl || apiResult.checkoutRedirectUrl
                  if (qrImg) return (
                    <div className="balance-highlight-card">
                      <small>QR Code:</small>
                      <img src={qrImg} alt="Gateway QR" style={{ width: 180, height: 180, marginTop: 6, borderRadius: 8, background: '#fff', padding: 4, border: '1px solid #e2e8f0' }} />
                    </div>
                  )
                  if (checkoutUrl) return (
                    <div className="balance-highlight-card">
                      <small>Checkout Link:</small>
                      <p style={{ margin: '4px 0 0', fontWeight: 'bold' }}>
                        <a href={checkoutUrl} target="_blank" rel="noreferrer">{checkoutUrl}</a>
                      </p>
                    </div>
                  )
                  return null
                })()}
                <div className="json-output-wrap">
                  <small>Raw Response Data:</small>
                  <pre>{JSON.stringify(apiResult, null, 2)}</pre>
                </div>
              </div>
            )}

            {/* Dynamic Code Snippet Generator */}
            <div className="code-example-card" style={{ marginTop: 20 }}>
              <div className="code-example-header">
                <div className="code-title">
                  <Code size={16} /> โค้ดตัวอย่าง JavaScript fetch (สร้างตามพารามิเตอร์จริง)
                </div>
                <button type="button" className="copy-code-btn" onClick={handleCopySnippet}>
                  {codeCopied ? <Check size={14} /> : <Copy size={14} />} {codeCopied ? 'คัดลอกแล้ว!' : 'คัดลอกโค้ด'}
                </button>
              </div>
              <pre className="code-snippet-pre">
{generateCodeSnippet()}
              </pre>
            </div>
            </>}
          </div>
        )}

        {/* TAB 4: Notifications */}
        {activeTab === 'notifications' && (
          <div className="profile-form">
            <div className="notification-options-list">
              <div className="notify-toggle-row">
                <div>
                  <strong>💬 การแจ้งเตือนผ่าน LINE Notify</strong>
                  <p className="muted-text">รับการแจ้งเตือนยอดขาย, KYC และคำขอถอนเงินผ่านแชท LINE</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={profile.lineNotify}
                    onChange={(e) => setProfile((prev) => ({ ...prev, lineNotify: e.target.checked }))}
                  />
                  <span className="slider-round" />
                </label>
              </div>

              <div className="notify-toggle-row">
                <div>
                  <strong>📧 การแจ้งเตือนผ่าน Email Summary</strong>
                  <p className="muted-text">รับสรุปรายงานยอดขายประจำวันและแจ้งเตือนข่าวสารทางอีเมล</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={profile.emailNotify}
                    onChange={(e) => setProfile((prev) => ({ ...prev, emailNotify: e.target.checked }))}
                  />
                  <span className="slider-round" />
                </label>
              </div>
            </div>

            <div className="broadcast-footer">
              <button type="button" className="secondary-button" onClick={onClose}>
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setToastMessage('การตั้งค่าการแจ้งเตือนยังไม่พร้อมบันทึก เพราะยังไม่มี Merchant preference API')
                  setTimeout(() => setToastMessage(null), 2000)
                }}
              >
                บันทึกการตั้งค่า
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: Business / Settlement (For Merchants) */}
        {activeTab === 'business' && role === 'merchant' && (
          <form onSubmit={handleSaveProfile} className="profile-form">
            <div className="form-group">
              <label>ชื่อร้านค้า (Store Name)</label>
              <input
                required
                value={profile.storeName ?? ''}
                onChange={(e) => setProfile((prev) => ({ ...prev, storeName: e.target.value }))}
              />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>เบอร์ PromptPay สำหรับรับชำระ</label>
                <input
                  value={profile.promptPayId ?? ''}
                  onChange={(e) => setProfile((prev) => ({ ...prev, promptPayId: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>ธนาคารรับโอนเงิน (Settlement Bank)</label>
                <input
                  value={profile.bankName ?? ''}
                  onChange={(e) => setProfile((prev) => ({ ...prev, bankName: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label>เลขที่บัญชีธนาคาร</label>
              <input
                value={profile.bankAccount ?? ''}
                onChange={(e) => setProfile((prev) => ({ ...prev, bankAccount: e.target.value }))}
              />
            </div>

            <div className="broadcast-footer">
              <button type="button" className="secondary-button" onClick={onClose}>
                ยกเลิก
              </button>
              <button type="submit" className="primary-button">
                บันทึกข้อมูลร้านค้า
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}


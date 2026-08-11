import React, { useState } from 'react'
import { Bell, Camera, CheckCircle2, KeyRound, Shield, Store, User, X } from 'lucide-react'

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
}

const defaultProfiles: Record<string, ProfileData> = {
  admin: {
    role: 'admin',
    name: 'Admin Demo (ผู้ดูแลระบบ)',
    title: 'Super Administrator',
    email: 'admin@chatpos.co',
    phone: '081-999-8877',
    avatarUrl: '/mascot/nabtang_presenting.png',
    lineNotify: true,
    emailNotify: true,
    twoFactor: true
  },
  pd: {
    role: 'pd',
    name: 'ณัฐพล วัฒนกิจ (PD-001)',
    title: 'President Director (กรุงเทพฯ & ปริมณฑล)',
    email: 'nattapol.pd@chatpos.co',
    phone: '081-923-4411',
    avatarUrl: '/mascot/kyc_3_checking_documents.png',
    lineNotify: true,
    emailNotify: true,
    twoFactor: true
  },
  agent: {
    role: 'agent',
    name: 'พิมพ์ชนก ศรีสุข (AG-204)',
    title: 'Senior Agent (เชียงใหม่)',
    email: 'pimchanok.ag@chatpos.co',
    phone: '089-456-1122',
    avatarUrl: '/mascot/nabtang_analytics.png',
    lineNotify: true,
    emailNotify: false,
    twoFactor: false
  },
  merchant: {
    role: 'merchant',
    name: 'คุณสมชาย ใจดี',
    title: 'เจ้าของร้าน Cafe & Bistro',
    email: 'somchai.cafe@gmail.com',
    phone: '082-345-6789',
    avatarUrl: '/mascot/pos_1_front.png',
    storeName: 'ร้านกาแฟบ้านสวน Cafe & Bistro',
    promptPayId: '082-345-6789',
    bankName: 'ธนาคารกสิกรไทย (KBANK)',
    bankAccount: '045-2-99812-4',
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
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'business'>('profile')

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Status banners
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    setToastMessage('บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว! ✨')
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
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setToastMessage('เปลี่ยนรหัสผ่านใหม่เรียบร้อยแล้ว! 🔒')
    setTimeout(() => setToastMessage(null), 2500)
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
            <p className="muted-text">จัดการข้อมูลส่วนตัว ภาพโปรไฟล์ รหัสผ่าน และการแจ้งเตือน</p>
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
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
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

        {/* TAB 3: Notifications */}
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
                  setToastMessage('ตั้งค่าการแจ้งเตือนเรียบร้อยแล้ว!')
                  setTimeout(() => setToastMessage(null), 2000)
                }}
              >
                บันทึกการตั้งค่า
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: Business / Settlement (For Merchants) */}
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

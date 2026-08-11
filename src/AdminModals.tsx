import { useState } from 'react'
import { AlertTriangle, Banknote, Building2, Check, CheckCircle2, FileText, Megaphone, Send, ShieldAlert, Sparkles, User, X, Zap } from 'lucide-react'
import type { MockCase, MockWithdrawal } from './mockData'

// --- 1. KYC Inspector Modal / Drawer ---
export function KycInspectorModal({
  selectedCase,
  onClose,
  onUpdateStatus
}: {
  selectedCase: MockCase | null
  onClose: () => void
  onUpdateStatus: (caseId: string, status: string, tone: 'approved' | 'review' | 'risk' | 'pending') => void
}) {
  const [toast, setToast] = useState<string | null>(null)

  if (!selectedCase) return null

  const handleAction = (status: string, tone: 'approved' | 'review' | 'risk' | 'pending', message: string) => {
    onUpdateStatus(selectedCase.id, status, tone)
    setToast(message)
    setTimeout(() => {
      setToast(null)
      onClose()
    }, 1200)
  }

  const riskScore = selectedCase.riskScore ?? 10
  const riskTone = riskScore > 50 ? '#ef4444' : riskScore > 20 ? '#f59e0b' : '#10b981'

  return (
    <div className="admin-modal-overlay">
      <button aria-label="Close modal backdrop" className="admin-modal-backdrop" onClick={onClose} type="button" />
      <div className="admin-modal-card kyc-inspector-card">
        <div className="admin-modal-header">
          <div className="modal-title-group">
            <span className="badge-pill">{selectedCase.id}</span>
            <h2>{selectedCase.name}</h2>
            <p className="muted-text">ส่งเมื่อ: {selectedCase.time} · ประเภท: {selectedCase.type}</p>
          </div>
          <button aria-label="Close modal" className="close-modal-btn" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        {toast && (
          <div className="admin-toast-banner">
            <CheckCircle2 size={18} /> {toast}
          </div>
        )}

        <div className="kyc-inspector-grid">
          {/* Left Column: Visual Assets */}
          <div className="kyc-assets-col">
            <div className="asset-box">
              <label>📷 ภาพถ่ายหน้าร้านค้า</label>
              <img src={selectedCase.storePhoto} alt="Storefront" className="store-photo-img" />
            </div>
            <div className="asset-box">
              <label>📄 ภาพถ่ายบัตรประชาชน / เอกสารยืนยันตัวตน</label>
              <div className="doc-preview-wrapper">
                <img src={selectedCase.docUrl} alt="Doc preview" className="doc-photo-img" />
                <div className="doc-watermark">
                  <CheckCircle2 size={16} /> VERIFIED BY CHATPOS AI
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Detailed Info & Risk Gauge */}
          <div className="kyc-info-col">
            {/* Risk Gauge */}
            <div className="risk-gauge-card">
              <div className="risk-gauge-header">
                <span>🛡️ ระดับความเสี่ยง (Risk Score)</span>
                <strong style={{ color: riskTone }}>{riskScore} / 100 ({riskScore > 50 ? 'ความเสี่ยงสูง' : riskScore > 20 ? 'ปานกลาง' : 'ปลอดภัย'})</strong>
              </div>
              <div className="risk-gauge-bar">
                <div className="risk-gauge-fill" style={{ width: `${riskScore}%`, background: riskTone }} />
              </div>
            </div>

            <div className="info-fields-grid">
              <div className="info-item">
                <User size={15} className="info-icon" />
                <div>
                  <small>ผู้รับผิดชอบ/เจ้าของ</small>
                  <strong>{selectedCase.person}</strong>
                </div>
              </div>

              <div className="info-item">
                <Building2 size={15} className="info-icon" />
                <div>
                  <small>สายงาน / ผู้ดูแล (PD/AG)</small>
                  <strong>{selectedCase.detail}</strong>
                </div>
              </div>

              <div className="info-item">
                <FileText size={15} className="info-icon" />
                <div>
                  <small>เลขประจำตัวผู้เสียภาษี / บัตรประชาชน</small>
                  <strong>{selectedCase.taxId}</strong>
                </div>
              </div>

              <div className="info-item">
                <Banknote size={15} className="info-icon" />
                <div>
                  <small>บัญชีธนาคารรับเงิน</small>
                  <strong>{selectedCase.bankName}</strong>
                  <p>{selectedCase.bankAccount}</p>
                </div>
              </div>
            </div>

            <div className="address-box">
              <small>📍 ที่อยู่สถานประกอบการ</small>
              <p>{selectedCase.address}</p>
            </div>

            {/* Action buttons */}
            <div className="kyc-action-footer">
              <button
                className="btn-reject"
                onClick={() => handleAction('ปฏิเสธ', 'risk', `ปฏิเสธเคส ${selectedCase.id} เรียบร้อยแล้ว`)}
                type="button"
              >
                <X size={16} /> ปฏิเสธเคส
              </button>

              <button
                className="btn-request"
                onClick={() => handleAction('ติดตามเพิ่ม', 'review', `ส่งคำขอเอกสารเพิ่มเติมสำหรับ ${selectedCase.id} แล้ว`)}
                type="button"
              >
                <AlertTriangle size={16} /> ขอข้อมูลเพิ่ม
              </button>

              <button
                className="btn-approve"
                onClick={() => handleAction('อนุมัติแล้ว', 'approved', `อนุมัติเคส ${selectedCase.id} สำเร็จ!`)}
                type="button"
              >
                <Check size={16} /> อนุมัติทันที
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- 2. Broadcast System Announcement Modal ---
export function BroadcastModal({
  isOpen,
  onClose
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [target, setTarget] = useState('all')
  const [sentSuccess, setSentSuccess] = useState(false)

  if (!isOpen) return null

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    setSentSuccess(true)
    setTimeout(() => {
      setSentSuccess(false)
      setTitle('')
      setMessage('')
      onClose()
    }, 1500)
  }

  return (
    <div className="admin-modal-overlay">
      <button aria-label="Close broadcast modal backdrop" className="admin-modal-backdrop" onClick={onClose} type="button" />
      <div className="admin-modal-card broadcast-card">
        <div className="admin-modal-header">
          <div className="modal-title-group">
            <span className="badge-pill green">BROADCAST SYSTEM</span>
            <h2>📣 ส่งประกาศด่วนถึง POS ร้านค้าทั้งหมด</h2>
            <p className="muted-text">ข้อความจะแสดงเป็น Pop-up การแจ้งเตือนบนหน้าจอ ChatPOS Merchant</p>
          </div>
          <button aria-label="Close modal" className="close-modal-btn" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        {sentSuccess ? (
          <div className="broadcast-success-view">
            <div className="success-icon-wrap">
              <Megaphone size={36} />
            </div>
            <h3>ส่งประกาศเรียบร้อยแล้ว! 🎉</h3>
            <p>ข้อความถูกกระจายไปยังหน้าจอ POS ร้านค้าจำนวน 1,302 ร้านเรียบร้อย</p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="broadcast-form">
            <div className="form-group">
              <label>กลุ่มเป้าหมายผู้รับข้อความ</label>
              <select value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="all">ร้านค้าทั้งหมดในระบบ (1,302 ร้าน)</option>
                <option value="active_pos">เฉพาะร้านที่กำลังเปิดใช้งาน POS (3,610 เครื่อง)</option>
                <option value="bkk">เฉพาะเขตกรุงเทพฯ & ปริมณฑล</option>
                <option value="upcountry">เฉพาะต่างจังหวัด (เชียงใหม่, ขอนแก่น, ภูเก็ต)</option>
              </select>
            </div>

            <div className="form-group">
              <label>หัวข้อประกาศ (Headline)</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น: แจ้งปรับปรุงระบบชั่วคราว / โปรโมชันใหม่พร้อมใช้งาน"
              />
            </div>

            <div className="form-group">
              <label>รายละเอียดข้อความ (Message Content)</label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="พิมพ์รายละเอียดที่ต้องการแจ้งเตือนให้ร้านค้าทราบ..."
              />
            </div>

            <div className="broadcast-footer">
              <button type="button" className="secondary-button" onClick={onClose}>
                ยกเลิก
              </button>
              <button type="submit" className="primary-button btn-send-broadcast">
                <Send size={16} /> กระจายประกาศทันที
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// --- 3. Batch KYC Approval Modal ---
export function BatchKycModal({
  isOpen,
  onClose,
  onConfirmBatch
}: {
  isOpen: boolean
  onClose: () => void
  onConfirmBatch: () => void
}) {
  const [processing, setProcessing] = useState(false)

  if (!isOpen) return null

  const handleBatch = () => {
    setProcessing(true)
    setTimeout(() => {
      setProcessing(false)
      onConfirmBatch()
      onClose()
    }, 1200)
  }

  return (
    <div className="admin-modal-overlay">
      <button aria-label="Close batch modal backdrop" className="admin-modal-backdrop" onClick={onClose} type="button" />
      <div className="admin-modal-card batch-kyc-card">
        <div className="admin-modal-header">
          <div className="modal-title-group">
            <span className="badge-pill amber">AUTOMATED BATCH ENGINE</span>
            <h2>⚡ อนุมัติ KYC คิวรอทั้งหมด (47 รายการ)</h2>
            <p className="muted-text">ประมวลผลอนุมัติอัตโนมัติสำหรับเคสที่ผ่านเงื่อนไขความปลอดภัย 100%</p>
          </div>
          <button aria-label="Close modal" className="close-modal-btn" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <div className="batch-summary-box">
          <div className="batch-stat">
            <span>คิวรอตรวจทั้งหมด</span>
            <strong>47 เคส</strong>
          </div>
          <div className="batch-stat green-stat">
            <span>เคสผ่านเกณฑ์อัตโนมัติ</span>
            <strong>47 เคส (100%)</strong>
          </div>
          <div className="batch-stat red-stat">
            <span>พบความเสี่ยงสูง (High Risk)</span>
            <strong>0 เคส</strong>
          </div>
        </div>

        <div className="batch-confirm-notice">
          <CheckCircle2 size={20} className="green-text" />
          <span>ระบบได้ทำการตรวจสอบเอกสาร บัตรประชาชน และบัญชีธนาคารผ่าน AI Engine เรียบร้อยแล้ว</span>
        </div>

        <div className="broadcast-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            type="button"
            className="primary-button btn-confirm-batch"
            disabled={processing}
            onClick={handleBatch}
          >
            {processing ? (
              <>⏳ กำลังประมวลผลอนุมัติ...</>
            ) : (
              <>
                <Zap size={16} /> ยืนยันอนุมัติ 47 เคสทันที
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- 4. Withdrawal Approval Modal ---
export function WithdrawalModal({
  selectedWithdrawal,
  onClose,
  onApprove
}: {
  selectedWithdrawal: MockWithdrawal | null
  onClose: () => void
  onApprove: (id: string) => void
}) {
  const [success, setSuccess] = useState(false)

  if (!selectedWithdrawal) return null

  const handleConfirm = () => {
    setSuccess(true)
    setTimeout(() => {
      setSuccess(false)
      onApprove(selectedWithdrawal.id)
      onClose()
    }, 1200)
  }

  return (
    <div className="admin-modal-overlay">
      <button aria-label="Close withdrawal modal backdrop" className="admin-modal-backdrop" onClick={onClose} type="button" />
      <div className="admin-modal-card withdrawal-card">
        <div className="admin-modal-header">
          <div className="modal-title-group">
            <span className="badge-pill violet">{selectedWithdrawal.id}</span>
            <h2>💸 อนุมัติการถอนเงิน (Commission Withdrawal)</h2>
            <p className="muted-text">ส่งคำสั่งโอนเงินตรงเข้าบัญชีธนาคารของผู้รับผลประโยชน์</p>
          </div>
          <button aria-label="Close modal" className="close-modal-btn" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="broadcast-success-view">
            <div className="success-icon-wrap">
              <Banknote size={36} />
            </div>
            <h3>โอนเงินสำเร็จแล้ว! 🎉</h3>
            <p>ยอดเงิน {selectedWithdrawal.amount} ถูกโอนเข้าบัญชี {selectedWithdrawal.accountNo} เรียบร้อย</p>
          </div>
        ) : (
          <div className="withdrawal-details">
            <div className="withdrawal-hero-amount">
              <small>ยอดเงินที่ขอถอน</small>
              <strong>{selectedWithdrawal.amount}</strong>
            </div>

            <div className="withdrawal-meta-grid">
              <div className="meta-box">
                <small>ผู้ขอถอน</small>
                <strong>{selectedWithdrawal.name}</strong>
                <span>{selectedWithdrawal.role}</span>
              </div>
              <div className="meta-box">
                <small>ธนาคารปลายทาง</small>
                <strong>{selectedWithdrawal.bank}</strong>
                <span className="mono-font">{selectedWithdrawal.accountNo}</span>
              </div>
            </div>

            <div className="broadcast-footer">
              <button type="button" className="secondary-button" onClick={onClose}>
                ยกเลิก
              </button>
              <button type="button" className="primary-button btn-confirm-batch" onClick={handleConfirm}>
                <Check size={16} /> ยืนยันอนุมัติโอนเงิน
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// --- 5. Floating ChatPOS AI Assistant Widget ---
export function ChatPosAiWidget() {
  const [open, setOpen] = useState(false)

  return (
    <div className="ai-widget-container">
      {open && (
        <div className="ai-widget-panel">
          <div className="ai-widget-header">
            <div className="ai-header-title">
              <div className="ai-avatar-sparkle">
                <Sparkles size={18} />
              </div>
              <div>
                <strong>ChatPOS AI Insight Engine</strong>
                <span>ระบบผู้ช่วยอัจฉริยะวิเคราะห์ภาพรวม</span>
              </div>
            </div>
            <button aria-label="Close AI panel" className="close-modal-btn" onClick={() => setOpen(false)} type="button">
              <X size={16} />
            </button>
          </div>

          <div className="ai-widget-body">
            <div className="ai-insight-bubble">
              <div className="bubble-tag">💡 INSIGHT วันนี้</div>
              <p>สวัสดีครับแอดมิน! วันนี้มียอดทำรายการผ่าน PromptPay ในเขตภาคเหนือพุ่งขึ้น <strong>+28%</strong> โดยร้าน <strong>กาแฟบ้านสวน (เชียงใหม่)</strong> มีอัตราการเติบโตสูงสุด 🚀</p>
            </div>

            <div className="ai-recommendations">
              <label>🎯 ข้อเสนอแนะอัตโนมัติ (Smart Actions):</label>
              <ul>
                <li>
                  <CheckCircle2 size={14} className="green-text" />
                  <span>มี 47 รายการ KYC รอตรวจ สามารถใช้คำสั่ง <b>Batch Approve</b> เพื่ออนุมัติทันทีได้</span>
                </li>
                <li>
                  <ShieldAlert size={14} className="red-text" />
                  <span>พบ 1 ร้านค้าในนนทบุรี (Mellow Home Studio) เอกสารไม่ตรง แนะนำให้กดขอข้อมูลเพิ่ม</span>
                </li>
                <li>
                  <Banknote size={14} className="violet-text" />
                  <span>คิวอนุมัติถอนเงิน ฿96,450 พร้อมดำเนินการโอนในรอบบัญชี 14:00 น.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="ai-widget-footer">
            <img src="/mascot/nabtang_analytics.png" alt="Nabtang Mascot" className="ai-mascot-tiny" />
            <span>ChatPOS AI v2.4 · Powered by Gemini Engine</span>
          </div>
        </div>
      )}

      <button
        aria-label="Toggle ChatPOS AI Assistant"
        className={`ai-floating-trigger ${open ? 'active' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <Sparkles size={20} />
        <span>ChatPOS AI</span>
        <span className="ai-badge-pulse" />
      </button>
    </div>
  )
}

import { useState, useEffect } from 'react'
import {
  Store,
  QrCode,
  PlusCircle,
  WalletCards,
  Clock3,
  ShieldAlert,
  ChevronRight,
  Share2,
  Copy,
  Phone,
  TrendingUp,
  Activity,
  UserCheck,
  MapPin,
  Building2,
  ArrowUpRight,
  Zap
} from 'lucide-react'
import { mockAgentMerchants, mockAgentCommissions } from './mockData'
import type { MockAgentMerchant } from './mockData'
import { WithdrawalModal } from './AdminModals'
import { fetchDbStores, fetchDbCommissions, fetchDbStats, type DbStoreRow, type DbCommissionRow, type DbStats } from './dbApi'

export function AgentPortalView() {
  const [selectedMerchant, setSelectedMerchant] = useState<MockAgentMerchant | null>(null)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [newStoreModalOpen, setNewStoreModalOpen] = useState(false)
  const [withdrawalOpen, setWithdrawalOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [liveStores, setLiveStores] = useState<DbStoreRow[]>([])
  const [liveCommissions, setLiveCommissions] = useState<DbCommissionRow[]>([])
  const [liveStats, setLiveStats] = useState<DbStats | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const [stores, commissions, stats] = await Promise.all([
          fetchDbStores(),
          fetchDbCommissions(),
          fetchDbStats(),
        ])
        if (stores.length > 0) setLiveStores(stores)
        if (commissions.length > 0) setLiveCommissions(commissions)
        if (stats) setLiveStats(stats)
      } catch (e) {
        console.error('Agent init error:', e)
      }
    }
    init()
  }, [])

  const referralUrl = 'https://chatpos.app/register?ref=AG-204'

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(referralUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  return (
    <div className="agent-portal-wrap">
      {/* Premium Agent Workspace Hero Banner */}
      <section className="agent-hero-banner">
        <div className="agent-hero-decor-orb-1" />
        <div className="agent-hero-decor-orb-2" />

        <div className="agent-hero-main">
          {/* Left Column: Identity & Primary Actions */}
          <div className="agent-hero-content">
            <div className="agent-pill-row">
              <div className="agent-badge">
                <span className="agent-status-dot" />
                <UserCheck size={14} /> SENIOR AGENT · AG-204
              </div>
              <div className="agent-tag-glass">
                <MapPin size={13} /> เชียงใหม่ (โซนเมือง)
              </div>
              <div className="agent-tag-glass">
                <Building2 size={13} /> สายงาน: PD-001 (ณัฐพล)
              </div>
            </div>

            <div className="agent-title-block">
              <h1>สวัสดีครับคุณ พิมพ์ชนก ศรีสุข 👋</h1>
              <p>ระบบจัดการเครือข่ายร้านค้าและติดตามคอมมิชชันแบบ Real-time</p>
            </div>

            {/* Balanced Action Button Group */}
            <div className="agent-hero-actions">
              <button type="button" className="agent-btn-primary" onClick={() => setNewStoreModalOpen(true)}>
                <PlusCircle size={17} /> เชื่อมต่อร้านค้าใหม่
              </button>
              <button type="button" className="agent-btn-glass" onClick={() => setQrModalOpen(true)}>
                <QrCode size={16} /> QR Code เชิญร้าน
              </button>
              <button type="button" className="agent-btn-glass" onClick={handleCopyLink}>
                <Copy size={15} /> {copiedLink ? 'คัดลอกแล้ว! ✨' : 'คัดลอกลิงก์แนะนำ'}
              </button>
            </div>
          </div>

          {/* Right Column: Dedicated Glass Balance & Quick Payout Card + Mascot */}
          <div className="agent-hero-right">
            <div className="agent-wallet-card">
              <div className="agent-wallet-head">
                <div className="wallet-icon-badge">
                  <WalletCards size={18} />
                </div>
                <div className="wallet-label-group">
                  <span className="wallet-title">คอมมิชชันสะสมพร้อมถอน</span>
                  <span className="wallet-subtitle">อัตราเฉลี่ย 0.8% จากยอดขาย</span>
                </div>
              </div>

              <div className="agent-wallet-balance">
                <span className="balance-currency">฿</span>
                <strong className="balance-amount">28,640</strong>
                <span className="balance-cents">.00</span>
              </div>

              <div className="agent-wallet-subinfo">
                <div className="wallet-today-pill">
                  <TrendingUp size={13} /> วันนี้ +฿801.00
                </div>
                <span className="wallet-status-ready">🟢 พร้อมถอนทันที</span>
              </div>

              <button type="button" className="agent-btn-withdraw-payout" onClick={() => setWithdrawalOpen(true)}>
                <span><Zap size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />ขอถอนเงินเข้าบัญชี (SCB)</span>
                <ArrowUpRight size={15} />
              </button>
            </div>

            <div className="agent-hero-illustration">
              <img src="/mascot/nabtang_presenting.png" alt="Agent Mascot" className="agent-mascot-img" />
            </div>
          </div>
        </div>
      </section>

      {/* Agent Workspace Metric Cards */}
      <section className="agent-metric-grid">
        <article className="agent-metric-card green">
          <div className="agent-metric-head">
            <span>ร้านค้าในดูแล</span>
            <Store size={22} className="agent-icon-green" />
          </div>
          <strong>{liveStores.length > 0 ? `${liveStores.length} ร้าน` : liveStats?.total_stores ? `${liveStats.total_stores} ร้าน` : '26 ร้าน'}</strong>
          <small>🟢 ดึงข้อมูลจากตาราง Store</small>
        </article>

        <article className="agent-metric-card blue">
          <div className="agent-metric-head">
            <span>คำขอเชื่อมร้านใหม่</span>
            <Activity size={22} className="agent-icon-blue" />
          </div>
          <strong>{liveStats?.pending_kyc ? `${liveStats.pending_kyc} คำขอ` : '2 คำขอ'}</strong>
          <small>⚡ ร้านค้าสแกน QR สมัครเข้ามาในระบบ</small>
        </article>

        <article className="agent-metric-card amber">
          <div className="agent-metric-head">
            <span>KYC ที่ต้องติดตาม</span>
            <Clock3 size={22} className="agent-icon-amber" />
          </div>
          <strong>{liveStats?.pending_kyc ? `${liveStats.pending_kyc} เคส` : '2 เคส'}</strong>
          <small>⚠️ เอกสารอยู่ระหว่างรอตรวจสอบ</small>
        </article>

        <article className="agent-metric-card violet">
          <div className="agent-metric-head">
            <span>ค่าคอมมิชชันสะสม</span>
            <WalletCards size={22} className="agent-icon-violet" />
          </div>
          <strong>฿{liveCommissions.length > 0 ? liveCommissions.reduce((s, c) => s + Number(c.amount || 0), 0).toFixed(2) : '28,640'}</strong>
          <small>💰 ข้อมูลจากตาราง CommissionLedger</small>
        </article>
      </section>

      {/* Quick Share Link Box */}
      <section className="agent-share-box">
        <div className="share-left">
          <Share2 size={20} className="green-text" />
          <div>
            <strong>ลิงก์เชิญร้านค้าประจำตัวของคุณ (Agent Referral Link)</strong>
            <p>ส่งลิงก์นี้ให้ร้านค้าเพื่อรับคอมมิชชัน 0.8% จากทุกยอดทำรายการ</p>
          </div>
        </div>
        <div className="share-input-row">
          <input type="text" readOnly value={referralUrl} className="agent-share-input" />
          <button type="button" className="agent-btn-copy" onClick={handleCopyLink}>
            <Copy size={15} /> {copiedLink ? 'คัดลอกแล้ว! ✨' : 'คัดลอกลิงก์'}
          </button>
        </div>
      </section>

      {/* Main Grid: My Merchants & Daily Earnings */}
      <div className="agent-main-grid">
        {/* Left Column: Merchant Directory */}
        <section className="agent-panel">
          <div className="agent-panel-header">
            <div>
              <h2>รายชื่อร้านค้าในดูแลของคุณ (My Merchants)</h2>
              <p>ติดตามสถานะ POS ประจำวัน และตรวจสอบยอดขายรายร้าน</p>
            </div>
            <span className="agent-count-tag">26 ร้านค้า</span>
          </div>

          <div className="agent-merchant-grid">
            {mockAgentMerchants.map((m) => (
              <div key={m.id} className="agent-merchant-card" onClick={() => setSelectedMerchant(m)}>
                <div className="m-card-top">
                  <span className={`online-dot-pill ${m.onlineStatus}`}>
                    <span className="dot" /> {m.onlineStatus === 'online' ? 'POS Online' : 'POS Offline'}
                  </span>
                  <span className={`kyc-badge ${m.kycTone}`}>{m.kycStatus}</span>
                </div>
                <strong className="m-store-name">{m.name}</strong>
                <p className="m-owner-info">👤 เจ้าของ: {m.owner} · {m.category}</p>
                <div className="m-card-stats">
                  <div>
                    <small>เครื่อง POS</small>
                    <strong>{m.posTerminals} เครื่อง</strong>
                  </div>
                  <div>
                    <small>ยอดขายวันนี้</small>
                    <strong className="green-text">{m.todayVolume}</strong>
                  </div>
                </div>
                <div className="m-card-footer">
                  <span className="m-phone"><Phone size={13} /> {m.phone}</span>
                  <button type="button" className="agent-btn-inspect">
                    รายละเอียด <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right Column: Today Earnings & Commission Stream */}
        <div className="agent-side-stack">
          {/* Today Commission Breakdown */}
          <section className="agent-panel">
            <div className="agent-panel-header">
              <div>
                <h2>ค่าคอมมิชชันรายวัน</h2>
                <p>แจกแจงรายได้จากแต่ละร้านวันนี้</p>
              </div>
              <TrendingUp size={20} className="green-text" />
            </div>

            <div className="agent-comm-list">
              {mockAgentCommissions.map((c) => (
                <div key={c.id} className="comm-row">
                  <div>
                    <strong>{c.storeName}</strong>
                    <p>{c.txnCount} รายการ · ยอดขายรวม {c.grossVolume}</p>
                  </div>
                  <div className="comm-right">
                    <strong className="green-text">+{c.agentEarning}</strong>
                    <small>อัตรา {c.commissionRate}</small>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* KYC Resubmission Action Banner */}
          <section className="agent-panel agent-kyc-alert">
            <ShieldAlert size={24} className="amber-text" />
            <div>
              <h3>KYC Action Required</h3>
              <p>ร้าน "Mellow Home Studio" เอกสารไม่ครบถ้วน กรุณาติดต่อร้านค้าเพื่ออัปโหลดรูปถ่ายหน้าร้านใหม่</p>
            </div>
            <button type="button" className="agent-btn-amber" onClick={() => alert('ส่งข้อความแจ้งเตือนถึงร้านค้าเรียบร้อยแล้ว')}>
              📲 ส่งข้อความแจ้งเตือนร้าน
            </button>
          </section>
        </div>
      </div>

      {/* QR Code Referral Modal */}
      {qrModalOpen && (
        <div className="agent-modal-backdrop" onClick={() => setQrModalOpen(false)}>
          <div className="agent-qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qr-modal-head">
              <h2>📱 QR Code สมัครร้านค้าประจำตัว Agent</h2>
              <p>ยื่นให้เจ้าของร้านสแกนเพื่อลงทะเบียนและเชื่อมต่อเครื่อง POS ได้ทันที</p>
            </div>
            <div className="qr-code-box">
              <div className="qr-img-placeholder">
                <QrCode size={140} className="green-text" />
                <span>AG-204 · พิมพ์ชนก</span>
              </div>
              <p className="qr-url-text">{referralUrl}</p>
            </div>
            <div className="qr-modal-foot">
              <button type="button" className="agent-btn-secondary" onClick={() => setQrModalOpen(false)}>
                ปิด
              </button>
              <button type="button" className="agent-btn-primary" onClick={handleCopyLink}>
                <Copy size={15} /> คัดลอกลิงก์
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Store Connect Modal */}
      {newStoreModalOpen && (
        <div className="agent-modal-backdrop" onClick={() => setNewStoreModalOpen(false)}>
          <div className="agent-qr-modal" onClick={(e) => e.stopPropagation()}>
            <h2>🏬 ลงทะเบียนเชื่อมต่อร้านค้าใหม่</h2>
            <p>กรอกข้อมูลร้านค้าเบื้องต้นเพื่อส่งให้ PD และ Admin ตรวจสอบ KYC</p>
            <div className="agent-form">
              <div className="form-group">
                <label>ชื่อร้านค้า / กิจการ</label>
                <input type="text" placeholder="ระบุชื่อร้านค้า..." className="agent-input" />
              </div>
              <div className="form-group">
                <label>ชื่อ-นามสกุล เจ้าของร้าน</label>
                <input type="text" placeholder="ระบุชื่อเจ้าของร้าน..." className="agent-input" />
              </div>
              <div className="form-group">
                <label>เบอร์โทรศัพท์ติดต่อ</label>
                <input type="text" placeholder="08X-XXX-XXXX" className="agent-input" />
              </div>
              <div className="form-group">
                <label>ประเภทธุรกิจ</label>
                <select className="agent-input">
                  <option>คาเฟ่ & เบเกอรี่</option>
                  <option>ร้านอาหาร / บุฟเฟต์</option>
                  <option>ร้านสะดวกซื้อ / มินิมาร์ท</option>
                  <option>ร้านบริการ / สปา / สตูดิโอ</option>
                </select>
              </div>
            </div>
            <div className="qr-modal-foot">
              <button type="button" className="agent-btn-secondary" onClick={() => setNewStoreModalOpen(false)}>
                ยกเลิก
              </button>
              <button type="button" className="agent-btn-primary" onClick={() => { alert('บันทึกคำขอเชื่อมต่อร้านค้าใหม่สำเร็จ! ส่งเข้าคิว KYC เรียบร้อย'); setNewStoreModalOpen(false); }}>
                บันทึกและส่ง KYC
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Modal */}
      <WithdrawalModal
        selectedWithdrawal={withdrawalOpen ? {
          id: 'WDR-AG-CURRENT',
          name: 'AG-204 · พิมพ์ชนก ศรีสุข',
          role: 'Senior Agent',
          amount: '฿28,640',
          bank: 'ธนาคารไทยพาณิชย์ (SCB)',
          accountNo: '901-0-44120-9',
          time: 'วันนี้ 16:15',
          status: 'pending'
        } : null}
        onClose={() => setWithdrawalOpen(false)}
        onApprove={() => {
          alert('ส่งคำขอถอนเงินค่าคอมมิชชัน Agent จำนวน ฿28,640 สำเร็จ! รอการโอนเงินใน 24 ชม.')
          setWithdrawalOpen(false)
        }}
      />

      {/* Selected Merchant Detail Modal */}
      {selectedMerchant && (
        <div className="agent-modal-backdrop" onClick={() => setSelectedMerchant(null)}>
          <div className="agent-qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="merchant-modal-header">
              <h2>{selectedMerchant.name}</h2>
              <span className={`status-badge ${selectedMerchant.kycTone}`}>
                <span /> {selectedMerchant.kycStatus}
              </span>
            </div>
            <p className="muted">รหัสร้าน: {selectedMerchant.id} · จดทะเบียนเมื่อ {selectedMerchant.registeredDate}</p>
            
            <div className="modal-body-grid" style={{ margin: '1rem 0' }}>
              <div className="m-chip">
                <small>เจ้าของกิจการ</small>
                <strong>{selectedMerchant.owner}</strong>
              </div>
              <div className="m-chip">
                <small>เบอร์โทรศัพท์</small>
                <strong>{selectedMerchant.phone}</strong>
              </div>
              <div className="m-chip">
                <small>จำนวน POS</small>
                <strong>{selectedMerchant.posTerminals} เครื่อง</strong>
              </div>
              <div className="m-chip">
                <small>ยอดขายรวมเดือนนี้</small>
                <strong className="green-text">{selectedMerchant.monthlyVolume}</strong>
              </div>
            </div>
            
            <p className="address-text">📍 ที่อยู่: {selectedMerchant.address}</p>

            <div className="qr-modal-foot">
              <button type="button" className="agent-btn-secondary" onClick={() => setSelectedMerchant(null)}>
                ปิดหน้าต่าง
              </button>
              <button type="button" className="agent-btn-primary" onClick={() => { alert(`กำลังโทรหา ${selectedMerchant.owner} (${selectedMerchant.phone})`); setSelectedMerchant(null); }}>
                📞 โทรหาร้านค้า
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import {
  UsersRound,
  Store,
  WalletCards,
  CheckCircle2,
  ChevronRight,
  UserPlus,
  ArrowUpRight,
  MapPin,
  Phone,
  FileCheck,
  Zap,
  Award
} from 'lucide-react'
import { mockCases, mockPdAgents, mockPdTerritories } from './mockData'
import type { MockCase, MockPdAgentItem } from './mockData'
import { KycInspectorModal, WithdrawalModal } from './AdminModals'
import { fetchDbAgents, fetchDbKycCases, fetchDbStats, type DbAgentRow, type DbStats } from './dbApi'

export function PdPortalView() {
  const [selectedCase, setSelectedCase] = useState<MockCase | null>(null)
  const [withdrawalOpen, setWithdrawalOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<MockPdAgentItem | null>(null)
  const [areaModalOpen, setAreaModalOpen] = useState(false)
  const [liveKycCases, setLiveKycCases] = useState<MockCase[]>([])
  const [liveAgents, setLiveAgents] = useState<DbAgentRow[]>([])
  const [liveStats, setLiveStats] = useState<DbStats | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const [kycRes, agents, stats] = await Promise.all([
          fetchDbKycCases(),
          fetchDbAgents(),
          fetchDbStats(),
        ])
        if (kycRes.cases.length > 0) setLiveKycCases(kycRes.cases)
        if (agents.length > 0) setLiveAgents(agents)
        if (stats) setLiveStats(stats)
      } catch (e) {
        console.error('PD init error:', e)
      }
    }
    init()
  }, [])

  // Filter cases relevant to PD approval
  const pdKycCases = liveKycCases.length > 0 ? liveKycCases : mockCases.filter((c) => c.tone === 'review' || c.tone === 'pending')

  return (
    <div className="pd-portal-wrap">
      {/* Executive PD Welcome Banner */}
      <section className="pd-hero-banner">
        <div className="pd-hero-content">
          <div className="pd-badge">
            <Award size={16} /> PD OPERATIONS CONTROL CENTER
          </div>
          <h1>พื้นที่ดูแล: กรุงเทพฯ & ปริมณฑล (PD-001)</h1>
          <p>บริหารจัดการ Agent ในสายงาน 42 ราย | ดูแลร้านค้ารวม 318 ร้าน | ยอดขายรวมประจำเดือน ฿4,820,000</p>
          <div className="pd-hero-actions">
            <button type="button" className="pd-btn-primary" onClick={() => setAreaModalOpen(true)}>
              <UserPlus size={16} /> เพิ่ม Agent ในสายงาน
            </button>
            <button type="button" className="pd-btn-secondary" onClick={() => setWithdrawalOpen(true)}>
              <WalletCards size={16} /> ถอน PD Royalty (฿84,250)
            </button>
          </div>
        </div>
        <div className="pd-hero-illustration">
          <img src="/mascot/nabtang_analytics.png" alt="PD Analytics Mascot" className="pd-mascot-img" />
        </div>
      </section>

      {/* PD Executive Metrics */}
      <section className="pd-metric-grid">
        <article className="pd-metric-card blue">
          <div className="pd-metric-head">
            <span>Agent ในสายงาน</span>
            <UsersRound size={22} className="pd-icon-blue" />
          </div>
          <strong>{liveAgents.length > 0 ? `${liveAgents.length} ราย` : '42 ราย'}</strong>
          <small>🟢 Active {liveAgents.length > 0 ? liveAgents.length : 38} ราย (ฐานข้อมูล)</small>
        </article>

        <article className="pd-metric-card green">
          <div className="pd-metric-head">
            <span>ร้านค้าในความดูแล</span>
            <Store size={22} className="pd-icon-green" />
          </div>
          <strong>{liveStats?.total_stores ? `${liveStats.total_stores} ร้าน` : '318 ร้าน'}</strong>
          <small>📈 เติบโตต่อเนื่อง (ตาราง Store)</small>
        </article>

        <article className="pd-metric-card amber">
          <div className="pd-metric-head">
            <span>KYC รอ Sign-off</span>
            <FileCheck size={22} className="pd-icon-amber" />
          </div>
          <strong>{liveStats?.pending_kyc ? `${liveStats.pending_kyc} เคส` : '18 เคส'}</strong>
          <small>⚡ ผ่าน Agent แล้ว รอ PD อนุมัติขั้นสุดท้าย</small>
        </article>

        <article className="pd-metric-card violet">
          <div className="pd-metric-head">
            <span>ยอดถอนได้ (PD Royalty)</span>
            <WalletCards size={22} className="pd-icon-violet" />
          </div>
          <strong>฿{Number(liveStats?.total_commission || 84250).toLocaleString('th-TH')}</strong>
          <small>💰 ค่าคอมมิชชันทีมสะสมในรอบนี้</small>
        </article>
      </section>

      {/* Main Grid: Agent Roster & Area Breakdown */}
      <div className="pd-main-grid">
        {/* Left Column: Agent Team Roster */}
        <section className="pd-panel">
          <div className="pd-panel-header">
            <div>
              <h2>ทีมงาน Agent ในสายงานของคุณ</h2>
              <p>ติดตามผลงาน เกรดประสิทธิภาพ และจำนวนร้านในดูแลของ Agent แต่ละท่าน</p>
            </div>
            <span className="pd-count-tag">{mockPdAgents.length} Agents Active</span>
          </div>

          <div className="pd-agent-list">
            {mockPdAgents.map((agent) => (
              <div key={agent.id} className="pd-agent-card" onClick={() => setSelectedAgent(agent)}>
                <div className="agent-avatar" style={{ backgroundColor: agent.avatarColor }}>
                  {agent.code.substring(3)}
                </div>
                <div className="agent-details">
                  <div className="agent-name-row">
                    <strong>{agent.name}</strong>
                    <span className={`agent-grade grade-${agent.performanceGrade.replace('+', 'plus')}`}>
                      Grade {agent.performanceGrade}
                    </span>
                  </div>
                  <p className="agent-zone"><MapPin size={13} /> {agent.zone}</p>
                  <div className="agent-stats-chips">
                    <span>🏬 {agent.activeMerchants} ร้าน</span>
                    <span>💵 {agent.monthlyVolume}/ด.</span>
                    {agent.kycPendingCount > 0 && (
                      <span className="chip-warning">⚠️ KYC ค้าง {agent.kycPendingCount}</span>
                    )}
                  </div>
                </div>
                <div className="agent-card-right">
                  <button type="button" className="pd-icon-btn" title="โทรหา Agent" onClick={(e) => { e.stopPropagation(); alert(`กำลังโทรหา ${agent.name} (${agent.phone})`) }}>
                    <Phone size={15} />
                  </button>
                  <ChevronRight size={18} className="muted-arrow" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right Column: Territories & Quick KYC Approval */}
        <div className="pd-side-stack">
          {/* Territory Overview */}
          <section className="pd-panel">
            <div className="pd-panel-header">
              <div>
                <h2>พื้นที่รับผิดชอบ (Territories)</h2>
                <p>สถานะการขยายเครือข่ายตามภูมิภาค</p>
              </div>
            </div>
            <div className="pd-territory-list">
              {mockPdTerritories.map((t) => (
                <div key={t.id} className="pd-territory-item">
                  <div className="t-header">
                    <strong>{t.zoneName}</strong>
                    <span className="t-growth">{t.growthRate}</span>
                  </div>
                  <div className="t-meta">
                    <span>{t.province}</span>
                    <span>{t.agentCount} Agents · {t.totalMerchants} ร้าน</span>
                  </div>
                  <div className="t-volume">
                    <small>ยอดขายรวม</small>
                    <strong>{t.monthlyVolume}</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Action Box */}
          <section className="pd-panel pd-action-box">
            <Zap size={24} className="amber-text" />
            <div>
              <h3>PD Action Center</h3>
              <p>อนุมัติ KYC ล็อตใหญ่ หรือส่งคำขอปรับปรุงพื้นที่ขายให้ Admin</p>
            </div>
            <button type="button" className="pd-btn-accent" onClick={() => alert('ส่งรายงานประจำสัปดาห์ให้ Admin เรียบร้อยแล้ว')}>
              📊 ส่งรายงานประจำสัปดาห์
            </button>
          </section>
        </div>
      </div>

      {/* KYC Final Approval Table for PD */}
      <section className="pd-panel pd-table-section">
        <div className="pd-panel-header">
          <div>
            <h2>คิวงานอนุมัติ KYC ขั้นสุดท้าย (PD Final Sign-Off)</h2>
            <p>เคสที่ผ่านการตรวจสอบเบื้องต้นจาก Agent แล้ว และรอ PD ลงนามอนุมัติเพื่อเปิดใช้งาน POS</p>
          </div>
          <button type="button" className="text-button" onClick={() => alert('แสดงเคสทั้งหมด')}>
            ดูทั้งหมด ({pdKycCases.length}) <ChevronRight size={16} />
          </button>
        </div>

        <div className="table-scroll">
          <table className="pd-table">
            <thead>
              <tr>
                <th>รหัสเคส / ร้านค้า</th>
                <th>เจ้าของ / Agent ผู้ดูแล</th>
                <th>ประเภท</th>
                <th>ระดับความเสี่ยง</th>
                <th>สถานะปัจจุบัน</th>
                <th>อนุมัติขั้นสุดท้าย</th>
              </tr>
            </thead>
            <tbody>
              {pdKycCases.map((item) => (
                <tr key={item.id} className="clickable-row" onClick={() => setSelectedCase(item)}>
                  <td>
                    <span className="row-id-pill">{item.id}</span>
                    <strong>{item.name}</strong>
                  </td>
                  <td>
                    <strong>{item.person}</strong>
                    <span className="sub-text">{item.detail}</span>
                  </td>
                  <td>{item.type}</td>
                  <td>
                    <span className={`risk-score-badge ${item.riskScore && item.riskScore > 30 ? 'high' : 'low'}`}>
                      Score: {item.riskScore ?? 5}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${item.tone}`}>
                      <span /> {item.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="pd-btn-signoff"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedCase(item)
                      }}
                    >
                      <CheckCircle2 size={14} /> ตรวจ & Sign-Off <ArrowUpRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modals */}
      <KycInspectorModal
        selectedCase={selectedCase}
        onClose={() => setSelectedCase(null)}
        onUpdateStatus={(id, status, _tone) => {
          alert(`PD ได้ทำการอัปเดตสถานะเคส ${id} เป็น "${status}" เรียบร้อยแล้ว`)
          setSelectedCase(null)
        }}
      />

      <WithdrawalModal
        selectedWithdrawal={withdrawalOpen ? {
          id: 'WDR-PD-CURRENT',
          name: 'PD-001 · ณัฐพล วัฒนกิจ',
          role: 'Provincial Director',
          amount: '฿84,250',
          bank: 'ธนาคารกสิกรไทย (KBANK)',
          accountNo: '045-2-99812-4',
          time: 'วันนี้ 16:00',
          status: 'pending'
        } : null}
        onClose={() => setWithdrawalOpen(false)}
        onApprove={() => {
          alert('ส่งคำขอถอนเงิน PD Royalty จำนวน ฿84,250 สำเร็จ! รอการโอนเงินเข้าบัญชีใน 24 ชม.')
          setWithdrawalOpen(false)
        }}
      />

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div className="pd-modal-backdrop" onClick={() => setSelectedAgent(null)}>
          <div className="pd-agent-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="agent-avatar-large" style={{ backgroundColor: selectedAgent.avatarColor }}>
                {selectedAgent.code}
              </div>
              <div>
                <h2>{selectedAgent.name}</h2>
                <p>โซนรับผิดชอบ: {selectedAgent.zone}</p>
              </div>
            </div>
            <div className="modal-body-grid">
              <div className="m-chip">
                <small>ร้านค้าในดูแล</small>
                <strong>{selectedAgent.activeMerchants} ร้าน</strong>
              </div>
              <div className="m-chip">
                <small>ยอดขายประจำเดือน</small>
                <strong>{selectedAgent.monthlyVolume}</strong>
              </div>
              <div className="m-chip">
                <small>เบอร์โทรศัพท์</small>
                <strong>{selectedAgent.phone}</strong>
              </div>
              <div className="m-chip">
                <small>เกรดผลงาน</small>
                <strong className="green-text">Grade {selectedAgent.performanceGrade}</strong>
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="pd-btn-secondary" onClick={() => setSelectedAgent(null)}>
                ปิดหน้าต่าง
              </button>
              <button type="button" className="pd-btn-primary" onClick={() => { alert(`ส่งข้อความสั่งการถึง ${selectedAgent.name} เรียบร้อยแล้ว`); setSelectedAgent(null); }}>
                💬 ส่งข้อความถึง Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Area Modal */}
      {areaModalOpen && (
        <div className="pd-modal-backdrop" onClick={() => setAreaModalOpen(false)}>
          <div className="pd-agent-modal" onClick={(e) => e.stopPropagation()}>
            <h2>➕ เพิ่ม Agent ใหม่ในสายงาน PD</h2>
            <p>กรอกรหัส Agent หรือส่งลิงก์เชิญเพื่อเข้าร่วมทีมดูแลพื้นที่</p>
            <div className="form-group" style={{ margin: '1rem 0' }}>
              <label>ชื่อ-นามสกุล Agent</label>
              <input type="text" placeholder="ระบุชื่อภาษาไทย..." className="pd-input" />
            </div>
            <div className="form-group" style={{ margin: '1rem 0' }}>
              <label>โซนพื้นที่รับผิดชอบ</label>
              <select className="pd-input">
                <option>กรุงเทพฯ (สุขุมวิท / คลองเตย)</option>
                <option>นนทบุรี (ปากเกร็ด / แจ้งวัฒนะ)</option>
                <option>ปทุมธานี (รังสิต)</option>
                <option>สมุทรปราการ (บางนา / สำโรง)</option>
              </select>
            </div>
            <div className="modal-foot">
              <button type="button" className="pd-btn-secondary" onClick={() => setAreaModalOpen(false)}>
                ยกเลิก
              </button>
              <button type="button" className="pd-btn-primary" onClick={() => { alert('เพิ่ม Agent ในสายงานสำเร็จ!'); setAreaModalOpen(false); }}>
                บันทึก Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

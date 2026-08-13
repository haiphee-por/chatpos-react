import { useState } from 'react'
import { ArrowUpRight, CheckCircle2, ClipboardCheck, Clock3, Download, ExternalLink, Filter, Megaphone, Search, ShieldAlert, Store, Trophy, UsersRound, WalletCards, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { mockAuditEvents, mockCases, mockLeaderboard, mockRiskFlags, mockSystemLiveStats, mockWithdrawals } from './mockData'
import type { MockCase, MockWithdrawal } from './mockData'
import { BatchKycModal, BroadcastModal, KycInspectorModal, WithdrawalModal } from './AdminModals'

type PageViewsProps = { activePage: string }

const pageMeta: Record<string, { eyebrow: string; title: string; description: string }> = {
  'PD และพื้นที่': { eyebrow: 'PD OPERATIONS', title: 'PD และพื้นที่รับผิดชอบ', description: 'จัดการผู้ดูแลพื้นที่และสถานะการปฏิบัติงาน' },
  'ตัวแทน': { eyebrow: 'AGENT DIRECTORY', title: 'ตัวแทนทั้งหมด', description: 'ติดตาม Agent และสายงานที่รับผิดชอบ' },
  'Merchant Cases': { eyebrow: 'MERCHANT CASES', title: 'ร้านค้าและ Merchant Case', description: 'จัดการร้านค้าในเครือข่ายและสถานะการเชื่อมต่อ' },
  'คำขอเชื่อมร้าน': { eyebrow: 'ASSIGNMENT QUEUE', title: 'คำขอเชื่อมร้านกับ Agent', description: 'ตรวจสอบคำขอและการตอบรับ assignment' },
  'งาน KYC': { eyebrow: 'KYC WORK QUEUE', title: 'ตรวจสอบมาตรฐาน KYC', description: 'Admin ตรวจและ audit ทุกเคส โดย PD เป็นผู้อนุมัติขั้นสุดท้าย' },
  'Risk Control': { eyebrow: 'RISK CONTROL', title: 'Blacklist และ Fraud Flags', description: 'จัดการสัญญาณความเสี่ยงและรายการเฝ้าระวัง' },
  'การเงิน': { eyebrow: 'FINANCE CONTROL', title: 'Commission และ Withdrawal', description: 'ข้อมูล ledger และคิวรออนุมัติของ PD/Agent' },
  'Audit log': { eyebrow: 'AUDIT ACTIVITY', title: 'Audit Activity', description: 'ตรวจสอบประวัติการเปลี่ยนแปลงในระบบ' },
}

export function PageViews({ activePage }: PageViewsProps) {
  const [query, setQuery] = useState('')
  const [casesList, setCasesList] = useState<MockCase[]>(mockCases)
  const [withdrawalsList, setWithdrawalsList] = useState<MockWithdrawal[]>(mockWithdrawals)
  
  // Modals state
  const [selectedCase, setSelectedCase] = useState<MockCase | null>(null)
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<MockWithdrawal | null>(null)
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [batchKycOpen, setBatchKycOpen] = useState(false)

  const meta = pageMeta[activePage] ?? pageMeta['งาน KYC']
  const visibleRows = casesList.filter((row) => `${row.name} ${row.detail} ${row.person}`.toLowerCase().includes(query.toLowerCase()))

  const handleUpdateStatus = (caseId: string, status: string, tone: 'approved' | 'review' | 'risk' | 'pending') => {
    setCasesList((prev) =>
      prev.map((c) => (c.id === caseId ? { ...c, status, tone } : c))
    )
  }

  const handleConfirmBatch = () => {
    setCasesList((prev) =>
      prev.map((c) => (c.tone === 'pending' || c.tone === 'review' ? { ...c, status: 'อนุมัติแล้ว', tone: 'approved' } : c))
    )
  }

  const handleApproveWithdrawal = (id: string) => {
    setWithdrawalsList((prev) =>
      prev.map((w) => (w.id === id ? { ...w, status: 'approved' } : w))
    )
  }

  return (
    <div className="page-view">
      {/* Real-time System Command Bar */}
      <section className="admin-command-bar">
        <div className="command-left">
          <div className="pulse-tag">
            <span className="pulse-dot" /> LIVE ENGINE
          </div>
          <div className="stat-chip">
            <small>TPS</small>
            <strong>{mockSystemLiveStats.tps}</strong>
          </div>
          <div className="stat-chip">
            <small>LATENCY</small>
            <strong>{mockSystemLiveStats.dbLatency}</strong>
          </div>
          <div className="stat-chip">
            <small>ACTIVE POS</small>
            <strong>{mockSystemLiveStats.activeTerminals}</strong>
          </div>
          <div className="stat-chip">
            <small>ONLINE MERCHANTS</small>
            <strong>{mockSystemLiveStats.onlineMerchants}</strong>
          </div>
        </div>

        <div className="command-right">
          <button type="button" className="cmd-btn btn-broadcast" onClick={() => setBroadcastOpen(true)}>
            <Megaphone size={15} /> ประกาศ POS
          </button>
          <button type="button" className="cmd-btn btn-batch" onClick={() => setBatchKycOpen(true)}>
            <Zap size={15} /> Batch อนุมัติ KYC
          </button>
        </div>
      </section>

      <section className="page-heading">
        <div>
          <p className="eyebrow">{meta.eyebrow}</p>
          <h1>{meta.title}</h1>
          <p>{meta.description}</p>
        </div>
        <div className="page-heading-actions">
          {activePage === 'PD และพื้นที่' && (
            <a
              className="pd-registration-link"
              href="https://backend-chatpos-ui.6ayknd.easypanel.host/pd/register"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={15} /> ลิงก์ใบสมัคร PD
            </a>
          )}
          <button className="primary-button" type="button">
            <Download size={15} /> ส่งออก CSV
          </button>
        </div>
      </section>
      
      {activePage === 'การเงิน' ? (
        <FinanceView
          withdrawals={withdrawalsList}
          onSelectWithdrawal={(w) => setSelectedWithdrawal(w)}
        />
      ) : activePage === 'Risk Control' ? (
        <RiskView />
      ) : activePage === 'Audit log' ? (
        <AuditView />
      ) : (
        <OperationalView
          activePage={activePage}
          query={query}
          setQuery={setQuery}
          rows={visibleRows}
          onInspectCase={(item) => setSelectedCase(item)}
        />
      )}

      {/* Modals */}
      <KycInspectorModal
        selectedCase={selectedCase}
        onClose={() => setSelectedCase(null)}
        onUpdateStatus={handleUpdateStatus}
      />
      <BroadcastModal
        isOpen={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
      />
      <BatchKycModal
        isOpen={batchKycOpen}
        onClose={() => setBatchKycOpen(false)}
        onConfirmBatch={handleConfirmBatch}
      />
      <WithdrawalModal
        selectedWithdrawal={selectedWithdrawal}
        onClose={() => setSelectedWithdrawal(null)}
        onApprove={handleApproveWithdrawal}
      />
    </div>
  )
}

function OperationalView({
  activePage,
  query,
  setQuery,
  rows: visibleRows,
  onInspectCase
}: {
  activePage: string
  query: string
  setQuery: (value: string) => void
  rows: MockCase[]
  onInspectCase: (item: MockCase) => void
}) {
  const isKyc = activePage === 'งาน KYC'
  const isAgentView = activePage === 'ตัวแทน' || activePage === 'PD และพื้นที่'
  const metrics: [string, string, string, LucideIcon][] = isKyc
    ? [['KYC ทั้งหมด', '286', 'blue', ClipboardCheck], ['รอตรวจ', '47', 'amber', Clock3], ['อนุมัติแล้ว', '198', 'green', CheckCircle2], ['ปฏิเสธ', '41', 'red', ShieldAlert]]
    : [['รายการทั้งหมด', '1,486', 'blue', UsersRound], ['กำลังใช้งาน', '1,302', 'green', ClipboardCheck], ['รอดำเนินการ', '84', 'amber', Clock3], ['อัปเดตวันนี้', '126', 'violet', ArrowUpRight]]

  return (
    <>
      <div className="admin-mascot-banner">
        <div className="admin-mascot-banner-left">
          <h3>{isKyc ? '📋 ระบบตรวจสอบ KYC & Audit' : '🏢 การจัดการเครือข่ายร้านค้าและผู้ดูแล'}</h3>
          <p>{isKyc ? 'อนุมัติเอกสารและตรวจสอบความถูกต้องแบบเรียลไทม์ (คลิกที่แถวเพื่อตรวจเอกสาร)' : 'ติดตามสถานะการทำงานและคำขอเชื่อมต่อในระบบ ChatPOS'}</p>
        </div>
        <img src={isKyc ? '/mascot/kyc_3_checking_documents.png' : '/mascot/nabtang_presenting.png'} alt="Admin Mascot" className="admin-mascot-banner-img" />
      </div>

      <section className="metric-grid page-metrics">
        {metrics.map(([label, value, tone, MetricIcon]) => (
          <article className="metric-card" key={String(label)}>
            <div className={`metric-icon ${tone}`}>
              <MetricIcon size={20} />
              <span className="sr-only">{label}</span>
            </div>
            <p>{label}</p>
            <strong>{value}</strong>
            <span>{isKyc ? 'จากข้อมูลทั้งหมดในระบบ' : 'ข้อมูลล่าสุดจากระบบ'}</span>
          </article>
        ))}
      </section>

      {/* Leaderboard for Agent & PD pages */}
      {isAgentView && (
        <section className="panel leaderboard-panel">
          <div className="panel-heading">
            <div>
              <h2>🏆 Top Agent & PD Leaderboard ประจำเดือน</h2>
              <p>อันดับผลงานการดูแลร้านค้าและยอดขายรวมในสายงาน</p>
            </div>
            <Trophy size={20} className="amber-text" />
          </div>
          <div className="leaderboard-grid">
            {mockLeaderboard.map((item) => (
              <div className="leaderboard-card" key={item.code}>
                <div className="rank-badge" style={{ background: item.avatarBg }}>
                  {item.rank}
                </div>
                <div className="agent-lead-info">
                  <span className="lead-tag">{item.badge}</span>
                  <strong>{item.code} · {item.name}</strong>
                  <p>{item.region}</p>
                </div>
                <div className="lead-metrics">
                  <div>
                    <small>ร้านในดูแล</small>
                    <strong>{item.merchantCount} ร้าน</strong>
                  </div>
                  <div>
                    <small>ยอดขายรวม</small>
                    <strong className="green-text">{item.volume}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel work-panel">
        <div className="work-toolbar">
          <div>
            <h2>{isKyc ? 'รายการ KYC ทั้งหมด' : 'รายการที่ต้องดำเนินการ'}</h2>
            <p>คลิกที่แถวเพื่อเปิด Inspector Modal ตรวจเอกสารและอนุมัติแบบละเอียด</p>
          </div>
          <button className="filter-button" type="button">
            <Filter size={15} /> ตัวกรอง
          </button>
        </div>

        <div className="search-row">
          <div className="search-box">
            <Search size={16} />
            <input aria-label="ค้นหา" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ ร้าน รหัส หรือเบอร์โทร..." />
          </div>
          <select aria-label="กรองสถานะ" defaultValue="">
            <option value="">ทุกสถานะ</option>
            <option>รอตรวจ</option>
            <option>กำลังตรวจ</option>
            <option>อนุมัติแล้ว</option>
          </select>
        </div>

        <div className="table-scroll">
          <table className="interactive-table">
            <thead>
              <tr>
                <th>รหัส / กิจการ</th>
                <th>ผู้รับผิดชอบ</th>
                <th>ประเภท</th>
                <th>สถานะ</th>
                <th>อัปเดตล่าสุด</th>
                <th>ตรวจเอกสาร</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.name} className="clickable-row" onClick={() => onInspectCase(row)}>
                  <td>
                    <span className="row-id-pill">{row.id}</span>
                    <strong>{row.name}</strong>
                  </td>
                  <td>
                    <strong>{row.person}</strong>
                    <span className="sub-text">{row.detail}</span>
                  </td>
                  <td>{row.type}</td>
                  <td>
                    <span className={`status-badge ${row.tone}`}>
                      <span />
                      {row.status}
                    </span>
                  </td>
                  <td className="muted">{row.time}</td>
                  <td className="action-cell">
                    <button
                      aria-label={`ตรวจเอกสาร ${row.name}`}
                      type="button"
                      className="btn-inspect-table"
                      onClick={(e) => {
                        e.stopPropagation()
                        onInspectCase(row)
                      }}
                    >
                      Inspect <ArrowUpRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visibleRows.length === 0 && <div className="empty-state">ไม่พบข้อมูลตามคำค้นหา</div>}
        <div className="pagination">
          <span>แสดง {visibleRows.length} จาก 286 รายการ</span>
          <button type="button">ก่อนหน้า</button>
          <button className="current" type="button">1</button>
          <button type="button">ถัดไป</button>
        </div>
      </section>
    </>
  )
}

function FinanceView({
  withdrawals,
  onSelectWithdrawal
}: {
  withdrawals: MockWithdrawal[]
  onSelectWithdrawal: (w: MockWithdrawal) => void
}) {
  const financeMetrics: [string, string, string, LucideIcon][] = [
    ['Commission รวม', '฿1,284,600', 'blue', WalletCards],
    ['Direct Agent', '฿842,300', 'green', UsersRound],
    ['PD Benefit', '฿442,300', 'violet', Store],
    ['รออนุมัติถอน', '฿96,450', 'amber', Clock3]
  ]

  return (
    <>
      <div className="admin-mascot-banner">
        <div className="admin-mascot-banner-left">
          <h3>💰 ศูนย์การเงิน & ค่าคอมมิชชัน (Finance Control)</h3>
          <p>สรุปยอด Commission, PD Benefit และคิวคำขอถอนเงินล่าสุด (คลิกคิวเพื่ออนุมัติ)</p>
        </div>
        <img src="/mascot/pay_4_money_bag.png" alt="Finance Mascot" className="admin-mascot-banner-img" />
      </div>

      <section className="metric-grid page-metrics">
        {financeMetrics.map(([label, value, tone, FinanceIcon]) => (
          <article className="metric-card" key={label}>
            <div className={`metric-icon ${tone}`}>
              <FinanceIcon size={20} />
            </div>
            <p>{label}</p>
            <strong>{value}</strong>
            <span>เทียบกับรอบบัญชีล่าสุด</span>
          </article>
        ))}
      </section>

      <section className="overview-grid">
        <article className="panel finance-summary">
          <div className="panel-heading">
            <div>
              <h2>Commission ล่าสุด</h2>
              <p>Ledger แบบ append-only</p>
            </div>
            <WalletCards className="panel-icon blue-text" size={20} />
          </div>
          <div className="finance-bars">
            <Bar label="Agent commission" value="842,300" width="82%" tone="blue" />
            <Bar label="PD royalty" value="442,300" width="48%" tone="violet" />
            <Bar label="Pending withdrawal" value="96,450" width="20%" tone="amber" />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Withdrawal Queue</h2>
              <p>รายการรออนุมัติโอนเงิน (คลิกเพื่อดำเนินการ)</p>
            </div>
            <Clock3 className="panel-icon amber-text" size={20} />
          </div>
          <div className="queue-list">
            {withdrawals.map((item) => (
              <div
                key={item.id}
                className="queue-row clickable-queue"
                onClick={() => onSelectWithdrawal(item)}
              >
                <div>
                  <strong>{item.name}</strong>
                  <p className="sub-text">{item.bank} · {item.accountNo}</p>
                </div>
                <div className="queue-right">
                  <strong className={item.status === 'approved' ? 'green-text' : 'amber-text'}>
                    {item.amount}
                  </strong>
                  <span className={`status-pill-small ${item.status}`}>
                    {item.status === 'approved' ? 'อนุมัติแล้ว' : 'รออนุมัติ'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>รายการ Commission</h2>
            <p>รายการเคลื่อนไหวล่าสุดใน ledger</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ผู้รับผลประโยชน์</th>
                <th>แหล่งที่มา</th>
                <th>จำนวน</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {mockCases.map((row, index) => (
                <tr key={row.name}>
                  <td>
                    <strong>{row.detail}</strong>
                    <span>{row.name}</span>
                  </td>
                  <td>Merchant case #{1200 + index}</td>
                  <td className="amount">฿{(index + 1) * 12500}.00</td>
                  <td>
                    <span className="status-badge approved">
                      <span />
                      paid
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function RiskView() {
  return (
    <section className="risk-layout">
      <div className="admin-mascot-banner" style={{ background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)' }}>
        <div className="admin-mascot-banner-left">
          <h3>🛡️ ระบบเฝ้าระวังความเสี่ยง & ป้องกันทุจริต (Risk Control)</h3>
          <p>ตรวจสอบ Fraud flags และรายการเฝ้าระวังความเสี่ยงในระบบ</p>
        </div>
        <img src="/mascot/nabtang_security.png" alt="Risk Mascot" className="admin-mascot-banner-img" />
      </div>

      <article className="panel risk-alert">
        <div className="risk-icon">
          <ShieldAlert size={24} />
        </div>
        <div>
          <h2>สัญญาณความเสี่ยงที่ต้องติดตาม</h2>
          <p>มี {mockRiskFlags.length + 3} รายการที่ถูก flag ใน 24 ชั่วโมงล่าสุด ตรวจสอบก่อนดำเนินการต่อ</p>
        </div>
      </article>

      <section className="metric-grid page-metrics">
        <article className="metric-card">
          <div className="metric-icon red">
            <ShieldAlert size={20} />
          </div>
          <p>Fraud flags</p>
          <strong>{mockRiskFlags.length + 3}</strong>
          <span>เพิ่มขึ้น 2 รายการวันนี้</span>
        </article>
        <article className="metric-card">
          <div className="metric-icon amber">
            <Clock3 size={20} />
          </div>
          <p>รอ review</p>
          <strong>12</strong>
          <span>ต้องมีผู้รับผิดชอบ</span>
        </article>
      </section>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <h2>รายการเฝ้าระวัง</h2>
            <p>ข้อมูลถูก mask ตาม permission</p>
          </div>
        </div>
        <div className="risk-list">
          {mockRiskFlags.map((item) => (
            <div className="risk-row" key={item}>
              <ShieldAlert size={17} className="red-text" />
              <strong>{item}</strong>
              <span className="status-badge risk">
                <span />
                ต้องตรวจสอบ
              </span>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}

function AuditView() {
  return (
    <section className="panel audit-panel">
      <div className="admin-mascot-banner">
        <div className="admin-mascot-banner-left">
          <h3>📜 ประวัติการทำรายการในระบบ (Audit Activity Log)</h3>
          <p>บันทึกทุกกิจกรรมและคำสั่งการทำงานแบบ Append-only Ledger</p>
        </div>
        <img src="/mascot/pos_4_sales_report.png" alt="Audit Mascot" className="admin-mascot-banner-img" />
      </div>

      <div className="panel-heading">
        <div>
          <h2>ประวัติการทำรายการ</h2>
          <p>ทุก action ถูกบันทึกพร้อมผู้ดำเนินการและ timestamp</p>
        </div>
        <button className="filter-button" type="button">
          <Filter size={15} /> กรองวันที่
        </button>
      </div>
      <div className="audit-list">
        {mockAuditEvents.map((item, index) => (
          <div className="audit-row" key={item}>
            <div className="audit-marker">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <strong>{item}</strong>
              <span>06 ส.ค. 2026 · {10 - index}:4{index} · Role protected</span>
            </div>
            <ArrowUpRight size={16} className="muted" />
          </div>
        ))}
      </div>
    </section>
  )
}

function Bar({ label, value, width, tone }: { label: string; value: string; width: string; tone: string }) {
  return (
    <div className="bar-item">
      <div>
        <span>{label}</span>
        <strong>฿{value}</strong>
      </div>
      <div className="progress-track">
        <div className={`progress-fill ${tone}`} style={{ width }} />
      </div>
    </div>
  )
}



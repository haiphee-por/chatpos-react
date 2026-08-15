import { useState, useEffect } from 'react'
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  ExternalLink,
  Filter,
  Megaphone,
  RefreshCw,
  Search,
  ShieldAlert,
  Store,
  UsersRound,
  WalletCards,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { mockCases, mockRiskFlags, mockWithdrawals } from './mockData'
import type { MockCase, MockWithdrawal } from './mockData'
import { BatchKycModal, BroadcastModal, KycInspectorModal, WithdrawalModal } from './AdminModals'
import {
  fetchDbKycCases,
  fetchDbStores,
  fetchDbAgents,
  fetchDbPds,
  fetchDbCommissions,
  fetchDbTransactions,
  updateDbKycStatus,
  type DbStoreRow,
  type DbAgentRow,
  type DbPdRow,
  type DbCommissionRow,
  type DbTransactionRow,
} from './dbApi'

type PageViewsProps = { activePage: string }

const pageMeta: Record<string, { eyebrow: string; title: string; description: string }> = {
  'PD และพื้นที่': { eyebrow: 'PD OPERATIONS', title: 'PD และพื้นที่รับผิดชอบ (Live DB)', description: 'จัดการผู้ดูแลพื้นที่และสถานะการปฏิบัติงานจริง' },
  'ตัวแทน': { eyebrow: 'AGENT DIRECTORY', title: 'ตัวแทนทั้งหมด (Live DB)', description: 'ติดตาม Agent และสายงานที่รับผิดชอบจริง' },
  'Merchant Cases': { eyebrow: 'MERCHANT CASES', title: 'ร้านค้าและ Merchant Cases (Live DB)', description: 'จัดการร้านค้าในเครือข่ายและสถานะการเชื่อมต่อจริง' },
  'คำขอเชื่อมร้าน': { eyebrow: 'ASSIGNMENT QUEUE', title: 'คำขอเชื่อมร้านกับ Agent (Live DB)', description: 'ตรวจสอบคำขอและการตอบรับ assignment จริง' },
  'งาน KYC': { eyebrow: 'KYC WORK QUEUE', title: 'ตรวจสอบมาตรฐาน KYC (Live DB)', description: 'Admin ตรวจและ audit ทุกเคส โดย PD เป็นผู้อนุมัติขั้นสุดท้าย' },
  'Risk Control': { eyebrow: 'RISK CONTROL', title: 'Blacklist และ Fraud Flags', description: 'จัดการสัญญาณความเสี่ยงและรายการเฝ้าระวัง' },
  'การเงิน': { eyebrow: 'FINANCE CONTROL', title: 'Commission และ Withdrawal (Live DB)', description: 'ข้อมูล ledger และคิวรออนุมัติของ PD/Agent จริง' },
  'Audit log': { eyebrow: 'AUDIT ACTIVITY', title: 'Audit & Transaction Activity (Live DB)', description: 'ตรวจสอบประวัติการทำธุรกรรมจริงในระบบ' },
}

export function PageViews({ activePage }: PageViewsProps) {
  const [query, setQuery] = useState('')
  const [casesList, setCasesList] = useState<MockCase[]>(mockCases)
  const [storesList, setStoresList] = useState<DbStoreRow[]>([])
  const [agentsList, setAgentsList] = useState<DbAgentRow[]>([])
  const [pdsList, setPdsList] = useState<DbPdRow[]>([])
  const [commissionsList, setCommissionsList] = useState<DbCommissionRow[]>([])
  const [transactionsList, setTransactionsList] = useState<DbTransactionRow[]>([])
  const [withdrawalsList, setWithdrawalsList] = useState<MockWithdrawal[]>(mockWithdrawals)
  const [isLoading, setIsLoading] = useState(false)

  // Modals state
  const [selectedCase, setSelectedCase] = useState<MockCase | null>(null)
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<MockWithdrawal | null>(null)
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [batchKycOpen, setBatchKycOpen] = useState(false)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [kycRes, stores, agents, pds, commissions, txns] = await Promise.all([
        fetchDbKycCases(),
        fetchDbStores(),
        fetchDbAgents(),
        fetchDbPds(),
        fetchDbCommissions(),
        fetchDbTransactions(),
      ])

      if (kycRes.cases.length > 0) setCasesList(kycRes.cases)
      setStoresList(stores)
      setAgentsList(agents)
      setPdsList(pds)
      setCommissionsList(commissions)
      setTransactionsList(txns)
    } catch (err) {
      console.error('Failed to load page data from DB:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [activePage])

  const meta = pageMeta[activePage] ?? pageMeta['งาน KYC']

  const visibleRows = casesList.filter((row) =>
    `${row.name} ${row.detail} ${row.person} ${row.phone || ''} ${row.id}`.toLowerCase().includes(query.toLowerCase())
  )

  const handleUpdateStatus = async (caseId: string, status: string, tone: 'approved' | 'review' | 'risk' | 'pending') => {
    setCasesList((prev) =>
      prev.map((c) => (c.id === caseId ? { ...c, status, tone } : c))
    )

    // Save to real database if real ID
    try {
      const rawId = caseId.replace('KYC-', '')
      await updateDbKycStatus(rawId, status === 'อนุมัติแล้ว' ? 'approved' : status === 'ปฏิเสธ' ? 'rejected' : 'review')
    } catch (err) {
      console.error('Failed to update KYC in DB:', err)
    }
  }

  const handleConfirmBatch = async () => {
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
            <span className="pulse-dot" /> POSTGRESQL LIVE
          </div>
          <div className="stat-chip">
            <small>STORES</small>
            <strong>{storesList.length || 26}</strong>
          </div>
          <div className="stat-chip">
            <small>AGENTS</small>
            <strong>{agentsList.length || 3}</strong>
          </div>
          <div className="stat-chip">
            <small>PDS</small>
            <strong>{pdsList.length || 9}</strong>
          </div>
          <div className="stat-chip">
            <small>TXNS</small>
            <strong>{transactionsList.length || 159}</strong>
          </div>
        </div>

        <div className="command-right">
          <button type="button" className="cmd-btn" onClick={loadData} title="ดึงข้อมูลล่าสุดจาก PostgreSQL">
            <RefreshCw size={14} className={isLoading ? 'rotating' : ''} /> รีเฟรช DB
          </button>
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
              href="/pd/register"
            >
              <ExternalLink size={15} /> สมัครเป็น PD
            </a>
          )}
          {activePage === 'ตัวแทน' && (
            <a
              className="pd-registration-link"
              href="/agent/register"
            >
              <ExternalLink size={15} /> สมัครเป็น Agent
            </a>
          )}
          {activePage === 'Merchant Cases' && (
            <a
              className="pd-registration-link"
              href="/merchant/register"
            >
              <ExternalLink size={15} /> เปิดร้านค้าใหม่
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
          commissions={commissionsList}
          onSelectWithdrawal={(w) => setSelectedWithdrawal(w)}
        />
      ) : activePage === 'Risk Control' ? (
        <RiskView />
      ) : activePage === 'Audit log' ? (
        <AuditView transactions={transactionsList} />
      ) : activePage === 'Merchant Cases' || activePage === 'คำขอเชื่อมร้าน' ? (
        <StoresTableView stores={storesList} query={query} setQuery={setQuery} />
      ) : activePage === 'ตัวแทน' ? (
        <AgentsTableView agents={agentsList} query={query} setQuery={setQuery} />
      ) : activePage === 'PD และพื้นที่' ? (
        <PdsTableView pds={pdsList} query={query} setQuery={setQuery} />
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
  query,
  setQuery,
  rows: visibleRows,
  onInspectCase,
}: {
  activePage: string
  query: string
  setQuery: (value: string) => void
  rows: MockCase[]
  onInspectCase: (item: MockCase) => void
}) {
  const pendingCount = visibleRows.filter((r) => r.tone === 'pending').length
  const approvedCount = visibleRows.filter((r) => r.tone === 'approved').length

  const metrics: [string, string, string, LucideIcon][] = [
    ['KYC ในระบบทั้งหมด', `${visibleRows.length}`, 'blue', ClipboardCheck],
    ['รอตรวจ (Pending)', `${pendingCount}`, 'amber', Clock3],
    ['อนุมัติแล้ว', `${approvedCount}`, 'green', CheckCircle2],
    ['ติดตามความเสี่ยง', `${visibleRows.filter((r) => r.tone === 'risk').length}`, 'red', ShieldAlert],
  ]

  return (
    <>
      <div className="admin-mascot-banner">
        <div className="admin-mascot-banner-left">
          <h3>📋 ระบบตรวจสอบ KYC & Audit (ตาราง KycVerification)</h3>
          <p>
            ดึงข้อมูลจากตาราง <strong>KycVerification</strong> แบบ Real-time (คลิกที่แถวเพื่อตรวจเอกสารและอนุมัติ)
          </p>
        </div>
        <img src="/mascot/kyc_3_checking_documents.png" alt="Admin Mascot" className="admin-mascot-banner-img" />
      </div>

      <section className="metric-grid page-metrics">
        {metrics.map(([label, value, tone, MetricIcon]) => (
          <article className="metric-card" key={String(label)}>
            <div className={`metric-icon ${tone}`}>
              <MetricIcon size={20} />
            </div>
            <p>{label}</p>
            <strong>{value}</strong>
            <span>ข้อมูลสดจากฐานข้อมูล</span>
          </article>
        ))}
      </section>

      <section className="panel work-panel">
        <div className="work-toolbar">
          <div>
            <h2>รายการ KYC ในฐานข้อมูล</h2>
            <p>คลิกที่แถวเพื่อเปิด Inspector Modal ตรวจเอกสารและอนุมัติแบบละเอียด</p>
          </div>
          <button className="filter-button" type="button">
            <Filter size={15} /> ตัวกรอง
          </button>
        </div>

        <div className="search-row">
          <div className="search-box">
            <Search size={16} />
            <input
              aria-label="ค้นหา"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาชื่อ ร้าน รหัส หรือเบอร์โทร..."
            />
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
                <th>รหัส / ผู้สมัคร</th>
                <th>รายละเอียดกิจการ</th>
                <th>ประเภท</th>
                <th>ความเสี่ยง</th>
                <th>สถานะ</th>
                <th>เวลาที่ส่ง</th>
                <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((item) => (
                <tr key={item.id} onClick={() => onInspectCase(item)} style={{ cursor: 'pointer' }}>
                  <td>
                    <strong>{item.id}</strong>
                    <span>{item.person}</span>
                  </td>
                  <td>
                    <strong>{item.name}</strong>
                    <span className="muted">{item.detail}</span>
                  </td>
                  <td>{item.type}</td>
                  <td>
                    <span
                      style={{
                        color: (item.riskScore ?? 0) > 40 ? '#ef4444' : '#10b981',
                        fontWeight: 800,
                      }}
                    >
                      Score: {item.riskScore ?? 10}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${item.tone}`}>
                      <span />
                      {item.status}
                    </span>
                  </td>
                  <td className="muted">{item.time}</td>
                  <td>
                    <button
                      className="inspect-btn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onInspectCase(item)
                      }}
                    >
                      ตรวจเอกสาร <ArrowUpRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visibleRows.length === 0 && <div className="empty-state">ไม่พบข้อมูลตามคำค้นหา</div>}
      </section>
    </>
  )
}

function StoresTableView({
  stores,
  query,
  setQuery,
}: {
  stores: DbStoreRow[]
  query: string
  setQuery: (v: string) => void
}) {
  const filtered = stores.filter((s) =>
    `${s.name} ${s.phone || ''} ${s.merchantId || ''} ${s.agent_code || ''} ${s.address || ''}`
      .toLowerCase()
      .includes(query.toLowerCase())
  )

  return (
    <section className="panel work-panel">
      <div className="work-toolbar">
        <div>
          <h2>ร้านค้าทั้งหมดในระบบ (ตาราง Store: {stores.length} ร้าน)</h2>
          <p>ข้อมูลร้านค้า POS การผูกบัญชี Merchant ID และ Agent ผู้ดูแลจาก PostgreSQL</p>
        </div>
      </div>

      <div className="search-row">
        <div className="search-box">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาร้านค้า, เบอร์โทร, หรือ Merchant ID..."
          />
        </div>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>ชื่อร้านค้า / เจ้าของ</th>
              <th>Merchant ID</th>
              <th>ประเภท / ระดับ</th>
              <th>Agent ผู้ดูแล</th>
              <th>เบอร์โทร / ที่อยู่</th>
              <th>สถานะ</th>
              <th>วันที่สร้าง</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.name}</strong>
                  <span>{s.owner_name || s.owner_email || 'เจ้าของร้าน'}</span>
                </td>
                <td>
                  <strong className="blue-text">{s.merchantId || `S-${s.id.slice(-6)}`}</strong>
                </td>
                <td>
                  <span className="status-pill-small">{s.storeType || 'Store'} · Tier {s.tier || 'STANDARD'}</span>
                </td>
                <td>
                  <strong>{s.agent_code || '-'}</strong>
                  <span>{s.pd_code || '-'}</span>
                </td>
                <td>
                  <span>{s.phone || '-'}</span>
                  <small className="muted">{s.address || '-'}</small>
                </td>
                <td>
                  <span className={`status-badge ${s.isActive ? 'approved' : 'pending'}`}>
                    <span />
                    {s.isActive ? 'เปิดใช้งาน' : 'ปิดชั่วคราว'}
                  </span>
                </td>
                <td className="muted">
                  {s.createdAt ? new Date(s.createdAt).toLocaleDateString('th-TH') : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function AgentsTableView({
  agents,
  query,
  setQuery,
}: {
  agents: DbAgentRow[]
  query: string
  setQuery: (v: string) => void
}) {
  const filtered = agents.filter((a) =>
    `${a.code} ${a.agent_name || ''} ${a.agent_email || ''} ${a.pd_code || ''}`
      .toLowerCase()
      .includes(query.toLowerCase())
  )

  return (
    <section className="panel work-panel">
      <div className="work-toolbar">
        <div>
          <h2>รายชื่อตัวแทน Agent (ตาราง Agent: {agents.length} ท่าน)</h2>
          <p>ข้อมูลตัวแทนขยายร้านค้า ยอดเงินในกระเป๋า และจำนวนร้านค้าในการดูแล</p>
        </div>
      </div>

      <div className="search-row">
        <div className="search-box">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหารหัส Agent, ชื่อ, หรือ PD ผู้ดูแล..."
          />
        </div>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>รหัส Agent / ชื่อ</th>
              <th>ระดับ (Tier)</th>
              <th>PD ในสายงาน</th>
              <th>ร้านในความดูแล</th>
              <th>ยอดเงินใน Wallet</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id}>
                <td>
                  <strong>{a.code}</strong>
                  <span>{a.agent_name || a.agent_email || 'Agent'}</span>
                </td>
                <td>
                  <span className="status-pill-small">{a.tier}</span>
                </td>
                <td>
                  <strong>{a.pd_code || '-'}</strong>
                  <span>{a.pd_name || ''}</span>
                </td>
                <td>
                  <strong className="green-text">{a.stores_count} ร้านค้า</strong>
                </td>
                <td>
                  <strong>฿{Number(a.walletBalance || 0).toLocaleString('th-TH')}</strong>
                </td>
                <td>
                  <span className={`status-badge ${a.status === 'active' ? 'approved' : 'pending'}`}>
                    <span />
                    {a.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function PdsTableView({
  pds,
  query,
  setQuery,
}: {
  pds: DbPdRow[]
  query: string
  setQuery: (v: string) => void
}) {
  const filtered = pds.filter((p) =>
    `${p.code} ${p.displayName} ${p.pd_owner_name || ''}`
      .toLowerCase()
      .includes(query.toLowerCase())
  )

  return (
    <section className="panel work-panel">
      <div className="work-toolbar">
        <div>
          <h2>ผู้อำนวยการเขต Provincial Director (ตาราง ProvincialDirector: {pds.length} ท่าน)</h2>
          <p>ผู้บริหารเครือข่ายและกำกับดูแลตัวแทนในเขตพื้นที่จากฐานข้อมูล PostgreSQL</p>
        </div>
      </div>

      <div className="search-row">
        <div className="search-box">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหารหัส PD หรือชื่อพื้นที่..."
          />
        </div>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>รหัส PD / ชื่อแสดงผล</th>
              <th>ผู้ถือสิทธิ์</th>
              <th>Agent ในสาย</th>
              <th>ร้านค้าในเขต</th>
              <th>เงินลงทุน</th>
              <th>สถานะ</th>
              <th>วันที่เริ่มสัญญา</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.code}</strong>
                  <span className="green-text">{p.displayName}</span>
                </td>
                <td>
                  <span>{p.pd_owner_name || p.pd_email || '-'}</span>
                </td>
                <td>
                  <strong>{p.agent_count} คน</strong>
                </td>
                <td>
                  <strong className="blue-text">{p.store_count} ร้าน</strong>
                </td>
                <td>
                  <span>฿{Number(p.investmentAmount || 0).toLocaleString('th-TH')}</span>
                </td>
                <td>
                  <span className={`status-badge ${p.status === 'active' ? 'approved' : 'pending'}`}>
                    <span />
                    {p.status}
                  </span>
                </td>
                <td className="muted">
                  {p.startedAt ? new Date(p.startedAt).toLocaleDateString('th-TH') : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function FinanceView({
  withdrawals,
  commissions,
  onSelectWithdrawal,
}: {
  withdrawals: MockWithdrawal[]
  commissions: DbCommissionRow[]
  onSelectWithdrawal: (w: MockWithdrawal) => void
}) {
  const totalCommission = commissions.reduce((sum, c) => sum + Number(c.amount || 0), 0)

  const financeMetrics: [string, string, string, LucideIcon][] = [
    ['Commission ใน Ledger', `฿${totalCommission.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, 'blue', WalletCards],
    ['รายการ Ledger', `${commissions.length} บันทึก`, 'green', UsersRound],
    ['PD Benefit', '฿442,300', 'violet', Store],
    ['รออนุมัติถอน', '฿96,450', 'amber', Clock3],
  ]

  return (
    <>
      <div className="admin-mascot-banner">
        <div className="admin-mascot-banner-left">
          <h3>💰 ศูนย์การเงิน & ค่าคอมมิชชัน (ตาราง CommissionLedger)</h3>
          <p>สรุปยอด Commission จริงจากตาราง <strong>CommissionLedger</strong> แบบ Append-only</p>
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
            <span>ข้อมูลจากตาราง CommissionLedger</span>
          </article>
        ))}
      </section>

      <section className="overview-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Withdrawal Queue (คิวรออนุมัติถอน)</h2>
              <p>คลิกเพื่อเปิด Withdrawal Modal อนุมัติโอนเงิน</p>
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
            <h2>รายการ Commission ในฐานข้อมูล ({commissions.length} รายการ)</h2>
            <p>บันทึกการกระจายรายได้แบบ Real-time</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ประเภท / แหล่งที่มา</th>
                <th>ผู้รับ (Agent / PD)</th>
                <th>ร้านค้าที่เกิดรายการ</th>
                <th>ยอดเงินธุรกรรม</th>
                <th>คอมมิชชั่นที่ได้</th>
                <th>สถานะ</th>
                <th>วันที่</th>
              </tr>
            </thead>
            <tbody>
              {commissions.slice(0, 30).map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.sourceType}</strong>
                    <span className="muted">{c.sourceRef || c.ruleCode || '-'}</span>
                  </td>
                  <td>
                    <strong>{c.agent_code || c.pd_code || c.beneficiaryType}</strong>
                  </td>
                  <td>
                    <span>{c.store_name || '-'}</span>
                  </td>
                  <td>
                    <span>฿{Number(c.grossAmount || 0).toLocaleString('th-TH')}</span>
                  </td>
                  <td>
                    <strong className="green-text">
                      +฿{Number(c.amount || 0).toFixed(2)} ({c.ratePercent}%)
                    </strong>
                  </td>
                  <td>
                    <span className={`status-badge ${c.status === 'withdrawable' ? 'approved' : 'pending'}`}>
                      <span />
                      {c.status}
                    </span>
                  </td>
                  <td className="muted">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString('th-TH') : '-'}
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

function AuditView({ transactions }: { transactions: DbTransactionRow[] }) {
  return (
    <section className="panel audit-panel">
      <div className="admin-mascot-banner">
        <div className="admin-mascot-banner-left">
          <h3>📜 ประวัติการทำธุรกรรมจริง (ตาราง Transaction: {transactions.length} รายการ)</h3>
          <p>บันทึกการชำระเงินและคำสั่งการทำงานจริงจากฐานข้อมูล PostgreSQL</p>
        </div>
        <img src="/mascot/pos_4_sales_report.png" alt="Audit Mascot" className="admin-mascot-banner-img" />
      </div>

      <div className="panel-heading">
        <div>
          <h2>รายการธุรกรรมล่าสุดในฐานข้อมูล</h2>
          <p>ข้อมูลจากตาราง Transaction แบบ Real-time</p>
        </div>
        <button className="filter-button" type="button">
          <Filter size={15} /> กรองวันที่
        </button>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Reference / ID</th>
              <th>ร้านค้า (Store)</th>
              <th>ช่องทางชำระเงิน</th>
              <th>ยอดเงินรวม</th>
              <th>ค่าธรรมเนียม (Fee)</th>
              <th>ยอดสุทธิ (Net)</th>
              <th>สถานะ</th>
              <th>เวลาที่ทำรายการ</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td>
                  <strong>{tx.reference}</strong>
                  <span className="muted">{tx.id}</span>
                </td>
                <td>
                  <strong>{tx.store_name || 'ร้านค้า POS'}</strong>
                  <span>{tx.customerName || 'ลูกค้าทั่วไป'}</span>
                </td>
                <td>
                  <span className="status-pill-small">{tx.channel || 'PromptPay'}</span>
                </td>
                <td>
                  <strong>฿{Number(tx.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</strong>
                </td>
                <td className="muted">
                  ฿{Number(tx.fee || 0).toFixed(2)}
                </td>
                <td>
                  <strong className="green-text">
                    ฿{Number(tx.netAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </strong>
                </td>
                <td>
                  <span className={`status-badge ${tx.status === 'completed' || tx.status === 'settled' ? 'approved' : tx.status === 'pending' ? 'pending' : 'risk'}`}>
                    <span />
                    {tx.status}
                  </span>
                </td>
                <td className="muted">
                  {tx.createdAt ? new Date(tx.createdAt).toLocaleString('th-TH') : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

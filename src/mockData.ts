export type MockStatusTone = 'pending' | 'review' | 'approved' | 'risk'

export type MockCase = {
  id: string
  name: string
  person: string
  detail: string
  type: string
  status: string
  tone: MockStatusTone
  time: string
  taxId?: string
  phone?: string
  bankAccount?: string
  bankName?: string
  riskScore?: number
  address?: string
  docUrl?: string
  storePhoto?: string
}

export const mockCases: MockCase[] = [
  { 
    id: 'KYC-8801', 
    name: 'บริษัท แสงทอง เทรดดิ้ง จำกัด', 
    person: 'ณัฐพล วัฒนกิจ', 
    detail: 'PD-001 · กรุงเทพฯ', 
    type: 'นิติบุคคล', 
    status: 'กำลังตรวจ', 
    tone: 'review', 
    time: 'วันนี้ 10:42',
    taxId: '0105564019284',
    phone: '081-923-4411',
    bankAccount: '045-2-99812-4',
    bankName: 'ธนาคารกสิกรไทย (KBANK)',
    riskScore: 12,
    address: '88/12 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110',
    docUrl: '/mascot/kyc_3_checking_documents.png',
    storePhoto: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80'
  },
  { 
    id: 'KYC-8802', 
    name: 'ร้านกาแฟบ้านสวน Cafe & Bistro', 
    person: 'พิมพ์ชนก ศรีสุข', 
    detail: 'AG-204 · เชียงใหม่', 
    type: 'บุคคลธรรมดา', 
    status: 'รอตรวจ', 
    tone: 'pending', 
    time: 'วันนี้ 09:18',
    taxId: '3-1002-00918-12-0',
    phone: '089-456-1122',
    bankAccount: '901-0-44120-9',
    bankName: 'ธนาคารไทยพาณิชย์ (SCB)',
    riskScore: 5,
    address: '142 หมู่ 3 ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200',
    docUrl: '/mascot/kyc_3_checking_documents.png',
    storePhoto: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80'
  },
  { 
    id: 'KYC-8803', 
    name: 'บริษัท นอร์ทสตาร์ โลจิสติกส์ จำกัด', 
    person: 'ธนกร เกียรติไพบูลย์', 
    detail: 'PD-018 · ขอนแก่น', 
    type: 'นิติบุคคล', 
    status: 'อนุมัติแล้ว', 
    tone: 'approved', 
    time: 'เมื่อวาน 16:30',
    taxId: '0405561009121',
    phone: '086-312-9988',
    bankAccount: '112-3-00912-7',
    bankName: 'ธนาคารกรุงเทพ (BBL)',
    riskScore: 2,
    address: '55/9 ถนนมิตรภาพ อ.เมือง จ.ขอนแก่น 40000',
    docUrl: '/mascot/kyc_3_checking_documents.png',
    storePhoto: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'
  },
  { 
    id: 'KYC-8804', 
    name: 'Mellow Home Studio', 
    person: 'วรัญญา จันทร์ดี', 
    detail: 'AG-087 · นนทบุรี', 
    type: 'บุคคลธรรมดา', 
    status: 'ติดตามเพิ่ม', 
    tone: 'risk', 
    time: 'เมื่อวาน 14:06',
    taxId: '1-1004-99812-44-1',
    phone: '092-881-3344',
    bankAccount: '772-0-11245-3',
    bankName: 'ธนาคารกรุงไทย (KTB)',
    riskScore: 78,
    address: '19/44 ถนนแจ้งวัฒนะ อ.ปากเกร็ด จ.นนทบุรี 11120',
    docUrl: '/mascot/kyc_3_checking_documents.png',
    storePhoto: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=600&q=80'
  },
  { 
    id: 'KYC-8805', 
    name: 'บริษัท โกลเด้นฟู้ด จำกัด', 
    person: 'ศุภชัย รุ่งเรือง', 
    detail: 'AG-118 · ชลบุรี', 
    type: 'นิติบุคคล', 
    status: 'กำลังตรวจ', 
    tone: 'review', 
    time: 'เมื่อวาน 11:52',
    taxId: '0205562019912',
    phone: '083-112-9900',
    bankAccount: '408-1-22901-5',
    bankName: 'ธนาคารกสิกรไทย (KBANK)',
    riskScore: 35,
    address: '88 หมู่ 5 ต.แสนสุข อ.เมือง จ.ชลบุรี 20130',
    docUrl: '/mascot/kyc_3_checking_documents.png',
    storePhoto: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80'
  },
  { 
    id: 'KYC-8806', 
    name: 'บ้านต้นไม้โฮมเมด Bakery', 
    person: 'กมลชนก สายใจ', 
    detail: 'AG-302 · ภูเก็ต', 
    type: 'บุคคลธรรมดา', 
    status: 'รอตรวจ', 
    tone: 'pending', 
    time: '05 ส.ค. 16:24',
    taxId: '3-8301-00219-88-2',
    phone: '084-992-1133',
    bankAccount: '612-2-90182-1',
    bankName: 'ธนาคารกรุงศรีอยุธยา (BAY)',
    riskScore: 8,
    address: '24/1 ถนนถลาง ต.ตลาดใหญ่ อ.เมือง จ.ภูเก็ต 83000',
    docUrl: '/mascot/kyc_3_checking_documents.png',
    storePhoto: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80'
  },
]

export const mockAuditEvents = [
  'Admin Demo อนุมัติ KYC บริษัท นอร์ทสตาร์ โลจิสติกส์',
  'PD-018 ส่งคำขอถอนเงิน ฿48,200 (อนุมัติเรียบร้อย)',
  'Operations Admin เปลี่ยน assignment ร้านกาแฟบ้านสวน ให้ Agent AG-204',
  'KYC Admin เพิ่ม fraud flag ให้ Mellow Home Studio (ที่อยู่เอกสารไม่ตรง)',
  'Agent AG-118 ส่งเอกสาร KYC เพิ่มเติมสำหรับ บริษัท โกลเด้นฟู้ด',
  'System Engine ประมวลผล Settlement ประจำวันสำเร็จ 3,610 บัญชี',
]

export const mockRiskFlags = [
  'บริษัท แสงทอง เทรดดิ้ง · เลขบัญชีซ้ำกับระบบเดิม',
  'Mellow Home Studio · เอกสารบัตรประชาชนหมดอายุ',
  'ร้านค้าบ้านสวน Cafe · ยอดทำรายการเพิ่มขึ้น 400% ใน 1 ชม. (High Velocity)',
  'บริษัท โกลเด้นฟู้ด จำกัด · พบการเข้าใช้งานจาก IP ต่างประเทศซ้ำกัน',
]

export type MockWithdrawal = {
  id: string
  name: string
  role: string
  amount: string
  bank: string
  accountNo: string
  time: string
  status: 'pending' | 'approved' | 'rejected'
}

export const mockWithdrawals: MockWithdrawal[] = [
  { id: 'WDR-901', name: 'PD-018 · สมชาย ใจดี', role: 'President Director', amount: '฿48,200', bank: 'ธนาคารกสิกรไทย', accountNo: '045-2-xxxx1-4', time: 'วันนี้ 09:30', status: 'pending' },
  { id: 'WDR-902', name: 'AG-204 · พิมพ์ชนก ศรีสุข', role: 'Senior Agent', amount: '฿31,750', bank: 'ธนาคารไทยพาณิชย์', accountNo: '901-0-xxxx0-9', time: 'วันนี้ 10:15', status: 'pending' },
  { id: 'WDR-903', name: 'AG-087 · ธนกร เกียรติไพบูลย์', role: 'Agent', amount: '฿16,500', bank: 'ธนาคารกรุงเทพ', accountNo: '112-3-xxxx2-7', time: 'เมื่อวาน 18:40', status: 'pending' },
  { id: 'WDR-904', name: 'PD-001 · ณัฐพล วัฒนกิจ', role: 'President Director', amount: '฿12,800', bank: 'ธนาคารกสิกรไทย', accountNo: '088-1-xxxx9-0', time: 'เมื่อวาน 15:20', status: 'approved' },
]

export type LeaderboardAgent = {
  rank: number
  code: string
  name: string
  region: string
  merchantCount: number
  volume: string
  approvalRate: number
  badge: string
  avatarBg: string
}

export const mockLeaderboard: LeaderboardAgent[] = [
  { rank: 1, code: 'PD-001', name: 'ณัฐพล วัฒนกิจ', region: 'กรุงเทพฯ & ปริมณฑล', merchantCount: 318, volume: '฿4,820,000', approvalRate: 98, badge: '🥇 Top Performer', avatarBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
  { rank: 2, code: 'PD-018', name: 'สมชาย ใจดี', region: 'ภาคตะวันออกเฉียงเหนือ', merchantCount: 245, volume: '฿3,450,000', approvalRate: 95, badge: '🥈 Excellent', avatarBg: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)' },
  { rank: 3, code: 'AG-204', name: 'พิมพ์ชนก ศรีสุข', region: 'ภาคเหนือ (เชียงใหม่)', merchantCount: 182, volume: '฿2,190,000', approvalRate: 92, badge: '🥉 Rising Star', avatarBg: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)' },
  { rank: 4, code: 'AG-118', name: 'ศุภชัย รุ่งเรือง', region: 'ภาคตะวันออก (ชลบุรี)', merchantCount: 156, volume: '฿1,840,000', approvalRate: 89, badge: '⭐ Top Agent', avatarBg: 'linear-gradient(135deg, #059669 0%, #047857 100%)' },
]

export const mockSystemLiveStats = {
  tps: '1,420 txn/sec',
  dbLatency: '12 ms',
  activeTerminals: '3,610 เครื่อง',
  onlineMerchants: '1,302 ร้าน',
  gatewayStatus: '100% Operational',
  lastSettlement: 'วันนี้ 02:00 น.'
}

// Dedicated Data for PD (Provincial Director)
export type MockPdAgentItem = {
  id: string
  code: string
  name: string
  zone: string
  phone: string
  activeMerchants: number
  monthlyVolume: string
  kycPendingCount: number
  status: 'active' | 'busy' | 'offline'
  performanceGrade: 'A+' | 'A' | 'B+' | 'B'
  avatarColor: string
}

export const mockPdAgents: MockPdAgentItem[] = [
  { id: 'AG-101', code: 'AG-204', name: 'พิมพ์ชนก ศรีสุข', zone: 'เชียงใหม่ (โซนเมือง)', phone: '089-456-1122', activeMerchants: 48, monthlyVolume: '฿1,250,000', kycPendingCount: 2, status: 'active', performanceGrade: 'A+', avatarColor: '#3b82f6' },
  { id: 'AG-102', code: 'AG-087', name: 'ธนกร เกียรติไพบูลย์', zone: 'นนทบุรี / ปากเกร็ด', phone: '086-312-9988', activeMerchants: 36, monthlyVolume: '฿980,000', kycPendingCount: 4, status: 'active', performanceGrade: 'A', avatarColor: '#10b981' },
  { id: 'AG-103', code: 'AG-118', name: 'ศุภชัย รุ่งเรือง', zone: 'ชลบุรี / บางแสน', phone: '083-112-9900', activeMerchants: 42, monthlyVolume: '฿1,120,000', kycPendingCount: 1, status: 'busy', performanceGrade: 'A+', avatarColor: '#f59e0b' },
  { id: 'AG-104', code: 'AG-302', name: 'กมลชนก สายใจ', zone: 'ภูเก็ต (ป่าตอง)', phone: '084-992-1133', activeMerchants: 29, monthlyVolume: '฿760,000', kycPendingCount: 3, status: 'active', performanceGrade: 'B+', avatarColor: '#ec4899' },
  { id: 'AG-105', code: 'AG-409', name: 'อนันต์ สุขประเสริฐ', zone: 'กรุงเทพฯ (สุขุมวิท)', phone: '081-334-8899', activeMerchants: 54, monthlyVolume: '฿1,680,000', kycPendingCount: 0, status: 'active', performanceGrade: 'A+', avatarColor: '#8b5cf6' },
]

export type MockPdTerritory = {
  id: string
  zoneName: string
  province: string
  leadPd: string
  agentCount: number
  totalMerchants: number
  monthlyVolume: string
  growthRate: string
  status: 'optimal' | 'expanding' | 'needs_agent'
}

export const mockPdTerritories: MockPdTerritory[] = [
  { id: 'TR-01', zoneName: 'กรุงเทพฯ & ปริมณฑล', province: 'กรุงเทพมหานคร', leadPd: 'PD-001 (ณัฐพล)', agentCount: 18, totalMerchants: 318, monthlyVolume: '฿4,820,000', growthRate: '+14.2%', status: 'optimal' },
  { id: 'TR-02', zoneName: 'ภาคเหนือตอนบน', province: 'เชียงใหม่ / เชียงราย', leadPd: 'PD-005 (วิชัย)', agentCount: 9, totalMerchants: 182, monthlyVolume: '฿2,190,000', growthRate: '+9.8%', status: 'expanding' },
  { id: 'TR-03', zoneName: 'ภาคตะวันออกเฉียงเหนือ', province: 'ขอนแก่น / อุดรธานี', leadPd: 'PD-018 (สมชาย)', agentCount: 12, totalMerchants: 245, monthlyVolume: '฿3,450,000', growthRate: '+18.5%', status: 'optimal' },
  { id: 'TR-04', zoneName: 'ภาคใต้ชายฝั่ง', province: 'ภูเก็ต / สุราษฎร์ฯ', leadPd: 'PD-022 (ธีรเดช)', agentCount: 6, totalMerchants: 115, monthlyVolume: '฿1,480,000', growthRate: '+5.4%', status: 'needs_agent' },
]

// Dedicated Data for Agent Portal
export type MockAgentMerchant = {
  id: string
  name: string
  owner: string
  category: string
  phone: string
  address: string
  posTerminals: number
  todayVolume: string
  monthlyVolume: string
  onlineStatus: 'online' | 'offline'
  kycStatus: 'อนุมัติแล้ว' | 'รอตรวจ' | 'เอกสารไม่ครบ'
  kycTone: MockStatusTone
  registeredDate: string
}

export const mockAgentMerchants: MockAgentMerchant[] = [
  { id: 'MER-701', name: 'ร้านกาแฟบ้านสวน Cafe & Bistro', owner: 'พิมพ์ชนก ศรีสุข', category: 'คาเฟ่ & เบเกอรี่', phone: '089-456-1122', address: '142 หมู่ 3 ต.สุเทพ อ.เมือง จ.เชียงใหม่', posTerminals: 3, todayVolume: '฿14,250', monthlyVolume: '฿284,000', onlineStatus: 'online', kycStatus: 'อนุมัติแล้ว', kycTone: 'approved', registeredDate: '12 มิ.ย. 2026' },
  { id: 'MER-702', name: 'ชาบูนางใน สาขาชิดลม', owner: 'ชัยยศ รัตนพร', category: 'ร้านอาหาร & บุฟเฟต์', phone: '081-998-2233', address: 'ชั้น 2 เซ็นทรัลชิดลม กรุงเทพฯ', posTerminals: 5, todayVolume: '฿42,800', monthlyVolume: '฿890,000', onlineStatus: 'online', kycStatus: 'อนุมัติแล้ว', kycTone: 'approved', registeredDate: '01 พ.ค. 2026' },
  { id: 'MER-703', name: 'Mellow Home Studio', owner: 'วรัญญา จันทร์ดี', category: 'สตูดิโอ & แฟชั่น', phone: '092-881-3344', address: '19/44 ถนนแจ้งวัฒนะ นนทบุรี', posTerminals: 1, todayVolume: '฿0', monthlyVolume: '฿45,000', onlineStatus: 'offline', kycStatus: 'เอกสารไม่ครบ', kycTone: 'risk', registeredDate: '02 ส.ค. 2026' },
  { id: 'MER-704', name: 'ซูชิมาสเตอร์ Japanese Resto', owner: 'เกริกฤทธิ์ เกษมศักดิ์', category: 'อาหารญี่ปุ่น', phone: '086-771-4455', address: '88/9 สุขุมวิท 39 กรุงเทพฯ', posTerminals: 4, todayVolume: '฿28,400', monthlyVolume: '฿620,000', onlineStatus: 'online', kycStatus: 'อนุมัติแล้ว', kycTone: 'approved', registeredDate: '18 ก.ค. 2026' },
  { id: 'MER-705', name: 'บ้านต้นไม้โฮมเมด Bakery', owner: 'กมลชนก สายใจ', category: 'เบเกอรี่สด', phone: '084-992-1133', address: '24/1 ถนนถลาง จ.ภูเก็ต', posTerminals: 2, todayVolume: '฿6,800', monthlyVolume: '฿120,000', onlineStatus: 'online', kycStatus: 'รอตรวจ', kycTone: 'pending', registeredDate: '05 ส.ค. 2026' },
  { id: 'MER-706', name: 'มินิมาร์ทชุมชน อารีย์', owner: 'สมเกียรติ สันติสุข', category: 'ร้านสะดวกซื้อ', phone: '082-554-1188', address: '55 ซอยพหลโยธิน 7 กรุงเทพฯ', posTerminals: 2, todayVolume: '฿18,900', monthlyVolume: '฿340,000', onlineStatus: 'online', kycStatus: 'อนุมัติแล้ว', kycTone: 'approved', registeredDate: '10 มิ.ย. 2026' },
]

export type MockAgentCommissionStream = {
  id: string
  storeName: string
  txnCount: number
  grossVolume: string
  commissionRate: string
  agentEarning: string
  pdRoyalty: string
  date: string
}

export const mockAgentCommissions: MockAgentCommissionStream[] = [
  { id: 'COMM-801', storeName: 'ชาบูนางใน สาขาชิดลม', txnCount: 142, grossVolume: '฿42,800', commissionRate: '0.8%', agentEarning: '฿342.40', pdRoyalty: '฿85.60', date: 'วันนี้' },
  { id: 'COMM-802', storeName: 'ซูชิมาสเตอร์ Japanese Resto', txnCount: 98, grossVolume: '฿28,400', commissionRate: '0.8%', agentEarning: '฿227.20', pdRoyalty: '฿56.80', date: 'วันนี้' },
  { id: 'COMM-803', storeName: 'มินิมาร์ทชุมชน อารีย์', txnCount: 215, grossVolume: '฿18,900', commissionRate: '0.6%', agentEarning: '฿113.40', pdRoyalty: '฿28.35', date: 'วันนี้' },
  { id: 'COMM-804', storeName: 'ร้านกาแฟบ้านสวน Cafe', txnCount: 74, grossVolume: '฿14,250', commissionRate: '0.8%', agentEarning: '฿114.00', pdRoyalty: '฿28.50', date: 'เมื่อวาน' },
]



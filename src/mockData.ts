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


export type MockStatusTone = 'pending' | 'review' | 'approved' | 'risk'

export type MockCase = {
  name: string
  person: string
  detail: string
  type: string
  status: string
  tone: MockStatusTone
  time: string
}

export const mockCases: MockCase[] = [
  { name: 'บริษัท แสงทอง เทรดดิ้ง', person: 'ณัฐพล วัฒนกิจ', detail: 'PD-001 · กรุงเทพฯ', type: 'นิติบุคคล', status: 'กำลังตรวจ', tone: 'review', time: 'วันนี้ 10:42' },
  { name: 'ร้านกาแฟบ้านสวน', person: 'พิมพ์ชนก ศรีสุข', detail: 'AG-204 · เชียงใหม่', type: 'บุคคลธรรมดา', status: 'รอตรวจ', tone: 'pending', time: 'วันนี้ 09:18' },
  { name: 'บริษัท นอร์ทสตาร์ โลจิสติกส์', person: 'ธนกร เกียรติไพบูลย์', detail: 'PD-018 · ขอนแก่น', type: 'นิติบุคคล', status: 'อนุมัติแล้ว', tone: 'approved', time: 'เมื่อวาน 16:30' },
  { name: 'Mellow Home Studio', person: 'วรัญญา จันทร์ดี', detail: 'AG-087 · นนทบุรี', type: 'บุคคลธรรมดา', status: 'ติดตามเพิ่ม', tone: 'risk', time: 'เมื่อวาน 14:06' },
  { name: 'บริษัท โกลเด้นฟู้ด จำกัด', person: 'ศุภชัย รุ่งเรือง', detail: 'AG-118 · ชลบุรี', type: 'นิติบุคคล', status: 'กำลังตรวจ', tone: 'review', time: 'เมื่อวาน 11:52' },
  { name: 'บ้านต้นไม้โฮมเมด', person: 'กมลชนก สายใจ', detail: 'AG-302 · ภูเก็ต', type: 'บุคคลธรรมดา', status: 'รอตรวจ', tone: 'pending', time: '05 ส.ค. 16:24' },
]

export const mockAuditEvents = [
  'Admin Demo อนุมัติ KYC บริษัท นอร์ทสตาร์',
  'PD-018 ส่งคำขอถอนเงิน ฿48,200',
  'Operations Admin เปลี่ยน assignment ร้านกาแฟบ้านสวน',
  'KYC Admin เพิ่ม fraud flag ให้ Mellow Home Studio',
  'Agent AG-118 ส่งเอกสาร KYC เพิ่มเติม',
]

export const mockRiskFlags = [
  'บริษัท แสงทอง เทรดดิ้ง · เลขบัญชีซ้ำ',
  'Mellow Home Studio · เอกสารไม่ตรงกัน',
  'ร้านค้าบ้านสวน · velocity สูงผิดปกติ',
  'บริษัท โกลเด้นฟู้ด จำกัด · IP ซ้ำหลายบัญชี',
]

export const mockWithdrawals = [
  { name: 'PD-018 · สมชาย ใจดี', amount: '฿48,200' },
  { name: 'AG-204 · พิมพ์ชนก', amount: '฿31,750' },
  { name: 'AG-087 · ธนกร', amount: '฿16,500' },
  { name: 'PD-001 · ณัฐพล', amount: '฿12,800' },
]

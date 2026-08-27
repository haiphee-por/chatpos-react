import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, FileCheck2, FilePlus2, MessageCircle, RefreshCw, ShieldAlert, Upload, X } from 'lucide-react'
import {
  fetchKycWorkspace,
  fetchDbAssignments,
  markKycMessageRead,
  postKycMessage,
  submitKycCase,
  submitKycDocument,
  type DbAssignmentRow,
  type KycDocumentTimeline,
  type KycDocumentVersion,
  type KycWorkspace,
} from './dbApi'

type MerchantKycViewProps = { storeId: string | null }

const statusCopy: Record<string, { label: string; color: string; background: string }> = {
  draft: { label: 'ยังไม่ส่งตรวจ', color: '#64748b', background: '#f8fafc' },
  needs_more_info: { label: 'ขอข้อมูลเพิ่มเติม', color: '#b45309', background: '#fffbeb' },
  merchant_replied: { label: 'ตอบกลับแล้ว รอตรวจซ้ำ', color: '#0369a1', background: '#eff6ff' },
  WAITING_AGENT_REVIEW: { label: 'รอ Agent ตรวจข้อมูล', color: '#7c3aed', background: '#f5f3ff' },
  pending_agent_review: { label: 'รอ Agent ตรวจข้อมูล', color: '#7c3aed', background: '#f5f3ff' },
  agent_passed: { label: 'Agent ส่งต่อแล้ว', color: '#047857', background: '#ecfdf5' },
  pending_pd_compliance: { label: 'รอ PD / Compliance', color: '#0369a1', background: '#eff6ff' },
  approved: { label: 'อนุมัติแล้ว', color: '#047857', background: '#ecfdf5' },
  rejected: { label: 'ไม่ผ่านการตรวจ', color: '#b91c1c', background: '#fef2f2' },
}

const documentStatus: Record<string, string> = {
  not_uploaded: 'ยังไม่อัปโหลด',
  uploaded: 'อัปโหลดแล้ว',
  under_review: 'กำลังตรวจ',
  approved: 'ผ่านแล้ว',
  needs_revision: 'ขอแก้ไข',
  expired: 'หมดอายุ',
  rejected: 'ไม่ผ่าน',
}

function formatBytes(value: number | string) {
  const bytes = Number(value)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function latestVersion(document: KycDocumentTimeline) {
  return document.versions[0] || null
}

function VersionComparison({ document }: { document: KycDocumentTimeline }) {
  const [selectedVersion, setSelectedVersion] = useState(document.versions[0]?.version || 0)
  const selected = document.versions.find((version) => version.version === selectedVersion) || document.versions[0]
  const previous = document.versions.find((version) => version.version === (selected?.version || 0) - 1)
  if (!selected) return <p style={{ color: '#78968a', fontSize: 12 }}>ยังไม่มี document version</p>

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid #e4eee9', paddingTop: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#527267' }} htmlFor={`version-${document.id}`}>ดู version</label>
        <select id={`version-${document.id}`} value={selected.version} onChange={(event) => setSelectedVersion(Number(event.target.value))} style={{ border: '1px solid #cfe1d8', borderRadius: 6, padding: '5px 8px', background: '#fff', color: '#24473b' }}>
          {document.versions.map((version) => <option key={version.id} value={version.version}>v{version.version} · {documentStatus[version.status] || version.status}</option>)}
        </select>
        {selected.version === document.latestVersion && <span style={{ color: '#047857', fontSize: 11, fontWeight: 700 }}>เวอร์ชันล่าสุด</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8, marginTop: 10 }}>
        <VersionCard title={`Version ${selected.version}`} version={selected} />
        {previous ? <VersionCard title={`เทียบกับ version ${previous.version}`} version={previous} muted /> : <div style={{ padding: 10, color: '#78968a', fontSize: 11, background: '#f8fbf9', borderRadius: 7 }}>นี่คือ version แรกของเอกสาร</div>}
      </div>
    </div>
  )
}

function VersionCard({ title, version, muted = false }: { title: string; version: KycDocumentVersion; muted?: boolean }) {
  return (
    <div style={{ padding: 10, borderRadius: 7, background: muted ? '#f8fbf9' : '#f1f8f4', border: '1px solid #e1eee7' }}>
      <strong style={{ display: 'block', color: '#315a4d', fontSize: 11 }}>{title}</strong>
      <span style={{ display: 'block', marginTop: 5, color: '#527267', fontSize: 11 }}>{version.fileName} · {formatBytes(version.fileSize)}</span>
      <code style={{ display: 'block', marginTop: 5, color: '#78968a', fontSize: 10, overflowWrap: 'anywhere' }}>{version.checksumSha256}</code>
      <span style={{ display: 'block', marginTop: 5, color: '#78968a', fontSize: 10 }}>{new Date(version.createdAt).toLocaleString('th-TH')}</span>
      {version.reason && <span style={{ display: 'block', marginTop: 5, color: '#6c897e', fontSize: 10 }}>เหตุผล: {version.reason}</span>}
    </div>
  )
}

export function MerchantKycView({ storeId }: MerchantKycViewProps) {
  const [workspace, setWorkspace] = useState<KycWorkspace | null>(null)
  const [loading, setLoading] = useState(Boolean(storeId))
  const [error, setError] = useState('')
  const [documentType, setDocumentType] = useState('id-card-front')
  const [correctionReason, setCorrectionReason] = useState('')
  const [uploading, setUploading] = useState(false)
  const [chatText, setChatText] = useState('')
  const [sending, setSending] = useState(false)
  const [attachedVersion, setAttachedVersion] = useState<KycDocumentVersion | null>(null)
  const [assignment, setAssignment] = useState<DbAssignmentRow | null>(null)
  const [requestingAssignment, setRequestingAssignment] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const loadWorkspace = async () => {
    if (!storeId) return
    setLoading(true)
    setError('')
    try {
      const [nextWorkspace, assignments] = await Promise.all([fetchKycWorkspace(storeId), fetchDbAssignments(storeId)])
      setWorkspace(nextWorkspace)
      setAssignment(assignments[0] || null)
    } catch (loadError: any) {
      setError(loadError?.message || 'ไม่สามารถโหลดข้อมูล KYC ได้')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadWorkspace() }, [storeId])

  const status = statusCopy[workspace?.case.status || 'draft'] || { label: workspace?.case.status || 'ไม่ทราบสถานะ', color: '#64748b', background: '#f8fafc' }
  const unreadMessages = useMemo(() => workspace?.messages.filter((message) => !message.readAt && message.senderRole !== 'merchant') || [], [workspace])

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !storeId || !workspace) return
    setUploading(true)
    setError('')
    try {
      await submitKycDocument(storeId, workspace.case.id, {
        documentType,
        file,
        reason: correctionReason || undefined,
        sourceRequestId: crypto.randomUUID(),
        sourceIssuedAt: new Date().toISOString(),
      })
      setCorrectionReason('')
      await loadWorkspace()
    } catch (uploadError: any) {
      setError(uploadError?.message || 'อัปโหลดเอกสารไม่สำเร็จ')
    } finally {
      setUploading(false)
    }
  }

  const sendMessage = async () => {
    if (!storeId || !workspace || (!chatText.trim() && !attachedVersion)) return
    setSending(true)
    setError('')
    try {
      await postKycMessage(storeId, workspace.case.id, {
        message: chatText.trim() || undefined,
        attachments: attachedVersion ? [{ fileName: attachedVersion.fileName, mimeType: attachedVersion.mimeType, fileSize: Number(attachedVersion.fileSize), checksumSha256: attachedVersion.checksumSha256, storageLocator: attachedVersion.storageLocator }] : undefined,
      })
      setChatText('')
      setAttachedVersion(null)
      await loadWorkspace()
    } catch (messageError: any) {
      setError(messageError?.message || 'ส่งข้อความไม่สำเร็จ')
    } finally {
      setSending(false)
    }
  }

  const markRead = async (messageId: string) => {
    if (!storeId || !workspace) return
    try {
      await markKycMessageRead(storeId, workspace.case.id, messageId)
      await loadWorkspace()
    } catch (readError: any) {
      setError(readError?.message || 'อัปเดตสถานะอ่านข้อความไม่สำเร็จ')
    }
  }

  const requestAgentPdReview = async () => {
    if (!storeId || !workspace || requestingAssignment) return
    setRequestingAssignment(true)
    setError('')
    setSuccessMessage('')
    try {
      const sourceRequestId = `merchant-kyc-submit-${workspace.case.id}`
      const result = await submitKycCase(storeId, workspace.case.id, sourceRequestId)
      setAssignment(result.data.assignment || null)
      setSuccessMessage(result.data.backoffice.status === 'FORWARDED'
        ? 'บันทึกคำขอและส่งต่อไปยังระบบ Agent / PD แล้ว'
        : 'บันทึกคำขอแล้ว ระบบจะส่งต่อไปยัง Backoffice เมื่อ credential พร้อม')
      await loadWorkspace()
    } catch (requestError: any) {
      setError(requestError?.message || 'ไม่สามารถส่งคำขอให้ Agent/PD ได้')
    } finally {
      setRequestingAssignment(false)
    }
  }

  if (!storeId) return <section className="merchant-empty-state"><FileCheck2 size={28} /><h2>ยังไม่มี Store context</h2><p>เข้าสู่ระบบร้านค้าเพื่อดู KYC workspace</p></section>

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ padding: 20, borderRadius: 14, background: 'linear-gradient(135deg, #effaf4, #ffffff)', border: '1px solid #d6e9df' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: '#648076', fontSize: 11, fontWeight: 800, letterSpacing: '.06em' }}>MERCHANT KYC WORKSPACE</span>
            <h2 style={{ margin: '6px 0 4px', color: '#24473b', fontSize: 24 }}>เอกสารและการตรวจสอบร้านค้า</h2>
            <p style={{ margin: 0, color: '#648076', fontSize: 13 }}>Case {workspace?.case.case_number || 'กำลังโหลด'} · เก็บประวัติทุก version และข้อความแบบแก้ทับไม่ได้</p>
          </div>
          <button type="button" onClick={loadWorkspace} disabled={loading} title="รีเฟรช KYC workspace" style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, border: '1px solid #cfe1d8', borderRadius: 8, background: '#fff', color: '#28745c', cursor: loading ? 'wait' : 'pointer' }}><RefreshCw size={16} className={loading ? 'spin' : ''} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, padding: '10px 12px', borderRadius: 9, background: status.background, color: status.color }}>
          <ShieldAlert size={18} /><strong>{status.label}</strong><span style={{ fontSize: 12 }}>· Agent จะตรวจซ้ำเมื่อข้อมูลที่กระทบ KYC เปลี่ยน</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 12, padding: '12px 14px', border: '1px solid #d6e9df', borderRadius: 9, background: '#fff' }}>
          <div>
            <strong style={{ display: 'block', color: '#315a4d', fontSize: 13 }}>ส่งเคสให้ Agent / PD ตรวจสอบ</strong>
            <span style={{ display: 'block', marginTop: 4, color: '#78968a', fontSize: 11 }}>
              {assignment?.status === 'ACCEPTED' ? 'Agent รับดูแลแล้ว และรอผลตรวจ KYC จาก PD' : assignment?.status === 'PENDING_AGENT_ACCEPTANCE' ? 'ส่งคำขอแล้ว รอ Agent กดยอมรับ' : assignment?.status === 'PENDING_ADMIN_ASSIGNMENT' ? 'ส่งคำขอแล้ว รอ Admin จัดสรร Agent' : assignment?.status === 'PENDING_BACKOFFICE_DISPATCH' ? 'บันทึกคำขอแล้ว รอส่งต่อ Backoffice เมื่อ credential พร้อม' : 'ส่งคำขอลงทะเบียนไปยังระบบ Agent / PD เมื่อข้อมูลพร้อม'}
            </span>
          </div>
          <button type="button" onClick={requestAgentPdReview} disabled={requestingAssignment || assignment?.status === 'PENDING_AGENT_ACCEPTANCE' || assignment?.status === 'PENDING_ADMIN_ASSIGNMENT'} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 0, borderRadius: 8, padding: '10px 13px', background: requestingAssignment ? '#9ab9ad' : '#28745c', color: '#fff', cursor: requestingAssignment ? 'wait' : 'pointer', fontSize: 12, fontWeight: 700 }}>
            <CheckCircle2 size={15} />{requestingAssignment ? 'กำลังส่งคำขอ...' : assignment?.status === 'ACCEPTED' ? 'ส่งคำขอทบทวนอีกครั้ง' : 'ส่งคำขอให้ Agent / PD'}
          </button>
        </div>
      </section>

      {error && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 9, background: '#fff1f2', color: '#b91c1c', border: '1px solid #fecdd3', fontSize: 12 }}><X size={16} />{error}</div>}
      {successMessage && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 9, background: '#effaf4', color: '#28745c', border: '1px solid #cfe1d8', fontSize: 12 }}><CheckCircle2 size={16} />{successMessage}</div>}
      {loading && <div style={{ padding: 28, textAlign: 'center', color: '#648076' }}>กำลังโหลด KYC workspace...</div>}

      {!loading && workspace && <>
        <section style={{ padding: 18, borderRadius: 12, background: '#fff', border: '1px solid #e0ece5' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div><h3 style={{ margin: 0, color: '#315a4d', fontSize: 17 }}>Document timeline</h3><p style={{ margin: '5px 0 0', color: '#78968a', fontSize: 12 }}>เอกสารเก่าจะคงอยู่เสมอ การแก้ไขจะสร้าง version ใหม่</p></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} style={{ border: '1px solid #cfe1d8', borderRadius: 7, padding: '8px 10px', color: '#315a4d', background: '#fff' }}><option value="id-card-front">บัตรประชาชนด้านหน้า</option><option value="id-card-back">บัตรประชาชนด้านหลัง</option><option value="selfie-with-id">ภาพถ่ายคู่บัตรประชาชน</option><option value="business-document">ทะเบียนพาณิชย์ / บริษัท</option><option value="store-front">รูปหน้าร้าน</option><option value="store-interior">รูปภายในร้าน</option><option value="product-photos">รูปสินค้า</option><option value="bank-book">หลักฐานบัญชีธนาคาร</option><option value="sales-evidence">หลักฐานการขาย</option><option value="shipping-evidence">หลักฐานการจัดส่ง</option></select>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 11px', borderRadius: 7, background: '#28745c', color: '#fff', fontSize: 12, fontWeight: 700, cursor: uploading ? 'wait' : 'pointer' }}><Upload size={15} />{uploading ? 'กำลังตรวจไฟล์...' : 'เพิ่ม version'}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleUpload} disabled={uploading} hidden /></label>
            </div>
          </div>
          <input value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="เหตุผลการส่งแก้ไข (ถ้ามี)" style={{ width: '100%', boxSizing: 'border-box', marginTop: 10, border: '1px solid #e0ece5', borderRadius: 7, padding: '9px 10px', color: '#315a4d' }} />
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {workspace.documents.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#78968a', background: '#f8fbf9', borderRadius: 9 }}><FilePlus2 size={22} /><p style={{ margin: '7px 0 0', fontSize: 12 }}>ยังไม่มีเอกสารใน case นี้</p></div>}
            {workspace.documents.map((document) => <DocumentTimelineCard key={document.id} document={document} onAttach={(version) => setAttachedVersion(version)} />)}
          </div>
        </section>

        <section style={{ padding: 18, borderRadius: 12, background: '#fff', border: '1px solid #e0ece5' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><div><h3 style={{ margin: 0, color: '#315a4d', fontSize: 17 }}>KYC Chat / Post</h3><p style={{ margin: '5px 0 0', color: '#78968a', fontSize: 12 }}>ข้อความและ attachment metadata จะถูกเก็บแบบ append-only</p></div><MessageCircle size={20} color="#28745c" /></div>
          <div style={{ display: 'grid', gap: 8, marginTop: 14, maxHeight: 330, overflowY: 'auto' }}>
            {workspace.messages.length === 0 && <p style={{ color: '#78968a', fontSize: 12 }}>ยังไม่มีข้อความจากทีมตรวจสอบ</p>}
            {workspace.messages.map((message) => <div key={message.id} style={{ padding: 11, borderRadius: 9, background: message.senderRole === 'merchant' ? '#effaf4' : '#f8fafc', border: '1px solid #e4eee9' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong style={{ color: '#315a4d', fontSize: 12 }}>{message.senderRole === 'merchant' ? 'คุณ' : message.senderRole.toUpperCase()}</strong><small style={{ color: '#78968a' }}>{new Date(message.createdAt).toLocaleString('th-TH')}</small></div>{message.message && <p style={{ margin: '7px 0 0', color: '#527267', fontSize: 13, whiteSpace: 'pre-wrap' }}>{message.message}</p>}{message.attachmentMetadataJson?.map((attachment, index) => <span key={`${message.id}-${index}`} style={{ display: 'inline-flex', marginTop: 7, padding: '4px 7px', borderRadius: 5, background: '#fff', color: '#28745c', fontSize: 10 }}>แนบ: {String(attachment.fileName || 'document')}</span>)}{!message.readAt && message.senderRole !== 'merchant' && <button type="button" onClick={() => markRead(message.id)} style={{ display: 'block', marginTop: 8, border: 0, background: 'transparent', color: '#28745c', fontSize: 10, cursor: 'pointer' }}>ทำเครื่องหมายว่าอ่านแล้ว</button>}</div>)}
          </div>
          {attachedVersion && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: 8, borderRadius: 7, background: '#f1f8f4', color: '#28745c', fontSize: 11 }}>แนบ document: {attachedVersion.fileName} v{attachedVersion.version}<button type="button" onClick={() => setAttachedVersion(null)} aria-label="ยกเลิกเอกสารแนบ" style={{ border: 0, background: 'transparent', color: '#b91c1c', cursor: 'pointer' }}><X size={14} /></button></div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><textarea value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="ตอบกลับ Agent หรือส่งข้อมูลเพิ่มเติม..." rows={3} style={{ flex: 1, resize: 'vertical', border: '1px solid #cfe1d8', borderRadius: 8, padding: 10, color: '#315a4d' }} /><button type="button" onClick={sendMessage} disabled={sending || (!chatText.trim() && !attachedVersion)} style={{ alignSelf: 'flex-end', border: 0, borderRadius: 8, padding: '10px 14px', background: sending ? '#9ab9ad' : '#28745c', color: '#fff', cursor: sending ? 'wait' : 'pointer' }}>{sending ? 'กำลังส่ง...' : 'ส่ง'}</button></div>
          {unreadMessages.length > 0 && <small style={{ display: 'block', marginTop: 8, color: '#b45309' }}>มีข้อความที่ยังไม่ได้อ่าน {unreadMessages.length} รายการ</small>}
        </section>
      </>}
    </div>
  )
}

function DocumentTimelineCard({ document, onAttach }: { document: KycDocumentTimeline; onAttach: (version: KycDocumentVersion) => void }) {
  const latest = latestVersion(document)
  return <article style={{ padding: 14, border: '1px solid #e0ece5', borderRadius: 10, background: '#fcfefd' }}><div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}><div><strong style={{ color: '#315a4d', fontSize: 14 }}>{document.documentType}</strong><span style={{ display: 'block', marginTop: 4, color: '#78968a', fontSize: 11 }}>{documentStatus[document.status] || document.status} · {document.latestVersion ? `ล่าสุด v${document.latestVersion}` : 'ยังไม่มี version'}</span></div>{latest && <button type="button" onClick={() => onAttach(latest)} title="แนบ document version นี้ใน KYC Chat" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid #cfe1d8', borderRadius: 6, background: '#fff', color: '#28745c', padding: '6px 8px', cursor: 'pointer', fontSize: 10 }}>แนบใน Chat</button>}</div>{latest && <div style={{ marginTop: 10, color: '#527267', fontSize: 11 }}>{latest.fileName} · {formatBytes(latest.fileSize)} · {documentStatus[latest.status] || latest.status}</div>}<VersionComparison document={document} /></article>
}

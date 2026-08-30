/**
 * ChatPOS Real PostgreSQL Database Client & API Connector
 * Connects directly to PostgreSQL instance at 178.128.217.45 via /api/db endpoints
 */

import type { MockCase } from './mockData'

export interface DbHealth {
  success: boolean
  status: string
  host?: string
  port?: string | number
  database?: string
  user?: string
  total_tables?: number
  version?: string
}

export interface DbStats {
  total_stores: string
  active_stores: string
  total_agents: string
  total_pds: string
  total_transactions: string
  total_volume: string
  today_volume: string
  pending_kyc: string
  approved_kyc: string
  total_products: string
  total_commission: string
}

export interface DbKycRow {
  id: string
  businessName: string | null
  firstName: string | null
  lastName: string | null
  phone: string | null
  status: string
  businessType: string | null
  approvalLevel: string | null
  kycSize: string | null
  taxId: string | null
  bankName: string | null
  bankAccountNumber: string | null
  bankAccountName: string | null
  currentAddress: string | null
  reviewNotes: string | null
  submittedAt: string | null
  reviewedAt: string | null
  createdAt: string
  user_email?: string | null
  user_name?: string | null
}

export interface DbStoreRow {
  id: string
  name: string
  description: string | null
  phone: string | null
  address: string | null
  storeType: string | null
  tier: string | null
  isActive: boolean
  monthlyGmvUsed: string | null
  monthlyTxnCount: number | null
  accountNumber: string | null
  payoutBankName: string | null
  payoutAccountNumber: string | null
  payoutAccountName: string | null
  createdAt: string
  merchantId: string | null
  owner_name: string | null
  owner_email: string | null
  agent_code: string | null
  pd_code: string | null
  pd_name: string | null
  timezone?: string
  currency?: string
}

export interface DbAssignmentRow {
  id: string
  assignmentRequestId: string | null
  sourceRequestId: string
  status: string
  reason: string | null
  createdAt: string
  updatedAt: string
  acceptedAt: string | null
  rejectedAt: string | null
  expiresAt: string | null
  agent_code: string | null
  pd_code: string | null
  pd_name: string | null
}

export interface KycDocumentVersion {
  id: string
  documentId: string
  version: number
  fileName: string
  mimeType: string
  fileSize: number | string
  checksumSha256: string
  storageLocator: string
  sourceIssuedAt: string
  status: string
  reason: string | null
  reviewNotes: string | null
  createdAt: string
}

export interface KycDocumentTimeline {
  id: string
  documentType: string
  status: string
  latestVersion: number
  updatedAt: string
  versions: KycDocumentVersion[]
}

export interface KycChatMessage {
  id: string
  senderId: string
  senderRole: string
  recipientId: string | null
  message: string | null
  attachmentMetadataJson: Array<Record<string, unknown>>
  status: string
  readAt: string | null
  createdAt: string
}

export interface KycWorkspace {
  case: {
    id: string
    storeId: string
    verificationId: string | null
    case_number: string
    status: string
    submissionVersion: number
    submissionSnapshotJson: Record<string, unknown> | null
    submissionProfileVersion: number | null
  }
  documents: KycDocumentTimeline[]
  messages: KycChatMessage[]
  notifications: Array<{ id: string; type: string; title: string; message: string; readAt: string | null; createdAt: string }>
}

export interface DbAgentRow {
  id: string
  code: string
  tier: string
  status: string
  walletBalance: string
  adBudget: string | null
  baseAllowance: string | null
  createdAt: string
  agent_name: string | null
  agent_email: string | null
  agent_phone: string | null
  pd_code: string | null
  pd_name: string | null
  stores_count: string
  earned_commission: string
}

export interface DbPdRow {
  id: string
  code: string
  displayName: string
  status: string
  investmentAmount: string
  startedAt: string
  createdAt: string
  pd_owner_name: string | null
  pd_email: string | null
  pd_phone: string | null
  agent_count: string
  store_count: string
  total_pd_commission: string
}

export interface DbTransactionRow {
  id: string
  reference: string
  amount: string
  fee: string
  netAmount: string
  channel: string
  status: string
  customerName: string | null
  customerPhone: string | null
  note: string | null
  paymentMethod: string | null
  isSettled: boolean
  currency?: string
  transactionType?: 'payment' | 'refund' | 'payout' | 'adjustment' | string
  refundOfId?: string | null
  payoutReference?: string | null
  occurredAt?: string
  paidAt?: string | null
  createdAt: string
  store_name: string | null
}

export interface DbHomeReadModel {
  store: DbStoreRow
  user: {
    id: string
    displayName: string | null
    role: string
    allowedActions: string[]
  }
  summary: {
    todayTransactionCount: number
    todayGrossAmount: string
    todayFeeAmount: string
    todayNetAmount: string
    pendingTransactionCount: number
    pendingNetAmount: string
    latestTransactionAt: string | null
    availableBalance: string | null
    balanceStatus: 'available' | 'not_available' | string
    totalBalance: string | null
    receivedToday: string
    availableToWithdraw: string | null
    pendingAmount: string
    asOf: string | null
  }
  counts: {
    unreadNotifications: number
    openOrders: number | null
    queueWaiting: number | null
    lowStockItems: number | null
  }
  unreadNotificationCount: number
  quickActions: Array<{ id: string; target: string; enabled: boolean; disabledReason: string | null }>
  capabilities: {
    canViewBalance: boolean
    canViewTransactions: boolean
    canUseBenefits: boolean
    canUseStopPay: boolean
    canViewBilling: boolean
    canStopPay?: boolean
    updatedAt: string | null
  }
  stoppay: {
    status: string
    reason: string | null
    version: number
    updatedAt: string | null
  }
  freshness: {
    generatedAt: string
    source: string
    cachePolicy: string
    staleAfterSeconds: number
    timezone: string
  }
}

export interface DbFetchResult<T> {
  data: T
  error: string | null
  fetchedAt: string | null
}

export interface DbProductRow {
  id: string
  name: string
  description: string | null
  price: string
  cost: string
  stock: number
  category: string | null
  image: string | null
  sku: string | null
  isActive: boolean
  trackStock: boolean
  createdAt: string
  store_name: string | null
}

export interface DbCommissionRow {
  id: string
  sourceType: string
  sourceRef: string | null
  beneficiaryType: string
  amount: string
  grossAmount: string
  ratePercent: string
  status: string
  ruleCode: string | null
  earnedAt: string
  createdAt: string
  agent_code: string | null
  pd_code: string | null
  store_name: string | null
}

const API_BASE = ''

function getErrorMessage(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) return value
  if (value && typeof value === 'object') {
    const details = value as { message?: unknown; error?: unknown; code?: unknown }
    return getErrorMessage(details.message ?? details.error ?? details.code, fallback)
  }
  return fallback
}

// Generic Fetch Wrapper
async function fetchDbApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}/api/db${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  let data: any = null
  try {
    data = await res.json()
  } catch {}

  if (!res.ok) {
    const errorMsg = getErrorMessage(data?.error ?? data?.message, `DB API Error ${res.status}: ${res.statusText}`)
    throw new Error(errorMsg)
  }

  return data as T
}

/**
 * Check Real Database Health & Connection
 */
export async function fetchDbHealth(): Promise<DbHealth> {
  try {
    return await fetchDbApi<DbHealth>('/health')
  } catch (err: any) {
    return {
      success: false,
      status: 'disconnected',
      version: err?.message || 'Failed to reach database',
    }
  }
}

/**
 * Fetch Real Overview Dashboard Stats
 */
export async function fetchDbStats(): Promise<DbStats | null> {
  try {
    const res = await fetchDbApi<{ success: boolean; stats: DbStats }>('/stats')
    return res.stats
  } catch (err) {
    console.error('Failed to fetch DB stats:', err)
    return null
  }
}

/**
 * Fetch Real KYC Verifications from DB & convert to MockCase format for UI compatibility
 */
export async function fetchDbKycCases(): Promise<{ cases: MockCase[]; raw: DbKycRow[] }> {
  try {
    const res = await fetchDbApi<{ success: boolean; data: DbKycRow[] }>('/kyc')
    const raw = res.data || []

    const cases: MockCase[] = raw.map((r) => {
      const tone =
        r.status === 'approved'
          ? 'approved'
          : r.status === 'pending'
          ? 'pending'
          : r.status === 'review'
          ? 'review'
          : 'risk'

      const statusTh =
        r.status === 'approved'
          ? 'อนุมัติแล้ว'
          : r.status === 'pending'
          ? 'รอตรวจ'
          : r.status === 'review'
          ? 'กำลังตรวจ'
          : r.status === 'rejected'
          ? 'ปฏิเสธ'
          : r.status

      const formattedTime = r.createdAt
        ? new Date(r.createdAt).toLocaleString('th-TH', {
            dateStyle: 'short',
            timeStyle: 'short',
          })
        : 'ล่าสุด'

      const fullName = [r.firstName, r.lastName].filter(Boolean).join(' ') || r.user_name || 'ผู้สมัคร'

      return {
        id: `KYC-${r.id.slice(-6).toUpperCase()}`,
        name: r.businessName || `${fullName} (ร้านค้าใหม่)`,
        person: fullName,
        detail: `KYC Size: ${r.kycSize || 'S'} · ${r.businessType || 'ทั่วไป'}`,
        type: r.businessType === 'juristic' ? 'นิติบุคคล' : 'บุคคลธรรมดา',
        status: statusTh,
        tone,
        time: formattedTime,
        taxId: r.taxId || undefined,
        phone: r.phone || undefined,
        bankAccount: r.bankAccountNumber || undefined,
        bankName: r.bankName || undefined,
        riskScore: r.status === 'pending' ? 15 : r.status === 'approved' ? 2 : 45,
        address: r.currentAddress || undefined,
        docUrl: '/mascot/kyc_3_checking_documents.png',
        storePhoto:
          'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80',
      }
    })

    return { cases, raw }
  } catch (err) {
    console.error('Failed to fetch real KYC cases:', err)
    return { cases: [], raw: [] }
  }
}

/**
 * Fetch Real Stores from DB
 */
export async function fetchDbStores(): Promise<DbStoreRow[]> {
  try {
    const res = await fetchDbApi<{ success: boolean; data: DbStoreRow[] }>('/stores')
    return res.data || []
  } catch (err) {
    console.error('Failed to fetch real stores:', err)
    return []
  }
}

export async function fetchDbStoresResult(): Promise<DbFetchResult<DbStoreRow[]>> {
  try {
    const res = await fetchDbApi<{ success: boolean; data: DbStoreRow[] }>('/stores')
    return { data: res.data || [], error: null, fetchedAt: new Date().toISOString() }
  } catch (err: any) {
    console.error('Failed to fetch stores with status:', err)
    return { data: [], error: err?.message || 'โหลดข้อมูลร้านค้าไม่สำเร็จ', fetchedAt: null }
  }
}

/**
 * Fetch Merchant-Agent assignment state from PostgreSQL.
 */
export async function fetchDbAssignments(storeId?: string | null): Promise<DbAssignmentRow[]> {
  try {
    const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : ''
    const res = await fetchDbApi<{ success: boolean; data: DbAssignmentRow[] }>(`/assignments${query}`)
    return res.data || []
  } catch (err) {
    console.error('Failed to fetch assignment status:', err)
    return []
  }
}

export interface AssignmentRequestResponse {
  success: boolean
  data?: DbAssignmentRow & { idempotentReplay?: boolean }
  code?: string
  error?: string
}

/**
 * Request an Agent assignment through the server-side Backoffice client.
 */
export async function requestMerchantAssignment(data: {
  storeId: string
  sourceRequestId: string
  agentPhone?: string
}): Promise<AssignmentRequestResponse> {
  try {
    const res = await fetch('/api/v1/assignments/requests', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceRequestId: data.sourceRequestId,
        ...(data.agentPhone ? { agentPhone: data.agentPhone } : {}),
      }),
    })
    let payload: AssignmentRequestResponse
    try {
      payload = await res.json()
    } catch {
      payload = { success: false, error: `Assignment API error ${res.status}` }
    }
    return res.ok ? payload : { ...payload, success: false }
  } catch (err: any) {
    return { success: false, error: err?.message || 'ไม่สามารถส่งคำขอผูก Agent ได้' }
  }
}

export async function fetchKycWorkspace(storeId: string): Promise<KycWorkspace> {
  const res = await fetchDbApi<{ success: boolean; data: KycWorkspace }>(`/kyc/workspace?storeId=${encodeURIComponent(storeId)}`)
  return res.data
}

export async function submitKycCase(storeId: string, caseId: string, sourceRequestId: string) {
  const response = await fetch('/api/v1/kyc/cases/' + encodeURIComponent(caseId) + '/submit', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': sourceRequestId },
    body: JSON.stringify({ sourceRequestId }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || data?.code || `KYC submission API error ${response.status}`)
  return data as { success: boolean; data: { replayed: boolean; assignment: DbAssignmentRow | null; backoffice: { status: string; code?: string } } }
}

export interface KycDocumentUpload {
  documentType: string
  file: File
  reason?: string
  sourceRequestId: string
  sourceIssuedAt: string
}

export async function submitKycDocument(storeId: string, caseId: string, payload: KycDocumentUpload) {
  const response = await fetch('/api/v1/kyc/cases/' + encodeURIComponent(caseId) + '/documents', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': payload.file.type,
      'Idempotency-Key': payload.sourceRequestId,
      'X-Source-Request-Id': payload.sourceRequestId,
      'X-KYC-File-Name': encodeURIComponent(payload.file.name),
      'X-KYC-Document-Type': encodeURIComponent(payload.documentType),
      'X-KYC-Source-Issued-At': encodeURIComponent(payload.sourceIssuedAt),
      ...(payload.reason ? { 'X-KYC-Reason': encodeURIComponent(payload.reason) } : {}),
    },
    body: payload.file,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || `Document API error ${response.status}`)
  return data as {
    success: boolean
    data: {
      document: KycDocumentVersion
      access?: { url: string; expiresAt: string }
      replayed: boolean
      backoffice?: { status?: string; code?: string; forwarded?: number; pending?: number; failed?: number } | null
    }
  }
}

export async function postKycMessage(storeId: string, caseId: string, payload: { message?: string; recipientId?: string; attachments?: Array<Record<string, unknown>> }) {
  const response = await fetch('/api/db/kyc/cases/' + encodeURIComponent(caseId) + '/messages', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || `KYC chat error ${response.status}`)
  return data as { success: boolean; data: KycChatMessage }
}

export async function markKycMessageRead(storeId: string, caseId: string, messageId: string) {
  const response = await fetch(`/api/db/kyc/cases/${encodeURIComponent(caseId)}/messages/${encodeURIComponent(messageId)}/read?storeId=${encodeURIComponent(storeId)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || `KYC read status error ${response.status}`)
  return data as { success: boolean; data: { id: string; readAt: string } }
}

/**
 * Fetch Real Agents from DB
 */
export async function fetchDbAgents(): Promise<DbAgentRow[]> {
  try {
    const res = await fetchDbApi<{ success: boolean; data: DbAgentRow[] }>('/agents')
    return res.data || []
  } catch (err) {
    console.error('Failed to fetch real agents:', err)
    return []
  }
}

/**
 * Fetch Real Provincial Directors from DB
 */
export async function fetchDbPds(): Promise<DbPdRow[]> {
  try {
    const res = await fetchDbApi<{ success: boolean; data: DbPdRow[] }>('/pds')
    return res.data || []
  } catch (err) {
    console.error('Failed to fetch real PDs:', err)
    return []
  }
}

/**
 * Fetch Real Transactions from DB
 */
export async function fetchDbTransactions(): Promise<DbTransactionRow[]> {
  try {
    const res = await fetchDbApi<{ success: boolean; data: DbTransactionRow[] }>('/transactions')
    return res.data || []
  } catch (err) {
    console.error('Failed to fetch real transactions:', err)
    return []
  }
}

export async function fetchDbTransactionsResult(): Promise<DbFetchResult<DbTransactionRow[]>> {
  try {
    const res = await fetchDbApi<{ success: boolean; data: DbTransactionRow[] }>('/transactions')
    return { data: res.data || [], error: null, fetchedAt: new Date().toISOString() }
  } catch (err: any) {
    console.error('Failed to fetch transactions with status:', err)
    return { data: [], error: err?.message || 'โหลดประวัติธุรกรรมไม่สำเร็จ', fetchedAt: null }
  }
}

export interface DbNotificationRow {
  id: string
  category: string
  type: string
  title: string
  message: string
  actionTarget: string | null
  metadataJson: Record<string, unknown>
  readAt: string | null
  createdAt: string
  updatedAt: string
}

export interface DbBenefitRow {
  id: string
  code: string
  title: string
  description: string
  status: string
  eligible: boolean
  startsAt: string | null
  expiresAt: string | null
  metadataJson: Record<string, unknown>
  updatedAt: string
}

export interface DbStoppayState {
  storeId: string
  status: string
  reason: string | null
  version: number
  updatedBy: string | null
  updatedAt: string | null
}

export async function fetchDbHomeResult(storeId: string): Promise<DbFetchResult<DbHomeReadModel | null>> {
  try {
    const res = await fetchDbApi<{ success: boolean; data: DbHomeReadModel }>(`/home?storeId=${encodeURIComponent(storeId)}`)
    return { data: res.data || null, error: null, fetchedAt: new Date().toISOString() }
  } catch (err: any) {
    const errorMessage = getErrorMessage(err, 'โหลดข้อมูล Home ไม่สำเร็จ')
    if (errorMessage !== 'Merchant Home contract is disabled') {
      console.warn('Failed to fetch Home read model:', err)
    }
    return { data: null, error: errorMessage === 'Merchant Home contract is disabled' ? null : errorMessage, fetchedAt: null }
  }
}

export async function fetchDbNotificationsResult(storeId: string, options: { page?: number; limit?: number; category?: string; unreadOnly?: boolean } = {}): Promise<DbFetchResult<DbNotificationRow[]>> {
  try {
    const query = new URLSearchParams({ storeId, page: String(options.page || 1), limit: String(options.limit || 20) })
    if (options.category) query.set('category', options.category)
    if (options.unreadOnly) query.set('unreadOnly', 'true')
    const res = await fetchDbApi<{ success: boolean; data: DbNotificationRow[] }>(`/notifications?${query.toString()}`)
    return { data: res.data || [], error: null, fetchedAt: new Date().toISOString() }
  } catch (err: any) {
    const errorMessage = getErrorMessage(err, 'โหลดการแจ้งเตือนไม่สำเร็จ')
    if (errorMessage !== 'Merchant Home contract is disabled') {
      console.warn('Failed to fetch notifications:', err)
    }
    return { data: [], error: errorMessage === 'Merchant Home contract is disabled' ? null : errorMessage, fetchedAt: null }
  }
}

export async function markDbNotificationRead(id: string, storeId: string) {
  return fetchDbApi<{ success: boolean; data: Pick<DbNotificationRow, 'id' | 'readAt' | 'updatedAt'> }>(`/notifications/${encodeURIComponent(id)}/read?storeId=${encodeURIComponent(storeId)}`, { method: 'POST' })
}

export async function markAllDbNotificationsRead(storeId: string) {
  return fetchDbApi<{ success: boolean; data: { markedCount: number } }>(`/notifications/read-all?storeId=${encodeURIComponent(storeId)}`, { method: 'POST' })
}

export async function fetchDbBenefitsResult(storeId: string, page = 1, limit = 20): Promise<DbFetchResult<DbBenefitRow[]>> {
  try {
    const res = await fetchDbApi<{ success: boolean; data: DbBenefitRow[] }>(`/benefits?storeId=${encodeURIComponent(storeId)}&page=${page}&limit=${limit}`)
    return { data: res.data || [], error: null, fetchedAt: new Date().toISOString() }
  } catch (err: any) {
    console.error('Failed to fetch benefits:', err)
    return { data: [], error: err?.message || 'โหลดสิทธิพิเศษไม่สำเร็จ', fetchedAt: null }
  }
}

export async function fetchDbStoppay(storeId: string): Promise<DbStoppayState> {
  const res = await fetchDbApi<{ success: boolean; data: DbStoppayState }>(`/stoppay?storeId=${encodeURIComponent(storeId)}`)
  return res.data
}

export async function transitionDbStoppay(payload: { storeId: string; action: string; reason?: string; idempotencyKey: string }) {
  return fetchDbApi<{ success: boolean; idempotentReplay: boolean; data: DbStoppayState & { eventId: string; action: string } }>('/stoppay', {
    method: 'POST',
    headers: { 'Idempotency-Key': payload.idempotencyKey },
    body: JSON.stringify(payload),
  })
}

/**
 * Record Real Payment Transaction into DB
 */
export async function createDbTransaction(payload: {
  amount: number | string
  storeId?: string | null
  userId?: string | null
  channel?: string
  paymentMethod?: string
  customerName?: string
  customerPhone?: string | null
  tableName?: string
  note?: string
  origin?: string
  transactionType?: 'payment' | 'refund' | 'payout' | 'adjustment'
  idempotencyKey: string
}): Promise<{ success: boolean; transaction?: DbTransactionRow; error?: string }> {
  try {
    return await fetchDbApi<{ success: boolean; transaction?: DbTransactionRow; error?: string }>('/transactions/create', {
      method: 'POST',
      headers: { 'Idempotency-Key': payload.idempotencyKey },
      body: JSON.stringify(payload),
    })
  } catch (err: any) {
    console.error('Failed to record transaction in DB:', err)
    return { success: false, error: err?.message || 'Failed to record transaction' }
  }
}

/**
 * Fetch Real Products from DB
 */
export async function fetchDbProducts(): Promise<DbProductRow[]> {
  try {
    const res = await fetchDbApi<{ success: boolean; data: DbProductRow[] }>('/products')
    return res.data || []
  } catch (err) {
    console.error('Failed to fetch real products:', err)
    return []
  }
}

/**
 * Fetch Real Commissions from DB
 */
export async function fetchDbCommissions(): Promise<DbCommissionRow[]> {
  try {
    const res = await fetchDbApi<{ success: boolean; data: DbCommissionRow[] }>('/commissions')
    return res.data || []
  } catch (err) {
    console.error('Failed to fetch real commissions:', err)
    return []
  }
}

/**
 * Update KYC Status in Real DB
 */
export async function updateDbKycStatus(id: string, status: string, reviewNotes?: string) {
  return fetchDbApi<{ success: boolean; message: string }>('/kyc/update-status', {
    method: 'POST',
    body: JSON.stringify({ id, status, reviewNotes }),
  })
}

export interface AuthUser {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  avatar?: string | null
  pd?: any | null
  agent?: any | null
  store?: any | null
}

export interface LoginResponse {
  success: boolean
  sessionExpiresAt?: string
  user?: AuthUser
  message?: string
  error?: string
}

export interface RegisterResponse {
  success: boolean
  message?: string
  error?: string
  userId?: string
  storeId?: string
  pdId?: string
  agentId?: string
  code?: string
  merchantId?: string
}

/**
 * Real PostgreSQL Login
 */
export async function loginUser(credentials: { email: string; password: string; role?: string }): Promise<LoginResponse> {
  try {
    const res = await fetchDbApi<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    if (res.success && res.user) {
      setStoredUser(res.user)
    }
    return res
  } catch (err: any) {
    return { success: false, error: err.message || 'เข้าสู่ระบบไม่สำเร็จ' }
  }
}

/**
 * Real PD Registration
 */
export async function registerPd(data: {
  name: string
  email: string
  password: string
  phone?: string
  displayName?: string
  investmentAmount?: number
  territoryId?: string
  kycData?: any
}): Promise<RegisterResponse> {
  try {
    return await fetchDbApi<RegisterResponse>('/auth/register-pd', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  } catch (err: any) {
    return { success: false, error: err.message || 'ลงทะเบียน PD ไม่สำเร็จ' }
  }
}

/**
 * Real Agent Registration
 */
export async function registerAgent(data: {
  name: string
  email: string
  password: string
  phone?: string
  tier?: string
  currentPdId?: string
  kycData?: any
}): Promise<RegisterResponse> {
  try {
    return await fetchDbApi<RegisterResponse>('/auth/register-agent', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  } catch (err: any) {
    return { success: false, error: err.message || 'ลงทะเบียน Agent ไม่สำเร็จ' }
  }
}

/**
 * Real Merchant / Store Registration
 */
export async function registerMerchant(data: {
  name: string
  email: string
  password: string
  phone?: string
  storeName: string
  storeType?: string
  address?: string
  payoutBank?: string
  payoutAccountNo?: string
  payoutAccountName?: string
  kycData?: any
  referralCode?: string
}): Promise<RegisterResponse> {
  try {
    return await fetchDbApi<RegisterResponse>('/auth/register-merchant', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  } catch (err: any) {
    return { success: false, error: err.message || 'ลงทะเบียนเปิดร้านค้าไม่สำเร็จ' }
  }
}

/**
 * Non-authoritative UI cache and server session helpers
 */
export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('chatpos_session_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setStoredUser(user: AuthUser) {
  localStorage.setItem('chatpos_session_user', JSON.stringify(user))
  localStorage.setItem('chatpos_role', user.role)
}

export function clearStoredUser() {
  localStorage.removeItem('chatpos_session_user')
  localStorage.removeItem('chatpos_role')
}

export async function getServerSession(): Promise<{ success: boolean; user: AuthUser | null }> {
  return fetchDbApi('/auth/session')
}

export async function logoutUser(): Promise<void> {
  await fetchDbApi('/auth/logout', { method: 'POST' })
  clearStoredUser()
}

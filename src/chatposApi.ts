/**
 * ChatPOS API Utility Helper
 * Browser calls same-origin `/api/v1/*`; requests are handled by the Next.js catch-all Route Handler.
 */

export const STORAGE_KEY_API_KEY = 'chatpos_api_key'
export const DEFAULT_API_BASE_URL = ''

/**
 * API keys are intentionally never restored from browser storage.
 */
export const getStoredApiKey = (): string => {
  return ''
}

/**
 * Keep the legacy API surface without persisting credentials.
 */
export const setStoredApiKey = (key: string): void => {
  void key
}

export type ApiRequestOptions = RequestInit & {
  apiKey?: string
  baseUrl?: string
}

/**
 * Generic API Fetcher for ChatPOS API endpoints
 */
export async function fetchChatPosApi<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { baseUrl = DEFAULT_API_BASE_URL, headers: customHeaders, ...fetchOptions } = options
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${cleanEndpoint}`

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...fetchOptions,
      credentials: 'include',
      headers,
    })
  } catch (netErr: any) {
    const errorMsg = netErr?.message || 'Network request failed'
    const error = new Error(`การเชื่อมต่อ ChatPOS API ล้มเหลว (${errorMsg}): ตรวจสอบการเชื่อมต่อเซิร์ฟเวอร์หรือ API Key`) as Error & { status: number; data: any }
    error.status = 0
    error.data = { error: errorMsg, endpoint: cleanEndpoint }
    throw error
  }

  const contentType = response.headers.get('content-type') || ''
  let responseData: any

  if (contentType.includes('application/json')) {
    responseData = await response.json()
  } else {
    responseData = await response.text()
  }

  if (!response.ok) {
    const errorMsg = typeof responseData === 'object' && responseData.message 
      ? responseData.message 
      : typeof responseData === 'string' && responseData 
      ? responseData 
      : `HTTP ${response.status} ${response.statusText}`
    
    const error = new Error(errorMsg) as Error & { status: number; data: any }
    error.status = response.status
    error.data = responseData
    throw error
  }

  return responseData as T
}

/* ==========================================================================
   CHATPOS QUICK REFERENCE ENDPOINT HELPER FUNCTIONS
   ========================================================================== */

/**
 * 1. GET /api/v1/balance
 * Purpose: Check account balance
 */
export async function fetchBalance(apiKey?: string) {
  return fetchChatPosApi<{
    success?: boolean
    balance?: number
    currency?: string
    [key: string]: any
  }>('/api/v1/balance', { method: 'GET', apiKey })
}

export type CreatePaymentQrPayload = {
  amount: number
  orderId?: string
  currency?: string
  description?: string
  customerName?: string
  customerPhone?: string
  [key: string]: any
}

export type CreateTransactionPayload = {
  amount: number
  clientReference?: string
  orderId?: string
  currency?: string
  channel?: string
  note?: string
  customerName?: string
  customerPhone?: string
  tableName?: string
  metadata?: Record<string, unknown>
}

export type TransactionPayment = {
  id?: string
  reference?: string
  clientReference?: string
  paymentReference?: string
  gatewayReference?: string
  qrCodeUrl?: string | null
  qrRawText?: string | null
  checkoutRedirectUrl?: string | null
  amount?: number
  currency?: string
  channel?: string
  status?: 'pending' | 'completed' | 'failed' | 'expired' | 'refunded' | 'chargeback' | 'stoppay' | string
  paidAt?: string | null
  expiresAt?: string | null
  [key: string]: any
}

export function transactionQrImageUrl(transaction?: TransactionPayment | null): string {
  const qrCodeUrl = transaction?.qrCodeUrl?.trim()
  if (qrCodeUrl) return qrCodeUrl

  const qrRawText = transaction?.qrRawText?.trim()
  if (!qrRawText) return ''
  if (qrRawText.startsWith('data:image/')) return qrRawText
  if (/^https?:\/\//i.test(qrRawText)) return qrRawText
  if (qrRawText.startsWith('iVBORw0KGgo')) return `data:image/png;base64,${qrRawText}`
  return ''
}

/**
 * POST /api/v1/transactions
 * Create a payment through Agent/PD Backoffice routing.
 */
export async function createTransactionCommand(payload: CreateTransactionPayload, idempotencyKey: string, apiKey?: string) {
  return fetchChatPosApi<{
    success?: boolean
    idempotentReplay?: boolean
    transaction?: TransactionPayment
    [key: string]: any
  }>('/api/v1/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
    apiKey,
    headers: { 'Idempotency-Key': idempotencyKey },
  })
}

export async function createPublicTransactionCommand(payload: CreateTransactionPayload, idempotencyKey: string) {
  return fetchChatPosApi<{
    success?: boolean
    idempotentReplay?: boolean
    transaction?: TransactionPayment
    [key: string]: any
  }>('/api/v1/public-payments', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Idempotency-Key': idempotencyKey },
  })
}

/**
 * GET /api/v1/transactions/{reference}
 * Read the payment status owned by the routed transaction.
 */
export async function checkTransactionStatus(reference: string, apiKey?: string) {
  return fetchChatPosApi<{
    success?: boolean
    transaction?: TransactionPayment
    [key: string]: any
  }>(`/api/v1/transactions/${encodeURIComponent(reference)}`, {
    method: 'GET',
    apiKey,
  })
}

/**
 * 2. POST /api/v1/payments/qr
 * Purpose: Create payment QR code
 */
export async function createPaymentQr(payload: CreatePaymentQrPayload, apiKey?: string) {
  return fetchChatPosApi<{
    success?: boolean
    reference?: string
    qrCodeUrl?: string
    qrRawText?: string
    amount?: number
    status?: string
    expiresAt?: string
    [key: string]: any
  }>('/api/v1/payments/qr', {
    method: 'POST',
    body: JSON.stringify(payload),
    apiKey,
  })
}

/**
 * 3. GET /api/v1/payments/{reference}
 * Purpose: Check payment status
 */
export async function checkPaymentStatus(reference: string, apiKey?: string) {
  return fetchChatPosApi<{
    success?: boolean
    reference?: string
    status?: 'pending' | 'completed' | 'failed' | 'expired' | string
    amount?: number
    paidAt?: string
    transactionId?: string
    [key: string]: any
  }>(`/api/v1/payments/${encodeURIComponent(reference)}`, {
    method: 'GET',
    apiKey,
  })
}

export type AuthApiPayload = {
  clientId?: string
  clientSecret?: string
  grantType?: string
  [key: string]: any
}

/**
 * 4. POST /api/v1/auth
 * Purpose: Authenticate & get token
 */
export async function authenticateApi(payload: AuthApiPayload = {}, apiKey?: string) {
  return fetchChatPosApi<{
    success?: boolean
    token?: string
    accessToken?: string
    expiresIn?: number
    tokenType?: string
    [key: string]: any
  }>('/api/v1/auth', {
    method: 'POST',
    body: JSON.stringify(payload),
    apiKey,
  })
}

export type CreatePayoutPayload = {
  amount: number
  accountNumber?: string
  accountName?: string
  bankCode?: string
  promptPayId?: string
  remark?: string
  [key: string]: any
}

/**
 * 5. POST /api/v1/payouts
 * Purpose: Create withdrawal/payout
 */
export async function createPayout(payload: CreatePayoutPayload, apiKey?: string) {
  return fetchChatPosApi<{
    success?: boolean
    payoutId?: string
    reference?: string
    amount?: number
    status?: string
    createdAt?: string
    [key: string]: any
  }>('/api/v1/payouts', {
    method: 'POST',
    body: JSON.stringify(payload),
    apiKey,
  })
}

import QRCode from 'qrcode'

/**
 * Thai PromptPay EMVCo Standard Payload Generator (BOT Specification)
 */

export function crc16(data: string): string {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    let x = ((crc >> 8) ^ data.charCodeAt(i)) & 0xff
    x ^= x >> 4
    crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function formatTag(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0')
  return `${id}${len}${value}`
}

/**
 * Generates official EMVCo Thai QR Payment payload for PromptPay
 * @param target Phone number (e.g. 0823456789), Citizen/Tax ID (13 digits), or e-Wallet ID (15 digits)
 * @param amount Optional payment amount in THB (e.g. 50.00)
 */
export function generatePromptPayPayload(target: string, amount?: number | string): string {
  const cleanTarget = (target || '0823456789').replace(/[^0-9]/g, '')
  let targetTag = ''

  if ((cleanTarget.length === 10 || cleanTarget.length === 9) && cleanTarget.startsWith('0')) {
    // Mobile Phone (Format: 0066 + 9-10 digits without leading 0)
    const formattedPhone = '0066' + cleanTarget.slice(1)
    targetTag = formatTag('01', formattedPhone)
  } else if (cleanTarget.length === 13) {
    // National ID or Tax ID (13 digits)
    targetTag = formatTag('02', cleanTarget)
  } else if (cleanTarget.length === 15) {
    // e-Wallet ID (15 digits)
    targetTag = formatTag('03', cleanTarget)
  } else {
    // Fallback: Treat as Phone
    const formattedPhone = cleanTarget.startsWith('0') ? '0066' + cleanTarget.slice(1) : '0066' + cleanTarget
    targetTag = formatTag('01', formattedPhone)
  }

  // Tag 29: PromptPay Application Info
  const aid = formatTag('00', 'A000000677010111')
  const tag29 = formatTag('29', aid + targetTag)

  const pfi = formatTag('00', '01')
  const poi = formatTag('01', amount && Number(amount) > 0 ? '12' : '11') // 12 = Dynamic QR (with amount), 11 = Static QR
  const currency = formatTag('53', '764') // 764 = THB Currency Code
  const country = formatTag('58', 'TH')

  let payload = pfi + poi + tag29 + currency

  if (amount && Number(amount) > 0) {
    const num = Number(amount)
    const amtStr = num.toFixed(2)
    payload += formatTag('54', amtStr)
  }

  payload += country
  payload += '6304' // Tag 63 with length 04 for CRC
  const checksum = crc16(payload)
  return payload + checksum
}

/**
 * Generates a base64 Data URL for real, scannable QR Code
 */
export async function generatePromptPayQrDataUrl(
  target: string,
  amount?: number | string,
  width: number = 320
): Promise<string> {
  const payload = generatePromptPayPayload(target, amount)
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  })
}

/**
 * Generates a base64 Data URL for any URL or webpage link
 */
export async function generateUrlQrDataUrl(
  urlOrText: string,
  width: number = 320
): Promise<string> {
  return QRCode.toDataURL(urlOrText, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  })
}

/**
 * Storage helpers for Merchant PromptPay ID
 */
const STORAGE_KEY = 'chatpos_merchant_promptpay_id'

export function getStoredPromptPayId(fallback?: string): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && saved.trim()) return saved.trim()
  } catch {}
  return fallback || '0823456789'
}

export function setStoredPromptPayId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id.trim())
  } catch {}
}

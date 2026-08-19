import { useState, useEffect } from 'react'
import {
  QrCode,
  CheckCircle2,
  Sparkles,
  Store,
  ReceiptText,
  Trash2,
  Delete,
  X,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { getStoredPromptPayId } from './promptpay'
import { checkTransactionStatus, createTransactionCommand } from './chatposApi'

/* Web Audio API Sound Generator */
const playAudioEffect = (type: 'beep' | 'pop' | 'success' | 'clear') => {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    if (type === 'beep') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, now)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.linearRampToValueAtTime(0.01, now + 0.05)
      osc.start(now)
      osc.stop(now + 0.05)
    } else if (type === 'pop') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(450, now)
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.08)
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.linearRampToValueAtTime(0.01, now + 0.08)
      osc.start(now)
      osc.stop(now + 0.08)
    } else if (type === 'success') {
      const osc2 = ctx.createOscillator()
      const osc3 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      const gain3 = ctx.createGain()

      osc2.connect(gain2)
      osc3.connect(gain3)
      gain2.connect(ctx.destination)
      gain3.connect(ctx.destination)

      osc.type = 'triangle'
      osc2.type = 'sine'
      osc3.type = 'sine'

      osc.frequency.setValueAtTime(523.25, now)
      osc2.frequency.setValueAtTime(659.25, now + 0.1)
      osc3.frequency.setValueAtTime(783.99, now + 0.2)

      gain.gain.setValueAtTime(0.18, now)
      gain.gain.linearRampToValueAtTime(0.01, now + 0.4)

      gain2.gain.setValueAtTime(0.18, now + 0.1)
      gain2.gain.linearRampToValueAtTime(0.01, now + 0.5)

      gain3.gain.setValueAtTime(0.22, now + 0.2)
      gain3.gain.linearRampToValueAtTime(0.01, now + 0.7)

      osc.start(now)
      osc.stop(now + 0.4)
      osc2.start(now + 0.1)
      osc2.stop(now + 0.5)
      osc3.start(now + 0.2)
      osc3.stop(now + 0.7)
    } else if (type === 'clear') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(300, now)
      osc.frequency.linearRampToValueAtTime(150, now + 0.1)
      gain.gain.setValueAtTime(0.1, now)
      gain.gain.linearRampToValueAtTime(0.01, now + 0.1)
      osc.start(now)
      osc.stop(now + 0.1)
    }
  } catch (e) {}
}

export type QuickPayMethod =
  | 'promptpay'
  | 'truemoney'
  | 'visa_th'
  | 'visa_int'
  | 'wechat'
  | 'linepay'
  | 'alipay'
  | 'shopeepay'

export function QuickPayView() {
  const [storeName] = useState(() => localStorage.getItem('merchant_store_name') || 'ร้านค้า ChatPOS (สาขาหลัก)')
  const [merchantPromptPayId] = useState(() => getStoredPromptPayId('0823456789'))

  // Parse Table or Delivery context from URL or path
  const [orderContext] = useState<
    | { type: 'table'; label: string; tableNumber: string }
    | { type: 'delivery'; label: string; platform?: string }
    | null
  >(() => {
    try {
      const search = new URLSearchParams(window.location.search)
      const pathname = window.location.pathname.toLowerCase()

      // 1. Check Table parameter or path
      const tParam = search.get('table') || search.get('t') || search.get('tableno')
      if (tParam) {
        const cleanT = tParam.replace(/^โต๊ะ\s*/i, '').trim()
        return { type: 'table', label: `โต๊ะ ${cleanT}`, tableNumber: cleanT }
      }
      if (pathname.includes('/table/') || pathname.includes('/table-')) {
        const match = pathname.match(/\/table[-/]([^\/?#]+)/)
        if (match && match[1]) {
          const cleanT = decodeURIComponent(match[1]).replace(/^โต๊ะ\s*/i, '').trim()
          return { type: 'table', label: `โต๊ะ ${cleanT}`, tableNumber: cleanT }
        }
      }

      // 2. Check Delivery parameter or path
      const dParam = search.get('delivery') || search.get('d')
      const typeParam = search.get('type')
      const platformParam = search.get('platform')
      if (dParam || typeParam === 'delivery' || pathname.includes('/delivery')) {
        const platform = platformParam || (dParam && dParam !== 'true' && dParam !== '1' ? dParam : '')
        return {
          type: 'delivery',
          label: platform ? `เดลิเวอรี (${platform})` : 'ออเดอร์เดลิเวอรี (Delivery)',
          platform: platform || undefined,
        }
      }
    } catch (e) {}
    return null
  })

  const [amountStr, setAmountStr] = useState('0')
  const [note] = useState<string>(() => {
    // Lock note from URL if table or delivery
    try {
      const search = new URLSearchParams(window.location.search)
      const tParam = search.get('table') || search.get('t') || search.get('tableno')
      if (tParam) return `โต๊ะ ${tParam.replace(/^โต๊ะ\s*/i, '').trim()}`
      if (search.get('delivery') || search.get('type') === 'delivery') {
        const plat = search.get('platform') || search.get('delivery')
        return plat && plat !== 'true' ? `เดลิเวอรี (${plat})` : 'ออเดอร์เดลิเวอรี'
      }
    } catch (e) {}
    return ''
  })
  const [operator, setOperator] = useState<string | null>(null)
  const [prevAmount, setPrevAmount] = useState<number | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<QuickPayMethod>('promptpay')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [copiedPayLink, setCopiedPayLink] = useState(false)

  // Modal States (Matching Merchant View Quick Pay Modal)
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false)
  const [summaryStep, setSummaryStep] = useState<'summary' | 'qr' | 'success'>('summary')
  const [discountType, setDiscountType] = useState<'baht' | 'percent'>('baht')
  const [discountValue, setDiscountValue] = useState<number>(0)
  const [discountNote, setDiscountNote] = useState('')
  const [qrCountdown, setQrCountdown] = useState(300)
  const [promptPayQrUrl, setPromptPayQrUrl] = useState<string>('')
  const [activePaymentRef, setActivePaymentRef] = useState<string>('')
  const [activeIdempotencyKey, setActiveIdempotencyKey] = useState<string>('')
  const [paymentSuccessData, setPaymentSuccessData] = useState<any>(null)
  const [autoResetSec, setAutoResetSec] = useState(8)

  const numAmount = parseFloat(amountStr) || 0
  const baseSubtotal = numAmount
  const calculatedDiscount =
    discountType === 'percent'
      ? (baseSubtotal * (Number(discountValue) || 0)) / 100
      : Number(discountValue) || 0
  const finalDiscount = Math.min(baseSubtotal, Math.max(0, calculatedDiscount))
  const netPayable = Math.max(0, baseSubtotal - finalDiscount)

  const playSound = (type: 'beep' | 'pop' | 'success' | 'clear') => {
    if (soundEnabled) playAudioEffect(type)
  }

  // QR Code Generation for Modal
  useEffect(() => {
    let isMounted = true
    if (isSummaryModalOpen && summaryStep === 'qr') {
      setQrCountdown(300)

      if (!activeIdempotencyKey) {
        setActiveIdempotencyKey(`quickpay:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`)
        return () => {
          isMounted = false
        }
      }

      createTransactionCommand({
        amount: netPayable,
        channel: selectedMethod,
        customerName: note ? `ลูกค้า (${note})` : 'ลูกค้าหน้าร้าน',
        note: `ชำระเงินผ่าน QuickPay Standalone (ยอดเงิน ฿${netPayable.toFixed(2)})`,
      }, activeIdempotencyKey)
        .then((res) => {
          const transaction = res?.transaction
          if (isMounted && transaction) {
            setPromptPayQrUrl(transaction.qrCodeUrl || '')
            setActivePaymentRef(transaction.paymentReference || transaction.clientReference || transaction.reference || '')
          }
        })
        .catch((err) => {
          console.warn('Backoffice transaction routing unavailable:', err)
          if (isMounted) setPromptPayQrUrl('')
        })
    }
    return () => {
      isMounted = false
    }
  }, [isSummaryModalOpen, summaryStep, netPayable, selectedMethod, note, activeIdempotencyKey])

  // Countdown timer for QR
  useEffect(() => {
    let timer: any
    if (isSummaryModalOpen && summaryStep === 'qr' && qrCountdown > 0) {
      timer = setInterval(() => setQrCountdown((prev) => prev - 1), 1000)
    }
    return () => clearInterval(timer)
  }, [isSummaryModalOpen, summaryStep, qrCountdown])

  // Polling payment status via API
  useEffect(() => {
    let pollTimer: any
    if (isSummaryModalOpen && summaryStep === 'qr' && activePaymentRef) {
      pollTimer = setInterval(async () => {
        try {
          const res = await checkTransactionStatus(activePaymentRef)
          if (res?.transaction?.status === 'completed') {
            clearInterval(pollTimer)
            handleConfirmPaymentSuccess()
          }
        } catch {}
      }, 2500)
    }
    return () => {
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [isSummaryModalOpen, summaryStep, activePaymentRef])

  // Auto-reset timer when payment succeeds
  useEffect(() => {
    let resetTimer: any
    if (isSummaryModalOpen && summaryStep === 'success') {
      setAutoResetSec(8)
      resetTimer = setInterval(() => {
        setAutoResetSec((prev) => {
          if (prev <= 1) {
            clearInterval(resetTimer)
            handleCloseModal()
            handleClearAmount()
            return 8
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(resetTimer)
  }, [isSummaryModalOpen, summaryStep])

  // Keypad Handlers
  const handleKeyClick = (val: string) => {
    playSound('beep')
    if (val === 'ล้าง') {
      playSound('clear')
      setAmountStr('0')
      setOperator(null)
      setPrevAmount(null)
      return
    }

    if (val === 'ลบ') {
      if (amountStr.length <= 1) {
        setAmountStr('0')
      } else {
        setAmountStr(amountStr.slice(0, -1))
      }
      return
    }

    if (['+', '-', '*', '/'].includes(val)) {
      setOperator(val)
      setPrevAmount(parseFloat(amountStr) || 0)
      setAmountStr('0')
      return
    }

    if (val === '=') {
      if (operator && prevAmount !== null) {
        const cur = parseFloat(amountStr) || 0
        let result = cur
        if (operator === '+') result = prevAmount + cur
        if (operator === '-') result = prevAmount - cur
        if (operator === '*') result = prevAmount * cur
        if (operator === '/') result = cur !== 0 ? prevAmount / cur : 0
        setAmountStr(Math.min(10000000, Math.max(0, result)).toString())
        setOperator(null)
        setPrevAmount(null)
      }
      return
    }

    if (val === '00') {
      if (amountStr !== '0') {
        const next = amountStr + '00'
        if (parseFloat(next) <= 10000000) setAmountStr(next)
      }
      return
    }

    if (val === '.') {
      if (!amountStr.includes('.')) {
        setAmountStr(amountStr + '.')
      }
      return
    }

    const nextStr = amountStr === '0' ? val : amountStr + val
    if (parseFloat(nextStr) <= 10000000) {
      setAmountStr(nextStr)
    }
  }

  const handleAddPreset = (addVal: number) => {
    playSound('pop')
    const current = parseFloat(amountStr) || 0
    const next = current + addVal
    if (next <= 10000000) setAmountStr(next.toString())
  }

  const handleClearAmount = () => {
    setAmountStr('0')
    setOperator(null)
    setPrevAmount(null)
  }

  const handleOpenSummaryModal = () => {
    if (numAmount <= 0) return
    playSound('pop')
    setDiscountValue(0)
    setDiscountNote('')
    setSummaryStep('summary')
    setIsSummaryModalOpen(true)
  }

  const handleProceedToQr = () => {
    playSound('pop')
    setPromptPayQrUrl('')
    setActivePaymentRef('')
    setActiveIdempotencyKey('')
    setSummaryStep('qr')
  }

  const handleConfirmPaymentSuccess = () => {
    playSound('success')
    const txnId = `TXN-${Date.now().toString().slice(-6)}`
    const nowTime = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const successData = {
      txnId,
      time: nowTime,
      total: netPayable,
      discount: finalDiscount,
      method: getChannelInfo(selectedMethod).name,
      note: note || 'คิดเงินด่วนหน้าร้าน',
    }
    setPaymentSuccessData(successData)
    setSummaryStep('success')

    // Record locally
    try {
      const existing = JSON.parse(localStorage.getItem('merchant_recent_txs') || '[]')
      localStorage.setItem('merchant_recent_txs', JSON.stringify([
        {
          id: txnId,
          amount: netPayable,
          channel: selectedMethod.toUpperCase(),
          timestamp: new Date().toISOString(),
          note: note || 'คิดเงินด่วน QuickPay Standalone',
          status: 'SUCCESS',
        },
        ...existing,
      ].slice(0, 50)))
    } catch (e) {}
  }

  const handleCloseModal = () => {
    playSound('pop')
    setIsSummaryModalOpen(false)
    setSummaryStep('summary')
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  const copyPayLink = () => {
    const currentUrl = window.location.origin + '/shop'
    navigator.clipboard.writeText(currentUrl).then(() => {
      setCopiedPayLink(true)
      setTimeout(() => setCopiedPayLink(false), 2000)
    })
  }

  const getChannelInfo = (method: QuickPayMethod) => {
    switch (method) {
      case 'promptpay':
        return { name: 'PromptPay พร้อมเพย์ QR', sub: 'สแกนผ่าน Mobile Banking ทุกธนาคาร', img: '/payments/promptpay_front.png' }
      case 'truemoney':
        return { name: 'TrueMoney Wallet', sub: 'สแกนจ่ายผ่านทรูมันนี่', img: '/payments/truemoney_front.png' }
      case 'visa_th':
        return { name: 'บัตรเครดิต/เดบิต (ไทย)', sub: 'VISA, MasterCard บัตรไทย', img: '/payments/mastercard_visa_combined.png' }
      case 'visa_int':
        return { name: 'บัตรเครดิต Inter', sub: 'บัตรเครดิตต่างประเทศ', img: '/payments/mastercard_visa_combined.png' }
      case 'wechat':
        return { name: 'WeChat Pay (微信支付)', sub: 'กระเป๋าเงินนักท่องเที่ยวจีน', img: '/payments/wechatpay_front.png' }
      case 'linepay':
        return { name: 'LINE Pay', sub: 'กระเป๋าเงิน LINE Pay', img: '/payments/linepay_front.png' }
      case 'alipay':
        return { name: 'Alipay (支付宝)', sub: 'กระเป๋าเงิน Alipay จีน', img: '/payments/alipay_front.png' }
      case 'shopeepay':
        return { name: 'ShopeePay', sub: 'สแกนผ่าน ShopeePay', img: '/payments/shopeepay_front.png' }
      default:
        return { name: 'PromptPay พร้อมเพย์ QR', sub: 'สแกนผ่าน Mobile Banking', img: '/payments/promptpay_front.png' }
    }
  }

  return (
    <div className={`qp-standalone-shell ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* ── Top Bar (Clean & Responsive) ────────────────────────── */}
      <header className="qp-standalone-header">
        <div className="qp-header-store-badge">
          <div className="qp-live-dot" />
          <Store size={16} />
          <strong>{storeName}</strong>
        </div>

        <div className="qp-header-actions-group">
          <button
            type="button"
            className="qp-header-tool-btn"
            onClick={copyPayLink}
            title="คัดลอกลิงก์หน้านี้"
          >
            {copiedPayLink ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
            <span className="hide-sm">{copiedPayLink ? 'คัดลอกแล้ว!' : 'แชร์ลิงก์'}</span>
          </button>

          <button
            type="button"
            className="qp-header-tool-btn"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'ปิดเสียง' : 'เปิดเสียง'}
          >
            {soundEnabled ? <Volume2 size={16} color="#10b981" /> : <VolumeX size={16} color="#94a3b8" />}
          </button>

          <button
            type="button"
            className="qp-header-tool-btn"
            onClick={toggleFullscreen}
            title="โหมดเต็มหน้าจอ"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </header>

      {/* ── Main Container (Matches MerchantView QuickPay Layout) ─── */}
      <main className="qp-standalone-main">
        <div className="qp-full-container">
          
          {/* 1. Amount Display Section */}
          <div className="qp-amount-section" style={{ position: 'relative', overflow: 'hidden' }}>
            <div>
              <span className="qp-amount-label">ยอดที่ต้องชำระ (THB)</span>
              <div className="qp-amount-row">
                <span className="qp-currency-prefix">฿</span>
                <strong className={`qp-amount-val ${numAmount >= 100000 ? 'qp-amount-shrink' : ''} ${numAmount >= 1000000 ? 'qp-amount-shrink-more' : ''}`}>
                  {numAmount.toLocaleString('th-TH', { minimumFractionDigits: numAmount % 1 !== 0 ? 2 : 0 })}
                </strong>
                <span className="qp-amount-currency">บาท</span>
              </div>
            </div>

            <img
              src="/mascot/nabtang_thinking.png"
              alt="นับตังค์"
              className="qp-mascot-peek"
            />

            {/* Context Badge (Show ONLY when table or delivery from URL) */}
            {orderContext && (
              <div className={`qp-locked-context-pill ${orderContext.type}-context`}>
                <div className="qp-lcp-left">
                  <span className="qp-lcp-icon">
                    {orderContext.type === 'table' ? '🪑' : '🛵'}
                  </span>
                  <div className="qp-lcp-text">
                    <small>{orderContext.type === 'table' ? 'สั่งที่โต๊ะ (ล็อคข้อมูลจากโต๊ะ)' : 'ออเดอร์เดลิเวอรี'}</small>
                    <strong>{orderContext.label}</strong>
                  </div>
                </div>
                <span className="qp-lcp-lock-tag">
                  🔒 {orderContext.type === 'table' ? 'ล็อคโต๊ะ' : 'เดลิเวอรี'}
                </span>
              </div>
            )}

            {/* Quick Presets */}
            <div className="qp-preset-row">
              {[20, 50, 100, 200, 500, 1000].map((preset) => (
                <button key={preset} onClick={() => handleAddPreset(preset)} type="button">
                  +{preset}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Payment Channels Container */}
          <div className="qp-channel-card is-unlocked">
            <div className="qp-channel-header">
              <span>เลือกช่องทางรับชำระเงิน</span>
              <div className="qp-channel-tags">
                <span className="qp-tag-badge">🇹🇭 ไทย</span>
                <span className="qp-tag-badge">🌐 ต่างชาติ</span>
              </div>
            </div>

            <div className="qp-channel-grid">
              {/* 1. PromptPay */}
              <button
                className={`qp-method-btn ${selectedMethod === 'promptpay' ? 'active' : ''}`}
                onClick={() => setSelectedMethod('promptpay')}
                type="button"
              >
                {selectedMethod === 'promptpay' && <span className="qp-check-badge">✓</span>}
                <div className="qp-logo-box pp-logo">
                  <img src="/payments/promptpay_front.png" alt="PromptPay" />
                </div>
              </button>

              {/* 2. TrueMoney Wallet */}
              <button
                className={`qp-method-btn ${selectedMethod === 'truemoney' ? 'active' : ''}`}
                onClick={() => setSelectedMethod('truemoney')}
                type="button"
              >
                {selectedMethod === 'truemoney' && <span className="qp-check-badge">✓</span>}
                <div className="qp-logo-box tm-logo">
                  <img src="/payments/truemoney_front.png" alt="TrueMoney" />
                </div>
              </button>

              {/* 3. VISA ไทย */}
              <button
                className={`qp-method-btn ${selectedMethod === 'visa_th' ? 'active' : ''}`}
                onClick={() => setSelectedMethod('visa_th')}
                type="button"
              >
                {selectedMethod === 'visa_th' && <span className="qp-check-badge">✓</span>}
                <div className="qp-logo-box visa-logo">
                  <img src="/payments/mastercard_visa_combined.png" alt="VISA / MC" />
                </div>
              </button>

              {/* 4. VISA ต่างชาติ */}
              <button
                className={`qp-method-btn ${selectedMethod === 'visa_int' ? 'active' : ''}`}
                onClick={() => setSelectedMethod('visa_int')}
                type="button"
              >
                {selectedMethod === 'visa_int' && <span className="qp-check-badge">✓</span>}
                <div className="qp-logo-box visa-logo">
                  <img src="/payments/mastercard_visa_combined.png" alt="VISA Inter" />
                </div>
              </button>

              {/* 5. WeChat Pay */}
              <button
                className={`qp-method-btn ${selectedMethod === 'wechat' ? 'active' : ''}`}
                onClick={() => setSelectedMethod('wechat')}
                type="button"
              >
                {selectedMethod === 'wechat' && <span className="qp-check-badge">✓</span>}
                <div className="qp-logo-box wechat-logo">
                  <img src="/payments/wechatpay_front.png" alt="WeChat Pay" />
                </div>
              </button>

              {/* 6. LINE Pay */}
              <button
                className={`qp-method-btn ${selectedMethod === 'linepay' ? 'active' : ''}`}
                onClick={() => setSelectedMethod('linepay')}
                type="button"
              >
                {selectedMethod === 'linepay' && <span className="qp-check-badge">✓</span>}
                <div className="qp-logo-box line-logo">
                  <img src="/payments/linepay_front.png" alt="LINE Pay" />
                </div>
              </button>

              {/* 7. Alipay */}
              <button
                className={`qp-method-btn ${selectedMethod === 'alipay' ? 'active' : ''}`}
                onClick={() => setSelectedMethod('alipay')}
                type="button"
              >
                {selectedMethod === 'alipay' && <span className="qp-check-badge">✓</span>}
                <div className="qp-logo-box alipay-logo">
                  <img src="/payments/alipay_front.png" alt="Alipay" />
                </div>
              </button>

              {/* 8. ShopeePay */}
              <button
                className={`qp-method-btn ${selectedMethod === 'shopeepay' ? 'active' : ''}`}
                onClick={() => setSelectedMethod('shopeepay')}
                type="button"
              >
                {selectedMethod === 'shopeepay' && <span className="qp-check-badge">✓</span>}
                <div className="qp-logo-box shopee-logo">
                  <img src="/payments/shopeepay_front.png" alt="ShopeePay" />
                </div>
              </button>
            </div>
          </div>

          {/* 3. Calculator Numpad Grid (5x4) */}
          <div className="qp-calc-grid">
            {/* Row 1 */}
            <button onClick={() => handleKeyClick('7')} type="button">7</button>
            <button onClick={() => handleKeyClick('8')} type="button">8</button>
            <button onClick={() => handleKeyClick('9')} type="button">9</button>
            <button className="qp-op-btn" onClick={() => handleKeyClick('/')} type="button">/</button>
            <button className="qp-clear-btn" onClick={() => handleKeyClick('ล้าง')} type="button">
              <Trash2 size={16} /> <span>ล้าง</span>
            </button>

            {/* Row 2 */}
            <button onClick={() => handleKeyClick('4')} type="button">4</button>
            <button onClick={() => handleKeyClick('5')} type="button">5</button>
            <button onClick={() => handleKeyClick('6')} type="button">6</button>
            <button className="qp-op-btn" onClick={() => handleKeyClick('*')} type="button">*</button>
            <button className="qp-backspace-btn" onClick={() => handleKeyClick('ลบ')} type="button">
              <Delete size={16} /> <span>ลบ</span>
            </button>

            {/* Row 3 */}
            <button onClick={() => handleKeyClick('1')} type="button">1</button>
            <button onClick={() => handleKeyClick('2')} type="button">2</button>
            <button onClick={() => handleKeyClick('3')} type="button">3</button>
            <button className="qp-op-btn" onClick={() => handleKeyClick('-')} type="button">-</button>
            <button className="qp-op-btn" onClick={() => handleKeyClick('=')} type="button">=</button>

            {/* Row 4 */}
            <button onClick={() => handleKeyClick('0')} type="button">0</button>
            <button onClick={() => handleKeyClick('00')} type="button">00</button>
            <button onClick={() => handleKeyClick('.')} type="button">.</button>
            <button className="qp-op-btn" onClick={() => handleKeyClick('+')} type="button">+</button>

            <button
              className="qp-pay-active-btn"
              disabled={numAmount <= 0}
              onClick={handleOpenSummaryModal}
              type="button"
            >
              <QrCode size={18} />
              <span>
                {numAmount > 0
                  ? `สร้าง QR รับเงิน (฿${numAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })})`
                  : 'สร้าง QR รับเงิน'}
              </span>
            </button>
          </div>

        </div>
      </main>

      {/* ── 4. Summary & Dynamic Payment QR Modal ─────────────────── */}
      {isSummaryModalOpen && (
        <div className="qp-summary-modal-overlay" onClick={() => setIsSummaryModalOpen(false)}>
          <div className="qp-summary-modal-card" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="qp-summary-header">
              <div className="qp-summary-header-title">
                {summaryStep === 'summary' && (
                  <>
                    <div className="qp-header-icon-wrap">
                      <ReceiptText size={20} />
                    </div>
                    <div>
                      <h3>สรุปรายการ & ใส่ส่วนลด</h3>
                      <p>ช่องทาง: {getChannelInfo(selectedMethod).name} {note ? `· ${note}` : ''}</p>
                    </div>
                  </>
                )}
                {summaryStep === 'qr' && (
                  <>
                    <div className="qp-header-icon-wrap qr-active">
                      <QrCode size={20} />
                    </div>
                    <div>
                      <h3>สแกน QR เพื่อชำระเงิน</h3>
                      <p>{getChannelInfo(selectedMethod).name} {note ? `· ${note}` : ''}</p>
                    </div>
                  </>
                )}
                {summaryStep === 'success' && (
                  <>
                    <div className="qp-header-icon-wrap success">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h3>รับชำระเงินสำเร็จ</h3>
                      <p>บันทึกยอดขายเข้าระบบเรียบร้อยแล้ว</p>
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                className="qp-summary-close-btn"
                onClick={handleCloseModal}
              >
                <X size={18} />
              </button>
            </div>

            {/* STEP 1: BILL SUMMARY & DISCOUNT */}
            {summaryStep === 'summary' && (
              <div className="qp-summary-body">
                <div className="qp-bill-pricing-card">
                  <div className="qp-price-line">
                    <span>ยอดรวม (Subtotal)</span>
                    <strong>฿{baseSubtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</strong>
                  </div>

                  {/* Discount Section */}
                  <div className="qp-discount-editor-box">
                    <div className="qp-discount-title-row">
                      <span>🏷️ มอบส่วนลดพิเศษ (Discount)</span>
                      <div className="qp-discount-toggle-group">
                        <button
                          type="button"
                          className={discountType === 'baht' ? 'active' : ''}
                          onClick={() => setDiscountType('baht')}
                        >
                          ฿ บาท
                        </button>
                        <button
                          type="button"
                          className={discountType === 'percent' ? 'active' : ''}
                          onClick={() => setDiscountType('percent')}
                        >
                          % เปอร์เซ็นต์
                        </button>
                      </div>
                    </div>

                    <div className="qp-discount-input-row">
                      <div className="qp-disc-field">
                        <input
                          type="number"
                          placeholder={discountType === 'percent' ? 'เช่น 10%' : 'เช่น 50 บาท'}
                          value={discountValue || ''}
                          onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                        />
                        <span className="qp-disc-unit">{discountType === 'percent' ? '%' : '฿'}</span>
                      </div>
                      <input
                        type="text"
                        className="qp-disc-note-in"
                        placeholder="หมายเหตุส่วนลด เช่น ลูกค้าประจำ, โปรโมชั่น (ถ้ามี)"
                        value={discountNote}
                        onChange={(e) => setDiscountNote(e.target.value)}
                      />
                    </div>

                    {finalDiscount > 0 && (
                      <div className="qp-discount-applied-pill">
                        ลดทันที: <strong>-฿{finalDiscount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    )}
                  </div>

                  {/* Net Payable Row */}
                  <div className="qp-net-payable-row">
                    <div>
                      <span className="qp-net-label">ยอดชำระสุทธิ (Net Total)</span>
                      <small className="qp-net-tax-note">ราคารวมภาษีมูลค่าเพิ่มแล้ว</small>
                    </div>
                    <strong className="qp-net-amount-big">
                      ฿{netPayable.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="qp-summary-footer-actions">
                  <button
                    type="button"
                    className="qp-modal-btn-cancel"
                    onClick={handleCloseModal}
                  >
                    ย้อนกลับ
                  </button>
                  <button
                    type="button"
                    className="qp-modal-btn-confirm"
                    onClick={handleProceedToQr}
                  >
                    <QrCode size={18} />
                    <span>รับเงิน PromptPay QR (฿{netPayable.toLocaleString('th-TH', { minimumFractionDigits: 2 })}) ➔</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: DYNAMIC QR PAYMENT DISPLAY */}
            {summaryStep === 'qr' && (
              <div className="qp-summary-body">
                <div className="qp-qr-card-display">
                  <div className="qp-qr-badge-status">
                    <div className="qp-timer-badge">
                      ⏳ QR หมดอายุใน: <strong>{Math.floor(qrCountdown / 60)}:{(qrCountdown % 60).toString().padStart(2, '0')}</strong>
                    </div>
                    <span className="qp-channel-badge-name">{getChannelInfo(selectedMethod).name}</span>
                  </div>

                  <div className="qp-qr-large-frame">
                    {promptPayQrUrl ? (
                      <img src={promptPayQrUrl} alt="PromptPay QR Code" className="qp-qr-img-large" />
                    ) : (
                      <div className="qp-qr-generating-box">
                        <Sparkles size={24} className="qp-spin" />
                        <span>กำลังสร้าง QR Code...</span>
                      </div>
                    )}
                    <div className="qp-qr-brand-watermark">
                      <img src={getChannelInfo(selectedMethod).img} alt="Channel Logo" />
                    </div>
                  </div>

                  <div className="qp-qr-amount-confirm-box">
                    <span>ยอดเงินที่ต้องสแกนจ่าย</span>
                    <strong>฿{netPayable.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</strong>
                  </div>

                  <div className="qp-qr-merchant-info-pill">
                    <span>ผู้รับเงิน: <strong>{storeName}</strong></span>
                    <span>PromptPay: <strong>{merchantPromptPayId}</strong></span>
                  </div>

                  {/* Testing Simulate Button & Direct Actions */}
                  <div className="qp-qr-action-buttons-row">
                    <button
                      type="button"
                      className="qp-btn-simulate-success"
                      onClick={handleConfirmPaymentSuccess}
                    >
                      <CheckCircle2 size={16} /> จำลองลูกค้าชำระเงินสำเร็จ ⚡
                    </button>
                  </div>
                </div>

                <div className="qp-summary-footer-actions">
                  <button
                    type="button"
                    className="qp-modal-btn-cancel"
                    onClick={() => setSummaryStep('summary')}
                  >
                    แก้ไขส่วนลด / ย้อนกลับ
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: PAYMENT SUCCESS */}
            {summaryStep === 'success' && paymentSuccessData && (
              <div className="qp-summary-body">
                <div className="qp-success-celebrate-card">
                  <div className="qp-success-ring-icon">
                    <CheckCircle2 size={54} color="#10b981" />
                  </div>
                  <h2>รับชำระเงินสำเร็จเรียบร้อย!</h2>
                  <p>บันทึกยอดขายและออกใบเสร็จอิเล็กทรอนิกส์แล้ว</p>

                  <div className="qp-receipt-summary-ticket">
                    <div className="qp-rst-head">
                      <strong>{storeName}</strong>
                      <span className="qp-rst-badge">ชำระแล้ว</span>
                    </div>

                    <div className="qp-rst-row">
                      <span>เลขที่ธุรกรรม:</span>
                      <strong>{paymentSuccessData.txnId}</strong>
                    </div>
                    <div className="qp-rst-row">
                      <span>เวลาทำรายการ:</span>
                      <span>{paymentSuccessData.time}</span>
                    </div>
                    <div className="qp-rst-row">
                      <span>ช่องทางชำระเงิน:</span>
                      <strong>{paymentSuccessData.method}</strong>
                    </div>
                    {paymentSuccessData.discount > 0 && (
                      <div className="qp-rst-row">
                        <span>ส่วนลดที่ได้รับ:</span>
                        <span style={{ color: '#dc2626' }}>-฿{paymentSuccessData.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="qp-rst-row total-highlight">
                      <span>ยอดสุทธิที่ได้รับ:</span>
                      <strong style={{ color: '#059669', fontSize: '18px' }}>
                        ฿{paymentSuccessData.total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="qp-btn-next-customer-full"
                    onClick={() => {
                      handleCloseModal()
                      handleClearAmount()
                    }}
                  >
                    <span>รับเงินรายการถัดไป ({autoResetSec}s)</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}

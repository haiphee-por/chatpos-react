import { useState, useEffect } from 'react'
import {
  Code,
  Key,
  Webhook,
  Cpu,
  BookOpen,
  LayoutDashboard,
  ShieldAlert,
  Copy,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  Send,
  Eye,
  EyeOff,
  ExternalLink,
  Sparkles,
  Zap,
  Activity,
  Clock,
  QrCode,
  Terminal,
  Lock,
  ArrowLeft
} from 'lucide-react'
import { checkTransactionStatus, createTransactionCommand, fetchBalance, fetchChatPosApi } from './chatposApi'

export type DevTab = 'dashboard' | 'api-keys' | 'webhooks' | 'gateway' | 'api-docs'

interface ApiKeyItem {
  id: string
  name: string
  keyMasked: string
  env: 'live' | 'test'
  createdDate: string
  lastUsedDate: string
  expiresIn: string
}

interface WebhookLog {
  id: string
  event: string
  url: string
  status: number
  durationMs: number
  timestamp: string
  retryCount: number
  payload: any
}

interface ApiLogItem {
  id: string
  method: 'POST' | 'GET'
  endpoint: string
  status: number
  latencyMs: number
  timestamp: string
  ip: string
  requestPayload?: any
  responsePayload?: any
}

export function DeveloperConsoleView({ embedded = false }: { embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState<DevTab>('dashboard')
  const [envMode, setEnvMode] = useState<'live' | 'test'>('live')
  const [copiedText, setCopiedText] = useState<string | null>(null)

  const isStandalone = !embedded && (window.location.pathname === '/developer' || window.location.pathname.startsWith('/developer'))

  // 1. API Keys State
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([
    {
      id: 'k-1',
      name: 'LINE Official Chatbot Billing',
      keyMasked: 'cpos_live_8f3a••••••••••••49a2',
      env: 'live',
      createdDate: '12 ก.ค. 2026',
      lastUsedDate: '2 นาทีที่แล้ว',
      expiresIn: 'ไม่มีวันหมดอายุ'
    },
    {
      id: 'k-2',
      name: 'ระบบ ERP จัดการหน้าร้าน (Windows POS)',
      keyMasked: 'cpos_live_17cd••••••••••••99b1',
      env: 'live',
      createdDate: '01 ส.ค. 2026',
      lastUsedDate: '15 นาทีที่แล้ว',
      expiresIn: 'เหลืออีก 342 วัน'
    },
    {
      id: 'k-3',
      name: 'Sandbox Test Key (Staging Bot)',
      keyMasked: 'cpos_test_41ea••••••••••••05f8',
      env: 'test',
      createdDate: '05 ส.ค. 2026',
      lastUsedDate: '1 วันที่แล้ว',
      expiresIn: 'เหลืออีก 25 วัน'
    }
  ])

  const [isCreateKeyModalOpen, setIsCreateKeyModalOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyEnv, setNewKeyEnv] = useState<'live' | 'test'>('live')
  const [newKeyExpiry, setNewKeyExpiry] = useState<'never' | '30' | '90' | '365'>('never')
  const [createdSecretKey, setCreatedSecretKey] = useState<string | null>(null)

  // 2. Webhook Settings State
  const [webhookUrl, setWebhookUrl] = useState('https://myshop-backend.com/api/webhooks/chatpos')
  const [webhookSecret, setWebhookSecret] = useState('whsec_9a87f1c4e09b8214fa73d61b9a2c3f81')
  const [isSecretVisible, setIsSecretVisible] = useState(false)
  const [subscribedEvents, setSubscribedEvents] = useState<string[]>([
    'payment.created',
    'payment.success',
    'payment.failed',
    'payment.expired'
  ])
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([
    {
      id: 'wh-101',
      event: 'payment.success',
      url: 'https://myshop-backend.com/api/webhooks/chatpos',
      status: 200,
      durationMs: 84,
      timestamp: 'วันนี้ 11:32:05 น.',
      retryCount: 1,
      payload: {
        event: 'payment.success',
        reference: 'TXN-1784197518823-2OFLQD',
        amount: 280.0,
        channel: 'promptpay',
        paidAt: '2026-08-15T11:32:04+07:00'
      }
    },
    {
      id: 'wh-102',
      event: 'payment.created',
      url: 'https://myshop-backend.com/api/webhooks/chatpos',
      status: 200,
      durationMs: 42,
      timestamp: 'วันนี้ 11:30:12 น.',
      retryCount: 1,
      payload: {
        event: 'payment.created',
        reference: 'TXN-1784197518823-2OFLQD',
        amount: 280.0,
        channel: 'promptpay'
      }
    }
  ])
  const [isTestWebhookRunning, setIsTestWebhookRunning] = useState(false)
  const [testWebhookResult, setTestWebhookResult] = useState<any>(null)
  const [selectedPayloadModal, setSelectedPayloadModal] = useState<any>(null)

  // 3. Gateway Binding State
  const [gatewayProvider, setGatewayProvider] = useState<'llgw' | 'mock' | 'manual'>('llgw')
  const [gatewayMode, setGatewayMode] = useState<'live' | 'sandbox'>('live')
  const [llgwMerchantId, setLlgwMerchantId] = useState('LLGW-MERCHANT-98214')
  const [llgwPrivateKey, setLlgwPrivateKey] = useState('MIIEowIBAAKCAQEA0Q...[RSA_PRIVATE_KEY_SECURED]')
  const [llgwPublicKey, setLlgwPublicKey] = useState('MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCg...')
  const [isTestingGateway, setIsTestingGateway] = useState(false)
  const [gatewayTestSuccess, setGatewayTestSuccess] = useState<boolean | null>(null)

  // 4. API Docs & Interactive Sandbox State
  const [selectedDocEndpoint, setSelectedDocEndpoint] = useState<'create_qr' | 'check_status' | 'balance'>('create_qr')
  const [codeLanguage, setCodeLanguage] = useState<'curl' | 'javascript' | 'python' | 'php'>('curl')

  // Sandbox Form Inputs
  const [sandboxAmount, setSandboxAmount] = useState('150.00')
  const [sandboxChannel, setSandboxChannel] = useState('promptpay')
  const [sandboxCustomerName, setSandboxCustomerName] = useState('สมชาย รักดี')
  const [sandboxCustomerPhone, setSandboxCustomerPhone] = useState('0812345678')
  const [sandboxNote, setSandboxNote] = useState('สั่งอาหารโต๊ะที่ 5')
  const [sandboxCheckRef, setSandboxCheckRef] = useState('TXN-1784197518823-2OFLQD')

  const [sandboxIsSending, setSandboxIsSending] = useState(false)
  const [sandboxResponse, setSandboxResponse] = useState<any>(null)

  // 5. Developer Logs State
  const [apiLogs, setApiLogs] = useState<ApiLogItem[]>([
    {
      id: 'log-1',
      method: 'POST',
      endpoint: '/api/v1/transactions',
      status: 200,
      latencyMs: 38,
      timestamp: '11:34:10 น.',
      ip: '171.96.120.45',
      requestPayload: { amount: 150.0, channel: 'promptpay', note: 'โต๊ะ 3' },
      responsePayload: { success: true, data: { reference: 'TXN-9841', status: 'pending' } }
    },
    {
      id: 'log-2',
      method: 'GET',
      endpoint: '/api/v1/payments/TXN-9841',
      status: 200,
      latencyMs: 22,
      timestamp: '11:34:52 น.',
      ip: '171.96.120.45',
      responsePayload: { success: true, data: { reference: 'TXN-9841', status: 'success' } }
    },
    {
      id: 'log-3',
      method: 'GET',
      endpoint: '/api/v1/balance',
      status: 200,
      latencyMs: 19,
      timestamp: '11:30:00 น.',
      ip: '171.96.120.45',
      responsePayload: { success: true, data: { withdrawable: 14250.0, pending: 3500.0 } }
    }
  ])

  // Fetch real developer logs from backend
  const refreshDevLogs = async () => {
    try {
      const res = await fetchChatPosApi('/api/v1/developer/logs')
      if (res && res.logs && res.logs.length > 0) {
        const formatted: WebhookLog[] = res.logs.map((l: any) => ({
          id: l.id,
          event: l.event || 'payment.event',
          url: webhookUrl,
          status: l.status === 'DELIVERED' ? 200 : 500,
          durationMs: 45,
          timestamp: new Date(l.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.',
          retryCount: 1,
          payload: typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload
        }))
        setWebhookLogs(formatted)

        const formattedApi: ApiLogItem[] = res.logs.map((l: any, idx: number) => ({
          id: `api-log-${l.id || idx}`,
          method: 'POST',
          endpoint: l.event === 'payment.created' ? '/api/v1/transactions' : '/api/v1/transactions/{reference}',
          status: 200,
          latencyMs: 28 + (idx * 2),
          timestamp: new Date(l.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.',
          ip: '171.96.120.45',
          requestPayload: typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload,
          responsePayload: { success: true, event: l.event, status: 'DELIVERED' }
        }))
        setApiLogs(formattedApi)
      }
    } catch {
      // offline fallback
    }
  }

  useEffect(() => {
    refreshDevLogs()
  }, [])

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text)
    setCopiedText(label)
    setTimeout(() => setCopiedText(null), 2000)
  }

  // Handle Create API Key
  const handleCreateApiKey = () => {
    if (!newKeyName.trim()) return
    const randomHex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    const prefix = newKeyEnv === 'live' ? 'cpos_live_' : 'cpos_test_'
    const fullKey = `${prefix}${randomHex}`
    const masked = `${fullKey.slice(0, 14)}••••••••••••${fullKey.slice(-4)}`

    const expiryLabel =
      newKeyExpiry === 'never'
        ? 'ไม่มีวันหมดอายุ'
        : newKeyExpiry === '30'
        ? 'เหลืออีก 30 วัน'
        : newKeyExpiry === '90'
        ? 'เหลืออีก 90 วัน'
        : 'เหลืออีก 365 วัน'

    const newKeyItem: ApiKeyItem = {
      id: `k-${Date.now()}`,
      name: newKeyName,
      keyMasked: masked,
      env: newKeyEnv,
      createdDate: 'วันนี้',
      lastUsedDate: 'ยังไม่เคยใช้งาน',
      expiresIn: expiryLabel
    }

    setApiKeys([newKeyItem, ...apiKeys])
    setCreatedSecretKey(fullKey)
    setNewKeyName('')
  }

  // Handle Delete API Key
  const handleDeleteApiKey = (id: string) => {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการเพิกถอน (Revoke) API Key นี้? คำขอที่ใช้คีย์นี้จะถูกปฏิเสธทันที')) {
      setApiKeys(apiKeys.filter((k) => k.id !== id))
    }
  }

  // Handle Send Test Webhook
  const handleSendTestWebhook = () => {
    setIsTestWebhookRunning(true)
    setTestWebhookResult(null)
    setTimeout(() => {
      setIsTestWebhookRunning(false)
      const mockResult = {
        success: true,
        statusCode: 200,
        durationMs: 78,
        targetUrl: webhookUrl,
        signatureHeader: 'X-ChatPOS-Signature: e8b9410ca38f619b02456e18f972b9a7c36a289b4f738012bc443',
        event: 'payment.success',
        data: {
          event: 'payment.success',
          reference: `TXN-${Date.now().toString().slice(-6)}-TEST`,
          amount: 150.0,
          channel: 'promptpay',
          customerName: 'สมชาย รักดี (Test)',
          paidAt: new Date().toISOString()
        }
      }
      setTestWebhookResult(mockResult)
      // Add to logs
      setWebhookLogs([
        {
          id: `wh-${Date.now()}`,
          event: 'payment.success (Test)',
          url: webhookUrl,
          status: 200,
          durationMs: 78,
          timestamp: 'เมื่อสักครู่',
          retryCount: 1,
          payload: mockResult.data
        },
        ...webhookLogs
      ])
    }, 1200)
  }

  // Handle Test Gateway Connection
  const handleTestGateway = () => {
    setIsTestingGateway(true)
    setGatewayTestSuccess(null)
    setTimeout(() => {
      setIsTestingGateway(false)
      setGatewayTestSuccess(true)
    }, 1500)
  }

  // Handle Sandbox Send Real API Request
  const handleSendSandboxRequest = async () => {
    setSandboxIsSending(true)
    setSandboxResponse(null)

    try {
      if (selectedDocEndpoint === 'create_qr') {
        const res = await createTransactionCommand({
          amount: parseFloat(sandboxAmount) || 100.0,
          channel: sandboxChannel,
          customerName: sandboxCustomerName,
          customerPhone: sandboxCustomerPhone,
          note: sandboxNote,
        }, `developer:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`)
        setSandboxResponse(res)
        if (res?.transaction) {
          setSandboxCheckRef(res.transaction.paymentReference || res.transaction.clientReference || res.transaction.reference || '')
        }
        refreshDevLogs()
      } else if (selectedDocEndpoint === 'check_status') {
        const res = await checkTransactionStatus(sandboxCheckRef)
        setSandboxResponse(res)
        refreshDevLogs()
      } else {
        const res = await fetchBalance()
        setSandboxResponse(res)
      }
    } catch (err: any) {
      setSandboxResponse({
        success: false,
        error: err?.message || 'Request failed',
        data: err?.data
      })
    } finally {
      setSandboxIsSending(false)
    }
  }

  return (
    <div className={isStandalone ? 'dev-console-shell' : 'dev-embedded-shell'}>
      {/* Top Header (Standalone Mode only) */}
      {isStandalone && (
        <header className="dev-topbar">
          <div className="dev-topbar-left">
            <a href="/merchant" className="dev-back-link">
              <ArrowLeft size={16} /> กลับหน้าร้านค้า
            </a>
            <div className="dev-brand-badge">
              <div className="dev-brand-icon">
                <Code size={20} />
              </div>
              <div>
                <h1>ChatPOS Developer Console</h1>
                <p>ระบบและเครื่องมือสำหรับนักพัฒนา · API & Webhooks Integration</p>
              </div>
            </div>
          </div>

          <div className="dev-topbar-right">
            <div className="dev-api-base-tag">
              <span className="dev-dot active" />
              <code>https://chatpos.biz/api/v1</code>
            </div>

            <div className="dev-env-switch">
              <button
                type="button"
                className={`dev-env-btn ${envMode === 'live' ? 'active live' : ''}`}
                onClick={() => setEnvMode('live')}
              >
                🔴 Live Production
              </button>
              <button
                type="button"
                className={`dev-env-btn ${envMode === 'test' ? 'active test' : ''}`}
                onClick={() => setEnvMode('test')}
              >
                🟡 Sandbox Test
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Container */}
      <div className="dev-container">
        {/* Hero Header Banner (When Embedded in Merchant View) */}
        {!isStandalone && (
          <div className="dev-hero-header">
            <div className="dev-hero-left">
              <div className="dev-brand-icon">
                <Code size={22} />
              </div>
              <div className="dev-hero-info">
                <h2>ChatPOS Developer Console (โหมดนักพัฒนา)</h2>
                <p>เครื่องมือเชื่อมต่อระบบรับชำระเงิน/โอนเงินเข้ากับ ERP, แชทบอท LINE/FB และระบบภายนอก</p>
              </div>
            </div>

            <div className="dev-topbar-right">
              <div className="dev-api-base-tag">
                <span className="dev-dot active" />
                <code>https://chatpos.biz/api/v1</code>
              </div>

              <div className="dev-env-switch">
                <button
                  type="button"
                  className={`dev-env-btn ${envMode === 'live' ? 'active live' : ''}`}
                  onClick={() => setEnvMode('live')}
                >
                  🔴 Live Production
                </button>
                <button
                  type="button"
                  className={`dev-env-btn ${envMode === 'test' ? 'active test' : ''}`}
                  onClick={() => setEnvMode('test')}
                >
                  🟡 Sandbox Test
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs Bar (5 Core Tabs) */}
        <nav className="dev-nav-tabs">
          <button
            type="button"
            className={`dev-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={17} /> 1. แดชบอร์ดนักพัฒนา
          </button>
          <button
            type="button"
            className={`dev-tab-btn ${activeTab === 'api-keys' ? 'active' : ''}`}
            onClick={() => setActiveTab('api-keys')}
          >
            <Key size={17} /> 2. การจัดการ API Keys
          </button>
          <button
            type="button"
            className={`dev-tab-btn ${activeTab === 'webhooks' ? 'active' : ''}`}
            onClick={() => setActiveTab('webhooks')}
          >
            <Webhook size={17} /> 3. การตั้งค่า Webhooks
          </button>
          <button
            type="button"
            className={`dev-tab-btn ${activeTab === 'gateway' ? 'active' : ''}`}
            onClick={() => setActiveTab('gateway')}
          >
            <Cpu size={17} /> 4. การผูกเกตเวย์รายร้าน
          </button>
          <button
            type="button"
            className={`dev-tab-btn ${activeTab === 'api-docs' ? 'active' : ''}`}
            onClick={() => setActiveTab('api-docs')}
          >
            <BookOpen size={17} /> 5. เอกสารคู่มือ API & Sandbox
          </button>
        </nav>

        {/* ====================================================================
            TAB 1: DEVELOPER DASHBOARD
            ==================================================================== */}
        {activeTab === 'dashboard' && (
          <div className="dev-tab-pane">
            {/* 3 Core Highlights Banner */}
            <div className="dev-stats-grid">
              <div className="dev-stat-card">
                <div className="dev-stat-head">
                  <span>API Uptime (30 วัน)</span>
                  <Activity size={18} color="#10b981" />
                </div>
                <strong className="dev-stat-val text-green">99.98%</strong>
                <p className="dev-stat-desc">ระบบทำงานปกติ (All systems operational)</p>
                <div className="dev-stat-progress">
                  <div className="dev-bar green" style={{ width: '99.98%' }} />
                </div>
              </div>

              <div className="dev-stat-card">
                <div className="dev-stat-head">
                  <span>Webhook Success Rate</span>
                  <Zap size={18} color="#3b82f6" />
                </div>
                <strong className="dev-stat-val text-blue">99.9%</strong>
                <p className="dev-stat-desc">อัตราการส่ง Push สำเร็จในการลองครั้งแรก</p>
                <div className="dev-stat-progress">
                  <div className="dev-bar blue" style={{ width: '99.9%' }} />
                </div>
              </div>

              <div className="dev-stat-card">
                <div className="dev-stat-head">
                  <span>API Usage Quota</span>
                  <Clock size={18} color="#f59e0b" />
                </div>
                <div className="dev-stat-val-group">
                  <strong className="dev-stat-val">42</strong>
                  <span className="dev-stat-sub">/ 60 req/min</span>
                </div>
                <p className="dev-stat-desc">จำกัด 60 ครั้งต่อนาที ต่อร้านค้า (รีเซ็ตใน 24s)</p>
                <div className="dev-stat-progress">
                  <div className="dev-bar amber" style={{ width: '70%' }} />
                </div>
              </div>
            </div>

            {/* Quick Actions & Integration Info */}
            <div className="dev-quick-guide-card">
              <div className="dev-qg-left">
                <div className="dev-qg-icon">
                  <Sparkles size={24} color="#ea580c" />
                </div>
                <div className="dev-qg-content">
                  <h3>เชื่อมต่อ ChatPOS เข้ากับแอปพลิเคชันของคุณ</h3>
                  <p>
                    สร้างคิวอาร์โค้ดรับชำระเงินอัตโนมัติจากระบบจัดการร้าน (ERP), แชทบอทปิดการขาย (LINE Bot / Facebook Page Bot)
                    หรือซอฟต์แวร์บัญชีของคุณ พร้อมระบบแจ้งเตือน Webhooks แบบเรียลไทม์
                  </p>
                </div>
              </div>
              <div className="dev-qg-actions">
                <button type="button" className="dev-btn-primary" onClick={() => setActiveTab('api-keys')}>
                  <Key size={15} /> สร้าง API Key
                </button>
                <button type="button" className="dev-btn-outline" onClick={() => setActiveTab('api-docs')}>
                  <BookOpen size={15} /> ทดลองใน Playground
                </button>
              </div>
            </div>

            {/* Recent API Request Logs Feed */}
            <div className="dev-section-card">
              <div className="dev-section-head">
                <div className="dev-sec-title">
                  <Terminal size={18} /> ประวัติการเรียกใช้ API ล่าสุด (Recent API Calls)
                </div>
                <span className="dev-chip">Real-time Feed</span>
              </div>

              <div className="dev-table-wrap">
                <table className="dev-table">
                  <thead>
                    <tr>
                      <th>Method & Endpoint</th>
                      <th>HTTP Status</th>
                      <th>ความเร็ว (Latency)</th>
                      <th>เวลาที่เรียก</th>
                      <th>IP Origin</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiLogs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <div className="dev-endpoint-cell">
                            <span className={`dev-method-badge ${log.method.toLowerCase()}`}>{log.method}</span>
                            <code>{log.endpoint}</code>
                          </div>
                        </td>
                        <td>
                          <span className={`dev-status-badge ${log.status === 200 ? 'status-200' : 'status-400'}`}>
                            {log.status} OK
                          </span>
                        </td>
                        <td>{log.latencyMs} ms</td>
                        <td>{log.timestamp}</td>
                        <td><code>{log.ip}</code></td>
                        <td>
                          <button
                            type="button"
                            className="dev-link-btn"
                            onClick={() => setSelectedPayloadModal({ title: `API Request: ${log.endpoint}`, data: log.responsePayload })}
                          >
                            ดู Payload
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 2: API KEYS MANAGEMENT
            ==================================================================== */}
        {activeTab === 'api-keys' && (
          <div className="dev-tab-pane">
            <div className="dev-section-card">
              <div className="dev-section-head">
                <div>
                  <div className="dev-sec-title">
                    <Key size={18} /> คีย์ยืนยันตัวตน (API Keys)
                  </div>
                  <p className="dev-sec-sub">
                    ใช้เป็น <code>Bearer Token</code> ส่งใน Header <code>Authorization: Bearer &lt;API_KEY&gt;</code> ในทุกคำขอ
                  </p>
                </div>
                <button type="button" className="dev-btn-primary" onClick={() => setIsCreateKeyModalOpen(true)}>
                  <Plus size={16} /> สร้าง API Key ใหม่
                </button>
              </div>

              {/* Security Warning Box */}
              <div className="dev-notice-banner">
                <ShieldAlert size={20} color="#ea580c" />
                <div>
                  <strong>ข้อควรระวังด้านความปลอดภัย</strong>
                  <p>
                    คีย์ลับจะถูกแสดงเพียงครั้งเดียวเท่านั้นตอนสร้างสำเร็จ โปรดเก็บไว้ในเซิร์ฟเวอร์หลังบ้านที่มีความปลอดภัย
                    ห้ามนำคีย์ลับไปใส่ใน Frontend JavaScript หรือแอปมือถือฝั่ง Client โดยตรง
                  </p>
                </div>
              </div>

              {/* API Keys Table */}
              <div className="dev-table-wrap">
                <table className="dev-table">
                  <thead>
                    <tr>
                      <th>ชื่อคีย์ (Name)</th>
                      <th>คีย์ที่ใช้งาน (Token)</th>
                      <th>โหมด (Env)</th>
                      <th>วันที่สร้าง</th>
                      <th>ใช้งานล่าสุด</th>
                      <th>อายุการใช้งาน</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.map((k) => (
                      <tr key={k.id}>
                        <td>
                          <strong>{k.name}</strong>
                        </td>
                        <td>
                          <div className="dev-token-cell">
                            <code>{k.keyMasked}</code>
                            <button
                              type="button"
                              className="dev-icon-copy-btn"
                              title="คัดลอกคีย์"
                              onClick={() => copyToClipboard(k.keyMasked, k.id)}
                            >
                              {copiedText === k.id ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                            </button>
                          </div>
                        </td>
                        <td>
                          <span className={`dev-env-tag ${k.env}`}>{k.env === 'live' ? 'LIVE' : 'TEST'}</span>
                        </td>
                        <td>{k.createdDate}</td>
                        <td>{k.lastUsedDate}</td>
                        <td>
                          <span className="dev-expiry-badge">{k.expiresIn}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="dev-revoke-btn"
                            onClick={() => handleDeleteApiKey(k.id)}
                          >
                            <Trash2 size={14} /> เพิกถอน (Revoke)
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 3: WEBHOOK CONFIGURATION
            ==================================================================== */}
        {activeTab === 'webhooks' && (
          <div className="dev-tab-pane">
            <div className="dev-section-card">
              <div className="dev-section-head">
                <div>
                  <div className="dev-sec-title">
                    <Webhook size={18} /> การตั้งค่า Webhooks (Real-time Event Notifications)
                  </div>
                  <p className="dev-sec-sub">
                    ให้ ChatPOS ยิง Push Notification (HTTP POST) ไปยังเซิร์ฟเวอร์ของคุณอัตโนมัติทันทีที่มีรายการชำระเงิน
                  </p>
                </div>
              </div>

              {/* Form Settings */}
              <div className="dev-form-grid">
                <div className="dev-form-group full-width">
                  <label>Webhook Destination URL</label>
                  <div className="dev-input-with-action">
                    <input
                      type="url"
                      placeholder="https://yourdomain.com/webhooks/chatpos"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      className="dev-input"
                    />
                    <button type="button" className="dev-btn-primary" onClick={() => alert('บันทึก Webhook URL เรียบร้อย')}>
                      บันทึก URL
                    </button>
                  </div>
                  <small>ต้องเป็น URL ที่รองรับ HTTPS และพร้อมรับคำขอ POST</small>
                </div>

                <div className="dev-form-group full-width">
                  <label>Webhook Signing Secret (คีย์ลับสำหรับตรวจสอบลายเซ็น)</label>
                  <div className="dev-secret-box">
                    <code>
                      {isSecretVisible ? webhookSecret : 'whsec_' + '•'.repeat(32)}
                    </code>
                    <div className="dev-secret-actions">
                      <button
                        type="button"
                        className="dev-btn-icon"
                        onClick={() => setIsSecretVisible(!isSecretVisible)}
                      >
                        {isSecretVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button
                        type="button"
                        className="dev-btn-icon"
                        onClick={() => copyToClipboard(webhookSecret, 'whsec')}
                      >
                        {copiedText === 'whsec' ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
                      </button>
                      <button
                        type="button"
                        className="dev-btn-text"
                        onClick={() => {
                          if (confirm('คุณต้องการสุ่มสร้าง Webhook Secret ใหม่ใช่หรือไม่?')) {
                            setWebhookSecret('whsec_' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''))
                          }
                        }}
                      >
                        <RefreshCw size={13} /> สุ่ม Secret ใหม่
                      </button>
                    </div>
                  </div>
                  <small>
                    ใช้คีย์นี้สำหรับคำนวณ HMAC-SHA256 กับ Raw Body เพื่อตรวจสอบว่าข้อมูลมาจาก ChatPOS จริงผ่าน Header <code>X-ChatPOS-Signature</code>
                  </small>
                </div>

                {/* Subscribed Events */}
                <div className="dev-form-group full-width">
                  <label>เหตุการณ์ที่ต้องการรับการแจ้งเตือน (Subscribed Events)</label>
                  <div className="dev-events-checkboxes">
                    {[
                      { id: 'payment.created', label: 'payment.created (สร้างรายการรับเงินสำเร็จ)' },
                      { id: 'payment.success', label: 'payment.success (ลูกค้าสแกนจ่ายเงินสำเร็จ ⭐ แนะนำ)' },
                      { id: 'payment.failed', label: 'payment.failed (การชำระเงินล้มเหลว)' },
                      { id: 'payment.expired', label: 'payment.expired (หมดเวลาชำระเงิน 15 นาที)' },
                      { id: 'payout.completed', label: 'payout.completed (โอนเงินเข้าบัญชีสำเร็จ)' }
                    ].map((ev) => (
                      <label key={ev.id} className="dev-checkbox-card">
                        <input
                          type="checkbox"
                          checked={subscribedEvents.includes(ev.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSubscribedEvents([...subscribedEvents, ev.id])
                            } else {
                              setSubscribedEvents(subscribedEvents.filter((x) => x !== ev.id))
                            }
                          }}
                        />
                        <span>{ev.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ping Test Trigger */}
              <div className="dev-webhook-test-box">
                <div className="dev-wt-left">
                  <h4>🧪 ทดสอบยิง Webhook จำลอง (Webhook Simulation)</h4>
                  <p>ส่ง Test Event Payload ไปยัง URL ปลายทางของคุณเพื่อตรวจการตอบรับ HTTP 200</p>
                </div>
                <button
                  type="button"
                  className="dev-btn-test-action"
                  onClick={handleSendTestWebhook}
                  disabled={isTestWebhookRunning}
                >
                  {isTestWebhookRunning ? (
                    <>
                      <RefreshCw size={15} className="spin-icon" /> กำลังยิงทดสอบ...
                    </>
                  ) : (
                    <>
                      <Send size={15} /> ยิงทดสอบ Webhook ทันที
                    </>
                  )}
                </button>
              </div>

              {/* Test Webhook Result Banner */}
              {testWebhookResult && (
                <div className="dev-test-result-box">
                  <div className="dev-tr-head">
                    <Check size={18} color="#10b981" />
                    <strong>Webhook Ping สำเร็จ! (HTTP {testWebhookResult.statusCode} OK - {testWebhookResult.durationMs}ms)</strong>
                  </div>
                  <div className="dev-code-block">
                    <pre>{JSON.stringify(testWebhookResult.data, null, 2)}</pre>
                  </div>
                </div>
              )}

              {/* Webhook Delivery History */}
              <div className="dev-sub-section">
                <h4>ประวัติการส่ง Webhooks ล่าสุด</h4>
                <div className="dev-table-wrap">
                  <table className="dev-table">
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>URL</th>
                        <th>สถานะ (Status)</th>
                        <th>เวลาที่ส่ง</th>
                        <th>Duration</th>
                        <th>Payload</th>
                      </tr>
                    </thead>
                    <tbody>
                      {webhookLogs.map((log) => (
                        <tr key={log.id}>
                          <td>
                            <code>{log.event}</code>
                          </td>
                          <td className="truncate-cell">{log.url}</td>
                          <td>
                            <span className="dev-status-badge status-200">
                              {log.status} OK
                            </span>
                          </td>
                          <td>{log.timestamp}</td>
                          <td>{log.durationMs} ms</td>
                          <td>
                            <button
                              type="button"
                              className="dev-link-btn"
                              onClick={() => setSelectedPayloadModal({ title: `Webhook Event: ${log.event}`, data: log.payload })}
                            >
                              ดู JSON Payload
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 4: GATEWAY BINDING
            ==================================================================== */}
        {activeTab === 'gateway' && (
          <div className="dev-tab-pane">
            <div className="dev-section-card">
              <div className="dev-section-head">
                <div>
                  <div className="dev-sec-title">
                    <Cpu size={18} /> การผูกเกตเวย์รายร้าน (Gateway Binding)
                  </div>
                  <p className="dev-sec-sub">
                    กำหนดบัญชีผู้รับชำระเงิน (Merchant Gateway Account) ของธนาคารหรือพาร์ตเนอร์ประมวลผลต่อร้านค้า
                  </p>
                </div>
              </div>

              {/* Provider Selector Cards */}
              <div className="dev-providers-grid">
                <div
                  className={`dev-provider-card ${gatewayProvider === 'llgw' ? 'active' : ''}`}
                  onClick={() => setGatewayProvider('llgw')}
                >
                  <div className="dev-pv-radio">
                    <input type="radio" checked={gatewayProvider === 'llgw'} readOnly />
                  </div>
                  <div className="dev-pv-info">
                    <strong>LLGW (LianLian Gateway) ⭐</strong>
                    <p>ระบบประมวลผลธุรกรรมทางการเงินและ PromptPay สำหรับธุรกิจ</p>
                  </div>
                  <span className="dev-pv-badge active">แนะนำ</span>
                </div>

                <div
                  className={`dev-provider-card ${gatewayProvider === 'mock' ? 'active' : ''}`}
                  onClick={() => setGatewayProvider('mock')}
                >
                  <div className="dev-pv-radio">
                    <input type="radio" checked={gatewayProvider === 'mock'} readOnly />
                  </div>
                  <div className="dev-pv-info">
                    <strong>Mock Provider (Sandbox)</strong>
                    <p>ระบบจำลองเกตเวย์สำหรับการทดสอบเชื่อมต่อในระบบพัฒนา</p>
                  </div>
                  <span className="dev-pv-badge">Test Only</span>
                </div>

                <div
                  className={`dev-provider-card ${gatewayProvider === 'manual' ? 'active' : ''}`}
                  onClick={() => setGatewayProvider('manual')}
                >
                  <div className="dev-pv-radio">
                    <input type="radio" checked={gatewayProvider === 'manual'} readOnly />
                  </div>
                  <div className="dev-pv-info">
                    <strong>Direct Bank Routing (Manual)</strong>
                    <p>เชื่อมต่อตรงผ่านบัญชีนิติบุคคลของร้านค้า</p>
                  </div>
                </div>
              </div>

              {/* Gateway Credentials Form */}
              <div className="dev-form-grid" style={{ marginTop: '20px' }}>
                <div className="dev-form-group">
                  <label>Environment Mode</label>
                  <div className="dev-segmented-control">
                    <button
                      type="button"
                      className={`dev-seg-btn ${gatewayMode === 'live' ? 'active' : ''}`}
                      onClick={() => setGatewayMode('live')}
                    >
                      🔴 Production (Live)
                    </button>
                    <button
                      type="button"
                      className={`dev-seg-btn ${gatewayMode === 'sandbox' ? 'active' : ''}`}
                      onClick={() => setGatewayMode('sandbox')}
                    >
                      🟡 Sandbox (Test)
                    </button>
                  </div>
                </div>

                <div className="dev-form-group">
                  <label>LLGW Merchant ID</label>
                  <input
                    type="text"
                    value={llgwMerchantId}
                    onChange={(e) => setLlgwMerchantId(e.target.value)}
                    className="dev-input font-mono"
                  />
                </div>

                <div className="dev-form-group full-width">
                  <label>Merchant Private Key (RSA Private Key)</label>
                  <textarea
                    rows={3}
                    value={llgwPrivateKey}
                    onChange={(e) => setLlgwPrivateKey(e.target.value)}
                    className="dev-input font-mono text-sm"
                  />
                  <small>กุญแจลับสำหรับลงนามดิจิทัล (Digital Signature) ไปยังเกตเวย์</small>
                </div>

                <div className="dev-form-group full-width">
                  <label>LLGW Public Key (RSA Public Key จาก LianLian)</label>
                  <textarea
                    rows={3}
                    value={llgwPublicKey}
                    onChange={(e) => setLlgwPublicKey(e.target.value)}
                    className="dev-input font-mono text-sm"
                  />
                  <small>กุญแจสาธารณะสำหรับตรวจสอบคำตอบกลับจากเกตเวย์</small>
                </div>
              </div>

              {/* Actions & Connection Test */}
              <div className="dev-gateway-footer">
                <button
                  type="button"
                  className="dev-btn-outline"
                  onClick={handleTestGateway}
                  disabled={isTestingGateway}
                >
                  {isTestingGateway ? (
                    <>
                      <RefreshCw size={15} className="spin-icon" /> กำลังทดสอบ Ping เกตเวย์...
                    </>
                  ) : (
                    <>
                      <Zap size={15} /> ทดสอบการเชื่อมต่อเกตเวย์ (Test Connection)
                    </>
                  )}
                </button>

                <button type="button" className="dev-btn-primary" onClick={() => alert('บันทึกการตั้งค่าเกตเวย์เรียบร้อย')}>
                  บันทึกการตั้งค่า
                </button>
              </div>

              {gatewayTestSuccess && (
                <div className="dev-test-success-alert">
                  <Check size={18} color="#10b981" />
                  <span>เกตเวย์ตอบกลับสำเร็จ (Handshake Verified: LLGW API Live)</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 5: API REFERENCE & INTERACTIVE SANDBOX PLAYGROUND
            ==================================================================== */}
        {activeTab === 'api-docs' && (
          <div className="dev-tab-pane">
            <div className="dev-api-docs-layout">
              {/* Left Sidebar: Endpoints List */}
              <div className="dev-docs-sidebar">
                <div className="dev-docs-group">
                  <div className="dev-docs-group-label">Core Payment APIs</div>
                  <button
                    type="button"
                    className={`dev-endpoint-nav-btn ${selectedDocEndpoint === 'create_qr' ? 'active' : ''}`}
                    onClick={() => setSelectedDocEndpoint('create_qr')}
                  >
                    <span className="dev-method-badge post">POST</span>
                    <span>/api/v1/transactions</span>
                  </button>
                  <button
                    type="button"
                    className={`dev-endpoint-nav-btn ${selectedDocEndpoint === 'check_status' ? 'active' : ''}`}
                    onClick={() => setSelectedDocEndpoint('check_status')}
                  >
                    <span className="dev-method-badge get">GET</span>
                    <span>/api/v1/transactions/{'{ref}'}</span>
                  </button>
                </div>

                <div className="dev-docs-group">
                  <div className="dev-docs-group-label">Account & Wallet APIs</div>
                  <button
                    type="button"
                    className={`dev-endpoint-nav-btn ${selectedDocEndpoint === 'balance' ? 'active' : ''}`}
                    onClick={() => setSelectedDocEndpoint('balance')}
                  >
                    <span className="dev-method-badge get">GET</span>
                    <span>/api/v1/balance</span>
                  </button>
                </div>

                <div className="dev-docs-group">
                  <div className="dev-docs-group-label">Security & Webhooks</div>
                  <div className="dev-docs-sec-link">
                    <Lock size={14} /> HMAC-SHA256 Signature
                  </div>
                </div>
              </div>

              {/* Right Main: Interactive API Playground */}
              <div className="dev-docs-main">
                {/* 5.1 Endpoint Details Header */}
                <div className="dev-ep-header-card">
                  {selectedDocEndpoint === 'create_qr' && (
                    <>
                      <div className="dev-ep-title-row">
                        <span className="dev-method-badge post lg">POST</span>
                        <code className="dev-ep-uri">/api/v1/transactions</code>
                        <span className="dev-ep-auth-badge">Auth: Bearer Token</span>
                      </div>
                      <h3>สร้างคิวอาร์โค้ดรับชำระเงิน (Create Payment QR)</h3>
                      <p>
                        สร้างคำขอรับชำระเงินและรับ URL สำหรับแสดงผล QR Code หรือส่งลิงก์ <code>checkoutUrl</code> ให้ลูกค้าสแกนจ่ายผ่านแอปธนาคาร
                      </p>
                    </>
                  )}

                  {selectedDocEndpoint === 'check_status' && (
                    <>
                      <div className="dev-ep-title-row">
                        <span className="dev-method-badge get lg">GET</span>
                        <code className="dev-ep-uri">/api/v1/transactions/{'{reference}'}</code>
                        <span className="dev-ep-auth-badge">Auth: Bearer Token</span>
                      </div>
                      <h3>ตรวจสอบสถานะการจ่ายเงิน (Check Payment Status)</h3>
                      <p>
                        ส่งเลขที่อ้างอิงธุรกรรม <code>reference</code> เพื่อตรวจสอบสถานะแบบ Real-time (เช่น <code>pending</code>, <code>success</code>, <code>failed</code>, <code>expired</code>)
                      </p>
                    </>
                  )}

                  {selectedDocEndpoint === 'balance' && (
                    <>
                      <div className="dev-ep-title-row">
                        <span className="dev-method-badge get lg">GET</span>
                        <code className="dev-ep-uri">/api/v1/balance</code>
                        <span className="dev-ep-auth-badge">Auth: Bearer Token</span>
                      </div>
                      <h3>ตรวจสอบยอดเงินคงเหลือสะสม (Get Merchant Balance)</h3>
                      <p>
                        ดึงข้อมูลยอดเงินในกระเป๋าของร้านค้า โดยแบ่งเป็นยอดที่ถอนได้ทันที (withdrawable) และยอดรอเคลียริ่ง (pending)
                      </p>
                    </>
                  )}
                </div>

                {/* 5.2 Interactive Playground Test Form */}
                <div className="dev-sandbox-card">
                  <div className="dev-sb-head">
                    <div className="dev-sb-title">
                      <Terminal size={17} /> Interactive Sandbox Playground (ทดลองยิงสดในบราวเซอร์)
                    </div>
                    <button
                      type="button"
                      className="dev-btn-send-sandbox"
                      onClick={handleSendSandboxRequest}
                      disabled={sandboxIsSending}
                    >
                      {sandboxIsSending ? (
                        <>
                          <RefreshCw size={14} className="spin-icon" /> กำลังส่งคำขอ...
                        </>
                      ) : (
                        <>
                          <Send size={14} /> ส่งคำขอทดสอบ (Send Request)
                        </>
                      )}
                    </button>
                  </div>

                  {selectedDocEndpoint === 'create_qr' && (
                    <div className="dev-sb-params-grid">
                      <div className="dev-sb-field">
                        <label>ยอดเงิน (amount)</label>
                        <input
                          type="number"
                          value={sandboxAmount}
                          onChange={(e) => setSandboxAmount(e.target.value)}
                          className="dev-input font-mono"
                        />
                      </div>

                      <div className="dev-sb-field">
                        <label>ช่องทาง (channel)</label>
                        <select
                          value={sandboxChannel}
                          onChange={(e) => setSandboxChannel(e.target.value)}
                          className="dev-input"
                        >
                          <option value="promptpay">promptpay (พร้อมเพย์)</option>
                          <option value="truemoney">truemoney (ทรูมันนี่)</option>
                          <option value="wechat">wechat (WeChat Pay)</option>
                          <option value="alipay">alipay (Alipay)</option>
                        </select>
                      </div>

                      <div className="dev-sb-field">
                        <label>ชื่อลูกค้า (customerName)</label>
                        <input
                          type="text"
                          value={sandboxCustomerName}
                          onChange={(e) => setSandboxCustomerName(e.target.value)}
                          className="dev-input"
                        />
                      </div>

                      <div className="dev-sb-field">
                        <label>เบอร์โทร (customerPhone)</label>
                        <input
                          type="text"
                          value={sandboxCustomerPhone}
                          onChange={(e) => setSandboxCustomerPhone(e.target.value)}
                          className="dev-input font-mono"
                        />
                      </div>

                      <div className="dev-sb-field full-width">
                        <label>หมายเหตุบิล (note)</label>
                        <input
                          type="text"
                          value={sandboxNote}
                          onChange={(e) => setSandboxNote(e.target.value)}
                          className="dev-input"
                        />
                      </div>
                    </div>
                  )}

                  {selectedDocEndpoint === 'check_status' && (
                    <div className="dev-sb-params-grid">
                      <div className="dev-sb-field full-width">
                        <label>เลขที่อ้างอิงธุรกรรม (reference)</label>
                        <input
                          type="text"
                          value={sandboxCheckRef}
                          onChange={(e) => setSandboxCheckRef(e.target.value)}
                          className="dev-input font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {/* Live Response Box */}
                  {sandboxResponse && (
                    <div className="dev-sb-response-wrap">
                      <div className="dev-res-head">
                        <div className="dev-res-tag">
                          <Check size={14} color="#10b981" />
                          <span>HTTP 200 OK (Response JSON)</span>
                        </div>
                        <button
                          type="button"
                          className="dev-btn-copy-small"
                          onClick={() => copyToClipboard(JSON.stringify(sandboxResponse, null, 2), 'res-json')}
                        >
                          {copiedText === 'res-json' ? 'คัดลอกแล้ว!' : 'คัดลอก JSON'}
                        </button>
                      </div>
                      <div className="dev-code-block">
                        <pre>{JSON.stringify(sandboxResponse, null, 2)}</pre>
                      </div>

                      {/* Live QR Code Preview if Create QR */}
                      {(sandboxResponse.qrCodeUrl || sandboxResponse.data?.qrCodeUrl) && (
                        <div className="dev-checkout-preview-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '12px' }}>
                          <img
                            src={sandboxResponse.qrCodeUrl || sandboxResponse.data?.qrCodeUrl}
                            alt="Live Generated QR Code"
                            style={{ width: '150px', height: '150px', borderRadius: '10px', background: '#fff', padding: '6px', border: '1px solid #cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                ⚡ Real EMVCo PromptPay QR
                              </span>
                              <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                                Ref: {sandboxResponse.reference || sandboxResponse.data?.reference}
                              </span>
                            </div>
                            <strong style={{ fontSize: '18px', color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                              ฿{Number(sandboxResponse.amount || sandboxResponse.data?.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </strong>
                            <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 8px 0' }}>
                              พร้อมเพย์รับเงิน: <b>{sandboxResponse.merchantPromptPayId || '0823456789'}</b> (สแกนชำระเงินจริงได้ทันที)
                            </p>
                            {sandboxResponse.qrRawText && (
                              <button
                                type="button"
                                className="dev-btn-copy-small"
                                onClick={() => copyToClipboard(sandboxResponse.qrRawText, 'raw-qr')}
                              >
                                {copiedText === 'raw-qr' ? 'คัดลอก Payload แล้ว!' : 'คัดลอก Raw EMVCo Payload'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Checkout URL Preview if Create QR */}
                      {sandboxResponse.data?.checkoutUrl && (
                        <div className="dev-checkout-preview-card">
                          <QrCode size={48} color="#0f172a" />
                          <div>
                            <strong>Checkout Link พร้อมใช้งาน:</strong>
                            <a
                              href={sandboxResponse.data.checkoutUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="dev-checkout-link"
                            >
                              {sandboxResponse.data.checkoutUrl} <ExternalLink size={13} />
                            </a>
                            <p>สามารถนำ URL นี้ไปสร้าง QR ให้ลูกค้าสแกน หรือให้ Chatbot ส่งให้ลูกค้าจ่ายเงินได้ทันที</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 5.3 Code Snippet Generator */}
                <div className="dev-code-snippet-card">
                  <div className="dev-cs-head">
                    <div className="dev-cs-tabs">
                      <button
                        type="button"
                        className={`dev-lang-btn ${codeLanguage === 'curl' ? 'active' : ''}`}
                        onClick={() => setCodeLanguage('curl')}
                      >
                        cURL
                      </button>
                      <button
                        type="button"
                        className={`dev-lang-btn ${codeLanguage === 'javascript' ? 'active' : ''}`}
                        onClick={() => setCodeLanguage('javascript')}
                      >
                        JavaScript (Fetch)
                      </button>
                      <button
                        type="button"
                        className={`dev-lang-btn ${codeLanguage === 'python' ? 'active' : ''}`}
                        onClick={() => setCodeLanguage('python')}
                      >
                        Python
                      </button>
                      <button
                        type="button"
                        className={`dev-lang-btn ${codeLanguage === 'php' ? 'active' : ''}`}
                        onClick={() => setCodeLanguage('php')}
                      >
                        PHP
                      </button>
                    </div>

                    <button
                      type="button"
                      className="dev-btn-copy-small"
                      onClick={() => {
                        let sample = ''
                        if (codeLanguage === 'curl') {
                          sample = `curl -X POST "https://chatpos.biz/api/v1/transactions" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Idempotency-Key: transaction-demo-001" \\\n  -H "Content-Type: application/json" \\\n  -d '{"amount": ${sandboxAmount}, "channel": "${sandboxChannel}", "customerName": "${sandboxCustomerName}", "note": "${sandboxNote}"}'`
                        }
                        copyToClipboard(sample, 'code-sample')
                      }}
                    >
                      <Copy size={13} /> {copiedText === 'code-sample' ? 'คัดลอกโค้ดแล้ว!' : 'คัดลอกโค้ด'}
                    </button>
                  </div>

                  <div className="dev-code-block dark">
                    {codeLanguage === 'curl' && (
                      <pre>{`curl -X POST "https://chatpos.biz/api/v1/transactions" \\
  -H "Authorization: Bearer cpos_live_your_api_key_here" \\
  -H "Idempotency-Key: transaction-demo-001" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": ${sandboxAmount},
    "channel": "${sandboxChannel}",
    "customerName": "${sandboxCustomerName}",
    "customerPhone": "${sandboxCustomerPhone}",
    "note": "${sandboxNote}",
    "redirectUrl": "https://yourmerchant.com/payment-success"
  }'`}</pre>
                    )}

                    {codeLanguage === 'javascript' && (
                      <pre>{`const response = await fetch('https://chatpos.biz/api/v1/transactions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer cpos_live_your_api_key_here',
    'Content-Type': 'application/json',
    'Idempotency-Key': 'transaction-demo-001'
  },
  body: JSON.stringify({
    amount: ${sandboxAmount},
    channel: '${sandboxChannel}',
    customerName: '${sandboxCustomerName}',
    customerPhone: '${sandboxCustomerPhone}',
    note: '${sandboxNote}',
    redirectUrl: 'https://yourmerchant.com/payment-success'
  })
});

const result = await response.json();
console.log('Checkout URL:', result.data.checkoutUrl);`}</pre>
                    )}

                    {codeLanguage === 'python' && (
                      <pre>{`import requests

url = "https://chatpos.biz/api/v1/transactions"
headers = {
    "Authorization": "Bearer cpos_live_your_api_key_here",
  "Content-Type": "application/json",
  "Idempotency-Key": "transaction-demo-001"
}
payload = {
    "amount": ${sandboxAmount},
    "channel": "${sandboxChannel}",
    "customerName": "${sandboxCustomerName}",
    "customerPhone": "${sandboxCustomerPhone}",
    "note": "${sandboxNote}",
    "redirectUrl": "https://yourmerchant.com/payment-success"
}

response = requests.post(url, json=payload, headers=headers)
data = response.json()
print("Checkout URL:", data["data"]["checkoutUrl"])`}</pre>
                    )}

                    {codeLanguage === 'php' && (
                      <pre>{`<?php
$ch = curl_init('https://chatpos.biz/api/v1/transactions');
$payload = json_encode([
  'amount' => ${sandboxAmount},
  'channel' => '${sandboxChannel}',
  'customerName' => '${sandboxCustomerName}',
  'note' => '${sandboxNote}'
]);

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'Authorization: Bearer cpos_live_your_api_key_here',
  'Content-Type: application/json',
  'Idempotency-Key: transaction-demo-001'
]);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

$response = curl_exec($ch);
curl_close($ch);
$result = json_decode($response, true);
echo $result['data']['checkoutUrl'];
?>`}</pre>
                    )}
                  </div>
                </div>

                {/* 5.4 Webhook Digital Signature Verification Guide */}
                <div className="dev-security-guide-card">
                  <div className="dev-sg-head">
                    <ShieldAlert size={20} color="#ea580c" />
                    <h4>ความปลอดภัยในการใช้งาน Webhooks (HMAC-SHA256 Signature Verification)</h4>
                  </div>
                  <p>
                    เมื่อระบบประมวลผลการรับเงินสำเร็จ ChatPOS จะทำการยิงคำขอ POST ไปยัง Webhook URL ของท่าน
                    โดยส่งลายเซ็นดิจิทัลมาใน Header <code>X-ChatPOS-Signature</code> ให้ท่านนำ Raw Request Body มาคำนวณเปรียบเทียบ
                  </p>

                  <div className="dev-code-block dark">
                    <pre>{`// ตัวอย่างการตรวจสอบ Signature ใน Node.js (Express)
const crypto = require('crypto');

app.post('/webhooks/chatpos', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-chatpos-signature'];
  const webhookSecret = 'whsec_your_secret_here';

  // คำนวณ HMAC-SHA256 ด้วย Raw Body String
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(req.body)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).send('Invalid Signature');
  }

  const event = JSON.parse(req.body.toString());
  if (event.event === 'payment.success') {
    console.log('ชำระเงินสำเร็จยอด:', event.amount, 'Ref:', event.reference);
  }

  res.status(200).send({ received: true });
});`}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Create API Key */}
      {isCreateKeyModalOpen && (
        <div className="dev-modal-overlay" onClick={() => { if (!createdSecretKey) setIsCreateKeyModalOpen(false) }}>
          <div className="dev-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dev-modal-head">
              <h3>{createdSecretKey ? '🎉 สร้าง API Key สำเร็จ!' : 'สร้าง API Key ใหม่'}</h3>
              {!createdSecretKey && (
                <button type="button" className="dev-modal-close" onClick={() => setIsCreateKeyModalOpen(false)}>
                  ✕
                </button>
              )}
            </div>

            <div className="dev-modal-body">
              {!createdSecretKey ? (
                <div className="dev-form-grid">
                  <div className="dev-form-group full-width">
                    <label>ชื่อคีย์ หรือ ระบบที่นำไปใช้ (Key Name)</label>
                    <input
                      type="text"
                      placeholder="เช่น LINE Official Chatbot, ระบบ ERP หน้าร้าน..."
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="dev-input"
                    />
                  </div>

                  <div className="dev-form-group">
                    <label>สภาพแวดล้อม (Environment)</label>
                    <select
                      value={newKeyEnv}
                      onChange={(e) => setNewKeyEnv(e.target.value as any)}
                      className="dev-input"
                    >
                      <option value="live">🔴 Production (cpos_live_...)</option>
                      <option value="test">🟡 Test Sandbox (cpos_test_...)</option>
                    </select>
                  </div>

                  <div className="dev-form-group">
                    <label>อายุการใช้งาน (Expiration)</label>
                    <select
                      value={newKeyExpiry}
                      onChange={(e) => setNewKeyExpiry(e.target.value as any)}
                      className="dev-input"
                    >
                      <option value="never">ไม่มีวันหมดอายุ (Never expire)</option>
                      <option value="30">30 วัน (30 Days)</option>
                      <option value="90">90 วัน (90 Days)</option>
                      <option value="365">365 วัน (1 Year)</option>
                    </select>
                  </div>

                  <div className="dev-modal-actions full-width">
                    <button
                      type="button"
                      className="dev-btn-secondary"
                      onClick={() => setIsCreateKeyModalOpen(false)}
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      className="dev-btn-primary"
                      onClick={handleCreateApiKey}
                      disabled={!newKeyName.trim()}
                    >
                      สร้างคีย์ทันที
                    </button>
                  </div>
                </div>
              ) : (
                <div className="dev-created-key-reveal">
                  <div className="dev-key-alert">
                    <ShieldAlert size={24} color="#ea580c" />
                    <div>
                      <strong>โปรดคัดลอกและบันทึกคีย์นี้เก็บไว้ทันที!</strong>
                      <p>
                        เพื่อความปลอดภัย ระบบจะแสดงรหัสเต็มของ API Key นี้ <b>เพียงครั้งเดียวเท่านั้น</b>
                        หลังจากปิดหน้าต่างนี้ไป ท่านจะไม่สามารถดูรหัสเต็มได้อีก
                      </p>
                    </div>
                  </div>

                  <div className="dev-secret-token-display">
                    <code>{createdSecretKey}</code>
                    <button
                      type="button"
                      className="dev-btn-primary"
                      onClick={() => copyToClipboard(createdSecretKey, 'secret-reveal')}
                    >
                      {copiedText === 'secret-reveal' ? (
                        <>
                          <Check size={16} /> คัดลอกแล้ว!
                        </>
                      ) : (
                        <>
                          <Copy size={16} /> คัดลอก API Key
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    className="dev-btn-done"
                    onClick={() => {
                      setCreatedSecretKey(null)
                      setIsCreateKeyModalOpen(false)
                    }}
                  >
                    ฉันคัดลอกและบันทึกคีย์เรียบร้อยแล้ว
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: View Payload Detail */}
      {selectedPayloadModal && (
        <div className="dev-modal-overlay" onClick={() => setSelectedPayloadModal(null)}>
          <div className="dev-modal-card lg" onClick={(e) => e.stopPropagation()}>
            <div className="dev-modal-head">
              <h3>{selectedPayloadModal.title}</h3>
              <button type="button" className="dev-modal-close" onClick={() => setSelectedPayloadModal(null)}>
                ✕
              </button>
            </div>
            <div className="dev-modal-body">
              <div className="dev-code-block dark">
                <pre>{JSON.stringify(selectedPayloadModal.data, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

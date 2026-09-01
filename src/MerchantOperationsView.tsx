import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Copy,
  CreditCard,
  ExternalLink,
  Grid2X2,
  Minus,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  ShoppingBasket,
  Store,
  Trash2,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import {
  createDbOrder,
  createDbTable,
  fetchDbOrdersResult,
  fetchDbProductsResult,
  fetchDbTablesResult,
  transitionDbOrderStatus,
  updateDbTable,
  type DbMerchantOrderRow,
  type DbProductRow,
  type DbRestaurantTableRow,
} from './dbApi'
import { generateUrlQrDataUrl } from './promptpay'
import { useThaiVoice } from './useThaiVoice'

type LoadState = 'loading' | 'ready' | 'empty' | 'error'
type CartLine = { product: DbProductRow; quantity: number }

const orderStatusMeta: Record<DbMerchantOrderRow['status'], { label: string; next?: DbMerchantOrderRow['status']; action?: string }> = {
  NEW: { label: 'ออเดอร์ใหม่', next: 'ACCEPTED', action: 'รับออเดอร์' },
  ACCEPTED: { label: 'รับออเดอร์แล้ว', next: 'KITCHEN_RECEIVED', action: 'ส่งเข้าครัว' },
  KITCHEN_RECEIVED: { label: 'ครัวรับรายการแล้ว', next: 'DONE', action: 'เสร็จสิ้น' },
  DONE: { label: 'เสร็จสิ้น' },
  CANCELLED: { label: 'ยกเลิก' },
}

function money(value: string | number) {
  return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function MerchantOrdersView({ storeId }: { storeId: string | null }) {
  const [orders, setOrders] = useState<DbMerchantOrderRow[]>([])
  const [state, setState] = useState<LoadState>(storeId ? 'loading' : 'empty')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'open' | 'done'>('open')
  const [workingId, setWorkingId] = useState('')
  const seenOrderIdsRef = useRef<Set<string> | null>(null)
  const voice = useThaiVoice(true)

  const load = async (announce = false) => {
    if (!storeId) {
      setOrders([])
      setState('empty')
      return
    }
    if (!seenOrderIdsRef.current) setState('loading')
    const result = await fetchDbOrdersResult(storeId, { limit: 150 })
    if (result.error) {
      setError(result.error)
      setState(orders.length ? 'ready' : 'error')
      return
    }
    const nextIds = new Set(result.data.map((order) => order.id))
    if (announce && seenOrderIdsRef.current) {
      const newCount = result.data.filter((order) => order.status === 'NEW' && !seenOrderIdsRef.current?.has(order.id)).length
      if (newCount > 0) voice.speak(`มีออเดอร์ใหม่ ${newCount} รายการ กรุณาตรวจสอบ`, ['please_check'])
    }
    seenOrderIdsRef.current = nextIds
    setOrders(result.data)
    setError('')
    setState(result.data.length ? 'ready' : 'empty')
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true)
    }, 5000)
    const onVisible = () => { if (document.visibilityState === 'visible') void load(true) }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [storeId])

  const transition = async (order: DbMerchantOrderRow, status: DbMerchantOrderRow['status'], reason?: string) => {
    if (!storeId || workingId) return
    setWorkingId(order.id)
    setError('')
    try {
      const result = await transitionDbOrderStatus(order.id, { storeId, status, expectedVersion: order.version, reason })
      setOrders((current) => current.map((item) => item.id === result.order.id ? result.order : item))
    } catch (transitionError: any) {
      setError(transitionError?.message || 'อัปเดตสถานะออเดอร์ไม่สำเร็จ')
      await load()
    } finally {
      setWorkingId('')
    }
  }

  const visibleOrders = orders.filter((order) => filter === 'done' ? ['DONE', 'CANCELLED'].includes(order.status) : !['DONE', 'CANCELLED'].includes(order.status))
  const openCount = orders.filter((order) => !['DONE', 'CANCELLED'].includes(order.status)).length
  const doneCount = orders.filter((order) => ['DONE', 'CANCELLED'].includes(order.status)).length

  return (
    <section className="merchant-operation-page merchant-orders-production" aria-labelledby="merchant-orders-title">
      <div className="operation-summary-bar">
        <span><ClipboardList /><b id="merchant-orders-title">ออเดอร์ร้านค้า</b></span>
        <strong>{openCount} รายการเปิดอยู่</strong>
        <button type="button" onClick={voice.toggle} aria-label={voice.enabled ? 'ปิดเสียงออเดอร์' : 'เปิดเสียงออเดอร์'}>{voice.enabled ? <Volume2 /> : <VolumeX />}</button>
        <button type="button" onClick={() => { void load() }} aria-label="รีเฟรชออเดอร์"><RefreshCw /></button>
      </div>
      <div className="operation-tabs" role="tablist" aria-label="สถานะออเดอร์">
        <button className={filter === 'open' ? 'active' : ''} onClick={() => setFilter('open')} type="button">กำลังดำเนินการ <span>{openCount}</span></button>
        <button className={filter === 'done' ? 'active' : ''} onClick={() => setFilter('done')} type="button">เสร็จ/ยกเลิก <span>{doneCount}</span></button>
      </div>
      {error && <div className="operation-error" role="alert"><ShieldAlert />{error}<button type="button" onClick={() => { void load() }}>ลองใหม่</button></div>}
      {state === 'loading' && <div className="operation-empty" aria-busy="true"><RefreshCw className="spin" /><strong>กำลังโหลดออเดอร์</strong></div>}
      {state !== 'loading' && visibleOrders.length === 0 && <div className="operation-empty"><ClipboardList /><strong>{state === 'error' ? 'โหลดออเดอร์ไม่ได้' : 'ยังไม่มีออเดอร์ในกลุ่มนี้'}</strong><p>รายการใหม่จาก POS หรือโต๊ะจะแสดงที่นี่</p></div>}
      <div className="production-order-list">
        {visibleOrders.map((order) => {
          const meta = orderStatusMeta[order.status]
          return <article key={order.id} className={`production-order-card status-${order.status.toLowerCase()}`}>
            <header><span><small>{order.orderNumber}</small><strong>{order.tableName || order.customerName || 'ลูกค้าหน้าร้าน'}</strong></span><em>{meta.label}</em></header>
            <div className="production-order-items">{order.items.map((item) => <p key={item.id}><span><b>{item.quantity}</b>{item.name}</span><strong>฿{money(item.lineTotal)}</strong></p>)}</div>
            {order.note && <p className="production-order-note">หมายเหตุ: {order.note}</p>}
            <footer><span><small>{new Date(order.createdAt).toLocaleString('th-TH')}</small><strong>฿{money(order.total)}</strong></span><div>{meta.next && <button type="button" onClick={() => { void transition(order, meta.next!) }} disabled={workingId === order.id}><Check />{workingId === order.id ? 'กำลังบันทึก...' : meta.action}</button>}{!['DONE', 'CANCELLED'].includes(order.status) && <button className="danger" type="button" onClick={() => { if (window.confirm(`ยกเลิก ${order.orderNumber}?`)) void transition(order, 'CANCELLED', 'ยกเลิกโดย Merchant') }} disabled={workingId === order.id}><X />ยกเลิก</button>}</div></footer>
          </article>
        })}
      </div>
    </section>
  )
}

export function MerchantTablesView({ storeId }: { storeId: string | null }) {
  const [tables, setTables] = useState<DbRestaurantTableRow[]>([])
  const [state, setState] = useState<LoadState>(storeId ? 'loading' : 'empty')
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [zone, setZone] = useState('')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<DbRestaurantTableRow | null>(null)
  const [qr, setQr] = useState<{ table: DbRestaurantTableRow; url: string; image: string } | null>(null)

  const load = async () => {
    if (!storeId) {
      setState('empty')
      return
    }
    setState('loading')
    const result = await fetchDbTablesResult(storeId)
    if (result.error) {
      setError(result.error)
      setState('error')
      return
    }
    setTables(result.data)
    setError('')
    setState(result.data.length ? 'ready' : 'empty')
  }

  useEffect(() => { void load() }, [storeId])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!storeId || !name.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      await createDbTable({ storeId, name: name.trim(), zone: zone.trim() || null }, `table:${crypto.randomUUID()}`)
      setName('')
      setZone('')
      await load()
    } catch (saveError: any) {
      setError(saveError?.message || 'เพิ่มโต๊ะไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async () => {
    if (!storeId || !editing) return
    setSaving(true)
    try {
      await updateDbTable(editing.id, { storeId, expectedVersion: editing.version, name: editing.name, zone: editing.zone })
      setEditing(null)
      await load()
    } catch (saveError: any) {
      setError(saveError?.message || 'แก้ไขโต๊ะไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async (table: DbRestaurantTableRow) => {
    if (!storeId || !window.confirm(`ปิดใช้งาน ${table.name}?`)) return
    try {
      await updateDbTable(table.id, { storeId, expectedVersion: table.version, status: 'INACTIVE' })
      await load()
    } catch (saveError: any) {
      setError(saveError?.message || 'ปิดโต๊ะไม่สำเร็จ')
    }
  }

  const openQr = async (table: DbRestaurantTableRow) => {
    const url = `${window.location.origin}/order/${table.token}`
    setQr({ table, url, image: await generateUrlQrDataUrl(url, 320) })
  }

  return (
    <section className="merchant-operation-page merchant-tables-production" aria-labelledby="merchant-tables-title">
      <div className="operation-summary-bar"><span><Grid2X2 /><b id="merchant-tables-title">จัดการโต๊ะ</b></span><strong>{tables.length} โต๊ะ</strong><button type="button" onClick={() => { void load() }} aria-label="รีเฟรชโต๊ะ"><RefreshCw /></button></div>
      <form className="production-table-form" onSubmit={submit}><label><span>ชื่อโต๊ะ</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="เช่น โต๊ะ 03" required /></label><label><span>โซน</span><input value={zone} onChange={(event) => setZone(event.target.value)} maxLength={120} placeholder="เช่น โซนหน้าร้าน" /></label><button type="submit" disabled={saving || !storeId}><Plus />{saving ? 'กำลังเพิ่ม...' : 'เพิ่มโต๊ะ'}</button></form>
      {error && <div className="operation-error" role="alert"><ShieldAlert />{error}<button type="button" onClick={() => { void load() }}>ลองใหม่</button></div>}
      {state === 'loading' && <div className="operation-empty" aria-busy="true"><RefreshCw className="spin" /><strong>กำลังโหลดโต๊ะ</strong></div>}
      {state !== 'loading' && tables.length === 0 && <div className="operation-empty"><UtensilsCrossed /><strong>ยังไม่มีโต๊ะ</strong><p>เพิ่มโต๊ะแรกเพื่อสร้าง QR รับออเดอร์</p></div>}
      <div className="production-table-grid">{tables.map((table) => <article className={table.openOrderCount ? 'occupied' : ''} key={table.id}><header><span><UtensilsCrossed /></span><div><strong>{table.name}</strong><small>{table.zone || 'ไม่ระบุโซน'}</small></div><em>{table.openOrderCount ? `${table.openOrderCount} ออเดอร์` : 'ว่าง'}</em></header><div className="production-table-total"><span>ยอดออเดอร์เปิดอยู่</span><strong>฿{money(table.openOrderTotal)}</strong></div><footer><button type="button" onClick={() => { void openQr(table) }}><QrCode />QR โต๊ะ</button><button type="button" onClick={() => setEditing({ ...table })}><Pencil />แก้ไข</button><button className="danger" type="button" onClick={() => { void deactivate(table) }}><Trash2 />ปิดโต๊ะ</button></footer></article>)}</div>
      {editing && <div className="operation-dialog"><button className="operation-backdrop" type="button" aria-label="ปิด" onClick={() => setEditing(null)} /><section role="dialog" aria-modal="true" aria-labelledby="edit-table-title"><header><h3 id="edit-table-title">แก้ไขโต๊ะ</h3><button type="button" onClick={() => setEditing(null)} aria-label="ปิด"><X /></button></header><label><span>ชื่อโต๊ะ</span><input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label><label><span>โซน</span><input value={editing.zone || ''} onChange={(event) => setEditing({ ...editing, zone: event.target.value })} /></label><button type="button" onClick={() => { void saveEdit() }} disabled={saving}>บันทึกการแก้ไข</button></section></div>}
      {qr && <div className="operation-dialog"><button className="operation-backdrop" type="button" aria-label="ปิด" onClick={() => setQr(null)} /><section className="table-qr-dialog" role="dialog" aria-modal="true" aria-labelledby="table-qr-title"><header><h3 id="table-qr-title">QR {qr.table.name}</h3><button type="button" onClick={() => setQr(null)} aria-label="ปิด"><X /></button></header><img src={qr.image} alt={`QR รับออเดอร์ ${qr.table.name}`} /><code>{qr.url}</code><div><button type="button" onClick={() => void navigator.clipboard.writeText(qr.url)}><Copy />คัดลอกลิงก์</button><a href={qr.url} target="_blank" rel="noreferrer"><ExternalLink />เปิดหน้าสั่ง</a></div></section></div>}
    </section>
  )
}

export function MerchantPosView({ storeId, onNavigate }: { storeId: string | null; onNavigate: (id: string) => void }) {
  const [products, setProducts] = useState<DbProductRow[]>([])
  const [tables, setTables] = useState<DbRestaurantTableRow[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [state, setState] = useState<LoadState>(storeId ? 'loading' : 'empty')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [tableId, setTableId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createdOrder, setCreatedOrder] = useState<DbMerchantOrderRow | null>(null)
  const voice = useThaiVoice(true)

  const load = async () => {
    if (!storeId) return setState('empty')
    setState('loading')
    const [productResult, tableResult] = await Promise.all([fetchDbProductsResult(storeId), fetchDbTablesResult(storeId)])
    if (productResult.error) {
      setError(productResult.error)
      setState('error')
      return
    }
    setProducts(productResult.data.filter((product) => product.isActive))
    setTables(tableResult.data)
    setError(tableResult.error || '')
    setState(productResult.data.length ? 'ready' : 'empty')
  }

  useEffect(() => { void load() }, [storeId])

  const add = (product: DbProductRow) => setCart((current) => {
    const found = current.find((line) => line.product.id === product.id)
    return found ? current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { product, quantity: 1 }]
  })
  const change = (productId: string, delta: number) => setCart((current) => current.map((line) => line.product.id === productId ? { ...line, quantity: line.quantity + delta } : line).filter((line) => line.quantity > 0))
  const total = useMemo(() => cart.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0), [cart])
  const visibleProducts = products.filter((product) => `${product.name} ${product.category || ''}`.toLocaleLowerCase('th-TH').includes(search.trim().toLocaleLowerCase('th-TH')))

  const submitOrder = async () => {
    if (!storeId || !cart.length || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const result = await createDbOrder({ storeId, tableId: tableId || null, source: 'POS', customerName: tableId ? undefined : 'ลูกค้าหน้าร้าน', items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })) }, `pos-order:${crypto.randomUUID()}`)
      setCreatedOrder(result.order)
      setCart([])
      voice.speakOrderComplete()
    } catch (submitError: any) {
      setError(submitError?.message || 'บันทึกออเดอร์ไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="merchant-operation-page merchant-pos-production" aria-labelledby="merchant-pos-title">
      <div className="operation-summary-bar"><span><ShoppingBasket /><b id="merchant-pos-title">POS หน้าร้าน</b></span><strong>฿{money(total)}</strong><button type="button" onClick={voice.toggle} aria-label={voice.enabled ? 'ปิดเสียง POS' : 'เปิดเสียง POS'}>{voice.enabled ? <Volume2 /> : <VolumeX />}</button></div>
      {createdOrder && <div className="operation-success" role="status"><CheckCircle2 /><span><strong>บันทึก {createdOrder.orderNumber} แล้ว</strong><small>ออเดอร์ถูกส่งเข้ารายการร้านค้า</small></span><button type="button" onClick={() => onNavigate('orders')}>ดูออเดอร์ <ChevronRight /></button></div>}
      {error && <div className="operation-error" role="alert"><ShieldAlert />{error}<button type="button" onClick={() => { void load() }}>ลองใหม่</button></div>}
      <label className="production-pos-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาสินค้า" /></label>
      <div className="production-pos-products">{visibleProducts.map((product) => <button key={product.id} onClick={() => add(product)} type="button" disabled={product.trackStock && Number(product.stock) <= 0}><span>{product.image ? <img src={product.image} alt="" /> : <Store />}</span><small>{product.category || 'สินค้า'}</small><strong>{product.name}</strong><b>฿{money(product.price)}</b><em>{product.trackStock ? `เหลือ ${Number(product.stock)} ชิ้น` : 'พร้อมขาย'}</em><i><Plus /></i></button>)}</div>
      {state === 'loading' && <div className="operation-empty" aria-busy="true"><RefreshCw className="spin" /><strong>กำลังโหลดสินค้า</strong></div>}
      {state === 'empty' && <div className="operation-empty"><Store /><strong>ยังไม่มีสินค้าเปิดขาย</strong><p>เพิ่มสินค้าในเมนูสินค้า/สต็อกก่อนเปิด POS</p></div>}
      <section className="production-pos-cart"><header><h3><ShoppingBasket />ตะกร้า</h3><span>{cart.reduce((sum, line) => sum + line.quantity, 0)} รายการ</span></header>{cart.length ? cart.map((line) => <div className="production-cart-line" key={line.product.id}><span><strong>{line.product.name}</strong><small>฿{money(line.product.price)} / ชิ้น</small></span><div><button type="button" onClick={() => change(line.product.id, -1)}><Minus /></button><b>{line.quantity}</b><button type="button" onClick={() => change(line.product.id, 1)}><Plus /></button></div><strong>฿{money(Number(line.product.price) * line.quantity)}</strong></div>) : <p className="production-cart-empty">เลือกสินค้าเพื่อเริ่มออเดอร์</p>}<label><span>โต๊ะ (ไม่บังคับ)</span><select value={tableId} onChange={(event) => setTableId(event.target.value)}><option value="">ลูกค้าหน้าร้าน</option>{tables.map((table) => <option key={table.id} value={table.id}>{table.name}{table.zone ? ` · ${table.zone}` : ''}</option>)}</select></label><footer><span><small>ยอดรวม</small><strong>฿{money(total)}</strong></span><button type="button" onClick={() => { void submitOrder() }} disabled={!cart.length || submitting}><CreditCard />{submitting ? 'กำลังบันทึก...' : 'บันทึกออเดอร์'}</button></footer></section>
    </section>
  )
}

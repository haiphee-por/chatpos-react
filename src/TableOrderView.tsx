import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Minus,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShoppingBasket,
  Store,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { useThaiVoice } from './useThaiVoice'

type PublicProduct = {
  id: string
  name: string
  description: string | null
  price: string
  stock: string
  category: string | null
  image: string | null
  trackStock: boolean
}

type PublicTableContext = {
  table: { id: string; name: string; zone: string | null; token: string; storeId: string; storeName: string; storeDescription: string | null }
  products: PublicProduct[]
}

type CartLine = { product: PublicProduct; quantity: number }

type CreatedOrder = { id: string; orderNumber: string; status: string; total: string; createdAt: string }

function money(value: string | number) {
  return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function TableOrderView({ token }: { token: string }) {
  const [context, setContext] = useState<PublicTableContext | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ทั้งหมด')
  const [note, setNote] = useState('')
  const [stage, setStage] = useState<'menu' | 'review' | 'success'>('menu')
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const idempotencyKeyRef = useRef('')
  const voice = useThaiVoice(true)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/public/table-order?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      const payload = await response.json() as { data?: PublicTableContext; error?: string }
      if (!response.ok || !payload.data) throw new Error(payload.error || 'เปิดเมนูไม่สำเร็จ')
      setContext(payload.data)
    } catch (loadError: any) {
      setError(loadError?.message || 'เปิดเมนูไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [token])

  const categories = useMemo(() => ['ทั้งหมด', ...new Set((context?.products || []).map((product) => product.category || 'สินค้าอื่นๆ'))], [context])
  const visibleProducts = useMemo(() => (context?.products || []).filter((product) => {
    const matchesCategory = category === 'ทั้งหมด' || (product.category || 'สินค้าอื่นๆ') === category
    const term = search.trim().toLocaleLowerCase('th-TH')
    return matchesCategory && (!term || `${product.name} ${product.description || ''}`.toLocaleLowerCase('th-TH').includes(term))
  }), [context, category, search])
  const total = useMemo(() => cart.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0), [cart])
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0)

  const add = (product: PublicProduct) => setCart((current) => {
    const found = current.find((line) => line.product.id === product.id)
    return found ? current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { product, quantity: 1 }]
  })
  const change = (productId: string, delta: number) => setCart((current) => current.map((line) => line.product.id === productId ? { ...line, quantity: line.quantity + delta } : line).filter((line) => line.quantity > 0))

  const submit = async () => {
    if (!cart.length || submitting) return
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = `table-order:${crypto.randomUUID()}`
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/public/table-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKeyRef.current },
        body: JSON.stringify({ token, note: note.trim() || undefined, items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })) }),
      })
      const payload = await response.json() as { order?: CreatedOrder; error?: string }
      if (!response.ok || !payload.order) throw new Error(payload.error || 'ส่งออเดอร์ไม่สำเร็จ')
      setCreatedOrder(payload.order)
      setStage('success')
      voice.speakOrderComplete()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (submitError: any) {
      setError(submitError?.message || 'ส่งออเดอร์ไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <main className="table-order-state"><RefreshCw className="spin" /><strong>กำลังเปิดเมนูร้าน</strong></main>
  if (!context) return <main className="table-order-state error"><X /><strong>เปิดเมนูไม่ได้</strong><p>{error}</p><button type="button" onClick={() => { void load() }}>ลองใหม่</button></main>

  return (
    <div className="table-order-shell">
      <header className="table-order-header">
        <button type="button" onClick={() => stage === 'menu' ? window.history.back() : setStage('menu')} aria-label="ย้อนกลับ"><ChevronLeft /></button>
        <span><small>{context.table.storeName}</small><strong>{stage === 'menu' ? 'สั่งอาหาร' : stage === 'review' ? 'ตรวจสอบออเดอร์' : 'ส่งออเดอร์แล้ว'}</strong></span>
        <em><UtensilsCrossed />{context.table.name}</em>
      </header>

      {stage === 'menu' && <main className="table-order-main">
        <section className="table-order-store"><span><Store /></span><div><small>TABLE ORDER</small><h1>{context.table.storeName}</h1><p>{context.table.storeDescription || 'เลือกสินค้าและส่งออเดอร์ถึงร้านได้ทันที'}</p></div></section>
        <label className="table-order-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาเมนู" /></label>
        <nav className="table-order-categories" aria-label="หมวดหมู่สินค้า">{categories.map((item) => <button className={category === item ? 'active' : ''} key={item} onClick={() => setCategory(item)} type="button">{item}</button>)}</nav>
        <div className="table-order-products">{visibleProducts.map((product) => <button type="button" key={product.id} onClick={() => add(product)}><span>{product.image ? <img src={product.image} alt="" /> : <PackagePlus />}</span><small>{product.category || 'สินค้า'}</small><strong>{product.name}</strong><p>{product.description || 'พร้อมสั่ง'}</p><b>฿{money(product.price)}</b><i><Plus /></i></button>)}</div>
        {!visibleProducts.length && <div className="table-order-empty"><Search /><strong>ไม่พบสินค้าที่ค้นหา</strong></div>}
      </main>}

      {stage === 'review' && <main className="table-order-main review">
        <section className="table-order-review-card"><header><ClipboardList /><div><small>ORDER REVIEW</small><h1>ตรวจสอบรายการ</h1><p>{context.table.name}{context.table.zone ? ` · ${context.table.zone}` : ''}</p></div></header>{cart.map((line) => <div className="table-order-line" key={line.product.id}><span><strong>{line.product.name}</strong><small>฿{money(line.product.price)} / ชิ้น</small></span><div><button type="button" onClick={() => change(line.product.id, -1)}><Minus /></button><b>{line.quantity}</b><button type="button" onClick={() => change(line.product.id, 1)}><Plus /></button></div><strong>฿{money(Number(line.product.price) * line.quantity)}</strong></div>)}<label><span>หมายเหตุถึงร้าน</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={1000} placeholder="เช่น ไม่ใส่ผัก แยกน้ำแข็ง" /></label><footer><span><small>ยอดรวม {itemCount} รายการ</small><strong>฿{money(total)}</strong></span><button type="button" onClick={() => { void submit() }} disabled={submitting}><Send />{submitting ? 'กำลังส่ง...' : 'ส่งออเดอร์'}</button></footer></section>
        {error && <div className="table-order-error" role="alert">{error}</div>}
      </main>}

      {stage === 'success' && createdOrder && <main className="table-order-main success"><section><span><CheckCircle2 /></span><small>ORDER RECEIVED</small><h1>ส่งออเดอร์เรียบร้อย</h1><p>ร้านได้รับรายการแล้ว กรุณารอร้านรับออเดอร์</p><div><small>เลขออเดอร์</small><strong>{createdOrder.orderNumber}</strong><em>{createdOrder.status}</em></div><b>฿{money(createdOrder.total)}</b><button type="button" onClick={() => { setCart([]); setNote(''); setCreatedOrder(null); idempotencyKeyRef.current = ''; setStage('menu') }}>สั่งเพิ่ม</button></section></main>}

      {stage === 'menu' && cart.length > 0 && <button className="table-order-cart" type="button" onClick={() => { setStage('review'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><ShoppingBasket /><span><small>{itemCount} รายการ</small><strong>฿{money(total)}</strong></span><b>ตรวจสอบ <ChevronRight /></b></button>}
    </div>
  )
}

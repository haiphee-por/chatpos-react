import { useState, useEffect } from 'react'
import { generatePromptPayQrDataUrl, getStoredPromptPayId } from './promptpay'
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  QrCode,
  CheckCircle2,
  Clock,
  Utensils,
  BellRing,
  Receipt,
  ChevronRight,
  Upload,
  MapPin,
  Coffee,
  Check
} from 'lucide-react'
import './CustomerView.css'

/* Web Audio API Sound Utility */
const playTapSound = (type: 'pop' | 'click' | 'success' = 'click') => {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime
    if (type === 'pop') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(450, now)
      osc.frequency.exponentialRampToValueAtTime(850, now + 0.08)
      gain.gain.setValueAtTime(0.25, now)
      gain.gain.linearRampToValueAtTime(0.01, now + 0.08)
      osc.start(now)
      osc.stop(now + 0.08)
    } else if (type === 'success') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(523.25, now) // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1) // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2) // G5
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.linearRampToValueAtTime(0.01, now + 0.35)
      osc.start(now)
      osc.stop(now + 0.35)
    } else {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(600, now)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.linearRampToValueAtTime(0.01, now + 0.05)
      osc.start(now)
      osc.stop(now + 0.05)
    }
  } catch (e) {
    // Audio Context fail silent fallback
  }
}

export type CustomerMenuItem = {
  id: string
  name: string
  category: 'drink' | 'bakery' | 'food' | 'special'
  price: number
  description: string
  imgUrl?: string
  tag?: string
  hasOptions?: boolean
}

export type CartOption = {
  sweetness: string
  temperature: 'hot' | 'iced' | 'blended'
  toppings: string[]
  note: string
}

export type CartItem = {
  cartId: string
  menuItem: CustomerMenuItem
  qty: number
  options: CartOption
  unitPrice: number
  totalPrice: number
}

export type OrderStatus = 'received' | 'cooking' | 'ready' | 'completed'

export type SubmittedOrder = {
  id: string
  orderNo: string
  tableNo: string
  items: CartItem[]
  totalAmount: number
  paymentMethod: string
  status: OrderStatus
  timestamp: string
}

const customerMenuData: CustomerMenuItem[] = [
  { id: 'cm-1', name: 'Iced Americano (กาแฟดำเย็น)', category: 'drink', price: 65, description: 'คั่วเข้มหอมกรุ่น สดชื่น เมล็ดอาราบิก้า 100%', tag: 'BEST', hasOptions: true },
  { id: 'cm-2', name: 'Iced Matcha Latte (มัทฉะลาเต้)', category: 'drink', price: 75, description: 'ชาเขียวมัทฉะพรีเมียมจากอูจิ ชงสดชามต่อชาม', tag: 'RECOMMEND', hasOptions: true },
  { id: 'cm-3', name: 'Croissant เนยสดแท้ (Butter Croissant)', category: 'bakery', price: 65, description: 'อบใหม่ร้อนๆ หอมเนยฝรั่งเศส กรอบนอกนุ่มใน', tag: 'FRESH' },
  { id: 'cm-4', name: 'Basque Burnt Cheesecake (ชีสเค้กหน้าไหม้)', category: 'bakery', price: 120, description: 'ชีสเค้กสูตรเข้มข้น เนื้อสัมผัสนุ่มละมุนลิ้น' },
  { id: 'cm-5', name: 'ข้าวกะเพราเนื้อสับไข่ดาวกรอบ', category: 'food', price: 119, description: 'ผัดกะเพราเนื้อโคขุนรสจัดจ้าน เสิร์ฟพร้อมไข่ดาวกรอบ', tag: 'HOT' },
  { id: 'cm-6', name: 'สปาเกตตีคาโบนาร่าแฮมชีส', category: 'food', price: 149, description: 'เส้นเหนียวนุ่ม ซอสครีมชีสเข้มข้นสูตรต้นตำรับ' },
  { id: 'cm-7', name: 'Strawberry Sparking Soda', category: 'drink', price: 70, description: 'สตรอว์เบอร์รีสดผสมโซดาซ่าเย็นชื่นใจ', hasOptions: true },
  { id: 'cm-8', name: 'ชุดเซตชา Afternoon Tea For Two', category: 'special', price: 299, description: 'ชาพรีเมียม 1 กา พร้อมเซตขนมเปติฟูร์ 4 ชนิด', tag: 'SET' }
]

export function CustomerView() {
  const [activeCategory, setActiveCategory] = useState<'all' | 'drink' | 'bakery' | 'food' | 'special'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [selectedMenuItem, setSelectedMenuItem] = useState<CustomerMenuItem | null>(null)
  
  // Customization State for Modal
  const [customSweetness, setCustomSweetness] = useState('หวาน 100% (ปกติ)')
  const [customTemp, setCustomTemp] = useState<'hot' | 'iced' | 'blended'>('iced')
  const [customToppings, setCustomToppings] = useState<string[]>([])
  const [customNote, setCustomNote] = useState('')
  const [customQty, setCustomQty] = useState(1)

  // Checkout & Payment State
  const [paymentMethod, setPaymentMethod] = useState<'promptpay' | 'cash' | 'truemoney'>('promptpay')
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [slipUploaded, setSlipUploaded] = useState(false)
  const [isVerifyingSlip, setIsVerifyingSlip] = useState(false)

  // Menu Catalog Synced with Merchant
  const [menuItems] = useState<CustomerMenuItem[]>(() => {
    const saved = localStorage.getItem('pos_products_catalog')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch (e) {}
    }
    return customerMenuData
  })

  // Order Tracker State (Synced with Merchant)
  const [submittedOrders, setSubmittedOrders] = useState<SubmittedOrder[]>(() => {
    const saved = localStorage.getItem('cust_orders_t01')
    if (saved) {
      try { return JSON.parse(saved) } catch (e) {}
    }
    return []
  })
  const [isTrackerOpen, setIsTrackerOpen] = useState(false)
  const [, setCallStaffSuccess] = useState(false)
  const [customerQrUrl, setCustomerQrUrl] = useState<string>('')

  // Listen to status changes updated by Merchant in real-time
  useEffect(() => {
    const handleMerchantUpdate = () => {
      const savedMerchantOrders = localStorage.getItem('merchant_live_orders')
      if (savedMerchantOrders) {
        try {
          const merchantOrders: SubmittedOrder[] = JSON.parse(savedMerchantOrders)
          const myOrders = merchantOrders.filter(o => o.tableNo === 'โต๊ะ 01')
          if (myOrders.length > 0) {
            setSubmittedOrders(myOrders)
          }
        } catch (e) {}
      }
    }
    window.addEventListener('storage', handleMerchantUpdate)
    const pollInterval = setInterval(handleMerchantUpdate, 2000)
    return () => {
      window.removeEventListener('storage', handleMerchantUpdate)
      clearInterval(pollInterval)
    }
  }, [])

  // Auto progression fallback simulation if no manual merchant action
  useEffect(() => {
    if (submittedOrders.length === 0) return
    const timer = setInterval(() => {
      setSubmittedOrders(prev => {
        return prev.map(order => {
          if (order.status === 'received') return { ...order, status: 'cooking' }
          if (order.status === 'cooking') return { ...order, status: 'ready' }
          return order
        })
      })
    }, 20000)
    return () => clearInterval(timer)
  }, [submittedOrders])

  // Save submitted orders locally and broadcast to Merchant
  useEffect(() => {
    localStorage.setItem('cust_orders_t01', JSON.stringify(submittedOrders))
  }, [submittedOrders])

  // Open Customization Modal
  const handleOpenCustomize = (item: CustomerMenuItem) => {
    playTapSound('pop')
    setSelectedMenuItem(item)
    setCustomSweetness('หวาน 100% (ปกติ)')
    setCustomTemp(item.category === 'drink' ? 'iced' : 'hot')
    setCustomToppings([])
    setCustomNote('')
    setCustomQty(1)
  }

  // Calculate Unit Price based on customization
  const getCustomUnitPrice = () => {
    if (!selectedMenuItem) return 0
    let price = selectedMenuItem.price
    if (customTemp === 'iced') price += 10
    if (customTemp === 'blended') price += 20
    if (customToppings.includes('เพิ่มไข่มุก (+10฿)')) price += 10
    if (customToppings.includes('เพิ่มวิปครีม (+15฿)')) price += 15
    if (customToppings.includes('เพิ่มช็อตเอสเปรสโซ (+15฿)')) price += 15
    return price
  }

  // Add to Cart
  const handleAddToCart = () => {
    if (!selectedMenuItem) return
    playTapSound('success')
    const unitPrice = getCustomUnitPrice()
    const newCartItem: CartItem = {
      cartId: 'cart-' + Date.now(),
      menuItem: selectedMenuItem,
      qty: customQty,
      options: {
        sweetness: customSweetness,
        temperature: customTemp,
        toppings: [...customToppings],
        note: customNote
      },
      unitPrice,
      totalPrice: unitPrice * customQty
    }
    setCart([...cart, newCartItem])
    setSelectedMenuItem(null)
  }

  // Quick Direct Add without options
  const handleQuickAdd = (item: CustomerMenuItem, e: React.MouseEvent) => {
    e.stopPropagation()
    playTapSound('pop')
    const existing = cart.find(c => c.menuItem.id === item.id && c.options.toppings.length === 0 && !c.options.note)
    if (existing) {
      setCart(cart.map(c => c.cartId === existing.cartId ? { ...c, qty: c.qty + 1, totalPrice: c.unitPrice * (c.qty + 1) } : c))
    } else {
      const newCartItem: CartItem = {
        cartId: 'cart-' + Date.now(),
        menuItem: item,
        qty: 1,
        options: { sweetness: 'หวาน 100%', temperature: 'iced', toppings: [], note: '' },
        unitPrice: item.price,
        totalPrice: item.price
      }
      setCart([...cart, newCartItem])
    }
  }

  const handleUpdateQty = (cartId: string, delta: number) => {
    playTapSound('click')
    setCart(
      cart
        .map(item => {
          if (item.cartId === cartId) {
            const nextQty = item.qty + delta
            return nextQty > 0 ? { ...item, qty: nextQty, totalPrice: item.unitPrice * nextQty } : null
          }
          return item
        })
        .filter((item): item is CartItem => item !== null)
    )
  }

  const cartSubtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0)
  const vat = cartSubtotal * 0.07
  const cartTotal = cartSubtotal + vat

  // Generate real PromptPay QR for Customer
  useEffect(() => {
    if (isQrModalOpen && paymentMethod === 'promptpay' && cartTotal > 0) {
      const promptPayId = getStoredPromptPayId('0823456789')
      generatePromptPayQrDataUrl(promptPayId, cartTotal, 260)
        .then(setCustomerQrUrl)
        .catch((err) => console.error('Failed to generate customer PromptPay QR:', err))
    }
  }, [isQrModalOpen, paymentMethod, cartTotal])

  // Submit Order & Sync to Merchant Live Orders!
  const finalizeOrderSubmission = (methodLabel: string) => {
    playTapSound('success')
    const newOrder: SubmittedOrder = {
      id: 'ord-' + Date.now(),
      orderNo: '#' + Math.floor(1000 + Math.random() * 9000),
      tableNo: 'โต๊ะ 01',
      items: [...cart],
      totalAmount: cartTotal,
      paymentMethod: methodLabel,
      status: 'received',
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    }
    const updatedCustOrders = [newOrder, ...submittedOrders]
    setSubmittedOrders(updatedCustOrders)
    localStorage.setItem('cust_orders_t01', JSON.stringify(updatedCustOrders))

    // Broadcast to Merchant Live Orders
    try {
      const existingMerchantOrders: SubmittedOrder[] = JSON.parse(localStorage.getItem('merchant_live_orders') || '[]')
      const updatedMerchantOrders = [newOrder, ...existingMerchantOrders]
      localStorage.setItem('merchant_live_orders', JSON.stringify(updatedMerchantOrders))
      window.dispatchEvent(new Event('storage'))
    } catch (e) {}

    setCart([])
    setIsQrModalOpen(false)
    setIsCartOpen(false)
    setIsTrackerOpen(true)
    setSlipUploaded(false)
  }

  // Handle Slip Upload
  const handleUploadSlip = () => {
    playTapSound('click')
    setIsVerifyingSlip(true)
    setTimeout(() => {
      setIsVerifyingSlip(false)
      setSlipUploaded(true)
      playTapSound('success')
      setTimeout(() => {
        finalizeOrderSubmission('PromptPay QR (สแกนสำเร็จ)')
      }, 1000)
    }, 1500)
  }

  const handleCallStaff = (action: string) => {
    playTapSound('success')
    setCallStaffSuccess(true)
    alert(`🔔 ส่งสัญญาณ "${action}" ไปยังเคาน์เตอร์พนักงานเรียบร้อยแล้ว!`)
    setTimeout(() => setCallStaffSuccess(false), 4000)
  }

  const filteredMenu = menuItems.filter(
    item =>
      (activeCategory === 'all' || item.category === activeCategory) &&
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="cust-app-container">
      {/* 1. Header Banner & Store Info */}
      <header className="cust-header">
        <div className="cust-banner-cover">
          <div className="cust-banner-overlay" />
          <div className="cust-badge-row">
            <span className="cust-table-badge">
              <MapPin size={13} /> 📍 โต๊ะ 01 (โซนริมสวน)
            </span>
            <span className="cust-open-badge">🟢 เปิดให้บริการ</span>
          </div>
        </div>

        <div className="cust-store-card">
          <div className="cust-logo-box">
            <img src="/logo.png" alt="POP CAFE Logo" />
          </div>
          <div className="cust-store-meta">
            <h1>POP CAFE ✨ (สาขาหลัก)</h1>
            <p>ร้านกาแฟสไตล์มินิมอล & อาหารจานด่วนพรีเมียม</p>
            <div className="cust-store-pills">
              <span>☕ เครื่องดื่ม & เบเกอรี่</span>
              <span>⭐ 4.9 (520+ รีวิว)</span>
            </div>
          </div>
        </div>

        {/* Quick Table Action Buttons */}
        <div className="cust-quick-table-actions">
          <button
            type="button"
            className="cust-table-action-btn staff"
            onClick={() => handleCallStaff('เรียกพนักงานที่โต๊ะ')}
          >
            <BellRing size={15} /> เรียกพนักงาน
          </button>
          <button
            type="button"
            className="cust-table-action-btn bill"
            onClick={() => handleCallStaff('ขอเช็คบิล / รับสลิป')}
          >
            <Receipt size={15} /> ขอเช็คบิล
          </button>
          {submittedOrders.length > 0 && (
            <button
              type="button"
              className="cust-table-action-btn tracker"
              onClick={() => { playTapSound('pop'); setIsTrackerOpen(true) }}
            >
              <Clock size={15} /> สถานะอาหาร ({submittedOrders.length})
            </button>
          )}
        </div>
      </header>

      {/* 2. Menu Search & Category Navigation Tabs */}
      <nav className="cust-nav-section">
        <div className="cust-search-box">
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder="ค้นหาชื่อเมนู เช่น มัทฉะ, ครัวซองต์, กะเพรา..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="cust-clear-search" onClick={() => setSearchQuery('')} type="button">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="cust-category-pills">
          <button
            className={`cust-cat-pill ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => { playTapSound('pop'); setActiveCategory('all') }}
            type="button"
          >
            ✨ ทั้งหมด
          </button>
          <button
            className={`cust-cat-pill ${activeCategory === 'drink' ? 'active' : ''}`}
            onClick={() => { playTapSound('pop'); setActiveCategory('drink') }}
            type="button"
          >
            ☕ เครื่องดื่ม
          </button>
          <button
            className={`cust-cat-pill ${activeCategory === 'bakery' ? 'active' : ''}`}
            onClick={() => { playTapSound('pop'); setActiveCategory('bakery') }}
            type="button"
          >
            🥐 เบเกอรี่
          </button>
          <button
            className={`cust-cat-pill ${activeCategory === 'food' ? 'active' : ''}`}
            onClick={() => { playTapSound('pop'); setActiveCategory('food') }}
            type="button"
          >
            🍽️ อาหาร
          </button>
          <button
            className={`cust-cat-pill ${activeCategory === 'special' ? 'active' : ''}`}
            onClick={() => { playTapSound('pop'); setActiveCategory('special') }}
            type="button"
          >
            🎁 เซตพิเศษ
          </button>
        </div>
      </nav>

      {/* 3. Product Catalog Grid */}
      <main className="cust-product-list">
        <div className="cust-grid">
          {filteredMenu.map(item => (
            <div
              key={item.id}
              className="cust-menu-card"
              onClick={() => handleOpenCustomize(item)}
              role="button"
              tabIndex={0}
            >
              {item.tag && <span className={`cust-card-tag ${item.tag.toLowerCase()}`}>{item.tag}</span>}
              <div className="cust-card-media">
                <div className="cust-emoji-icon">
                  {item.category === 'drink' && '☕'}
                  {item.category === 'bakery' && '🥐'}
                  {item.category === 'food' && '🍽️'}
                  {item.category === 'special' && '🎁'}
                </div>
              </div>
              <div className="cust-card-body">
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <div className="cust-card-footer">
                  <strong className="cust-price">฿{item.price}</strong>
                  <button
                    type="button"
                    className="cust-add-btn"
                    onClick={(e) => handleQuickAdd(item, e)}
                  >
                    <Plus size={15} /> สั่ง
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 4. Floating Bottom Sticky Order Bar */}
      {cart.length > 0 && (
        <div className="cust-sticky-bar">
          <div className="cust-sticky-left">
            <div className="cust-cart-badge-count">{cart.reduce((s, i) => s + i.qty, 0)}</div>
            <div>
              <span className="cust-sticky-label">ตะกร้าของคุณ</span>
              <strong className="cust-sticky-price">฿{cartTotal.toFixed(2)}</strong>
            </div>
          </div>
          <button
            type="button"
            className="cust-view-cart-btn"
            onClick={() => { playTapSound('pop'); setIsCartOpen(true) }}
          >
            <span>ดูตะกร้าสินค้า</span> <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* 5. Customization Option Modal */}
      {selectedMenuItem && (
        <div className="qs-modal-overlay" style={{ zIndex: 100010 }}>
          <div className="qs-modal cust-custom-modal">
            <div className="qs-modal-header">
              <div>
                <h3>{selectedMenuItem.name}</h3>
                <p>ปรับแต่งเมนูตามความชอบของคุณ</p>
              </div>
              <button
                aria-label="ปิด"
                className="qs-modal-close"
                onClick={() => setSelectedMenuItem(null)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="qs-modal-body cust-modal-scroll">
              {/* Category-specific options */}
              {selectedMenuItem.category === 'drink' && (
                <>
                  {/* Temperature Selection */}
                  <div className="cust-opt-group">
                    <label>ระดับความเย็น / ร้อน</label>
                    <div className="cust-radio-group">
                      <button
                        type="button"
                        className={`cust-opt-chip ${customTemp === 'hot' ? 'active' : ''}`}
                        onClick={() => setCustomTemp('hot')}
                      >
                        🔥 ร้อน (฿{selectedMenuItem.price})
                      </button>
                      <button
                        type="button"
                        className={`cust-opt-chip ${customTemp === 'iced' ? 'active' : ''}`}
                        onClick={() => setCustomTemp('iced')}
                      >
                        🧊 เย็น (+10฿)
                      </button>
                      <button
                        type="button"
                        className={`cust-opt-chip ${customTemp === 'blended' ? 'active' : ''}`}
                        onClick={() => setCustomTemp('blended')}
                      >
                        🍧 ปั่น (+20฿)
                      </button>
                    </div>
                  </div>

                  {/* Sweetness Selection */}
                  <div className="cust-opt-group">
                    <label>ระดับความหวาน (Sweetness Level)</label>
                    <div className="cust-radio-group vertical">
                      {['หวาน 0% (ไม่หวาน)', 'หวาน 25% (หวานน้อยมาก)', 'หวาน 50% (หวานน้อย)', 'หวาน 100% (ปกติ)'].map(sw => (
                        <button
                          key={sw}
                          type="button"
                          className={`cust-opt-chip full ${customSweetness === sw ? 'active' : ''}`}
                          onClick={() => setCustomSweetness(sw)}
                        >
                          <span>{sw}</span>
                          {customSweetness === sw && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toppings Selection */}
                  <div className="cust-opt-group">
                    <label>ท็อปปิ้งเพิ่มเติม (Toppings)</label>
                    <div className="cust-checkbox-group">
                      {['เพิ่มไข่มุก (+10฿)', 'เพิ่มวิปครีม (+15฿)', 'เพิ่มช็อตเอสเปรสโซ (+15฿)'].map(top => {
                        const isChecked = customToppings.includes(top)
                        return (
                          <button
                            key={top}
                            type="button"
                            className={`cust-opt-chip full ${isChecked ? 'active' : ''}`}
                            onClick={() => {
                              if (isChecked) {
                                setCustomToppings(customToppings.filter(t => t !== top))
                              } else {
                                setCustomToppings([...customToppings, top])
                              }
                            }}
                          >
                            <span>{top}</span>
                            {isChecked && <Check size={14} />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Special Note Input */}
              <div className="cust-opt-group">
                <label>หมายเหตุเพิ่มเติมถึงเชฟ / บาริสต้า</label>
                <input
                  type="text"
                  placeholder="เช่น แยกน้ำแข็ง, ไม่ใส่ผักชี, เผ็ดน้อย..."
                  value={customNote}
                  onChange={e => setCustomNote(e.target.value)}
                  className="cust-note-input"
                />
              </div>

              {/* Quantity Stepper */}
              <div className="cust-qty-row">
                <span>จำนวนชิ้น:</span>
                <div className="cust-qty-stepper">
                  <button type="button" onClick={() => setCustomQty(Math.max(1, customQty - 1))}>
                    <Minus size={14} />
                  </button>
                  <strong>{customQty}</strong>
                  <button type="button" onClick={() => setCustomQty(customQty + 1)}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="qs-modal-footer">
              <button
                type="button"
                className="cust-add-to-cart-btn"
                onClick={handleAddToCart}
              >
                <span>ใส่ตะกร้า</span>
                <strong>฿{(getCustomUnitPrice() * customQty).toFixed(2)}</strong>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Cart Drawer & Checkout Flow */}
      {isCartOpen && (
        <div className="qs-modal-overlay" style={{ zIndex: 100015 }}>
          <div className="qs-modal cust-cart-drawer">
            <div className="qs-modal-header">
              <div className="cust-cart-header-title">
                <ShoppingCart size={20} color="#059669" />
                <div>
                  <h3>ตะกร้าสินค้าของคุณ</h3>
                  <p>📍 โต๊ะ 01 ({cart.reduce((s, i) => s + i.qty, 0)} รายการ)</p>
                </div>
              </div>
              <button
                aria-label="ปิด"
                className="qs-modal-close"
                onClick={() => setIsCartOpen(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="qs-modal-body cust-cart-body">
              {cart.map(item => (
                <div key={item.cartId} className="cust-cart-item-card">
                  <div className="cust-cart-item-header">
                    <div>
                      <h4>{item.menuItem.name}</h4>
                      <small className="cust-cart-options-text">
                        {item.menuItem.category === 'drink' && `${item.options.temperature === 'iced' ? '🧊 เย็น' : item.options.temperature === 'blended' ? '🍧 ปั่น' : '🔥 ร้อน'} · ${item.options.sweetness}`}
                        {item.options.toppings.length > 0 && ` · ${item.options.toppings.join(', ')}`}
                        {item.options.note && ` · 📝 ${item.options.note}`}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="cust-item-delete"
                      onClick={() => handleUpdateQty(item.cartId, -item.qty)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="cust-cart-item-footer">
                    <div className="cust-qty-stepper small">
                      <button type="button" onClick={() => handleUpdateQty(item.cartId, -1)}>
                        <Minus size={12} />
                      </button>
                      <span>{item.qty}</span>
                      <button type="button" onClick={() => handleUpdateQty(item.cartId, 1)}>
                        <Plus size={12} />
                      </button>
                    </div>
                    <strong className="cust-item-total">฿{item.totalPrice.toFixed(2)}</strong>
                  </div>
                </div>
              ))}

              {/* Order Bill Summary */}
              <div className="cust-bill-summary">
                <div className="bill-line">
                  <span>ยอดรวมสินค้า</span>
                  <span>฿{cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="bill-line">
                  <span>ภาษี VAT (7%)</span>
                  <span>฿{vat.toFixed(2)}</span>
                </div>
                <hr />
                <div className="bill-line total">
                  <strong>ยอดชำระสุทธิ ทั้งสิ้น</strong>
                  <strong className="cust-total-green">฿{cartTotal.toFixed(2)}</strong>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="cust-payment-select-box">
                <label>เลือกวิธีชำระเงิน</label>
                <div className="cust-pay-methods">
                  <button
                    type="button"
                    className={`cust-pay-chip ${paymentMethod === 'promptpay' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('promptpay')}
                  >
                    <QrCode size={16} /> สแกน PromptPay QR
                  </button>
                  <button
                    type="button"
                    className={`cust-pay-chip ${paymentMethod === 'cash' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('cash')}
                  >
                    <Coffee size={16} /> จ่ายเงินสด / จ่ายตอนเช็คบิล
                  </button>
                </div>
              </div>
            </div>

            <div className="qs-modal-footer">
              <button
                type="button"
                className="cust-checkout-btn"
                onClick={() => {
                  if (paymentMethod === 'promptpay') {
                    setIsQrModalOpen(true)
                  } else {
                    finalizeOrderSubmission('เงินสด (ชำระตอนเช็คบิล)')
                  }
                }}
              >
                <span>ยืนยันส่งออเดอร์</span>
                <strong>฿{cartTotal.toFixed(2)} <ChevronRight size={16} /></strong>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. PromptPay QR Payment & Slip Upload Modal */}
      {isQrModalOpen && (
        <div className="qs-modal-overlay" style={{ zIndex: 100025 }}>
          <div className="qs-modal cust-qr-pay-modal">
            <div className="qs-modal-header">
              <div>
                <h3>ชำระเงินผ่าน PromptPay QR</h3>
                <p>สแกนผ่านแอปธนาคารใดก็ได้ เพื่อชำระเงิน</p>
              </div>
              <button
                aria-label="ปิด"
                className="qs-modal-close"
                onClick={() => setIsQrModalOpen(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="qs-modal-body text-center">
              <div className="cust-qr-display-card">
                {customerQrUrl ? (
                  <img
                    src={customerQrUrl}
                    alt="PromptPay QR"
                    className="cust-qr-img"
                    style={{ width: '220px', height: '220px', margin: '0 auto', display: 'block', imageRendering: 'pixelated', borderRadius: '12px', background: '#fff', padding: '8px' }}
                  />
                ) : (
                  <img src="/payments/promptpay_front.png" alt="PromptPay QR" className="cust-qr-img" />
                )}
                <div className="cust-qr-price-badge">
                  ยอดชำระสุทธิ: <strong>฿{cartTotal.toFixed(2)}</strong>
                </div>
                <div className="cust-qr-merchant-name">
                  ChatPOS Store (พร้อมเพย์: {getStoredPromptPayId('0823456789')})
                </div>
              </div>

              {/* Slip Upload Area */}
              <div className="cust-slip-upload-area">
                <p>เมื่อโอนเงินเสร็จแล้ว กรุณาแนบสลิปเพื่อยืนยัน:</p>
                {slipUploaded ? (
                  <div className="cust-slip-success-box">
                    <CheckCircle2 size={32} color="#10b981" />
                    <strong>ตรวจสอบสลิปสำเร็จแล้ว!</strong>
                    <span>กำลังนำคุณไปยังหน้าติดตามสถานะอาหาร...</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="cust-upload-slip-btn"
                    disabled={isVerifyingSlip}
                    onClick={handleUploadSlip}
                  >
                    {isVerifyingSlip ? (
                      <span>⏳ กำลังตรวจสอบสลิปอัตโนมัติ...</span>
                    ) : (
                      <>
                        <Upload size={16} /> <span>คลิกเพื่อแนบสลิปโอนเงิน (สแกนตรวจสลิป)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="qs-modal-footer">
              <button
                type="button"
                className="qs-btn-cancel"
                onClick={() => setIsQrModalOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="qs-btn-submit"
                onClick={() => finalizeOrderSubmission('PromptPay QR (ยืนยันแล้ว)')}
              >
                ยืนยันการโอนเงินสำเร็จ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Live Order Status Tracker Drawer */}
      {isTrackerOpen && (
        <div className="qs-modal-overlay" style={{ zIndex: 100030 }}>
          <div className="qs-modal cust-tracker-modal">
            <div className="qs-modal-header">
              <div>
                <h3>สถานะรายการอาหาร (Live Tracker)</h3>
                <p>📍 โต๊ะ 01 · ติดตามความคืบหน้าของออเดอร์</p>
              </div>
              <button
                aria-label="ปิด"
                className="qs-modal-close"
                onClick={() => setIsTrackerOpen(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="qs-modal-body cust-tracker-body">
              {submittedOrders.map(order => (
                <div key={order.id} className="cust-order-tracker-card">
                  <div className="cust-order-tracker-header">
                    <div>
                      <strong>ออเดอร์ {order.orderNo}</strong>
                      <small>สั่งเมื่อ {order.timestamp} น. · {order.paymentMethod}</small>
                    </div>
                    <span className={`cust-status-pill ${order.status}`}>
                      {order.status === 'received' && '📥 รับออเดอร์แล้ว'}
                      {order.status === 'cooking' && '👨‍🍳 กำลังปรุงอาหาร'}
                      {order.status === 'ready' && '🔔 พร้อมเสิร์ฟ'}
                      {order.status === 'completed' && '✅ สำเร็จ'}
                    </span>
                  </div>

                  {/* Visual Timeline Bar */}
                  <div className="cust-timeline-track">
                    <div className={`cust-timeline-step ${order.status === 'received' || order.status === 'cooking' || order.status === 'ready' || order.status === 'completed' ? 'active' : ''}`}>
                      <div className="step-dot">1</div>
                      <span>รับออเดอร์</span>
                    </div>
                    <div className={`cust-timeline-line ${order.status === 'cooking' || order.status === 'ready' || order.status === 'completed' ? 'active' : ''}`} />
                    <div className={`cust-timeline-step ${order.status === 'cooking' || order.status === 'ready' || order.status === 'completed' ? 'active' : ''}`}>
                      <div className="step-dot">2</div>
                      <span>กำลังปรุง</span>
                    </div>
                    <div className={`cust-timeline-line ${order.status === 'ready' || order.status === 'completed' ? 'active' : ''}`} />
                    <div className={`cust-timeline-step ${order.status === 'ready' || order.status === 'completed' ? 'active' : ''}`}>
                      <div className="step-dot">3</div>
                      <span>พร้อมเสิร์ฟ</span>
                    </div>
                  </div>

                  {/* Items List in this order */}
                  <div className="cust-tracker-items-list">
                    {order.items.map((i, idx) => (
                      <div key={idx} className="cust-tracker-item-line">
                        <span>{i.menuItem.name} x{i.qty}</span>
                        <strong>฿{i.totalPrice.toFixed(2)}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="cust-tracker-card-footer">
                    <span>ยอดรวมออเดอร์นี้:</span>
                    <strong>฿{order.totalAmount.toFixed(2)}</strong>
                  </div>
                </div>
              ))}

              {submittedOrders.length === 0 && (
                <div className="cust-empty-tracker">
                  <Utensils size={40} color="#94a3b8" />
                  <p>ยังไม่มีรายการอาหารที่สั่งในเซสชันนี้</p>
                </div>
              )}
            </div>

            <div className="qs-modal-footer">
              <button
                type="button"
                className="qs-btn-cancel"
                onClick={() => setIsTrackerOpen(false)}
              >
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                className="qs-btn-submit"
                onClick={() => handleCallStaff('ขอเช็คบิลรวมทุกออเดอร์')}
              >
                <Receipt size={15} /> สรุปยอดขอเช็คบิล
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

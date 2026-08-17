import { useState, useEffect } from 'react'
import { generatePromptPayQrDataUrl, generateUrlQrDataUrl, getStoredPromptPayId } from './promptpay'
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  CheckCircle2,
  Clock,
  Utensils,
  BellRing,
  Receipt,
  ChevronRight,
  Upload,
  MapPin,
  Check,
  UtensilsCrossed
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

export type PaymentMethodType =
  | 'promptpay'
  | 'truemoney'
  | 'visa_th'
  | 'visa_int'
  | 'wechat'
  | 'linepay'
  | 'alipay'
  | 'shopeepay'

export interface QuickPayChannel {
  id: PaymentMethodType
  name: string
  label: string
  logo: string
  fee: string
  logoClass: string
}

export const quickPayChannels: QuickPayChannel[] = [
  { id: 'promptpay', name: 'PromptPay', label: 'พร้อมเพย์ QR', logo: '/payments/promptpay_front.png', fee: '0%', logoClass: 'pp-logo' },
  { id: 'truemoney', name: 'TrueMoney', label: 'ทรูมันนี่ วอลเล็ท', logo: '/payments/truemoney_front.png', fee: '1.9%', logoClass: 'tm-logo' },
  { id: 'visa_th', name: 'VISA / MC (ไทย)', label: 'บัตรเครดิต/เดบิต ไทย', logo: '/payments/mastercard_visa_combined.png', fee: '2.4%', logoClass: 'visa-logo' },
  { id: 'visa_int', name: 'VISA / MC (ต่างชาติ)', label: 'บัตรเครดิต ต่างประเทศ', logo: '/payments/mastercard_visa_combined.png', fee: '3.5%', logoClass: 'visa-logo' },
  { id: 'wechat', name: 'WeChat Pay', label: 'วีแชทเพย์ QR', logo: '/payments/wechatpay_front.png', fee: '1.6%', logoClass: 'wechat-logo' },
  { id: 'linepay', name: 'LINE Pay', label: 'ไลน์เพย์ QR', logo: '/payments/linepay_front.png', fee: '1.8%', logoClass: 'line-logo' },
  { id: 'alipay', name: 'Alipay', label: 'อาลีเพย์ QR', logo: '/payments/alipay_front.png', fee: '1.6%', logoClass: 'alipay-logo' },
  { id: 'shopeepay', name: 'ShopeePay', label: 'ช้อปปี้เพย์ QR', logo: '/payments/shopeepay_front.png', fee: '1.8%', logoClass: 'shopee-logo' }
]

const customerMenuData: CustomerMenuItem[] = [
  {
    id: 'cm-1',
    name: 'Iced Americano (กาแฟดำเย็น)',
    category: 'drink',
    price: 65,
    description: 'คั่วเข้มหอมกรุ่น สดชื่น เมล็ดอาราบิก้าแท้ 100% สกัดช็อตเข้มข้น',
    tag: 'BEST',
    hasOptions: true,
    imgUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'cm-2',
    name: 'Iced Matcha Latte (มัทฉะลาเต้)',
    category: 'drink',
    price: 75,
    description: 'ชาเขียวมัทฉะแท้เกรดพรีเมียมจากเมืองอูจิ ชงสดชามต่อชาม หอมนุ่มละมุน',
    tag: 'RECOMMEND',
    hasOptions: true,
    imgUrl: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'cm-3',
    name: 'Croissant เนยสดแท้ (Butter Croissant)',
    category: 'bakery',
    price: 65,
    description: 'อบใหม่ร้อนๆ หอมเนยฝรั่งเศสแท้ กรอบนอกนุ่มฟูเป็นชั้นสวยงาม',
    tag: 'FRESH',
    imgUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'cm-4',
    name: 'Basque Burnt Cheesecake (ชีสเค้กหน้าไหม้)',
    category: 'bakery',
    price: 120,
    description: 'ชีสเค้กสูตรต้นตำรับสเปน เนื้อสัมผัสนุ่มเนียนละลายในปาก ครีมชีสเน้นๆ',
    tag: 'POPULAR',
    imgUrl: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'cm-5',
    name: 'ข้าวกะเพราเนื้อสับไข่ดาวกรอบ',
    category: 'food',
    price: 119,
    description: 'ผัดกะเพราเนื้อโคขุนรสจัดจ้าน กลิ่นใบกะเพราหอมฟุ้ง เสิร์ฟพร้อมไข่ดาวกรอบ',
    tag: 'HOT',
    imgUrl: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'cm-6',
    name: 'สปาเกตตีคาโบนาร่าแฮมชีส',
    category: 'food',
    price: 149,
    description: 'เส้นสปาเกตตีเหนียวนุ่ม ซอสครีมชีสพาร์เมซานเข้มข้น พร้อมแฮมรมควันและเบคอนกรอบ',
    tag: 'CHEF PICK',
    imgUrl: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'cm-7',
    name: 'Strawberry Sparking Soda',
    category: 'drink',
    price: 70,
    description: 'เนื้อสตรอว์เบอร์รีสดผสมไซรัปสูตรพิเศษและโซดาซ่า เย็นสดชื่นดับร้อน',
    hasOptions: true,
    imgUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'cm-8',
    name: 'ชุดเซตชา Afternoon Tea For Two',
    category: 'special',
    price: 299,
    description: 'ชาเอิร์ลเกรย์พรีเมียม 1 กา พร้อมเซตเบเกอรี่และของว่างเปติฟูร์ 4 ชนิด',
    tag: 'SET',
    imgUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'cm-9',
    name: 'Caramel Macchiato (คาราเมลมัคคิอาโต้)',
    category: 'drink',
    price: 80,
    description: 'กาแฟเอสเปรสโซเข้มข้น ผสานนมสดนุ่มละมุนและซอสคาราเมลหอมหวาน',
    hasOptions: true,
    imgUrl: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'cm-10',
    name: 'ข้าวผัดต้มยำกุ้งแม่น้ำ',
    category: 'food',
    price: 159,
    description: 'ข้าวผัดเครื่องต้มยำเข้มข้นจัดจ้าน เสิร์ฟพร้อมกุ้งสดตัวโตและมะนาวสด',
    tag: 'SPICY',
    imgUrl: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'cm-11',
    name: 'Fudge Chocolate Brownie (บราวนี่ฟัดจ์)',
    category: 'bakery',
    price: 85,
    description: 'ดาร์กช็อกโกแลตเข้มข้น 70% เนื้อหนึบฉ่ำ อบใหม่หอมฟุ้ง',
    imgUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'cm-12',
    name: 'Espresso ร้อน (Hot Espresso Shot)',
    category: 'drink',
    price: 55,
    description: 'ช็อตกาแฟสกัดสด ครีม่าสีทองหนานุ่ม บอดี้แน่น หอมอโรมา',
    hasOptions: true,
    imgUrl: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=600&auto=format&fit=crop&q=80'
  }
]

export function CustomerView() {
  // Check if current view is a physical Table Order (e.g. /t01, ?table=1) vs Online Catalog / Delivery / Takeaway
  const isTableOrder = (() => {
    try {
      const search = new URLSearchParams(window.location.search)
      if (search.get('table') || search.get('t')) return true
      const pathname = window.location.pathname
      return /^\/t(?:able)?\d+/i.test(pathname) || /^\/c\/table/i.test(pathname) || /^\/t\d+/i.test(pathname)
    } catch (e) {
      return false
    }
  })()

  const isDelivery = (() => {
    try {
      const search = new URLSearchParams(window.location.search)
      return search.get('mode') === 'delivery' || window.location.pathname.includes('delivery')
    } catch (e) {
      return false
    }
  })()

  const isTakeaway = (() => {
    try {
      const search = new URLSearchParams(window.location.search)
      return search.get('mode') === 'takeaway' || window.location.pathname.includes('takeaway')
    } catch (e) {
      return false
    }
  })()

  // Parse dynamic table identifier from URL path (/t1, /t01, /table/3, /c/table-5) or query param (?table=5)
  const [currentTableNo] = useState(() => {
    try {
      const search = new URLSearchParams(window.location.search)
      const tParam = search.get('table') || search.get('t')
      if (tParam) {
        const clean = tParam.replace(/^โต๊ะ\s*/i, '').trim()
        return `โต๊ะ ${clean.padStart(2, '0')}`
      }
      const pathname = window.location.pathname
      const match = pathname.match(/\/t(?:able)?(?:[-/]|(\d+)|([A-Za-z0-9]+))/)
      if (match) {
        const extracted = match[1] || match[2] || pathname.split('/t')[1] || '01'
        const clean = extracted.replace(/^[-/]|โต๊ะ\s*/i, '').trim()
        return `โต๊ะ ${clean.padStart(2, '0')}`
      }
      if (pathname.includes('delivery')) return 'เดลิเวอรี (Delivery)'
      if (pathname.includes('takeaway')) return 'สั่งกลับบ้าน (Takeaway)'
    } catch (e) {}
    return 'สั่งออนไลน์ (Catalog)'
  })

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('promptpay')
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [slipUploaded, setSlipUploaded] = useState(false)
  const [isVerifyingSlip, setIsVerifyingSlip] = useState(false)

  // Menu Catalog Synced with Merchant & populated with rich images
  const [menuItems] = useState<CustomerMenuItem[]>(() => {
    const saved = localStorage.getItem('pos_products_catalog')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any, idx: number) => ({
            ...item,
            imgUrl: item.imgUrl || item.image || customerMenuData[idx % customerMenuData.length]?.imgUrl
          }))
        }
      } catch (e) {}
    }
    return customerMenuData
  })

  // Order Tracker State (Synced with Merchant)
  const [submittedOrders, setSubmittedOrders] = useState<SubmittedOrder[]>(() => {
    const saved = localStorage.getItem(`cust_orders_${currentTableNo}`)
    if (saved) {
      try { return JSON.parse(saved) } catch (e) {}
    }
    return []
  })
  const [isTrackerOpen, setIsTrackerOpen] = useState(false)
  const [customerQrUrl, setCustomerQrUrl] = useState<string>('')

  // Staff Calling Modal & Live Status
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false)
  const [selectedStaffReason, setSelectedStaffReason] = useState('💧 เติมน้ำเปล่า / ขอเพิ่มน้ำแข็ง')
  const [customStaffNote, setCustomStaffNote] = useState('')
  const [activeStaffCall, setActiveStaffCall] = useState<{ id: string; reason: string; timestamp: string; status: string } | null>(() => {
    try {
      const saved = localStorage.getItem(`active_staff_call_${currentTableNo}`)
      return saved ? JSON.parse(saved) : null
    } catch (e) {
      return null
    }
  })

  // Bill Checkout Modal States
  const [isBillModalOpen, setIsBillModalOpen] = useState(false)
  const [billPayChannel, setBillPayChannel] = useState<PaymentMethodType>('promptpay')
  const [billQrDataUrl, setBillQrDataUrl] = useState('')
  const [billSlipUploaded, setBillSlipUploaded] = useState(false)
  const [isVerifyingBillSlip, setIsVerifyingBillSlip] = useState(false)
  const [billSuccess, setBillSuccess] = useState(false)

  // Delivery Specific State & Address Modal
  const [deliveryReceiverName, setDeliveryReceiverName] = useState('คุณลูกค้า')
  const [deliveryPhone, setDeliveryPhone] = useState('081-234-5678')
  const [deliveryAddress, setDeliveryAddress] = useState('128/45 ซอยสุขุมวิท 24 แขวงคลองตัน เขตคลองเตย กรุงเทพฯ 10110')
  const [deliveryRiderNote, setDeliveryRiderNote] = useState('ฝากไว้ที่ป้อมยาม / โทรแจ้งก่อนส่ง')
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false)

  // Floating In-App Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; icon?: string; type?: 'info' | 'success' | 'warning' } | null>(null)

  const showToast = (text: string, icon = '🔔', type: 'info' | 'success' | 'warning' = 'success') => {
    setToastMessage({ text, icon, type })
    setTimeout(() => {
      setToastMessage(null)
    }, 4500)
  }

  // Listen to status changes updated by Merchant in real-time
  useEffect(() => {
    const handleMerchantUpdate = () => {
      const savedMerchantOrders = localStorage.getItem('merchant_live_orders')
      if (savedMerchantOrders) {
        try {
          const merchantOrders: SubmittedOrder[] = JSON.parse(savedMerchantOrders)
          const myOrders = merchantOrders.filter(o => o.tableNo === currentTableNo)
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
  }, [currentTableNo])

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
    localStorage.setItem(`cust_orders_${currentTableNo}`, JSON.stringify(submittedOrders))
  }, [submittedOrders, currentTableNo])

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
  const deliveryFee = isDelivery && cart.length > 0 ? 40 : 0
  const vat = (cartSubtotal + deliveryFee) * 0.07
  const cartTotal = cartSubtotal + deliveryFee + vat

  // Generate real dynamic QR for Customer Cart Checkout
  useEffect(() => {
    if (isQrModalOpen && cartTotal > 0) {
      if (paymentMethod === 'promptpay') {
        const promptPayId = getStoredPromptPayId('0823456789')
        generatePromptPayQrDataUrl(promptPayId, cartTotal, 260)
          .then(setCustomerQrUrl)
          .catch((err) => console.error('Failed to generate customer PromptPay QR:', err))
      } else {
        const channelUrl = `https://chatpos.link/pay/${paymentMethod}?amt=${cartTotal.toFixed(2)}&table=${encodeURIComponent(currentTableNo)}`
        generateUrlQrDataUrl(channelUrl, 260)
          .then(setCustomerQrUrl)
          .catch((err) => console.error('Failed to generate customer channel QR:', err))
      }
    }
  }, [isQrModalOpen, paymentMethod, cartTotal, currentTableNo])

  // Submit Order & Sync to Merchant Live Orders!
  const finalizeOrderSubmission = (methodLabel: string) => {
    playTapSound('success')
    const newOrder: SubmittedOrder = {
      id: 'ord-' + Date.now(),
      orderNo: '#' + Math.floor(1000 + Math.random() * 9000),
      tableNo: currentTableNo,
      items: [...cart],
      totalAmount: cartTotal,
      paymentMethod: methodLabel,
      status: 'received',
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    }
    const updatedCustOrders = [newOrder, ...submittedOrders]
    setSubmittedOrders(updatedCustOrders)
    localStorage.setItem(`cust_orders_${currentTableNo}`, JSON.stringify(updatedCustOrders))

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
        finalizeOrderSubmission(`${quickPayChannels.find(c => c.id === paymentMethod)?.name} (สแกนสำเร็จ)`)
      }, 1000)
    }, 1500)
  }

  // Total Table Orders Amount (submitted orders + pending items if none)
  const tableOrdersTotal = submittedOrders.reduce((sum, ord) => sum + ord.totalAmount, 0)

  // Generate QR for whole table bill
  useEffect(() => {
    if (isBillModalOpen) {
      const effectiveAmount = tableOrdersTotal > 0 ? tableOrdersTotal : cartTotal
      if (effectiveAmount > 0) {
        if (billPayChannel === 'promptpay') {
          const promptPayId = getStoredPromptPayId('0823456789')
          generatePromptPayQrDataUrl(promptPayId, effectiveAmount, 260)
            .then(setBillQrDataUrl)
            .catch((err) => console.error('Failed to generate table bill QR:', err))
        } else {
          const channelUrl = `https://chatpos.link/pay/${billPayChannel}?amt=${effectiveAmount.toFixed(2)}&table=${encodeURIComponent(currentTableNo)}`
          generateUrlQrDataUrl(channelUrl, 260)
            .then(setBillQrDataUrl)
            .catch((err) => console.error('Failed to generate table channel QR:', err))
        }
      }
    }
  }, [isBillModalOpen, billPayChannel, tableOrdersTotal, cartTotal, currentTableNo])

  // Call Staff Actions
  const handleConfirmCallStaff = () => {
    playTapSound('success')
    const finalReason = selectedStaffReason === '❓ อื่นๆ (ระบุข้อความ)'
      ? (customStaffNote.trim() || 'เรียกพนักงานที่โต๊ะ')
      : selectedStaffReason

    const callObj = {
      id: 'call-' + Date.now(),
      tableNo: currentTableNo,
      reason: finalReason,
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      status: 'calling'
    }

    setActiveStaffCall(callObj)
    localStorage.setItem(`active_staff_call_${currentTableNo}`, JSON.stringify(callObj))

    // Broadcast to Merchant Service Calls
    try {
      const calls = JSON.parse(localStorage.getItem('merchant_service_calls') || '[]')
      const updatedCalls = [callObj, ...calls.filter((c: any) => c.tableNo !== currentTableNo)]
      localStorage.setItem('merchant_service_calls', JSON.stringify(updatedCalls))
      window.dispatchEvent(new Event('storage'))
    } catch (e) {}

    setIsStaffModalOpen(false)
    showToast(`ส่งสัญญาณ "${finalReason}" เรียบร้อยแล้ว พนักงานกำลังมาที่ ${currentTableNo}`, '🔔', 'success')
  }

  const handleCancelStaffCall = () => {
    playTapSound('click')
    setActiveStaffCall(null)
    localStorage.removeItem(`active_staff_call_${currentTableNo}`)
    try {
      const calls = JSON.parse(localStorage.getItem('merchant_service_calls') || '[]')
      const updatedCalls = calls.filter((c: any) => c.tableNo !== currentTableNo)
      localStorage.setItem('merchant_service_calls', JSON.stringify(updatedCalls))
      window.dispatchEvent(new Event('storage'))
    } catch (e) {}
    showToast(`ยกเลิกการเรียกพนักงานแล้ว`, 'ℹ️', 'info')
  }

  // Bill Payment Actions
  const handleConfirmBillPayment = () => {
    playTapSound('success')
    setBillSuccess(true)
    const effectiveAmount = tableOrdersTotal > 0 ? tableOrdersTotal : cartTotal

    try {
      const billNotice = {
        id: 'bill-' + Date.now(),
        tableNo: currentTableNo,
        amount: effectiveAmount,
        channel: billPayChannel,
        status: billPayChannel === 'promptpay' ? 'paid' : 'requesting_staff',
        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      }
      const existing = JSON.parse(localStorage.getItem('merchant_bill_requests') || '[]')
      localStorage.setItem('merchant_bill_requests', JSON.stringify([billNotice, ...existing]))

      if (billPayChannel === 'promptpay') {
        const updated = submittedOrders.map(o => ({ ...o, status: 'completed' as OrderStatus }))
        setSubmittedOrders(updated)
        localStorage.setItem(`cust_orders_${currentTableNo}`, JSON.stringify(updated))
      }
      window.dispatchEvent(new Event('storage'))
    } catch (e) {}

    showToast(
      `ชำระเงินผ่าน ${quickPayChannels.find(c => c.id === billPayChannel)?.label} เรียบร้อยแล้ว ขอบคุณที่ใช้บริการครับ!`,
      '🧾',
      'success'
    )
  }

  const filteredMenu = menuItems.filter(
    item =>
      (activeCategory === 'all' || item.category === activeCategory) &&
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="cust-app-container">
      {/* Interactive Toast Notification Banner */}
      {toastMessage && (
        <div className={`cust-live-toast ${toastMessage.type || 'success'}`}>
          <span className="toast-icon">{toastMessage.icon}</span>
          <span className="toast-text">{toastMessage.text}</span>
          <button type="button" className="toast-close" onClick={() => setToastMessage(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* 1. Header Banner & Store Info */}
      <header className="cust-header">
        <div className="cust-banner-cover">
          <img
            src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&auto=format&fit=crop&q=80"
            alt="POP CAFE Cover Atmosphere"
            className="cust-banner-img"
          />
          <div className="cust-banner-overlay" />
          <div className="cust-badge-row">
            <span className="cust-table-badge">
              {isTableOrder ? (
                <>
                  <MapPin size={13} /> 📍 {currentTableNo} (โซนริมสวน)
                </>
              ) : isDelivery ? (
                <>
                  <MapPin size={13} /> 🛵 เดลิเวอรี (จัดส่งถึงบ้าน)
                </>
              ) : isTakeaway ? (
                <>
                  <MapPin size={13} /> 🛍️ สั่งกลับบ้าน (Takeaway)
                </>
              ) : (
                <>
                  <MapPin size={13} /> 📖 แค็ตตาล็อกสินค้าออนไลน์
                </>
              )}
            </span>
            <span className="cust-open-badge">🟢 เปิดให้บริการ</span>
          </div>
        </div>

        <div className="cust-store-card">
          <div className="cust-logo-box">
            <img
              src="https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80"
              alt="POP CAFE Store Profile"
              className="cust-profile-img"
            />
            <div className="cust-verified-badge" title="ร้านค้าทางการยืนยันแล้ว">✓</div>
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

        {/* Quick Table / Store Action Buttons */}
        <div className="cust-quick-table-actions">
          {isTableOrder ? (
            <>
              {activeStaffCall ? (
                <button
                  type="button"
                  className="cust-table-action-btn staff calling"
                  onClick={handleCancelStaffCall}
                  title="คลิกเพื่อยกเลิกการเรียก"
                >
                  <div className="cust-action-pulse-dot" />
                  <BellRing size={16} className="cust-action-bell-animate" />
                  <div className="cust-action-text-col">
                    <span className="cust-action-title">พนักงานกำลังมา</span>
                    <span className="cust-action-sub">{activeStaffCall.reason} (แตะเพื่อยกเลิก)</span>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  className="cust-table-action-btn staff"
                  onClick={() => { playTapSound('pop'); setIsStaffModalOpen(true) }}
                >
                  <BellRing size={16} />
                  <div className="cust-action-text-col">
                    <span className="cust-action-title">เรียกพนักงาน</span>
                    <span className="cust-action-sub">น้ำ / ช้อนส้อม / บริการ</span>
                  </div>
                </button>
              )}

              <button
                type="button"
                className={`cust-table-action-btn bill ${tableOrdersTotal > 0 ? 'has-total' : ''}`}
                onClick={() => {
                  playTapSound('pop')
                  setIsBillModalOpen(true)
                  setBillSuccess(false)
                  setBillSlipUploaded(false)
                }}
              >
                <Receipt size={16} />
                <div className="cust-action-text-col">
                  <span className="cust-action-title">ขอเช็คบิล</span>
                  <span className="cust-action-sub">
                    {tableOrdersTotal > 0 ? `ยอดรวม ฿${tableOrdersTotal.toFixed(2)}` : 'เช็คยอด / ชำระเงิน'}
                  </span>
                </div>
              </button>

              {submittedOrders.length > 0 && (
                <button
                  type="button"
                  className="cust-table-action-btn tracker"
                  onClick={() => { playTapSound('pop'); setIsTrackerOpen(true) }}
                >
                  <Clock size={16} />
                  <div className="cust-action-text-col">
                    <span className="cust-action-title">สถานะอาหาร</span>
                    <span className="cust-action-sub">{submittedOrders.length} ออเดอร์</span>
                  </div>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className={`cust-table-action-btn bill ${cart.length > 0 ? 'has-total' : ''}`}
                onClick={() => {
                  playTapSound('pop')
                  setIsCartOpen(true)
                }}
              >
                <ShoppingCart size={16} />
                <div className="cust-action-text-col">
                  <span className="cust-action-title">ตะกร้าสินค้า</span>
                  <span className="cust-action-sub">
                    {cart.length > 0 ? `${cart.reduce((s, i) => s + i.qty, 0)} รายการ (฿${cartTotal.toFixed(2)})` : 'ยังไม่มีสินค้า'}
                  </span>
                </div>
              </button>

              {submittedOrders.length > 0 && (
                <button
                  type="button"
                  className="cust-table-action-btn tracker"
                  onClick={() => { playTapSound('pop'); setIsTrackerOpen(true) }}
                >
                  <Clock size={16} />
                  <div className="cust-action-text-col">
                    <span className="cust-action-title">ประวัติคำสั่งซื้อ</span>
                    <span className="cust-action-sub">{submittedOrders.length} ออเดอร์</span>
                  </div>
                </button>
              )}
            </>
          )}
        </div>

        {/* Delivery Address Pill Bar */}
        {isDelivery && (
          <div className="cust-delivery-info-bar" onClick={() => { playTapSound('pop'); setIsAddressModalOpen(true) }}>
            <div className="cust-deliv-icon-pill">🛵</div>
            <div className="cust-deliv-details-col">
              <div className="cust-deliv-line1">
                <strong>จัดส่งถึง: {deliveryReceiverName}</strong>
                <span>({deliveryPhone})</span>
              </div>
              <p className="cust-deliv-line2">{deliveryAddress}</p>
            </div>
            <button type="button" className="cust-deliv-edit-btn">แก้ไขที่อยู่ ›</button>
          </div>
        )}
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
                {item.imgUrl ? (
                  <img
                    src={item.imgUrl}
                    alt={item.name}
                    className="cust-card-img"
                    loading="lazy"
                  />
                ) : (
                  <div className="cust-emoji-icon">
                    {item.category === 'drink' && '☕'}
                    {item.category === 'bakery' && '🥐'}
                    {item.category === 'food' && '🍽️'}
                    {item.category === 'special' && '🎁'}
                  </div>
                )}
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

            {selectedMenuItem.imgUrl && (
              <div className="cust-modal-img-banner">
                <img src={selectedMenuItem.imgUrl} alt={selectedMenuItem.name} />
              </div>
            )}

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
                  <p>📍 {currentTableNo} ({cart.reduce((s, i) => s + i.qty, 0)} รายการ)</p>
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
                    <div className="cust-cart-item-main-info">
                      {item.menuItem.imgUrl && (
                        <img
                          src={item.menuItem.imgUrl}
                          alt={item.menuItem.name}
                          className="cust-cart-thumb"
                        />
                      )}
                      <div>
                        <h4>{item.menuItem.name}</h4>
                        <small className="cust-cart-options-text">
                          {item.menuItem.category === 'drink' && `${item.options.temperature === 'iced' ? '🧊 เย็น' : item.options.temperature === 'blended' ? '🍧 ปั่น' : '🔥 ร้อน'} · ${item.options.sweetness}`}
                          {item.options.toppings.length > 0 && ` · ${item.options.toppings.join(', ')}`}
                          {item.options.note && ` · 📝 ${item.options.note}`}
                        </small>
                      </div>
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

              {/* Delivery Recipient Details Box */}
              {isDelivery && (
                <div className="cust-delivery-summary-box">
                  <div className="cust-deliv-box-header">
                    <div className="cust-deliv-title-row">
                      <span>🛵</span>
                      <strong>ที่อยู่จัดส่งเดลิเวอรี</strong>
                    </div>
                    <button type="button" onClick={() => setIsAddressModalOpen(true)}>
                      แก้ไข
                    </button>
                  </div>
                  <div className="cust-deliv-box-body">
                    <div className="cust-deliv-box-name">{deliveryReceiverName} · {deliveryPhone}</div>
                    <p className="cust-deliv-box-addr">{deliveryAddress}</p>
                    {deliveryRiderNote && <small className="cust-deliv-box-note">📝 {deliveryRiderNote}</small>}
                  </div>
                </div>
              )}

              {/* Order Bill Summary */}
              <div className="cust-bill-summary">
                <div className="bill-line">
                  <span>ยอดรวมสินค้า</span>
                  <span>฿{cartSubtotal.toFixed(2)}</span>
                </div>
                {isDelivery && (
                  <div className="bill-line">
                    <span>ค่าจัดส่งเดลิเวอรี (Delivery)</span>
                    <span>฿{deliveryFee.toFixed(2)}</span>
                  </div>
                )}
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

              {/* Payment Method Selector (QuickPay 8 Channels) */}
              <div className="cust-quickpay-channels-box">
                <div className="cust-quickpay-header">
                  <label>เลือกวิธีชำระเงิน</label>
                  <span className="cust-fee-badge">
                    ค่าธรรมเนียม {quickPayChannels.find(c => c.id === paymentMethod)?.fee}
                  </span>
                </div>
                <div className="cust-quickpay-grid">
                  {quickPayChannels.map(ch => (
                    <button
                      key={ch.id}
                      type="button"
                      className={`cust-method-btn ${paymentMethod === ch.id ? 'active' : ''}`}
                      onClick={() => {
                        playTapSound('click')
                        setPaymentMethod(ch.id)
                      }}
                      title={ch.label}
                    >
                      {paymentMethod === ch.id && <span className="cust-check-badge">✓</span>}
                      <div className="cust-logo-inner">
                        <img src={ch.logo} alt={ch.name} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="qs-modal-footer">
              <button
                type="button"
                className="cust-checkout-btn"
                onClick={() => {
                  setIsQrModalOpen(true)
                }}
              >
                <span>ยืนยันส่งออเดอร์ ({quickPayChannels.find(c => c.id === paymentMethod)?.name})</span>
                <strong>฿{cartTotal.toFixed(2)} <ChevronRight size={16} /></strong>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. QuickPay Dynamic QR Payment & Slip Upload Modal */}
      {isQrModalOpen && (
        <div className="qs-modal-overlay" style={{ zIndex: 100025 }}>
          <div className="qs-modal cust-qr-pay-modal">
            <div className="qs-modal-header">
              <div>
                <h3>ชำระเงินผ่าน {quickPayChannels.find(c => c.id === paymentMethod)?.name}</h3>
                <p>สแกน QR เพื่อชำระเงินตามยอดออเดอร์</p>
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
                <div className="cust-selected-provider-pill">
                  <img
                    src={quickPayChannels.find(c => c.id === paymentMethod)?.logo}
                    alt="Provider Logo"
                    className="cust-provider-small-logo"
                  />
                  <span>ชำระผ่าน {quickPayChannels.find(c => c.id === paymentMethod)?.label}</span>
                </div>

                {customerQrUrl ? (
                  <img
                    src={customerQrUrl}
                    alt="Payment QR"
                    className="cust-qr-img"
                    style={{ width: '210px', height: '210px', margin: '0 auto', display: 'block', imageRendering: 'pixelated', borderRadius: '12px', background: '#fff', padding: '8px' }}
                  />
                ) : (
                  <img src={quickPayChannels.find(c => c.id === paymentMethod)?.logo} alt="Payment QR" className="cust-qr-img" />
                )}
                <div className="cust-qr-price-badge">
                  ยอดชำระสุทธิ: <strong>฿{cartTotal.toFixed(2)}</strong>
                </div>
                <div className="cust-qr-merchant-name">
                  {paymentMethod === 'promptpay'
                    ? `ChatPOS Store (พร้อมเพย์: ${getStoredPromptPayId('0823456789')})`
                    : `ร้านค้าทางการ ChatPOS (${quickPayChannels.find(c => c.id === paymentMethod)?.name})`}
                </div>
              </div>

              {/* Slip Upload Area */}
              <div className="cust-slip-upload-area">
                <p>เมื่อชำระเงินเสร็จแล้ว กรุณาแนบสลิปเพื่อยืนยัน:</p>
                {slipUploaded ? (
                  <div className="cust-slip-success-box">
                    <CheckCircle2 size={32} color="#10b981" />
                    <strong>ตรวจสอบการชำระเงินสำเร็จแล้ว!</strong>
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
                        <Upload size={16} /> <span>แนบสลิปเพื่อยืนยันการชำระเงิน</span>
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
                onClick={() => finalizeOrderSubmission(`${quickPayChannels.find(c => c.id === paymentMethod)?.name} (ชำระแล้ว)`)}
              >
                ยืนยันการชำระเงินสำเร็จ
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
                <p>📍 {currentTableNo} · ติดตามความคืบหน้าของออเดอร์</p>
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
                onClick={() => {
                  setIsTrackerOpen(false)
                  setIsBillModalOpen(true)
                }}
              >
                <Receipt size={15} /> สรุปยอดขอเช็คบิล
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Staff Assistance Service Call Modal */}
      {isStaffModalOpen && (
        <div className="qs-modal-overlay" style={{ zIndex: 100035 }}>
          <div className="qs-modal cust-staff-modal">
            <div className="qs-modal-header">
              <div className="cust-staff-modal-title">
                <div className="cust-staff-icon-circle">
                  <BellRing size={20} color="#d97706" />
                </div>
                <div>
                  <h3>เรียกพนักงาน ({currentTableNo})</h3>
                  <p>เลือกหัวข้อที่ต้องการให้พนักงานช่วยเหลือ</p>
                </div>
              </div>
              <button
                aria-label="ปิด"
                className="qs-modal-close"
                onClick={() => setIsStaffModalOpen(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="qs-modal-body cust-staff-body">
              <div className="cust-staff-reasons-grid">
                {[
                  { icon: '💧', label: 'เติมน้ำเปล่า / ขอเพิ่มน้ำแข็ง' },
                  { icon: '🥢', label: 'ขอจาน / ช้อนส้อม / ทิชชู่เพิ่ม' },
                  { icon: '🧹', label: 'ช่วยเช็ด / ทำความสะอาดโต๊ะ' },
                  { icon: '📋', label: 'สั่งอาหารเพิ่ม / สอบถามเมนู' },
                  { icon: '❓', label: 'อื่นๆ (ระบุข้อความ)' }
                ].map(r => (
                  <button
                    key={r.label}
                    type="button"
                    className={`cust-staff-reason-btn ${selectedStaffReason === r.label ? 'active' : ''}`}
                    onClick={() => {
                      playTapSound('click')
                      setSelectedStaffReason(r.label)
                    }}
                  >
                    <span className="reason-icon">{r.icon}</span>
                    <span className="reason-label">{r.label}</span>
                    {selectedStaffReason === r.label && <Check size={16} className="reason-check" />}
                  </button>
                ))}
              </div>

              {selectedStaffReason === 'อื่นๆ (ระบุข้อความ)' && (
                <div className="cust-staff-custom-note">
                  <label>ระบุข้อความถึงพนักงาน</label>
                  <input
                    type="text"
                    placeholder="เช่น ขอเก้าอี้เด็กเพิ่ม 1 ตัว..."
                    value={customStaffNote}
                    onChange={e => setCustomStaffNote(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
            </div>

            <div className="qs-modal-footer cust-staff-footer">
              <button
                type="button"
                className="qs-btn-cancel"
                onClick={() => setIsStaffModalOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="cust-staff-submit-btn"
                onClick={handleConfirmCallStaff}
              >
                <BellRing size={16} /> ส่งสัญญาณเรียกพนักงาน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Table Bill & Checkout Modal */}
      {isBillModalOpen && (
        <div className="qs-modal-overlay" style={{ zIndex: 100035 }}>
          <div className="qs-modal cust-bill-modal">
            <div className="qs-modal-header">
              <div className="cust-bill-modal-title">
                <div className="cust-bill-icon-circle">
                  <Receipt size={20} color="#2563eb" />
                </div>
                <div>
                  <h3>สรุปบิล & ชำระเงิน ({currentTableNo})</h3>
                  <p>รายการอาหารและยอดชำระทั้งหมดของโต๊ะ</p>
                </div>
              </div>
              <button
                aria-label="ปิด"
                className="qs-modal-close"
                onClick={() => {
                  setIsBillModalOpen(false)
                  setBillSuccess(false)
                  setBillSlipUploaded(false)
                }}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="qs-modal-body cust-bill-body">
              {submittedOrders.length === 0 && cart.length === 0 ? (
                <div className="cust-empty-bill-state">
                  <UtensilsCrossed size={48} color="#cbd5e1" />
                  <h4>ยังไม่มีรายการสั่งอาหารที่โต๊ะนี้</h4>
                  <p>คุณสามารถเลือกดูเมนูและสั่งอาหารผ่านหน้าร้านออนไลน์ได้เลยครับ</p>
                  <button
                    type="button"
                    className="cust-explore-btn"
                    onClick={() => setIsBillModalOpen(false)}
                  >
                    เลือกดูเมนูอาหาร
                  </button>
                </div>
              ) : billSuccess ? (
                <div className="cust-bill-success-view">
                  <div className="cust-success-ring">
                    <CheckCircle2 size={56} color="#059669" />
                  </div>
                  <h3>
                    ชำระเงินสำเร็จเรียบร้อยแล้ว!
                  </h3>
                  <p>
                    ขอบคุณที่อุดหนุน POP CAFE โต๊ะ {currentTableNo}
                  </p>
                  <div className="cust-bill-receipt-card">
                    <div className="receipt-row">
                      <span>โต๊ะ / โซน:</span>
                      <strong>{currentTableNo} (ริมสวน)</strong>
                    </div>
                    <div className="receipt-row">
                      <span>ยอดชำระทั้งสิ้น:</span>
                      <strong className="green">฿{(tableOrdersTotal || cartTotal).toFixed(2)}</strong>
                    </div>
                    <div className="receipt-row">
                      <span>ช่องทางชำระเงิน:</span>
                      <span>
                        {quickPayChannels.find(c => c.id === billPayChannel)?.label}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="cust-bill-done-btn"
                    onClick={() => {
                      setIsBillModalOpen(false)
                      setBillSuccess(false)
                    }}
                  >
                    ปิดหน้านี้
                  </button>
                </div>
              ) : (
                <>
                  {/* Orders Breakdown */}
                  <div className="cust-bill-orders-list">
                    <h4>รายการออเดอร์ของโต๊ะ</h4>
                    {submittedOrders.length > 0 ? (
                      submittedOrders.map(order => (
                        <div key={order.id} className="cust-bill-order-group">
                          <div className="order-group-head">
                            <span className="order-no">{order.orderNo}</span>
                            <span className="order-time">{order.timestamp} น.</span>
                            <span className={`order-status-badge ${order.status}`}>
                              {order.status === 'received' && 'รับแล้ว'}
                              {order.status === 'cooking' && 'กำลังทำ'}
                              {order.status === 'ready' && 'พร้อมเสิร์ฟ'}
                              {order.status === 'completed' && 'ชำระแล้ว'}
                            </span>
                          </div>
                          <div className="order-group-items">
                            {order.items.map(item => (
                              <div key={item.cartId} className="bill-item-line">
                                <span className="item-name">
                                  {item.menuItem.name} × {item.qty}
                                </span>
                                <span className="item-price">฿{item.totalPrice.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="cust-bill-order-group">
                        <div className="order-group-head">
                          <span className="order-no">ตะกร้าปัจจุบัน</span>
                          <span className="order-status-badge received">ยังไม่ได้สั่ง</span>
                        </div>
                        <div className="order-group-items">
                          {cart.map(item => (
                            <div key={item.cartId} className="bill-item-line">
                              <span className="item-name">
                                {item.menuItem.name} × {item.qty}
                              </span>
                              <span className="item-price">฿{item.totalPrice.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Grand Bill Summary */}
                  <div className="cust-bill-total-card">
                    <div className="total-row">
                      <span>ยอดรวมอาหาร</span>
                      <span>฿{((tableOrdersTotal || cartTotal) / 1.07).toFixed(2)}</span>
                    </div>
                    <div className="total-row">
                      <span>ภาษีมูลค่าเพิ่ม VAT (7%)</span>
                      <span>฿{((tableOrdersTotal || cartTotal) - (tableOrdersTotal || cartTotal) / 1.07).toFixed(2)}</span>
                    </div>
                    <div className="total-row grand">
                      <strong>ยอดชำระสุทธิ (Grand Total)</strong>
                      <strong className="grand-price">฿{(tableOrdersTotal || cartTotal).toFixed(2)}</strong>
                    </div>
                  </div>

                  {/* Payment Channel Selector (QuickPay 8 Channels) */}
                  <div className="cust-quickpay-channels-box">
                    <div className="cust-quickpay-header">
                      <label>เลือกวิธีชำระเงินที่โต๊ะ</label>
                      <span className="cust-fee-badge">
                        ค่าธรรมเนียม {quickPayChannels.find(c => c.id === billPayChannel)?.fee}
                      </span>
                    </div>
                    <div className="cust-quickpay-grid">
                      {quickPayChannels.map(ch => (
                        <button
                          key={ch.id}
                          type="button"
                          className={`cust-method-btn ${billPayChannel === ch.id ? 'active' : ''}`}
                          onClick={() => {
                            playTapSound('click')
                            setBillPayChannel(ch.id)
                          }}
                          title={ch.label}
                        >
                          {billPayChannel === ch.id && <span className="cust-check-badge">✓</span>}
                          <div className="cust-logo-inner">
                            <img src={ch.logo} alt={ch.name} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic QR Box for Selected Channel */}
                  <div className="cust-bill-qr-box">
                    <div className="cust-selected-provider-pill">
                      <img
                        src={quickPayChannels.find(c => c.id === billPayChannel)?.logo}
                        alt="Provider Logo"
                        className="cust-provider-small-logo"
                      />
                      <span>ชำระผ่าน {quickPayChannels.find(c => c.id === billPayChannel)?.label}</span>
                    </div>

                    {billQrDataUrl ? (
                      <div className="cust-qr-wrapper">
                        <img src={billQrDataUrl} alt="Payment QR Code" className="cust-qr-image" />
                        <div className="cust-qr-meta">
                          <span>
                            {billPayChannel === 'promptpay'
                              ? `พร้อมเพย์: ${getStoredPromptPayId('0823456789')}`
                              : `สแกนชำระเงินผ่านแอป ${quickPayChannels.find(c => c.id === billPayChannel)?.name}`}
                          </span>
                          <strong>ยอดเงิน: ฿{(tableOrdersTotal || cartTotal).toFixed(2)}</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="cust-qr-loading">กำลังสร้าง QR Code...</div>
                    )}

                    <div className="cust-slip-section">
                      {billSlipUploaded ? (
                        <div className="cust-slip-verified">
                          <CheckCircle2 size={20} color="#059669" />
                          <span>ตรวจสอบสลิปโอนเงินเรียบร้อยแล้ว</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="cust-bill-upload-btn"
                          disabled={isVerifyingBillSlip}
                          onClick={() => {
                            playTapSound('click')
                            setIsVerifyingBillSlip(true)
                            setTimeout(() => {
                              setIsVerifyingBillSlip(false)
                              setBillSlipUploaded(true)
                              playTapSound('success')
                            }, 1200)
                          }}
                        >
                          {isVerifyingBillSlip ? (
                            <span>⏳ กำลังตรวจสอบสลิปอัตโนมัติ...</span>
                          ) : (
                            <>
                              <Upload size={16} /> <span>แนบสลิปเพื่อยืนยันการชำระเงิน</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {!billSuccess && (submittedOrders.length > 0 || cart.length > 0) && (
              <div className="qs-modal-footer cust-bill-footer">
                <button
                  type="button"
                  className="qs-btn-cancel"
                  onClick={() => setIsBillModalOpen(false)}
                >
                  ปิด
                </button>
                <button
                  type="button"
                  className="cust-bill-confirm-btn"
                  onClick={handleConfirmBillPayment}
                >
                  <CheckCircle2 size={16} /> ยืนยันการชำระเงิน ({quickPayChannels.find(c => c.id === billPayChannel)?.name})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 11. Delivery Address Edit Modal */}
      {isAddressModalOpen && (
        <div className="qs-modal-overlay" style={{ zIndex: 100040 }}>
          <div className="qs-modal" style={{ maxWidth: 440 }}>
            <div className="qs-modal-header">
              <div>
                <h3>📍 ระบุที่อยู่จัดส่งเดลิเวอรี</h3>
                <p>กรุณากรอกข้อมูลสำหรับให้ไรเดอร์จัดส่งอาหารถึงมือคุณ</p>
              </div>
              <button
                type="button"
                className="qs-modal-close"
                onClick={() => setIsAddressModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="qs-modal-body">
              <div className="qs-form-group">
                <label>ชื่อผู้รับ *</label>
                <input
                  type="text"
                  value={deliveryReceiverName}
                  onChange={(e) => setDeliveryReceiverName(e.target.value)}
                  placeholder="เช่น คุณสมชาย"
                />
              </div>

              <div className="qs-form-group">
                <label>เบอร์โทรศัพท์ติดต่อ *</label>
                <input
                  type="tel"
                  value={deliveryPhone}
                  onChange={(e) => setDeliveryPhone(e.target.value)}
                  placeholder="เช่น 081-234-5678"
                />
              </div>

              <div className="qs-form-group">
                <label>ที่อยู่จัดส่ง / บ้านเลขที่ ซอย ถนน แขวง/ตำบล *</label>
                <textarea
                  rows={3}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="ระบุบ้านเลขที่, คอนโด/ตึก, ชั้น, ห้อง, ถนน..."
                />
              </div>

              <div className="qs-form-group">
                <label>หมายเหตุถึงไรเดอร์ (ถ้ามี)</label>
                <input
                  type="text"
                  value={deliveryRiderNote}
                  onChange={(e) => setDeliveryRiderNote(e.target.value)}
                  placeholder="เช่น ฝากไว้ที่ป้อมยาม, โทรแจ้งก่อนถึง 5 นาที"
                />
              </div>
            </div>

            <div className="qs-modal-footer">
              <button
                type="button"
                className="qs-btn-submit"
                onClick={() => {
                  playTapSound('success')
                  setIsAddressModalOpen(false)
                  showToast('บันทึกที่อยู่จัดส่งเรียบร้อยแล้ว', '📍')
                }}
              >
                บันทึกที่อยู่จัดส่ง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

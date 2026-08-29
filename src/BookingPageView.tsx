import React, { useState, useEffect } from 'react'
import {
  Calendar,
  Clock,
  Phone,
  MessageCircle,
  Check,
  CheckCircle2,
  Sparkles,
  QrCode,
  ArrowRight,
  ArrowLeft,
  Wallet,
  CreditCard,
  Building2,
  ReceiptText,
  Copy,
  ChevronDown,
  MapPin
} from 'lucide-react'
import { generateUrlQrDataUrl } from './promptpay'
import { createPublicTransactionCommand, transactionQrImageUrl } from './chatposApi'

export interface BookingServiceItem {
  id: string
  name: string
  nameEn?: string
  category: 'service' | 'special' | 'general'
  price: number
  durationMinutes?: number
  description: string
  highlights?: string
  imgUrl: string
  tag?: string
}

export interface ServiceBookingRecord {
  id: string
  serviceId: string
  serviceName: string
  servicePrice: number
  serviceImg?: string
  customerName: string
  customerPhone: string
  guestCount: number
  bookingDate: string
  bookingTime: string
  specialNotes?: string
  paymentMethod: 'promptpay' | 'store' | 'truemoney' | 'credit_card' | 'bank_transfer' | string
  isPaid: boolean
  status: 'pending' | 'confirmed' | 'in_service' | 'completed' | 'cancelled'
  createdAt: string
}

const defaultBookingServices: BookingServiceItem[] = [
  {
    id: 'bk-srv-1',
    name: 'บริการจองโต๊ะจัดเลี้ยง VIP',
    nameEn: '(VIP Private Dining Table Reservation)',
    category: 'service',
    price: 500,
    durationMinutes: 60,
    description: 'บริการคุณภาพมาตรฐานจากทางร้าน',
    highlights: 'บริการระดับพรีเมียม ดูแลใส่ใจทุกขั้นตอน',
    imgUrl: '/mascot/nabtang_welcome.png',
    tag: 'SERVICE'
  }
]

export function BookingPageView() {
  const [selectedService, setSelectedService] = useState<BookingServiceItem>(defaultBookingServices[0])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [bookingStep, setBookingStep] = useState<'details' | 'payment_summary' | 'success'>('details')

  // Booking Form Inputs
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [guestCount, setGuestCount] = useState(1)
  
  // Date states
  const todayObj = new Date()
  const todayStr = todayObj.toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [selectedTime, setSelectedTime] = useState('15:00')
  const [specialNotes, setSpecialNotes] = useState('')
  
  // Payment Method Selection matching QuickPay (คิดเงินด่วน)
  const [paymentMethod, setPaymentMethod] = useState<'promptpay' | 'store' | 'truemoney' | 'credit_card' | 'bank_transfer'>('store')

  // Card & QR States
  const [promptPayQrUrl, setPromptPayQrUrl] = useState('')
  const [checkoutRedirectUrl, setCheckoutRedirectUrl] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState('')
  const [qrCountdown, setQrCountdown] = useState(300)
  const [cardName, setCardName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExp, setCardExp] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [copiedBankAcc, setCopiedBankAcc] = useState(false)

  // Confirmed Result States
  const [confirmedBooking, setConfirmedBooking] = useState<ServiceBookingRecord | null>(null)
  const [bookingCheckinQr, setBookingCheckinQr] = useState('')
  const [copiedBookingRef, setCopiedBookingRef] = useState(false)

  // Store metadata (Synced with merchant_booking_settings from /merchant#services)
  const [storeInfo, setStoreInfo] = useState(() => {
    try {
      const saved = localStorage.getItem('merchant_booking_settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          welcomeSub: parsed.welcomeSub || 'ยินดีต้อนรับสู่',
          namePrefix: parsed.namePrefix || 'POP CAFE',
          nameSuffix: parsed.nameSuffix || '& SERVICES ✨',
          fullName: parsed.storeName || 'POP CAFE & SERVICES ✨',
          description: parsed.slogan || 'ระบบนัดหมายออนไลน์ บริการสะดวกรวดเร็ว ยืนยันคิวทันที',
          coverImg: parsed.coverImg || 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1600&auto=format&fit=crop&q=80',
          logoImg: parsed.logoImg || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80',
          openHours: parsed.openHours || 'เปิดบริการทุกวัน 08:00 - 20:00 น.',
          phone: parsed.phone || '082-345-6789',
          lineUrl: parsed.lineUrl || 'https://line.me/ti/p/~@chatpos',
          location: parsed.location || '128 ถ. สุขุมวิท ซอย 24 แขวงคลองตัน เขตคลองเตย กรุงเทพมหานคร 10110',
          rating: '4.9',
          reviews: '640+'
        }
      }
    } catch (e) {}
    return {
      welcomeSub: 'ยินดีต้อนรับสู่',
      namePrefix: 'POP CAFE',
      nameSuffix: '& SERVICES ✨',
      fullName: 'POP CAFE & SERVICES ✨',
      description: 'ระบบนัดหมายออนไลน์ บริการสะดวกรวดเร็ว ยืนยันคิวทันที',
      coverImg: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1600&auto=format&fit=crop&q=80',
      logoImg: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80',
      openHours: 'เปิดบริการทุกวัน 08:00 - 20:00 น.',
      phone: '082-345-6789',
      lineUrl: 'https://line.me/ti/p/~@chatpos',
      location: '128 ถ. สุขุมวิท ซอย 24 แขวงคลองตัน เขตคลองเตย กรุงเทพมหานคร 10110',
      rating: '4.9',
      reviews: '640+'
    }
  })

  useEffect(() => {
    const handleSyncSettings = () => {
      try {
        const saved = localStorage.getItem('merchant_booking_settings')
        if (saved) {
          const parsed = JSON.parse(saved)
          setStoreInfo(prev => ({
            ...prev,
            welcomeSub: parsed.welcomeSub || prev.welcomeSub,
            namePrefix: parsed.namePrefix || prev.namePrefix,
            nameSuffix: parsed.nameSuffix || prev.nameSuffix,
            fullName: parsed.storeName || prev.fullName,
            description: parsed.slogan || prev.description,
            coverImg: parsed.coverImg || prev.coverImg,
            logoImg: parsed.logoImg || prev.logoImg,
            openHours: parsed.openHours || prev.openHours,
            phone: parsed.phone || prev.phone,
            lineUrl: parsed.lineUrl || prev.lineUrl,
            location: parsed.location || prev.location
          }))
        }
      } catch (e) {}
    }
    window.addEventListener('storage', handleSyncSettings)
    return () => window.removeEventListener('storage', handleSyncSettings)
  }, [])

  // Load custom services from merchant backend if configured
  const [servicesList] = useState<BookingServiceItem[]>(() => {
    try {
      const saved = localStorage.getItem('pos_products_catalog')
      if (saved) {
        const parsed = JSON.parse(saved)
        const filtered = parsed.filter((p: any) => p.category === 'service' || p.category === 'special')
        if (filtered.length > 0) {
          return filtered.map((s: any, idx: number) => ({
            id: s.id || `srv-${idx}`,
            name: s.name,
            nameEn: s.nameEn || '',
            category: 'service',
            price: Number(s.price) || 500,
            durationMinutes: 60,
            description: s.description || 'บริการคุณภาพมาตรฐานจากทางร้าน',
            highlights: s.ingredients || 'บริการระดับพรีเมียม ดูแลใส่ใจทุกขั้นตอน',
            imgUrl: s.imgUrl || s.image || defaultBookingServices[0].imgUrl,
            tag: s.tag || 'SERVICE'
          }))
        }
      }
    } catch (e) {}
    return defaultBookingServices
  })

  // Deep linking for ?service=... or ?id=...
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search)
      const serviceIdParam = searchParams.get('service') || searchParams.get('id') || searchParams.get('serviceId')
      if (serviceIdParam && servicesList.length > 0) {
        const found = servicesList.find(s => s.id === serviceIdParam || s.id.toLowerCase() === serviceIdParam.toLowerCase())
        if (found) {
          setSelectedService(found)
          setIsModalOpen(true)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }, [servicesList])

  const isGatewayPayment = paymentMethod !== 'store'

  // Create the booking payment through the server-side LLGW route.
  useEffect(() => {
    if (!selectedService || !isModalOpen || bookingStep !== 'payment_summary' || !isGatewayPayment) return
    if (!paymentIdempotencyKey) {
      setPaymentIdempotencyKey(`booking:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`)
      return
    }

    let isMounted = true
    setPromptPayQrUrl('')
    setCheckoutRedirectUrl('')
    setPaymentReference('')
    setPaymentError('')
    createPublicTransactionCommand({
      amount: selectedService.price,
      channel: paymentMethod === 'promptpay' ? 'promptpay' : 'checkout',
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      note: `จองบริการ ${selectedService.name} วันที่ ${selectedDate} เวลา ${selectedTime}`,
      metadata: { bookingDate: selectedDate, bookingTime: selectedTime, guestCount },
    }, paymentIdempotencyKey)
      .then((response) => {
        if (!isMounted) return
        const transaction = response?.transaction
        setPromptPayQrUrl(transactionQrImageUrl(transaction))
        setCheckoutRedirectUrl(transaction?.checkoutRedirectUrl || '')
        setPaymentReference(transaction?.paymentReference || transaction?.gatewayReference || transaction?.reference || '')
      })
      .catch((error: any) => {
        if (isMounted) setPaymentError(error?.message || 'ไม่สามารถสร้างรายการชำระเงินผ่าน LLGW ได้')
      })

    return () => { isMounted = false }
  }, [selectedService, isModalOpen, bookingStep, isGatewayPayment, paymentIdempotencyKey, customerName, customerPhone, selectedDate, selectedTime, guestCount, paymentMethod])

  useEffect(() => {
    setPaymentIdempotencyKey('')
    setPromptPayQrUrl('')
    setCheckoutRedirectUrl('')
    setPaymentReference('')
    setPaymentError('')
  }, [paymentMethod])

  // Countdown timer for PromptPay QR
  useEffect(() => {
    let timer: any
    if (isModalOpen && bookingStep === 'payment_summary' && paymentMethod === 'promptpay' && qrCountdown > 0) {
      timer = setInterval(() => setQrCountdown(prev => (prev > 0 ? prev - 1 : 0)), 1000)
    }
    return () => clearInterval(timer)
  }, [isModalOpen, bookingStep, paymentMethod, qrCountdown])

  // Generate checkin QR code when booking confirmed
  useEffect(() => {
    if (confirmedBooking?.id) {
      generateUrlQrDataUrl(`CHATPAY-CHECKIN:${confirmedBooking.id}`, 200)
        .then(setBookingCheckinQr)
        .catch(console.error)
    }
  }, [confirmedBooking?.id])

  // Dynamic Date calculations matching screenshot
  const formatDatePill = (offsetDays: number) => {
    const d = new Date(Date.now() + offsetDays * 86400000)
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const day = d.getDate().toString().padStart(2, '0')
    return {
      dateStr: d.toISOString().split('T')[0],
      displayTag: `(${month}-${day})`
    }
  }

  const dateOptionPills = [
    { label: 'วันนี้', ...formatDatePill(0) },
    { label: 'พรุ่งนี้', ...formatDatePill(1) },
    { label: 'มะรืนนี้', ...formatDatePill(2) }
  ]

  // Time Slots matching screenshot exactly
  const timeSlots = [
    '09:00', '10:00', '11:00', '11:30', '13:00',
    '14:00', '15:00', '16:00', '17:00', '18:00'
  ]

  const handleOpenBookingModal = (service?: BookingServiceItem) => {
    if (service) setSelectedService(service)
    setBookingStep('details')
    setQrCountdown(300)
    setPaymentIdempotencyKey('')
    setIsModalOpen(true)
  }

  // Step 1 -> Step 2
  const handleProceedToPaymentSummary = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName.trim()) {
      alert('กรุณากรอกชื่อ-นามสกุล ผู้จอง')
      return
    }
    if (!customerPhone.trim()) {
      alert('กรุณากรอกเบอร์โทรศัพท์ติดต่อ')
      return
    }
    setBookingStep('payment_summary')
    setQrCountdown(300)
  }

  // Step 2 -> Step 3
  const handleFinalConfirmBooking = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!selectedService) return

    const bookingId = `BK-${Math.floor(10000 + Math.random() * 90000)}`
    const isPaid = paymentMethod === 'promptpay' || paymentMethod === 'truemoney' || paymentMethod === 'credit_card'

    const record: ServiceBookingRecord = {
      id: bookingId,
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      servicePrice: selectedService.price,
      serviceImg: selectedService.imgUrl,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      guestCount,
      bookingDate: selectedDate,
      bookingTime: selectedTime,
      specialNotes: specialNotes.trim(),
      paymentMethod,
      isPaid,
      status: 'pending',
      createdAt: new Date().toISOString()
    }

    try {
      const existing = localStorage.getItem('merchant_service_bookings')
      const list: ServiceBookingRecord[] = existing ? JSON.parse(existing) : []
      const updated = [record, ...list]
      localStorage.setItem('merchant_service_bookings', JSON.stringify(updated))
      window.dispatchEvent(new Event('storage'))
    } catch (err) {
      console.error(err)
    }

    setConfirmedBooking(record)
    setBookingStep('success')
  }

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'promptpay': return 'พร้อมเพย์ QR'
      case 'truemoney': return 'TrueMoney Wallet'
      case 'credit_card': return 'บัตรเครดิต / เดบิต'
      case 'bank_transfer': return 'โอนเงินบัญชีธนาคาร'
      case 'store':
      default:
        return 'ชำระที่หน้าร้าน'
    }
  }

  const handleCopyBookingInfo = () => {
    if (!confirmedBooking) return
    const text = `📌 ข้อมูลการจองคิว #${confirmedBooking.id}\nบริการ: ${confirmedBooking.serviceName}\nวันที่: ${formatDisplayDate(confirmedBooking.bookingDate)} เวลา: ${confirmedBooking.bookingTime} น.\nผู้จอง: ${confirmedBooking.customerName} (${confirmedBooking.customerPhone})\nยอดชำระ: ฿${confirmedBooking.servicePrice.toLocaleString()}\nช่องทางชำระ: ${getPaymentMethodLabel(confirmedBooking.paymentMethod)}\nร้าน: ${storeInfo.fullName}`
    navigator.clipboard?.writeText(text)
    setCopiedBookingRef(true)
    setTimeout(() => setCopiedBookingRef(false), 2000)
  }

  const handleCopyBankAccount = () => {
    navigator.clipboard?.writeText('1234567890')
    setCopiedBankAcc(true)
    setTimeout(() => setCopiedBankAcc(false), 2000)
  }

  // Format date display for input (DD/MM/YYYY)
  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return ''
    const parts = dStr.split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return dStr
  }

  return (
    <div className="bk-portal-page">
      {/* 1. TOP HERO BANNER (MATCHING SCREENSHOT) */}
      <section className="bk-top-hero">
        <div className="bk-hero-bg-frame">
          <img src={storeInfo.coverImg} alt="Cafe Setting" className="bk-hero-bg-image" />
          <div className="bk-hero-dark-overlay" />
        </div>

        <div className="bk-hero-header-text">
          <span className="bk-welcome-caption">{storeInfo.welcomeSub}</span>
          <h1 className="bk-hero-title-h1">{storeInfo.namePrefix}</h1>
          <h2 className="bk-hero-title-h2">{storeInfo.nameSuffix}</h2>

          <div className="bk-hero-pills-row">
            <div className="bk-time-badge-pill">
              <Clock size={14} className="bk-pill-icon" />
              <span>{storeInfo.openHours}</span>
            </div>

            <a href={storeInfo.lineUrl} target="_blank" rel="noreferrer" className="bk-line-badge-pill">
              <div className="bk-line-icon-badge">LINE</div>
              <span>LINE Official</span>
            </a>
          </div>
        </div>
      </section>

      {/* 2. MAIN CENTER CONTENT & FLOATING STORE CARD */}
      <main className="bk-portal-main">
        {/* Floating Store Card */}
        <div className="bk-float-store-card">
          <div className="bk-store-top-info-row">
            <div className="bk-avatar-wrapper">
              <img src={storeInfo.logoImg} alt="Store Logo" className="bk-avatar-coffee-img" />
              <div className="bk-avatar-verified-check">✓</div>
            </div>

            <div className="bk-store-title-text-group">
              <h3 className="bk-card-store-name">{storeInfo.fullName}</h3>
              <div className="bk-card-rating-pill">
                ⭐ {storeInfo.rating} ({storeInfo.reviews} รีวิว)
              </div>
              <p className="bk-card-slogan-text">{storeInfo.description}</p>
            </div>
          </div>

          {/* Inset Address Box */}
          <div className="bk-inset-address-box">
            <div className="bk-inset-row">
              <MapPin size={15} className="bk-inset-icon" />
              <span>{storeInfo.location}</span>
            </div>
            <div className="bk-inset-row">
              <Phone size={15} className="bk-inset-icon" />
              <span>{storeInfo.phone}</span>
            </div>
          </div>

          {/* Big Green Booking Button */}
          <button
            type="button"
            className="bk-giant-book-now-btn"
            onClick={() => handleOpenBookingModal(selectedService)}
          >
            <Calendar size={18} />
            <span>จองคิวออนไลน์ทันที</span>
            <Sparkles size={16} className="bk-btn-sparkle" />
          </button>
        </div>

        {/* 3. SERVICES SECTION HEADER */}
        <div className="bk-services-section-header">
          <div className="bk-srv-sec-left">
            <div className="bk-crown-circle-icon">
              <span style={{ fontSize: '15px' }}>👑</span>
            </div>
            <h4>รายการบริการที่เปิดรับจองออนไลน์</h4>
          </div>
          <span className="bk-srv-total-badge">{servicesList.length} รายการ</span>
        </div>

        {/* 4. SERVICE CARDS LIST (PIXEL-PERFECT MATCH TO SCREENSHOT) */}
        <div className="bk-services-cards-stack">
          {servicesList.map((srv) => (
            <div key={srv.id} className="bk-single-service-card">
              {/* Media Thumbnail Container */}
              <div className="bk-srv-thumb-container">
                <div className="bk-srv-thumb-bg">
                  <img src={srv.imgUrl} alt={srv.name} className="bk-srv-mascot-img" />
                  <div className="bk-srv-duration-tag">
                    <Clock size={11} /> <span>{srv.durationMinutes || 60} นาที</span>
                  </div>
                </div>
              </div>

              {/* Service Info Content */}
              <div className="bk-srv-details-content">
                <div className="bk-srv-type-pill">{srv.tag || 'SERVICE'}</div>
                <h3 className="bk-srv-name-title">{srv.name}</h3>
                <p className="bk-srv-desc-sub">{srv.description}</p>

                {/* Highlight Chip */}
                {srv.highlights && (
                  <div className="bk-srv-highlight-box">
                    <span>💎 {srv.highlights}</span>
                  </div>
                )}

                {/* Card Bottom Row */}
                <div className="bk-srv-card-bottom-row">
                  <div className="bk-srv-price-stack">
                    <span className="bk-srv-price-caption">ค่าบริการ</span>
                    <strong className="bk-srv-price-number">฿{srv.price.toLocaleString()}</strong>
                  </div>

                  <button
                    type="button"
                    className="bk-srv-item-book-btn"
                    onClick={() => handleOpenBookingModal(srv)}
                  >
                    <Calendar size={14} />
                    <span>จองบริการนี้</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 5. BOOKING MODAL (DETAILS -> SUMMARY & QUICKPAY CHANNELS -> SUCCESS) */}
      {isModalOpen && (
        <div className="cat-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="cat-modal-dialog booking-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="cat-modal-close"
              onClick={() => setIsModalOpen(false)}
            >
              ✕
            </button>

            {/* STEP 1: FILL DETAILS (MATCHING USER SCREENSHOT) */}
            {bookingStep === 'details' ? (
              <form onSubmit={handleProceedToPaymentSummary} className="cat-booking-form-wrap">
                {/* Header with 4-leaf sprout icon */}
                <div className="cat-booking-modal-header">
                  <div className="cat-booking-header-title-group">
                    <div className="cat-booking-clover-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 4C12 4 10 2 7.5 2C5.01472 2 3 4.01472 3 6.5C3 8.98528 5.01472 11 7.5 11C10 11 12 9 12 9M12 4C12 4 14 2 16.5 2C18.9853 2 21 4.01472 21 6.5C21 8.98528 18.9853 11 16.5 11C14 11 12 9 12 9M12 4V12M12 12C12 12 10 14 7.5 14C5.01472 14 3 16.0147 3 18.5C3 20.9853 5.01472 23 7.5 23C10 23 12 21 12 21M12 12C12 12 14 14 16.5 14C18.9853 14 21 16.0147 21 18.5C21 20.9853 18.9853 23 16.5 23C14 23 12 21 12 21M12 12V21" stroke="#056839" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <h3>นัดหมายจองบริการออนไลน์</h3>
                      <p>กรอกข้อมูลและเลือกวันเวลาเพื่อยืนยันการจองกับร้าน</p>
                    </div>
                  </div>
                </div>

                <div className="cat-booking-modal-body">
                  {/* Section 1: Selected Service Banner */}
                  <div className="cat-booking-sec">
                    <div className="cat-booking-sec-title">
                      <span className="cat-sec-icon">🛎️</span> บริการที่ต้องการจอง
                    </div>

                    <div className="cat-selected-service-banner">
                      <div className="cat-srv-banner-thumb">
                        <img src={selectedService.imgUrl} alt={selectedService.name} />
                      </div>
                      <div className="cat-srv-banner-info">
                        <strong>{selectedService.name}</strong>
                        <span className="cat-srv-banner-price">฿{selectedService.price.toLocaleString()}</span>
                      </div>
                      <div className="cat-srv-banner-check">✓</div>
                    </div>

                    {/* Quick switch if multiple services */}
                    {servicesList.length > 1 && (
                      <div className="cat-switch-srv-row">
                        <span className="cat-switch-srv-label">บริการอื่น:</span>
                        {servicesList.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className={`cat-switch-chip ${selectedService.id === s.id ? 'active' : ''}`}
                            onClick={() => setSelectedService(s)}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 2: Date & Time */}
                  <div className="cat-booking-sec">
                    <div className="cat-booking-sec-title">
                      <span className="cat-sec-icon">📅</span> เลือกวันและเวลาที่สะดวก
                    </div>

                    {/* 3 Date Pills */}
                    <div className="cat-booking-date-pills-row">
                      {dateOptionPills.map((opt) => (
                        <button
                          key={opt.dateStr}
                          type="button"
                          className={`cat-date-pill-btn ${selectedDate === opt.dateStr ? 'active' : ''}`}
                          onClick={() => setSelectedDate(opt.dateStr)}
                        >
                          <Calendar size={13} />
                          <span>{opt.label} {opt.displayTag}</span>
                        </button>
                      ))}
                    </div>

                    {/* Custom Date Input */}
                    <div className="cat-date-input-wrap">
                      <div className="cat-date-display-box">
                        <Calendar size={14} className="cat-date-calendar-icon" />
                        <input
                          type="date"
                          value={selectedDate}
                          min={todayStr}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="cat-native-date-input"
                          required
                        />
                      </div>
                    </div>

                    {/* 5-Column Time Slots */}
                    <div className="cat-time-slots-5col-grid">
                      {timeSlots.map((time) => (
                        <button
                          key={time}
                          type="button"
                          className={`cat-time-slot-btn ${selectedTime === time ? 'active' : ''}`}
                          onClick={() => setSelectedTime(time)}
                        >
                          {time} น.
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Section 3: Customer Inputs */}
                  <div className="cat-booking-sec">
                    <div className="cat-booking-sec-title">
                      <span className="cat-sec-icon">👤</span> ข้อมูลผู้รับบริการ
                    </div>

                    <div className="cat-booking-inputs-grid">
                      <div className="cat-input-group">
                        <label className="cat-label-text">
                          ชื่อ-นามสกุล ผู้จอง <span className="req">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="เช่น คุณกิตติศักดิ์ ชัยมงคล"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="cat-input-field"
                          required
                        />
                      </div>

                      <div className="cat-input-group">
                        <label className="cat-label-text">
                          เบอร์โทรศัพท์ติดต่อ <span className="req">*</span>
                        </label>
                        <input
                          type="tel"
                          placeholder="เช่น 081-234-5678"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="cat-input-field"
                          required
                        />
                      </div>

                      <div className="cat-input-group">
                        <label className="cat-label-text">จำนวนผู้รับบริการ</label>
                        <div className="cat-select-wrap">
                          <select
                            value={guestCount}
                            onChange={(e) => setGuestCount(Number(e.target.value))}
                            className="cat-select-field"
                          >
                            <option value={1}>1 ท่าน</option>
                            <option value={2}>2 ท่าน</option>
                            <option value={3}>3 ท่าน</option>
                            <option value={4}>4 ท่านขึ้นไป (กรุ๊ป)</option>
                          </select>
                          <ChevronDown size={14} className="cat-select-arrow" />
                        </div>
                      </div>

                      <div className="cat-input-group">
                        <label className="cat-label-text">หมายเหตุ / คำขอพิเศษ (ถ้ามี)</label>
                        <input
                          type="text"
                          placeholder="เช่น ขอข้างประตู, แจ้งเตือน"
                          value={specialNotes}
                          onChange={(e) => setSpecialNotes(e.target.value)}
                          className="cat-input-field"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Payment Methods (2-Column Radio Cards) */}
                  <div className="cat-booking-sec">
                    <div className="cat-booking-sec-title">
                      <span className="cat-sec-icon">💳</span> วิธีการชำระเงิน
                    </div>

                    <div className="cat-pay-methods-grid">
                      {/* 1. Pay at Store */}
                      <div
                        className={`cat-pay-method-card ${paymentMethod === 'store' ? 'active' : ''}`}
                        onClick={() => setPaymentMethod('store')}
                      >
                        <div className="cat-pay-radio-circle">
                          {paymentMethod === 'store' && <div className="cat-radio-inner-dot" />}
                        </div>
                        <div className="cat-pay-method-icon">
                          <Wallet size={18} color="#057a44" />
                        </div>
                        <div className="cat-pay-method-text">
                          <strong>ชำระที่หน้าร้าน</strong>
                          <small>จ่ายเงินสด / สแกนจ่ายเมื่อมารับบริการ</small>
                        </div>
                      </div>

                      {/* 2. PromptPay QR */}
                      <div
                        className={`cat-pay-method-card ${paymentMethod === 'promptpay' ? 'active' : ''}`}
                        onClick={() => setPaymentMethod('promptpay')}
                      >
                        <div className="cat-pay-radio-circle">
                          {paymentMethod === 'promptpay' && <div className="cat-radio-inner-dot" />}
                        </div>
                        <div className="cat-pay-method-icon">
                          <QrCode size={18} color="#057a44" />
                        </div>
                        <div className="cat-pay-method-text">
                          <strong>พร้อมเพย์ QR</strong>
                          <small>ชำระล่วงหน้า และยืนยันการจองทันที</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sticky Bottom Footer */}
                <div className="cat-booking-sticky-footer">
                  <div className="cat-booking-total-col">
                    <span className="cat-footer-caption">ยอดชำระบริการ</span>
                    <strong className="cat-footer-amount">
                      ฿{selectedService.price.toLocaleString()}
                    </strong>
                  </div>
                  <button type="submit" className="cat-booking-submit-cta">
                    <span>ยืนยันการจองคิว</span> <ArrowRight size={18} />
                  </button>
                </div>
              </form>
            ) : bookingStep === 'payment_summary' ? (
              /* STEP 2: SUMMARY & QUICKPAY-STYLE PAYMENT CHANNELS */
              <div className="cat-booking-form-wrap">
                <div className="cat-booking-modal-header">
                  <div className="cat-booking-header-title-group">
                    <ReceiptText size={22} color="#057a44" />
                    <div>
                      <h3>สรุปรายการ & เลือกช่องทางชำระเงิน</h3>
                      <p>ตรวจสอบข้อมูลการนัดหมายและเลือกวิธีชำระเงินเพื่อยืนยันคิว</p>
                    </div>
                  </div>
                </div>

                <div className="cat-booking-modal-body">
                  {/* Bill Breakdown Summary Card */}
                  <div className="cat-pay-summary-bill-card">
                    <div className="cat-bill-item-row">
                      <div className="cat-bill-item-left">
                        <span className="cat-bill-badge-pill">บริการที่เลือก</span>
                        <strong>{selectedService.name}</strong>
                        <small>📅 {formatDisplayDate(selectedDate)} เวลา {selectedTime} น. · 👥 {guestCount} ท่าน</small>
                        <small>👤 คุณ{customerName} (โทร {customerPhone})</small>
                      </div>
                      <strong className="cat-bill-item-price">
                        ฿{selectedService.price.toLocaleString()}
                      </strong>
                    </div>

                    <div className="cat-bill-divider" />

                    <div className="cat-bill-line-row">
                      <span>ยอดรวมค่าบริการ (Subtotal)</span>
                      <span>฿{selectedService.price.toFixed(2)}</span>
                    </div>
                    <div className="cat-bill-line-row discount">
                      <span>ส่วนลดโปรโมชั่น (Discount)</span>
                      <span>-฿0.00</span>
                    </div>

                    <div className="cat-bill-net-total-row">
                      <div>
                        <strong className="cat-net-label">ยอดชำระสุทธิ (Net Total)</strong>
                        <small className="cat-net-sub">ราคารวมภาษีมูลค่าเพิ่มแล้ว</small>
                      </div>
                      <strong className="cat-net-price-large">
                        ฿{selectedService.price.toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  {/* Payment Channel Options matching QuickPay */}
                  <div className="cat-booking-sec">
                    <div className="cat-booking-sec-title">
                      <Wallet size={15} /> เลือกช่องทางชำระเงิน (เหมือนคิดเงินด่วน)
                    </div>

                    <div className="cat-pay-channel-5grid">
                      {/* 1. PromptPay QR */}
                      <div
                        className={`cat-pay-chan-card ${paymentMethod === 'promptpay' ? 'active' : ''}`}
                        onClick={() => setPaymentMethod('promptpay')}
                      >
                        <div className="cat-pay-radio-circle">
                          {paymentMethod === 'promptpay' && <div className="cat-radio-inner-dot" />}
                        </div>
                        <div className="cat-chan-icon pp">
                          <QrCode size={18} />
                        </div>
                        <div className="cat-chan-info">
                          <strong>พร้อมเพย์ QR</strong>
                          <small>สแกนทุกแอปธนาคาร ยืนยันคิวทันที</small>
                        </div>
                      </div>

                      {/* 2. Pay at Store */}
                      <div
                        className={`cat-pay-chan-card ${paymentMethod === 'store' ? 'active' : ''}`}
                        onClick={() => setPaymentMethod('store')}
                      >
                        <div className="cat-pay-radio-circle">
                          {paymentMethod === 'store' && <div className="cat-radio-inner-dot" />}
                        </div>
                        <div className="cat-chan-icon store">
                          <Wallet size={18} />
                        </div>
                        <div className="cat-chan-info">
                          <strong>ชำระที่หน้าร้าน</strong>
                          <small>จ่ายเงินสด / สแกนจ่ายเมื่อมารับบริการ</small>
                        </div>
                      </div>

                      {/* 3. TrueMoney */}
                      <div
                        className={`cat-pay-chan-card ${paymentMethod === 'truemoney' ? 'active' : ''}`}
                        onClick={() => setPaymentMethod('truemoney')}
                      >
                        <div className="cat-pay-radio-circle">
                          {paymentMethod === 'truemoney' && <div className="cat-radio-inner-dot" />}
                        </div>
                        <div className="cat-chan-icon tm">
                          🟠
                        </div>
                        <div className="cat-chan-info">
                          <strong>TrueMoney Wallet</strong>
                          <small>ชำระผ่านแอป ทรูมันนี่ วอลเล็ท</small>
                        </div>
                      </div>

                      {/* 4. Credit / Debit Card */}
                      <div
                        className={`cat-pay-chan-card ${paymentMethod === 'credit_card' ? 'active' : ''}`}
                        onClick={() => setPaymentMethod('credit_card')}
                      >
                        <div className="cat-pay-radio-circle">
                          {paymentMethod === 'credit_card' && <div className="cat-radio-inner-dot" />}
                        </div>
                        <div className="cat-chan-icon card">
                          <CreditCard size={18} />
                        </div>
                        <div className="cat-chan-info">
                          <strong>บัตรเครดิต / เดบิต</strong>
                          <small>VISA, Mastercard, JCB</small>
                        </div>
                      </div>

                      {/* 5. Bank Transfer */}
                      <div
                        className={`cat-pay-chan-card ${paymentMethod === 'bank_transfer' ? 'active' : ''}`}
                        onClick={() => setPaymentMethod('bank_transfer')}
                      >
                        <div className="cat-pay-radio-circle">
                          {paymentMethod === 'bank_transfer' && <div className="cat-radio-inner-dot" />}
                        </div>
                        <div className="cat-chan-icon bank">
                          <Building2 size={18} />
                        </div>
                        <div className="cat-chan-info">
                          <strong>โอนเงินบัญชีธนาคาร</strong>
                          <small>ธนาคารกสิกรไทย (KBANK)</small>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Channel Details Display Container */}
                  {paymentMethod === 'promptpay' && (
                    <div className="cat-promptpay-box-v2">
                      <div className="cat-pp-top-row">
                        <div className="cat-pp-timer-badge">
                          ⏳ QR หมดอายุใน: <strong>{Math.floor(qrCountdown / 60)}:{(qrCountdown % 60).toString().padStart(2, '0')}</strong>
                        </div>
                        <span className="cat-pp-sec-tag">🛡️ PromptPay Verified</span>
                      </div>

                      <div className="cat-pp-qr-center">
                        <div className="cat-pp-qr-frame">
                          {promptPayQrUrl ? (
                            <img src={promptPayQrUrl} alt="PromptPay QR Code" className="cat-pp-qr-large" />
                          ) : (
                            <div className="cat-pp-qr-loading">กำลังสร้าง PromptPay QR...</div>
                          )}
                        </div>
                      </div>

                      <div className="cat-pp-details-text">
                        <p>สแกน QR Code ด้วยแอปธนาคารใดก็ได้ ยอดเงิน <strong>฿{selectedService.price.toFixed(2)}</strong></p>
                        <small>QR นี้สร้างโดย LLGW สำหรับ {storeInfo.fullName}</small>
                      </div>
                    </div>
                  )}

                  {isGatewayPayment && paymentMethod !== 'promptpay' && (
                    <div className="cat-pay-guide-box">
                      <div className="cat-guide-icon">🔐</div>
                      <div>
                        <strong>ชำระเงินผ่านหน้า Checkout ของ LLGW</strong>
                        {checkoutRedirectUrl ? (
                          <p><a href={checkoutRedirectUrl} target="_blank" rel="noreferrer">เปิดหน้า Checkout เพื่อชำระเงิน</a></p>
                        ) : (
                          <p>กำลังเตรียมหน้า Checkout ที่ปลอดภัย...</p>
                        )}
                        {paymentReference && <small>รหัสรายการ: {paymentReference}</small>}
                      </div>
                    </div>
                  )}

                  {paymentError && (
                    <div className="cat-pay-guide-box" role="alert">
                      <div className="cat-guide-icon">⚠️</div>
                      <div>
                        <strong>สร้างรายการชำระเงินไม่สำเร็จ</strong>
                        <p>{paymentError}</p>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'store' && (
                    <div className="cat-pay-guide-box">
                      <div className="cat-guide-icon">🏪</div>
                      <div>
                        <strong>ชำระเงินเมื่อมารับบริการที่ร้าน</strong>
                        <p>ท่านสามารถชำระเงินสดหรือสแกน QR ที่เคาน์เตอร์ร้าน {storeInfo.fullName} ในวันและเวลานัดหมายได้เลยครับ</p>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'truemoney' && (
                    <div className="cat-pay-guide-box tm">
                      <div className="cat-guide-icon">🟠</div>
                      <div>
                        <strong>โอนเงินผ่าน TrueMoney Wallet</strong>
                        <p>เบอร์ทรูมันนี่: <b>082-345-6789</b> ({storeInfo.fullName})</p>
                        <small>ยอดชำระ: ฿{selectedService.price.toFixed(2)} บาท</small>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'credit_card' && (
                    <div className="cat-card-pay-box">
                      <div className="cat-card-sec-head">
                        <CreditCard size={16} /> <strong>กรอกข้อมูลบัตรเครดิต / เดบิต</strong>
                        <span className="cat-ssl-pill">🔒 256-bit SSL</span>
                      </div>
                      <div className="cat-card-inputs-grid">
                        <div className="cat-input-group full">
                          <label className="cat-label-text">ชื่อผู้ถือบัตร</label>
                          <input
                            type="text"
                            placeholder="Name on Card"
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value)}
                            className="cat-input-field"
                          />
                        </div>
                        <div className="cat-input-group full">
                          <label className="cat-label-text">หมายเลขบัตร 16 หลัก</label>
                          <input
                            type="text"
                            maxLength={19}
                            placeholder="4000 1234 5678 9010"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value)}
                            className="cat-input-field"
                          />
                        </div>
                        <div className="cat-input-group">
                          <label className="cat-label-text">วันหมดอายุ (MM/YY)</label>
                          <input
                            type="text"
                            maxLength={5}
                            placeholder="MM/YY"
                            value={cardExp}
                            onChange={(e) => setCardExp(e.target.value)}
                            className="cat-input-field"
                          />
                        </div>
                        <div className="cat-input-group">
                          <label className="cat-label-text">CVV / CVC</label>
                          <input
                            type="password"
                            maxLength={4}
                            placeholder="123"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            className="cat-input-field"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'bank_transfer' && (
                    <div className="cat-bank-transfer-box">
                      <div className="cat-bank-head">
                        <div className="cat-kbank-logo">KBANK</div>
                        <div>
                          <strong>ธนาคารกสิกรไทย (KBANK)</strong>
                          <p>ชื่อบัญชี: บจก. ป๊อป คาเฟ่ เซอร์วิส</p>
                        </div>
                      </div>
                      <div className="cat-bank-acc-row">
                        <span>เลขที่บัญชี: <strong>123-4-56789-0</strong></span>
                        <button
                          type="button"
                          className="cat-copy-acc-btn"
                          onClick={handleCopyBankAccount}
                        >
                          {copiedBankAcc ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedBankAcc ? 'คัดลอกแล้ว' : 'คัดลอกเลขบัญชี'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Step 2 Sticky Footer Actions */}
                <div className="cat-booking-sticky-footer">
                  <button
                    type="button"
                    className="cat-booking-back-cta"
                    onClick={() => setBookingStep('details')}
                  >
                    <ArrowLeft size={16} /> <span>ย้อนกลับ</span>
                  </button>

                  <button
                    type="button"
                    className="cat-booking-submit-cta"
                    disabled={isGatewayPayment && !paymentReference}
                    onClick={() => handleFinalConfirmBooking()}
                  >
                    <span>ยืนยันชำระเงิน & รับบัตรคิว</span>
                    <strong className="cat-btn-price-tag">
                      (฿{selectedService.price.toLocaleString()})
                    </strong>
                    <CheckCircle2 size={18} />
                  </button>
                </div>
              </div>
            ) : (
              /* STEP 3: SUCCESS TICKET PASS STEP */
              <div className="cat-booking-success-wrap">
                <div className="cat-success-top-badge">
                  <CheckCircle2 size={44} color="#059669" />
                  <h3>จองคิวสำเร็จเรียบร้อย!</h3>
                  <p>ระบบได้บันทึกการจองของคุณเข้าสู่คิวร้านค้าแล้ว</p>
                </div>

                {confirmedBooking && (
                  <div className="cat-booking-ticket-card">
                    <div className="cat-ticket-header">
                      <div className="cat-ticket-ref">
                        <span>รหัสการจอง</span>
                        <strong>#{confirmedBooking.id}</strong>
                      </div>
                      <span className="cat-ticket-status-pill">🟡 รอรับบริการ</span>
                    </div>

                    <div className="cat-ticket-body">
                      <div className="cat-ticket-row">
                        <span className="t-label">บริการ:</span>
                        <strong className="t-val">{confirmedBooking.serviceName}</strong>
                      </div>
                      <div className="cat-ticket-row">
                        <span className="t-label">วันและเวลา:</span>
                        <strong className="t-val highlight">
                          {formatDisplayDate(confirmedBooking.bookingDate)} เวลา {confirmedBooking.bookingTime} น.
                        </strong>
                      </div>
                      <div className="cat-ticket-row">
                        <span className="t-label">ผู้รับบริการ:</span>
                        <span className="t-val">{confirmedBooking.customerName} ({confirmedBooking.guestCount} ท่าน)</span>
                      </div>
                      <div className="cat-ticket-row">
                        <span className="t-label">เบอร์โทร:</span>
                        <span className="t-val">{confirmedBooking.customerPhone}</span>
                      </div>
                      <div className="cat-ticket-row">
                        <span className="t-label">การชำระเงิน:</span>
                        <span className="t-val">{getPaymentMethodLabel(confirmedBooking.paymentMethod)} (฿{confirmedBooking.servicePrice.toLocaleString()})</span>
                      </div>
                      {confirmedBooking.specialNotes && (
                        <div className="cat-ticket-row">
                          <span className="t-label">หมายเหตุ:</span>
                          <span className="t-val muted">{confirmedBooking.specialNotes}</span>
                        </div>
                      )}
                    </div>

                    <div className="cat-ticket-qr-section">
                      {bookingCheckinQr ? (
                        <img src={bookingCheckinQr} alt="Check-in QR" className="cat-ticket-qr-img" />
                      ) : null}
                      <small>แสดง QR Code หรือแจ้งรหัส #{confirmedBooking.id} เมื่อถึงหน้าร้าน</small>
                    </div>
                  </div>
                )}

                <div className="cat-success-actions-list">
                  <a
                    href={`${storeInfo.lineUrl}?text=${encodeURIComponent(
                      `สวัสดีครับ แจ้งยืนยันการจองคิว #${confirmedBooking?.id}\nบริการ: ${confirmedBooking?.serviceName}\nวันที่: ${formatDisplayDate(confirmedBooking?.bookingDate || '')} เวลา: ${confirmedBooking?.bookingTime} น.\nผู้จอง: ${confirmedBooking?.customerName} (${confirmedBooking?.customerPhone})`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="cat-success-act-btn line"
                  >
                    <MessageCircle size={16} /> <span>ส่งข้อมูลการจองไปยัง LINE Official</span>
                  </a>

                  <button
                    type="button"
                    className="cat-success-act-btn copy"
                    onClick={handleCopyBookingInfo}
                  >
                    {copiedBookingRef ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copiedBookingRef ? 'คัดลอกข้อมูลเรียบร้อย!' : 'คัดลอกข้อมูลการจอง'}</span>
                  </button>

                  <a href={`tel:${storeInfo.phone}`} className="cat-success-act-btn tel">
                    <Phone size={16} /> <span>โทรยืนยันกับทางร้าน ({storeInfo.phone})</span>
                  </a>

                  <button
                    type="button"
                    className="cat-success-act-btn close"
                    onClick={() => setIsModalOpen(false)}
                  >
                    เสร็จสิ้น / ปิดหน้าต่าง
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

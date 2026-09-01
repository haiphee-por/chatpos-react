import React, { useState, useEffect } from 'react'
import {
  Search,
  MapPin,
  Clock,
  Phone,
  MessageCircle,
  Share2,
  ChevronRight,
  Sparkles,
  X,
  Copy,
  Check,
  Coffee,
  Heart,
  Layers
} from 'lucide-react'
import { generateUrlQrDataUrl } from './promptpay'

export interface CatalogProduct {
  id: string
  name: string
  nameEn?: string
  category: 'drink' | 'bakery' | 'food' | 'special' | 'service'
  price: number
  description: string
  ingredients?: string
  calories?: string
  tag?: string
  imgUrl: string
}

const defaultProductsCatalog: CatalogProduct[] = [
  {
    id: 'cat-1',
    name: 'Espresso ร้อน',
    nameEn: '(Hot Espresso)',
    category: 'drink',
    price: 55,
    description: 'ช็อตกาแฟสกัดสด ครีม่าสีทองหนานุ่ม บอดี้แน่น หอมอโรมา เมล็ด Specialty อาราบิก้า 100%',
    ingredients: 'Specialty Arabica Blend 100%, Double Espresso Shot',
    calories: '10 kcal',
    imgUrl: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=700&auto=format&fit=crop&q=80'
  },
  {
    id: 'cat-2',
    name: 'Iced Americano',
    nameEn: '(กาแฟดำเย็น)',
    category: 'drink',
    price: 65,
    description: 'คั่วเข้มหอมกรุ่น สดชื่น เมล็ดอาราบิก้าแท้ 100% สกัดช็อตเข้มข้น รสชาตินุ่มลึก ไม่เปรี้ยว',
    ingredients: 'Arabica 100%, Double Espresso Shot, Mineral Water',
    calories: '15 kcal',
    imgUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=700&auto=format&fit=crop&q=80'
  },
  {
    id: 'cat-3',
    name: 'Iced Matcha Latte',
    nameEn: '(มัทฉะลาเต้)',
    category: 'drink',
    price: 75,
    description: 'ชาเขียวมัทฉะแท้เกรดพรีเมียมนำเข้าจากเมืองอูจิ เกียวโต ชงสดชามต่อชาม ผสานนมสดฮอกไกโดนุ่มละมุน',
    ingredients: 'Uji Matcha 100%, Fresh Hokkaido Milk, Pure Cane Sugar',
    calories: '120 kcal',
    imgUrl: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=700&auto=format&fit=crop&q=80'
  },
  {
    id: 'cat-4',
    name: 'Croissant เนยสดแท้',
    nameEn: '(Butter Croissant)',
    category: 'bakery',
    price: 65,
    description: 'ครัวซองต์สไตล์ฝรั่งเศสแท้ ใช้เนยนำเข้าจากฝรั่งเศส 100% อบสดใหม่ทุกเช้า แป้งกรอบนอกฟูนุ่มชุ่มเนย',
    ingredients: 'French Flour, AOP Butter 82%, Sea Salt, Yeast',
    calories: '230 kcal',
    imgUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=700&auto=format&fit=crop&q=80'
  },
  {
    id: 'cat-5',
    name: 'Cheesecake หน้าไหม้',
    nameEn: '(Basque Cheesecake)',
    category: 'bakery',
    price: 120,
    description: 'ชีสเค้กหน้าไหม้สไตล์บาสก์ เนื้อเนียนนุ่มละลายในปาก หอมชีสเข้มข้น ท็อปด้วยบลูเบอร์รี่สด',
    ingredients: 'Cream Cheese, Heavy Cream, Eggs, Vanilla, Blueberries',
    calories: '310 kcal',
    imgUrl: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=700&auto=format&fit=crop&q=80'
  },
  {
    id: 'cat-6',
    name: 'Iced Caramel Macchiato',
    nameEn: '(คาราเมล มัคคิอาโต้)',
    category: 'drink',
    price: 85,
    description: 'ความลงตัวของนมสด วานิลลาไซรัป ช็อตเอสเพรสโซเข้มข้น และราดด้วยซอสคาราเมลโฮมเมดหอมหวาน',
    ingredients: 'Vanilla Syrup, Steamed Milk, Espresso Shot, Homemade Caramel Drizzle',
    calories: '180 kcal',
    imgUrl: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=700&auto=format&fit=crop&q=80'
  },
  {
    id: 'cat-7',
    name: 'สปาเก็ตตี้คาโบนาร่าเบคอนกรอบ',
    nameEn: '(Spaghetti Carbonara Crispy Bacon)',
    category: 'food',
    price: 145,
    description: 'เส้นสปาเก็ตตี้เหนียวนุ่ม ผัดซอสไข่และชีสพาเมซานแท้ เข้มข้น โรยหน้าด้วยเบคอนอบกรอบหอมฟุ้ง',
    ingredients: 'Durum Wheat Spaghetti, Egg Yolk, Parmesan Cheese, Smoked Bacon, Black Pepper',
    calories: '450 kcal',
    imgUrl: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=700&auto=format&fit=crop&q=80'
  },
  {
    id: 'cat-8',
    name: 'Garlic Cream Cheese Bun',
    nameEn: '(ขนมปังกระเทียมครีมชีสเกาหลี)',
    category: 'bakery',
    price: 85,
    description: 'ขนมปังบริยอชนุ่ม ไส้ครีมชีสการ์ลิกเนยสดฉ่ำๆ อบจนผิวนอกกรอบสีทอง หอมกลิ่นกระเทียมและพาสลีย์',
    ingredients: 'Soft Brioche, Philadelphia Cream Cheese, Fresh Garlic, Parsley, Butter',
    calories: '320 kcal',
    imgUrl: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=700&auto=format&fit=crop&q=80'
  },
  {
    id: 'cat-9',
    name: 'Yuzu Sparkling Espresso',
    nameEn: '(ยูซุ สปาร์คกลิ้ง)',
    category: 'drink',
    price: 90,
    description: 'น้ำส้มยูซุแท้ 100% จากญี่ปุ่นผสมโซดาซ่าสดชื่น ท็อปด้วยกาแฟเอสเพรสโซช็อต สดชื่นกระปรี้กระเปร่า',
    ingredients: 'Japanese Yuzu Puree, Soda Water, Espresso Shot, Rosemary',
    calories: '65 kcal',
    imgUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=700&auto=format&fit=crop&q=80'
  }
]

export function CatalogPageView() {
  const [pathname] = useState(window.location.pathname)
  const currentSlug = pathname.replace(/^\//, '').split('?')[0] || 'catalog-page'

  // Load SalesPage configuration if generated from Merchant Sales Page Feature
  const [salesPageData] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('merchant_sales_pages')
      if (saved) {
        const pages = JSON.parse(saved)
        if (Array.isArray(pages)) {
          const match = pages.find((p: any) => p.slug === currentSlug || `/${p.slug}` === pathname)
          if (match) return match
        }
      }
    } catch (e) {}
    return null
  })

  const [activeCategory, setActiveCategory] = useState<'all' | 'drink' | 'bakery' | 'food'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [copiedLink, setCopiedLink] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [isStoreBookmarked, setIsStoreBookmarked] = useState(false)

  // Store metadata
  const storeInfo = {
    name: salesPageData?.title || 'POP CAFE & BAKERY',
    branch: '(สาขาเอกมัย)',
    slogan: salesPageData?.description || 'Specialty Coffee, Artisan Bakery & Brunch All Day ☕🥐',
    description: salesPageData?.customBio || 'ร้านกาแฟและเบเกอรี่สไตล์โมเดิร์น เสิร์ฟกาแฟคัดสรรพิเศษ อบขนมสดใหม่ทุกเช้า พร้อมบรรยากาศผ่อนคลายสำหรับทำงานและสังสรรค์',
    location: salesPageData?.location || '128 ถ. สุขุมวิท ซอย 63 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110',
    openHours: 'เปิดบริการทุกวัน 07:30 - 18:30 น.',
    phone: salesPageData?.phone || '082-345-6789',
    lineUrl: salesPageData?.lineUrl || 'https://line.me/ti/p/~@chatpos',
    rating: '4.9',
    reviewCount: '1,240+',
    coverUrl: salesPageData?.coverUrl || 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1600&auto=format&fit=crop&q=80',
    logoUrl: salesPageData?.logoUrl || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80'
  }

  // Load custom products from Merchant Catalog if available
  const [productsList] = useState<CatalogProduct[]>(() => {
    try {
      const saved = localStorage.getItem('pos_products_catalog')
      if (saved) {
        const parsed = JSON.parse(saved)
        const filtered = parsed.filter((p: any) => p.category !== 'service')
        if (filtered.length > 0) {
          return filtered.map((p: any, idx: number) => ({
            id: p.id || `p-${idx}`,
            name: p.name,
            nameEn: p.nameEn || '',
            category: p.category || 'drink',
            price: Number(p.price) || 50,
            description: p.description || 'สินค้าคุณภาพคัดสรรพิเศษจากทางร้าน',
            ingredients: p.ingredients || 'วัตถุดิบคัดสรรพรีเมียม สดใหม่ สะอาด',
            calories: p.calories || '150 kcal',
            tag: p.tag || '',
            imgUrl: p.imgUrl || p.image || defaultProductsCatalog[idx % defaultProductsCatalog.length].imgUrl
          }))
        }
      }
    } catch (e) {}
    return defaultProductsCatalog
  })

  // Generate QR for Share Modal
  useEffect(() => {
    if (isShareModalOpen) {
      const currentUrl = window.location.href
      generateUrlQrDataUrl(currentUrl, 260)
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error('Error generating QR:', err))
    }
  }, [isShareModalOpen])

  const toggleFavorite = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFavoriteIds(prev => 
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    )
  }

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: storeInfo.name,
          text: `${storeInfo.name} - ${storeInfo.slogan}`,
          url: window.location.href,
        })
      } catch (err) {
        console.log('Share canceled or error:', err)
      }
    } else {
      handleCopyLink()
    }
  }

  // Filter products by category and search
  const filteredProducts = productsList.filter(item => {
    const matchCategory = activeCategory === 'all' || item.category === activeCategory
    const matchSearch = searchQuery.trim() === '' || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.nameEn && item.nameEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCategory && matchSearch
  })

  if (process.env.NODE_ENV === 'production' && !salesPageData) {
    return (
      <main className="cat-page-wrapper cat-unavailable-state" aria-labelledby="catalog-unavailable-title">
        <section className="cat-center-container">
          <div className="cat-store-profile-card">
            <h1 id="catalog-unavailable-title">หน้านี้ยังไม่พร้อมใช้งาน</h1>
            <p>ยังไม่มีหน้าร้านหรือรายการสินค้าที่เผยแพร่สำหรับลิงก์นี้</p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <div className="cat-page-wrapper">
      {/* 1. Hero Cover Section */}
      <section className="cat-hero-cover-section">
        <div className="cat-hero-bg-wrapper">
          <img src={storeInfo.coverUrl} alt="Store Cover" className="cat-hero-bg-img" />
          <div className="cat-hero-gradient-overlay" />
        </div>

        <div className="cat-hero-top-bar">
          <div className="cat-hero-status-pill">
            <span className="cat-green-dot" />
            <span>{storeInfo.openHours}</span>
          </div>

          <div className="cat-hero-top-right">
            <button 
              type="button" 
              className={`cat-circle-btn ${isStoreBookmarked ? 'active' : ''}`}
              onClick={() => setIsStoreBookmarked(!isStoreBookmarked)}
              title="บันทึกร้านโปรด"
            >
              <Heart size={16} fill={isStoreBookmarked ? '#ef4444' : 'none'} color={isStoreBookmarked ? '#ef4444' : '#1e293b'} />
            </button>

            <button 
              type="button" 
              className="cat-circle-btn"
              onClick={() => setIsShareModalOpen(true)}
              title="แชร์หน้าร้าน"
            >
              <Share2 size={16} color="#1e293b" />
            </button>
          </div>
        </div>
      </section>

      {/* 2. Main Center Content Container */}
      <div className="cat-center-container">
        {/* Floating Store Profile Card */}
        <div className="cat-store-profile-card">
          <div className="cat-profile-header-row">
            <div className="cat-avatar-frame">
              <img src={storeInfo.logoUrl} alt="Store Logo" />
              <span className="cat-avatar-label">VERIFIED</span>
            </div>

            <div className="cat-profile-details">
              <div className="cat-title-rating-row">
                <h1 className="cat-profile-title">
                  {storeInfo.name} <span className="cat-branch-tag">{storeInfo.branch}</span>
                </h1>
                <span className="cat-rating-pill">⭐ {storeInfo.rating} ({storeInfo.reviewCount})</span>
              </div>

              <p className="cat-profile-desc">{storeInfo.slogan}</p>

              <div className="cat-compact-meta-row">
                <span className="cat-meta-chip">
                  <MapPin size={12} className="cat-meta-icon" /> {storeInfo.location.split(' ')[0]} {storeInfo.location.split(' ')[1] || ''}
                </span>
                <span className="cat-meta-chip">
                  <Clock size={12} className="cat-meta-icon" /> {storeInfo.openHours}
                </span>
              </div>
            </div>
          </div>

          {/* 4 Action Pills */}
          <div className="cat-store-actions-grid">
            <a href={storeInfo.lineUrl} target="_blank" rel="noreferrer" className="cat-store-btn line-solid">
              <MessageCircle size={14} /> <span>LINE สั่งซื้อ</span>
            </a>

            <a href={`tel:${storeInfo.phone}`} className="cat-store-btn outline">
              <Phone size={14} /> <span>โทร {storeInfo.phone}</span>
            </a>

            <a 
              href={`https://maps.google.com/?q=${encodeURIComponent(storeInfo.location)}`} 
              target="_blank" 
              rel="noreferrer" 
              className="cat-store-btn outline"
            >
              <MapPin size={14} /> <span>แผนที่ร้าน</span>
            </a>

            <button type="button" className="cat-store-btn outline" onClick={() => setIsShareModalOpen(true)}>
              <Share2 size={14} /> <span>แชร์ร้าน</span>
            </button>
          </div>
        </div>

        {/* 3. Promotional Green Ribbon Banner */}
        <div className="cat-promo-ribbon-card" onClick={() => setActiveCategory('bakery')}>
          <div className="cat-promo-left-col">
            <span className="cat-popper-icon">🥐</span>
            <div className="cat-promo-text-group">
              <h4>อบสดใหม่ทุกเช้า หอมกรุ่นจากเตา</h4>
              <p>ใช้วัตถุดิบเนยแท้ AOP 100% จากฝรั่งเศส ลิ้มลองความกรอบนอกนุ่มใน</p>
            </div>
          </div>
          <div className="cat-promo-right-col">
            <span className="cat-gift-art">✨</span>
            <ChevronRight size={18} className="cat-promo-arrow" />
          </div>
        </div>

        {/* 4. Menu Showcase Section */}
        <section className="cat-menu-showcase-section">
          <div className="cat-menu-header-row">
            <div className="cat-menu-title-left">
              <Sparkles size={18} color="#059669" />
              <h3>รายการเมนู & สินค้าของทางร้าน</h3>
            </div>
            <button 
              type="button" 
              className="cat-view-all-link"
              onClick={() => { setActiveCategory('all'); setSearchQuery(''); }}
            >
              <span>ดูทั้งหมด ({productsList.length})</span> <ChevronRight size={13} />
            </button>
          </div>

          {/* Search Pill */}
          <div className="cat-search-pill-box">
            <Search size={15} className="cat-search-glass-icon" />
            <input 
              type="text" 
              placeholder="ค้นหาชื่อเมนู, เครื่องดื่ม, หรือเบเกอรี่..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button type="button" className="cat-search-clear-btn" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="cat-tabs-pill-row">
            <button 
              type="button" 
              className={`cat-tab-pill ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              <Layers size={13} /> <span>ทั้งหมด ({productsList.length})</span>
            </button>
            <button 
              type="button" 
              className={`cat-tab-pill ${activeCategory === 'drink' ? 'active' : ''}`}
              onClick={() => setActiveCategory('drink')}
            >
              <Coffee size={13} /> <span>☕ เครื่องดื่ม</span>
            </button>
            <button 
              type="button" 
              className={`cat-tab-pill ${activeCategory === 'bakery' ? 'active' : ''}`}
              onClick={() => setActiveCategory('bakery')}
            >
              <span>🥐 เบเกอรี่ & ขนม</span>
            </button>
            <button 
              type="button" 
              className={`cat-tab-pill ${activeCategory === 'food' ? 'active' : ''}`}
              onClick={() => setActiveCategory('food')}
            >
              <span>🍝 อาหาร & บรันช์</span>
            </button>
          </div>

          {/* 3-Column Products Grid */}
          {filteredProducts.length === 0 ? (
            <div className="cat-empty-results-box">
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
              <h4>ไม่พบเมนูที่ตรงกับคำค้นหา "{searchQuery}"</h4>
              <p>ลองเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่อื่นดูครับ</p>
              <button 
                type="button" 
                className="cat-reset-search-btn"
                onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
              >
                แสดงสินค้าทั้งหมด
              </button>
            </div>
          ) : (
            <div className="cat-products-grid">
              {filteredProducts.map((item) => (
                <div 
                  key={item.id} 
                  className="cat-product-show-card"
                  onClick={() => setSelectedProduct(item)}
                >
                  <div className="cat-product-media-box">
                    <img src={item.imgUrl} alt={item.name} />
                    {item.tag && <span className="cat-badge-service-tag">{item.tag}</span>}
                    <button 
                      type="button" 
                      className="cat-item-fav-btn"
                      onClick={(e) => toggleFavorite(item.id, e)}
                    >
                      <Heart size={13} fill={favoriteIds.includes(item.id) ? '#ef4444' : 'none'} color={favoriteIds.includes(item.id) ? '#ef4444' : '#64748b'} />
                    </button>
                  </div>

                  <div className="cat-product-info-box">
                    <h4 className="cat-item-name">{item.name}</h4>
                    {item.nameEn && <span className="cat-item-sub">{item.nameEn}</span>}
                    <p className="cat-item-desc">{item.description}</p>

                    <div className="cat-item-bottom-row">
                      <div className="cat-price-col">
                        <span className="cat-price-caption">ราคา</span>
                        <strong className="cat-item-price">฿{item.price.toLocaleString()}</strong>
                      </div>
                      <button type="button" className="cat-item-detail-pill">
                        <span>ดูข้อมูล</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 5. Facilities & Services 4 Cards */}
        <section className="cat-facilities-section-card">
          <div className="cat-facility-four-grid">
            <div className="cat-facility-box">
              <div className="cat-facility-icon-circle">☕</div>
              <h4>เมล็ดกาแฟ Specialty</h4>
              <p>คัดสรรจากดอยช้างและนำเข้า เกรด 85+ อาราบิก้าแท้</p>
            </div>
            <div className="cat-facility-box">
              <div className="cat-facility-icon-circle">🥐</div>
              <h4>เนยสดแท้ฝรั่งเศส AOP</h4>
              <p>อบสดใหม่ทุกเช้า หอมเนยแท้ ไม่ใส่สารกันเสีย</p>
            </div>
            <div className="cat-facility-box">
              <div className="cat-facility-icon-circle">📶</div>
              <h4>Wi-Fi & ปลั๊กไฟครบ</h4>
              <p>บรรยากาศเงียบสงบ เหมาะสำหรับนั่งทำงาน อ่านหนังสือ</p>
            </div>
            <div className="cat-facility-box">
              <div className="cat-facility-icon-circle">🚗</div>
              <h4>ที่จอดรถสะดวก</h4>
              <p>มีลานจอดรถรองรับลูกค้าหน้าร้านได้กว่า 15 คัน</p>
            </div>
          </div>
        </section>
      </div>

      {/* 6. Clean Minimal Footer */}
      <footer className="cat-main-footer">
        <div className="cat-footer-inner-col">
          <div className="cat-footer-simple-card">
            <div className="cat-footer-brand-snippet">
              <div className="cat-footer-mini-avatar">
                <img src={storeInfo.logoUrl} alt="Store Mini Logo" />
              </div>
              <div>
                <h4>{storeInfo.name}</h4>
                <small>📍 {storeInfo.location}</small>
              </div>
            </div>

            <div className="cat-footer-quick-chips">
              <a href={storeInfo.lineUrl} target="_blank" rel="noreferrer" className="cat-footer-chip">
                <MessageCircle size={13} /> <span>LINE Official</span>
              </a>
              <a href={`tel:${storeInfo.phone}`} className="cat-footer-chip">
                <Phone size={13} /> <span>{storeInfo.phone}</span>
              </a>
            </div>
          </div>

          <div className="cat-footer-bottom-bar">
            <span>© {new Date().getFullYear()} {storeInfo.name} · Digital Storefront Catalog</span>
            <strong>Powered by ChatPOS</strong>
          </div>
        </div>
      </footer>

      {/* 7. Product Details Lightbox Modal */}
      {selectedProduct && (
        <div className="cat-modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="cat-modal-dialog clean-modern-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              type="button" 
              className="cat-modal-close"
              onClick={() => setSelectedProduct(null)}
            >
              ✕
            </button>

            <div className="cat-modal-media-frame">
              <img src={selectedProduct.imgUrl} alt={selectedProduct.name} />
              {selectedProduct.calories && (
                <span className="cat-modal-cal-tag">{selectedProduct.calories}</span>
              )}
            </div>

            <div className="cat-modal-info-wrap">
              <div className="cat-modal-title-price-row">
                <div>
                  <h3 className="cat-modal-h3">{selectedProduct.name}</h3>
                  {selectedProduct.nameEn && <small className="cat-modal-en-sub">{selectedProduct.nameEn}</small>}
                </div>
                <strong className="cat-modal-price-val">฿{selectedProduct.price.toLocaleString()}</strong>
              </div>

              <div className="cat-modal-line-sep" />

              <div className="cat-modal-text-block">
                <h5>รายละเอียดเมนู</h5>
                <p>{selectedProduct.description}</p>
              </div>

              {selectedProduct.ingredients && (
                <div className="cat-modal-text-block">
                  <h5>🌿 วัตถุดิบ & ส่วนประกอบสำคัญ</h5>
                  <p className="cat-ing-text">{selectedProduct.ingredients}</p>
                </div>
              )}

              <div className="cat-modal-action-btns-row">
                <a 
                  href={`${storeInfo.lineUrl}?text=${encodeURIComponent(`สวัสดีครับ สนใจสอบถาม/สั่งซื้อเมนู: ${selectedProduct.name} (฿${selectedProduct.price})`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="cat-modal-line-cta"
                >
                  <MessageCircle size={16} /> <span>สั่งซื้อ / สอบถามผ่าน LINE</span>
                </a>

                <button 
                  type="button" 
                  className="cat-modal-share-cta"
                  onClick={() => {
                    setSelectedProduct(null)
                    setIsShareModalOpen(true)
                  }}
                >
                  <Share2 size={16} /> <span>แชร์เมนูนี้</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Share Store Modal */}
      {isShareModalOpen && (
        <div className="cat-modal-overlay" onClick={() => setIsShareModalOpen(false)}>
          <div className="cat-modal-dialog share-clean-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              type="button" 
              className="cat-modal-close"
              onClick={() => setIsShareModalOpen(false)}
            >
              ✕
            </button>

            <div className="cat-share-box-inner">
              <div className="cat-share-top-text">
                <h3>แชร์หน้าร้าน {storeInfo.name}</h3>
                <p>สแกน QR Code หรือคัดลอกลิงก์เพื่อส่งต่อให้เพื่อน</p>
              </div>

              <div className="cat-share-qr-container">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="Store QR Code" className="cat-share-qr-image" />
                ) : (
                  <div className="cat-qr-loading-text">กำลังสร้าง QR Code...</div>
                )}
              </div>

              <div className="cat-copy-url-group">
                <input 
                  type="text" 
                  readOnly 
                  value={window.location.href} 
                  className="cat-url-readonly-input"
                />
                <button 
                  type="button" 
                  className={`cat-copy-url-btn ${copiedLink ? 'copied' : ''}`}
                  onClick={handleCopyLink}
                >
                  {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedLink ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                </button>
              </div>

              <div className="cat-share-buttons-stack">
                <button 
                  type="button" 
                  className="cat-share-action-btn sheet"
                  onClick={handleNativeShare}
                >
                  <Share2 size={15} /> <span>แชร์ไปยังแอปอื่น (Share Sheet)</span>
                </button>

                <a 
                  href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="cat-share-action-btn line"
                >
                  <MessageCircle size={15} /> <span>แชร์ลง LINE</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

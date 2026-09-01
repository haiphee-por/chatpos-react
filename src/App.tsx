import { useState, useEffect } from 'react'
import { MerchantView } from './MerchantView'
import { MerchantRegistrationView } from './MerchantRegistrationView'
import { LoginView } from './AuthViews'
import { CustomerView } from './CustomerView'
import { QuickPayView } from './QuickPayView'
import { CatalogPageView } from './CatalogPageView'
import { BookingPageView } from './BookingPageView'
import { DeveloperConsoleView } from './DeveloperConsoleView'
import { LandingPageView } from './LandingPageView'
import { TableOrderView } from './TableOrderView'
import { fetchDbHealth, fetchDbStats, getServerSession, setStoredUser, type AuthUser, type DbHealth, type DbStats } from './dbApi'

export function App() {
  const [pathname] = useState(window.location.pathname)

  // Live Database stats
  const [, setDbHealth] = useState<DbHealth | null>(null)
  const [, setDbStats] = useState<DbStats | null>(null)

  useEffect(() => {
    fetchDbHealth().then(setDbHealth).catch(() => {})
  }, [])

  // The server session is authoritative; localStorage is only a display cache.
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    getServerSession()
      .then((session) => {
        setCurrentUser(session.success ? session.user : null)
        if (session.success && session.user) {
          setStoredUser(session.user)
          if (session.user.role === 'admin' || session.user.role === 'compliance') {
            fetchDbStats().then(setDbStats).catch(() => {})
          }
        }
      })
      .catch(() => setCurrentUser(null))
      .finally(() => setSessionReady(true))
  }, [])

  // 1. Dedicated Service Booking Engine Route (/booking, /book, /services, /appointment)
  if (
    pathname === '/booking' ||
    pathname === '/book' ||
    pathname === '/services' ||
    pathname === '/appointment' ||
    pathname.startsWith('/booking') ||
    pathname.startsWith('/appointment')
  ) {
    return <BookingPageView />
  }

  // 2. Dedicated Sales Pages & Digital Catalog Showcase (/catalog-page, /sales-page, custom sales page slugs)
  const isCatalogOrSalesPageRoute = (() => {
    if (
      pathname === '/catalog-page' ||
      pathname === '/catalog' ||
      pathname === '/sales-page' ||
      pathname === '/salespage' ||
      pathname === '/showcase' ||
      pathname.startsWith('/catalog') ||
      pathname.startsWith('/sales') ||
      pathname.startsWith('/page/') ||
      pathname.startsWith('/sp/')
    ) {
      return true
    }

    try {
      const savedSalesPages = localStorage.getItem('merchant_sales_pages')
      if (savedSalesPages) {
        const salesPages = JSON.parse(savedSalesPages)
        if (Array.isArray(salesPages) && salesPages.some((p: any) => `/${p.slug}` === pathname || `/${p.slug}` === pathname.replace(/\/$/, ''))) {
          return true
        }
      }
    } catch (e) {}

    return false
  })()

  if (isCatalogOrSalesPageRoute) {
    return <CatalogPageView />
  }

  // 3. Token-bound table ordering must be resolved before broad customer routes.
  const tableOrderTokenMatch = pathname.match(/^\/order\/([^/]+)\/?$/)
  if (tableOrderTokenMatch) {
    return <TableOrderView token={tableOrderTokenMatch[1]} />
  }

  // 4. Customer In-Store / Table Dining & Order Route (/customer, /order, /table/:id)
  if (
    pathname === '/customer' ||
    pathname === '/order' ||
    pathname === '/delivery' ||
    pathname === '/takeaway' ||
    pathname.startsWith('/c/') ||
    pathname.startsWith('/t') ||
    pathname.startsWith('/order')
  ) {
    return <CustomerView />
  }

  // 5. QuickPay & Cashier Direct Link (/quickpay, /pay, /shop)
  if (
    pathname === '/shop' ||
    pathname === '/quickpay' ||
    pathname === '/pay' ||
    pathname === '/kiosk' ||
    pathname === '/display' ||
    pathname.startsWith('/pay/') ||
    pathname.startsWith('/s/') ||
    pathname.startsWith('/shop')
  ) {
    return <QuickPayView />
  }

  // 5. Developer & API Playground (Protected Route: ONLY visible when logged in)
  if (pathname === '/developer' || pathname.startsWith('/developer')) {
    if (!sessionReady) return null
    if (!currentUser) {
      return <LandingPageView />
    }
    return <DeveloperConsoleView />
  }

  // 6. Merchant Registration
  if (pathname === '/merchant/register' || pathname === '/register') {
    return <MerchantRegistrationView />
  }

  // 7. Merchant Login must come before the broad /merchant/* dashboard route.
  if (pathname === '/merchant/login') {
    return <LoginView role="merchant" />
  }

  // 8. Merchant Backoffice Dashboard (/merchant)
  if (pathname === '/merchant' || pathname.startsWith('/merchant/')) {
    if (!sessionReady) return null
    if (!currentUser) return <LandingPageView />
    return <MerchantView currentUser={currentUser} />
  }

  // 9. Default Pre-Login Landing & Interactive Sign-In Screen (/, /login, /landing)
  return <LandingPageView />
}

export default App

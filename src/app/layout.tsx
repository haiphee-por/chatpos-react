import type { Metadata } from 'next'
import '../../src/index.css'
import '../../src/App.css'
import '../../src/AuthViews.css'
import '../../src/BookingPageView.css'
import '../../src/CatalogPageView.css'
import '../../src/CustomerView.css'
import '../../src/DeveloperConsoleView.css'
import '../../src/LandingPageView.css'
import '../../src/MerchantRegistrationView.css'
import '../../src/MerchantView.css'
import '../../src/MerchantOperationsView.css'
import '../../src/QuickPayView.css'
import '../../src/TableOrderView.css'

export const metadata: Metadata = {
  title: 'ChatPOS',
  description: 'ระบบจัดการร้านค้าและการชำระเงิน ChatPOS',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}

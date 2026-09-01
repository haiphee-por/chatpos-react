# ChatPOS Merchant UI Implementation Roadmap

เอกสารนี้เป็น roadmap หลักสำหรับนำ UI และ interaction ที่ Manager ออกแบบไว้ใน `chatpos-payment-ai-main` เข้ามา implement ใน `chatpos-react` โดยเริ่มจาก Merchant Home และขยายไปยัง payment, orders, tables, catalog, services และ settings. ให้ใช้คู่กับ [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md), [NEXT_STEPS_CHECKLIST.md](NEXT_STEPS_CHECKLIST.md) และ integration contract ที่เกี่ยวข้อง

> สถานะเอกสาร: Draft สำหรับแตกงาน Product, UX/UI, Frontend, Backend และ QA
>
> อัปเดตล่าสุด: 2026-09-01

> Visual source ปัจจุบัน: ใช้หน้าและ style ที่รันจาก `chatpos-payment-ai-main/app/page.tsx` กับ `app/globals.css` เท่านั้น. `docs/419449.jpg` และ `docs/base.html` เป็น artifact เก่าและไม่ใช้ตัดสิน visual parity หรือ acceptance อีกต่อไป

## สถานะ implementation ที่ตรวจจากโค้ดจริง (2026-09-01)

ตารางนี้เป็นสถานะล่าสุดของ Merchant route และมี precedence เหนือ baseline/historical note ที่อยู่ช่วงท้ายเอกสาร. คำว่า "มี UI" ไม่เท่ากับ "ใช้งานจริง": ต้องดู source ของข้อมูล, mutation, persistence, capability และ external dependency ของแต่ละ route ด้วย

| Route | UI ปัจจุบัน | Logic/data authority | สถานะใช้จริง | สิ่งที่ยังขาด |
|---|---|---|---|---|
| `/merchant/home` | Payment AI header, balance strip, assistant card, payment tiles และ bottom nav | `/api/db/home`, notifications และ Store-scoped capability | **ใช้ได้เมื่อ Home contract เปิด** | Store/session/timeout browser matrix และ rollout evidence |
| `/merchant/payment` | Payment AI amount, channel picker, keypad, QR/result modal | `createTransactionCommand`, idempotency key, status polling และ persisted Transaction | **logic implement แล้ว แต่ขึ้นกับ integration readiness** | ต้องเปิด transaction routing/query flags, Store credential, Backoffice/LLGW และ webhook/reconcile ที่ผ่าน staging |
| `/merchant/transactions` | filter, search และ responsive transaction cards/table | Store-scoped `/api/db/transactions` | **ใช้ได้แบบ read-only** | detail view, pagination UX, export และ browser permission evidence |
| `/merchant/products` | product/stock list, filter, create/edit modal | PostgreSQL Product API, Store ownership และ optimistic `updatedAt` conflict | **ใช้ได้บางส่วน** | delete/bulk import/export, category persistence, private image upload และ history; ปุ่ม import/export ถูก disable แล้ว ไม่แสดง fake success |
| `/merchant/reports` | Payment AI cards และรายการล่าสุด | `/api/db/home` + `/api/db/transactions` | **ใช้ได้บางส่วนแบบ read-only** | date range, real chart/top-product aggregation และ export API |
| `/merchant/wallet` | balance metrics, transaction list และ unavailable payout panel | `/api/db/home` + `/api/db/transactions` | **ดูข้อมูลได้; ถอนเงินยังใช้ไม่ได้** | verified bank account model, OTP, durable withdrawal ledger, provider result และ reconciliation |
| `/merchant/kyc` | KYC workspace, document timeline/version และ chat | PostgreSQL KYC APIs, Store/Case authorization, signed Backoffice integration | **implement แล้วแบบ feature/integration-gated** | private storage/scanner/encryption และ Backoffice staging evidence ก่อน production sign-off |
| `/merchant/settings` | account entry, notification/audio/QR preference UI | session/profile display บางส่วน; client state สำหรับ preference หลายรายการ | **ใช้ได้บางส่วน** | profile/preference/password mutation contract; language/theme/notification preference ยังไม่ persist จริง |
| `/merchant/pos` | POS demo surface | DB Product read บางส่วน แต่ cart/order/receipt/hold bill ยังเป็น client/localStorage | **development demo เท่านั้น** | POS/order/table/payment persistence และ settlement; production แสดง unavailable |
| `/merchant/orders` | order/QR demo surface | hardcoded/localStorage | **development demo เท่านั้น** | Order API, Store authorization, status mutation, idempotency และ race handling; production แสดง unavailable |
| `/merchant/services` | service/booking demo surface | hardcoded/localStorage | **development demo เท่านั้น** | Service/availability/booking schema และ API; production แสดง unavailable |
| `/merchant/salespage` | sales page builder demo | hardcoded/localStorage | **development demo เท่านั้น** | published page API, durable content, domain/slug ownership, analytics และ payment linkage; production แสดง unavailable |
| `/merchant/tables` | Payment AI unavailable state | ไม่มี Table API/view | **ยังใช้ไม่ได้** | Table CRUD, token/QR ownership, order linkage และ persistence |
| `/merchant/benefits` | Payment AI unavailable state | มี capability/read API แต่ยังไม่มี Merchant view | **ยังใช้ไม่ได้จาก UI** | benefits list/detail/eligibility UI และ empty/error/pagination evidence |
| `/merchant/stoppay` | Payment AI unavailable state | มี server state machine และ idempotent API แต่ยังไม่มี Merchant view | **ยังใช้ไม่ได้จาก UI** | status/reason view, confirmation/recovery policy และ role transition UX |
| `/merchant/billing` | Payment AI unavailable state | มี capability flag แต่ยังไม่มี billing authority/view | **ยังใช้ไม่ได้** | invoice/fee source, Finance sign-off, reconciliation และ download contract |
| `/merchant/developer` | authenticated compatibility/testing console | server-session API บางส่วนและ development examples | **เครื่องมือนักพัฒนา ไม่ใช่ Merchant production workflow** | real key/webhook management และ telemetry owner; ห้าม persist secret ใน browser |

สถานะข้าม route ที่ใช้ได้จริงแล้ว:

- Server session ผ่าน HttpOnly cookie, Store ownership, role/capability guard และ active URL mapping ใช้ logic ของ `chatpos-react`
- Merchant Home notification ใช้ Store/recipient-scoped API พร้อม mark-one/read-all และ retry
- Payment UI นำเฉพาะ visual language จาก reference; transaction command, idempotency, status และ error state ยังคงใช้ implementation ของ `chatpos-react`
- Bottom navigation ใช้ `merchantNavigation.ts` ชุดเดียวกันทุก route และ route ที่ไม่มี logic จริงต้องแสดง unavailable แทน success/demo ใน production
- UI shell ของ Home, QuickPay, Transactions, Products, Finance, Settings และ unavailable state ใช้ Payment AI visual language แล้ว; KYC คง workflow/inline state เดิมภายใต้ shell ใหม่เพื่อไม่กระทบ document security flow

## 0. Reference source และกติกาการนำเข้า

`chatpos-payment-ai-main` เป็น reference project สำหรับ visual language, layout และ interaction ของ Merchant UI โดยจุดอ้างอิงหลักคือ [`app/page.tsx`](../../chatpos-payment-ai-main/app/page.tsx), [`app/globals.css`](../../chatpos-payment-ai-main/app/globals.css) และ asset ใน `chatpos-payment-ai-main/public/`. โปรเจกต์นี้มี mock/seeded data และ `localStorage` persistence บางส่วน จึงใช้เป็นต้นแบบ UX เท่านั้น ไม่ใช่ source of truth ของข้อมูลธุรกิจหรือ authorization

กติกาที่ต้องใช้ทุกครั้งเมื่อมี UI ใหม่จาก reference:

- ใช้ `chatpos-react` เป็น source of truth ของ server session, role, Store ownership, API, PostgreSQL, payment, KYC, assignment และ audit
- นำเข้าเฉพาะ visual, component behavior และ client interaction ที่ไม่ขัดกับ contract ของ `chatpos-react`
- ห้ามนำ `seededProducts`, `seededTransactions`, mock orders/tables, fake balance หรือ mock success state มาเป็น production fallback
- `localStorage` ใช้ได้เฉพาะ draft และ UI preference ที่ไม่มีผลทางธุรกิจ; server state ต้องอ่าน/เขียนผ่าน API
- ทุกเมนูต้องมี target, owner, permission, loading, empty, error และ unavailable behavior ก่อนเปิดให้ผู้ใช้เห็นเป็น feature พร้อมใช้
- ถ้า reference มี business behavior ที่ `chatpos-react` ยังไม่มี ให้ทำเป็น dependency/decision ก่อน ไม่จำลองผลสำเร็จใน browser

### 0.1 Reference view และ target implementation

| Reference view ใน `chatpos-payment-ai-main` | UI ที่อ้างอิง | Target ใน `chatpos-react` | สถานะข้อมูล |
|---|---|---|---|
| `home` | dashboard, balance, quick actions, header | `MerchantHomeView.tsx` และ `MerchantView.tsx` | server/API เป็น authority |
| `payment`, `method-picker`, `other-methods` | keypad, payment tiles, method picker, QR/checkout | `QuickPayView.tsx`, `chatposApi.ts` | payment API/Backoffice เป็น authority |
| `withdraw` | balance และ withdrawal form | `MerchantView.tsx` wallet/withdraw surface | ใช้ได้เมื่อ withdrawal/OTP/provider contract พร้อม |
| `transactions` | payment history และ status | dedicated transaction view ใน Merchant Portal | transaction query เป็น authority |
| `orders` | order list และ status action | `MerchantView.tsx`/`CustomerView.tsx` | ต้องมี order persistence/API |
| `tables` | table grid, table QR และ table orders | Merchant tables view | ต้องมี table/order owner |
| `pos` | POS shortcut และ cashier entry | `MerchantView.tsx` POS route | server payment flow เป็น authority |
| `product-manager` | product table, category, stock, image modal | `CatalogPageView.tsx` และ Product API | Product API เป็น authority; draft เท่านั้นที่ local |
| `settings` | account, notification และ integration settings | `ProfileSettingsModal.tsx` และ settings view | permission/secret policy เป็น authority |

Reference bottom navigation ใช้ `orders`, `tables`, `home`, `pos` และ `settings`; เมนูเต็มของ `chatpos-react` อยู่ใน [`merchantNavigation.ts`](../src/merchantNavigation.ts). Sidebar, Home shortcut และ mobile bottom navigation ต้องใช้ navigation mapping ชุดเดียวกัน และ browser refresh/Back/Forward ต้องรักษา active route ให้ตรงกัน

### 0.2 วิธีรับ UI ใหม่จาก reference ทีละรอบ

ทุกครั้งที่มีการทยอยแก้ `chatpos-payment-ai-main` ให้แตกงานตามลำดับนี้:

1. บันทึก source ที่อ้างอิง เช่น path, view, component, asset และ behavior ที่เปลี่ยน
2. จัดประเภทการเปลี่ยนแปลงเป็น `visual`, `interaction`, `server state` หรือ `business rule`
3. ตรวจ target route, permission, API owner และ persistence ใน `chatpos-react` ก่อนเริ่มแก้
4. นำเข้า visual และ interaction เฉพาะส่วนที่ไม่ขัดกับ session, Store ownership, payment/KYC contract และ audit policy
5. ทำ state ให้ครบอย่างน้อย `loading`, `ready`, `empty`, `error`, `unavailable` และ `retry` ตาม feature
6. ทดสอบ route จาก menu, Home shortcut, refresh, browser Back/Forward และ mobile/desktop breakpoint
7. ลบหรือกั้น mock state ที่อาจถูกใช้ใน production path แล้วอัปเดตสถานะใน roadmap/checklist

หากเป็น `business rule`, schema, permission, API หรือ state transition ใหม่ ต้องมี decision/contract และ owner ก่อนนำมาแสดงเป็น feature จริง. UI ที่ reference ทำด้วย mock ให้ถือเป็น prototype จนกว่าจะมี server response และ acceptance evidence รองรับ

### 0.3 Milestone สำหรับ implement

| Milestone | สิ่งที่จะนำเข้าจาก reference | ผลลัพธ์ที่ต้องส่งมอบ |
|---|---|---|
| M1 Shell parity | header, color tokens, typography, sidebar, bottom navigation, responsive frame | route/menu ใช้งานได้, active state ตรง URL, refresh/Back/Forward ผ่าน |
| M2 Home parity | Store context, balance summary, quick-action grid, management list, notification/profile entry | Home ใช้ server state, ไม่มี demo data, มี loading/empty/error/unavailable state |
| M3 Payment parity | keypad, method picker, QR/checkout result, payment status | command/query ผ่าน API, idempotency ถูกต้อง, ไม่แสดง paid จาก mock state |
| M4 Operations parity | transaction, orders, tables และ status/filter interaction | read/mutation state มาจาก API, duplicate click/stale response ไม่ทำให้สถานะผิด |
| M5 Catalog parity | product manager, category, stock, image และ service interaction | Product/Service persistence ชัดเจน, localStorage เหลือเฉพาะ draft |
| M6 Account parity | settings, wallet/withdraw, reports, developer entry | capability/feature flag/secret policy ถูกบังคับจาก server |
| M7 Release parity | accessibility, responsive, performance, telemetry, rollback และ mock removal | มี screenshot/E2E/permission evidence และ production path ไม่มี mock authority |

### 0.4 Checklist implement จาก reference

ใช้ checklist นี้เป็นสถานะหลักของงานนำ UI จาก `chatpos-payment-ai-main` เข้ามาใน `chatpos-react`. สถานะ `[x]` หมายถึงมี implementation หรือเอกสารหลักฐานใน repository แล้ว, `[~]` หมายถึงมีบางส่วนแต่ยังขาด contract/evidence/production behavior, และ `[ ]` หมายถึงยังไม่เริ่มหรือยังไม่ผ่านเกณฑ์จบ

#### M1: Shell parity และ navigation

- [x] บันทึก reference view, menu และ target implementation ในหัวข้อ 0.1
- [x] ระบุ source ของ visual reference ใน `chatpos-payment-ai-main/app/page.tsx`, `app/globals.css` และ `public/`
- [x] รวม sidebar, Home shortcut และ `MerchantBottomNavigation` ให้ใช้ navigation mapping ชุดเดียวกันผ่าน `merchantNavigation.ts`
- [~] ให้ URL, active menu, refresh, browser Back และ browser Forward ใช้ state เดียวกัน
- [x] ตรวจทุก target ใน `merchantNavigation.ts` แล้ว: route ที่มี logic render view จริง และ `tables`, `benefits`, `stoppay`, `billing` แสดง unavailable พร้อมเหตุผลเฉพาะ; demo route ถูกกั้นใน production
- [~] ตรวจ mobile bottom navigation ที่ 390px แล้ว ไม่มี horizontal overflow และ touch target หลักไม่น้อยกว่า 44px; ยังต้องตรวจ 430px และ safe-area บนอุปกรณ์จริง
- [ ] แนบ screenshot comparison ของ shell บน mobile และ desktop พร้อม deviation ที่ยอมรับได้

**M1 เสร็จเมื่อ:** เมนูทุกตัวที่แสดงมี target และ active state ถูกต้อง, navigation ไม่ทำให้ URL กับหน้าจอไม่ตรงกัน และมี screenshot evidence ครบ

#### M2: Home parity และ server data

- [x] ปรับ Payment AI header, Store/profile entry, balance summary, assistant action และ payment tile grid โดยไม่ย้าย mock logic จาก reference
- [x] Store selector/profile ใช้ authenticated Store/session state และอยู่ในเมนู AI header; หน้า Home ไม่แสดงชื่อร้าน/ID hardcode
- [x] เชื่อม Home summary กับ `/api/db/home` และ capability/permission ที่เกี่ยวข้อง
- [x] เอา hardcoded store name, Merchant ID, balance, counts และ fake success state ออกจาก Home production path; recent payments อ่านจาก Store-scoped transaction API
- [~] ทำ `loading`, `ready`, `empty`, `error`, `unavailable`, `retry` และ stale state ให้ครบทุก Home data block; Home, notification และ recent payment states มีแล้ว แต่ channel capability/readiness ยังไม่มี server field รองรับ
- [~] ทำ notification/profile/store selector ให้ใช้ data และ mutation จริง ไม่ใช้ static action; notification และ Store selector ใช้ API จริงแล้ว แต่ profile save ยังเป็น prototype และรอ profile mutation contract
- [ ] ทดสอบ Store switch, wrong Store, expired session, no Store และ API timeout

**M2 เสร็จเมื่อ:** Home ใช้ server state ทั้งหมดสำหรับข้อมูลธุรกิจ, ไม่มี mock data ใน production path และทุก card มี state ที่ตรวจสอบได้

#### M3: Payment parity

- [~] ปรับ Payment AI visual layer ของ keypad, amount card, payment channel picker และ modal ใน `QuickPayView.tsx` โดยคง transaction/idempotency/polling logic เดิม; ยังรอ screenshot comparison 430px และ desktop sign-off
- [x] เชื่อม payment command ผ่าน `chatposApi.ts` และ server-side routing ตาม contract พร้อมส่งชื่อ Store จาก Merchant context
- [x] รองรับ PromptPay QR, Hosted Checkout, `qrString`, `qrImageUrl`, `checkoutRedirectUrl` และ expiry ตาม response จริง
- [x] แสดง payment loading, timeout, provider error, cancelled, pending และ paid จาก server state เท่านั้น
- [x] Retry timeout ด้วย idempotency key/body เดิม และกัน payment ซ้ำจากการสร้าง key ใหม่ระหว่าง operation เดิม
- [x] อัปเดต transaction status จาก query และผล webhook ที่ persist แล้ว ไม่ใช้ seeded transaction หรือ local success state
- [ ] ทดสอบ payment success, failure, timeout, duplicate request, late webhook และ reconcile

**M3 เสร็จเมื่อ:** Payment flow ทำงานผ่าน API/Backoffice จริง, retry ปลอดภัย, QR/checkout ใช้ได้ และสถานะใน UI ตรงกับ server

#### M4: Operations parity

- [x] นำ transaction list, filter, status และ empty state จาก reference มาใช้กับ Store-scoped transaction API จริงใน `TransactionsView`
- [x] แยก transaction history ออกจาก order history ด้วย route/view `transactions` และ `orders` คนละชุด
- [ ] นำ order list/status action มาใช้กับ persisted order API และ authorization ของ Store
- [~] นำ table grid, table QR และ table order interaction มาใช้โดยมี server owner; มี route/placeholder แล้ว แต่ยังขาด Table/Order API และ persistence
- [ ] ป้องกัน duplicate click, stale response และ mutation race ใน orders/tables
- [~] ทดสอบ loading, empty, error, retry, wrong Store และ permission denied ของทุก operations view; TransactionsView มี state handling แล้ว แต่ยังไม่มี browser/API evidence และ orders/tables ยังไม่พร้อม

**M4 เสร็จเมื่อ:** transactions, orders และ tables ไม่พึ่ง mock/localStorage เป็น business authority และ mutation/read state แยกกันถูกต้อง

#### M5: Catalog และ services parity

- [~] ปรับ product table, category filter, stock state, image preview และ edit modal ตาม reference; Product table, loading/error/empty state และ edit modal ใช้งานแล้ว แต่ visual comparison ยังรอ
- [~] ใช้ `Product` API/ฐานข้อมูลเป็น authority ของสินค้า; `ProductsView` ใช้ Store-scoped API จริงแล้ว แต่ POS/CatalogPage และ category/service state บางส่วนยังเป็น transitional localStorage
- [ ] กำหนดและ implement service/availability persistence สำหรับ services และ booking
- [~] ตรวจ ownership, validation, price/status history และ audit ของ product/service mutation; Product create/update มี Store scope, validation, audit และ optimistic `updatedAt` conflict แล้ว แต่ price/status history และ service mutation ยังไม่มี
- [~] ทำ image upload/preview/error state โดยไม่เก็บไฟล์ธุรกิจเป็น mock base64 ใน production record; ตอนนี้รับเฉพาะ URL/path, ปฏิเสธ `data:` และมี preview แต่ยังไม่มี private upload/storage adapter หรือ failed-upload evidence
- [ ] ทดสอบข้าม device, refresh, concurrent edit, invalid price/stock และ failed upload

**M5 เสร็จเมื่อ:** ข้อมูลสินค้าและบริการที่บันทึกแล้วอยู่ข้าม device, มี validation/ownership และ localStorage ไม่ใช่แหล่งข้อมูลหลัก

#### M6: Account และ supporting surfaces

- [~] ปรับ settings, profile, notification preferences และ integration entry ให้สอดคล้องกับ reference; notification ใช้ API จริง, profile/password/preference save ที่ยังไม่มี persistence แสดง unavailable และ integration tester ไม่เปิด auth/payout prototype เป็น action พร้อมใช้
- [~] เชื่อม wallet, revenue, billing และ reports กับ source ที่ Finance/Payment owner ยืนยัน; `MerchantFinanceView` ใช้ Store-scoped Home/Transaction read model แล้ว แต่ billing และ balance ledger sign-off ยังไม่ครบ
- [~] คง withdraw เป็น unavailable/feature-gated จนกว่า withdrawal, OTP, provider result และ reconciliation พร้อม; wallet UI และ integration tester กั้น action แล้ว แต่ `/api/v1/payouts` prototype ยังต้อง readiness gate ฝั่ง server
- [x] แสดงหรือซ่อนเมนูตาม capability จาก server ไม่ใช้การซ่อนปุ่มเป็น authorization; sidebar, bottom navigation และ direct route ใช้ policy จาก Home API
- [~] ตรวจไม่ให้ bearer secret, signing secret, webhook secret, token หรือ PII อยู่ใน browser storage/URL/log; API key storage ถูก no-op, payout tester ถูกกั้น และ finance surface ไม่ expose secret แต่ยังต้อง security scan/evidence ครบทุก surface
- [~] ทดสอบ role, capability, feature flag, session expiry และ server error ของ supporting surfaces; source มี state/guard แล้ว แต่ยังต้อง browser/API evidence

**M6 เสร็จเมื่อ:** settings และ supporting surfaces มี owner/permission/data source ชัดเจน และ feature ที่ backend ยังไม่พร้อมไม่แสดงเป็นสำเร็จ

#### M7: Release parity และ mock removal

- [~] ลบ seeded/fake business data จาก production path หรือกั้นไว้เฉพาะ demo/test environment; POS/orders/services/salespage ใน Merchant portal และ public catalog ที่ไม่มี published sales page ถูกกั้นใน production แต่ยังมี legacy mock source ใน development code
- [~] ตรวจ visual parity, text overflow, keyboard label และ reduced motion; Payment AI shell ใช้กับ Home/QuickPay/Transactions/Products/Finance/Settings/unavailable แล้ว แต่ยังรอ contrast และ full keyboard QA
- [~] ตรวจ browser ที่ 390px สำหรับ Home, Payment, Transactions, Products, Wallet และ unavailable route แล้วไม่พบ horizontal overflow; ยังต้องตรวจ 430px, tablet, desktop ทุก route และ bottom-nav overlap ระหว่าง scroll
- [ ] เพิ่ม browser E2E สำหรับ menu navigation, Home, payment, transactions, orders, products และ settings
- [~] เพิ่ม permission/Store isolation, retry/idempotency และ session expiry evidence; server-side capability/Store guards และ payment/product idempotency มีแล้ว แต่ยังรอ browser/API evidence ครบทุก route
- [~] ตรวจ console/log/network/localStorage ไม่รั่ว secret, payment data หรือ restricted PII; production API tester, demo profile PII และ payout action ถูกกั้นแล้ว แต่ยังต้อง security scan/evidence ครบทุก surface
- [~] จัดทำ rollout, rollback, monitoring, alert owner และ support evidence ก่อนเปิด feature; runbook/feature gates มีแล้ว แต่ยังต้อง release owner และ staging evidence

**M7 เสร็จเมื่อ:** production path ไม่มี mock authority, มี automated/browser evidence และ Product, Design, Frontend, Backend, QA กับ Security/Compliance ลงชื่อใน scope ที่เกี่ยวข้อง

## 1. ขอบเขตและข้อสรุปสำคัญ

คำว่า “landing ปัจจุบัน” ในงานนี้จะแยกเป็น 2 หน้าชัดเจน:

- **Public landing**: `/`, `/login`, `/landing` ใช้สำหรับแนะนำ ChatPOS, สมัครใช้งาน และเข้าสู่ระบบ ปัจจุบัน render ด้วย `LandingPageView`
- **Merchant Home**: `/merchant#home` ใช้หลังล็อกอิน เป็นหน้าที่ตรงกับภาพอ้างอิง มีข้อมูลร้าน ยอดเงิน เมนูทางลัด และ bottom navigation ปัจจุบัน render ด้วย `MerchantView` และ `MerchantHome`

ระยะนี้ให้ทำ **Merchant Home เป็นเป้าหมายหลัก** โดยไม่ลบหรือเปลี่ยน public landing จนกว่าจะมี product decision ใหม่

### เป้าหมาย

1. ทำ visual hierarchy, สี, card, mascot, header และ bottom navigation ให้ใกล้ภาพอ้างอิงบนมือถือ
2. ทำให้ทุกเมนูในภาพกดแล้วไปยังปลายทางที่ถูกต้องและมีสถานะ active ที่สอดคล้องกัน
3. เปลี่ยนข้อมูลสำคัญจาก mock/hardcode เป็นข้อมูลตาม Store และผู้ใช้ที่ล็อกอินจริง
4. รองรับ loading, empty, error, permission และ offline/retry state โดยไม่ทำให้ layout กระโดด
5. รักษา server-side authorization, Store ownership, audit และข้อกำหนดด้าน payment/KYC ที่มีอยู่

### ไม่อยู่ในขอบเขตระยะแรก

- เปลี่ยน public marketing landing ทั้งหน้า
- สร้างระบบ Stop Pay หรือสิทธิพิเศษเชิงธุรกิจโดยไม่มี product/payment policy ที่ยืนยันแล้ว
- ให้ frontend เป็นผู้ตัดสินสิทธิ์เข้าถึงยอดเงิน, transaction, payout หรือข้อมูล KYC
- ย้ายข้อมูล business state ที่ต้องใช้หลายอุปกรณ์ไปเก็บใน localStorage

## 2. Baseline จากโค้ดปัจจุบัน

### มีอยู่แล้ว

- `/merchant` ตรวจ server session ก่อนเปิด Merchant Portal
- `MerchantHome` มี assignment status, store status, clock, Merchant ID copy, balance card, quick action cards และ management list
- `MerchantView` มี navigation สำหรับ `home`, `pos`, `payment`, `orders`, `products`, `services`, `salespage`, `reports`, `wallet`, `kyc`, `developer` และ `settings`
- mobile bottom navigation มี ออเดอร์, บริการ, หน้าแรก, คิดเงินด่วน, เซลเพจ และตั้งค่า
- มี API/local service สำหรับ stores, transactions, products, assignments, KYC และ auth session อยู่แล้ว

### ช่องว่างที่ต้องแก้ก่อนถือว่าเสร็จ

- ชื่อร้าน, Merchant ID, ยอดเงิน และข้อมูลบน home บางส่วนยัง hardcode เช่น `GORRADA`, `S072609429`, `฿50.00` และตัวเลขสรุป
- การ์ด `STOPPAY` ยังพาไป `settings` และยังไม่มีเมนู/สถานะ Stop Pay ที่เป็นเจ้าของ behavior โดยตรง
- การ์ด `สิทธิพิเศษ` ยังพาไป `reports` ซึ่งไม่ตรงกับความหมายของเมนู
- รายการจัดการ `เซลเพจ` ยังพาไป `settings` แทน `salespage`
- notification panel มีข้อมูลและ action แบบ static; filter, read state และ deep link ยังไม่เป็น data flow จริง
- `ประวัติธุรกรรม` ในภาพควรแยกความหมายจาก `ออเดอร์`; ปัจจุบัน home card พาไป `orders` ซึ่งอาจไม่ครอบคลุม payment transaction และ payout
- ยอดเงิน, ยอดรับวันนี้, ยอดพร้อมถอน, รายรับ และสถานะการเปิดร้านยังไม่มี dashboard contract ที่กำหนด source, freshness และ permission อย่างชัดเจน

### ผลตรวจหลัง pull รอบ 2026-08-26

เอกสารฉบับนี้ยังเป็น roadmap ที่ครบสำหรับการวางแผน แต่ยังไม่ใช่หลักฐานว่า frontend ทำเสร็จแล้ว ผลตรวจโค้ดปัจจุบันยืนยันรายการค้างต่อไปนี้:

- `MerchantView` ยังมี `navItems` เฉพาะ `home`, `pos`, `payment`, `orders`, `products`, `services`, `salespage`, `reports`, `wallet`, `kyc`, `developer` และ `settings`; ดังนั้น `#transactions`, `#benefits`, `#stoppay` และ `#billing` ในตารางด้านล่างเป็น proposed targets ที่ยังต้องเพิ่ม tab, render branch และ view หรือมี approved mapping ใหม่
- `MerchantHome` ยังใช้ข้อมูล hardcode สำหรับชื่อร้าน, Merchant ID และยอดเงิน; พบค่าเดียวกันในส่วน QR/payment ภายในไฟล์เดียวกัน จึงควรแยกงาน “home-only” กับ “shared merchant/payment surface” ให้ชัดก่อนปิด checklist
- notification drawer ยังเป็นรายการ static, filter ยังไม่เปลี่ยน state และ mark-all ยังเป็น placeholder action; ปัจจุบัน `dbApi` มี KYC notification type แต่ยังไม่มี merchant-home notification contract/read API
- data fetcher เดิมบางตัวคืนค่า array ว่างเมื่อ request error; Home จึงเพิ่ม status-aware result สำหรับ store และ transaction แล้ว แต่ API domain อื่นยังต้องทยอยปรับ contract เพื่อแยก empty state ออกจาก error state ให้ครบ
- `DbStoreRow` ปัจจุบันยังไม่มี `timezone`, `businessStatus`, capability หรือ balance summary fields ตาม home read model; ต้องเพิ่ม schema/API หรือระบุ source ของแต่ละ field ให้ครบ

**สรุปสถานะ:** Product/Design artifact ครบระดับ draft และ frontend shell/state/navigation implementation รอบแรกเสร็จแล้ว แต่ capability จริง, API contract และ screenshot/test evidence ยังเป็น dependency ตาม Definition of Done

## 3. Product / Design decision record

### 3.1 Scope ที่ใช้ทำงาน

| Decision | ข้อสรุปสำหรับ roadmap | สถานะ |
|---|---|---|
| หน้าที่ตรงกับภาพ | Authenticated Merchant Home ที่ `/merchant#home` | บันทึกแล้ว รอ Product sign-off |
| Public landing | `/`, `/login`, `/landing` ยังคงเป็น marketing landing และไม่ถูกแทนที่ใน release นี้ | บันทึกแล้ว รอ Product sign-off |
| กลุ่มผู้ใช้ | Merchant owner/staff ที่ผ่าน server session และเห็นเฉพาะ Store ที่มีสิทธิ์ | สอดคล้องกับ route ปัจจุบัน |
| รูปแบบหลัก | Mobile-first ที่ 390-430px; desktop ใช้ Merchant Portal shell เดิมและจัดวางให้ scan ได้ | baseline สำหรับ Design |
| ข้อมูลสำคัญ | Store, balance, transaction และ notification ต้องมาจาก server read model; mock ใช้ได้เฉพาะ demo/test | ข้อกำหนด release |

### 3.2 Annotated wireframe ของ Merchant Home

wireframe ด้านล่างเป็น historical information architecture เท่านั้น. Visual acceptance ให้เทียบกับ `chatpos-payment-ai-main` ที่รันปัจจุบัน ไม่ใช้ `419449.jpg` หรือ `base.html`

#### Mobile 390-430px

```text
┌──────────────────────────────────────┐
│ [1 Logo] [2 Version] [3 ภาษา] [4 Bell] [5 Avatar] │
├──────────────────────────────────────┤
│ [6 Store Context Card]               │
│   สถานะเปิดร้าน       เวลา/วันที่     │
│   ชื่อร้าน / สาขา                     │
│   Merchant ID (คัดลอกได้)             │
├──────────────────────────────────────┤
│ [7 Balance Summary]                   │
│   ยอดเงินทั้งหมด       ซ่อน/แสดง      │
│   ยอดรับวันนี้         ยอดพร้อมถอน    │
├──────────────────────────────────────┤
│ [8 Quick Action Grid]                 │
│  ┌──────────┐ ┌──────────┐            │
│  │ POS      │ │ บัญชี    │            │
│  └──────────┘ └──────────┘            │
│  ┌──────────┐ ┌──────────┐            │
│  │ STOPPAY  │ │ ประวัติ  │            │
│  └──────────┘ └──────────┘            │
│  ┌──────────────────────┐             │
│  │ สิทธิพิเศษ / รายรับ   │             │
│  └──────────────────────┘             │
├──────────────────────────────────────┤
│ [9 Management Menu List]              │
│  สินค้า / สต็อก                    >  │
│  คิวและบริการ                      >  │
│  รายงาน                            >  │
│  เซลเพจ                            >  │
│  ฮาร์ดแวร์                         >  │
│  บิล                               >  │
├──────────────────────────────────────┤
│ [10 Bottom Navigation]                 │
│ ออเดอร์ บริการ [หน้าหลัก] คิดเงิน    │
│              เซลเพจ ตั้งค่า           │
└──────────────────────────────────────┘
```

| หมายเลข | Target component | Behavior / responsive rule |
|---|---|---|
| 1-5 | `MerchantHeader` | แถวเดียวบนมือถือ; avatar/profile และ notification ต้องมี hit area อย่างน้อย 44px; desktop อยู่ใน topbar/sidebar shell เดิม |
| 6 | `StoreContextCard` | ใช้ชื่อ/สาขา/status/timezone ของ Store จริง; ถ้าไม่มี Store ให้แสดง empty state และ store selector แทนข้อมูล demo |
| 7 | `BalanceSummaryCard` | ตัวเลขไม่ล้น card; ซ่อนยอดเป็นค่าเริ่มต้นเมื่อ policy กำหนด; desktop ขยายได้แต่ไม่เปลี่ยน hierarchy ของ quick actions |
| 8 | `QuickActionGrid` | 2 columns บนมือถือ, card สุดท้ายเต็มแถวได้; ทุก card มี target และ capability จาก server; disabled ต้องมีเหตุผล |
| 9 | `ManagementMenuList` | รายการเต็มความกว้าง, row สูงพอสำหรับ touch, arrow ไม่เป็นปุ่มหลอก; desktop จัดเป็น section ที่ scan ได้ |
| 10 | `MerchantBottomNav` | fixed เฉพาะ mobile, มี `padding-bottom: env(safe-area-inset-bottom)`, ไม่บัง content และ active state ตรงกับ hash/sidebar |

#### Desktop behavior

- คง `MerchantView` sidebar เป็น navigation หลัก และใช้ home content เป็นพื้นที่ทำงาน ไม่ย้าย bottom nav ไป desktop โดยไม่จำเป็น
- แสดง `StoreContextCard` และ `BalanceSummaryCard` ในแถวบนของ content; quick actions ใช้ grid ที่ไม่ทำให้ card สูงเกินไป
- notification เปิดเป็น drawer/modal ที่ไม่ทำให้ layout หลักกระโดด และปิดได้ด้วย Escape/คลิก backdrop
- เมื่อ width ต่ำกว่าจุด responsive ให้เปลี่ยนเป็น mobile layout ก่อนเกิด horizontal overflow ไม่ใช้การย่อ font จนอ่านยาก

### 3.3 Component ownership และ decision owner

| พื้นที่ | Proposed owner | ผู้ร่วมยืนยัน | หลักฐานที่ต้องส่งมอบ |
|---|---|---|---|
| Scope, menu semantics, release priority | Product | Design, Engineering | signed decision record |
| Visual tokens, layout, responsive, accessibility criteria | Design | Product, Frontend, QA | annotated wireframe + design review |
| Home shell, navigation, state rendering, locale display | Frontend | Design, Backend | implementation + screenshot evidence |
| Read model, notifications, capabilities, Store ownership | Backend / API | Frontend, Security | API schema + permission tests |
| Balance, revenue, payout, billing, transaction meaning | Payment / Finance | Product, Backend | signed field mapping + reconciliation rules |
| STOPPAY state and action policy | Payment / Risk | Product, Security, Compliance | state transition + audit/recovery policy |
| Release evidence and regression | QA | Frontend, Backend, Design | test matrix + mobile/desktop evidence |

> ตารางนี้เป็น role-based owner proposal ยังไม่มีรายชื่อบุคคล จึงต้อง assign owner ก่อนเริ่ม sprint ที่เกี่ยวข้อง

### 3.4 State matrix ของ card และ menu

| Surface | Loading | Empty | Error | Disabled / Permission | Offline / stale |
|---|---|---|---|---|---|
| Store context | skeleton ของ status/name/ID | “ยังไม่พบร้านค้า” + เลือก/สร้าง Store | แสดงชื่อที่ cache ได้ + retry | ซ่อนข้อมูล Store ที่ไม่มีสิทธิ์ | ใช้ข้อมูลล่าสุดพร้อมเวลาที่ sync ล่าสุด |
| Balance summary | skeleton จำนวนเงินและ sub-card | แสดง `฿0.00` เมื่อ server ยืนยันว่าไม่มีรายการ | ซ่อนจำนวนเงินจริง + retry; ห้ามเดายอด | แสดง masked state และเหตุผล | แสดง cached value พร้อม `ข้อมูลอาจล่าช้า` |
| POS / คิดเงิน | ปุ่ม disabled พร้อม loading | แสดง setup ร้าน/ช่องทางชำระเงิน | retry หรือ link support | disabled ตาม capability/KYC/payment state | เปิดได้เฉพาะ flow ที่รองรับ offline จริง |
| บัญชี / รายรับ / บิล | skeleton totals/list | empty state พร้อมช่วงเวลา/ตัวกรอง | retry และคง filter เดิม | ซ่อนจำนวน/รายการตาม permission | แสดง last known data และห้ามสร้างรายการใหม่ถ้า sync ไม่ได้ |
| STOPPAY | แสดงสถานะกำลังตรวจสอบ | แสดง “ยังไม่มีสถานะ” โดยไม่แสดง action อันตราย | retry + contact support | แสดงเหตุผลและ policy; action ต้องยืนยันซ้ำ | read-only จากสถานะล่าสุด; ห้ามสั่งหยุดเงินซ้ำ |
| ประวัติธุรกรรม / ออเดอร์ | skeleton rows | อธิบายว่าไม่มีรายการตาม filter | retry + filter/pagination เดิม | ซ่อน field ที่ไม่มีสิทธิ์ | แสดงข้อมูลล่าสุดพร้อม stale marker; mutation ต้องรอ online |
| สิทธิพิเศษ | skeleton campaign cards | “ยังไม่มีสิทธิพิเศษ” | retry | แสดง eligibility/เหตุผลที่ใช้ไม่ได้ | แสดง expiry จาก cache แต่ห้าม claim ซ้ำ |
| สินค้า / สต็อก / บริการ | skeleton list/count | CTA ตั้งค่าสินค้าหรือบริการ | retry | read-only หรือซ่อน action ตาม role | read-only; แสดงเวลาซิงค์ล่าสุด |
| เซลเพจ / ฮาร์ดแวร์ / ตั้งค่า | skeleton rows/status | CTA setup ครั้งแรก | retry/test connection | disabled พร้อมเหตุผล | ไม่บันทึกการตั้งค่าจนกว่าจะ online |
| Notification | skeleton list และ badge | badge ไม่แสดง; empty message | retry โดยไม่ reset read filter | ไม่แสดง notification ข้าม Store/role | แสดง unread ล่าสุดพร้อมเวลาที่ดึงข้อมูล |
| Bottom navigation | แสดง shell คงที่ | ยังนำทางได้แม้ไม่มี business data | target ที่โหลดไม่ได้แสดง error ใน view | menu ที่ไม่มี permission ต้องซ่อนหรือ disabled ตาม decision | navigation local ทำได้ แต่ mutation ต้องกันไว้ |

### 3.5 Locale, timezone และตัวเลข

ค่า baseline สำหรับ release แรก:

- default locale เป็น `th-TH` และเลือกภาษาได้ `th-TH`, `en-US`, `zh-CN`; การเลือกภาษาต้อง persist ต่อ user/store ผ่าน setting ที่เหมาะสม ไม่ใช้ localStorage เป็น source of truth
- timezone อ่านจาก Store; fallback คือ `Asia/Bangkok`; ห้ามใช้ timezone ของ browser เป็นค่า business โดยอัตโนมัติ
- Thai ใช้ปีพุทธศักราชในข้อความวันที่ที่ผู้ใช้เห็น เช่น `19 ก.ค. 2569`; English/Chinese ใช้ Gregorian เว้นแต่ Product ระบุเป็นอย่างอื่น
- เงินใช้ `THB`, แสดงสัญลักษณ์ `฿`, comma grouping และทศนิยม 2 ตำแหน่ง เช่น `฿ 1,234.50`; ค่า zero แสดง `฿ 0.00`
- backend คำนวณยอดด้วยหน่วยย่อย/decimal และส่งค่าที่เชื่อถือได้; frontend มีหน้าที่ format ไม่คำนวณยอดเงินด้วย floating point
- rounding ของ fee, tax, commission และ payout ต้องใช้กติกาเดียวกับ Finance/Payment contract; ยังต้องมี sign-off ก่อนเปิดรายรับจริง
- เวลา transaction ใช้ timezone ของ Store พร้อมแสดง `asOf`/เวลาที่ข้อมูลถูกสร้างเมื่อมีความเสี่ยงจาก stale data

### 3.6 Visual QA acceptance criteria

- contrast ของข้อความ, icon, status และ focus state ผ่านเกณฑ์ WCAG ที่ทีมกำหนด; สีไม่ใช่สัญญาณสถานะเพียงอย่างเดียว
- ชื่อร้าน, label, จำนวนเงิน, notification และข้อความ error ต้อง wrap ได้โดยไม่ทับ card/menu อื่น
- touch target ของ header, card, row, icon button และ bottom nav อย่างน้อย 44x44px
- ทุก interactive element ใช้ keyboard ได้ มี visible focus และมี accessible name ที่สื่อความหมาย
- mobile content ต้องมี bottom padding ตามความสูงจริงของ bottom nav และ safe area; ไม่มี horizontal scroll ที่เกิดจาก component หลัก
- mascot และ icon มี alt/label ที่เหมาะสม; decorative image ใช้ empty alt และมี fallback เมื่อโหลดไม่ได้
- รองรับ `prefers-reduced-motion`; animation ต้องไม่เป็นเงื่อนไขเดียวของ feedback
- ต้องเก็บ screenshot evidence อย่างน้อย mobile 390px, mobile 430px และ desktop ก่อน mark visual QA ผ่าน

## 4. Information architecture และเมนูเป้าหมาย

| ส่วนในภาพ | ความสามารถที่ต้องมี | ปลายทางเป้าหมาย | สถานะปัจจุบัน | Priority |
|---|---|---|---|---|
| Logo / version | กลับหน้า public, แสดง product/version | `/` | มีบางส่วนใน Merchant sidebar | P1 |
| ภาษา | เปลี่ยน locale ของ Merchant Portal และ persist ต่อ user/store | locale provider หรือ setting | มี `Languages` ในบางส่วน แต่ยังไม่เป็น global flow | P1 |
| Notification | badge unread, filter, mark read, deep link ไป order/payment/KYC/stock | notification drawer + target hash | มี static overlay ใน `MerchantView` | P0 |
| Avatar / profile | เปิด profile, เปลี่ยนร้านหรือดู role, logout | profile modal / store selector | มี profile modal และ logout | P0 |
| Store status card | สถานะเปิด/ปิด, เวลา, วันที่ตาม timezone ร้าน, ร้าน/สาขา, Merchant ID copy | home context | มี UI แต่ข้อมูลบางส่วน mock | P0 |
| POS | เปิดขายหน้าร้าน, สร้างบิล, พัก/แยกบิล ตามสิทธิ์ | `#pos` | มี `PosView` | P0 |
| บัญชี | ดูยอดคงเหลือ, ยอดรับ, ยอดพร้อมถอน, รายการถอน และ reconciliation | `#wallet` | มี `WalletView` แต่ home summary ยัง mock | P0 |
| STOPPAY | ดูสถานะ/เหตุผล, หยุดรับเงินตาม policy, ขอปลดล็อกหรือดู contact | `#stoppay` หรือ settings sub-route ที่ product อนุมัติ | ยังชี้ไป `settings` | P0 decision + P1 implementation |
| ประวัติธุรกรรม | ค้นหา/filter transaction, payment status, reference, เวลา, จำนวนเงิน | `#transactions` | มี transaction API แต่ยังไม่มีเมนู dedicated | P0 |
| สิทธิพิเศษ | แสดง campaign/benefit ที่ร้านมีสิทธิ์, เงื่อนไข, วันหมดอายุ และ CTA | `#benefits` | ยังใช้ `reports` เป็น placeholder | P1 |
| รายรับ | สรุปยอดรับตามช่วงเวลา, breakdown ช่องทาง, export/reconcile | `#reports` หรือ `#wallet` ตาม product decision | มี `ReportsView`/`WalletView` แยกกัน | P0 decision + P1 |
| สินค้า / สต็อก | จัดการสินค้า, คงเหลือ, low-stock alert | `#products` | มี `ProductsView` | P0 |
| คิวและบริการ | จัดการบริการ, ตารางคิว, สถานะนัดหมาย | `#services` และ link `/booking` | มี `ServicesView` และ `BookingPageView` | P0 |
| รายงาน | ยอดขาย, กำไร, ต้นทุน, สต็อก และช่วงเวลา | `#reports` | มี `ReportsView` | P1 |
| เซลเพจ | รายการ/สร้าง/เผยแพร่ sales page และเปิด public slug | `#salespage` | มี `SalesPageView` แต่ home item ชี้ผิด | P0 |
| ฮาร์ดแวร์ | printer, barcode scanner, QR/payment device, test connection | `#settings` section `hardware` | มี UI บางส่วน | P1 |
| บิล | platform fee, clearing/payout billing และใบเสร็จ | `#wallet` หรือ `#billing` ตาม product decision | ใช้ `#wallet` เป็นทางผ่าน | P1 decision |
| Bottom nav | เมนูที่ใช้บ่อยต้องกดได้ด้วยนิ้ว, active state, safe area | `orders`, `services`, `home`, `payment`, `salespage`, `settings` | มีโครงสร้างแล้ว | P0 |

## 5. Functional requirements

### 5.1 Home data contract

ให้กำหนด endpoint/read model สำหรับ home ก่อนผูก UI จริง โดยไม่ให้ component ประกอบข้อมูลจากหลาย endpoint แบบไม่มี loading/error boundary

ข้อมูลขั้นต่ำที่ควรมี:

- `store`: id, merchantId, name, branch, businessStatus, timezone, logo/avatar
- `user`: displayName, role, allowedActions และร้านที่เข้าถึงได้
- `summary`: totalBalance, receivedToday, availableToWithdraw, pendingAmount, asOf
- `counts`: unreadNotifications, openOrders, queueWaiting, lowStockItems
- `quickActions`: action id, label, enabled, disabledReason, target
- `notifications`: id, type, title, message, createdAt, readAt, target, severity
- `benefits`: campaign/benefit id, title, status, expiresAt, target
- `capabilities`: `canViewBalance`, `canCreatePayment`, `canStopPay`, `canManageProducts`, `canViewKyc`

Backend implementation รอบนี้กำหนด contract ภายในดังนี้; ยังต้องผ่าน API owner, Finance และ Payment owner sign-off ก่อนถือเป็น external contract:

| Endpoint | Scope / behavior | Freshness / mutation rule |
|---|---|---|
| `GET /api/db/home?storeId=` | Store context, payment summary, counts, quick-action capability, STOPPAY state | `no-store`, PostgreSQL snapshot, client stale threshold 60 วินาที |
| `GET /api/db/capabilities?storeId=` | capability flags ของ Store | อ่านจาก `merchant_home_capabilities`; default ปิด capability ที่ยังไม่เปิด |
| `GET /api/db/notifications?storeId=&category=&unreadOnly=` | notification ที่ recipient และ Store ตรงกับ session พร้อม pagination | `page`/`limit` bounded; ไม่แสดง notification ที่ไม่มี Store scope |
| `POST /api/db/notifications/:id/read` และ `/read-all` | mark read แบบทำซ้ำได้โดยไม่เปลี่ยนผลลัพธ์ | ตรวจ recipient + Store ownership และเขียน audit |
| `GET /api/db/benefits?storeId=` | active และยังไม่หมดอายุ benefits พร้อม pagination | source คือ `merchant_benefits`; ไม่มีการ claim ใน read endpoint |
| `GET/POST /api/db/stoppay` | อ่าน state และทำ transition ตาม role | mutation ต้องใช้ `Idempotency-Key`, lock row, event + audit อยู่ transaction เดียวกัน |
| `GET /api/db/transactions` | payment/refund/payout/adjustment พร้อม status/channel/date filters | scope ตาม session, `page`/`limit` bounded, sort ตาม `occurredAt` |

`availableBalance` ยังส่งเป็น `null` พร้อม `balanceStatus: not_available` จนกว่า Finance/Payment owner จะยืนยัน ledger source และ reconciliation rule

### 5.2 Interaction และ state

- toggle ซ่อน/แสดงยอดเงินต้องไม่เขียนยอดเงินจริงลง URL, DOM ที่ไม่จำเป็น หรือ log
- copy Merchant ID ต้องมี keyboard access, feedback และ fallback เมื่อ clipboard ใช้ไม่ได้
- notification badge ต้องนับจาก unread จริง; mark read ต้อง idempotent และตรวจ Store ownership
- การกด card/menu ต้องใช้ route/hash เดียวกันกับ sidebar และ refresh แล้วคง active view ได้
- disabled action ต้องอธิบายเหตุผล เช่น KYC ยังไม่ผ่าน, ไม่มี permission หรือระบบ upstream ไม่พร้อม
- ต้องมี loading skeleton, empty state, error state พร้อม retry ใน store, balance, notification และ quick-action data
- เวลาต้องใช้ timezone ของร้านหรือกำหนด fallback ที่ชัดเจน ไม่ใช้ timezone ของ browser โดยไม่ประกาศ

### 5.3 Visual และ responsive target

- mobile-first สำหรับ viewport กว้างประมาณ 390-430px ตามภาพอ้างอิง และต้องไม่บังเนื้อหาด้วย bottom navigation หรือ safe-area inset
- desktop ต้องยังใช้ Merchant Portal ได้ โดยไม่ทำให้ card ทางลัดมีขนาดใหญ่เกินงานที่ต้อง scan
- ใช้สีของ card แยกความหมาย POS, account, Stop Pay, history, benefit และรายรับ แต่ต้องรักษา contrast และไม่ใช้สีอย่างเดียวเป็นตัวบอกสถานะ
- mascot/image ต้องมี alt text และมี fallback เมื่อ asset โหลดไม่ได้
- bottom navigation ต้องมี target อย่างน้อย 44px, focus state, active state และ label ที่อ่านได้
- ใช้ icon จาก `lucide-react` ตาม pattern เดิม และไม่วาด icon ใหม่เมื่อมี icon ที่เหมาะสมอยู่แล้ว

## 6. Roadmap แบ่ง phase

### Phase A: Product decision และ contract (P0)

ผลลัพธ์คือมี decision record ที่ทีมพัฒนาอ้างอิงได้:

- ยืนยันว่าเป้าหมายหลักคือ `/merchant#home` และ public `/` ยังคงเป็น marketing landing
- ยืนยันความหมายและ owner ของ STOPPAY, สิทธิพิเศษ, รายรับ, บิล และประวัติธุรกรรม
- เลือกว่าจะเพิ่ม `transactions`, `stoppay`, `benefits`, `billing` เป็น nav id ใหม่หรือเป็น section ภายใต้ view เดิม
- กำหนด dashboard read model, freshness, currency, timezone, rounding และ permission matrix
- ยืนยัน notification types, retention, read API, deep link และ behavior เมื่อ upstream ล่ม

### Phase B: Visual shell และ navigation parity (P0)

- ปรับ `MerchantHome` ให้ mobile layout, header card, quick-action grid, management list และ bottom nav ตามภาพ
- แก้ navigation mapping ที่ผิด: salespage ต้องไป `salespage`; สิทธิพิเศษต้องมีปลายทางที่ถูกต้อง; STOPPAY ต้องไม่ใช้ settings เป็น permanent fallback
- ทำ nav config กลางเพื่อลด label/icon/target ที่ซ้ำกันระหว่าง sidebar, home cards และ bottom nav
- เพิ่ม responsive, safe-area, keyboard/focus, reduced-motion และ image loading states
- ตรวจ screenshot เทียบ mobile และ desktop พร้อมรายการ deviation ที่ยอมรับได้

### Phase C: Real home data และ merchant context (P0)

- สร้างหรือยืนยัน home read API และเชื่อม store/user context จาก server session
- เอา hardcoded store name, Merchant ID, balance, date, counts และ notification ออกจาก production path
- ทำ loading/error/empty/retry และ stale-data indicator
- ตรวจ permission/Store ownership ที่ API ทุกข้อมูล ไม่เชื่อ `storeId` จาก client เพียงอย่างเดียว
- เพิ่ม integration tests สำหรับ unauthorized, wrong store, empty store, upstream timeout และ stale response

### Phase D: Menu capabilities (P1)

- ทำ transaction history dedicated view หรือกำหนด mapping ไป reports ให้ชัดเจน
- ทำ STOPPAY state machine, confirmation, audit และ recovery/support flow ตาม policy
- ทำ benefits/campaign read model และ CTA ที่มีวันหมดอายุ/eligibility
- เติม wallet/revenue/billing ให้แยกยอดรับ, pending, available, fee และ payout reconciliation
- เชื่อม notification actions ไป orders, payment, KYC, products และ settings จริง

### Phase E: Quality, security และ rollout (P1/P2)

- เพิ่ม E2E flow ของเมนูในภาพบน mobile และ desktop
- ทดสอบ role/permission, Store isolation, masking, balance visibility, logout และ session expiry
- ตรวจ accessibility ด้วย keyboard, screen reader label, contrast และ touch target
- วัด performance ของ home และ image asset; กำหนด retry/backoff เมื่อ dashboard API ช้า
- เปิดใช้ด้วย feature flag หรือ staged rollout พร้อม rollback plan, monitoring และ owner

### Backend migration rollout policy

- `008_merchant_home_contract.sql` ทำงานแบบ transaction ต่อ migration และใช้ `IF NOT EXISTS`/`ADD COLUMN IF NOT EXISTS` เพื่อให้ rerun ได้อย่างปลอดภัย
- ก่อนเปิด route ใหม่ต้องสำรองฐานข้อมูลและตรวจ row count/index ของ `notifications`, `Transaction`, `merchant_home_capabilities`, `merchant_benefits` และ STOPPAY tables ใน staging
- Rollback ระหว่าง rollout ให้ปิด feature flag/route ก่อน แล้ว restore backup หรือใช้ forward migration แก้ข้อมูล; migration runner ยังไม่มี automatic down migration จึงห้ามทำ destructive `DROP` ใน production
- `audit_logs`, transaction และ STOPPAY events เป็น append-only evidence; ห้าม purge ด้วย application endpoint
- Notification retention, payment/settlement retention และเอกสาร KYC ต้องยืนยันกับ Compliance/Finance/Payment owner ก่อนกำหนด TTL จริง; ระหว่างรอ sign-off ให้เก็บตาม policy เดิมและ monitor storage growth

## 7. Definition of Done

ถือว่า Merchant Home รุ่นตามภาพพร้อมส่งต่อเมื่อ:

- ผู้ใช้ Merchant ที่ล็อกอินเห็นร้าน/สาขา/บทบาทของตัวเอง และไม่มีข้อมูลร้าน demo ปนใน production path
- เมนูทุกตัวในภาพมี target, permission, loading/error state และ active state ที่ตรวจสอบได้
- POS, บัญชี, ประวัติธุรกรรม, สินค้า/สต็อก, คิว/บริการ, รายงาน, เซลเพจ และตั้งค่าเปิดใช้งานตาม contract ที่ยืนยันแล้ว
- STOPPAY, สิทธิพิเศษ และรายรับมี product owner, data owner และ behavior เมื่อไม่มีสิทธิ์/ข้อมูล/ระบบพร้อม
- ยอดเงินและข้อมูล payment ไม่ถูก expose ผ่าน client storage, URL หรือ log และ API ตรวจ Store ownership
- mobile viewport ไม่ถูก bottom bar บัง, desktop ไม่เกิด horizontal overflow และ keyboard navigation ใช้งานได้
- มีหลักฐาน test/screenshot สำหรับ happy path, loading, empty, error, unauthorized, wrong-store และ session expiry
- Product, Design, Frontend, Backend, QA และ Security/Compliance (เมื่อกระทบ payment/KYC) ลงชื่อรับรอง scope ของ release

## 8. Open questions / dependency

- STOPPAY หมายถึงหยุดรับชำระเงินทั้งร้าน, หยุดบางช่องทาง หรือเป็นเพียงสถานะ security lock?
- “สิทธิพิเศษ” ต้องเชื่อม campaign/loyalty ของ ChatPOS หรือเป็น banner/content ที่จัดการโดย Admin?
- “รายรับ” ต้องอยู่ใน Wallet, Reports หรือเป็น summary card ที่กดไปได้ทั้งสองมุมมอง?
- ประวัติธุรกรรมต้องรวม order, payment, refund, fee และ payout หรือแสดงเฉพาะรายการเงินเข้า?
- รองรับหลายสาขาตั้งแต่ release แรกหรือเลือกสาขาปัจจุบันอย่างเดียว?
- dashboard data ต้องสดระดับใด และยอมรับ stale data ได้นานเท่าไรเมื่อ API ขัดข้อง?
- ต้องรองรับภาษาไทย/อังกฤษ/จีนในหน้าหลัก release เดียวกันหรือทยอยเปิดตาม locale?

## 9. Checklist รายละเอียด

### Product / Design

- [x] ยืนยัน working scope `/merchant#home` กับ public `/` ใน decision record; formal Product sign-off ยังเป็น dependency
- [x] ทำ annotated wireframe จาก [419449.jpg](419449.jpg) พร้อมชื่อ component และ responsive behavior
- [~] เสนอ target และ role-based owner ของ STOPPAY, สิทธิพิเศษ, รายรับ, บิล และประวัติธุรกรรม; ยังต้อง assign ชื่อ owner และยืนยัน policy
- [x] กำหนด loading, empty, error, disabled, offline และ permission state ของทุก card/menu ใน state matrix
- [~] กำหนด baseline locale, timezone, currency, date format และ rounding; Finance/Product ต้อง sign-off กติกาเงินจริง
- [~] กำหนด acceptance criteria สำหรับ contrast, text overflow, touch target, keyboard focus และ safe-area; visual QA จริงยังรอ implementation

### Frontend

- [x] แยก home shell, store header, balance summary, quick actions, management list, notification drawer และ bottom nav เป็น component ที่ดูแลได้ใน `MerchantHomeView.tsx`
- [x] รวม nav definition ให้ sidebar, home และ bottom nav ใช้ id/label/permission/target ชุดเดียวกันใน `merchantNavigation.ts`
- [x] แก้ hardcoded store name, Merchant ID, balance, counts และ notification ออกจาก production path; ยอดที่ backend ยังไม่ส่งแสดงเป็น `—` และ notification ใช้ transaction data หรือ empty state
- [x] แก้ mapping `เซลเพจ -> salespage`, `ประวัติธุรกรรม -> transactions` และ `สิทธิพิเศษ -> benefits` ตาม decision record
- [~] เพิ่ม `stoppay` และ `benefits` เป็น target/view placeholder แล้ว; business capability และ action จริงยังรอ backend/product policy
- [x] เพิ่ม skeleton/error/empty/retry และ stale indicator โดยคงขนาด layout ใน store และ transaction data flow
- [x] ทำ interaction ของ language, notification read/filter, profile/store selector และ balance visibility ให้ครบใน Home prototype
- [x] ตรวจ route/hash refresh, browser back/forward และ active state ทุกเมนูผ่าน shared navigation IDs

### Backend / Data

- [x] ออกแบบและ implement home read model พร้อม source, freshness และ cache policy; API owner sign-off ยัง pending
- [x] เพิ่ม/ปรับ endpoint สำหรับ summary, unread notification, benefits และ capability flags ตาม contract
- [x] บังคับ session, role และ Store ownership ที่ทุก endpoint ที่ home เรียก
- [x] ทำ notification read/mark-all แบบ idempotent พร้อม audit ที่เหมาะสม
- [x] แยก transaction/order/payment/refund/payout semantics และกำหนด query/filter/pagination ใน transaction contract
- [x] ออกแบบ STOPPAY state transition, idempotency, audit, approval และ recovery ก่อนทำปุ่ม action
- [~] ยืนยันข้อมูล revenue/wallet/billing กับ Finance และ payment owner; balance ledger/reconciliation ยังไม่มี source ที่ sign-off แล้ว
- [~] เพิ่ม migration `008_merchant_home_contract.sql` สำหรับ durable state แล้ว; production rollback rehearsal และ retention policy ยัง pending

### QA / Security / Operations

- [~] ทดสอบ mobile 390/430px, desktop และ browser refresh ทุก target menu; matrix อยู่ใน [Merchant Home QA Runbook](MERCHANT_HOME_QA_RUNBOOK.md) และยังรอ browser evidence
- [~] ทดสอบ unauthorized, wrong Store, role mismatch, expired session และ revoked session; contract boundary tests ผ่านแล้ว แต่ PostgreSQL session matrix ยัง pending
- [~] ทดสอบ duplicate click, retry, timeout, stale response และ notification race condition; idempotent contract replay test ผ่านแล้ว แต่ DB/race test ยัง pending
- [ ] ตรวจไม่ให้ยอดเงิน, token, secret หรือ PII หลุดใน localStorage, URL, console และ log
- [ ] เพิ่ม E2E evidence สำหรับ POS, wallet, transaction history, orders, services, salespage และ settings
- [x] เพิ่ม monitoring aggregate ของ Home API latency/error/status และกำหนด incident owner ใน [Merchant Home QA Runbook](MERCHANT_HOME_QA_RUNBOOK.md)
- [x] เตรียม default-off feature flag, rollout checklist, rollback และ support/runbook ใน [Merchant Home QA Runbook](MERCHANT_HOME_QA_RUNBOOK.md)
# ChatPOS Developer Guide

คู่มือนี้อธิบายว่า ChatPOS ทำอะไรได้บ้าง ระบบแบ่งส่วนอย่างไร และนักพัฒนาควรแก้หรือเพิ่มฟีเจอร์ตรงไหน เหมาะสำหรับทีมที่ทำงานกับ frontend, API, PostgreSQL และ workflow Merchant KYC

> **Canonical developer source:** เอกสารนี้เป็น source of truth ด้าน architecture, route ownership, implementation status, data authority, feature gate และ production boundary ของ repository `chatpos-react`
>
> **Last synchronized:** 2026-09-01 กับ `src/App.tsx`, `src/merchantNavigation.ts`, Merchant/Public views, `src/dbApi.ts`, `src/chatposApi.ts`, `src/useThaiVoice.ts`, `src/lib/server/api-handler.cjs` และ migrations ปัจจุบัน
>
> **Runtime precedence:** Source code, database migrations และ deployment configuration เป็น executable authority. หาก behavior จริงไม่ตรงเอกสาร ให้ถือเป็น documentation drift และต้องอัปเดตไฟล์นี้ใน change เดียวกัน ห้ามใช้ข้อความในเอกสารเพื่อข้าม authorization, feature flag หรือ server validation

ลำดับการใช้อ้างอิง:
ทิ
1. `DEVELOPER_GUIDE.md` ระบุสถานะปัจจุบันและ ownership ที่ทีมต้องยึด
2. Contract เฉพาะทาง เช่น `CHATPOS_CLIENT_INTEGRATION_GUIDE.md` และ decision record กำหนด payload/security boundary ของ integration นั้น
3. `MERCHANT_HOME_ROADMAP.md` ระบุเป้าหมาย งานค้าง และ acceptance evidence; ห้ามใช้สถานะเก่าใน roadmap ทับ current status ใน guide นี้
4. `NEXT_STEPS_CHECKLIST.md` ใช้ติดตามการส่งมอบ ไม่ใช่ authority ของ runtime behavior

> สถานะปัจจุบัน: ChatPOS ใช้ Next.js และให้ custom API handler ทำงานใน Next.js process เดียวกันผ่าน catch-all Route Handler. Session/authentication ใช้ server-side session ผ่าน HttpOnly cookie แล้ว. Merchant Products, POS order creation, Orders status workflow และ Tables ใช้ Store-scoped PostgreSQL API. Services, sales page, booking และ legacy Customer routes บางส่วนยังเป็น demo, mock หรือ `localStorage`; public `/order/:token` ใช้ durable Table/Order API แล้ว

## ภาพรวมความสามารถ

ChatPOS รวมความสามารถของระบบจัดการร้านค้าและการชำระเงินไว้ในชุดเดียว:

- สมัครและเข้าสู่ระบบ Merchant ผ่าน client route ปัจจุบัน; Agent, PD, Compliance และ Admin มี schema/server capability บางส่วนแต่ไม่มี dedicated login/dashboard route ใน `src/App.tsx`
- ลงทะเบียนร้านค้าแบบรวดเร็ว และกรอกข้อมูลธุรกิจ/เอกสาร KYC แบบ wizard
- Merchant back office สำหรับข้อมูลร้านค้า สินค้า บริการ การจอง หน้าขาย และช่องทางรับเงิน
- หน้าสั่งซื้อสำหรับลูกค้าในร้าน โต๊ะอาหาร delivery และ takeaway
- QuickPay/Cashier พร้อมสร้าง PromptPay QR และตรวจสอบสถานะธุรกรรม
- Developer Console สำหรับทดลอง API และดู webhook/developer logs
- Dashboard data จาก PostgreSQL เช่น ร้านค้า Agent, PD, KYC, ธุรกรรม สินค้า และค่าคอมมิชชัน
- โครงสร้างข้อมูลสำหรับเชื่อม Merchant, Agent, PD และสถานะ KYC

## สถาปัตยกรรม

```mermaid
flowchart LR
    Browser[Browser] --> Next[Next.js :3000]
    Next --> Shell[Client App Shell]
    Shell --> Views[Merchant / Customer / Booking / Catalog / QuickPay / Developer]
    Next -->|/api/* catch-all Route Handler| API[api-handler.cjs]
    Views -->|relative fetch| Next
    API --> DB[(PostgreSQL)]
    Views -->|client/workflow state| Local[(localStorage)]
    API --> External[Payment Gateway or external services]
```

### การเชื่อมต่อ Merchant กับ PD/Agent Backoffice

```mermaid
sequenceDiagram
    participant MB as Merchant Browser/POS
    participant M as Merchant Backend<br/>chatpos.biz
    participant BO as PD/Agent Backoffice
    participant LLGW

    MB->>M: สมัครร้านค้า / KYC / สร้างรายการชำระเงิน
    M->>BO: Signed API + scope + Idempotency-Key
    BO->>BO: ตรวจ tenant, ownership, signature และ idempotency
    BO->>LLGW: สร้าง payment ด้วย PD child credential
    LLGW-->>BO: ผล payment และ signed status webhook
    BO-->>M: Signed callback: assignment / KYC / store / payment status
    M-->>MB: แสดงสถานะล่าสุดแก่ Merchant/POS
    M->>BO: Signed status query เมื่อ callback ล่าช้าหรือ ต้อง reconcile
    BO-->>M: สถานะจาก Transaction ที่ persist แล้ว
```

Merchant ติดต่อ PD/Agent ผ่าน `chatpos.biz` เท่านั้น: คำสั่ง Assignment, KYC document/profile และ payment ใช้ signed Merchant API; callback กลับไปยัง `chatpos.biz` ใช้ signed webhook. LLGW ติดต่อกับ PD/Agent Backoffice เท่านั้น และ provider credential, raw payload กับ webhook signature ต้องไม่ถูกส่งต่อไปยัง Browser หรือ Merchant client.

### Frontend

- `src/app/layout.tsx` เป็น root layout ของ Next.js และโหลด global CSS ทั้งหมด
- `src/app/[[...slug]]/page.tsx` เป็น optional catch-all route จึงรับ URL เดิมได้หลายรูปแบบ
- `src/app/[[...slug]]/ClientApp.tsx` โหลด application shell แบบ client-only
- `src/App.tsx` อ่าน `window.location.pathname` แล้วเลือก view ที่เหมาะสม
- View แต่ละชุดอยู่ใน `src/*View.tsx` และ CSS อยู่ในไฟล์ `.css` คู่กัน
- `localStorage` ใช้เก็บ state ฝั่ง client บางส่วนของร้านค้า การจอง สินค้า หน้าขาย และ workflow อื่น ๆ; ไม่ใช้เป็น authority สำหรับ session หรือ API authorization
- Login ใช้ `HttpOnly` cookie ชื่อ `chatpos_session`; `src/App.tsx` hydrate user จาก `GET /api/db/auth/session` และ localStorage profile เป็นเพียง display cache

เหตุผลที่ใช้ client-only shell คือโค้ดเดิมอ่าน `window`, `document` และ `localStorage` ระหว่าง render/effect หากนำไป SSR โดยตรงจะเกิดปัญหา `window is not defined` หรือ hydration mismatch

### API server

`src/lib/server/api-handler.cjs` เป็นโมดูล Node ที่รวมทุก HTTP handler ของ API เข้าไว้ใน Next.js process ทำหน้าที่:

1. รับ request ที่ `/api/db/*` และ `/api/v1/*`
2. ตรวจ method และ route แบบ explicit
3. อ่าน body JSON และ query PostgreSQL ผ่าน `pg.Pool`
4. ตรวจ password ด้วย `bcryptjs` และสร้าง server-side session ใน login
5. บังคับ role, Store/Case ownership, rate limit, CORS และ secure headers ที่ API boundary
6. สร้าง PromptPay EMV payload และ QR data สำหรับ legacy payment flow เมื่อ feature flag อนุญาต
7. ส่ง signed commands/callbacks ระหว่าง ChatPOS กับ PD/Agent Backoffice และบันทึก audit/retry state
8. ส่ง JSON response กลับไปยัง browser

Next.js ให้บริการทุก HTTP request ใน process เดียว. ทุก request ที่ path `/api/*` เข้ามาที่ catch-all Route Handler [`src/app/api/[[...path]]/route.ts`](../src/app/api/%5B%5B...path%5D%5D/route.ts) ซึ่ง adapt `NextRequest` เป็น Node-style req/res แล้วเรียก [`src/lib/server/api-handler.cjs`](../src/lib/server/api-handler.cjs) (เดิมคือ `server.cjs`). Background job (`retryPendingSettlementEvents`, `dispatchPendingKycDocuments`) ถูกลงทะเบียนผ่าน Next.js instrumentation ที่ [`src/instrumentation.ts`](../src/instrumentation.ts) เพียงครั้งเดียวเมื่อ Node runtime พร้อม

### Database

การเชื่อมต่อใช้ PostgreSQL โดยตั้งค่าผ่าน environment variables:

- `DATABASE_URL` หากต้องการใช้ connection string
- หรือ `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

อย่าใส่ password, token, PII หรือข้อมูลเอกสารจริงลงใน source control หรือ mock data

## การรันระบบ

### ข้อกำหนด

- Node.js 22 หรือรุ่นที่รองรับ Next.js ใน `package.json`
- npm
- PostgreSQL ที่เข้าถึงได้จากเครื่องหรือ container
- ไฟล์ `.env` ที่ตั้งค่าฐานข้อมูลและค่า integration ที่ต้องใช้

### ติดตั้งและพัฒนา

```bash
npm install
npm run dev
```

คำสั่ง `npm run dev` เปิด Next.js dev server เพียง process เดียวที่ `http://localhost:3000`. API endpoint (`/api/db/*`, `/api/v1/*`, webhook receivers) เสิร์ฟจาก process เดียวกันผ่าน catch-all Route Handler โดยไม่ต้องเปิด port แยก

เมื่อต้องการรัน production build:

```bash
npm run build
npm run start
```

เมื่อต้องการสร้างหรืออัปเดต schema ของ PostgreSQL:

```bash
npm run db:migrate
npm run db:seed
```

Migration ที่ใช้งานอยู่ใน [`database/migrations/`](../database/migrations/) ครอบคลุม `001_initial_chatpos_schema.sql` ถึง `013_merchant_orders_tables.sql` รวมถึง Merchant KYC, assignment, profile/document version, session/security/audit, payment settlement, Merchant Home และ durable restaurant tables/orders/items/status events. Directory นี้เป็น migration inventory authority; ปัจจุบันมี migration prefix `009` สองไฟล์ที่เป็นคนละ change และต้องคง deterministic filename order ของ migration runner. หลัง migration ให้ใช้ [`database/seed.cjs`](../database/seed.cjs) ผ่าน `npm run db:seed` เพื่อสร้างข้อมูลทดลองแบบ idempotent รวมถึงโต๊ะ/ออเดอร์; ตั้ง `SEED_PASSWORD` ได้เมื่อต้องการเปลี่ยนรหัสผ่าน demo

### Production

```bash
npm run build
npm run start
```

Dockerfile จะ build Next.js แล้วรัน single Node process ใน container โดยเปิดเฉพาะพอร์ต `3000`. ไม่ต้องใช้ Next.js rewrites หรือ loopback proxy เพราะ browser เรียก same-origin `/api/*` ตรงเข้า Next.js runtime. [`src/lib/server/api-handler.cjs`](../src/lib/server/api-handler.cjs) โหลด `.env` ก่อน แล้ว override ด้วย `.env.production` เมื่อ `NODE_ENV=production` เพื่อให้ feature flag เช่น `TRANSACTION_ROUTING_ENABLED`, `MERCHANT_HOME_CONTRACT_ENABLED` ตรงกันทั้ง frontend และ API. หากได้ 404 จาก `/api/v1/*` ให้ตรวจ liveness ด้วย `GET https://<host>/api/health/live`; readiness ของ PostgreSQL ใช้ `GET /api/health/ready`

### ตรวจสอบโค้ด

```bash
npm run lint
```

`npm run build` ใช้ตรวจ production compilation และควรรันก่อน deploy หรือเมื่อแก้ routing/config ของ Next.js

## Environment variables

ค่าที่ใช้โดยโค้ดปัจจุบันมีดังนี้:

| Variable | ใช้โดย | ค่าเริ่มต้น/หมายเหตุ |
|---|---|---|
| `DATABASE_URL` | `src/lib/server/api-handler.cjs` | ใช้แทนชุด `PG*` ได้ |
| `PGHOST` | `src/lib/server/api-handler.cjs` | `127.0.0.1` หากไม่กำหนด |
| `PGPORT` | `src/lib/server/api-handler.cjs` | `5432` หากไม่กำหนด |
| `PGUSER` | `src/lib/server/api-handler.cjs` | `postgres` หากไม่กำหนด |
| `PGPASSWORD` | `src/lib/server/api-handler.cjs` | ว่างหากไม่กำหนด |
| `PGDATABASE` | `src/lib/server/api-handler.cjs` | `chatpos` หากไม่กำหนด |
| `NEXT_PUBLIC_APP_URL` | application/deployment config | URL ภายนอกของเว็บ |
| `SESSION_SECRET` | legacy/config compatibility | ไม่ใช้แทน database session token; ห้ามใช้ค่า default ใน production |
| `KYC_DOCUMENT_LINK_SECRET` | `src/lib/server/integration/documentAccess.cjs` | secret สำหรับ HMAC signed document URL; หากไม่กำหนดจะใช้ `SESSION_SECRET` เป็น fallback |
| `KYC_PRIVATE_STORAGE_ROOT` | `src/lib/server/integration/privateDocumentStorage.cjs` | root ของ private document filesystem; ค่าเริ่มต้นคือ `private-storage` ใต้ working directory |
| `ALLOWED_ORIGINS` | `src/lib/server/api-handler.cjs` | exact comma-separated origins; ห้ามใช้ wildcard เมื่อเปิด credentials |
| `AUTH_LOGIN_RATE_LIMIT` / `AUTH_LOGIN_RATE_WINDOW_SECONDS` | `src/lib/server/api-handler.cjs` | login limit ต่อ IP/email bucket |
| `SETTLEMENT_RETRY_INTERVAL_MS` / `SETTLEMENT_MAX_ATTEMPTS` | `src/lib/server/api-handler.cjs` | durable settlement retry และ dead-letter policy |
| `DOCUMENT_SCANNER_URL` / `DOCUMENT_SCANNER_TOKEN` / `DOCUMENT_SCANNER_TIMEOUT_MS` | `src/lib/server/integration/documentSecurity.cjs` | scanner ไม่พร้อมจะ quarantine เอกสาร ไม่ถือว่าสแกนผ่าน |
| `KYC_OTP_TTL_SECONDS` / `KYC_OTP_MAX_ATTEMPTS` / `KYC_OTP_RESEND_COOLDOWN_SECONDS` / `KYC_OTP_LOCK_SECONDS` | `src/lib/server/integration/otpService.cjs` | policy ของ local KYC challenge; SMSUP adapter รองรับการส่งและตรวจ OTP เมื่อ `SMS_OTP_ENABLED` และ provider readiness เปิด |
| `KYC_DOCUMENT_INTAKE_ENABLED` | `src/lib/server/api-handler.cjs` / `src/lib/server/integration/signedMerchantClient.cjs` | gate ของการส่ง KYC document metadata ไปยัง PD/Agent Backoffice; ค่า default เป็น `false`, production ปัจจุบันเป็น `true` |
| `KYC_DOCUMENT_RETRY_INTERVAL_MS` | `src/lib/server/api-handler.cjs` | รอบ retry เอกสารที่บันทึกใน Merchant แล้วแต่ยังรอ remote KYC Case หรือส่งไป Backoffice ไม่สำเร็จ; ค่าเริ่มต้น `30000` มิลลิวินาที |
| `KYC_DOCUMENT_LINK_TTL_SECONDS` | `src/lib/server/integration/signedMerchantClient.cjs` | อายุ signed document download URL; `86400` เท่ากับ 24 ชั่วโมง |
| `AGENT_PD_INTEGRATION_ENABLED` / `AGENT_PD_ASSIGNMENT_ENABLED` / feature flags อื่น | `src/lib/server/api-handler.cjs` / integration services | ค่า staticระดับ deployment สำหรับเปิด-ปิด capability; ไม่ใช่ credential หรือ Store mapping |
| `AGENT_PD_CREDENTIAL_ENVIRONMENT` / `AGENT_PD_KEY_ID_HEADER` | `src/lib/server/integration/storeBackofficeCredentials.cjs` / signed client | environment ที่ใช้เลือก mapping และชื่อ header Key ID ซึ่งเป็นค่า static ของ deployment |
| `backoffice_store_credentials` | `src/lib/server/integration/storeBackofficeCredentials.cjs` | dynamic mapping ต่อ Store และ environment; เก็บ Base URL, Backoffice Store ID, Key ID และ secret reference เท่านั้น ไม่เก็บ secret จริง. `backofficeStoreId` ต้อง provision เมื่อ UUID ของ Backoffice กับ local Store ต่างกัน เพราะใช้ resolve inbound callback |
| `CHATPOS_BACKOFFICE_BEARER_SECRET` / `CHATPOS_BACKOFFICE_SIGNING_SECRET` | `src/lib/server/integration/signedMerchantClient.cjs` และ `storeBackofficeCredentials.cjs` | ใช้เป็น runtime secret ปกติจาก server environment/secret manager สำหรับ outbound request; ห้ามส่งเข้า browser |
| `CHATPOS_BACKOFFICE_CALLBACK_SECRET` | `src/lib/server/integration/storeBackofficeCredentials.cjs` ผ่าน `callbackSecretRef` | ใช้ตรวจ callback จาก Backoffice เมื่อเลือก `env:` reference; ค่าเริ่มต้น `db:encrypted` จะรับ `webhookSecret` จาก request แรกแล้วเก็บแบบเข้ารหัสใน DB และใช้ secret เดิมกับ request ถัดไป |
| `LLGW_PAYMENT_WEBHOOK_ENABLED` | `src/lib/server/api-handler.cjs` | local LLGW receiver ปิดเป็นค่าเริ่มต้น; อย่าเปิดจนกว่า ownership/exception จะได้รับอนุมัติ |
| `AGENT_PD_SIGNING_SECRET_PREVIOUS` / `AGENT_PD_CALLBACK_SECRET_PREVIOUS` | signed PD/Agent Backoffice integration | รับ secret เดิมชั่วคราวระหว่าง rotation แล้วต้องลบเพื่อ revoke |
| `LLGW_PAYMENT_WEBHOOK_SECRET_PREVIOUS` | LLGW webhook verification | รับ secret เดิมชั่วคราวระหว่าง rotation แล้วต้องลบเพื่อ revoke |
| `PAYMENT_STATUS_WEBHOOK_ENABLED` | normalized payment-status callback receiver | ปิดเป็นค่าเริ่มต้นจนกว่า external contract และ staging evidence จะผ่าน |
| `PAYMENT_STATUS_WEBHOOK_SECRET(_PREVIOUS)` | normalized payment-status callback verification | secret manager เท่านั้น; รองรับ rotation ชั่วคราว |
| `PAYMENT_STATUS_TIMESTAMP_TOLERANCE_SECONDS` | normalized payment-status callback verification | ค่าเริ่มต้น 300 วินาที |
| `MERCHANT_HOME_CONTRACT_ENABLED` | `src/lib/server/api-handler.cjs` | gate ของ Home read model, capabilities, benefits, notifications และ STOPPAY routes; ค่าเริ่มต้น `false` |
| `TRANSACTION_ROUTING_ENABLED` / `TRANSACTION_QUERY_ROUTING_ENABLED` | `src/lib/server/integration/transactionService.cjs` | forward payment command และ query ไป Backoffice แบบ opt-in; ปิดเป็นค่าเริ่มต้น |
| `AGENT_PD_TRANSACTION_COMMAND_PATH` / `AGENT_PD_TRANSACTION_QUERY_PATH` | signed Backoffice client | path placeholder ที่ต้องตรงกับ signed contract ก่อนเปิด routing |
| `PUBLIC_PAYMENT_STORE_ID` | `src/lib/server/api-handler.cjs` public payment route | local Store UUID ที่อนุญาตให้ Booking/Customer สร้าง payment ผ่าน LLGW; ต้องมี active `backoffice_store_credentials` mapping |
| `PUBLIC_PAYMENT_MAX_AMOUNT` | `src/lib/server/api-handler.cjs` public payment route | ยอดสูงสุดต่อรายการของ public payment; ค่าเริ่มต้น `100000` |

`.env.example` ยังมีตัวแปรชื่อ `VITE_API_URL` และ `VITE_APP_ENV` จากยุค Vite เดิม ซึ่งไม่ใช่ตัวแปรที่ Next runtime ปัจจุบันอ่านโดยตรง ให้ใช้ `NEXT_PUBLIC_APP_URL` เป็นหลัก

ใน `.env.production` เปิด `AGENT_PD_INTEGRATION_ENABLED`, `KYC_DOCUMENT_INTAKE_ENABLED` และ `KYC_DOCUMENT_LINK_TTL_SECONDS="86400"` แล้ว. URL ภายนอกสำหรับลิงก์ที่ผู้ใช้เปิดคือ `NEXT_PUBLIC_APP_URL`. ห้ามใส่ Base URL, Backoffice Store ID, Key ID หรือค่า credential ต่อ Store ลง `.env`; ให้ provision ลง `backoffice_store_credentials` เท่านั้น

## Frontend routes

ทุก URL เข้ามาที่ catch-all route แล้ว `src/App.tsx` เป็นผู้เลือก view ตาม pathname:

| URL pattern | View | หน้าที่ |
|---|---|---|
| `/`, `/login`, `/landing` | `LandingPageView` | landing และ login |
| `/merchant`, `/merchant/*` | `MerchantView` | merchant back office |
| `/merchant/register`, `/register` | `MerchantRegistrationView` | สมัครร้านค้าและ KYC wizard |
| `/booking`, `/book`, `/services`, `/appointment` | `BookingPageView` | หน้าจองบริการ |
| `/catalog*`, `/sales*`, `/page/*`, `/sp/*` | `CatalogPageView` | catalog และ sales page |
| `/customer`, `/order`, `/delivery`, `/takeaway`, `/c/*`, `/t*` | `CustomerView` | สั่งซื้อและโต๊ะอาหาร |
| `/shop`, `/quickpay`, `/pay`, `/kiosk`, `/display`, `/s/*` | `QuickPayView` | cashier และ payment link |
| `/developer/*` | `DeveloperConsoleView` | API playground สำหรับ user ที่ login แล้ว |

เมื่อเพิ่ม route ใหม่ ให้ตรวจลำดับเงื่อนไขใน `src/App.tsx` ด้วย เพราะ route ที่ใช้ `startsWith()` อาจครอบคลุม pathname อื่นโดยไม่ตั้งใจ

สำหรับ Merchant navigation ให้แก้ [`src/merchantNavigation.ts`](../src/merchantNavigation.ts) เป็นจุดแรก เพราะไฟล์นี้เป็น authority ของ menu ID, URL target, bottom navigation และ capability visibility. จากนั้นจึงเพิ่ม render branch ใน `MerchantView.tsx`; ห้ามสร้าง menu target แยกใน component จน URL, active state และ direct-route guard ไม่ตรงกัน

### Merchant UI source และสถานะ route จริง

Merchant UI ใช้ `chatpos-payment-ai-main/app/page.tsx` และ `app/globals.css` เป็น **visual/interaction reference เท่านั้น**. Business logic, session, Store ownership, capability, API, idempotency, persistence และ error state ต้องยึด implementation ใน `chatpos-react`. ห้ามย้าย seeded data, local success state หรือ localStorage business authority จาก reference เข้ามา. `docs/419449.jpg` และ `docs/base.html` เป็น artifact เก่าและไม่ใช่ visual acceptance source แล้ว

สถานะที่ตรวจจาก render branch ใน `MerchantView.tsx` และ server/API ณ 2026-09-01:

| Merchant route | Owning view | Data/logic ที่ใช้จริง | สถานะ |
|---|---|---|---|
| `/merchant/home` | `MerchantHomeView.tsx` | Home read model, Store capability, notification API และ authenticated Store context | ใช้ได้เมื่อ `MERCHANT_HOME_CONTRACT_ENABLED` และ schema พร้อม |
| `/merchant/payment` | `QuickPayView.tsx` | transaction command, stable idempotency key, QR/checkout response และ status polling | frontend logic พร้อม; การรับเงินจริงขึ้นกับ routing flags, Store credential, Backoffice/LLGW และ callback readiness |
| `/merchant/transactions` | `TransactionsView` | Store-scoped Transaction API พร้อม search/filter | ใช้ได้แบบ read-only; ยังไม่มี detail/export UX |
| `/merchant/products` | `ProductsView` | Product create/read/update/archive/restore, transactional CSV import, CSV export, Store scope และ optimistic conflict ผ่าน PostgreSQL | ใช้ production path แล้วสำหรับ catalog fields, SKU, unit, active/stock policy และ bulk CSV; ยังขาด private image upload, category master, multilingual/gallery persistence และ price/stock history |
| `/merchant/reports` | `MerchantFinanceView` | Home summary และ transaction read model | ใช้ได้บางส่วนแบบ read-only; ไม่มี real chart/date range/export |
| `/merchant/wallet` | `MerchantFinanceView` | balance summary และรายการธุรกรรมจาก server | ดูได้; withdrawal/auto payout/bank change ยังไม่ใช่ production mutation |
| `/merchant/kyc` | `MerchantKycView.tsx` | KYC case/document version/chat/assignment API และ Store/Case authorization | implement แล้วแต่ feature/integration-gated; ต้องมี storage/scanner/Backoffice evidence |
| `/merchant/settings` | `SettingsView` + `ProfileSettingsModal` | session/profile display, browser speech test และ client preference UI บางส่วน | ใช้ได้บางส่วน; control ที่ไม่มี API/persistence ถูก disable แล้ว, audio preference ยังไม่ persist และ profile mutation ยังไม่ production-ready |
| `/merchant/pos` | `MerchantPosView` | Product/Table API, in-memory cart และ idempotent Order create | ใช้ production path แล้ว; cart เป็น transient UI stateและ orderถูก persistก่อนแสดง success |
| `/merchant/orders` | `MerchantOrdersView` | Store-scoped Order API, polling, optimistic version, server transition state machine และเสียงออเดอร์ใหม่ | ใช้ production pathแล้ว; DONE ตัด stockครั้งเดียวใน DB transaction |
| `/merchant/services` | `ServicesView` | hardcoded/localStorage service/booking state | development demo; production แสดง unavailable |
| `/merchant/salespage` | `SalesPageView` | hardcoded/localStorage builder state | development demo; production แสดง unavailable |
| `/merchant/tables` | `MerchantTablesView` | Table CRUD, optimistic version, open-order aggregate และ token QR | ใช้ production pathแล้ว; ปิดโต๊ะที่มี order เปิดอยู่ไม่ได้ |
| `/merchant/benefits` | `BenefitsView` | Store-scoped benefits read API พร้อม loading/empty/error/retry | read-only UI พร้อมเมื่อ `canUseBenefits`; ยังไม่มี claim/redemption mutation |
| `/merchant/stoppay` | `StoppayView` | Store-scoped state, merchant transition allowlist, reason, confirmation, idempotency และ audit | request UI พร้อมเมื่อ `canUseStopPay`; approval เป็นหน้าที่ Admin/Compliance |
| `/merchant/billing` | `MerchantSection` | ยังไม่มี invoice/fee authority และ reconciliation view | unavailable |
| `/merchant/developer` | `DeveloperConsoleView` | authenticated compatibility/testing surface | สำหรับ developer; ไม่ใช่ Merchant production workflow และห้าม persist secret ใน browser |

กฎเวลาแก้ UI ของ route เหล่านี้:

1. เปลี่ยน markup/CSS ได้โดยไม่เปลี่ยน API ownership หรือ state transition เดิม
2. Route ที่มี server read อย่างเดียวต้องไม่เพิ่มปุ่ม mutation จาก prototype
3. Services และ SalesPage ที่ยังเป็น demo ต้องถูกกั้นด้วย `allowDemoMerchantSurfaces`; production ต้องแสดง unavailable พร้อมเหตุผล
4. ปุ่มที่ backend ยังไม่มีต้อง disabled/unavailable ห้ามใช้ `alert()` หรือ local state แสดงผลสำเร็จปลอม
5. Payment ต้องใช้ `createTransactionCommand`, `transactionQrImageUrl`, idempotency key และ server status เดิม แม้ UI จะยกมาจาก Payment AI
6. Products ต้องใช้ Product API เป็น authority; CSV import/export ใช้ Store-scoped endpoint, archive แทน hard delete และ category/image upload ห้ามแสดงว่าสำเร็จก่อนมี endpoint จริง
7. Wallet ต้องคง withdrawal เป็น unavailable จนมี OTP, durable ledger, provider result และ reconciliation

Visual layer ปัจจุบันใช้ Payment AI tokens, Tahoma-first Thai type, dark AI header, teal/cyan/violet accent, glass cards และ gold focus ring ทั้งระบบแล้ว: Landing, Login, Registration, Customer Ordering, Booking, Catalog, standalone QuickPay/Developer และ Merchant route ทั้งหมด. Transactions/Product/Services/Developer table ถูกจัดเป็น stacked cards บน phone shell; KYC คง document/chat logic เดิมภายใต้ Payment AI card treatment. Demo route แสดง `DEMO ONLY`, Developer แสดง `TESTING SURFACE` และ route ที่ไม่มี logic ใช้ unavailable state แทน UI สำเร็จปลอม

Reference ล่าสุดมี `/order/[token]`, `/handoff/[id]`, `/admin`, `/admin/login`, `/login`, `/register` และ Membership screen เพิ่มเข้ามา. การรับเข้าฝั่ง `chatpos-react` มีขอบเขตดังนี้:

- Login/Register/Customer/Booking/Catalog รับ visual theme แล้ว แต่คง session, registration, public payment และ Store policy ของ `chatpos-react`
- Benefits และ STOPPAY มี local API อยู่แล้ว จึงเพิ่ม frontend view โดยใช้ local capability/authorization/idempotency
- `/handoff/[id]` และ signed table-order token route ยังไม่มี Order persistence/authorization owner จึงยังไม่สร้าง mock route
- `/admin` ไม่อยู่ใน `App.tsx` และเป็น backoffice คนละขอบเขต; ต้องตัดสิน owner/role/API ก่อนนำ Admin control center เข้ามา
- Membership billing/subscription ของ reference ไม่ใช่ contract เดียวกับ local Benefits API; local routeแสดง active benefits แบบ read-only ส่วน Billing ยังคง unavailable

### ระบบเสียงภาษาไทย

`src/useThaiVoice.ts` เป็น shared voice engine ที่นำ behavior จาก reference มาใช้โดยไม่ผูกกับ business state. รองรับ Web Speech API บนอุปกรณ์ทั่วไป และ sequential MP3 fallback เมื่อเปิดผ่าน LINE/in-app browser. ไฟล์เสียง 42 รายการอยู่ที่ `public/audio/th/`

| Surface | เสียงที่รองรับ | Trigger |
|---|---|---|
| Standalone และ Merchant QuickPay | อ่านเลข/operator ทุกปุ่ม, ช่องทางชำระ, ยอดก่อนยืนยัน และยอดเมื่อชำระสำเร็จ | user กด keypad/method/สร้าง QR และผล payment เปลี่ยนเป็น paid |
| Customer Ordering | อ่านผลส่งออเดอร์และผลยืนยันชำระเงิน | user ส่งออเดอร์หรือยืนยันชำระสำเร็จ |
| Settings | ทดสอบ Web Speech ตาม speed/voice/volume ที่เลือก | user กดปุ่มทดสอบ |

ทุก surface มี toggle, test และสถานะ `idle`, `ready`, `speaking`, `unsupported`, `error`. Browser ต้องได้รับ user gesture ก่อนเล่นเสียง; ห้ามพยายาม bypass autoplay policy. LINE mode ตรวจจาก user agent/query compatibility และใช้ไฟล์ `/audio/th/*.mp3`. Component cleanup ต้อง cancel speech และหยุด audio เมื่อ unmount

Merchant Orders poll Store-scoped Order API ทุก 5 วินาทีเมื่อ tab visible และพูดเฉพาะ order ID ใหม่หลัง initial load โดย dedupe ใน session. Production ระยะถัดไปควรเปลี่ยนเป็น server event/SSE หรือ webhook projection เมื่อมี owner เพื่อประหยัด polling

## ความสามารถตาม workflow

### Merchant onboarding และ KYC

ปัจจุบัน frontend รองรับแนวคิดการสมัครเป็นสองช่วง:

1. สมัครเปิดร้านค้าเริ่มต้นแบบรวดเร็ว
2. กรอกข้อมูลธุรกิจและเอกสาร KYC แบบละเอียด

ข้อมูลที่ workflow รองรับในระดับ UI/API ได้แก่ข้อมูลผู้สมัคร ร้านค้า ประเภทธุรกิจ เลขประจำตัว บัญชีธนาคาร เอกสาร และ consent/PDPA ตาม `registrationI18n.ts` และ `MerchantRegistrationView.tsx`

API ที่เกี่ยวข้อง:

- `POST /api/db/auth/register-merchant`
- `POST /api/v1/assignments/requests` สำหรับส่งคำขอผูก Agent ผ่าน signed server-side client
- `POST /api/webhooks/chatpos` สำหรับรับ signed assignment/KYC/Store workflow callback จาก Backoffice; `/api/webhooks/assignment-status` ยังรองรับเป็น compatibility path สำหรับ assignment event
- `GET /api/db/assignments` สำหรับอ่านสถานะ assignment ของ Store
- `PATCH /api/v1/stores/profile` สำหรับแก้ profile ผ่าน signed server-side client และ optimistic concurrency
- `POST /api/v1/kyc/cases/{caseId}/documents` สำหรับเพิ่ม KYC document version แบบ immutable
- `GET /api/db/kyc/workspace` สำหรับอ่าน case, document timeline, notifications และ chat
- `POST /api/db/kyc/cases/{caseId}/messages` สำหรับ append-only KYC Chat/Post
- `PATCH /api/db/kyc/cases/{caseId}/messages/{messageId}/read` สำหรับ read status
- `GET /api/db/kyc/documents/{versionId}/access` สำหรับตรวจ private document locator ตาม Store context
- `GET /api/db/kyc`
- `POST /api/db/kyc/update-status`

ระบบรองรับ `GET /api/v1/kyc/documents/{versionId}/download?token=...` สำหรับ signed download URL แล้ว โดย `POST /api/v1/kyc/cases/{caseId}/documents` รับ binary body ของไฟล์ พร้อม `X-KYC-File-Name`, `X-KYC-Document-Type` และ `X-KYC-Reason` ที่ encode ด้วย `encodeURIComponent`. Server คำนวณ SHA-256 เอง, สร้าง locator รูป `private/kyc/...` ที่ผูกกับ Store, Case และ idempotency request, เขียนไฟล์แบบไม่ overwrite และส่ง payload 7 fields ตาม Section 7 ของ Client Integration Guide ไปกับ command ของ PD/Agent ได้แก่ `documentId`, `documentType`, `version`, `checksumSha256`, `storageLocator`, `sourceIssuedAt` และ `sourceRequestId`; ห้ามส่ง `documentUrl` หรือ `documentUrlExpiresAt`. Backoffice ต้องตั้งค่า storage base URL/allowed origin ให้ resolve locator นี้ไปยัง private storage ของระบบหลักตาม contract. Token ผูกกับ `versionId` และ Store, หมดอายุตาม `KYC_DOCUMENT_LINK_TTL_SECONDS` ซึ่ง production ตั้งเป็น `86400` วินาที (24 ชั่วโมง); download จะตรวจ signature, expiry, scan status, ขนาด และ checksum พร้อมบันทึก audit

Phase 2 มี assignment service ใน `server/integration/assignmentService.cjs` ซึ่งบันทึก request และ event history แบบ durable, ใช้ idempotency ตาม `storeId + sourceRequestId`, ตรวจ callback ด้วย raw body และ HMAC แบบ constant-time และเปลี่ยน `Store.currentAgentId`/`Store.currentPdId` เฉพาะ callback สถานะ `ACCEPTED` ที่ resolve Agent และ PD ที่ active ได้เท่านั้น โดยจะลองทั้ง remote ID, Agent/PD code และข้อมูล assignment เดิมเพื่อรองรับระบบที่ใช้ UUID คนละชุด สถานะ `REJECTED`, `EXPIRED` และ `REASSIGNED` จะไม่ทำให้ Store ถูกผูก Agent ต่อ ส่วน callback ซ้ำหรือ callback ที่มาช้ากว่าจะถูก dedupe/ignore ใน transaction เดียวกับ state update

Merchant portal แสดงสถานะ `PENDING_ADMIN_ASSIGNMENT`, `PENDING_AGENT_ACCEPTANCE`, `ACCEPTED`, `REJECTED`, `EXPIRED` และ `REASSIGNED` พร้อม next action และจะแสดง Agent/PD เฉพาะเมื่อ status เป็น `ACCEPTED` การสมัคร Merchant จะส่ง assignment request หลังสร้าง Store สำเร็จ โดยรองรับทั้งการระบุเบอร์ Agent และการเว้นว่างให้ Admin จัดสรร หาก `AGENT_PD_INTEGRATION_ENABLED` หรือ `AGENT_PD_ASSIGNMENT_ENABLED` ยังปิดอยู่ การสมัครบัญชียังสำเร็จแต่จะไม่ forward assignment ไป Backoffice

Phase 2 command/callback ใช้ `storeId` จาก server-side authorization เพื่อ resolve mapping ใน `backoffice_store_credentials`; ไม่มี global Store/credential fallback และ request ที่ไม่มี active mapping จะถูกปฏิเสธแบบ fail-closed. Inbound callback resolve `body.storeId` จาก `backofficeStoreId` กลับเป็น local Store ID ก่อนเขียน `agent_assignments`, `Store` หรือ KYC state. `kyc.case.status.changed`, `store.assignment.changed` และ `store.status.changed` ใช้ callback secret เดียวกับ assignment, dedupe ด้วย event ID/body digest และกัน event เก่าย้อนสถานะด้วย `occurredAt`; KYC case จะผูกด้วย Backoffice `caseId` และ `assignmentRequestId` แล้วเก็บ remote case ID ไว้ใน `merchant_kyc_cases`. Browser request ใช้ server session และ API ตรวจ Store/Case ownership จากฐานข้อมูล; `X-Store-Id`, `X-Actor-Id` และ `X-Actor-Role` ไม่ได้รับความเชื่อถือและไม่อยู่ใน CORS allowlist แล้ว. ต้องทดสอบ command/callback กับ PD/Agent Backoffice staging จริง รวมถึง receiver downtime, secret rotation และ retry recovery

การรองรับ remote KYC case callback และเอกสารที่รอส่งใช้ migrations [`011_kyc_backoffice_callback_state.sql`](../database/migrations/011_kyc_backoffice_callback_state.sql) และ [`012_kyc_document_backoffice_dispatch.sql`](../database/migrations/012_kyc_document_backoffice_dispatch.sql) ซึ่งเพิ่ม remote case mapping, ลำดับ callback และสถานะ document dispatch; ต้อง apply ด้วย `npm run db:migrate` ก่อน deploy code ชุดนี้. Merchant อัปโหลดเอกสารได้ก่อน Agent รับงาน โดย local API จะตอบ `PENDING_ASSIGNMENT` และไม่ถือเป็น error. หลัง Backoffice ส่ง `kyc.case.status.changed` ที่มี remote `caseId` ระบบจะส่งเอกสารค้างด้วย idempotency เดิม และ worker จะ retry ตาม `KYC_DOCUMENT_RETRY_INTERVAL_MS`; หลัง deploy ให้ scheduler เรียก Backoffice `POST /api/internal/jobs/assignment-maintenance` ตามรอบที่กำหนดเพื่อ retry callback ที่ปลายทางล้มเหลว

Phase 3 เพิ่ม `profileKycService.cjs` สำหรับ profile update, KYC document intake และ KYC Chat/Post โดย profile รับเฉพาะ nested `profile` allowlist ตาม contract, ใช้ `expectedProfileVersion`, `Idempotency-Key` และ snapshot ใน `merchant_profile_versions`; conflict ตอบ `PROFILE_VERSION_CONFLICT` และ replay ของ payload เดิมไม่เพิ่ม version ซ้ำ การแก้ field ที่กระทบ KYC จะเก็บ submission snapshot เดิมแบบไม่ overwrite, เปลี่ยน case เป็น `WAITING_AGENT_REVIEW`, อัปเดต `KycVerification`, สร้าง notification ให้ Agent และเขียน audit

Document intake ตรวจ document type ตาม allowlist ใน Section 7 ของ guide, MIME (`application/pdf`, `image/jpeg`, `image/png`, `image/webp`), ขนาดไม่เกิน 10 MB, SHA-256 checksum และ `private/kyc/` locator เท่านั้น พร้อม unique `caseId + sourceRequestId`, `caseId + idempotencyKey`, `documentId + version` และ `documentId + checksum` เพื่อป้องกัน replay, overwrite และการใช้ version เดิมกับไฟล์ใหม่ การอัปโหลดก่อน Agent รับงานจะ commit local document version และตอบ `PENDING_ASSIGNMENT` โดยไม่แสดงเป็น error เพราะ Backoffice จะยังไม่มี remote KYC Case; หลัง callback `kyc.case.status.changed` ระบุ remote `caseId` ระบบจะส่ง document version ที่ค้างด้วย `documentId/version/sourceRequestId` เดิม และ retry ผ่าน `KYC_DOCUMENT_RETRY_INTERVAL_MS`. การแก้เอกสารจึงต้องส่ง request ใหม่พร้อม source request ใหม่เสมอ โดย `sourceIssuedAt` ถูก persist ใน version เพื่อให้ idempotent replay ใช้ payload เดิม ส่วน Chat/Post เก็บข้อความและ attachment metadata แบบ append-only และรองรับ read status

Phase 3 ยังเป็น feature-flagged integration: `MERCHANT_PROFILE_UPDATE_ENABLED` และ `KYC_DOCUMENT_INTAKE_ENABLED` ปิดเป็นค่าเริ่มต้น แต่ production ปัจจุบันเปิด `KYC_DOCUMENT_INTAKE_ENABLED=true`; route command จะ forward ผ่าน signed PD/Agent Backoffice client เมื่อเปิด flag เท่านั้น. Document intake รับ binary ผ่าน API, ตรวจ MIME/size/checksum, เก็บไฟล์ใน private filesystem adapter, เรียก scanner adapter และเก็บ `scanStatus`; scanner ที่ไม่มีหรือไม่พร้อมจะทำให้ version อยู่ในสถานะ quarantine และทั้ง access metadata กับ signed download จะไม่เปิดจนกว่าจะเป็น `CLEAN`. Signed URL ตรวจ signature, Store scope, expiry และ file integrity ก่อนส่งไฟล์ พร้อม audit การเปิดอ่าน; production ยังต้องยืนยัน private storage ที่เข้ารหัส, scanner service, Store credential mappings, staging replay/conflict และ Agent review -> PD/Compliance final decision

ข้อควรเข้าใจ: โค้ดปัจจุบันมี assignment, KYC Chat/Post, immutable document versions, server session, role/Store/Case authorization และ audit/retry foundations แล้ว แต่ยังไม่ใช่ implementation เต็มรูปแบบของ Merchant KYC ที่ผ่าน staging, PostgreSQL E2E, storage encryption/scanner verification, multi-level approval sign-off และ production operations ครบทุกขั้น หากพัฒนาต่อให้ใช้ skill [`merchant-kyc`](../.github/skills/merchant-kyc/SKILL.md) เป็นข้อกำหนด workflow

กฎ domain ที่ต้องรักษา:

- Agent ตรวจสอบเบื้องต้นและส่งต่อได้ แต่ไม่อนุมัติขั้นสุดท้ายคนเดียว
- เอกสารใหม่ต้องเป็น version ใหม่ ห้ามเขียนทับหลักฐานเดิม
- การขอข้อมูลเพิ่มควรเชื่อมกับ case และเอกสารที่ต้องแก้
- ทุก status transition สำคัญต้องเก็บ actor, เวลา, เหตุผล และ audit event
- ข้อมูลบัตรประชาชนและบัญชีธนาคารต้อง mask เมื่อไม่จำเป็นต้องแสดงเต็ม

### Flow สมัคร Merchant ตั้งแต่ OTP ถึงเปิดใช้งาน

Flow นี้เป็นลำดับมาตรฐานสำหรับ Merchant registration, KYC, ข้อมูลร้านค้า, สินค้า/บริการ, บัญชีรับเงิน และการอนุมัติ โดยแยกส่วนที่มีอยู่ใน prototype ปัจจุบันออกจากส่วนที่ต้องทำต่อเป็น production workflow

```mermaid
flowchart TD
    A[กรอกเบอร์โทรศัพท์] --> B[ขอ OTP SMS]
    B --> C{OTP ถูกต้องและยังไม่หมดอายุหรือไม่}
    C -->|ไม่ถูกต้อง| B2[เพิ่ม attempt หรือขอส่งใหม่ตาม rate limit]
    B2 --> B
    C -->|ถูกต้อง| D[ยืนยันเบอร์โทรศัพท์]
    D --> E[สร้าง Merchant account และ Store]
    E --> F[กรอก KYC และข้อมูลธุรกิจ]
    F --> G[กรอกสินค้าและบริการ]
    G --> H[เพิ่มบัญชีธนาคารรับเงิน]
    H --> I[อัปโหลดเอกสารและยินยอม PDPA]
    I --> J[ส่งคำขอ KYC]
    J --> K[ระบบตรวจความครบถ้วน]
    K -->|ข้อมูลไม่ครบ| F2[ขอแก้ไขข้อมูล]
    F2 --> F
    K -->|ครบ| L[Admin ตรวจสอบ]
    L -->|ขอข้อมูลเพิ่ม| F2
    L -->|ไม่อนุมัติ| M[REJECTED]
    L -->|อนุมัติ| N[APPROVED / เปิดรับชำระเงิน]
    N --> O[Merchant ขอถอนเงิน]
    O --> P[ขอ OTP SMS สำหรับถอนเงิน]
    P --> Q{OTP ถูกต้องหรือไม่}
    Q -->|ไม่ถูกต้อง| P2[ปฏิเสธหรือให้ลองใหม่ตาม policy]
    P2 --> P
    Q -->|ถูกต้อง| R[สร้างคำขอถอนเงินแบบ idempotent]
    R --> S[ส่งธนาคารหรือ payout provider]
    S --> T[รอผลและบันทึก settlement/audit]
```

#### 1. สมัครและยืนยันเบอร์ด้วย OTP SMS

1. Merchant กรอกเบอร์โทรศัพท์และระบบ normalize เป็นรูปแบบมาตรฐานก่อนตรวจซ้ำ
2. ระบบสร้าง OTP ตาม `purpose` เช่น `merchant_registration`, `change_phone` หรือ `withdrawal` และผูกกับเบอร์, session/request ID และวันหมดอายุ
3. ระบบเก็บเฉพาะ hash ของ OTP ไม่เก็บรหัสจริงใน database หรือ log แล้วส่งรหัสผ่าน SMS provider
4. จำกัดการขอส่งใหม่และจำนวนครั้งที่กรอกผิด เช่น cooldown ต่อเบอร์/IP/device และ lock ชั่วคราวเมื่อเกินจำนวนครั้ง
5. เมื่อกรอกรหัสถูกต้อง ระบบต้องตรวจ `purpose`, expiry, attempt, nonce และสถานะ `used` ก่อน mark เป็นใช้แล้วเพียงครั้งเดียว
6. หลังยืนยันสำเร็จให้บันทึก `phoneVerifiedAt` และออก registration session/server-side token ห้ามถือว่าแค่ส่ง OTP สำเร็จคือยืนยันตัวตนแล้ว
7. การส่ง OTP ซ้ำต้อง invalidate OTP เดิมตาม policy และห้ามส่งรหัสผ่าน query string, browser storage หรือ log

KYC case SMS/OTP ปัจจุบันมี SMSUP adapter ใน [`src/lib/server/integration/smsupClient.cjs`](../src/lib/server/integration/smsupClient.cjs), local challenge persistence และ routes ใน [`src/lib/server/api-handler.cjs`](../src/lib/server/api-handler.cjs) โดยเปิดใช้งานเมื่อ `SMS_OTP_ENABLED=true`, `SMS_OTP_PROVIDER_READY=true` และ `SMS_PROVIDER=smsup_plus`. ยังไม่มี production/staging delivery evidence ใน repository; ต้องทำ real delivery/verification E2E, ตรวจการหมุน credential และยืนยัน owner/contract กับ PD/Agent ก่อนถือว่า production-ready

#### 2. สร้างบัญชี Merchant และข้อมูลร้านค้า

หลังยืนยัน OTP สำเร็จ Merchant กรอก email, password, ชื่อผู้สมัคร, ชื่อร้าน, ประเภทร้าน, เบอร์ที่ยืนยันแล้ว และข้อมูลติดต่อ ระบบควรทำใน transaction เดียว:

- สร้าง `User` ด้วย role `owner` หรือ `merchant`
- สร้าง `Store` และผูกกับ `User`
- สร้าง `MerchantIdentity` สำหรับ merchant ID ที่ระบบออกให้
- สร้าง `KycVerification` หรือ `merchant_kyc_cases` สถานะเริ่มต้น `draft`
- บันทึก consent version และ audit event ของการสมัคร

API ปัจจุบันคือ `POST /api/db/auth/register-merchant` และบันทึก `User`, `Store`, `MerchantIdentity` และ `KycVerification` แต่ยังไม่ได้บังคับ KYC case OTP ก่อนสร้างบัญชีอย่างสมบูรณ์; OTP routes ปัจจุบันใช้กับ case ที่มีอยู่แล้วและจำกัด Merchant role. การบังคับ OTP ใน registration ต้องมี policy และ contract แยกต่างหาก รวมถึงยืนยัน transaction rollback, email/phone uniqueness, abuse controls และ staging authorization ก่อนใช้ production

#### 3. กรอก KYC และข้อมูลธุรกิจ

Merchant เลือกประเภทกิจการและกรอกข้อมูลตามลำดับ ไม่ควรใช้ form เดียวที่ไม่มี business rule:

1. ข้อมูลเจ้าของกิจการหรือข้อมูลนิติบุคคล
2. ชื่อร้าน ประเภทธุรกิจ ที่อยู่ สาขา พิกัด และช่องทางการขาย
3. สินค้า/บริการหลัก รูปแบบการดำเนินงาน ยอดขายโดยประมาณ และวัตถุประสงค์การรับเงิน
4. ข้อมูลบัญชีธนาคารรับเงิน
5. เอกสาร KYC ที่ตรงกับประเภทกิจการ
6. ตรวจทานข้อมูล, consent/PDPA และ submit

เลขบัตรประชาชน, เลขทะเบียนนิติบุคคล, เลขบัญชี และเอกสารต้อง mask เมื่อแสดงผล ใช้ private storage สำหรับไฟล์ และสร้าง document version ใหม่ทุกครั้งที่ส่งแก้ไข ห้าม overwrite version เดิม

สถานะที่ควรใช้:

`draft` -> `ready_for_submission` -> `pending_admin_review` -> `needs_more_info` -> `approved` หรือ `rejected`

หากใช้ Agent/PD workflow ร่วมด้วย ให้ Agent ตรวจสอบเบื้องต้นและส่งต่อ ส่วน PD/Compliance หรือผู้มีอำนาจเป็นผู้อนุมัติขั้นสุดท้าย ไม่ให้ Agent กดอนุมัติแทน

#### 4. ลงข้อมูลร้านค้า สินค้า และบริการ

ข้อมูลร้านค้าเป็น profile ของ Store ส่วนสินค้าและบริการเป็นข้อมูลที่ Merchant ใช้เปิดขายจริง ควรแยกสถานะและ audit ออกจาก KYC:

- ร้านค้า: ชื่อร้าน, ที่อยู่, เบอร์, ประเภทร้าน, เวลาเปิด-ปิด, ช่องทางขาย และสถานะเปิดใช้งาน
- สินค้า: ชื่อ, SKU, หมวดหมู่, รายละเอียด, ราคาขาย, ต้นทุน, stock, หน่วย, รูปภาพ, นโยบายตัดสต็อก และสถานะ active/archive
- บริการ: ชื่อบริการ, รายละเอียด, ราคา, ระยะเวลา, จำนวนคิว/slot, เงื่อนไขการจอง และสถานะ active

ตาราง `Product` มีอยู่ใน migration และถูกใช้โดย `/api/db/products` แล้ว. Migration `014_product_catalog_management.sql` เพิ่ม `unit`, `archivedAt`, catalog index และ Store-scoped active SKU uniqueness. CSV import บังคับ SKU ทุกแถว, รับสูงสุด 500 แถวต่อ request, rollback ทั้งชุดเมื่อมีแถวไม่ถูกต้อง และ upsert รายการที่มี SKU ตรงกัน จึงสามารถนำไฟล์เดิมเข้าซ้ำโดยไม่สร้างสินค้าซ้ำ. ส่วนข้อมูลบริการและตารางเวลาปัจจุบันยังมีส่วนที่อยู่ใน prototype/localStorage จึงควรเพิ่มตาราง service/availability เมื่อจะรองรับหลายอุปกรณ์หรือ production

กติกาการบันทึก:

- Merchant แก้ไขเฉพาะ Store ของตนเอง
- การเปลี่ยนข้อมูลที่กระทบ KYC ต้องสร้าง profile version ใหม่และส่ง review ตาม policy
- การแก้สินค้า/บริการไม่ควรแก้ทับประวัติราคา/สถานะที่จำเป็นต่อการตรวจสอบ transaction
- ห้ามเปิดขายสินค้า/บริการก่อน Store ผ่านสถานะที่ policy อนุญาต

#### 5. ลงข้อมูลบัญชีธนาคารสำหรับรับเงิน

1. Merchant เลือกธนาคารและกรอกเลขบัญชี, ชื่อบัญชี และประเภทบัญชี
2. ระบบตรวจ format และตรวจว่าชื่อบัญชีสอดคล้องกับเจ้าของกิจการ/นิติบุคคลตาม policy
3. Merchant อัปโหลดหน้าสมุดบัญชีหรือเอกสารยืนยันผ่าน private upload
4. ระบบเก็บ checksum, MIME, size, storage locator และ document version; ไม่เก็บ public URL หรือไฟล์ base64 ใน record
5. สถานะบัญชีควรเป็น `pending_verification`, `verified`, `rejected`, `suspended` หรือ `change_requested`
6. การเปลี่ยนบัญชีหลัง verified ต้องทำเป็นบัญชี/เวอร์ชันใหม่, ส่ง OTP ที่เบอร์ verified และอาจต้อง Admin review ใหม่
7. ห้ามให้ Merchant ถอนเงินไปยังบัญชีที่ยังไม่ verified และห้ามให้ frontend เป็นผู้ตัดสินสถานะเอง

prototype ปัจจุบันเก็บข้อมูลบางส่วนใน `Store.payoutBankName`, `Store.payoutAccountNumber`, `Store.payoutAccountName` และ `KycVerification` แต่ยังควรแยกเป็น `merchant_bank_accounts` และ `merchant_bank_account_versions` เพื่อรองรับหลายบัญชี, verification history, masking, replacement และ audit อย่างถูกต้อง

#### 6. ขั้นตอนการอนุมัติโดย Admin ระบบ

เมื่อ Merchant กด submit ระบบต้องสร้าง submission snapshot และเปลี่ยนสถานะใน transaction เดียว จากนั้น Admin ทำงานตามลำดับ:

1. ตรวจว่า OTP/เบอร์, ข้อมูลบังคับ, consent, เอกสาร และบัญชีรับเงินครบ
2. ตรวจ duplicate Merchant, risk flag, ชื่อบัญชีธนาคาร และความสอดคล้องของเอกสาร
3. เปิดดูข้อมูลเท่าที่ role มีสิทธิ์ และบันทึกทุก access/download ที่เป็นข้อมูลอ่อนไหว
4. เลือก action ได้เฉพาะตามสถานะ: `request_more_info`, `approve`, `reject`, `hold`
5. ทุก action ต้องมี actor, timestamp, reason, before/after และ request/correlation ID
6. ถ้าขอข้อมูลเพิ่ม ให้เปลี่ยนเป็น `needs_more_info` และระบุ field/document ที่ต้องแก้ ไม่ลบ submission เดิม
7. ถ้าอนุมัติ ให้เปลี่ยนเป็น `approved`, เปิด feature ที่ policy อนุญาต และส่ง notification
8. ถ้าปฏิเสธ ให้เก็บเหตุผลที่แสดงแก่ Merchant แยกจาก risk rule ภายใน และห้ามเปลี่ยนเป็น approved ผ่าน frontend โดยตรง

API ปัจจุบันมี `GET /api/db/kyc` และ `POST /api/db/kyc/update-status`; route status จำกัดไว้ที่ Compliance/Admin, ใช้ server session และเขียน before/after audit. ยังต้องเพิ่ม/ยืนยัน transition guard, review checklist, PostgreSQL permission matrix และ final approval policy ก่อน production

#### 7. ขั้นตอนการขอถอนเงินผ่าน OTP SMS

1. Merchant เปิดหน้ากระเป๋าเงิน ระบบอ่าน available balance และตรวจว่า Store/บัญชีธนาคาร/สถานะ KYC ผ่านเงื่อนไข
2. Merchant ระบุจำนวนเงินและบัญชีปลายทาง ระบบตรวจ minimum/maximum, fee, balance, pending withdrawal และ ownership ของบัญชี
3. Merchant กดขอถอน ระบบสร้าง withdrawal intent ที่ยังไม่ส่ง payout และส่ง OTP ไปยังเบอร์โทรศัพท์ที่ verified เท่านั้น
4. OTP ต้องผูกกับ `withdrawalId`, amount, destination account version และ `purpose=withdrawal`; หากเปลี่ยนยอดหรือบัญชีต้องยกเลิก OTP เดิมและสร้าง intent ใหม่
5. Merchant กรอก OTP ระบบตรวจ hash, expiry, attempts, used state และ lock policy จาก server
6. เมื่อยืนยันสำเร็จ ระบบทำ idempotent command ด้วย `Idempotency-Key` เดิมของ withdrawal intent แล้วส่งไป payout provider/Backoffice
7. เปลี่ยนสถานะเป็น `processing` และส่งผลผ่าน webhook/reconciliation เป็น `completed`, `failed`, `reversed` หรือ `cancelled`
8. บันทึก audit, OTP verification result, provider reference, fee, amount และบัญชีเวอร์ชันที่ใช้ โดย mask เลขบัญชีในทุก log/หน้าจอ

ห้ามสร้าง payout จาก frontend โดยตรง, ห้ามถือว่า response `200` คือเงินเข้าบัญชีแล้ว และห้ามสร้าง withdrawal ใหม่เมื่อ request เดิม timeout ก่อนรู้ผล ให้ตรวจสถานะด้วย `withdrawalId`/idempotency key เดิม

ปัจจุบัน `POST /api/v1/payouts` ใน `src/lib/server/api-handler.cjs` ยังเป็น prototype ที่คืนสถานะ `processing` และยังไม่มี OTP SMS, durable withdrawal record, provider integration หรือ settlement reconciliation ดังนั้น flow ถอนเงินจริงยังต้อง implement เพิ่มก่อนเปิด feature

#### สถานะ implementation ของ flow นี้

| ขั้นตอน | สถานะปัจจุบัน | จุดที่ต้องทำต่อก่อน production |
|---|---|---|
| KYC case OTP ผ่าน PD/Agent | มี route, challenge persistence, TTL, attempt limit, resend cooldown, lock, audit foundation และ SMSUP adapter | ทำ real SMSUP delivery/verification E2E และยืนยัน owner/contract กับ PD/Agent ก่อน production |
| สร้าง Merchant/Store/KYC | มี `POST /api/db/auth/register-merchant`, core tables และ server session สำหรับ login | บังคับ OTP, transaction boundary, validation และ staging authorization |
| KYC document/version | มี API, checksum, immutable version, private locator, quarantine/scanner status และ access audit | ต่อ private binary upload, signed download อายุ 24 ชั่วโมง, scanner จริง, encryption at rest, review queue และ PostgreSQL E2E |
| สินค้า | มี `Product` และ `/api/db/products` | ownership, validation, history และ production authorization |
| บริการ | ส่วนใหญ่ยังเป็น prototype/localStorage | service/availability schema และ API persistence |
| บัญชีรับเงิน | มี field ใน `Store`/`KycVerification` | dedicated account/version tables, verification และ change control |
| Admin approval | endpoint จำกัด Compliance/Admin และมี before/after audit | transition guard, checklist, decision policy และ final approval evidence |
| ถอนเงิน | มี prototype `/api/v1/payouts` | OTP, withdrawal ledger, idempotency, provider webhook และ reconciliation |

### Merchant back office

`MerchantView.tsx` รวมความสามารถหลายกลุ่มไว้ใน dashboard เดียว เช่น:

- ดูสถานะร้านค้าและ KYC
- จัดการสินค้า หมวดหมู่ สต็อก และราคา โดย `ProductsView` ใช้ Store-scoped Product API; Merchant POS ใช้ Product/Table API และ persist order แล้ว ส่วน public catalog legacy ยังมี transitional stateบางส่วน
- จัดการบริการและตารางจอง
- สร้าง/แก้ sales page และ catalog
- สร้างลิงก์หรือ QR สำหรับช่องทางขาย
- ดูคำสั่งซื้อและรายการชำระเงิน; wallet, revenue, billing และ payout ยังต้องแยกตามสถานะ prototype/feature gate ด้านล่าง
- เปิดหน้าตั้งค่าโปรไฟล์, notification และ integration entry ที่อนุญาตให้ Merchant ใช้

Services, SalesPage, legacy Customer route และ demo components บางส่วนยังเก็บ state ใน `localStorage` จึงไม่ใช่ authority สำหรับระบบหลายผู้ใช้. Merchant POS/Orders/Tables และ public `/order/:token` ไม่ใช้ localStorage เป็น order authorityแล้ว

Production path render PostgreSQL-backed POS, Orders และ Tables; Services/SalesPage ที่ยังไม่มี server persistence แสดง unavailable. Public `/order/:token` resolve Store/Table/Product จาก tokenฝั่ง serverและคำนวณราคาจาก Product rows. Public catalog ที่ไม่มี published sales pageจริงไม่ fallback ไป default catalogใน production

### Account และ supporting surfaces

สถานะปัจจุบันของ surface ที่อ้างอิงจาก UI reference มีดังนี้:

| Surface | Source ปัจจุบัน | สถานะและข้อจำกัด |
|---|---|---|
| Profile / account | `ProfileSettingsModal.tsx`, `SettingsView` ใน `MerchantView.tsx` | แสดงข้อมูลจาก server session ได้ แต่การกดบันทึก profile ใน modal ยังเป็น local UI prototype; การแก้ Store profile จริงต้องผ่าน signed `PATCH /api/v1/stores/profile` จาก server integration ตาม contract |
| Notifications | `MerchantHomeView.tsx`, `dbApi.ts` | ใช้ `/api/db/notifications` แบบ Store/recipient-scoped และมี mark-one/read-all mutation พร้อม server authorization; ถ้าโหลดไม่ได้ต้องแสดง error/retry ไม่ใช่ข้อมูล static |
| Notification preferences | settings/integration surface | ยังไม่มี Merchant preference persistence ที่ยืนยันใน local contract; ห้ามทำให้ toggle ใน UI สื่อว่าการส่ง email/SMS ถูกบันทึกจริงจนกว่าจะมี API/data owner |
| Integration / Developer entry | `DeveloperConsoleView.tsx`, `ProfileSettingsModal.tsx`, `chatposApi.ts` | ใช้ server session และเป็น compatibility testing; `getStoredApiKey()` ไม่คืน key และ `setStoredApiKey()` ไม่เขียน browser storage, ส่วน browser token minting `/api/v1/auth` ตอบ `410 API_TOKEN_DEPRECATED` |
| Wallet / revenue / billing | `MerchantFinanceView` ที่ route `wallet`/`reports`, Home summary | Wallet/Reports route ปัจจุบันอ่าน Store-scoped Home/Transaction read model; balance จะแสดง `—`, `ไม่มีสิทธิ์` หรือ `ยังไม่พร้อม` ตาม capability/ledger. `WalletView`/`ReportsView` เดิมยังอยู่เป็น legacy component แต่ไม่ใช่ production route; billing ยังเป็น unavailable จนมี source และ reconciliation จาก Finance/Payment |
| Withdrawal / payout | `/api/v1/payouts` prototype และ wallet UI | route ปัจจุบันคืน `processing` แบบ prototype ยังไม่มี durable withdrawal, OTP, provider result หรือ reconciliation และยังไม่ใช่ readiness-gated payout flow; ต้องกั้นไม่ให้เป็น production action และห้ามแสดงว่าเงินถูกโอนแล้ว |

Account/supporting flow ที่จะเปิดเป็น production ต้องตรวจ role, Store ownership, capability และ feature flag ที่ server; การซ่อนเมนูหรือปุ่มเป็นเพียง UX และ prototype บางส่วนในปัจจุบันยังอยู่ระหว่างการ harden. โดยเฉพาะยอดเงิน, transaction, payout และ KYC ห้ามให้ browser คำนวณสิทธิ์หรือเปลี่ยนสถานะเอง

### Customer ordering

`CustomerView.tsx` รองรับการเลือกสินค้า จัดการตะกร้า ส่งคำสั่งซื้อ เรียกพนักงาน และแยก context ของโต๊ะ/ช่องทาง เช่น delivery หรือ takeaway ข้อมูลคำสั่งซื้อบางส่วนใช้ key ใน `localStorage` เช่น `cust_orders_*` และ `merchant_live_orders`

### Booking และ digital catalog

- `BookingPageView.tsx` แสดงบริการ เวลา และสร้างรายการจอง
- `CatalogPageView.tsx` แสดงหน้าขาย/catalog ที่อ้างอิง slug และข้อมูลที่ merchant บันทึกไว้
- `MerchantView.tsx` เป็นจุดจัดการข้อมูลบริการ หน้าขาย และ QR/link

### External Backoffice contract กับ local ChatPOS implementation

[CHATPOS Client Integration Guide](CHATPOS_CLIENT_INTEGRATION_GUIDE.md) เป็น external target contract สำหรับ partner และต้องไม่ถูกตีความว่า endpoint ภายนอกถูก deploy หรือได้รับ sign-off ใน local repository แล้ว. [PHASE_0_CONTRACT_DECISION_RECORD.md](PHASE_0_CONTRACT_DECISION_RECORD.md) เป็นบันทึกขอบเขต/decision ที่มีอยู่ใน repository ส่วนสถานะงาน, owner และ external dependency ให้ติดตามใน [NEXT_STEPS_CHECKLIST.md](NEXT_STEPS_CHECKLIST.md); ก่อนหน้านี้มีการอ้างชื่อ `CHATPOS_INTEGRATION_HANDOFF.md` แต่ไฟล์ดังกล่าวไม่มีอยู่ใน repository ปัจจุบัน จึงไม่ควรใช้เป็นลิงก์อ้างอิงที่ทำงานไม่ได้

ก่อนเปิด feature หรือเปลี่ยน route ให้มี signed contract matrix จาก Backoffice ที่ยืนยัน endpoint, payload, scope, Store/amount ownership, response/error, idempotency, callback URL, signature, retry และ webhook owner ก่อนเสมอ ห้ามเปลี่ยน local implementation ให้เดาตามตัวอย่างใน guide เพียงอย่างเดียว

| พื้นที่ | External target ใน Integration Guide | Local ChatPOS ที่มีใน repository | งานที่ต้องทำต่อ |
|---|---|---|---|
| Merchant Home | ไม่ใช่ signed partner route; เป็น authenticated product surface ของ ChatPOS | Browser เรียก `/api/db/home` และ Home subroutes ด้วย `chatpos_session`; ถูก gate ด้วย `MERCHANT_HOME_CONTRACT_ENABLED` | ตรวจ PostgreSQL permission matrix, Store switching, browser evidence และเปิด flag หลัง rollout gate |
| Payment command | Signed `POST /api/v1/transactions` — Backoffice creates Transaction, composes `commercial` payload via `src/lib/llgw/commercial-builder.ts`, calls LLGW with PD child credential (`PdGatewayConnection.secretKeyEncrypted`); returns `qrCodeUrl` / `checkoutRedirectUrl`. Legacy `POST /api/v1/transactions/{id}/payment` remains open for partners that create Transactions ahead of payment | Browser calls local `/api/v1/transactions`; local `POST /api/v1/transactions` handler forwards through the signed adapter using `AGENT_PD_TRANSACTION_COMMAND_PATH` (default `/api/v1/transactions`); **no local QR fallback** (removed 2026-08). Requires `TRANSACTION_ROUTING_ENABLED=true`; failure returns 503 | PD must have `PdGatewayConnection.status=active` with valid `clientId`, `secretKeyEncrypted` and `keyVerifiedAt`, and an `ACTIVE` `CommissionRule` (or fallback rate policy) for `commercial` builder to produce a valid payload. **Both `chatpos-react` and `chatpos-agentpd` must be deployed together**: if Backoffice production is missing `src/app/api/v1/transactions/route.ts`, Merchant surfaces `404 BACKOFFICE_TRANSACTION_REJECTED` because Backoffice returns Next.js HTML 404 for the unregistered route |
| Merchant callback receiver | Merchant/partner ต้องลงทะเบียน callback URL กับ Backoffice | มี local `/api/webhooks/assignment-status` และ `/api/webhooks/payment-status` สำหรับคนละ callback boundary | ยืนยัน callback owner, event schema, secret และ retry contract ก่อน map external URL กับ receiver ใด ๆ |
| LLGW pay-in webhook | Target ให้ PD/Agent รับ LLGW, verify/dedupe/update payment state | ChatPOS มี local `POST /api/webhooks/llgw/payment` แต่ gate ด้วย `LLGW_PAYMENT_WEBHOOK_ENABLED=false` เป็นค่าเริ่มต้น | ยืนยัน ownership หรือ architecture exception ก่อนเปิด receiver ใน environment ใด ๆ |
| Normalized payment status | PD/Agent ส่ง signed payment-status webhook และเปิด status query ให้ partner | ChatPOS มี gated receiver ที่ `POST /api/webhooks/payment-status` และ signed payment query adapter; ทั้งคู่ปิดเป็นค่าเริ่มต้น | ยืนยัน event schema/path/secret/retry แล้วเปิดใช้ใน staging, เพิ่ม reconcile และ retire/exception local LLGW receiver |
| KYC phone OTP | Target มี Backoffice `/otp` และ `/otp/verify` ให้ Backoffice สร้าง/verify challenge | ChatPOS มี Merchant-only KYC case routes, PostgreSQL challenge persistence และ fail-closed provider stub; ยังไม่มี provider adapter จริง | ยืนยัน external OTP contract, SMS readiness, lock policy และทำ staging delivery E2E ก่อนเปิด |
| Commission settlement | Partner ส่ง signed settlement fact ไปยัง Backoffice-provided destination URL | ChatPOS สร้าง durable settlement event และ dispatch ไป `COMMISSION_EVENT_SOURCE_URL`; ไม่มี inbound `/api/webhooks/commission/settlement` route | ยืนยัน Finance mapping/destination และทดสอบ retry/dead-letter/reconciliation |

### Merchant Home local contract

Merchant Home เป็น authenticated product surface ที่ `/merchant#home` และต้องแยกจาก public landing ที่ `/`. UI ใช้ relative `/api/db/*` พร้อม HttpOnly `chatpos_session`; ไม่ใช้ external signed `/api/v1` contract และไม่ควร aggregate ยอดหรือเลือก Store จากข้อมูลใน browser เอง. ทุก route ด้านล่างตรวจ Store ownership จาก server session และถูก gate ร่วมด้วย `MERCHANT_HOME_CONTRACT_ENABLED`:

| Method | Local endpoint | หน้าที่และข้อควรระวัง |
|---|---|---|
| `GET` | `/api/db/home?storeId=` | read model เดียวสำหรับ Store summary, transaction counts, unread count, quick actions, capabilities, STOPPAY state และ freshness; ค่า balance ที่ยังไม่มี ledger อนุมัติคืนเป็น `null` พร้อม `balanceStatus=not_available` |
| `GET` | `/api/db/capabilities?storeId=` | capability flags ของ Store เช่น balance, transactions, benefits, STOPPAY และ billing |
| `GET` | `/api/db/benefits?storeId=&page=&limit=` | อ่าน active benefits ที่อยู่ในช่วงเวลา; endpoint นี้ไม่มี claim side effect |
| `GET` | `/api/db/notifications?storeId=&page=&limit=&category=&unreadOnly=` | อ่าน notification ที่ Store และ recipient ตรงกับ session พร้อม pagination |
| `POST` | `/api/db/notifications/{id}/read?storeId=` | mark notification อ่านแล้วแบบทำซ้ำได้; ตรวจ recipient/Store และเขียน audit |
| `POST` | `/api/db/notifications/read-all?storeId=` | mark notification ที่ยังไม่อ่านทั้งหมดของ Store และ recipient ปัจจุบัน |
| `GET` | `/api/db/stoppay?storeId=` | อ่าน STOPPAY state และ role-allowed transitions |
| `POST` | `/api/db/stoppay` | ขอ/อนุมัติ transition ด้วย `Idempotency-Key`; body ใช้ `action`, `reason` และ Store มาจาก authorization context |
| `GET` | `/api/db/transactions?storeId=&status=&channel=&transactionType=&from=&to=&page=&limit=` | อ่าน transaction ตาม Store/role พร้อม filter ที่ allowlist และ pagination; ไม่ใช้แทน external payment query |

`/api/db/home` เป็น source เดียวของ Home summary ใน frontend ปัจจุบัน. หาก route ตอบ `404 FEATURE_DISABLED`, ต้องคง UI เป็น unavailable/rollback state และไม่ fallback ไปคำนวณตัวเลขทางการเงินจาก client. การเปิด flag ต้องทำหลัง migration 008, permission matrix, PostgreSQL E2E และ browser evidence ผ่านตาม [Merchant Home QA Runbook](MERCHANT_HOME_QA_RUNBOOK.md)

### Store-scoped Backoffice credentials

ตาราง `backoffice_store_credentials` เป็น source of truth สำหรับค่าที่เปลี่ยนตาม Store หรือ environment โดยใช้ unique key `(storeId, environment)`. ต้องเก็บ `backofficeBaseUrl`, `keyId`, `validFrom`, `expiresAt` และ `status` ใน database; `backofficeStoreId` เป็น optional ได้เฉพาะกรณีที่ Backoffice ใช้ Store UUID เดียวกับ local เท่านั้น แต่ต้อง provision เมื่อสองระบบใช้ identifier ต่างกัน เพราะ inbound callback ใช้ค่านี้ resolve กลับเป็น local Store. Outbound Bearer/Signing ใช้ค่าจาก `CHATPOS_BACKOFFICE_BEARER_SECRET` และ `CHATPOS_BACKOFFICE_SIGNING_SECRET` ใน server environment ตามปกติ; ส่วน `callbackSecretRef` ใช้ resolve Callback Secret ของ mapping. Request แรกส่งได้โดยยังไม่มี Callback Secret เพราะ resolver จะ resolve Callback Secret แบบ lazy หลัง Backoffice ส่ง `webhookSecret` กลับมา; request ถัดไปใช้ secret เดิมโดยไม่ต้องรอ secret ใหม่. คอลัมน์ secret references เดิมยังรองรับเป็น fallback compatibility และ `callbackSecretEncrypted` ใช้เก็บค่าที่เข้ารหัสใน DB; ห้ามใส่ secret plaintext ใน database, seed, `.env.example`, log หรือ request body. Resolver จะ query mapping ใหม่ตาม request และ fail-closed ถ้า Store ไม่มี mapping ที่ active หรือ secret resolver ใช้งานไม่ได้

สำหรับ Callback Secret ที่อ้างด้วย `callbackSecretRef`, resolver รองรับ `db:encrypted`, `env:VARIABLE_NAME` และ `file:/run/secrets/name`. Mapping ใหม่ใช้ `db:encrypted` ได้ตั้งแต่ก่อน request แรก; หลัง Backoffice คืน `webhookSecret`, server จะเข้ารหัสลง `callbackSecretEncrypted` และถอดกลับเฉพาะตอน verify callback. ต้องกำหนด `CHATPOS_CALLBACK_SECRET_ENCRYPTION_KEY` ใน server secret manager; หากไม่กำหนด local compatibility จะใช้ `SESSION_SECRET` เป็น fallback. ส่วน `CHATPOS_BACKOFFICE_BEARER_SECRET` และ `CHATPOS_BACKOFFICE_SIGNING_SECRET` เป็น runtime secret ปกติจาก server environment/secret manager สำหรับ outbound request ไม่ใช่ค่า mapping. ห้ามใช้ global Store/credential fallback. การสร้างหรือเปลี่ยน mapping ให้ใช้ migration/provisioning job หรือ Admin API ที่เขียนลง `backoffice_store_credentials` โดยไม่เปิดเผย secret value

คำสั่ง `npm run db:provision-backoffice-mapping` ใช้ `BACKOFFICE_MAPPING_*` เป็น input ของผู้ดูแลเพื่อ upsert mapping ลง database ครั้งเดียวหรือเมื่อมีการเปลี่ยนค่าเท่านั้น. หากไม่ระบุ reference จะใช้ `env:CHATPOS_BACKOFFICE_BEARER_SECRET`, `env:CHATPOS_BACKOFFICE_SIGNING_SECRET` และ `db:encrypted` สำหรับ Callback Secret. ต้องรัน migration 009 ก่อนใช้ `db:encrypted`. ตัวแปรชุดนี้ไม่ถูกอ่านโดย runtime หลัง provision เสร็จ และห้ามส่ง secret value เข้า command หรือ database. หลังจากนั้น runtime จะอ่าน row ต่อ Store/environment ใหม่ทุก request

สถานะของ local payment flow จึงต้องเรียกอย่างตรงไปตรงมาว่า `local implementation` หรือ `legacy receiver` จนกว่า external contract จะผ่าน staging. การมี `TRANSACTION_ROUTING_ENABLED=true` หรือ `TRANSACTION_QUERY_ROUTING_ENABLED=true` ไม่ได้ยืนยันว่า Backoffice รองรับ path/payload จริง หรือว่า webhook ownership ถูกย้ายแล้ว

สิ่งที่มีใน repository คือ local transaction client ที่ `/api/v1/transactions`, signed payment query adapter, gated normalized receiver ที่ `/api/webhooks/payment-status`, Merchant-only KYC OTP routes, stable `clientReference`, idempotency, signed settlement dispatch และ durable retry/dead-letter. Local LLGW receiver ที่ `/api/webhooks/llgw/payment` มีไว้เป็น gated migration/exception path และปิดเป็นค่าเริ่มต้น. สิ่งที่ยังเปิดใช้ไม่ได้จากเอกสารเพียงอย่างเดียวคือ target command/query path และ payload, Backoffice-owned LLGW flow, การเปิด normalized receiver ใน environment จริง, KYC OTP provider adapter และ commission destination; รายการเหล่านี้ต้องมี owner, signed contract และ staging evidence ก่อนเปลี่ยน feature flag หรือ route production

### Payment และ Developer Console

`QuickPayView.tsx` และ `chatposApi.ts` ใช้ server-session API สำหรับ:

- ส่ง local transaction command ผ่าน `/api/v1/transactions` (same-origin เท่านั้น; `src/chatposApi.ts` ตั้ง `DEFAULT_API_BASE_URL=''`); เมื่อ `TRANSACTION_ROUTING_ENABLED=true` server จะ forward ไปยัง Backoffice `POST /api/v1/transactions` (ตาม `AGENT_PD_TRANSACTION_COMMAND_PATH`) พร้อม signed HMAC + `payment:create` scope. Response จาก Backoffice ต้องมี `data.payment.qrCodeUrl` หรือ `data.payment.checkoutRedirectUrl` — Backoffice ประกอบ `commercial` payload ให้อัตโนมัติจาก Store + PD + Agent + membership state และเรียก LLGW ด้วย child credential ของ PD; ถ้า Backoffice/LLGW ล้ม merchant server ส่ง error ตรงกลับ browser (ไม่มี local QR fallback อีกต่อไป)
- external target command คือ `POST /api/v1/transactions` (สร้าง Transaction + payment ใน 1 call) หรือ `POST /api/v1/transactions/{id}/payment` (สร้าง payment สำหรับ Transaction ที่มีอยู่แล้ว) — ทั้งสอง path ห้ามเรียกจาก Browser ตรง
- ตรวจสถานะ payment reference และ ownership
- อ่านสถานะผ่าน local transaction query หรือ signed external query adapter เมื่อ `TRANSACTION_QUERY_ROUTING_ENABLED=true`; external target query คือ `GET /api/v1/transactions/{id}/payment`
- รับผลชำระผ่าน normalized payment-status callback ที่ถูก gate ด้วย `PAYMENT_STATUS_WEBHOOK_ENABLED`; local signed LLGW webhook เป็น migration/exception path ที่ปิดด้วย `LLGW_PAYMENT_WEBHOOK_ENABLED`
- ดู balance ตาม Store scope
- เรียก payout prototype ที่ถูกจำกัดด้วย session และ role

Payment response fields ที่ browser และ Merchant server ใช้:

| Field | ใช้เมื่อ | หมายเหตุ |
|---|---|---|
| `qrCodeUrl` | Provider คืน URL รูป QR (PromptPay หรือ hosted methods) | ใช้เป็น `<img src>` ได้ตรง ๆ; สำหรับ hosted methods รูปนี้คือ QR ที่ encode `checkoutRedirectUrl` |
| `qrRawText` | Provider คืน Base64 PNG (`iVBORw0KGgo...`) ของ QR | Browser ต้องเติม prefix `data:image/png;base64,` ก่อนใช้เป็น `<img src>`; PromptPay ห้าม parse เป็น EMVCo payload, สำหรับ hosted methods รูปนี้คือ QR ที่ encode `checkoutRedirectUrl` |
| `checkoutRedirectUrl` | Hosted checkout สำหรับช่องทางที่ไม่ใช่ PromptPay (TrueMoney, Card, LINE Pay, Alipay, WeChat, ShopeePay ฯลฯ) | Browser แสดง `qrCodeUrl`/`qrRawText` เป็น QR ในตำแหน่งเดียวกับ PromptPay (สแกนแล้วเปิดหน้า checkout) และแสดงปุ่ม/ลิงก์ `checkoutRedirectUrl` ใต้ QR เพื่อให้ผู้ใช้กดเปิดหน้า checkout ได้โดยไม่ต้อง scan; ห้าม auto-redirect ด้วย `window.location.assign` โดยไม่แสดง QR |
| `paymentReference` / `gatewayReference` | ทุก channel | ใช้ query status ด้วย `checkTransactionStatus` |

`src/chatposApi.ts` มี helper `transactionQrImageUrl(transaction)` ที่ resolve ระหว่าง `qrCodeUrl` และ Base64 `qrRawText` เป็น URL/data URL พร้อมใช้; หน้า UI ที่เรียก `createTransactionCommand` ต้องใช้ helper นี้แทนการอ่าน `qrCodeUrl` ตรง ๆ และใช้ได้ทั้ง PromptPay และ hosted methods เพราะ Backoffice/LLGW คืน QR image (Base64/URL) ที่ encode `checkoutRedirectUrl` มาในฟิลด์เดียวกัน. Client ที่ใช้ pattern นี้: [`MerchantView.tsx`](../src/MerchantView.tsx), [`QuickPayView.tsx`](../src/QuickPayView.tsx), [`DeveloperConsoleView.tsx`](../src/DeveloperConsoleView.tsx), [`ProfileSettingsModal.tsx`](../src/ProfileSettingsModal.tsx). Merchant server map field เหล่านี้ผ่าน [`transactionService.cjs`](../src/lib/server/integration/transactionService.cjs) และบันทึกใน `Transaction.paymentMetadataJson` เพื่อรองรับ idempotent replay

Non-PromptPay channels ต้องส่ง `channel` เป็นชื่อ LLGW paymentMethod ที่เจาะจงเช่น `truemoney`, `linepay`, `wechatpay`, `alipay_online`, `shopeepay`, `card` หรือ `mobile_banking` เพื่อล็อคหน้า LianLian Hosted Checkout ให้เห็นเฉพาะ channel ที่เลือก; ห้ามส่ง `channel: 'checkout'` เมื่อ POS เลือก channel เฉพาะไว้แล้ว เพราะ LianLian จะแสดง payment method ทั้งหมด. Merchant UI (เช่น `QuickPayView`, `MerchantView`) ใช้ helper `quickPayMethodToChannel(selectedMethod)` ใน `src/chatposApi.ts` เพื่อ map ชื่อเมนู (`visa_th`/`visa_int` → `card`, `wechat` → `wechatpay`, `alipay` → `alipay_online` ฯลฯ) ก่อนส่งเข้า `createTransactionCommand`. [`BookingPageView.tsx`](../src/BookingPageView.tsx) และ [`CustomerView.tsx`](../src/CustomerView.tsx) ใช้ `createPublicTransactionCommand` ผ่าน `POST /api/v1/public-payments` แล้ว โดย server ผูก Store จาก `PUBLIC_PAYMENT_STORE_ID`, ใช้ Store-scoped Backoffice mapping และส่งต่อแบบ signed ไปยัง PD/LLGW. ทั้ง PromptPay และ hosted methods แสดง QR image ผ่าน `transactionQrImageUrl` ในตำแหน่งเดียวกัน; ช่องทาง hosted เพิ่มปุ่ม/ลิงก์ `checkoutRedirectUrl` ใต้ QR เพื่อให้ผู้ใช้กดเปิดหน้า checkout ได้โดยไม่ต้อง scan. Public route ไม่รับ `storeId` จาก browser และจำกัด rate/ยอดต่อรายการเพื่อเป็น MVP; production ที่มีหลาย Store ต้องเปลี่ยนเป็น signed public checkout token ต่อ Store

`POST /api/v1/public-payments` เป็น server-side bridge สำหรับ public Booking/Customer pages เท่านั้น. Request ใช้ `Idempotency-Key` และ body ที่จำเป็นคือ `amount`, `channel` (`promptpay` หรือ `checkout`), `customerName`, `customerPhone` และ `note`; browser ไม่ส่ง bearer/signing secret และไม่เลือก Store เอง. Route สร้าง success/failed redirect จาก Merchant `NEXT_PUBLIC_APP_URL` แล้ว forward ให้ Backoffice/LLGW เพื่อไม่ให้ hosted checkout กลับไปที่ domain ของ Backoffice. Response ใช้โครงสร้าง `transaction` เดียวกับ `/api/v1/transactions` และต้องเก็บ `paymentReference`/`gatewayReference` สำหรับตรวจสถานะ

`DeveloperConsoleView.tsx` เป็นเครื่องมือทดลอง endpoint และดู developer logs สำหรับผู้ใช้ที่ผ่าน server session แล้ว. ตัวอย่างหรือ Bearer API key ที่กรอกใน Playground เป็น compatibility testing สำหรับการจำลอง server-to-server เท่านั้น ไม่ใช่ authentication path ของ Merchant Home; Home ต้องใช้ HttpOnly session กับ `/api/db/*`. Frontend route guard เป็นเพียง UX, authorization จริงเกิดที่ `src/lib/server/api-handler.cjs`, browser token minting จาก `/api/v1/auth` ถูกปิดด้วย `410 API_TOKEN_DEPRECATED` และห้าม persist API key ใน `localStorage`, cookie หรือ source code

## API reference ภายใน

### Database API: `/api/db`

| Method | Endpoint | หน้าที่ |
|---|---|---|
| `POST` | `/auth/login` | login และดึงข้อมูล role ที่เกี่ยวข้อง |
| `GET` | `/auth/session` | hydrate verified server session; ไม่คืน raw token |
| `POST` | `/auth/logout` | revoke current server session |
| `POST` | `/auth/register-merchant` | สมัคร Merchant |
| `POST` | `/auth/register-agent` | สมัคร Agent |
| `POST` | `/auth/register-pd` | สมัคร PD |
| `GET` | `/health` | ตรวจการเชื่อมต่อฐานข้อมูล |
| `GET` | `/stats` | ดึงสถิติภาพรวม |
| `GET` | `/home?storeId=` | Merchant Home read model; gated ด้วย `MERCHANT_HOME_CONTRACT_ENABLED` |
| `GET` | `/capabilities?storeId=` | อ่าน Home capability flags |
| `GET` | `/benefits?storeId=&page=&limit=` | อ่าน active benefits |
| `GET` | `/notifications?storeId=&page=&limit=&category=&unreadOnly=` | อ่าน Store/recipient-scoped notifications |
| `POST` | `/notifications/:id/read?storeId=` | mark notification read |
| `POST` | `/notifications/read-all?storeId=` | mark notifications read ทั้งหมด |
| `GET` | `/stoppay?storeId=` | อ่าน STOPPAY state และ transitions |
| `POST` | `/stoppay` | ทำ STOPPAY transition พร้อม idempotency |
| `GET` | `/tables?storeId=` | อ่านโต๊ะพร้อมยอด/จำนวน order เปิดอยู่ |
| `POST` | `/tables` | เพิ่มโต๊ะแบบ idempotent |
| `PATCH` | `/tables/:id` | แก้ไขหรือปิดโต๊ะด้วย optimistic version |
| `GET` | `/orders?storeId=&status=&limit=` | อ่าน order aggregate พร้อม line items |
| `POST` | `/orders` | สร้าง order โดย serverอ่าน Product/ราคาและคำนวณยอด |
| `PATCH` | `/orders/:id/status` | เปลี่ยน status ตาม state machine; DONE commit stockครั้งเดียว |
| `GET` | `/kyc` | ดึง KYC cases |
| `POST` | `/kyc/update-status` | เปลี่ยนสถานะ KYC |
| `GET` | `/stores` | ดึงร้านค้า |
| `GET` | `/agents` | ดึง Agent |
| `GET` | `/pds` | ดึง PD |
| `GET` | `/transactions` | ดึงธุรกรรม |
| `POST` | `/transactions/create` | สร้างธุรกรรม |
| `GET` | `/products` | ดึงสินค้า |
| `POST` | `/products` | เพิ่มสินค้าพร้อมราคา ต้นทุน SKU หน่วย สต็อก และ sale/stock policy |
| `PATCH` | `/products/:id` | แก้ไขสินค้าด้วย optimistic `expectedUpdatedAt` |
| `DELETE` | `/products/:id?storeId=` | archive สินค้าและปิดขายโดยไม่ลบประวัติ order |
| `POST` | `/products/:id/restore` | คืนสินค้าออกจากคลังถาวร |
| `GET` | `/products/export?storeId=` | ดึง catalog สำหรับสร้าง CSV สูงสุด 5,000 รายการ |
| `POST` | `/products/import` | import/upsert catalog สูงสุด 500 แถวใน database transaction เดียว |
| `GET` | `/commissions` | ดึงค่าคอมมิชชัน |

### Public order/payment API

| Method | Endpoint | หน้าที่ |
|---|---|---|
| `GET` | `/api/public/table-order?token=` | resolve active Table/Store และสินค้าเปิดขายจาก opaque table token |
| `POST` | `/api/public/table-orders` | สร้าง Table order แบบ rate-limited/idempotent; browserเลือก Store/Table/ราคาเองไม่ได้ |
| `POST` | `/api/v1/public-payments` | สร้าง payment สำหรับ public Booking/Customer ผ่าน Backoffice/PD/LLGW โดยใช้ `PUBLIC_PAYMENT_STORE_ID` |

### Developer API: `/api/v1`

| Method | Endpoint | หน้าที่ |
|---|---|---|
| `POST` | `/payments/qr` | สร้าง payment QR |
| `GET` | `/payments/:reference` | ตรวจสถานะธุรกรรม |
| `POST` | `/payments/confirm` | ยืนยัน payment |
| `GET` | `/balance` | ดู balance และจำนวนธุรกรรม |
| `POST` | `/transactions` | local browser/session command ส่งต่อไปยัง PD/Agent Backoffice เมื่อ routing เปิด พร้อม idempotency |
| `GET` | `/transactions/:reference` หรือ `/transactions/:reference/payment` | local transaction query ตาม Store ownership; อาจ forward ไป external query path เมื่อ routing เปิด |
| `POST` | `/kyc/cases/:caseId/otp` | ขอ OTP สำหรับ KYC case; Merchant-only และตอบ `503 NOT_READY` จนกว่า provider พร้อม |
| `POST` | `/kyc/cases/:caseId/otp/verify` | ตรวจ OTP สำหรับ KYC case; Merchant-only |
| `POST` | `/auth` | deprecated; browser token minting ถูกปิดด้วย `410 API_TOKEN_DEPRECATED` |
| `POST` | `/payouts` | สร้าง payout |
| `GET` | `/developer/logs` | ดู webhook event logs |

ตัวอย่างการเรียกจาก frontend ควรใช้ relative endpoint เช่น:

```ts
await fetch('/api/db/health')
await fetch('/api/v1/transactions/PAY-REF-100293', { credentials: 'include' })
```

External target payment command/query ใช้ signed Merchant API ตาม [CHATPOS Client Integration Guide](CHATPOS_CLIENT_INTEGRATION_GUIDE.md) และไม่ใช่ Browser session route. Local signed payment callback จาก LLGW ใช้ `POST /api/webhooks/llgw/payment` พร้อม raw-body HMAC, timestamp และ event ID; callback นี้เป็น server-to-server route จึงไม่ใช้ browser session. Normalized payment-status callback จาก PD/Agent ใช้ `POST /api/webhooks/payment-status` พร้อม `X-ChatPOS-Event-Id`, `X-ChatPOS-Event-Type: payment.status.changed`, `X-ChatPOS-Timestamp` และ `X-ChatPOS-Signature`; header event type ต้องตรงกับ `body.eventType`, ใช้ raw-body HMAC, event dedupe และ state projection แต่ยังปิดด้วย feature flag จนกว่า external contract จะผ่าน staging. Assignment callback จากระบบ PD/Agent ใช้ `POST /api/webhooks/assignment-status` พร้อม `X-ChatPOS-Event-Type: assignment.status.changed` และ signature contract เดียวกันตาม Integration Guide. Local LLGW exception ใช้ `X-LLGW-*` headers และไม่ใช้ `X-ChatPOS-Event-Type`

### Signed Backoffice Client

การเชื่อมต่อ Agent/PD Backoffice ฝั่ง server ใช้ [`src/lib/server/integration/signedMerchantClient.cjs`](../src/lib/server/integration/signedMerchantClient.cjs) เท่านั้น ห้าม importโมดูลนี้เข้า client component หรือส่ง secret ไป browser โมดูลนี้ทำงานดังนี้:

- serialize JSON เป็น raw body เพียงครั้งเดียว แล้วใช้ string เดิมสำหรับ HTTP body และ SHA-256 digest ทุก retry
- สร้าง canonical path, timestamp, nonce และ `v1=` HMAC-SHA256 signature ตาม [Client Integration Guide](CHATPOS_CLIENT_INTEGRATION_GUIDE.md)
- สร้าง nonce/timestamp/signature ใหม่ต่อ HTTP retry แต่คง `Idempotency-Key`, `sourceRequestId` ใน body และ `X-Request-Id` เดิม
- retry เฉพาะ network error, timeout, `429` และ `5xx` ด้วย exponential backoff + jitter; ไม่ retry `4xx` อื่นหรือ idempotency conflict
- ส่ง structured log ที่มี request metadata, body digest และ error code โดย redaction จะไม่ปล่อย raw body, secret, PII หรือ signature เต็มค่า

สร้าง client ใน `src/lib/server/api-handler.cjs` ด้วย `createBackofficeClient()` และตั้ง `AGENT_PD_INTEGRATION_ENABLED=true` เฉพาะ environment ที่ผ่าน staging contract test แล้ว ค่า env และ feature flags ดูได้จาก `.env.example` ระหว่าง rotation ให้ใส่ secret เดิมในตัวแปร `_PREVIOUS` ชั่วคราว แล้วลบออกเพื่อ revoke หลัง retry/clock-skew window หมด ส่วน integration tests อยู่ใน [`src/lib/server/integration/`](../src/lib/server/integration/) และเรียกด้วย `npm run test:integration`

อย่า hardcode database URL หรือ secret ใน component และอย่าใช้ `NEXT_PUBLIC_*` กับค่าที่เป็นความลับ

### Security and production boundary

Browser requests to protected `/api/db/*` and `/api/v1/*` routes must carry the HttpOnly `chatpos_session` cookie. The API resolves the principal from `auth_sessions`, checks account activity and expiry, and touches `lastSeenAt`; the raw token is never returned to the frontend. `POST /api/db/auth/logout` revokes the current session. Bearer token parsing remains only as migration compatibility for non-browser clients.

API authorization uses these roles:

| Role | Scope and main actions |
|---|---|
| `merchant` | Own Store/Case, profile/document/message/payment actions |
| `agent` | Assigned Stores/Cases and review communication |
| `pd` | Stores/Cases under assigned PD scope and supervisory reads |
| `compliance` | Broad KYC/payment/operations reads and KYC status decisions |
| `admin` | Broad operational access, assignment and administrative actions |

Never derive actor or Store authority from request headers. Use `assertStoreAccess()` or `assertCaseAccess()` and keep `storeId` in the server-side session only as a default scope. Admin/Compliance unscoped reads must still be explicit in the route policy and audited.

Security-relevant API behavior includes:

- CORS uses `ALLOWED_ORIGINS`; credentials are enabled only for exact configured origins.
- `X-Content-Type-Options`, CSP, frame protection, Referrer-Policy, Permissions-Policy and production HSTS are set on API responses.
- Login, assignment, profile, KYC/document, message and payment mutations use PostgreSQL-backed rate limits.
- `audit_logs` records login, logout, sensitive reads, assignment, profile/document changes, KYC status, payment and settlement events. Secrets and high-risk PII are redacted before persistence.
- Settlement delivery uses `commission_settlement_events`, atomic claims, `lockedAt`, exponential backoff and `DEAD_LETTERED` after the configured attempt limit. Do not resend a failed event with a new event ID.
- Document intake stores `scanStatus` and keeps non-clean versions quarantined. Access is denied until a configured scanner returns `CLEAN` or `PASSED`; private storage must provide encryption at rest outside this repository.
- `GET /api/health/live` is a liveness probe, `GET /api/health/ready` checks PostgreSQL readiness, and `GET /api/health/metrics` is restricted to Admin/Compliance.

See [docs/PHASE5_SECURITY_OPERATIONS.md](PHASE5_SECURITY_OPERATIONS.md) for secret rotation/revocation, backup/restore, alerts and redacted incident procedure. Local syntax/type checks do not constitute production sign-off; use the PostgreSQL and staging evidence listed in [docs/NEXT_STEPS_CHECKLIST.md](NEXT_STEPS_CHECKLIST.md).

## Data access และ state

### PostgreSQL state

ใช้ `src/dbApi.ts` เป็น helper สำหรับ `/api/db`; view บางส่วนยังแปลง server rows ให้เข้ากับ model เดิมใน `mockData.ts` เพื่อรองรับ transitional UI แต่ข้อมูลที่บันทึกแล้วต้องยึด API/ฐานข้อมูลเป็น authority

ใช้ `src/chatposApi.ts` เป็น helper สำหรับ Developer API และส่ง `credentials: 'include'` เพื่อใช้ HttpOnly session cookie. ห้ามเก็บหรือส่ง API key จาก browser; `/api/v1/auth` token minting ถูกปิดแล้ว

### Browser prototype state

ข้อมูลที่ยังพบว่าเก็บใน browser ได้แก่:

- display cache ของ user session ซึ่งไม่ใช่ authority; server session เป็นแหล่งอ้างอิงจริง
- active tab และ hash ของ dashboard
- draft/legacy state ของหมวดหมู่ บริการ และการจอง; `ProductsView`, Merchant POS และ public table order ใช้ Product API แล้ว แต่ legacy public catalog บาง route ยังมี transitional local state
- sales pages, QR slugs และ channel groups
- customer orders, staff calls และ live merchant orders
- pending checkout และ legacy UI cache บางส่วน; transaction history และ Home recent payments ต้องอ่านจาก server API

ห้ามเก็บ bearer secret, signing secret, webhook secret, OTP, token หรือ restricted PII ใน browser storage, URL หรือ log. เมื่อเพิ่ม state ใหม่ให้ระบุให้ชัดว่าเป็น `server state`, `client state`, `local draft` หรือ `mock state` และกำหนด migration path หากจะรองรับหลายอุปกรณ์

## แนวทางพัฒนาต่อ

1. แยก route selection ออกจาก `src/App.tsx` ไปเป็น Next route segments ทีละ workflow เมื่อจำเป็นต้องใช้ SSR, metadata หรือ server authorization
2. แยก `src/lib/server/api-handler.cjs` เป็น route/domain modules ทีละส่วนเมื่อช่วยลด coupling โดยคง catch-all adapter, validation, authorization และ error contract เดิม
3. เพิ่ม schema validation ของ request/response ก่อนส่ง query database
4. เติม PostgreSQL integration/E2E tests สำหรับ session, permission matrix, ownership, idempotency, version conflict และ webhook dedupe
5. ต่อ private upload/scanner/storage encryption และยืนยัน key rotation/revoke กับ deployment platform
6. ย้ายข้อมูลธุรกิจและ order state ที่ต้องใช้ข้ามอุปกรณ์จาก localStorage ไป PostgreSQL
7. เพิ่ม PostgreSQL E2E และ operational evidence ให้ KYC case, immutable document version, append-only chat และ audit model ที่มีอยู่แล้ว
8. เพิ่ม tests สำหรับ status transition, permission matrix, payment idempotency และ document access
9. เติม metrics/alert wiring, backup/restore drill, incident runbook และ Product/Compliance/Security/PD-Agent Backoffice sign-off ก่อน production

## Checklist งานที่ต้องทำต่อ

Checklist แบบแบ่ง phase, owner และ Definition of Done แยกไว้ที่ [docs/NEXT_STEPS_CHECKLIST.md](NEXT_STEPS_CHECKLIST.md) เพื่อให้ใช้ร่วมกับ Integration Guide และติดตามสถานะจากไฟล์เดียว

## วิธีแก้ไฟล์อย่างปลอดภัย

- เริ่มจาก component หรือ API route ที่เป็นเจ้าของ behavior จริง
- ตรวจ actor, state transition และ data persistence ก่อนเพิ่มปุ่มหรือ field
- ถ้าแก้ client component ที่ใช้ browser API ให้คงไว้ใน client boundary
- ถ้าเพิ่ม global CSS ให้ import ผ่าน `src/app/layout.tsx` ตามกติกา Next.js
- ใช้ icon จาก `lucide-react` ตาม pattern เดิม
- อย่าลบข้อมูลเก่าหรือ document version ในชื่อการแก้ไขข้อมูล
- ทำ mock data ให้ปราศจาก PII จริง
- ตรวจด้วย `npm run lint` และ `npm run build` เมื่อเหมาะสมกับขอบเขตการเปลี่ยนแปลง

# ChatPOS System Architecture & Flow Diagrams
**เอกสารรวมแผนภาพสถาปัตยกรรมและกระบวนการทำงานของระบบ ChatPOS**

เอกสารนี้รวบรวมแผนภาพ (Mermaid Diagrams & Flowcharts) ที่อธิบายสถาปัตยกรรมระบบ, โครงสร้างบทบาทผู้ใช้งาน, ลำดับการทำงาน (Workflows), กลไกความปลอดภัย และโครงสร้างฐานข้อมูล (ERD) ของระบบ **ChatPOS**

---

## สารบัญ (Table of Contents)

1. [สถาปัตยกรรมภาพรวมระบบ (System Architecture Overview)](#1-สถาปัตยกรรมภาพรวมระบบ-system-architecture-overview)
2. [โครงสร้างบทบาทและสายงาน (User Roles & Organizational Hierarchy)](#2-โครงสร้างบทบาทและสายงาน-user-roles--organizational-hierarchy)
3. [ระบบยืนยันตัวตนและการจัดการ Session (Authentication & Session Flow)](#3-ระบบยืนยันตัวตนและการจัดการ-session-authentication--session-flow)
4. [กระบวนการลงทะเบียนร้านค้าและ KYC (Merchant Onboarding & KYC Lifecycle)](#4-กระบวนการลงทะเบียนร้านค้าและ-kyc-merchant-onboarding--kyc-lifecycle)
5. [กระบวนการชำระเงินและ QuickPay (Payment & Transaction Flow)](#5-กระบวนการชำระเงินและ-quickpay-payment--transaction-flow)
6. [การเชื่อมโยงสายงานและระบบคอมมิชชัน (Assignment & Commission Pipeline)](#6-การเชื่อมโยงสายงานและระบบคอมมิชชัน-assignment--commission-pipeline)
7. [ความปลอดภัยและกลไก Signed Merchant API (API Security & HMAC Verification)](#7-ความปลอดภัยและกลไก-signed-merchant-api-api-security--hmac-verification)
8. [โครงสร้างความสัมพันธ์ฐานข้อมูล (Entity Relationship Diagram - ERD)](#8-โครงสร้างความสัมพันธ์ฐานข้อมูล-entity-relationship-diagram---erd)

---

## 1. สถาปัตยกรรมภาพรวมระบบ (System Architecture Overview)

ระบบแบ่งออกเป็น 2 ชั้นหลักในฝั่ง Server คือ **Next.js App Shell (:3000)** สำหรับให้บริการ UI และ **Custom Node API Server (:3001)** สำหรับจัดการ Business Logic, Authentication, Database และเชื่อมต่อภายนอก

```mermaid
flowchart TB
    subgraph ClientLayer["🖥️ Client / Front-End Layer"]
        Browser["🌐 Web Browser / Mobile Device"]
        POSDevice["📱 POS Terminal / Tablet"]
    end

    subgraph NextJSLayer["⚡ Next.js App Shell (Port :3000)"]
        RootLayout["Root Layout & Global CSS\n(src/app/layout.tsx)"]
        CatchAllRoute["Catch-all Route\n(src/app/[[...slug]]/page.tsx)"]
        ClientApp["Client App Shell\n(src/app/[[...slug]]/ClientApp.tsx)"]
        Router["App Router & Views Router\n(src/App.tsx)"]
        
        subgraph Views["Modules / Views"]
            V_Merchant["🏪 Merchant Backoffice"]
            V_Cashier["💳 QuickPay / Cashier"]
            V_Order["🍽️ Dining / Takeaway / Delivery"]
            V_KYC["📋 KYC Onboarding Wizard"]
            V_Dev["🛠️ Developer Console"]
        end
    end

    subgraph BackendLayer["⚙️ Custom API Server (Port :3001 / server.cjs)"]
        APIGateway["HTTP Request Router & Middleware\n(CORS, Rate Limit, Security Headers)"]
        AuthModule["🔐 Auth & Session Engine\n(HttpOnly Cookies, bcrypt)"]
        StoreModule["🏬 Store & Catalog Engine"]
        KYCModule["📑 KYC & OTP Verification Engine"]
        PaymentModule["💰 Payment & QR Engine\n(PromptPay EMV)"]
        SignedClient["🔒 Signed Merchant Client\n(HMAC-SHA256 / Multi-Store Key)"]
        AuditModule["📝 Audit & Idempotency Logger"]
    end

    subgraph DataLayer["🗄️ Persistence & Storage"]
        PostgreSQL[("🐘 PostgreSQL Database\n(Stores, Users, Trans, Credentials)")]
        LocalStorage[("💾 Client localStorage\n(UI State & Display Cache)")]
    end

    subgraph ExternalLayer["🌐 External Systems & Backoffice"]
        AgentBackoffice["🏢 PD / Agent Backoffice System\n(Signed Webhook & Assignment API)"]
        LLGW["💳 LLGW / Payment Gateway"]
        SMSProvider["📩 SMS / OTP Delivery Provider"]
    end

    %% Client to Next.js
    Browser --> RootLayout
    POSDevice --> RootLayout
    RootLayout --> CatchAllRoute --> ClientApp --> Router
    Router --> Views

    %% Views to Client Storage & Next Rewrite
    Views -.->|UI Cache / Draft| LocalStorage
    Views -->|Fetch relative /api/db/* or /api/v1/*| CatchAllRoute

    %% Next.js Rewrites to API Server
    CatchAllRoute -->|Proxy Rewrite /api/*| APIGateway

    %% API Server Internal
    APIGateway --> AuthModule
    APIGateway --> StoreModule
    APIGateway --> KYCModule
    APIGateway --> PaymentModule
    APIGateway --> AuditModule

    KYCModule --> SignedClient
    PaymentModule --> SignedClient
    
    %% API Server to Database
    AuthModule --> PostgreSQL
    StoreModule --> PostgreSQL
    KYCModule --> PostgreSQL
    PaymentModule --> PostgreSQL
    AuditModule --> PostgreSQL

    %% API Server to External Services
    SignedClient <-->|Signed HTTPS HMAC-SHA256| AgentBackoffice
    PaymentModule <-->|Webhook & API| LLGW
    KYCModule -.->|Trigger OTP Delivery| SMSProvider
```

---

## 2. โครงสร้างบทบาทและสายงาน (User Roles & Organizational Hierarchy)

โครงสร้างสายงานและสิทธิ์ในการจัดการภายในระบบ ChatPOS:

```mermaid
flowchart TD
    subgraph HQ["🏢 สำนักงานใหญ่ (System Platform)"]
        SuperAdmin["👑 Super Admin / Platform Admin\n- จัดการระบบทั้งหมด\n- อนุมัติ PD / Agent / Merchant\n- กำหนดค่า Global Integration & System Credentials"]
    end

    subgraph RegionalLevel["🗺️ ระดับภูมิภาค / จังหวัด"]
        PD["🏛️ Provincial Director (PD)\n- ดูแล Agent ภายในเขตพื้นที่\n- ตรวจสอบยอดรวม GMV / Commission\n- มี Territory ID และรหัสเฉพาะ"]
    end

    subgraph AgentLevel["🤝 ระดับตัวแทน (Agents)"]
        Agent["👔 Agent (ตัวแทนจำหน่าย/บริการ)\n- แนะนำร้านค้า (Referral)\n- ช่วยร้านค้าทำ Onboarding & KYC\n- รับค่าคอมมิชชันตาม Tier & Wallet"]
    end

    subgraph MerchantLevel["🏪 ระดับร้านค้า (Stores / Merchants)"]
        Merchant["🧑‍💼 Merchant Owner (เจ้าของร้าน)\n- จัดการสินค้า / บริการ / เมนู\n- ตั้งค่าบัญชีรับเงิน (Payout Bank)\n- ยืนยันตัวตน KYC ร้านค้า"]
        
        subgraph BranchStaff["👥 ทีมงานหน้าร้าน"]
            Manager["👔 Store Manager (ผู้จัดการสาขา)"]
            Cashier["💳 Cashier / Staff (พนักงานขาย)"]
        end
    end

    subgraph EndCustomer["🛒 ผู้ใช้บริการปลายทาง"]
        Customer["📱 Customer / ลูกค้า\n- สแกนสั่งอาหาร / บริการ\n- ชำระเงินผ่าน PromptPay QR"]
    end

    %% Hierarchy Links
    SuperAdmin -->|แต่งตั้ง / อนุมัติ| PD
    PD -->|ดูแล / ให้คำปรึกษา| Agent
    Agent -->|Onboard / แนะนำ| Merchant
    Merchant -->|สร้างและมอบหมายสิทธิ์| Manager
    Merchant -->|สร้างและมอบหมายสิทธิ์| Cashier
    Cashier -->|รับชำระเงิน / ให้บริการ| Customer
```

---

## 3. ระบบยืนยันตัวตนและการจัดการ Session (Authentication & Session Flow)

ระบบใช้ **HttpOnly Cookie** (`chatpos_session`) ร่วมกับ Server-side Session ในฐานข้อมูล PostgreSQL เพื่อความปลอดภัยสูงสุด:

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 ผู้ใช้งาน (Merchant/Agent/Admin)
    participant Browser as 🌐 Client Browser (App Shell)
    participant Server as ⚙️ API Server (server.cjs)
    participant DB as 🐘 PostgreSQL Database

    Note over User, DB: 🔑 กระบวนการเข้าสู่ระบบ (Login Flow)
    User->>Browser: กรอก Email และ Password
    Browser->>Server: POST /api/db/auth/login { email, password }
    Server->>DB: SELECT * FROM "User" WHERE email = ?
    DB-->>Server: ส่งข้อมูล User + Hashed Password
    Server->>Server: ตรวจสอบความถูกต้องด้วย bcrypt.compare()
    
    alt รหัสผ่านไม่ถูกต้อง / ผู้ใช้ถูกระงับ
        Server-->>Browser: 401 Unauthorized { error: "Invalid credentials" }
        Browser-->>User: แสดงข้อความแจ้งเตือนความผิดพลาด
    else รหัสผ่านถูกต้อง
        Server->>DB: INSERT INTO "Session" (userId, token, expiresAt) VALUES (...)
        DB-->>Server: Session Created
        Server-->>Browser: 200 OK + Set-Cookie: chatpos_session=<token>; HttpOnly; SameSite=Lax; Secure
        Browser->>Browser: อัปเดต Display User Cache ใน localStorage
        Browser-->>User: เข้าสู่หน้า Dashboard ตาม Role
    end

    Note over User, DB: 🔄 การตรวจสอบ Session เมื่อ Refresh หน้าจอ (Hydration Flow)
    Browser->>Server: GET /api/db/auth/session (ส่ง Cookie อัตโนมัติ)
    Server->>DB: SELECT * FROM "Session" JOIN "User" WHERE token = ? AND expiresAt > NOW()
    alt Session Valid
        DB-->>Server: ข้อมูล User + Store Information
        Server-->>Browser: 200 OK { user: { id, name, role, storeId, ... } }
    else Session Expired / Invalid
        Server-->>Browser: 401 Unauthorized { user: null }
        Browser->>Browser: ล้าง Local Cache และ Redirect ไปหน้า Login
    end
```

---

## 4. กระบวนการลงทะเบียนร้านค้าและ KYC (Merchant Onboarding & KYC Lifecycle)

ขั้นตอนการสมัครร้านค้าใหม่ พร้อมกระบวนการยืนยันตัวตนผ่าน OTP และส่งข้อมูลไปยังระบบ Agent Backoffice:

```mermaid
flowchart TD
    Start([เริ่ม: ผู้ใช้เข้าสู่ระบบ/สมัครสมาชิก]) --> QuickReg[1. ลงทะเบียนเบื้องต้น\nสร้าง Store ในสถานะ Draft]
    
    QuickReg --> KYCForm[2. กรอกข้อมูล KYC Wizard\n- ข้อมูลนิติบุคคล/บุคคลธรรมดา\n- อัปโหลดสำเนาบัตรประชาชน / ทะเบียนการค้า\n- บัญชีรับเงิน Payout Bank Account]
    
    KYCForm --> RequestOTP[3. ขอรหัส OTP เบอร์โทรศัพท์\nPOST /api/v1/kyc/otp/request]
    
    RequestOTP --> OTPGate{ตรวจสอบ Rate Limit\n& Cooldown}
    OTPGate -->|เกินจำนวนครั้ง| LockOTP[ระงับการขอ OTP ชั่วคราว\nLockout 15 นาที]
    OTPGate -->|ผ่าน| SendSMS[ส่ง SMS OTP ไปยังเบอร์ Merchant\nบันทึก kyc_otp_challenges]
    
    SendSMS --> InputOTP[4. Merchant กรอกรหัส OTP ในหน้าเว็บ]
    InputOTP --> VerifyOTP[5. ยืนยันรหัส OTP\nPOST /api/v1/kyc/otp/verify]
    
    VerifyOTP --> OTPValid{OTP ถูกต้อง\nและไม่หมดอายุ?}
    OTPValid -->|ไม่ถูกต้อง| IncAttempt[เพิ่ม Failed Attempts Count] --> InputOTP
    OTPValid -->|ถูกต้อง| MarkOTPVerified[ทำเครื่องหมาย Phone Verified ในระบบ]
    
    MarkOTPVerified --> StoreCredLookup[6. ดึง Backoffice Store Credentials\nจากตาราง backoffice_store_credentials]
    
    StoreCredLookup --> SignPayload[7. สร้าง HMAC-SHA256 Signature\nHeaders: Timestamp, Nonce, Idempotency-Key]
    
    SignPayload --> DispatchBackoffice[8. ส่งข้อมูลไปยัง PD/Agent Backoffice\nPOST /api/v1/kyc/document:create]
    
    DispatchBackoffice --> BackofficeResponse{ผลลัพธ์จาก Backoffice}
    BackofficeResponse -->|Success 200/201| UpdateLocalKYC[อัปเดตสถานะ KycVerification = 'submitted'\nบันทึก MerchantIdentity]
    BackofficeResponse -->|Network Error / 5xx| RetryQueue[บันทึกเข้า Retry Engine\nและส่งซ้ำตาม Exponential Backoff]
    
    UpdateLocalKYC --> AdminReview[9. เจ้าหน้าที่/PD ตรวจสอบเอกสาร]
    AdminReview --> AdminDecision{ผลการพิจารณา}
    AdminDecision -->|อนุมัติ Approved| ActiveStore[🎉 Store สถานะ 'APPROVED' / 'ACTIVE'\nพร้อมเปิดระบบรับชำระเงินเต็มรูปแบบ]
    AdminDecision -->|ปฏิเสธ Rejected| RejectStore[แจ้งเหตุผลให้ Merchant แก้ไขเอกสารใหม่]
```

---

## 5. กระบวนการชำระเงินและ QuickPay (Payment & Transaction Flow)

กระบวนการสร้างและรับชำระเงินผ่าน PromptPay QR และการตรวจสอบสถานะแบบ Real-time:

```mermaid
sequenceDiagram
    autonumber
    actor Customer as 🛒 ลูกค้า
    actor Cashier as 💳 พนักงาน / แคชเชียร์
    participant Frontend as 🖥️ ChatPOS Frontend (QuickPay)
    participant API as ⚙️ ChatPOS API Server
    participant DB as 🐘 PostgreSQL
    participant Gateway as 🏦 LLGW / Bank Gateway

    Cashier->>Frontend: ป้อนยอดเงินที่ต้องชำระ (เช่น 250.00 THB)
    Frontend->>API: POST /api/db/quickpay/create { storeId, amount, orderRef }
    API->>DB: ตรวจสอบการตั้งค่าร้านค้า & qrSettings
    DB-->>API: คืนค่า PromptPay ID / Merchant Config
    API->>API: สร้าง EMVCo PromptPay Dynamic QR Payload
    API->>DB: INSERT INTO "Transaction" (status='pending', amount=250.00)
    DB-->>API: Transaction Created (txnId: "TXN-99881")
    API-->>Frontend: 200 OK { qrText, qrImage, txnId, expiresAt }
    
    Frontend-->>Customer: แสดง QR Code บนหน้าจอแคชเชียร์/แท็บเล็ต
    Customer->>Gateway: เปิด Mobile Banking App แล้วสแกนชำระเงิน
    Gateway->>Gateway: ประมวลผลการตัดเงินและโอนเข้าบัญชี
    
    par ทางเลือก A: Webhook Callback จาก Payment Gateway
        Gateway->>API: POST /api/v1/webhooks/payment-status\n(พร้อม X-Signature HMAC-SHA256)
        API->>API: ตรวจสอบ Webhook Signature & Timestamp Freshness
        API->>DB: UPDATE "Transaction" SET status='completed', paidAt=NOW()\nWHERE id = 'TXN-99881'
        API-->>Gateway: 200 OK { received: true }
    and ทางเลือก B: Frontend Polling / Real-time Check
        loop ตรวจสอบทุก 3 วินาที (จนกว่าจะหมดเวลา)
            Frontend->>API: GET /api/db/quickpay/status?txnId=TXN-99881
            API->>DB: SELECT status FROM "Transaction" WHERE id = 'TXN-99881'
            DB-->>API: status: 'completed'
            API-->>Frontend: { status: 'completed', paidAt: '...' }
        end
    end

    Frontend->>Frontend: แสดงหน้าจอชำระเงินสำเร็จ (Payment Success 🎉)
    Frontend-->>Cashier: พิมพ์ใบเสร็จ / บันทึกประวัติการขาย
```

---

## 6. การเชื่อมโยงสายงานและระบบคอมมิชชัน (Assignment & Commission Pipeline)

แผนภาพแสดงความเชื่อมโยงระหว่างการผูกสายงานร้านค้า (Store Assignment) และการคำนวณส่วนแบ่งคอมมิชชัน:

```mermaid
flowchart LR
    subgraph Registration["1️⃣ การผูกสายงาน (Store Assignment)"]
        direction TB
        NewStore["🏬 ร้านค้าสมัครใหม่\n(ระบุ Referral Code)"] --> MatchAgent["🔍 ค้นหา Agent เจ้าของ Code\nและ PD ประจำพื้นที่"]
        MatchAgent --> SaveAssignment["💾 บันทึก currentAgentId & currentPdId\nลงตาราง Store"]
        SaveAssignment --> CallAssignAPI["🔒 Signed POST /api/v1/assignments\nส่งข้อมูลไป Sync กับ Backoffice"]
    end

    subgraph SalesCycle["2️⃣ ธุรกรรมการขาย (Transaction Inflow)"]
        direction TB
        TxnCompleted["💰 ธุรกรรมสำเร็จ\nTransaction Status = 'completed'"] --> CalcVolume["📊 คำนวณสะสมยอด GMV\nและจำนวนธุรกรรมของร้านค้า"]
    end

    subgraph CommissionEngine["3️⃣ ระบบประมวลผลคอมมิชชัน (Settlement Engine)"]
        direction TB
        CalcVolume --> TriggerCommission{"เงื่อนไขการคิดค่าคอมมิชชัน"}
        TriggerCommission -->|ตามสัดส่วน Tier| AgentShare["👔 ส่วนแบ่ง Agent (เช่น 0.2%)\nบันทึกลง Agent Wallet Balance"]
        TriggerCommission -->|ตามสัดส่วนพื้นที่| PDShare["🏛️ ส่วนแบ่ง PD (เช่น 0.1%)\nบันทึกลง PD Investment/Return"]
        TriggerCommission -->|ค่าบริการระบบ| PlatformShare["🏢 รายได้ Platform ChatPOS"]
    end

    subgraph Payout["4️⃣ การจ่ายเงินส่วนแบ่ง (Payout Settlement)"]
        direction TB
        AgentShare --> MonthlySettlement["📅 สรุปรอบบิลประจำงวด (Settlement Period)"]
        PDShare --> MonthlySettlement
        MonthlySettlement --> LLGWPayout["🏦 ส่งคำสั่งโอนเงินผ่านระบบ Payout\n(โอนเข้าบัญชีธนาคารปลายทาง)"]
    end

    Registration --> SalesCycle --> CommissionEngine --> Payout
```

---

## 7. ความปลอดภัยและกลไก Signed Merchant API (API Security & HMAC Verification)

โครงสร้างการเข้ารหัสและการตรวจสอบความถูกต้องของ API ระหว่าง ChatPOS และ Agent/PD Backoffice:

```mermaid
sequenceDiagram
    autonumber
    participant Client as 🖥️ ChatPOS Integration Client
    participant SecretMgr as 🔐 Store Credentials Store
    participant Target as 🏢 PD/Agent Backoffice API

    Note over Client, Target: 📦 1. เตรียมข้อมูล Canonical String สำหรับ Sign
    Client->>SecretMgr: ดึง API Key, Key ID และ Signing Secret ของ StoreId
    SecretMgr-->>Client: { keyId, bearerSecret, signingSecret }
    
    Client->>Client: สร้างค่าตัวแปรความปลอดภัย:\n- Timestamp: <unix_seconds>\n- Nonce: <random_16_to_128_chars>\n- Idempotency-Key: <uuid_v4>\n- BodyHash: SHA256(Raw JSON Body)
    
    Client->>Client: ประกอบ Canonical String:\nMETHOD\nPATH_WITH_SORTED_QUERY\nTIMESTAMP\nNONCE\nIDEMPOTENCY_KEY\nSHA256_BODY
    
    Client->>Client: คำนวณ Signature:\nHMAC-SHA256(Canonical_String, Signing_Secret)

    Note over Client, Target: 🚀 2. ส่ง HTTP Request พร้อม Security Headers
    Client->>Target: POST /api/v1/assignments\nHeaders:\n  Authorization: Bearer <bearerSecret>\n  X-ChatPOS-Key-Id: <keyId>\n  X-ChatPOS-Timestamp: <timestamp>\n  X-ChatPOS-Nonce: <nonce>\n  X-ChatPOS-Signature: v1=<signature_hex>\n  Idempotency-Key: <idempotencyKey>\n  Content-Type: application/json\nBody: { ... }

    Note over Target: 🛡️ 3. Backoffice ตรวจสอบความถูกต้อง
    Target->>Target: 1. ตรวจสอบ Timestamp Freshness (อยู่ในช่วง 5 นาที?)\n2. ตรวจสอบ Nonce ไม่ซ้ำ\n3. ตรวจสอบ Idempotency Key (ป้องกัน Request ซ้ำซ้อน)\n4. ประกอบ Canonical String แบบเดียวกันและคำนวณ HMAC\n5. เปรียบเทียบ Signature แบบ Constant-Time

    alt ตรวจสอบผ่านสมบูรณ์
        Target-->>Client: 200 OK / 201 Created { success: true, ... }
    else ตรวจสอบไม่ผ่าน / Signature ไม่ตรง
        Target-->>Client: 401 Unauthorized / 403 Forbidden { error: "Signature mismatch" }
    end
```

---

## 8. โครงสร้างความสัมพันธ์ฐานข้อมูล (Entity Relationship Diagram - ERD)

แผนภาพแสดงความสัมพันธ์ระหว่าง Entities ทั้งหมดในฐานข้อมูล PostgreSQL ของ ChatPOS:

```mermaid
erDiagram
    "User" ||--o{ "Store" : "owns"
    "User" ||--o| "ProvincialDirector" : "is"
    "User" ||--o| "Agent" : "is"
    "User" ||--o{ "Session" : "has"
    "User" ||--o{ "ActivityLog" : "performs"

    "ProvincialDirector" ||--o{ "Agent" : "manages"
    "ProvincialDirector" ||--o{ "Store" : "oversees"
    "Agent" ||--o{ "Store" : "refers"

    "Store" ||--o| "MerchantIdentity" : "identified_by"
    "Store" ||--o| "backoffice_store_credentials" : "has_keys"
    "Store" ||--o{ "KycVerification" : "submits"
    "Store" ||--o{ "KycDocument" : "attaches"
    "Store" ||--o{ "kyc_otp_challenges" : "verifies_phone"
    "Store" ||--o{ "Product" : "sells"
    "Store" ||--o{ "Category" : "organizes"
    "Store" ||--o{ "Order" : "receives"
    "Store" ||--o{ "Transaction" : "processes"
    "Store" ||--o{ "Commission" : "generates"
    "Store" ||--o{ "Table" : "contains"
    "Store" ||--o{ "Booking" : "takes"

    "Order" ||--o{ "OrderItem" : "includes"
    "Product" ||--o{ "OrderItem" : "ordered_in"
    "Category" ||--o{ "Product" : "categorizes"
    "Order" ||--o| "Transaction" : "settled_via"

    "User" {
        uuid id PK
        string name
        string email UK
        string phone
        string password
        string role "merchant | agent | pd | admin"
        boolean isActive
        timestamp createdAt
    }

    "ProvincialDirector" {
        uuid id PK
        uuid userId FK
        string code UK
        string displayName
        string territoryId
        string status
        decimal investmentAmount
    }

    "Agent" {
        uuid id PK
        uuid userId FK
        string code UK
        string tier "STANDARD | VIP | MASTER"
        string status
        uuid currentPdId FK
        decimal walletBalance
        decimal adBudget
    }

    "Store" {
        uuid id PK
        string name
        string phone
        uuid userId FK
        uuid currentAgentId FK
        uuid currentPdId FK
        string tier "FREE | PRO | ENTERPRISE"
        string storeType "MAIN | BRANCH"
        string memberStatus
        string payoutBankName
        string payoutAccountNumber
        jsonb qrSettings
        boolean isOnboarded
    }

    "backoffice_store_credentials" {
        uuid id PK
        uuid store_id FK
        string environment
        string key_id UK
        string key_prefix
        string bearer_secret
        string signing_secret
        string status "active | disabled"
    }

    "KycVerification" {
        uuid id PK
        uuid storeId FK
        string idCardNumber
        string businessType
        string verificationStatus "draft | submitted | approved | rejected"
        timestamp submittedAt
        timestamp verifiedAt
    }

    "KycDocument" {
        uuid id PK
        uuid storeId FK
        uuid verificationId FK
        string documentType "id_card | company_reg | bank_book"
        string fileUrl
        string fileSha256
        string status
    }

    "kyc_otp_challenges" {
        uuid id PK
        uuid store_id FK
        string phone_number
        string otp_code_hash
        integer attempt_count
        timestamp expires_at
        timestamp verified_at
    }

    "Transaction" {
        uuid id PK
        uuid storeId FK
        uuid orderId FK
        decimal amount
        string currency
        string paymentMethod "promptpay | cash | credit_card"
        string status "pending | completed | failed | refunded"
        string qrPayload
        timestamp paidAt
    }

    "Commission" {
        uuid id PK
        uuid transactionId FK
        uuid storeId FK
        uuid agentId FK
        uuid pdId FK
        decimal agentAmount
        decimal pdAmount
        decimal platformAmount
        string status "pending | settled | paid"
    }
```

---

## 9. สรุปพารามิเตอร์และการตั้งค่าที่เกี่ยวข้อง

| หัวข้อ | Parameter / Configuration | คำอธิบาย |
| :--- | :--- | :--- |
| **Frontend Web Port** | `3000` | พอร์ตสำหรับรัน Next.js App Shell |
| **API Server Port** | `3001` (`API_PORT`) | พอร์ตสำหรับรัน Custom Node.js Server (`server.cjs`) |
| **Session Cookie** | `chatpos_session` | HttpOnly Cookie ที่บันทึก Token ประจำตัวผู้ใช้งาน |
| **HMAC Algorithm** | `HMAC-SHA256` | การเข้ารหัสสำหรับ Signed Request ระหว่างระบบ |
| **Timestamp Tolerance** | `300 วินาที (5 นาที)` | ช่วงเวลาที่ยอมรับความคลาดเคลื่อนของเวลาใน Request |
| **OTP TTL** | `300 วินาที (5 นาที)` | อายุของรหัส SMS OTP ก่อนหมดอายุ |
| **OTP Lockout** | `900 วินาที (15 นาที)` | ระยะเวลาระงับการขอ OTP เมื่อกรอกผิดเกินโควต้า |

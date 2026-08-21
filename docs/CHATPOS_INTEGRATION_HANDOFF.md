# ChatPOS Integration Handoff

**Contract date:** 2026-08-20  
**Audience:** ChatPOS Integration, Platform, Operations, Finance, Compliance  
**Status:** Local integration foundation is implemented; external contract confirmation, environment delivery, staging E2E and production approval are still required.

เอกสารนี้เป็น **canonical integration reference** สำหรับทีม ChatPOS, PD/Agent Backoffice, LLGW, Finance, Compliance และ Operations โดยรวม contract, local implementation, ownership, release gate และหลักฐานที่ต้องส่งมอบไว้ในที่เดียว แยกข้อมูลเป็น `ยืนยันแล้ว`, `release-gated` และ `รอยืนยันจากทีมภายนอก` อย่างชัดเจน

### ลำดับการอ้างอิง

เมื่อเอกสารมีข้อความไม่ตรงกัน ให้ใช้ลำดับนี้:

1. เอกสารนี้เป็น source of truth สำหรับ route, payload, ownership, status และ readiness ของ integration
2. [`docs/CHATPOS_CLIENT_INTEGRATION_GUIDE.md`](./CHATPOS_CLIENT_INTEGRATION_GUIDE.md) เป็นคู่มือตัวอย่างสำหรับ partner และต้องสอดคล้องกับเอกสารนี้
3. [`docs/DEVELOPER_GUIDE.md`](./DEVELOPER_GUIDE.md) เป็นรายละเอียด architecture/source ภายใน
4. [`docs/NEXT_STEPS_CHECKLIST.md`](./NEXT_STEPS_CHECKLIST.md) เป็นรายการติดตามงาน ไม่ใช่ contract ใหม่

การเปลี่ยน contract หรือ ownership ต้องแก้เอกสารนี้, [Phase 0 decision record](./PHASE_0_CONTRACT_DECISION_RECORD.md) และ checklist ให้สอดคล้องกันก่อนเริ่ม implementation

> ห้ามใส่ bearer secret, signing secret, callback secret, LLGW credential, SMS credential หรือ production identifier ลงใน repository, ticket, chat, email หรือ log ให้ส่งผ่าน managed secret manager เท่านั้น

## 1. Base URL และ Store-scoped credentials

### ยืนยันแล้ว

- API key ผูกกับ `storeId` และใช้ข้าม Store ไม่ได้
- Credential แยกต่อ environment และต่อ Store
- Credential ที่เกี่ยวข้องประกอบด้วย:
  - Bearer API key
  - HMAC signing secret
  - Public `keyId` และ key prefix สำหรับ support และ rotation
  - Assignment callback secret
  - Payment status callback secret
  - Commission webhook secret เมื่อเปิดใช้งาน settlement ingest
- Base URL ใน `.env.example` และคู่มือเป็น placeholder เท่านั้น ไม่ใช่ endpoint จริง

### ต้องส่งมอบผ่าน secret manager

- Staging Base URL
- Production Base URL
- Staging Store ID และ credential set
- Production Store ID และ credential set
- Callback URL ของแต่ละ environment
- IP/CIDR ของ partner หากเปิดใช้ allowlist

อ้างอิง: [`server/integration/signedMerchantClient.cjs`](../server/integration/signedMerchantClient.cjs), [`.env.example`](../.env.example), [`docs/CHATPOS_CLIENT_INTEGRATION_GUIDE.md`](./CHATPOS_CLIENT_INTEGRATION_GUIDE.md)

## 2. Scopes, signing, callback secrets และ rotation

### Scopes ของ ChatPOS Merchant API

```text
assignment:create
store:profile:update
kyc:document:create
kyc:otp:request
kyc:otp:verify
payment:create
payment:read
```

### Signed request

```http
Authorization: Bearer <bearer-secret>
X-ChatPOS-Timestamp: <unix-seconds>
X-ChatPOS-Nonce: <unique-16-to-128-characters>
X-ChatPOS-Signature: v1=<lowercase-hmac-sha256-hex>
Idempotency-Key: <stable-operation-key>
X-Request-Id: <correlation-id>
```

Canonical request ใช้ LF separator และไม่มี trailing LF:

```text
UPPERCASE_METHOD
PATH_WITH_SORTED_QUERY
TIMESTAMP
NONCE
IDEMPOTENCY_KEY
SHA256(raw_body)
```

### กลไกความปลอดภัยของ local integration foundation

- Timestamp freshness window: 5 นาที
- Nonce ต้องไม่ซ้ำต่อ API key
- Command endpoint ต้องมี idempotency key
- Signing และ callback secret ถูกอ่านเฉพาะฝั่ง server จาก environment/secret manager ที่ deployment จัดให้
- Structured log redacts bearer secret, signing secret, callback secret, PII และ raw body
- รองรับ current/previous secret ชั่วคราวระหว่าง rotation แล้วต้องลบ previous secret เพื่อ revoke
- Nonce และ idempotency protection ฝั่ง local integration client อยู่ใน request lifecycle; credential issuance, rotation cadence และ revoke policy ต้องให้ Platform/Backoffice ยืนยัน

ยังไม่มี policy ระบุรอบ rotation ตามปฏิทิน, key provisioning หรือ secret manager product ใน repository ต้องให้ Platform/Operations และ Backoffice ยืนยันเพิ่มเติม

อ้างอิง: [`server/integration/signedMerchantClient.cjs`](../server/integration/signedMerchantClient.cjs), [`server/security.cjs`](../server/security.cjs), [`docs/PHASE5_SECURITY_OPERATIONS.md`](./PHASE5_SECURITY_OPERATIONS.md)

## 3. Assignment API และ callback

### Assignment API

```text
POST /api/v1/assignments/requests
Scope: assignment:create
```

Request หลัก:

```json
{
  "agentPhone": "+66...",
  "sourceRequestId": "partner-request-id"
}
```

`agentPhone` เป็น optional หากไม่ส่งคำขอจะเข้า `PENDING_ADMIN_ASSIGNMENT`

สถานะหลัก:

```text
PENDING_ADMIN_ASSIGNMENT
PENDING_AGENT_ACCEPTANCE
ACCEPTED
REJECTED
EXPIRED
```

### Assignment callback

```text
POST <MERCHANT_ASSIGNMENT_CALLBACK_URL>
```

Payload:

```json
{
  "eventId": "uuid",
  "eventType": "assignment.status.changed",
  "assignmentRequestId": "assignment-request-id",
  "storeId": "store-id",
  "status": "ACCEPTED",
  "occurredAt": "2026-08-20T00:00:00.000Z",
  "reason": "optional",
  "assignmentHistoryId": "optional"
}
```

Headers:

```text
X-ChatPOS-Event-Id
X-ChatPOS-Timestamp
X-ChatPOS-Signature: v1=<hmac-sha256(timestamp.raw_body)>
```

Callback ถูกบันทึกใน durable outbox ก่อนส่ง, deduplicate ด้วย event ID และ retry ด้วย exponential backoff สูงสุด 1 ชั่วโมงต่อรอบ การ retry ต้องใช้ event ID และ payload เดิม ห้ามสร้าง event ใหม่แทน event เดิม

อ้างอิง: [`src/lib/assignments/status-events.ts`](../src/lib/assignments/status-events.ts), [`src/app/api/internal/jobs/assignment-maintenance/route.ts`](../src/app/api/internal/jobs/assignment-maintenance/route.ts)

## 4. Profile update และ KYC document

### Merchant profile

```text
PATCH /api/v1/stores/profile
Scope: store:profile:update
```

ต้องส่ง `sourceRequestId`, `expectedProfileVersion` และ `profile` ที่อยู่ใน allowlist ระบบ derive Store จาก API key เท่านั้น, ใช้ idempotency และ optimistic concurrency, ตอบ `409` เมื่อ version หรือ idempotency conflict และตอบ `503` เมื่อ feature ถูกปิด

### KYC document

```text
POST /api/v1/kyc/cases/{caseId}/documents
Scope: kyc:document:create
```

Payload รองรับ document ID, document type, immutable version, checksum, storage locator, source time และ source request ID

Document version เดิมห้าม overwrite การใช้ version ซ้ำหรือ checksum ไม่ตรงจะตอบ `409`

อ้างอิง: [`src/app/api/v1/stores/profile/route.ts`](../src/app/api/v1/stores/profile/route.ts), [`src/app/api/v1/kyc/cases/[caseId]/documents/route.ts`](../src/app/api/v1/kyc/cases/%5BcaseId%5D/documents/route.ts)

## 5. KYC OTP และ SMS readiness

### Contract

```text
POST /api/v1/kyc/cases/{caseId}/otp
Scope: kyc:otp:request

POST /api/v1/kyc/cases/{caseId}/otp/verify
Scope: kyc:otp:verify
```

### SMSUP Plus configuration

```text
Provider: smsup_plus
Base URL: https://pub.smsup-plus.com
OTP length: 6 digits
TTL: 60 seconds
Maximum attempts: 5
Resend cooldown: 60 seconds
```

SMSUP เป็นผู้สร้างและตรวจ OTP เอง Backoffice เก็บ provider `otpId` เป็น reference เท่านั้น และไม่คืน OTP หรือ SMS credential ให้ partner

ข้อจำกัด:

- ไม่มี public partner endpoint สำหรับเรียก SMSUP resend โดยตรง
- Partner ต้องใช้ OTP request flow เดิมหลัง cooldown
- Browser ห้ามเรียก Backoffice หรือ SMSUP โดยตรง
- หาก readiness ไม่ผ่าน API ต้องตอบ `503 NOT_READY`

### Release gate

- `SMS_OTP_ENABLED=true` ถูก configure ใน environment ปัจจุบัน
- `KYC_MERCHANT_OTP_REQUIRED=true` เป็นค่าที่มีความเสี่ยง และไม่ควรเปิดใน production จนกว่า delivery, expiry, abuse และ monitoring evidence จะผ่าน
- ต้องยืนยัน staging delivery และ provider abuse controls ก่อน production enablement

อ้างอิง: [`src/lib/kyc/otp-policy.ts`](../src/lib/kyc/otp-policy.ts), [`src/lib/kyc/otp-service.ts`](../src/lib/kyc/otp-service.ts), [`src/lib/sms/kyc-otp-provider.ts`](../src/lib/sms/kyc-otp-provider.ts)

## 6. Payment command

```text
POST /api/v1/transactions/{id}/payment
Scope: payment:create
```

Request ตัวอย่าง:

```json
{
  "paymentMethod": "promptpay",
  "paymentMethodOption": "THAI_QR",
  "redirectUrl": "https://merchant.example/success",
  "failedRedirectUrl": "https://merchant.example/failed",
  "description": "Order payment",
  "metadata": {}
}
```

รองรับ payment method ตาม LLGW configuration เช่น `promptpay`, `checkout`, `card` และ `mobile_banking`

Response:

```json
{
  "success": true,
  "data": {
    "clientReference": "transaction-reference",
    "gatewayReference": "llgw-reference",
    "status": "pending",
    "qrString": "optional",
    "qrImageUrl": "optional",
    "checkoutRedirectUrl": "optional",
    "expiresAt": "optional"
  }
}
```

สถานะ HTTP:

- `201` สำหรับ payment ใหม่
- `200` สำหรับ idempotent replay
- `409` สำหรับ idempotency conflict หรือ transaction จ่ายไม่ได้
- `502` เมื่อ LLGW request/response ล้มเหลว
- `503` เมื่อ LLGW integration ยังไม่พร้อม

หาก timeout แล้วไม่ทราบผล ห้ามสร้าง idempotency key ใหม่ ให้ retry ด้วย key และ raw body เดิม

อ้างอิง: [`src/app/api/v1/transactions/[id]/payment/route.ts`](../src/app/api/v1/transactions/%5Bid%5D/payment/route.ts), [`src/lib/llgw/transaction-payment-service.ts`](../src/lib/llgw/transaction-payment-service.ts)

## 7. Payment query และ normalized webhook

### Payment query

```text
GET /api/v1/transactions/{id}/payment
Scope: payment:read
```

Response คืน normalized fields:

```text
reference
amount
currency
status
paymentReference
paymentMethod
paymentProvider
providerStatus
paidAt
failedAt
```

### Payment status callback ไปยัง ChatPOS

Payload event type `payment.status.changed`:

```json
{
  "eventId": "uuid",
  "eventType": "payment.status.changed",
  "transactionId": "transaction-id",
  "storeId": "store-id",
  "transactionReference": "merchant-reference",
  "status": "paid",
  "paymentReference": "gateway-reference",
  "paymentMethod": "promptpay",
  "paymentProvider": "LLGW",
  "providerStatus": "success",
  "occurredAt": "2026-08-20T00:00:00.000Z"
}
```

Headers:

```text
X-ChatPOS-Event-Id
X-ChatPOS-Timestamp
X-ChatPOS-Signature
```

Callback เป็น per-Store โดยอ่าน `Store.webhookUrl` และ `Store.webhookSecret`, มี outbox, conditional claim, delivery state และ retry การส่ง callback ล้มเหลวไม่ rollback payment state; status query ใช้เป็นช่องทาง reconcile

อ้างอิง: [`src/lib/llgw/payment-status-events.ts`](../src/lib/llgw/payment-status-events.ts), [`src/app/api/v1/transactions/[id]/payment/route.ts`](../src/app/api/v1/transactions/%5Bid%5D/payment/route.ts)

## 8. LLGW pay-in webhook ownership, schema และ migration

LLGW pay-in webhook เป็น internal Backoffice endpoint เท่านั้น ChatPOS ห้ามเรียก endpoint นี้และห้ามถือ LLGW credential

```text
POST /api/webhooks/llgw/payment
```

Headers จาก LLGW:

```text
X-LLGW-Event-Id
X-LLGW-Timestamp
X-LLGW-Signature: v1=<hmac-sha256(timestamp.raw_body)>
```

Payload ที่ต้องมี:

```json
{
  "eventType": "payment.status_changed",
  "data": {
    "gatewayReference": "gateway-reference",
    "clientReference": "transaction-reference",
    "status": "pending|processing|success|failed|cancelled"
  }
}
```

Optional fields คือ `providerStatus`, `providerReference`, `providerTransactionId` และ `paidAt`

Policy:

- Timestamp tolerance 5 นาที
- Verify raw body ก่อน JSON parsing
- Deduplicate ด้วย `(provider, eventId)`
- Event ID เดิมกับ body ต่างกันเป็น conflict
- อัปเดต transaction และ webhook log ใน durable transaction
- คืน non-2xx หาก processing ล้มเหลวเพื่อให้ sender retry
- Transaction ที่เป็น `paid` แล้วจะไม่ถูก downgrade ด้วย event failure ภายหลัง

Migration ที่รองรับ path นี้มี `WebhookEventLog` และ `PaymentStatusEvent` แล้ว ไม่ต้องสร้าง migration เพิ่มสำหรับ contract นี้

อ้างอิง: [`src/app/api/webhooks/llgw/payment/route.ts`](../src/app/api/webhooks/llgw/payment/route.ts), [`src/lib/llgw/payment-result-service.ts`](../src/lib/llgw/payment-result-service.ts), [`prisma/migrations/20260712104500_add_webhook_event_log/migration.sql`](../prisma/migrations/20260712104500_add_webhook_event_log/migration.sql), [`prisma/migrations/20260819160000_add_payment_status_outbox/migration.sql`](../prisma/migrations/20260819160000_add_payment_status_outbox/migration.sql)

## 9. Commission settlement และ payout

### Settlement ingest

```text
POST /api/webhooks/commission/settlement
Header: X-Commission-Signature
Signature: HMAC-SHA256(raw_body)
Feature flag: COMMISSION_EVENT_INGEST_ENABLED=true
```

Schema version:

```text
commission.settlement.v1
```

Event types:

```text
SETTLEMENT_EARNED
SETTLEMENT_REFUNDED
SETTLEMENT_CHARGEBACK
SETTLEMENT_STOPPAY
```

ข้อมูลหลักคือ `eventId`, `transactionId`, `sourceRef`, `earnedAt`, `ownershipSnapshot.storeId|agentId|pdId`, `amounts.pdGrossBenefit` และ `reversalReference` สำหรับ reversal event

ระบบมี event ID/body digest conflict detection, duplicate protection, append-only ledger, reversal linkage, dead-letter state และ audited replay สำหรับ dead-letter event

### Payout ownership

- ChatPOS ส่งได้เฉพาะ settlement fact
- Finance/Admin เป็นผู้สร้างและอนุมัติ payout batch
- Backoffice เป็นผู้ submit payout ไป LLGW
- Payout result เข้า internal endpoint:

```text
POST /api/webhooks/llgw/payout
```

Payout webhook รองรับ `processing`, `under_review`, `success`, `failed`, `cancelled`, deduplicate ด้วย event ID/body digest และ ignore event ที่มาหลัง final state

Payout submit ยังอยู่หลัง `LLGW_PAYOUT_ENABLED` และ production readiness gate

อ้างอิง: [`src/lib/commission/settlement-event.ts`](../src/lib/commission/settlement-event.ts), [`src/lib/commission/settlement-service.ts`](../src/lib/commission/settlement-service.ts), [`src/app/api/webhooks/commission/settlement/route.ts`](../src/app/api/webhooks/commission/settlement/route.ts), [`src/app/api/webhooks/llgw/payout/route.ts`](../src/app/api/webhooks/llgw/payout/route.ts)

## 10. Staging credentials และ E2E cases

### ยังไม่สามารถส่งมอบจาก repository

- Staging Base URL จริง
- Production Base URL จริง
- Store-scoped bearer/signing credentials
- Assignment, payment และ commission callback secrets
- LLGW sandbox credentials
- SMSUP staging credential set
- Named test merchant/store data

ค่าดังกล่าวต้อง provision และส่งผ่าน secret manager โดยแยก environment

### E2E ที่ต้องผ่านก่อน production

1. Signed request สำเร็จด้วย Store ที่ถูกต้อง
2. Invalid timestamp, nonce replay และ signature mismatch
3. Idempotent replay และ idempotency conflict
4. Assignment request ทั้งกรณีมีและไม่มี `agentPhone`
5. Assignment callback retry และ receiver dedupe
6. Profile version conflict
7. Immutable KYC document version conflict
8. OTP success, expiry, wrong OTP 5 ครั้ง และ resend cooldown
9. SMS provider unavailable ต้องได้ `503 NOT_READY`
10. PromptPay QR และ Hosted Checkout
11. Payment timeout แล้ว retry ด้วย key เดิม
12. LLGW payment webhook success, duplicate, event ID conflict และ unknown transaction
13. Normalized payment callback retry
14. Settlement earned, duplicate, reversal และ dead-letter replay
15. Payout webhook success, failure, duplicate และ out-of-order final event

## 11. Technical owners, incident contacts และ SLA

### Owner ที่มีหลักฐานใน repository

- **Platform:** API authentication, secret rotation, webhook transport, scheduler และ database
- **Operations:** Merchant assignment และ assignment/KYC backlog
- **Compliance:** KYC SLA impact
- **Finance:** Commission settlement และ LLGW payout
- **POS/Payment owner:** upstream settlement producer defects

### Workflow timing ที่ configure ได้

- Assignment reminder: 60 นาที
- Agent KYC review SLA: 24 ชั่วโมง
- PD KYC review SLA: 24 ชั่วโมง
- KYC reminder: 2 ชั่วโมง

ค่าดังกล่าวไม่ใช่ incident response SLA หรือ named support contact

### ต้องให้ทีมยืนยัน

- Technical owner ชื่อทีม/บุคคล
- Incident channel และ escalation path
- Business-hours หรือ 24x7 coverage
- P1/P2 response และ resolution SLA
- Production approval authority
- Secret manager และ credential delivery owner

อ้างอิง: [`docs/runbooks/secret-rotation.md`](./runbooks/secret-rotation.md), [`docs/runbooks/assignment-kyc-backlog.md`](./runbooks/assignment-kyc-backlog.md), [`docs/runbooks/settlement-ingest.md`](./runbooks/settlement-ingest.md)

## Final readiness verdict

Repository ยืนยัน contract และ implementation หลักได้แล้ว แต่ยังไม่ใช่ production handoff ที่สมบูรณ์จนกว่าจะมี:

- Staging/production URL จริง
- Store-scoped credentials และ secret delivery
- Owner/contact/SLA จริง
- Live SMSUP delivery และ abuse evidence
- LLGW sandbox E2E evidence
- Production enablement approval ของ payment, payout และ commission flags

ควรทบทวน `KYC_MERCHANT_OTP_REQUIRED=true` ก่อน staging sign-off และคงเป็น `false` จนกว่า OTP delivery, expiry, abuse control และ monitoring จะผ่าน release gate ครบถ้วน

# ChatPOS Next Steps Checklist

รายการนี้เป็น checklist กลางสำหรับงานที่ต้องทำต่อของ ChatPOS และ integration กับ `chatpos.biz`, Agent/PD Backoffice และ LLGW แบ่งตาม dependency, owner และ Definition of Done

> สถานะ sync ล่าสุด: 2026-08-19
>
> - `[x]` implementation และหลักฐานตรวจในเครื่องครบสำหรับรายการนั้น แต่ยังไม่หมายถึง external sign-off หรือ production approval
> - `[~]` มี implementation บางส่วนแล้ว แต่ยังขาด persistence, contract, test scope หรือ owner sign-off ที่จำเป็น
> - `[ ]` ยังต้อง implement หรือยืนยันต่อ
>
> Codebase ยังมี custom API server, client-only frontend และ prototype state บางส่วน จึงไม่ควรถือว่า checklist นี้เป็น production approval โดยตัวมันเอง

## วิธีใช้

- `P0`: blocker หรือความเสี่ยงสูง ต้องทำก่อนเปิด integration/production
- `P1`: งานสำคัญที่ต้องทำก่อนขยาย usage หรือเปิด feature ครบชุด
- `รอภายนอก`: ต้องรอ Backoffice, LLGW, Finance หรือ Product/Compliance
- ใช้ `[x]` เมื่อ implementation และ test evidence ใน repository ครบ; งานที่ยังรอ external contract, owner sign-off หรือ production hardening ให้ใช้ `[~]` หรือคง `[ ]` ตามสถานะ
- รายละเอียด API contract และตัวอย่าง signing อยู่ใน [CHATPOS Client Integration Guide](CHATPOS_CLIENT_INTEGRATION_GUIDE.md)
- รายละเอียด architecture และจุดแก้ใน repository อยู่ใน [Developer Guide](DEVELOPER_GUIDE.md)
- Phase 0 contract matrix, decision record และ sign-off template อยู่ใน [Phase 0 Contract Decision Record](PHASE_0_CONTRACT_DECISION_RECORD.md)

## Phase 0: ยืนยัน contract และขอบเขต

- [ ] **P0 / Product + Backoffice:** ยืนยัน Base URL, Store credential, scopes, signing secret, callback secret และ environment ของ test/production
- [~] **P0 / Architecture:** วาง integration client ไว้ใน custom API server และกำหนด server-only boundary แล้ว; ใช้ [Phase 0 Contract Decision Record](PHASE_0_CONTRACT_DECISION_RECORD.md) เป็น draft decision record แต่ยังต้องยืนยัน callback receiver กับทีมภายนอก โดยห้ามเก็บ secret ใน browser
- [~] **P0 / Data:** มี initial schema และ migration สำหรับ assignment request, profile version, KYC document version, webhook event dedupe, idempotency record และ audit log แล้ว แต่ยังต้อง review/sign-off และเติมตารางเฉพาะของ bank account กับ withdrawal ตาม [Phase 0 Contract Decision Record](PHASE_0_CONTRACT_DECISION_RECORD.md)
- [ ] **P0 / Compliance:** ยืนยัน field mapping ที่กระทบ KYC, retention, masking, document access และผู้มีสิทธิ์อนุมัติขั้นสุดท้าย
- [ ] **เสร็จเมื่อ:** มี contract owner, data owner, environment matrix และ decision record ที่ทีม implement อ้างอิงได้

## Phase 1: Integration foundation

- [x] **P0 / Backend:** เพิ่ม environment variables ใน `.env.example` สำหรับ Backoffice base URL, bearer secret, signing secret, callback secret, timeout และ feature flags
- [x] **P0 / Backend:** สร้าง server-only signed HTTP client ที่ serialize raw JSON ครั้งเดียว, คำนวณ SHA-256, สร้าง canonical request และ HMAC ตาม contract
- [x] **P0 / Backend:** เพิ่ม nonce/timestamp validation, timeout, exponential backoff + jitter และ retry เฉพาะ network error, `429` และ `5xx`
- [x] **P0 / Backend:** เพิ่ม idempotency handling โดยคง `Idempotency-Key` และ exact body เมื่อ retry และแยก `sourceRequestId` กับ `X-Request-Id`
- [x] **P0 / Observability:** เพิ่ม correlation ID, structured log, secret/PII redaction และห้าม log raw body, bearer secret หรือ signature เต็มค่า
- [x] **เสร็จเมื่อ:** มี focused Node tests สำหรับ canonical path, body digest, signature, stale timestamp, nonce replay, changed-payload conflict และ retry behavior

## Phase 2: Merchant-Agent assignment

- [~] **P0 / Backend:** เพิ่ม command `POST /api/v1/assignments/requests` ไปยัง Backoffice รองรับทั้งระบุ `agentPhone` และไม่ระบุเบอร์ใน `server.cjs`/`server/integration/assignmentService.cjs`; ยังต้องเปิด feature flag และทดสอบกับ Backoffice staging
- [~] **P0 / Database:** บันทึก assignment request/status/history แบบ idempotent และห้ามถือว่า Merchant ถูกผูก Agent ก่อนสถานะ `ACCEPTED` โดยมี durable event/late-event guard แล้ว; ยังต้องรัน migration ใน environment เป้าหมายและทำ integration test บน PostgreSQL จริง
- [~] **P0 / Backend:** เพิ่ม callback receiver ที่ `/api/webhooks/assignment-status` อ่าน raw body, verify HMAC แบบ constant-time และ dedupe `eventId` ใน transaction เดียวกับ state update; ยังต้องยืนยัน callback URL/retry contract กับ Backoffice
- [x] **P1 / Frontend:** เพิ่ม UI แสดง `PENDING_ADMIN_ASSIGNMENT`, `PENDING_AGENT_ACCEPTANCE`, `ACCEPTED`, `REJECTED`, `EXPIRED` และ `REASSIGNED` พร้อม next action ใน Merchant portal โดยซ่อน Agent/PD จนกว่า status จะเป็น `ACCEPTED`
- [x] **P1 / Frontend:** เชื่อม Merchant registration กับ assignment request รองรับ Agent phone หรือปล่อยว่างให้ Admin จัดสรร; assignment API ยังถูกข้ามอย่างปลอดภัยเมื่อ integration flag ปิด
- [~] **P1 / Operations:** รองรับ callback ซ้ำและ callback ล่าช้าด้วย durable dedupe/ordering แล้ว แต่ยังต้องทดสอบ receiver downtime, Backoffice retry และ recovery ใน staging
- [ ] **เสร็จเมื่อ:** Merchant onboarding happy path, no-agent admin assignment, Agent accept/reject และ callback retry ผ่าน staging

## Phase 3: Merchant profile และ KYC documents

- [ ] **P0 / Backend:** เพิ่ม `PATCH /api/v1/stores/profile` ผ่าน signed server-side client พร้อม allowlist field และห้ามรับ `storeId`, Agent, PD, status หรือ credential จาก body
- [ ] **P0 / Database:** เพิ่ม optimistic concurrency ด้วย `expectedProfileVersion`, profile snapshot และ conflict response `PROFILE_VERSION_CONFLICT`
- [ ] **P0 / KYC:** map field ที่กระทบ KYC ให้เปลี่ยนเป็น `WAITING_AGENT_REVIEW`, สร้าง notification และคง submission snapshot เดิม
- [ ] **P0 / Backend:** เพิ่ม document intake สำหรับ `POST /api/v1/kyc/cases/{caseId}/documents` พร้อม checksum, private storage locator, MIME/size validation และ immutable version
- [ ] **P0 / Storage:** ใช้ private storage locator เท่านั้น ตรวจ MIME/size/checksum และห้าม overwrite object หรือ reuse version ด้วย checksum ใหม่
- [ ] **P1 / Frontend:** เพิ่ม document timeline, version comparison, status, correction request และป้องกันการ overwrite version เดิม
- [ ] **P1 / Frontend:** เพิ่ม KYC Chat/Post ที่เชื่อม document request, attachment metadata, read status และ append-only message history
- [ ] **เสร็จเมื่อ:** profile replay/conflict, document replay/conflict, private access, version correction และ Agent review -> PD final decision ผ่าน staging

## Phase 4: Transaction routing และ settlement

- [ ] **P0 / Contract:** ขอ command endpoint สำหรับสร้าง Transaction ผ่าน `chatpos.biz -> Backoffice -> LLGW`; ห้ามใช้ read-only payment endpoint แทน command
- [ ] **P0 / Backend:** เพิ่ม Backoffice transaction client และ stable `clientReference` พร้อม idempotency ก่อนส่งต่อคำสั่ง
- [ ] **P0 / Backend:** ปิดหรือ gate direct payment creation จาก `chatpos.biz -> LLGW` และปรับ `QuickPayView`/`chatposApi.ts` ให้ใช้เส้นทางใหม่
- [ ] **P0 / Backend:** เพิ่ม LLGW payment webhook receiver ที่ `chatpos.biz` พร้อม raw-body signature, timestamp, event ID dedupe และ late/out-of-order handling
- [ ] **P1 / Finance + Backoffice:** ยืนยัน `COMMISSION_EVENT_INGEST_ENABLED`, schema/field mapping และ reversal policy ก่อนส่ง settlement
- [ ] **P1 / Backend:** เพิ่ม signed final settlement event ไป `/api/webhooks/commission/settlement` เมื่อ Finance เปิด feature และรองรับ reversal conflict
- [ ] **P1 / Frontend:** แสดง payment reference/status ที่มาจาก Backoffice และไม่ expose gateway secret ใน Developer Console หรือ browser storage
- [ ] **เสร็จเมื่อ:** sandbox success, failure, timeout, duplicate webhook, late webhook, payment confirmation และ settlement reconciliation ผ่าน end to end

## Phase 5: Security, authorization และ production readiness

- [ ] **P0 / Security:** ย้าย session และ API authorization จาก localStorage-only ไป server-side session หรือ token ที่มีการตรวจสิทธิ์ฝั่ง API
- [ ] **P0 / Security:** บังคับ authorization แยก Merchant, Agent, PD, Compliance และ Admin ที่ API พร้อม Store/Case ownership check
- [ ] **P0 / Security:** เพิ่ม rate limiting, restricted CORS, secure headers, upload scanning, encryption at rest และ secret rotation/revoke
- [ ] **P0 / Audit:** ทำ audit log สำหรับ login, เปิดดู, ดาวน์โหลด, แก้ไข, assignment, document, status, approval และ settlement โดยเก็บ before/after เท่าที่จำเป็น
- [ ] **P1 / Reliability:** เพิ่ม outbox/dead-letter หรือ durable retry สำหรับ callback และ settlement event ที่ส่งไม่สำเร็จ
- [ ] **P1 / Tests:** เพิ่ม integration/E2E tests บน PostgreSQL จริงสำหรับ permission matrix, idempotency, version conflict, webhook dedupe และ payment ownership
- [ ] **P1 / Operations:** เพิ่ม health check, metrics, alert owner, runbook, backup/restore และ incident procedure ที่ redact PII
- [ ] **เสร็จเมื่อ:** checklist ส่วน Go-Live ด้านล่างผ่านครบ และ Product/Compliance/Security/Backoffice sign-off แล้ว

## Client Go-Live evidence

รายการหลักฐานที่ทีม `chatpos.biz` ต้องเตรียมและแนบกับการอนุมัติเปิดใช้งาน:

- [ ] ได้ test Base URL, Store ID, bearer secret และ signing secret
- [ ] Secret อยู่ใน secret manager และถูก redact จาก logs/APM
- [ ] NTP/clock sync ทำงานและ timestamp ไม่คลาดเกิน 5 นาที
- [ ] Assignment request happy path และ idempotent replay ผ่าน
- [ ] Invalid signature, stale timestamp, duplicate nonce และ changed-payload conflict ผ่าน
- [ ] Callback receiver ใช้ raw body, constant-time compare และ durable event-ID dedupe
- [ ] Callback success/reject/expire/reassign และ receiver downtime ผ่าน
- [ ] KYC document checksum/version/conflict และ private storage access ผ่าน
- [ ] Merchant profile update happy path, idempotent replay และ `PROFILE_VERSION_CONFLICT` ผ่าน
- [ ] `MERCHANT_PROFILE_UPDATE_ENABLED=true` ถูกเปิดเฉพาะหลัง migration และ Product/Compliance approval
- [ ] Profile update -> Agent review -> PD approve/return/reject ผ่านใน staging พร้อม PostgreSQL จริง
- [ ] Profile update ปฏิเสธการเปลี่ยน `storeId`, Agent, PD, KYC/payment status, credential และ settlement fields
- [ ] KYC document correction ใช้ document version ใหม่และไม่ overwrite version เดิม
- [ ] Merchant onboarding ผ่านครบ: สมัครร้านค้า -> ส่ง Assignment request -> `PENDING_AGENT_ACCEPTANCE` -> Agent รับ -> ผูก Agent/PD -> signed Assignment callback
- [ ] Agent review, ขอข้อมูลเพิ่ม, ส่ง Submission Package และ PD final approve/return/reject ผ่านครบทุกทางแยก
- [ ] Transaction command วิ่งผ่าน `chatpos.biz -> Agent/PD Backoffice -> LLGW` เท่านั้น และ direct `chatpos.biz -> LLGW` payment creation ถูกปฏิเสธหรือไม่มี route ใช้งาน
- [ ] Backoffice ตรวจ Store/PD/Agent ownership, signed request, idempotency และ stable `clientReference` ก่อน forward Transaction ไป LLGW
- [ ] LLGW payment webhook ยิงตรงเข้า `chatpos.biz` พร้อมตรวจ signature/timestamp/event ID, durable dedupe และส่ง signed final settlement event กลับ Backoffice
- [ ] Commission event mapping/reversal/reconciliation ผ่าน Finance review หากเปิดใช้
- [ ] LLGW payment sandbox success/failure/timeout/late webhook ผ่านตามเส้นทางใหม่ โดยพิสูจน์ทั้ง `Backoffice -> LLGW` และ `LLGW -> chatpos.biz`
- [ ] Credential rotation และ emergency revoke drill ผ่าน
- [ ] มี correlation ID, monitoring, alert owner และ support contact ทั้งสองฝั่ง

## งานที่ต้องรอหรือทำร่วมกับทีมภายนอก

- [ ] **รอ Backoffice:** ส่ง test/production Base URL, Store-scoped key, scopes, signing secret, callback secret และ key rotation contact
- [ ] **รอ Backoffice:** ยืนยัน callback URL, retry schedule, timeout, response contract และ ownership ของ `ACCEPTED`/`REJECTED`/`EXPIRED`/`REASSIGNED`
- [ ] **รอ Backoffice:** เปิดและทดสอบ `POST /api/v1/assignments/requests`, profile update และ KYC document intake ใน staging
- [ ] **รอ Backoffice:** ส่ง transaction command contract, stable `clientReference` behavior และ ownership ของ payment reference/status
- [ ] **รอ LLGW:** ยืนยัน webhook signature scheme, event types, timestamp window, retry behavior และ sandbox cases
- [ ] **รอ Finance:** อนุมัติ `pdGrossBenefit`, ownership snapshot, reversal และ reconciliation mapping
- [ ] **รอ Product/Compliance:** อนุมัติ field mapping ที่ทำให้ KYC review ใหม่, document retention และ final approval policy
- [ ] **เสร็จเมื่อ:** มี signed contract matrix ต่อ environment และ test credentials ที่ใช้ทำ E2E ได้โดยไม่ใช้ production secret

## Definition of Done ก่อนเปิด production

- [ ] Secret ไม่อยู่ใน browser, source code, URL หรือ log และมี rotation/revoke drill
- [ ] ทุก command มี signature, timestamp, nonce, idempotency key และ correlation ID
- [ ] Callback/webhook ใช้ raw body verification, constant-time comparison และ durable event-ID dedupe
- [ ] Store ownership และ role/scope ถูกตรวจที่ server ไม่ใช่แค่ซ่อนปุ่มใน frontend
- [ ] Profile update และ KYC document correction ไม่ overwrite snapshot/version เดิม
- [ ] Transaction creation ไม่มีเส้นทาง `chatpos.biz -> LLGW` โดยตรง
- [ ] Agent ไม่สามารถอนุมัติ KYC ขั้นสุดท้ายแทน PD/ผู้มีอำนาจได้
- [ ] มี monitoring, alert owner, retry/dead-letter, reconciliation และ incident runbook
- [ ] Go-live checklist ใน [CHATPOS Client Integration Guide](CHATPOS_CLIENT_INTEGRATION_GUIDE.md) ผ่านครบ พร้อม Product/Compliance/Security/Backoffice sign-off

## ลำดับแนะนำสำหรับการลงมือ

1. ปิด Phase 0 ด้วย contract matrix, decision record และ owner/sign-off ที่ยังค้างอยู่
2. นำ signed client และ initial schema ไป wiring กับ assignment request/callback ก่อน KYC document เพราะสถานะ Agent/PD เป็น dependency ของ case
3. ทำ durable profile version, document intake และ dedicated bank/withdrawal records ก่อนเปิดให้ Merchant แก้ข้อมูลจริง
4. ทำ transaction routing และ webhook ownership ก่อนเชื่อม settlement/commission
5. ปิดท้ายด้วย authorization, audit, observability, PostgreSQL integration/E2E และ Go-Live gate ก่อนเปิด feature flag production

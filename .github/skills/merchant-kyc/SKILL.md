---
name: merchant-kyc
description: "ออกแบบ พัฒนา และตรวจสอบระบบ Merchant KYC ของ ChatPOS เมื่อทำงานเกี่ยวกับ Merchant, Agent, PD, Compliance, Payment Gateway, การตรวจสอบร้านค้า, KYC Chat/Post, เอกสารหลายเวอร์ชัน, สถานะอนุมัติ, consent หรือ audit log"
argument-hint: "ระบุหน้าหรือ workflow KYC ที่ต้องการทำ เช่น merchant onboarding, agent review, KYC chat หรือ document versioning"
user-invocable: true
---

# ChatPOS Merchant KYC

ใช้ skill นี้เป็นแนวทางหลักเมื่อเพิ่มหรือแก้ฟีเจอร์ Merchant KYC ของ ChatPOS ทั้งใน frontend prototype และระบบที่เชื่อม backend ภายหลัง เนื้อหานี้เป็นข้อกำหนดเชิงผลิตภัณฑ์และ workflow ไม่ใช่คำรับรองว่าระบบสอดคล้องกับกฎหมายหรือข้อกำหนดของ Payment Gateway แล้ว

## เป้าหมายของระบบ

ระบบต้องทำให้ Merchant สมัครและส่งข้อมูลร้านค้า, Agent ตรวจสอบความครบถ้วนและธุรกิจจริง, PD/Compliance ตรวจสอบความเสี่ยงและอนุมัติในระดับบริษัท, Payment Gateway พิจารณาเปิดใช้งาน และ Merchant กลับมาดูสถานะ ข้อความ เอกสาร และผลอนุมัติได้ตลอดเวลา

หลักสำคัญ:

- Agent เป็นผู้ดูแลและผู้ตรวจสอบเบื้องต้น ไม่ใช่ผู้อนุมัติขั้นสุดท้าย
- Merchant ต้องเชื่อมโยง Agent ด้วยการกรอกหมายเลขโทรศัพท์ที่ยืนยันแล้ว หรือขอให้บริษัทจัดสรรให้
- การสื่อสารและไฟล์แนบต้องอยู่ใน KYC Chat/Post เพื่อใช้เป็นหลักฐาน
- การแก้ไขข้อมูลหรือเอกสารต้องสร้าง version ใหม่ ห้ามเขียนทับหรือลบหลักฐานเดิม
- การเปิดดู ดาวน์โหลด แก้ไข ขอข้อมูล ส่งต่อ อนุมัติ และเปลี่ยนสถานะต้องตรวจสอบย้อนหลังได้
- แสดงข้อมูลส่วนบุคคลเท่าที่จำเป็น และไม่เปิดเผยรายละเอียดกฎตรวจจับความเสี่ยงภายในทั้งหมดแก่ Merchant

## ใช้เมื่อ

- ทำหน้า Merchant registration, KYC onboarding, merchant dashboard หรือ approval result
- ทำหน้า Agent dashboard, case review, checklist หรือส่งต่อ PD/Compliance
- ทำ KYC Chat/Post, request-for-information flow, read receipts หรือไฟล์แนบ
- ทำ document upload, document status, document version comparison หรือ resubmission
- ทำ status transition, assignment, consent, notification, risk flag หรือ audit log
- ออกแบบ type, mock data, API contract, state model หรือ test case ของ workflow นี้

## ขั้นตอนการทำงาน

### 1. สำรวจจุดเชื่อมต่อใน repo ก่อนแก้

ตรวจไฟล์และ component ที่ใกล้กับงานก่อนเสมอ โดยเฉพาะ `src/App.tsx`, `src/PageViews.tsx`, `src/mockData.ts`, CSS ที่เกี่ยวข้อง และ `package.json` ตรวจว่า state, role, navigation และ mock data เดิมทำงานอย่างไร แล้วแก้เฉพาะ slice ที่เป็นเจ้าของพฤติกรรม

สำหรับ repo นี้:

- ใช้ Next.js App Router + React + TypeScript ที่มีอยู่แล้ว
- ใช้ `lucide-react` สำหรับไอคอนเมื่อมีไอคอนที่เหมาะสม
- รักษารูปแบบ CSS และ component ที่มีอยู่ แทนการสร้าง design system ใหม่โดยไม่จำเป็น
- อย่าเพิ่ม backend, authentication จริง หรือ upload storage โดยไม่ระบุให้ชัดว่าเป็น mock/prototype
- อย่าเพิ่ม dependency หากโครงสร้างเดิมรองรับงานได้อยู่แล้ว

ก่อนลงมือ ให้ระบุสมมติฐานที่ตรวจสอบได้หนึ่งข้อเกี่ยวกับ code path และเลือก check ที่แคบที่สุดเพื่อยืนยันหรือหักล้างสมมติฐานนั้น

### 2. กำหนด actor และสิทธิ์

ใช้ actor แยกกันตั้งแต่ type และ UI:

- `merchant`: กรอกและแก้ข้อมูลของตนเอง, อัปโหลดเอกสาร, ตอบคำขอ, ดูสถานะ
- `agent`: ตรวจสอบ case ที่ได้รับมอบหมาย, checklist, ขอข้อมูลเพิ่ม, ใส่หมายเหตุ, ส่งต่อ
- `pd`: ตรวจทานงานในขอบเขตที่รับผิดชอบและตัดสินใจระดับ PD
- `compliance`: ตรวจสอบความเสี่ยงและอนุมัติหรือส่งกลับตาม policy
- `admin`: จัดการ assignment, สิทธิ์, override ที่มีเหตุผล และการตรวจสอบย้อนหลัง
- `payment_gateway`: รับข้อมูลที่ผ่านการอนุมัติและส่งผลการพิจารณากลับ

ห้ามให้ actor หนึ่งแก้ข้อมูลของอีก actor โดยไม่มีหลักฐานหรือสิทธิ์ชัดเจน ห้ามแสดง case ของ Merchant ที่อยู่นอกขอบเขต Agent และอย่าทำปุ่มอนุมัติสุดท้ายให้ Agent

### 3. ใช้สถานะและ transition ที่มีความหมาย

เก็บสถานะเป็น code ภาษาอังกฤษ และแสดง label ภาษาไทยใน UI เพื่อไม่ให้ logic ผูกกับข้อความ:

| Code | ความหมาย | ผู้ดำเนินการหลัก |
|---|---|---|
| `draft` | Merchant ยังกรอกไม่เสร็จ | Merchant |
| `ready_for_submission` | กรอกครบและพร้อมส่ง | Merchant |
| `pending_agent_review` | รอ Agent ตรวจสอบ | ระบบ/Agent |
| `needs_more_info` | Agent ส่งกลับให้แก้หรือส่งเอกสารเพิ่ม | Agent |
| `merchant_replied` | Merchant ตอบกลับแล้ว รอตรวจซ้ำ | Merchant/ระบบ |
| `agent_passed` | Agent ตรวจครบและส่งต่อ | Agent |
| `pending_pd_compliance` | รอ PD หรือ Compliance ตรวจสอบ | PD/Compliance |
| `sent_to_gateway` | ส่งข้อมูลให้ Payment Gateway | ระบบ/บริษัท |
| `approved` | อนุมัติและเปิดรับชำระเงินได้ | บริษัท/Gateway |
| `rejected` | ไม่ผ่านการตรวจสอบ | ผู้มีอำนาจอนุมัติ |
| `on_hold` | พักการอนุมัติเพื่อตรวจสอบเพิ่ม | บริษัท/Compliance |
| `suspended` | ระงับหลังพบความผิดปกติ | บริษัท/Admin |

ตรวจทุก transition ตาม actor และสถานะปัจจุบัน ไม่ให้ข้ามขั้นโดยเงียบ ๆ เมื่อเปลี่ยนสถานะให้บันทึกผู้กระทำ เวลา เหตุผล และ event ที่เหมาะสม สร้างเลขคำขอที่อ่านง่าย เช่น `KYC-202607-000125`

### 4. สร้างแบบฟอร์มตามประเภทกิจการ

รองรับ 4 ประเภทแยกกันเพื่อกำหนดฟิลด์และเอกสารได้ถูกต้อง:

- `individual_physical`: บุคคลธรรมดามีหน้าร้าน
- `individual_online`: บุคคลธรรมดาขายออนไลน์
- `company_physical`: นิติบุคคลมีสถานที่จริง
- `company_online`: นิติบุคคลออนไลน์

แบ่ง onboarding เป็นขั้นที่ตรวจสอบและบันทึกได้:

1. ข้อมูลเจ้าของบัญชีหรือข้อมูลนิติบุคคล
2. ข้อมูลร้านค้า สินค้า บริการ ที่อยู่ และพิกัด
3. ข้อมูลการดำเนินธุรกิจ ยอดขาย และรูปแบบการรับเงิน
4. บัญชีธนาคาร
5. เอกสารตามประเภทกิจการ
6. ตรวจสอบข้อมูล ยินยอม และส่งตรวจสอบ

ฟิลด์ที่มีความเสี่ยงสูง เช่น เลขบัตรประชาชน เลขทะเบียนนิติบุคคล เลขบัญชี และข้อมูลติดต่อ ต้องมี validation, masking และข้อความ error ที่ใช้งานได้จริง บัญชีธนาคารต้องสัมพันธ์กับเจ้าของกิจการหรือนิติบุคคล หากไม่ตรงต้องเปิดช่องทางชี้แจงและขอหลักฐานเพิ่ม

### 5. จัดการ Agent assignment

หน้าเชื่อมโยง Agent ต้องแสดงเบอร์ Merchant จากบัญชีที่ยืนยันแล้วเป็น read-only หากเปลี่ยนเบอร์ต้องผ่าน OTP ใหม่ ตรวจหมายเลข Agent ว่าได้รับอนุมัติ ยัง active อยู่ และรับผิดชอบพื้นที่หรือประเภทธุรกิจนี้ได้

หาก Merchant ไม่ทราบ Agent ให้มี action ขอให้บริษัทจัดสรร และแสดงผลการจัดสรรพร้อมชื่อบริษัท/PD/พื้นที่ดูแล การเปลี่ยน Agent ภายหลังต้องจำกัดสิทธิ์ให้ Admin หรือ PD พร้อมเหตุผลและ audit event

### 6. ทำเอกสารแบบ versioned และตรวจสอบได้

อย่าแทนที่ไฟล์หรือ metadata เดิม ให้สร้าง `documentVersion` ใหม่ทุกครั้ง โดยอย่างน้อยต้องเก็บ:

- ประเภทเอกสาร, version, ชื่อไฟล์, MIME type, ขนาด และ checksum เมื่อระบบรองรับ
- ผู้ส่ง, วันเวลา, เหตุผลการส่งใหม่ และ case ที่เกี่ยวข้อง
- สถานะ `not_uploaded`, `uploaded`, `under_review`, `approved`, `needs_revision`, `expired`, `rejected`
- หมายเหตุของผู้ตรวจและความสัมพันธ์กับคำขอข้อมูล

UI ควรแสดง version ล่าสุดพร้อมประวัติ และเปิดเปรียบเทียบก่อน/หลังได้ในกรณีที่ feature รองรับ ห้ามลบไฟล์เดิมจาก timeline; หากต้องยกเลิกให้คง record เดิมและบันทึกเหตุผล

### 7. ทำ KYC Chat/Post เป็นหลักฐาน

ข้อความต้อง append-only และเชื่อมกับ case/document request ให้ชัดเจน รองรับข้อความ, รูปภาพ, PDF และไฟล์จากกล้องตามความสามารถของระบบ แต่ละ message ควรมี sender, recipient, timestamp, attachment metadata, version, read status และ audit metadata

การยกเลิกข้อความให้ทำเป็น `cancelled` หรือ tombstone พร้อมเก็บข้อความเดิมใน audit log ห้ามทำ hard delete ใน UI prototype ที่จำลอง persistence ให้ใช้ state แบบเพิ่มรายการใหม่แทนการแก้ทับข้อมูลเก่า และแยกข้อความของ Merchant กับ Agent ให้เห็นชัดบนหน้าจอ

### 8. ออกแบบหน้าจอให้ตรงกับ workflow

Merchant ควรเห็นสถานะปัจจุบัน, เลข case, Agent ผู้ดูแล, วันที่อัปเดตล่าสุด, next action, checklist เอกสาร, chat และผลอนุมัติ ส่วน Agent ควรเห็น queue, SLA/งานใกล้ครบกำหนด, filter ตามสถานะ, case detail, checklist, risk signal แบบไม่เปิดเผยรายละเอียดเกินสิทธิ์ และ action ที่ทำได้ตามสถานะ

ใช้ labels ภาษาไทยที่ชัดเจน เช่น `รอ Agent ตรวจสอบ`, `ขอข้อมูลเพิ่มเติม`, `Merchant ตอบกลับแล้ว`, `รอ PD/Compliance`, `อนุมัติแล้ว` และให้สถานะมีทั้งสี ไอคอน และข้อความ ไม่พึ่งสีเพียงอย่างเดียว ปุ่มสำคัญต้องมี loading, disabled, success และ error state รวมถึง responsive layout สำหรับหน้าจอแคบ

### 9. รักษาความปลอดภัยและ privacy ตั้งแต่ต้นแบบ

- แยกข้อมูลและ action ตาม role แม้ใน mock UI
- mask เลขบัตรประชาชนและเลขบัญชีเมื่อไม่จำเป็นต้องแสดงเต็ม
- อย่าใส่ PII จริง, secret, token หรือข้อมูลเอกสารจริงใน mock data
- แยก risk flag ภายในออกจากเหตุผลแบบปลอดภัยที่แสดงแก่ Merchant
- จำลอง consent ที่บันทึก version ของ policy, เวลา และ actor
- ทุก action สำคัญควรสร้าง audit event ที่มี actor, action, target, timestamp, reason และ before/after เมื่อเกี่ยวข้อง
- เมื่อระบบจริงมี upload ให้ตรวจชนิดไฟล์ ขนาด การเข้าถึง และการเก็บแบบเข้ารหัสที่ backend; อย่าอ้างว่า frontend validation เพียงอย่างเดียวเพียงพอ

### 10. ตรวจงานก่อนส่งมอบ

ตรวจด้วยตนเองตามรายการนี้:

- Merchant ส่ง case แล้วแก้ไขไม่ได้จนกว่าจะถูกส่งกลับ
- Agent เห็นเฉพาะ case ที่ได้รับมอบหมาย และส่งต่อแทนการอนุมัติสุดท้าย
- เมื่อขอข้อมูลเพิ่ม Merchant ตอบผ่าน chat และส่งเอกสาร version ใหม่ได้
- เอกสารเก่าและข้อความเก่ายังอยู่ใน timeline
- transition ที่ไม่ถูกต้องทำไม่ได้และมีข้อความอธิบาย
- สถานะ, empty state, loading, error และ success state ครบ
- PII ในหน้าจอและ mock data ถูก mask หรือใช้ข้อมูลจำลอง
- การแสดงผลภาษาไทยไม่ล้น ไม่ทับกัน และใช้งานบน mobile ได้
- API/backend ที่ยังไม่มีให้ติดป้าย mock อย่างตรงไปตรงมา

เมื่อผู้ใช้ขอให้ตรวจสอบโค้ด ให้รันเฉพาะคำสั่งที่เหมาะกับการเปลี่ยนแปลง เช่น `npm run lint` หรือ `npm run build` ตามที่ผู้ใช้ร้องขอและตามข้อจำกัดของ repo หากเป็นคำขอแก้ไฟล์อย่างเดียว ไม่ต้องรัน build หรือ test โดยอัตโนมัติ

## ขอบเขตข้อมูลหลัก

เมื่อจำเป็นต้องสร้าง type หรือ mock model ให้ตั้งชื่อให้สอดคล้องกับ entity เหล่านี้:

`merchant_account`, `merchant_profile`, `merchant_kyc_case`, `merchant_business_profile`, `kyc_document`, `kyc_document_version`, `agent_assignment`, `kyc_chat_message`, `kyc_review_checklist`, `kyc_decision`, `risk_flag`, `consent_record`, `notification`, `audit_log`

อย่าสร้างทุก entity ในครั้งเดียวหาก task แตะเพียงหน้าหรือ flow เดียว ให้เลือก model ขั้นต่ำที่ทำให้ behavior นั้นทดสอบและขยายต่อได้

## รูปแบบผลลัพธ์ของงาน

ก่อนแก้โค้ดให้สรุปสั้น ๆ ว่า:

- จุดที่แก้และ actor ที่เกี่ยวข้อง
- สถานะหรือ transition ที่เปลี่ยน
- ข้อมูลที่ต้องรักษาแบบ versioned/audited
- ข้อสมมติฐานว่า backend หรือ persistence ส่วนใดเป็น mock

หลังแก้ให้รายงานไฟล์ที่เปลี่ยน, behavior ที่รองรับ, validation ที่รันแล้ว และข้อจำกัดที่ยังเหลืออยู่ โดยไม่อ้างว่า mock flow เป็นระบบ production หรือผ่านข้อกำกับดูแลแล้ว

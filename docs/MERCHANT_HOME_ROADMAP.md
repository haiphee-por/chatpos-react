# ChatPOS Merchant Home Roadmap

เอกสารนี้ใช้วางแผนปรับหน้าหลักของ Merchant Portal ให้มีหน้าตาและความสามารถตามภาพอ้างอิง [419449.jpg](419449.jpg) โดยเน้น mobile-first และรองรับการใช้งานจริงของร้านค้า

> สถานะเอกสาร: Draft สำหรับแตกงาน Product, UX/UI, Frontend, Backend และ QA
>
> อัปเดตล่าสุด: 2026-08-26

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
- `fetchDbStores`, `fetchDbTransactions` และ data fetcher บางตัวคืนค่า array ว่างเมื่อ request error ทำให้ frontend แยก empty state ออกจาก error state ไม่ได้ ต้องปรับ result contract ก่อนทำ state matrix ให้ครบ
- `DbStoreRow` ปัจจุบันยังไม่มี `timezone`, `businessStatus`, capability หรือ balance summary fields ตาม home read model; ต้องเพิ่ม schema/API หรือระบุ source ของแต่ละ field ให้ครบ

**สรุปสถานะ:** Product/Design artifact ครบระดับ draft และใช้แตกงานได้ แต่ Frontend checklist ยังต้องคงเป็น `[ ]`/`[~]` จนกว่าจะมี implementation, API contract และ screenshot/test evidence ตาม Definition of Done

## 3. Product / Design decision record

### 3.1 Scope ที่ใช้ทำงาน

| Decision | ข้อสรุปสำหรับ roadmap | สถานะ |
|---|---|---|
| หน้าที่ตรงกับภาพ | Authenticated Merchant Home ที่ `/merchant#home` | บันทึกแล้ว รอ Product sign-off |
| Public landing | `/`, `/login`, `/landing` ยังคงเป็น marketing landing และไม่ถูกแทนที่ใน release นี้ | บันทึกแล้ว รอ Product sign-off |
| กลุ่มผู้ใช้ | Merchant owner/staff ที่ผ่าน server session และเห็นเฉพาะ Store ที่มีสิทธิ์ | สอดคล้องกับ route ปัจจุบัน |
| รูปแบบหลัก | Mobile-first ที่ 390-430px; desktop ใช้ Merchant Portal shell เดิมและจัดวางให้ scan ได้ | baseline สำหรับ Design |
| ข้อมูลสำคัญ | Store, balance, transaction และ notification ต้องมาจาก server read model; mock ใช้ได้เฉพาะ demo/test | ข้อกำหนด release |

### 3.2 Annotated wireframe จากภาพอ้างอิง

ภาพอ้างอิง: [419449.jpg](419449.jpg)

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

ชื่อ endpoint และ schema เป็น proposal ต้องยืนยันร่วมกับ API owner ก่อน implement; ห้ามถือรายการนี้เป็น external contract ที่ sign แล้ว

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

- [ ] แยก home shell, store header, balance summary, quick actions, management list, notification drawer และ bottom nav เป็น component ที่ดูแลได้
- [ ] รวม nav definition ให้ sidebar, home และ bottom nav ใช้ id/label/permission/target ชุดเดียวกัน
- [ ] แก้ hardcoded store name, Merchant ID, balance, counts และ notification ออกจาก production path
- [ ] แก้ mapping `เซลเพจ -> salespage`, `ประวัติธุรกรรม -> transactions` และ `สิทธิพิเศษ -> benefits` ตาม decision record
- [ ] เพิ่ม `stoppay` และ `benefits` หรือบันทึก approved decision ว่าจะอยู่ใน view เดิม
- [ ] เพิ่ม skeleton/error/empty/retry และ stale indicator โดยคงขนาด layout
- [ ] ทำ interaction ของ language, notification read/filter, profile/store selector และ balance visibility ให้ครบ
- [ ] ตรวจ route/hash refresh, browser back/forward และ active state ทุกเมนู

### Backend / Data

- [ ] ออกแบบและยืนยัน home read model พร้อม source, freshness และ cache policy
- [ ] เพิ่ม/ปรับ endpoint สำหรับ summary, unread notification, benefits และ capability flags ตาม contract
- [ ] บังคับ session, role และ Store ownership ที่ทุก endpoint ที่ home เรียก
- [ ] ทำ notification read/mark-all แบบ idempotent พร้อม audit ที่เหมาะสม
- [ ] แยก transaction/order/payment/refund/payout semantics และกำหนด query/filter/pagination
- [ ] ออกแบบ STOPPAY state transition, idempotency, audit, approval และ recovery ก่อนทำปุ่ม action
- [ ] ยืนยันข้อมูล revenue/wallet/billing กับ Finance และ payment owner
- [ ] เพิ่ม migration เฉพาะเมื่อมี durable state ใหม่ และจัดทำ rollback/retention plan

### QA / Security / Operations

- [ ] ทดสอบ mobile 390/430px, desktop และ browser refresh ทุก target menu
- [ ] ทดสอบ unauthorized, wrong Store, role mismatch, expired session และ revoked session
- [ ] ทดสอบ duplicate click, retry, timeout, stale response และ notification race condition
- [ ] ตรวจไม่ให้ยอดเงิน, token, secret หรือ PII หลุดใน localStorage, URL, console และ log
- [ ] เพิ่ม E2E evidence สำหรับ POS, wallet, transaction history, orders, services, salespage และ settings
- [ ] เพิ่ม monitoring ของ home API latency/error rate และ owner สำหรับ incident
- [ ] เตรียม feature flag, rollout checklist, rollback และ support/runbook ก่อนเปิดให้ร้านค้าจริง
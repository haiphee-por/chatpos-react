const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  connectionTimeoutMillis: 5000,
});

const ids = {
  admin: '10000000-0000-4000-8000-000000000001',
  compliance: '10000000-0000-4000-8000-000000000002',
  pdUser: '10000000-0000-4000-8000-000000000003',
  agentUser: '10000000-0000-4000-8000-000000000004',
  merchantUser: '10000000-0000-4000-8000-000000000005',
  merchantTwoUser: '10000000-0000-4000-8000-000000000006',
  pd: '20000000-0000-4000-8000-000000000001',
  agent: '20000000-0000-4000-8000-000000000002',
  store: '30000000-0000-4000-8000-000000000001',
  storeTwo: '30000000-0000-4000-8000-000000000002',
  merchantIdentity: '40000000-0000-4000-8000-000000000001',
  merchantIdentityTwo: '40000000-0000-4000-8000-000000000002',
  merchantKyc: '50000000-0000-4000-8000-000000000001',
  merchantTwoKyc: '50000000-0000-4000-8000-000000000002',
  case: '60000000-0000-4000-8000-000000000001',
  caseTwo: '60000000-0000-4000-8000-000000000002',
  assignment: '70000000-0000-4000-8000-000000000001',
  assignmentTwo: '70000000-0000-4000-8000-000000000002',
  assignmentEvent: '71000000-0000-4000-8000-000000000001',
  assignmentEventTwo: '71000000-0000-4000-8000-000000000002',
  document: '80000000-0000-4000-8000-000000000001',
  documentVersion: '81000000-0000-4000-8000-000000000001',
  documentTwo: '80000000-0000-4000-8000-000000000002',
  documentVersionTwo: '81000000-0000-4000-8000-000000000002',
  transactionPaid: '90000000-0000-4000-8000-000000000001',
  transactionPending: '90000000-0000-4000-8000-000000000002',
  transactionFailed: '90000000-0000-4000-8000-000000000003',
  productCoffee: 'a0000000-0000-4000-8000-000000000001',
  productCake: 'a0000000-0000-4000-8000-000000000002',
  productService: 'a0000000-0000-4000-8000-000000000003',
  commissionAgent: 'b0000000-0000-4000-8000-000000000001',
  commissionPd: 'b0000000-0000-4000-8000-000000000002',
  webhookEvent: 'c0000000-0000-4000-8000-000000000001',
  paymentWebhook: 'd0000000-0000-4000-8000-000000000001',
  settlementEvent: 'e0000000-0000-4000-8000-000000000001',
};

const seedPassword = process.env.SEED_PASSWORD || 'ChatPOS123!';
const passwordHash = bcrypt.hashSync(seedPassword, 10);

async function query(text, values = []) {
  return client.query(text, values);
}

async function seed() {
  await client.connect();
  await query('BEGIN');

  try {
    await query(
      `INSERT INTO "AdminAccount" (id, name, email, phone, password, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, password = EXCLUDED.password, "isActive" = true, "updatedAt" = NOW()`,
      [ids.admin, 'Demo Admin', 'admin.demo@chatpos.local', '0811111111', passwordHash]
    );

    await query(
      `INSERT INTO "User" (id, name, email, phone, password, role, "isActive", "createdAt", "updatedAt")
       VALUES
         ($1, 'Demo Compliance', 'compliance.demo@chatpos.local', '0822222222', $6, 'compliance', true, NOW(), NOW()),
         ($2, 'Demo PD', 'pd.demo@chatpos.local', '0833333333', $6, 'pd', true, NOW(), NOW()),
         ($3, 'Demo Agent', 'agent.demo@chatpos.local', '0844444444', $6, 'agent', true, NOW(), NOW()),
         ($4, 'Demo Merchant', 'merchant.demo@chatpos.local', '0855555555', $6, 'owner', true, NOW(), NOW()),
         ($5, 'Demo Merchant Two', 'merchant2.demo@chatpos.local', '0866666666', $6, 'owner', true, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, password = EXCLUDED.password, role = EXCLUDED.role, "isActive" = true, "updatedAt" = NOW()`,
      [ids.compliance, ids.pdUser, ids.agentUser, ids.merchantUser, ids.merchantTwoUser, passwordHash]
    );

    await query(
      `INSERT INTO "ProvincialDirector" (id, "userId", code, "displayName", status, "investmentAmount", "territoryId", "startedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, 'PD-DEMO-001', 'Demo Provincial Director', 'active', 250000, 'BKK', NOW(), NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET "userId" = EXCLUDED."userId", status = 'active', "updatedAt" = NOW()`,
      [ids.pd, ids.pdUser]
    );

    await query(
      `INSERT INTO "Agent" (id, "userId", code, tier, status, "adBudget", "baseAllowance", "walletBalance", "currentPdId", "createdAt", "updatedAt")
       VALUES ($1, $2, 'AG-DEMO-001', 'GOLD', 'active', 100000, 4000, 12500, $3, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET "userId" = EXCLUDED."userId", tier = 'GOLD', status = 'active', "currentPdId" = EXCLUDED."currentPdId", "updatedAt" = NOW()`,
      [ids.agent, ids.agentUser, ids.pd]
    );

    await query(
      `INSERT INTO "Store" (id, name, description, address, phone, "userId", "isActive", currency, language, "isOnboarded", tier, "subscriptionStatus", "monthlyGmvUsed", "monthlyTxnCount", "storeType", "memberStatus", "payoutBankName", "payoutAccountNumber", "payoutAccountName", "referralCodeUsed", "currentAgentId", "currentPdId", "qrSettings", "webhookUrl", "webhookSecret", "profileVersion", "profileJson", "createdAt", "updatedAt")
       VALUES
         ($1, 'Demo Coffee Lab', 'ร้านกาแฟสำหรับทดลอง ChatPOS ครบทุก flow', '88 ถนนสุขุมวิท กรุงเทพฯ', '0855555555', $3, true, 'THB', 'th', true, 'PRO', 'active', 12500, 3, 'MAIN', 'member', 'Demo Bank', '1112223334', 'Demo Merchant', 'DEMO-REF', $5, $6, '{"promptPayId":"0855555555","theme":"coffee"}'::jsonb, 'https://merchant.demo.local/webhooks/payment', 'demo-store-secret-001', 2, '{"ownerName":"Demo Merchant","province":"กรุงเทพมหานคร","businessCategory":"ร้านกาแฟ"}'::jsonb, NOW(), NOW()),
         ($2, 'Demo Bakery Review', 'ร้านค้าสำหรับทดลอง KYC pending และ review flow', '99 ถนนประชาราษฎร์ นนทบุรี', '0866666666', $4, true, 'THB', 'th', false, 'FREE', 'active', 0, 0, 'MAIN', 'non_member', 'Demo Bank', '5556667778', 'Demo Merchant Two', null, $5, $6, '{"promptPayId":"0866666666"}'::jsonb, null, null, 0, '{}'::jsonb, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, "userId" = EXCLUDED."userId", "isActive" = true, "isOnboarded" = EXCLUDED."isOnboarded", tier = EXCLUDED.tier, "currentAgentId" = EXCLUDED."currentAgentId", "currentPdId" = EXCLUDED."currentPdId", "profileVersion" = EXCLUDED."profileVersion", "profileJson" = EXCLUDED."profileJson", "updatedAt" = NOW()`,
      [ids.store, ids.storeTwo, ids.merchantUser, ids.merchantTwoUser, ids.agent, ids.pd]
    );

    await query(
      `INSERT INTO "MerchantIdentity" (id, "merchantId", "clientId", "issuedType", "registeredAt", source, "issuedAt", "lockedAt", "createdAt", "updatedAt")
       VALUES
         ($1, 'SDEMO000001', $3, 'S', NOW() - INTERVAL '30 days', 'seed', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', NOW(), NOW()),
         ($2, 'SDEMO000002', $4, 'S', NOW() - INTERVAL '2 days', 'seed', NOW() - INTERVAL '2 days', null, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET "clientId" = EXCLUDED."clientId", "updatedAt" = NOW()`,
      [ids.merchantIdentity, ids.merchantIdentityTwo, ids.store, ids.storeTwo]
    );

    await query(
      `INSERT INTO "KycVerification" (id, "userId", "storeId", "businessName", "firstName", "lastName", phone, "taxId", "bankName", "bankAccountNumber", "bankAccountName", "currentAddress", "businessAddress", "businessType", status, "currentStep", "applicantType", "approvalLevel", "kycSize", "agreementAccepted", "reviewNotes", "submittedAt", "reviewedAt", "submissionSnapshotJson", "submissionProfileVersion", "createdAt", "updatedAt")
       VALUES
         ($1, $3, $5, 'Demo Coffee Lab', 'Demo', 'Merchant', '0855555555', '0105555000001', 'Demo Bank', '1112223334', 'Demo Merchant', '88 ถนนสุขุมวิท กรุงเทพฯ', '88 ถนนสุขุมวิท กรุงเทพฯ', 'cafe', 'approved', 5, 'physical_store', 'approved', 'S', true, 'Seed happy path approved', NOW() - INTERVAL '20 days', NOW() - INTERVAL '18 days', '{"businessName":"Demo Coffee Lab","businessCategory":"ร้านกาแฟ"}'::jsonb, 2, NOW(), NOW()),
         ($2, $4, $6, 'Demo Bakery Review', 'Demo', 'Merchant Two', '0866666666', '0105555000002', 'Demo Bank', '5556667778', 'Demo Merchant Two', '99 ถนนประชาราษฎร์ นนทบุรี', '99 ถนนประชาราษฎร์ นนทบุรี', 'bakery', 'pending', 2, 'physical_store', 'pending', 'M', false, null, NOW() - INTERVAL '1 day', null, null, 0, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, "currentStep" = EXCLUDED."currentStep", "reviewNotes" = EXCLUDED."reviewNotes", "updatedAt" = NOW()`,
      [ids.merchantKyc, ids.merchantTwoKyc, ids.merchantUser, ids.merchantTwoUser, ids.store, ids.storeTwo]
    );

    await query(
      `INSERT INTO merchant_kyc_cases (id, "storeId", "verificationId", case_number, status, "assignedAgentId", "assignedPdId", "submissionVersion", "submissionSnapshotJson", "submissionProfileVersion", "createdAt", "updatedAt")
       VALUES
         ($1, $3, $5, 'KYC-DEMO-0001', 'APPROVED', $7, $8, 2, '{"businessName":"Demo Coffee Lab"}'::jsonb, 2, NOW() - INTERVAL '20 days', NOW()),
         ($2, $4, $6, 'KYC-DEMO-0002', 'WAITING_AGENT_REVIEW', $7, $8, 1, null, 0, NOW() - INTERVAL '1 day', NOW())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, "assignedAgentId" = EXCLUDED."assignedAgentId", "assignedPdId" = EXCLUDED."assignedPdId", "updatedAt" = NOW()`,
      [ids.case, ids.caseTwo, ids.store, ids.storeTwo, ids.merchantKyc, ids.merchantTwoKyc, ids.agent, ids.pd]
    );

    await query(
      `INSERT INTO agent_assignments (id, "storeId", "sourceRequestId", "assignmentRequestId", "idempotencyKey", status, "agentPhone", "agentId", "pdId", reason, "assignedAt", "acceptedAt", "expiresAt", "createdAt", "updatedAt")
       VALUES
         ($1, $3, 'seed-assignment-accepted', 'BO-ASSIGN-DEMO-001', 'seed:assignment:accepted', 'ACCEPTED', '0844444444', $5, $6, 'Seed accepted assignment', NOW() - INTERVAL '19 days', NOW() - INTERVAL '19 days', NOW() + INTERVAL '30 days', NOW() - INTERVAL '19 days', NOW()),
         ($2, $4, 'seed-assignment-pending', null, 'seed:assignment:pending', 'PENDING_AGENT_ACCEPTANCE', '0844444444', $5, $6, null, NOW() - INTERVAL '1 day', null, NOW() + INTERVAL '2 days', NOW() - INTERVAL '1 day', NOW())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, "agentId" = EXCLUDED."agentId", "pdId" = EXCLUDED."pdId", "updatedAt" = NOW()`,
      [ids.assignment, ids.assignmentTwo, ids.store, ids.storeTwo, ids.agent, ids.pd]
    );

    await query(
      `INSERT INTO agent_assignment_events (id, "assignmentId", "eventId", "eventType", status, "payloadJson", "requestId", "createdAt")
       VALUES
         ($1, $3, 'seed-assignment-event-accepted', 'assignment.status.changed', 'ACCEPTED', '{"storeId":"30000000-0000-4000-8000-000000000001","status":"ACCEPTED"}'::jsonb, 'seed-request-accepted', NOW() - INTERVAL '19 days'),
         ($2, $4, 'seed-assignment-event-pending', 'assignment.status.changed', 'PENDING_AGENT_ACCEPTANCE', '{"storeId":"30000000-0000-4000-8000-000000000002","status":"PENDING_AGENT_ACCEPTANCE"}'::jsonb, 'seed-request-pending', NOW() - INTERVAL '1 day')
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, "payloadJson" = EXCLUDED."payloadJson"`,
      [ids.assignmentEvent, ids.assignmentEventTwo, ids.assignment, ids.assignmentTwo]
    );

    await query(
      `INSERT INTO merchant_profile_versions (id, "storeId", version, "sourceRequestId", "idempotencyKey", "bodyDigest", "changedFieldsJson", "snapshotJson", "createdBy", "createdAt")
       VALUES ($1, $2, 1, 'seed-profile-001', 'seed:profile:001', 'seed-profile-digest-001', '["ownerName","businessCategory"]'::jsonb, '{"ownerName":"Demo Merchant","businessCategory":"ร้านกาแฟ"}'::jsonb, 'merchant', NOW() - INTERVAL '2 days')
       ON CONFLICT (id) DO UPDATE SET "snapshotJson" = EXCLUDED."snapshotJson"`,
      ['a1000000-0000-4000-8000-000000000001', ids.store]
    );

    await query(
      `INSERT INTO kyc_documents (id, "caseId", "storeId", "documentType", status, "latestVersion", "scanStatus", "scanReportJson", "scannedAt", "createdAt", "updatedAt")
       VALUES
         ($1, $3, $4, 'national_id', 'approved', 1, 'CLEAN', '{"engine":"seed","result":"clean"}'::jsonb, NOW() - INTERVAL '19 days', NOW() - INTERVAL '20 days', NOW()),
         ($2, $5, $6, 'business_registration', 'not_uploaded', 0, 'PENDING', '{}'::jsonb, null, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, "latestVersion" = EXCLUDED."latestVersion", "scanStatus" = EXCLUDED."scanStatus", "updatedAt" = NOW()`,
      [ids.document, ids.documentTwo, ids.case, ids.store, ids.caseTwo, ids.storeTwo]
    );

    await query(
      `INSERT INTO kyc_document_versions (id, "documentId", "caseId", "storeId", version, "fileName", "mimeType", "fileSize", "checksumSha256", "storageLocator", status, "submittedBy", reason, "sourceRequestId", "idempotencyKey", "scanStatus", "scanReportJson", "scannedAt", "createdAt")
      VALUES ($1, $2, $3, $4, 1, 'demo-national-id.png', 'image/png', 245678, 'seed-checksum-national-id-001', 'demo://kyc/merchant-001/national-id-v1', 'uploaded', 'merchant', 'Seed clean document', 'seed-document-001', 'seed:document:001', 'CLEAN', '{"engine":"seed","result":"clean"}'::jsonb, NOW() - INTERVAL '19 days', NOW() - INTERVAL '19 days')
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, "scanStatus" = EXCLUDED."scanStatus"`,
      [ids.documentVersion, ids.document, ids.case, ids.store]
    );

    await query(
      `INSERT INTO kyc_review_checklists (id, "caseId", code, label, status, "reviewerId", note, "updatedAt")
       VALUES
         ('a2000000-0000-4000-8000-000000000001', $1, 'IDENTITY_MATCH', 'ตรวจสอบตัวตนและเอกสาร', 'passed', $2, 'Seed passed', NOW()),
         ('a2000000-0000-4000-8000-000000000002', $1, 'BUSINESS_ADDRESS', 'ตรวจสอบที่อยู่กิจการ', 'passed', $2, 'Seed passed', NOW()),
         ('a2000000-0000-4000-8000-000000000003', $3, 'IDENTITY_MATCH', 'ตรวจสอบตัวตนและเอกสาร', 'pending', $4, null, NOW())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, "updatedAt" = NOW()`,
      [ids.case, ids.agent, ids.caseTwo, ids.agentUser]
    );

    await query(
      `INSERT INTO kyc_chat_messages (id, "caseId", "senderId", "senderRole", "recipientId", message, "attachmentMetadataJson", status, "createdAt")
       VALUES
         ('a3000000-0000-4000-8000-000000000001', $1, $2, 'merchant', $3, 'เอกสารพร้อมให้ตรวจสอบแล้วครับ', '[]'::jsonb, 'active', NOW() - INTERVAL '1 day'),
         ('a3000000-0000-4000-8000-000000000002', $1, $3, 'agent', $2, 'รับเรื่องแล้ว กำลังตรวจสอบข้อมูลครับ', '[]'::jsonb, 'active', NOW() - INTERVAL '20 hours'),
         ('a3000000-0000-4000-8000-000000000003', $4, $5, 'merchant', $3, 'ขอสอบถามสถานะการตรวจ KYC ครับ', '[]'::jsonb, 'active', NOW() - INTERVAL '2 hours')
       ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message, status = EXCLUDED.status`,
      [ids.case, ids.merchantUser, ids.agentUser, ids.caseTwo, ids.merchantTwoUser]
    );

    await query(
      `INSERT INTO kyc_decisions (id, "caseId", "decisionType", decision, "actorId", reason, "createdAt")
       VALUES
         ('a4000000-0000-4000-8000-000000000001', $1, 'AGENT_REVIEW', 'approved', $2, 'ข้อมูลครบถ้วนตามเกณฑ์ทดลอง', NOW() - INTERVAL '18 days'),
         ('a4000000-0000-4000-8000-000000000002', $1, 'PD_REVIEW', 'approved', $3, 'อนุมัติสำหรับ demo flow', NOW() - INTERVAL '18 days')
       ON CONFLICT (id) DO UPDATE SET decision = EXCLUDED.decision, reason = EXCLUDED.reason`,
      [ids.case, ids.agentUser, ids.pdUser]
    );

    await query(
      `INSERT INTO risk_flags (id, "caseId", code, severity, status, details, "createdAt", "resolvedAt")
       VALUES
         ('a5000000-0000-4000-8000-000000000001', $1, 'ADDRESS_REVIEW_REQUIRED', 'low', 'resolved', '{"note":"Seed resolved flag"}'::jsonb, NOW() - INTERVAL '19 days', NOW() - INTERVAL '18 days'),
         ('a5000000-0000-4000-8000-000000000002', $2, 'MISSING_BUSINESS_DOCUMENT', 'medium', 'open', '{"note":"Upload business registration"}'::jsonb, NOW() - INTERVAL '1 day', null)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, details = EXCLUDED.details, "resolvedAt" = EXCLUDED."resolvedAt"`,
      [ids.case, ids.caseTwo]
    );

    await query(
      `INSERT INTO consent_records (id, "caseId", "storeId", "policyCode", "policyVersion", accepted, "actorId", "createdAt")
       VALUES
         ('a6000000-0000-4000-8000-000000000001', $1, $3, 'KYC_PRIVACY', '2026.01', true, $4, NOW() - INTERVAL '20 days'),
         ('a6000000-0000-4000-8000-000000000002', $2, $5, 'KYC_PRIVACY', '2026.01', false, $6, NOW() - INTERVAL '1 day')
       ON CONFLICT (id) DO UPDATE SET accepted = EXCLUDED.accepted`,
      [ids.case, ids.caseTwo, ids.store, ids.merchantUser, ids.storeTwo, ids.merchantTwoUser]
    );

    await query(
      `INSERT INTO notifications (id, "recipientId", "caseId", type, title, message, "readAt", "createdAt")
       VALUES
         ('a7000000-0000-4000-8000-000000000001', $1, $2, 'KYC_APPROVED', 'KYC ผ่านการอนุมัติ', 'Demo Coffee Lab ผ่านการตรวจสอบ KYC แล้ว', NOW() - INTERVAL '17 days', NOW() - INTERVAL '17 days'),
         ('a7000000-0000-4000-8000-000000000002', $3, $4, 'KYC_ACTION_REQUIRED', 'ต้องส่งเอกสารเพิ่มเติม', 'กรุณาอัปโหลดเอกสารทะเบียนพาณิชย์', null, NOW() - INTERVAL '1 day')
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, message = EXCLUDED.message, "readAt" = EXCLUDED."readAt"`,
      [ids.merchantUser, ids.case, ids.merchantTwoUser, ids.caseTwo]
    );

    await query(
      `INSERT INTO "Product" (id, "storeId", name, description, price, cost, stock, category, sku, "isActive", "trackStock", "createdAt", "updatedAt")
       VALUES
         ($1, $4, 'ลาเต้เย็น Demo', 'กาแฟนมสำหรับทดลองขาย', 85, 32, 100, 'เครื่องดื่ม', 'DEMO-COFFEE-001', true, true, NOW(), NOW()),
         ($2, $4, 'เค้กช็อกโกแลต Demo', 'ขนมสำหรับทดลองขาย', 120, 55, 24, 'เบเกอรี่', 'DEMO-CAKE-001', true, true, NOW(), NOW()),
         ($3, $5, 'ชุดตรวจสอบธุรกิจ Demo', 'สินค้าในร้านที่อยู่ระหว่าง review', 450, 200, 8, 'บริการ', 'DEMO-REVIEW-001', true, true, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price, stock = EXCLUDED.stock, "updatedAt" = NOW()`,
      [ids.productCoffee, ids.productCake, ids.productService, ids.store, ids.storeTwo]
    );

    await query(
      `INSERT INTO "Transaction" (id, reference, "clientReference", "backofficePaymentReference", "gatewayReference", amount, fee, "netAmount", channel, status, "storeId", "userId", currency, "kitchenStatus", origin, "paymentMethod", "paymentMethodLabel", "customerName", "customerPhone", "tableName", note, "isSettled", "paidAt", "lastPaymentOccurredAt", "lastPaymentEventId", "paymentMetadataJson", "createdAt", "updatedAt")
       VALUES
         ($1, 'TXN-DEMO-PAID-001', 'CLIENT-DEMO-PAID-001', 'BO-PAY-DEMO-001', 'LLGW-DEMO-001', 245, 4.90, 240.10, 'promptpay', 'completed', $4, $5, 'THB', 'SERVED', 'POS', 'promptpay', 'PromptPay พร้อมเพย์ QR', 'คุณสมชาย ใจดี', '0899999999', 'โต๊ะ A1', 'Seed paid transaction', true, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', 'seed-payment-event-001', '{"provider":"LLGW","qr":"demo-qr-string"}'::jsonb, NOW() - INTERVAL '2 hours', NOW()),
         ($2, 'TXN-DEMO-PENDING-001', 'CLIENT-DEMO-PENDING-001', null, null, 180, 0, 180, 'promptpay', 'pending', $4, $5, 'THB', 'WAITING', 'POS', 'promptpay', 'PromptPay พร้อมเพย์ QR', 'คุณอนันต์ สุขใจ', '0888888888', 'โต๊ะ B2', 'Seed pending payment', false, null, NOW() - INTERVAL '30 minutes', 'seed-payment-event-002', '{"provider":"LLGW"}'::jsonb, NOW() - INTERVAL '30 minutes', NOW()),
         ($3, 'TXN-DEMO-FAILED-001', 'CLIENT-DEMO-FAILED-001', 'BO-PAY-DEMO-003', 'LLGW-DEMO-003', 99, 0, 99, 'card', 'failed', $6, $7, 'THB', 'CANCELLED', 'ONLINE', 'card', 'บัตรเครดิต/เดบิต', 'Demo Customer', '0877777777', 'Online', 'Seed failed payment', false, null, NOW() - INTERVAL '3 days', 'seed-payment-event-003', '{"provider":"LLGW","failureCode":"DECLINED"}'::jsonb, NOW() - INTERVAL '3 days', NOW()),
         ($8, 'TXN-DEMO-SETTLED-001', 'CLIENT-DEMO-SETTLED-001', 'BO-PAY-DEMO-004', 'LLGW-DEMO-004', 520, 10.40, 509.60, 'checkout', 'completed', $4, $5, 'THB', 'SERVED', 'ONLINE', 'checkout', 'Hosted Checkout', 'Demo Online Customer', '0861234567', 'Online', 'Seed settled transaction', true, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days', 'seed-payment-event-004', '{"provider":"LLGW"}'::jsonb, NOW() - INTERVAL '7 days', NOW())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, amount = EXCLUDED.amount, "isSettled" = EXCLUDED."isSettled", "updatedAt" = NOW()`,
      [ids.transactionPaid, ids.transactionPending, ids.transactionFailed, ids.store, ids.merchantUser, ids.storeTwo, ids.merchantTwoUser, '90000000-0000-4000-8000-000000000004']
    );

    await query(
      `INSERT INTO "CommissionLedger" (id, "sourceType", "sourceRef", "beneficiaryType", amount, "grossAmount", "ratePercent", status, "ruleCode", "agentId", "pdId", "storeId", "earnedAt", "createdAt", "updatedAt")
       VALUES
         ($1, 'PAYMENT', 'TXN-DEMO-PAID-001', 'agent', 7.35, 245, 3, 'earned', 'DEMO_AGENT_3PCT', $3, null, $5, NOW() - INTERVAL '2 hours', NOW(), NOW()),
         ($2, 'PAYMENT', 'TXN-DEMO-PAID-001', 'pd', 2.45, 245, 1, 'earned', 'DEMO_PD_1PCT', null, $4, $5, NOW() - INTERVAL '2 hours', NOW(), NOW()),
         ($6, 'PAYMENT', 'TXN-DEMO-SETTLED-001', 'agent', 15.60, 520, 3, 'paid', 'DEMO_AGENT_3PCT', $3, null, $5, NOW() - INTERVAL '7 days', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount, status = EXCLUDED.status, "updatedAt" = NOW()`,
      [ids.commissionAgent, ids.commissionPd, ids.agent, ids.pd, ids.store, 'b0000000-0000-4000-8000-000000000003']
    );

    await query(
      `INSERT INTO payment_webhook_events (id, provider, "eventId", "bodyDigest", "transactionId", status, "occurredAt", "payloadJson", "receivedAt", "processedAt")
       VALUES ($1, 'backoffice-payment-status', 'seed-payment-event-001', 'seed-body-digest-001', $2, 'PROCESSED', NOW() - INTERVAL '2 hours', '{"eventType":"payment.status.changed","status":"paid","transactionReference":"TXN-DEMO-PAID-001"}'::jsonb, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours')
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, "payloadJson" = EXCLUDED."payloadJson"`,
      [ids.paymentWebhook, ids.transactionPaid]
    );

    await query(
      `INSERT INTO commission_settlement_events (id, "eventId", "eventType", "transactionId", "sourceRef", "bodyDigest", "payloadJson", status, attempts, "sentAt", "createdAt")
       VALUES ($1, 'seed-settlement-event-001', 'SETTLEMENT_EARNED', $2, 'TXN-DEMO-SETTLED-001', 'seed-settlement-digest-001', '{"amounts":{"pdGrossBenefit":2.60},"ownershipSnapshot":{"storeId":"30000000-0000-4000-8000-000000000001","agentId":"20000000-0000-4000-8000-000000000002"}}'::jsonb, 'SENT', 1, NOW() - INTERVAL '6 days', NOW() - INTERVAL '7 days')
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, attempts = EXCLUDED.attempts, "sentAt" = EXCLUDED."sentAt"`,
      [ids.settlementEvent, '90000000-0000-4000-8000-000000000004']
    );

    await query(
      `INSERT INTO "WebhookEventLog" (id, "storeId", "eventType", status, "payloadJson", "createdAt", "updatedAt")
       VALUES ($1, $2, 'payment.status.changed', 'PROCESSED', '{"reference":"TXN-DEMO-PAID-001","status":"paid"}'::jsonb, NOW() - INTERVAL '2 hours', NOW())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, "payloadJson" = EXCLUDED."payloadJson", "updatedAt" = NOW()`,
      [ids.webhookEvent, ids.store]
    );

    await query(
      `INSERT INTO audit_logs (id, "actorId", "actorRole", action, "targetType", "targetId", reason, "afterJson", "requestId", "createdAt")
       VALUES
         ('f0000000-0000-4000-8000-000000000001', $1, 'merchant', 'LOGIN_SUCCEEDED', 'auth_session', 'seed-session-merchant', 'Seed demo activity', '{"storeId":"30000000-0000-4000-8000-000000000001"}'::jsonb, 'seed-audit-001', NOW() - INTERVAL '2 hours'),
         ('f0000000-0000-4000-8000-000000000002', $2, 'agent', 'KYC_REVIEW_APPROVED', 'kyc_case', $3, 'Seed demo activity', '{"status":"approved"}'::jsonb, 'seed-audit-002', NOW() - INTERVAL '18 days'),
         ('f0000000-0000-4000-8000-000000000003', $4, 'pd', 'SETTLEMENT_APPROVED', 'settlement_event', $5, 'Seed demo activity', '{"status":"SENT"}'::jsonb, 'seed-audit-003', NOW() - INTERVAL '6 days')
       ON CONFLICT (id) DO UPDATE SET action = EXCLUDED.action, "afterJson" = EXCLUDED."afterJson"`,
      [ids.merchantUser, ids.agentUser, ids.case, ids.pdUser, ids.settlementEvent]
    );

    await query('COMMIT');
    console.log('Database seed completed.');
    console.log(`Demo password: ${seedPassword}`);
    console.log('Demo accounts:');
    console.log('  admin.demo@chatpos.local       (admin)');
    console.log('  compliance.demo@chatpos.local (compliance)');
    console.log('  pd.demo@chatpos.local         (pd)');
    console.log('  agent.demo@chatpos.local      (agent)');
    console.log('  merchant.demo@chatpos.local  (merchant, Demo Coffee Lab)');
    console.log('  merchant2.demo@chatpos.local (merchant, Demo Bakery Review)');
  } catch (error) {
    await query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

seed().catch((error) => {
  console.error('Database seed failed:', error.message);
  process.exitCode = 1;
});
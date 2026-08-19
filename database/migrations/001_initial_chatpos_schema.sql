CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "User" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  password text NOT NULL,
  role text NOT NULL DEFAULT 'merchant',
  "isActive" boolean NOT NULL DEFAULT true,
  avatar text,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "AdminAccount" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  password text NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  avatar text,
  "lastLoginAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ProvincialDirector" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"(id),
  code text NOT NULL UNIQUE,
  "displayName" text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  "investmentAmount" numeric(18,2) NOT NULL DEFAULT 0,
  "territoryId" text,
  "startedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Agent" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"(id),
  code text NOT NULL UNIQUE,
  tier text NOT NULL DEFAULT 'STANDARD',
  status text NOT NULL DEFAULT 'pending',
  "adBudget" numeric(18,2) NOT NULL DEFAULT 0,
  "baseAllowance" numeric(18,2) NOT NULL DEFAULT 0,
  "walletBalance" numeric(18,2) NOT NULL DEFAULT 0,
  "currentPdId" uuid REFERENCES "ProvincialDirector"(id),
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Store" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  address text,
  phone text,
  "userId" uuid REFERENCES "User"(id),
  "isActive" boolean NOT NULL DEFAULT true,
  currency text NOT NULL DEFAULT 'THB',
  language text NOT NULL DEFAULT 'th',
  "isOnboarded" boolean NOT NULL DEFAULT false,
  tier text NOT NULL DEFAULT 'FREE',
  "subscriptionStatus" text NOT NULL DEFAULT 'active',
  "monthlyGmvUsed" numeric(18,2) NOT NULL DEFAULT 0,
  "monthlyTxnCount" integer NOT NULL DEFAULT 0,
  "storeType" text NOT NULL DEFAULT 'MAIN',
  "memberStatus" text NOT NULL DEFAULT 'non_member',
  "payoutBankName" text,
  "payoutAccountNumber" text,
  "payoutAccountName" text,
  "referralCodeUsed" text,
  "accountNumber" text,
  "currentAgentId" uuid REFERENCES "Agent"(id),
  "currentPdId" uuid REFERENCES "ProvincialDirector"(id),
  "qrSettings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "webhookUrl" text,
  "webhookSecret" text,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "MerchantIdentity" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "merchantId" text NOT NULL UNIQUE,
  "clientId" uuid NOT NULL REFERENCES "Store"(id),
  "issuedType" text NOT NULL DEFAULT 'S',
  "registeredAt" timestamptz,
  source text,
  "issuedAt" timestamptz,
  "lockedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "KycVerification" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"(id),
  "storeId" uuid REFERENCES "Store"(id),
  "businessName" text,
  "firstName" text,
  "lastName" text,
  phone text,
  "taxId" text,
  "bankName" text,
  "bankAccountNumber" text,
  "bankAccountName" text,
  "currentAddress" text,
  "businessAddress" text,
  "businessType" text,
  status text NOT NULL DEFAULT 'pending',
  "currentStep" integer NOT NULL DEFAULT 1,
  "applicantType" text,
  "approvalLevel" text NOT NULL DEFAULT 'pending',
  "kycSize" text,
  "agreementAccepted" boolean NOT NULL DEFAULT false,
  "reviewNotes" text,
  "submittedAt" timestamptz,
  "reviewedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Transaction" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  fee numeric(18,2) NOT NULL DEFAULT 0,
  "netAmount" numeric(18,2) NOT NULL DEFAULT 0,
  channel text NOT NULL DEFAULT 'promptpay',
  status text NOT NULL DEFAULT 'pending',
  "storeId" uuid REFERENCES "Store"(id),
  "userId" uuid REFERENCES "User"(id),
  currency text NOT NULL DEFAULT 'THB',
  "kitchenStatus" text,
  origin text,
  "paymentMethod" text,
  "paymentMethodLabel" text,
  "customerName" text,
  "customerPhone" text,
  "tableName" text,
  note text,
  "isSettled" boolean NOT NULL DEFAULT false,
  "paidAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Product" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" uuid REFERENCES "Store"(id),
  name text NOT NULL,
  description text,
  price numeric(18,2) NOT NULL DEFAULT 0,
  cost numeric(18,2) NOT NULL DEFAULT 0,
  stock numeric(18,3) NOT NULL DEFAULT 0,
  category text,
  image text,
  sku text,
  "isActive" boolean NOT NULL DEFAULT true,
  "trackStock" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "CommissionLedger" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sourceType" text,
  "sourceRef" text,
  "beneficiaryType" text,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  "grossAmount" numeric(18,2) NOT NULL DEFAULT 0,
  "ratePercent" numeric(8,4) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  "ruleCode" text,
  "agentId" uuid REFERENCES "Agent"(id),
  "pdId" uuid REFERENCES "ProvincialDirector"(id),
  "storeId" uuid REFERENCES "Store"(id),
  "earnedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "WebhookEventLog" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" uuid REFERENCES "Store"(id),
  "eventType" text NOT NULL,
  status text NOT NULL DEFAULT 'RECEIVED',
  "payloadJson" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merchant_kyc_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" uuid NOT NULL REFERENCES "Store"(id),
  "verificationId" uuid REFERENCES "KycVerification"(id),
  case_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  "assignedAgentId" uuid REFERENCES "Agent"(id),
  "assignedPdId" uuid REFERENCES "ProvincialDirector"(id),
  "submissionVersion" integer NOT NULL DEFAULT 1,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" uuid NOT NULL REFERENCES "Store"(id),
  "sourceRequestId" text NOT NULL,
  "assignmentRequestId" text,
  "idempotencyKey" text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING_ADMIN_ASSIGNMENT',
  "agentPhone" text,
  "agentId" uuid REFERENCES "Agent"(id),
  "pdId" uuid REFERENCES "ProvincialDirector"(id),
  reason text,
  "assignedAt" timestamptz,
  "acceptedAt" timestamptz,
  "rejectedAt" timestamptz,
  "expiresAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE ("storeId", "sourceRequestId"),
  UNIQUE ("storeId", "idempotencyKey")
);

CREATE TABLE IF NOT EXISTS agent_assignment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "assignmentId" uuid NOT NULL REFERENCES agent_assignments(id),
  "eventId" text NOT NULL UNIQUE,
  "eventType" text NOT NULL,
  status text NOT NULL,
  "payloadJson" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "requestId" text,
  "createdAt" timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE agent_assignments
  ADD COLUMN IF NOT EXISTS "lastEventOccurredAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "lastEventId" text;

CREATE TABLE IF NOT EXISTS merchant_profile_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" uuid NOT NULL REFERENCES "Store"(id),
  version integer NOT NULL,
  "sourceRequestId" text NOT NULL,
  "idempotencyKey" text NOT NULL,
  "changedFieldsJson" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "snapshotJson" jsonb NOT NULL,
  "createdBy" text,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE ("storeId", version),
  UNIQUE ("storeId", "idempotencyKey")
);

CREATE TABLE IF NOT EXISTS kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "caseId" uuid NOT NULL REFERENCES merchant_kyc_cases(id),
  "storeId" uuid NOT NULL REFERENCES "Store"(id),
  "documentType" text NOT NULL,
  status text NOT NULL DEFAULT 'not_uploaded',
  "latestVersion" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE ("caseId", "documentType")
);

CREATE TABLE IF NOT EXISTS kyc_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "documentId" uuid NOT NULL REFERENCES kyc_documents(id),
  "caseId" uuid NOT NULL REFERENCES merchant_kyc_cases(id),
  "storeId" uuid NOT NULL REFERENCES "Store"(id),
  version integer NOT NULL,
  "fileName" text NOT NULL,
  "mimeType" text NOT NULL,
  "fileSize" bigint NOT NULL,
  "checksumSha256" text NOT NULL,
  "storageLocator" text NOT NULL,
  status text NOT NULL DEFAULT 'uploaded',
  "submittedBy" text,
  reason text,
  "reviewNotes" text,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE ("documentId", version),
  UNIQUE ("documentId", "checksumSha256")
);

CREATE TABLE IF NOT EXISTS kyc_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "caseId" uuid NOT NULL REFERENCES merchant_kyc_cases(id),
  "senderId" text NOT NULL,
  "senderRole" text NOT NULL,
  "recipientId" text,
  message text,
  "attachmentMetadataJson" jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  "readAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_review_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "caseId" uuid NOT NULL REFERENCES merchant_kyc_cases(id),
  code text NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  "reviewerId" text,
  note text,
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE ("caseId", code)
);

CREATE TABLE IF NOT EXISTS kyc_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "caseId" uuid NOT NULL REFERENCES merchant_kyc_cases(id),
  "decisionType" text NOT NULL,
  decision text NOT NULL,
  "actorId" text NOT NULL,
  reason text,
  "createdAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "caseId" uuid NOT NULL REFERENCES merchant_kyc_cases(id),
  code text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "resolvedAt" timestamptz
);

CREATE TABLE IF NOT EXISTS consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "caseId" uuid REFERENCES merchant_kyc_cases(id),
  "storeId" uuid REFERENCES "Store"(id),
  "policyCode" text NOT NULL,
  "policyVersion" text NOT NULL,
  accepted boolean NOT NULL,
  "actorId" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipientId" text NOT NULL,
  "caseId" uuid REFERENCES merchant_kyc_cases(id),
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  "readAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorId" text,
  "actorRole" text,
  action text NOT NULL,
  "targetType" text NOT NULL,
  "targetId" text NOT NULL,
  reason text,
  "beforeJson" jsonb,
  "afterJson" jsonb,
  "requestId" text,
  "createdAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" uuid REFERENCES "Store"(id),
  "scope" text NOT NULL,
  "idempotencyKey" text NOT NULL,
  "bodyDigest" text NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  "responseStatus" integer,
  "responseJson" jsonb,
  status text NOT NULL DEFAULT 'IN_PROGRESS',
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  "expiresAt" timestamptz,
  UNIQUE ("scope", "idempotencyKey")
);

CREATE TABLE IF NOT EXISTS integration_nonce_replays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "apiKeyId" text NOT NULL,
  nonce text NOT NULL,
  "requestId" text,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "expiresAt" timestamptz NOT NULL,
  UNIQUE ("apiKeyId", nonce)
);

CREATE TABLE IF NOT EXISTS integration_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  "eventId" text NOT NULL,
  "eventType" text,
  "bodyDigest" text NOT NULL,
  status text NOT NULL DEFAULT 'RECEIVED',
  "payloadJson" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "receivedAt" timestamptz NOT NULL DEFAULT NOW(),
  "processedAt" timestamptz,
  "errorCode" text,
  UNIQUE (provider, "eventId")
);

CREATE INDEX IF NOT EXISTS idx_kyc_cases_store_status
  ON merchant_kyc_cases ("storeId", status);
CREATE INDEX IF NOT EXISTS idx_assignment_store_status
  ON agent_assignments ("storeId", status);
CREATE INDEX IF NOT EXISTS idx_assignment_events_assignment_created
  ON agent_assignment_events ("assignmentId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_profile_versions_store_version
  ON merchant_profile_versions ("storeId", version DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_document_versions_case_created
  ON kyc_document_versions ("caseId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_created
  ON audit_logs ("targetType", "targetId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_integration_idempotency_expires
  ON integration_idempotency_keys ("expiresAt");
CREATE INDEX IF NOT EXISTS idx_integration_nonce_expires
  ON integration_nonce_replays ("expiresAt");
CREATE INDEX IF NOT EXISTS idx_integration_webhook_status
  ON integration_webhook_events (status, "receivedAt");
CREATE INDEX IF NOT EXISTS idx_webhook_event_log_created
  ON "WebhookEventLog" ("createdAt" DESC);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version)
VALUES ('001_initial_chatpos_schema')
ON CONFLICT (version) DO NOTHING;

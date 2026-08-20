CREATE TABLE IF NOT EXISTS kyc_otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "caseId" uuid NOT NULL REFERENCES merchant_kyc_cases(id),
  "storeId" uuid NOT NULL REFERENCES "Store"(id),
  phone text NOT NULL,
  provider text NOT NULL DEFAULT 'smsup_plus',
  "providerOtpId" text,
  status text NOT NULL DEFAULT 'REQUESTING',
  attempts integer NOT NULL DEFAULT 0,
  "maxAttempts" integer NOT NULL DEFAULT 5,
  "expiresAt" timestamptz NOT NULL,
  "resendAvailableAt" timestamptz NOT NULL,
  "lockedAt" timestamptz,
  "verifiedAt" timestamptz,
  "lastErrorCode" text,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_otp_challenges_case_created
  ON kyc_otp_challenges ("caseId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_kyc_otp_challenges_active
  ON kyc_otp_challenges ("caseId", status, "expiresAt");
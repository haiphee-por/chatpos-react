CREATE TABLE IF NOT EXISTS backoffice_store_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" uuid NOT NULL REFERENCES "Store"(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'production',
  "backofficeBaseUrl" text NOT NULL,
  "backofficeStoreId" text,
  "keyId" text NOT NULL,
  "bearerSecretRef" text NOT NULL,
  "signingSecretRef" text NOT NULL,
  "signingSecretPreviousRef" text,
  "callbackSecretRef" text NOT NULL,
  "callbackSecretPreviousRef" text,
  status text NOT NULL DEFAULT 'ACTIVE',
  "validFrom" timestamptz,
  "expiresAt" timestamptz,
  "rotatedAt" timestamptz,
  "metadataJson" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE ("storeId", environment),
  UNIQUE (environment, "backofficeStoreId", "keyId")
);

CREATE INDEX IF NOT EXISTS idx_backoffice_store_credentials_lookup
  ON backoffice_store_credentials ("storeId", environment, status);

CREATE INDEX IF NOT EXISTS idx_backoffice_store_credentials_expiry
  ON backoffice_store_credentials (environment, status, "expiresAt");

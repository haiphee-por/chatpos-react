ALTER TABLE backoffice_store_credentials
  ADD COLUMN IF NOT EXISTS "callbackSecretEncrypted" text;
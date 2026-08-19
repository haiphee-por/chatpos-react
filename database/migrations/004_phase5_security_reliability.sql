CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tokenHash" text NOT NULL UNIQUE,
  "userId" uuid NOT NULL,
  role text NOT NULL,
  "storeId" uuid REFERENCES "Store"(id),
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "lastSeenAt" timestamptz NOT NULL DEFAULT NOW(),
  "expiresAt" timestamptz NOT NULL,
  "revokedAt" timestamptz,
  "ipHash" text,
  "userAgentHash" text
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_active
  ON auth_sessions ("userId", "expiresAt")
  WHERE "revokedAt" IS NULL;

CREATE TABLE IF NOT EXISTS security_rate_limit_buckets (
  "bucketKey" text PRIMARY KEY,
  "windowStart" timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE commission_settlement_events
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "nextAttemptAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "deadLetteredAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "lockedAt" timestamptz;

CREATE INDEX IF NOT EXISTS idx_settlement_events_retry
  ON commission_settlement_events (status, "nextAttemptAt", "createdAt");

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created
  ON audit_logs ("actorId", "createdAt" DESC);

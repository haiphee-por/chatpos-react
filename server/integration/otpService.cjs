const crypto = require('crypto');

const DEFAULT_TTL_SECONDS = 300;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;
const DEFAULT_LOCK_SECONDS = 900;

class OtpError extends Error {
  constructor(message, code, statusCode = 400, details = {}) {
    super(message);
    this.name = 'OtpError';
    this.code = code;
    this.statusCode = statusCode;
    Object.assign(this, details);
  }
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function loadOtpConfig(env = process.env) {
  return {
    enabled: parseBoolean(env.SMS_OTP_ENABLED, false),
    providerReady: parseBoolean(env.SMS_OTP_PROVIDER_READY, false),
    provider: String(env.SMS_PROVIDER || 'smsup_plus'),
    systemId: String(env.SMS_OTP_SYSTEM_ID || ''),
    ttlSeconds: parsePositiveInteger(env.KYC_OTP_TTL_SECONDS, DEFAULT_TTL_SECONDS),
    maxAttempts: parsePositiveInteger(env.KYC_OTP_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS),
    resendCooldownSeconds: parsePositiveInteger(env.KYC_OTP_RESEND_COOLDOWN_SECONDS, DEFAULT_RESEND_COOLDOWN_SECONDS),
    lockSeconds: parsePositiveInteger(env.KYC_OTP_LOCK_SECONDS, DEFAULT_LOCK_SECONDS),
  };
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  if (/^66[0-9]{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^0[0-9]{9}$/.test(digits)) return digits;
  throw new OtpError('A verified Thai mobile phone is required', 'OTP_PHONE_INVALID', 422);
}

function providerNotReady() {
  throw new OtpError('SMS OTP provider adapter is not ready', 'NOT_READY', 503);
}

function createProvider(overrides = {}) {
  return {
    request: overrides.request || providerNotReady,
    verify: overrides.verify || providerNotReady,
  };
}

function publicChallenge(row) {
  return {
    id: row.id,
    caseId: row.caseId,
    status: row.status,
    expiresAt: row.expiresAt,
    resendAvailableAt: row.resendAvailableAt,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
  };
}

async function getStorePhone(pool, storeId) {
  const result = await pool.query('SELECT phone FROM "Store" WHERE id = $1', [storeId]);
  if (result.rowCount === 0) throw new OtpError('Store was not found', 'STORE_NOT_FOUND', 404);
  return normalizePhone(result.rows[0].phone);
}

function assertProviderReady(config) {
  if (!config.enabled || !config.providerReady) {
    throw new OtpError('SMS OTP is not ready', 'NOT_READY', 503);
  }
}

async function requestKycOtp({ pool, caseId, storeId, body = {}, config = loadOtpConfig(), provider = createProvider(), requestId }) {
  assertProviderReady(config);
  const phone = await getStorePhone(pool, storeId);
  if (body.phone && normalizePhone(body.phone) !== phone) {
    throw new OtpError('OTP phone must match the verified Store phone', 'OTP_PHONE_MISMATCH', 422);
  }

  const now = new Date();
  const challengeId = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + config.ttlSeconds * 1000);
  const resendAvailableAt = new Date(now.getTime() + config.resendCooldownSeconds * 1000);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const latest = await client.query(
      `SELECT * FROM kyc_otp_challenges
       WHERE "caseId" = $1 AND "storeId" = $2
       ORDER BY "createdAt" DESC LIMIT 1 FOR UPDATE`,
      [caseId, storeId]
    );
    const existing = latest.rows[0];
    if (existing?.status === 'LOCKED' && existing.lockedAt) {
      const lockExpiresAt = new Date(existing.lockedAt).getTime() + config.lockSeconds * 1000;
      if (lockExpiresAt > now.getTime()) {
        throw new OtpError('OTP challenge is locked', 'OTP_LOCKED', 423, {
          retryAfterSeconds: Math.ceil((lockExpiresAt - now.getTime()) / 1000),
        });
      }
    }
    if (existing?.status === 'REQUESTING' || existing?.status === 'PENDING') {
      if (new Date(existing.expiresAt).getTime() <= now.getTime()) {
        await client.query(
          `UPDATE kyc_otp_challenges SET status = 'EXPIRED', "updatedAt" = NOW()
           WHERE id = $1 AND status IN ('REQUESTING', 'PENDING')`,
          [existing.id]
        );
      } else if (new Date(existing.resendAvailableAt).getTime() > now.getTime()) {
        throw new OtpError('OTP resend cooldown is active', 'OTP_RESEND_COOLDOWN', 429, {
          retryAfterSeconds: Math.ceil((new Date(existing.resendAvailableAt).getTime() - now.getTime()) / 1000),
        });
      }
    }
    await client.query(
      `INSERT INTO kyc_otp_challenges
        (id, "caseId", "storeId", phone, provider, status, "maxAttempts", "expiresAt", "resendAvailableAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'REQUESTING', $6, $7, $8, NOW(), NOW())`,
      [challengeId, caseId, storeId, phone, config.provider, config.maxAttempts, expiresAt.toISOString(), resendAvailableAt.toISOString()]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  try {
    const result = await provider.request({ challengeId, caseId, storeId, phone, systemId: config.systemId, requestId });
    if (!result?.providerOtpId) throw new OtpError('SMS OTP provider did not return an OTP reference', 'OTP_PROVIDER_RESPONSE_INVALID', 502);
    const providerExpiresAt = result.expiresAt ? new Date(result.expiresAt) : expiresAt;
    const updated = await pool.query(
      `UPDATE kyc_otp_challenges
       SET status = 'PENDING', "providerOtpId" = $1, "expiresAt" = $2, "updatedAt" = NOW()
       WHERE id = $3 RETURNING *`,
      [String(result.providerOtpId), Number.isNaN(providerExpiresAt.getTime()) ? expiresAt.toISOString() : providerExpiresAt.toISOString(), challengeId]
    );
    return { challenge: publicChallenge(updated.rows[0]) };
  } catch (error) {
    await pool.query(
      `UPDATE kyc_otp_challenges SET status = 'FAILED', "lastErrorCode" = $1, "updatedAt" = NOW() WHERE id = $2`,
      [error.code || 'OTP_PROVIDER_REQUEST_FAILED', challengeId]
    ).catch(() => {});
    throw error;
  }
}

async function verifyKycOtp({ pool, caseId, storeId, otp, config = loadOtpConfig(), provider = createProvider(), requestId }) {
  assertProviderReady(config);
  const code = String(otp || '').trim();
  if (!/^\d{4,10}$/.test(code)) throw new OtpError('OTP code is invalid', 'OTP_FORMAT_INVALID', 422);

  const client = await pool.connect();
  let challenge;
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT * FROM kyc_otp_challenges
       WHERE "caseId" = $1 AND "storeId" = $2
       ORDER BY "createdAt" DESC LIMIT 1 FOR UPDATE`,
      [caseId, storeId]
    );
    challenge = result.rows[0];
    if (!challenge) throw new OtpError('OTP challenge was not found', 'OTP_CHALLENGE_NOT_FOUND', 404);
    if (challenge.status === 'VERIFIED') {
      await client.query('COMMIT');
      return { verified: true, challenge: publicChallenge(challenge) };
    }
    if (challenge.status === 'LOCKED' || Number(challenge.attempts) >= Number(challenge.maxAttempts)) {
      throw new OtpError('OTP challenge is locked', 'OTP_LOCKED', 423, { retryAfterSeconds: config.lockSeconds });
    }
    if (challenge.status !== 'PENDING' || !challenge.providerOtpId) {
      throw new OtpError('OTP challenge is not ready', 'OTP_NOT_PENDING', 409);
    }
    if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
      await client.query(`UPDATE kyc_otp_challenges SET status = 'EXPIRED', "updatedAt" = NOW() WHERE id = $1`, [challenge.id]);
      throw new OtpError('OTP challenge has expired', 'OTP_EXPIRED', 410);
    }
    const attemptResult = await client.query(
      `UPDATE kyc_otp_challenges SET attempts = attempts + 1, "updatedAt" = NOW()
       WHERE id = $1 RETURNING *`,
      [challenge.id]
    );
    challenge = attemptResult.rows[0];
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  let providerResult;
  try {
    providerResult = await provider.verify({ providerOtpId: challenge.providerOtpId, otp: code, caseId, storeId, requestId });
  } catch (error) {
    await pool.query(
      `UPDATE kyc_otp_challenges SET "lastErrorCode" = $1, "updatedAt" = NOW() WHERE id = $2`,
      [error.code || 'OTP_PROVIDER_VERIFY_FAILED', challenge.id]
    ).catch(() => {});
    throw error;
  }

  if (providerResult?.verified) {
    const result = await pool.query(
      `UPDATE kyc_otp_challenges SET status = 'VERIFIED', "verifiedAt" = NOW(), "updatedAt" = NOW()
       WHERE id = $1 RETURNING *`,
      [challenge.id]
    );
    return { verified: true, challenge: publicChallenge(result.rows[0]) };
  }

  if (Number(challenge.attempts) >= Number(challenge.maxAttempts)) {
    const result = await pool.query(
      `UPDATE kyc_otp_challenges SET status = 'LOCKED', "lockedAt" = NOW(), "updatedAt" = NOW()
       WHERE id = $1 RETURNING *`,
      [challenge.id]
    );
    throw new OtpError('OTP challenge is locked after too many attempts', 'OTP_LOCKED', 423, { challenge: publicChallenge(result.rows[0]) });
  }
  throw new OtpError('OTP code is incorrect', 'OTP_INVALID', 401, { attemptsRemaining: Number(challenge.maxAttempts) - Number(challenge.attempts) });
}

module.exports = {
  OtpError,
  createProvider,
  loadOtpConfig,
  requestKycOtp,
  verifyKycOtp,
};
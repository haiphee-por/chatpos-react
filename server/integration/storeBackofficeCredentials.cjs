const crypto = require('crypto');
const fs = require('fs');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class StoreCredentialError extends Error {
  constructor(message, code, statusCode = 503, details = {}) {
    super(message);
    this.name = 'StoreCredentialError';
    this.code = code;
    this.statusCode = statusCode;
    Object.assign(this, details);
  }
}

function isUuid(value) {
  return UUID_PATTERN.test(String(value || ''));
}

function normalizeReference(value, fieldName) {
  const reference = String(value || '').trim();
  if (!reference) {
    throw new StoreCredentialError(`${fieldName} is not configured`, 'STORE_CREDENTIAL_REFERENCE_MISSING');
  }
  return reference;
}

function resolveEnvironmentSecret(reference, env = process.env) {
  const normalized = normalizeReference(reference, 'Secret reference');
  if (normalized.startsWith('file:')) {
    const filePath = normalized.slice(5).trim();
    try {
      const value = fs.readFileSync(filePath, 'utf8').trim();
      if (!value) throw new Error('empty secret');
      return value;
    } catch {
      throw new StoreCredentialError('Managed secret file could not be read', 'SECRET_VALUE_MISSING');
    }
  }
  if (!normalized.startsWith('env:')) {
    throw new StoreCredentialError('No managed secret resolver is configured', 'SECRET_RESOLVER_UNAVAILABLE');
  }
  const envName = normalized.slice(4).trim();
  const value = String(env[envName] || '').trim();
  if (!value) {
    throw new StoreCredentialError('Secret value is missing', 'SECRET_VALUE_MISSING');
  }
  return value;
}

function createStoreCredentialResolver({ pool, fallbackConfig = {}, environment, secretResolver, env = process.env } = {}) {
  if (!pool || typeof pool.query !== 'function') {
    throw new TypeError('A PostgreSQL pool is required');
  }
  const targetEnvironment = String(environment || env.CHATPOS_ENVIRONMENT || env.NODE_ENV || 'development').trim();
  const resolveSecret = secretResolver || ((reference) => resolveEnvironmentSecret(reference, env));

  async function getCredentialRow(storeId) {
    if (!isUuid(storeId)) {
      throw new StoreCredentialError('A valid ChatPOS Store ID is required', 'STORE_CREDENTIAL_STORE_ID_INVALID', 422);
    }
    const result = await pool.query(
      `SELECT "storeId", environment, "backofficeBaseUrl", "backofficeStoreId", "keyId",
              "bearerSecretRef", "signingSecretRef", "signingSecretPreviousRef",
              "callbackSecretRef", "callbackSecretPreviousRef", status, "validFrom", "expiresAt"
       FROM backoffice_store_credentials
       WHERE "storeId" = $1 AND environment = $2
         AND status = 'ACTIVE'
         AND ("validFrom" IS NULL OR "validFrom" <= NOW())
         AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
       ORDER BY "updatedAt" DESC
       LIMIT 1`,
      [storeId, targetEnvironment]
    );
    return result.rows[0] || null;
  }

  async function resolve(storeId) {
    const row = await getCredentialRow(storeId);
    if (!row) {
      throw new StoreCredentialError(
        `No active Backoffice credential mapping exists for Store ${storeId} in ${targetEnvironment}`,
        'STORE_CREDENTIAL_MAPPING_MISSING',
        503,
        { storeId, environment: targetEnvironment }
      );
    }

    const bearerSecret = fallbackConfig.bearerSecret || await resolveSecret(normalizeReference(row.bearerSecretRef, 'Bearer secret reference'), {
      storeId,
      keyId: row.keyId,
      environment: targetEnvironment,
      type: 'bearer',
    });
    const signingSecret = fallbackConfig.signingSecret || await resolveSecret(normalizeReference(row.signingSecretRef, 'Signing secret reference'), {
      storeId,
      keyId: row.keyId,
      environment: targetEnvironment,
      type: 'signing',
    });
    const signingSecretPrevious = fallbackConfig.signingSecrets?.[1] || (row.signingSecretPreviousRef
      ? await resolveSecret(row.signingSecretPreviousRef, { storeId, keyId: row.keyId, environment: targetEnvironment, type: 'signing-previous' })
      : '');
    const callbackSecret = await resolveSecret(normalizeReference(row.callbackSecretRef, 'Callback secret reference'), {
      storeId,
      keyId: row.keyId,
      environment: targetEnvironment,
      type: 'callback',
    });
    const callbackSecretPrevious = row.callbackSecretPreviousRef
      ? await resolveSecret(row.callbackSecretPreviousRef, { storeId, keyId: row.keyId, environment: targetEnvironment, type: 'callback-previous' })
      : '';

    return {
      ...fallbackConfig,
      baseUrl: row.backofficeBaseUrl,
      storeId: row.backofficeStoreId,
      keyId: row.keyId,
      bearerSecret: String(bearerSecret || ''),
      signingSecret: String(signingSecret || ''),
      signingSecrets: [signingSecret, signingSecretPrevious].filter(Boolean),
      callbackSecret: String(callbackSecret || ''),
      callbackSecrets: [callbackSecret, callbackSecretPrevious].filter(Boolean),
      credentialSource: 'database-secret-reference',
      chatposStoreId: row.storeId,
      environment: row.environment,
    };
  }

  async function resolveCallbackSecrets(storeId) {
    const credential = await resolve(storeId);
    return credential.callbackSecrets?.length ? credential.callbackSecrets : [credential.callbackSecret].filter(Boolean);
  }

  return { environment: targetEnvironment, resolve, resolveCallbackSecrets };
}

function createSecretReference(value) {
  const reference = String(value || '').trim();
  if (!reference) throw new StoreCredentialError('Secret reference is required', 'STORE_CREDENTIAL_REFERENCE_MISSING', 422);
  return reference;
}

function hashSecretReference(reference) {
  return crypto.createHash('sha256').update(createSecretReference(reference), 'utf8').digest('hex');
}

module.exports = {
  StoreCredentialError,
  createSecretReference,
  createStoreCredentialResolver,
  hashSecretReference,
  resolveEnvironmentSecret,
};

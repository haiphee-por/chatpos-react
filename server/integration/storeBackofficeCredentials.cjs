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

function encryptCallbackSecret(secret, encryptionKey) {
  const key = crypto.createHash('sha256').update(String(encryptionKey || ''), 'utf8').digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`;
}

function decryptCallbackSecret(encryptedSecret, encryptionKey) {
  const [version, encodedIv, encodedTag, encodedCiphertext] = String(encryptedSecret || '').split(':');
  if (version !== 'v1' || !encodedIv || !encodedTag || !encodedCiphertext) {
    throw new StoreCredentialError('Encrypted callback secret is invalid', 'SECRET_VALUE_INVALID');
  }
  try {
    const key = crypto.createHash('sha256').update(String(encryptionKey || ''), 'utf8').digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(encodedIv, 'base64url'));
    decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new StoreCredentialError('Encrypted callback secret could not be decrypted', 'SECRET_VALUE_INVALID');
  }
}

function createStoreCredentialResolver({ pool, fallbackConfig = {}, environment, secretResolver, env = process.env, callbackSecretEncryptionKey } = {}) {
  if (!pool || typeof pool.query !== 'function') {
    throw new TypeError('A PostgreSQL pool is required');
  }
  const targetEnvironment = String(environment || env.CHATPOS_ENVIRONMENT || env.NODE_ENV || 'development').trim();
  const resolveSecret = secretResolver || ((reference) => resolveEnvironmentSecret(reference, env));
  const encryptionKey = callbackSecretEncryptionKey || env.CHATPOS_CALLBACK_SECRET_ENCRYPTION_KEY || env.SESSION_SECRET;

  async function getCredentialRow(storeId) {
    if (!isUuid(storeId)) {
      throw new StoreCredentialError('A valid ChatPOS Store ID is required', 'STORE_CREDENTIAL_STORE_ID_INVALID', 422);
    }
    const result = await pool.query(
      `SELECT "storeId", environment, "backofficeBaseUrl", "backofficeStoreId", "keyId",
              "bearerSecretRef", "signingSecretRef", "signingSecretPreviousRef",
              "callbackSecretRef", "callbackSecretPreviousRef", "callbackSecretEncrypted",
              status, "validFrom", "expiresAt"
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

  async function getCallbackCredentialRow(storeReference) {
    const reference = String(storeReference || '').trim();
    if (!reference || reference.length > 200) {
      throw new StoreCredentialError('A valid callback Store reference is required', 'STORE_CREDENTIAL_STORE_ID_INVALID', 422);
    }
    const result = await pool.query(
      `SELECT "storeId", environment, "backofficeBaseUrl", "backofficeStoreId", "keyId",
              "bearerSecretRef", "signingSecretRef", "signingSecretPreviousRef",
              "callbackSecretRef", "callbackSecretPreviousRef", "callbackSecretEncrypted",
              status, "validFrom", "expiresAt"
       FROM backoffice_store_credentials
       WHERE environment = $1
         AND status = 'ACTIVE'
         AND ("validFrom" IS NULL OR "validFrom" <= NOW())
         AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
         AND ("backofficeStoreId" = $2 OR "storeId"::text = $2)
       ORDER BY CASE WHEN "backofficeStoreId" = $2 THEN 0 ELSE 1 END, "updatedAt" DESC
       LIMIT 1`,
      [targetEnvironment, reference]
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
    return {
      ...fallbackConfig,
      baseUrl: row.backofficeBaseUrl,
      storeId: row.backofficeStoreId,
      keyId: row.keyId,
      bearerSecret: String(bearerSecret || ''),
      signingSecret: String(signingSecret || ''),
      signingSecrets: [signingSecret, signingSecretPrevious].filter(Boolean),
      callbackSecret: '',
      callbackSecrets: [],
      credentialSource: 'database-secret-reference',
      chatposStoreId: row.storeId,
      environment: row.environment,
    };
  }

  function callbackSecretsFromRow(row) {
    const callbackSecret = row.callbackSecretRef === 'db:encrypted'
      ? decryptCallbackSecret(row.callbackSecretEncrypted, encryptionKey)
      : resolveSecret(normalizeReference(row.callbackSecretRef, 'Callback secret reference'), {
        storeId: row.storeId,
        keyId: row.keyId,
        environment: targetEnvironment,
        type: 'callback',
      });
    return Promise.resolve(callbackSecret).then(async (secret) => {
      const callbackSecretPrevious = row.callbackSecretPreviousRef
        ? (row.callbackSecretPreviousRef === 'db:encrypted'
          ? decryptCallbackSecret(row.callbackSecretEncrypted, encryptionKey)
          : await resolveSecret(row.callbackSecretPreviousRef, { storeId: row.storeId, keyId: row.keyId, environment: targetEnvironment, type: 'callback-previous' }))
        : '';
      return [secret, callbackSecretPrevious].filter(Boolean);
    });
  }

  async function resolveCallbackContext(storeReference) {
    const row = await getCallbackCredentialRow(storeReference);
    if (!row) {
      throw new StoreCredentialError(
        `No active Backoffice credential mapping exists for Store ${storeReference} in ${targetEnvironment}`,
        'STORE_CREDENTIAL_MAPPING_MISSING',
        503,
        { storeId: storeReference, environment: targetEnvironment }
      );
    }
    return {
      storeId: row.storeId,
      backofficeStoreId: row.backofficeStoreId,
      secrets: await callbackSecretsFromRow(row),
    };
  }

  async function resolveCallbackSecrets(storeId) {
    const context = await resolveCallbackContext(storeId);
    return context.secrets;
  }

  async function saveCallbackSecret(storeId, callbackSecret) {
    if (!isUuid(storeId)) {
      throw new StoreCredentialError('A valid ChatPOS Store ID is required', 'STORE_CREDENTIAL_STORE_ID_INVALID', 422);
    }
    if (!String(callbackSecret || '').trim()) {
      throw new StoreCredentialError('Callback secret is empty', 'CALLBACK_SECRET_MISSING', 503);
    }
    if (!encryptionKey) {
      throw new StoreCredentialError('Callback secret encryption key is not configured', 'CALLBACK_SECRET_STORAGE_NOT_CONFIGURED', 503);
    }
    const encryptedSecret = encryptCallbackSecret(callbackSecret, encryptionKey);
    const result = await pool.query(
      `UPDATE backoffice_store_credentials
       SET "callbackSecretRef" = 'db:encrypted', "callbackSecretEncrypted" = $1, "updatedAt" = NOW()
       WHERE "storeId" = $2 AND environment = $3 AND status = 'ACTIVE'
       RETURNING "storeId"`,
      [encryptedSecret, storeId, targetEnvironment]
    );
    if (result.rowCount === 0) {
      throw new StoreCredentialError('Active Backoffice credential mapping was not found', 'STORE_CREDENTIAL_MAPPING_MISSING', 503);
    }
    return { storeId, environment: targetEnvironment };
  }

  return { environment: targetEnvironment, resolve, resolveCallbackContext, resolveCallbackSecrets, saveCallbackSecret };
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
  decryptCallbackSecret,
  encryptCallbackSecret,
  hashSecretReference,
  resolveEnvironmentSecret,
};

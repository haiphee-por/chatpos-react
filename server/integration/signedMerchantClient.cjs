const crypto = require('crypto');

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 250;
const DEFAULT_MAX_RETRY_DELAY_MS = 30000;
const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 300;
const DEFAULT_DOCUMENT_LINK_TTL_SECONDS = 86400;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
]);

class IntegrationError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'IntegrationError';
    this.code = code;
    Object.assign(this, details);
  }
}

class RequestTimeoutError extends IntegrationError {
  constructor(timeoutMs) {
    super(`Backoffice request timed out after ${timeoutMs}ms`, 'REQUEST_TIMEOUT', { timeoutMs });
    this.name = 'RequestTimeoutError';
    this.retryable = true;
  }
}

class NonceReplayError extends IntegrationError {
  constructor(nonce) {
    super('Request nonce has already been used', 'REPLAYED', { nonce });
    this.name = 'NonceReplayError';
  }
}

class IdempotencyConflictError extends IntegrationError {
  constructor(idempotencyKey) {
    super('Idempotency key was used with a different payload', 'IDEMPOTENCY_CONFLICT', { idempotencyKey });
    this.name = 'IdempotencyConflictError';
  }
}

class IntegrationDisabledError extends IntegrationError {
  constructor() {
    super('Backoffice integration is disabled', 'INTEGRATION_DISABLED');
    this.name = 'IntegrationDisabledError';
  }
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function loadBackofficeConfig(env = process.env) {
  const secretCandidates = (...keys) => keys.flatMap((key) => [env[key]])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return {
    credentialEnvironment: String(env.AGENT_PD_CREDENTIAL_ENVIRONMENT || env.CHATPOS_ENVIRONMENT || env.NODE_ENV || 'development'),
    keyIdHeaderName: String(env.AGENT_PD_KEY_ID_HEADER || 'X-ChatPOS-Key-Id'),
    bearerSecret: String(env.CHATPOS_BACKOFFICE_BEARER_SECRET || env.AGENT_PD_BEARER_SECRET || ''),
    signingSecret: String(env.CHATPOS_BACKOFFICE_SIGNING_SECRET || env.AGENT_PD_SIGNING_SECRET || ''),
    signingSecrets: secretCandidates('CHATPOS_BACKOFFICE_SIGNING_SECRET', 'CHATPOS_BACKOFFICE_SIGNING_SECRET_PREVIOUS', 'AGENT_PD_SIGNING_SECRET', 'AGENT_PD_SIGNING_SECRET_PREVIOUS'),
    callbackSecret: String(env.CHATPOS_BACKOFFICE_CALLBACK_SECRET || env.AGENT_PD_CALLBACK_SECRET || ''),
    callbackSecrets: secretCandidates('CHATPOS_BACKOFFICE_CALLBACK_SECRET', 'CHATPOS_BACKOFFICE_CALLBACK_SECRET_PREVIOUS', 'AGENT_PD_CALLBACK_SECRET', 'AGENT_PD_CALLBACK_SECRET_PREVIOUS'),
    enabled: parseBoolean(env.AGENT_PD_INTEGRATION_ENABLED, false),
    assignmentEnabled: parseBoolean(env.AGENT_PD_ASSIGNMENT_ENABLED, false),
    profileUpdateEnabled: parseBoolean(env.MERCHANT_PROFILE_UPDATE_ENABLED, false),
    kycDocumentEnabled: parseBoolean(env.KYC_DOCUMENT_INTAKE_ENABLED, false),
    documentLinkTtlSeconds: parsePositiveInteger(env.KYC_DOCUMENT_LINK_TTL_SECONDS, DEFAULT_DOCUMENT_LINK_TTL_SECONDS),
    transactionRoutingEnabled: parseBoolean(env.TRANSACTION_ROUTING_ENABLED, false),
    transactionQueryRoutingEnabled: parseBoolean(env.TRANSACTION_QUERY_ROUTING_ENABLED, false),
    transactionCommandPath: String(env.AGENT_PD_TRANSACTION_COMMAND_PATH || '/api/v1/transactions'),
    transactionQueryPath: String(env.AGENT_PD_TRANSACTION_QUERY_PATH || '/api/v1/transactions/{id}/payment'),
    llgwPaymentWebhookEnabled: parseBoolean(env.LLGW_PAYMENT_WEBHOOK_ENABLED, false),
    llgwPaymentWebhookSecret: String(env.LLGW_PAYMENT_WEBHOOK_SECRET || ''),
    llgwPaymentWebhookSecrets: secretCandidates('LLGW_PAYMENT_WEBHOOK_SECRET', 'LLGW_PAYMENT_WEBHOOK_SECRET_PREVIOUS'),
    paymentStatusWebhookSecret: String(env.PAYMENT_STATUS_WEBHOOK_SECRET || ''),
    paymentStatusWebhookSecrets: secretCandidates('PAYMENT_STATUS_WEBHOOK_SECRET', 'PAYMENT_STATUS_WEBHOOK_SECRET_PREVIOUS'),
    paymentStatusWebhookEnabled: parseBoolean(env.PAYMENT_STATUS_WEBHOOK_ENABLED, false),
    paymentStatusTimestampToleranceSeconds: parsePositiveInteger(
      env.PAYMENT_STATUS_TIMESTAMP_TOLERANCE_SECONDS,
      DEFAULT_TIMESTAMP_TOLERANCE_SECONDS
    ),
    llgwTimestampToleranceSeconds: parsePositiveInteger(
      env.LLGW_PAYMENT_TIMESTAMP_TOLERANCE_SECONDS,
      DEFAULT_TIMESTAMP_TOLERANCE_SECONDS
    ),
    commissionEventEnabled: parseBoolean(env.COMMISSION_EVENT_INGEST_ENABLED, false),
    commissionEventSourceUrl: String(env.COMMISSION_EVENT_SOURCE_URL || ''),
    commissionWebhookSecret: String(env.COMMISSION_EVENT_WEBHOOK_SECRET || ''),
    commissionGrossBenefitField: String(env.COMMISSION_PD_GROSS_BENEFIT_FIELD || ''),
    timeoutMs: parsePositiveInteger(env.AGENT_PD_REQUEST_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    maxRetries: Number.isInteger(Number(env.AGENT_PD_MAX_RETRIES)) && Number(env.AGENT_PD_MAX_RETRIES) >= 0
      ? Number(env.AGENT_PD_MAX_RETRIES)
      : DEFAULT_MAX_RETRIES,
    retryBaseDelayMs: parsePositiveInteger(env.AGENT_PD_RETRY_BASE_DELAY_MS, DEFAULT_RETRY_BASE_DELAY_MS),
    maxRetryDelayMs: parsePositiveInteger(env.AGENT_PD_MAX_RETRY_DELAY_MS, DEFAULT_MAX_RETRY_DELAY_MS),
    timestampToleranceSeconds: parsePositiveInteger(
      env.AGENT_PD_TIMESTAMP_TOLERANCE_SECONDS,
      DEFAULT_TIMESTAMP_TOLERANCE_SECONDS
    ),
  };
}

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function canonicalPath(input) {
  const url = input instanceof URL ? input : new URL(String(input), 'http://localhost');
  const entries = [...url.searchParams.entries()].sort(
    ([leftKey, leftValue], [rightKey, rightValue]) =>
      compareStrings(leftKey, rightKey) || compareStrings(leftValue, rightValue)
  );
  const query = new URLSearchParams(entries).toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}

function serializeBody(body) {
  if (body === undefined || body === null) return '';
  if (typeof body === 'string') return body;
  const serialized = JSON.stringify(body);
  if (serialized === undefined) {
    throw new IntegrationError('Request body could not be serialized as JSON', 'INVALID_BODY');
  }
  return serialized;
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function buildCanonicalRequest({ method, url, timestamp, nonce, idempotencyKey = '', rawBody = '' }) {
  return [
    String(method).toUpperCase(),
    canonicalPath(url),
    String(timestamp),
    String(nonce),
    String(idempotencyKey || ''),
    sha256Hex(rawBody),
  ].join('\n');
}

function createSignature(canonicalRequest, signingSecret) {
  return `v1=${crypto.createHmac('sha256', signingSecret).update(canonicalRequest, 'utf8').digest('hex')}`;
}

function createNonce() {
  return crypto.randomBytes(18).toString('base64url');
}

function createRequestId() {
  return crypto.randomUUID();
}

function validateNonce(nonce) {
  if (!NONCE_PATTERN.test(String(nonce || ''))) {
    throw new IntegrationError('Nonce must contain 16-128 URL-safe characters', 'INVALID_NONCE');
  }
  return true;
}

function validateTimestamp(timestamp, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = DEFAULT_TIMESTAMP_TOLERANCE_SECONDS) {
  const parsed = Number(timestamp);
  if (!Number.isInteger(parsed) || Math.abs(nowSeconds - parsed) > toleranceSeconds) {
    throw new IntegrationError('Request timestamp is outside the allowed clock skew', 'STALE_TIMESTAMP');
  }
  return true;
}

function createSignedRequest({
  method,
  url,
  rawBody = '',
  idempotencyKey = '',
  signingSecret,
  timestamp = Math.floor(Date.now() / 1000),
  nonce = createNonce(),
}) {
  if (!signingSecret) {
    throw new IntegrationError('Signing secret is not configured', 'SIGNING_SECRET_MISSING');
  }
  validateNonce(nonce);
  validateTimestamp(timestamp, Math.floor(Date.now() / 1000), Number.MAX_SAFE_INTEGER);
  const bodyDigest = sha256Hex(rawBody);
  const canonicalRequest = buildCanonicalRequest({
    method,
    url,
    timestamp,
    nonce,
    idempotencyKey,
    rawBody,
  });

  return {
    timestamp: String(timestamp),
    nonce,
    bodyDigest,
    canonicalRequest,
    signature: createSignature(canonicalRequest, signingSecret),
  };
}

function getHeader(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return headers.get(name) || '';
  const target = name.toLowerCase();
  const key = Object.keys(headers).find((headerName) => headerName.toLowerCase() === target);
  return key ? String(headers[key]) : '';
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function assertSignature(signature, expectedSignature) {
  if (!/^v1=[0-9a-f]{64}$/.test(signature) || !safeEqual(signature, expectedSignature)) {
    throw new IntegrationError('Request signature is invalid', 'INVALID_SIGNATURE');
  }
}

function readRetryAfterMs(response, nowMs = Date.now()) {
  const value = getHeader(response.headers, 'retry-after');
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - nowMs) : 0;
}

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

function isRetryableNetworkError(error) {
  if (error instanceof RequestTimeoutError) return true;
  if (!error || error.name === 'AbortError') return false;
  return error.name === 'TypeError' || RETRYABLE_NETWORK_CODES.has(error.code);
}

function calculateRetryDelay(attempt, baseDelayMs, retryAfterMs, maxDelayMs, random = Math.random) {
  const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  const jitter = Math.floor(Math.max(0, random()) * baseDelayMs);
  return Math.min(maxDelayMs, Math.max(exponentialDelay + jitter, retryAfterMs || 0));
}

function sanitizeLogValue(value, key = '', depth = 0) {
  if (depth > 4) return '[TRUNCATED]';
  if (/rawbody|authorization|bearersecret|signingsecret|callbacksecret|password|token/i.test(key)) {
    return '[REDACTED]';
  }
  if (/signature/i.test(key)) {
    const text = String(value);
    return text.length > 16 ? `${text.slice(0, 16)}...` : '[REDACTED]';
  }
  if (/email|phone|address|taxid|bankaccount|customername/i.test(key)) {
    return '[PII_REDACTED]';
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeLogValue(item, key, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizeLogValue(childValue, childKey, depth + 1),
      ])
    );
  }
  return value;
}

function createStructuredLogger(writer = console) {
  return {
    log(level, event, fields = {}) {
      const payload = {
        timestamp: new Date().toISOString(),
        service: 'chatpos-backoffice-client',
        event,
        ...sanitizeLogValue(fields),
      };
      const output = JSON.stringify(payload);
      const method = typeof writer[level] === 'function' ? writer[level] : writer.log;
      method.call(writer, output);
    },
  };
}

class NonceReplayStore {
  constructor({ ttlSeconds = DEFAULT_TIMESTAMP_TOLERANCE_SECONDS, now = () => Math.floor(Date.now() / 1000) } = {}) {
    this.ttlSeconds = ttlSeconds;
    this.now = now;
    this.entries = new Map();
  }

  claim(nonce) {
    const now = this.now();
    for (const [storedNonce, expiresAt] of this.entries) {
      if (expiresAt <= now) this.entries.delete(storedNonce);
    }
    if (this.entries.has(nonce)) throw new NonceReplayError(nonce);
    this.entries.set(nonce, now + this.ttlSeconds);
  }
}

class IdempotencyStore {
  constructor() {
    this.entries = new Map();
  }

  claim(idempotencyKey, bodyDigest) {
    if (!idempotencyKey) return { idempotentReplay: false };
    const existingDigest = this.entries.get(idempotencyKey);
    if (existingDigest && existingDigest !== bodyDigest) {
      throw new IdempotencyConflictError(idempotencyKey);
    }
    if (existingDigest) return { idempotentReplay: true };
    this.entries.set(idempotencyKey, bodyDigest);
    return { idempotentReplay: false };
  }
}

function verifySignedRequest({
  method,
  url,
  headers,
  rawBody = '',
  signingSecret,
  bearerSecret,
  nowSeconds = Math.floor(Date.now() / 1000),
  timestampToleranceSeconds = DEFAULT_TIMESTAMP_TOLERANCE_SECONDS,
  nonceStore,
  idempotencyStore,
  requireIdempotencyKey = false,
}) {
  if (!signingSecret) throw new IntegrationError('Signing secret is not configured', 'SIGNING_SECRET_MISSING');
  const timestamp = getHeader(headers, 'x-chatpos-timestamp');
  const nonce = getHeader(headers, 'x-chatpos-nonce');
  const signature = getHeader(headers, 'x-chatpos-signature');
  const idempotencyKey = getHeader(headers, 'idempotency-key');
  const authorization = getHeader(headers, 'authorization');

  if (bearerSecret && authorization !== `Bearer ${bearerSecret}`) {
    throw new IntegrationError('Bearer authorization is invalid', 'UNAUTHORIZED');
  }
  if (requireIdempotencyKey && !idempotencyKey) {
    throw new IntegrationError('Idempotency-Key is required', 'IDEMPOTENCY_REQUIRED');
  }

  validateTimestamp(timestamp, nowSeconds, timestampToleranceSeconds);
  validateNonce(nonce);
  const canonicalRequest = buildCanonicalRequest({
    method,
    url,
    timestamp,
    nonce,
    idempotencyKey,
    rawBody,
  });
  const expectedSignature = createSignature(canonicalRequest, signingSecret);
  assertSignature(signature, expectedSignature);

  if (nonceStore) nonceStore.claim(nonce);
  const bodyDigest = sha256Hex(rawBody);
  const idempotency = idempotencyStore
    ? idempotencyStore.claim(idempotencyKey, bodyDigest)
    : { idempotentReplay: false };

  return {
    requestId: getHeader(headers, 'x-request-id') || null,
    timestamp: Number(timestamp),
    nonce,
    idempotencyKey: idempotencyKey || null,
    bodyDigest,
    canonicalRequest,
    ...idempotency,
  };
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs, externalSignal) {
  const controller = new AbortController();
  let timedOut = false;
  let externallyAborted = false;
  const abortFromCaller = () => {
    externallyAborted = true;
    controller.abort();
  };
  if (externalSignal) {
    if (externalSignal.aborted) abortFromCaller();
    else externalSignal.addEventListener('abort', abortFromCaller, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new RequestTimeoutError(timeoutMs);
    if (externallyAborted) throw error;
    throw error;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abortFromCaller);
  }
}

async function drainResponse(response) {
  if (typeof response.arrayBuffer === 'function') {
    try {
      await response.arrayBuffer();
    } catch {
      return;
    }
  }
}

async function parseResponseBody(response) {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  const contentType = getHeader(response.headers, 'content-type');
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

class SignedMerchantApiClient {
  constructor(options = {}) {
    const config = options.config || loadBackofficeConfig(options.env || process.env);
    this.config = config;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.sleep = options.sleep || ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
    this.random = options.random || Math.random;
    this.nowSeconds = options.nowSeconds || (() => Math.floor(Date.now() / 1000));
    this.nonceFactory = options.nonceFactory || createNonce;
    this.requestIdFactory = options.requestIdFactory || createRequestId;
    this.logger = options.logger || createStructuredLogger();
    this.credentialResolver = options.credentialResolver || null;
  }

  async request(pathOrUrl, options = {}) {
    if (!this.config.enabled) throw new IntegrationDisabledError();
    const requestConfig = this.credentialResolver
      ? await this.credentialResolver(options.storeId, this.config)
      : this.config;
    if (!requestConfig.enabled) throw new IntegrationDisabledError();
    if (typeof this.fetchImpl !== 'function') {
      throw new IntegrationError('Global fetch is not available', 'FETCH_UNAVAILABLE');
    }
    if (!requestConfig.baseUrl && !/^https?:\/\//i.test(pathOrUrl)) {
      throw new IntegrationError('Backoffice base URL is not configured', 'BASE_URL_MISSING');
    }
    if (!requestConfig.bearerSecret) throw new IntegrationError('Bearer secret is not configured', 'BEARER_SECRET_MISSING');
    if (!requestConfig.signingSecret) throw new IntegrationError('Signing secret is not configured', 'SIGNING_SECRET_MISSING');

    const {
      method = 'GET',
      body,
      rawBody,
      storeId,
      idempotencyKey = '',
      requestId = this.requestIdFactory(),
      sourceRequestId = null,
      headers: customHeaders = {},
      signal,
    } = options;
    const normalizedMethod = String(method).toUpperCase();
    if (!['GET', 'HEAD'].includes(normalizedMethod) && !idempotencyKey) {
      throw new IntegrationError('Idempotency-Key is required for command requests', 'IDEMPOTENCY_REQUIRED');
    }
    const exactBody = rawBody !== undefined ? String(rawBody) : serializeBody(body);
    const url = /^https?:\/\//i.test(pathOrUrl)
      ? String(pathOrUrl)
      : new URL(String(pathOrUrl).replace(/^\/?/, '/'), `${requestConfig.baseUrl}/`).toString();
    const maxAttempts = requestConfig.maxRetries + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const timestamp = this.nowSeconds();
      const nonce = this.nonceFactory();
      const signed = createSignedRequest({
        method: normalizedMethod,
        url,
        rawBody: exactBody,
        idempotencyKey,
        signingSecret: requestConfig.signingSecret,
        timestamp,
        nonce,
      });
      const headers = {
        ...customHeaders,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${requestConfig.bearerSecret}`,
        'Idempotency-Key': idempotencyKey,
        'X-ChatPOS-Timestamp': signed.timestamp,
        'X-ChatPOS-Nonce': signed.nonce,
        'X-ChatPOS-Signature': signed.signature,
        'X-Request-Id': requestId,
      };
      if (requestConfig.keyId) {
        headers[requestConfig.keyIdHeaderName || 'X-ChatPOS-Key-Id'] = requestConfig.keyId;
      }
      const startedAt = Date.now();

      try {
        const response = await fetchWithTimeout(
          this.fetchImpl,
          url,
          {
            method: normalizedMethod,
            headers,
            body: exactBody || undefined,
          },
          requestConfig.timeoutMs,
          signal
        );
        const retryable = isRetryableStatus(response.status);
        this.logger.log(retryable && attempt < maxAttempts - 1 ? 'warn' : 'info', 'backoffice_request', {
          method: normalizedMethod,
          path: canonicalPath(url),
          status: response.status,
          attempt: attempt + 1,
          requestId,
          sourceRequestId,
          idempotencyKey,
          bodyDigest: signed.bodyDigest,
          latencyMs: Date.now() - startedAt,
        });

        if (retryable && attempt < maxAttempts - 1) {
          const retryAfterMs = readRetryAfterMs(response);
          await drainResponse(response);
          await this.sleep(
            calculateRetryDelay(
              attempt,
              requestConfig.retryBaseDelayMs,
              retryAfterMs,
              requestConfig.maxRetryDelayMs,
              this.random
            )
          );
          continue;
        }

        return {
          ok: response.ok,
          status: response.status,
          headers: response.headers,
          data: await parseResponseBody(response),
          requestId,
          attempts: attempt + 1,
          bodyDigest: signed.bodyDigest,
          idempotencyKey: idempotencyKey || null,
        };
      } catch (error) {
        const retryable = isRetryableNetworkError(error);
        this.logger.log(retryable && attempt < maxAttempts - 1 ? 'warn' : 'error', 'backoffice_request_error', {
          method: normalizedMethod,
          path: canonicalPath(url),
          attempt: attempt + 1,
          requestId,
          sourceRequestId,
          idempotencyKey,
          bodyDigest: signed.bodyDigest,
          errorCode: error.code || error.name || 'UNKNOWN_ERROR',
          latencyMs: Date.now() - startedAt,
        });
        if (!retryable || attempt >= maxAttempts - 1) throw error;
        await this.sleep(
          calculateRetryDelay(attempt, requestConfig.retryBaseDelayMs, 0, requestConfig.maxRetryDelayMs, this.random)
        );
      }
    }

    throw new IntegrationError('Backoffice request exhausted its retry budget', 'RETRY_EXHAUSTED');
  }
}

function createBackofficeClient(options = {}) {
  return new SignedMerchantApiClient(options);
}

module.exports = {
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_BASE_DELAY_MS,
  DEFAULT_TIMEOUT_MS,
  IdempotencyConflictError,
  IdempotencyStore,
  IntegrationDisabledError,
  IntegrationError,
  NonceReplayError,
  NonceReplayStore,
  RequestTimeoutError,
  SignedMerchantApiClient,
  buildCanonicalRequest,
  calculateRetryDelay,
  canonicalPath,
  createBackofficeClient,
  createNonce,
  createRequestId,
  createSignature,
  createSignedRequest,
  createStructuredLogger,
  isRetryableNetworkError,
  isRetryableStatus,
  loadBackofficeConfig,
  serializeBody,
  sha256Hex,
  validateNonce,
  validateTimestamp,
  verifySignedRequest,
};

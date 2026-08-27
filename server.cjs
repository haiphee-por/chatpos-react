const http = require('http');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { createBackofficeClient, loadBackofficeConfig } = require('./server/integration/signedMerchantClient.cjs');
const { createStoreCredentialResolver } = require('./server/integration/storeBackofficeCredentials.cjs');
const {
  AssignmentError,
  createAssignmentRequest,
  processAssignmentCallback,
} = require('./server/integration/assignmentService.cjs');
const {
  appendKycMessage,
  getDocumentAccess,
  getKycDocumentDownload,
  getKycWorkspace,
  intakeKycDocument,
  markKycMessageRead,
  ProfileKycError,
  submitKycCaseForReview,
  updateStoreProfile,
} = require('./server/integration/profileKycService.cjs');
const {
  TransactionRoutingError,
  createTransactionCommand,
  dispatchSettlementEvent,
  getTransaction,
  getTransactionStatus,
  processPaymentWebhook,
  verifyPaymentStatusWebhook,
  verifyLlgwWebhook,
  retryPendingSettlementEvents,
} = require('./server/integration/transactionService.cjs');
const {
  loadOtpConfig,
  requestKycOtp,
  verifyKycOtp,
} = require('./server/integration/otpService.cjs');
const { createSmsupProvider } = require('./server/integration/smsupClient.cjs');
const {
  boundedInteger,
  getStoppayTransition,
  getTransactionFilters,
  stoppayTransitions,
} = require('./server/integration/merchantHomeContract.cjs');
const {
  SecurityError,
  assertCaseAccess,
  assertRole,
  assertStoreAccess,
  clientIp,
  consumeRateLimit,
  createSession,
  getPrincipal,
  normalizeRole,
  revokeSession,
  sessionCookie,
  writeAudit,
} = require('./server/security.cjs');
const { deletePrivateDocument, readPrivateDocument, writePrivateDocument } = require('./server/integration/privateDocumentStorage.cjs');

dotenv.config();

const port = process.env.API_PORT || 3001;
const merchantHomeContractEnabled = process.env.MERCHANT_HOME_CONTRACT_ENABLED === 'true';
const configuredDatabaseName = (() => {
  if (process.env.PGDATABASE) return process.env.PGDATABASE;
  try {
    return decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.replace(/^\//, '')) || 'chatpos';
  } catch {
    return 'chatpos';
  }
})();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'chatpos',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
const backofficeConfig = loadBackofficeConfig();
const otpConfig = loadOtpConfig();
const otpProvider = otpConfig.provider === 'smsup_plus' ? createSmsupProvider() : undefined;
const storeCredentialResolver = createStoreCredentialResolver({
  pool,
  fallbackConfig: backofficeConfig,
  environment: process.env.AGENT_PD_CREDENTIAL_ENVIRONMENT,
});
const resolveBackofficeCredential = (storeId) => storeCredentialResolver.resolve(storeId);
const assignmentBackofficeClient = createBackofficeClient({
  config: {
    ...backofficeConfig,
    enabled: backofficeConfig.enabled && backofficeConfig.assignmentEnabled,
  },
  credentialResolver: resolveBackofficeCredential,
});
const profileBackofficeClient = createBackofficeClient({
  config: {
    ...backofficeConfig,
    enabled: backofficeConfig.enabled && backofficeConfig.profileUpdateEnabled,
  },
  credentialResolver: resolveBackofficeCredential,
});
const kycDocumentBackofficeClient = createBackofficeClient({
  config: {
    ...backofficeConfig,
    enabled: backofficeConfig.enabled && backofficeConfig.kycDocumentEnabled,
  },
  credentialResolver: resolveBackofficeCredential,
});
const transactionBackofficeClient = createBackofficeClient({
  config: {
    ...backofficeConfig,
    enabled: backofficeConfig.enabled && (backofficeConfig.transactionRoutingEnabled || backofficeConfig.transactionQueryRoutingEnabled),
  },
  credentialResolver: resolveBackofficeCredential,
});
const metrics = {
  startedAt: new Date().toISOString(),
  requests: 0,
  errors: 0,
  rateLimited: 0,
  merchantHome: {
    requests: 0,
    errors: 0,
    totalLatencyMs: 0,
    statusCodes: {},
  },
};
const documentUploadLocks = new Map();
const deferredAssignmentErrorCodes = new Set([
  'ASSIGNMENT_INTEGRATION_DISABLED',
  'BASE_URL_MISSING',
  'BEARER_SECRET_MISSING',
  'INTEGRATION_DISABLED',
  'SECRET_RESOLVER_UNAVAILABLE',
  'SECRET_VALUE_MISSING',
  'SIGNING_SECRET_MISSING',
  'STORE_CREDENTIAL_MAPPING_MISSING',
]);

function isMerchantHomeRoute(requestPath) {
  return requestPath === '/api/db/home'
    || requestPath === '/api/db/capabilities'
    || requestPath === '/api/db/benefits'
    || requestPath === '/api/db/notifications'
    || requestPath === '/api/db/notifications/read-all'
    || requestPath === '/api/db/stoppay'
    || /^\/api\/db\/notifications\/[^/]+\/read$/.test(requestPath);
}

function recordMerchantHomeResponse(requestPath, statusCode, startedAt) {
  if (!isMerchantHomeRoute(requestPath)) return;
  const status = String(statusCode || 500);
  const homeMetrics = metrics.merchantHome;
  homeMetrics.requests += 1;
  homeMetrics.totalLatencyMs += Date.now() - startedAt;
  homeMetrics.statusCodes[status] = (homeMetrics.statusCodes[status] || 0) + 1;
  if (Number(status) >= 400) homeMetrics.errors += 1;
}

function crc16(data) {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    let x = ((crc >> 8) ^ data.charCodeAt(i)) & 0xff;
    x ^= x >> 4;
    crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatTag(id, value) {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function generatePromptPayPayload(target, amount) {
  const cleanTarget = (target || '0823456789').replace(/[^0-9]/g, '');
  let targetTag = '';

  if ((cleanTarget.length === 10 || cleanTarget.length === 9) && cleanTarget.startsWith('0')) {
    const formattedPhone = '0066' + cleanTarget.slice(1);
    targetTag = formatTag('01', formattedPhone);
  } else if (cleanTarget.length === 13) {
    targetTag = formatTag('02', cleanTarget);
  } else if (cleanTarget.length === 15) {
    targetTag = formatTag('03', cleanTarget);
  } else {
    const formattedPhone = cleanTarget.startsWith('0') ? '0066' + cleanTarget.slice(1) : '0066' + cleanTarget;
    targetTag = formatTag('01', formattedPhone);
  }

  const aid = formatTag('00', 'A000000677010111');
  const tag29 = formatTag('29', aid + targetTag);

  const pfi = formatTag('00', '01');
  const poi = formatTag('01', amount && Number(amount) > 0 ? '12' : '11');
  const currency = formatTag('53', '764');
  const country = formatTag('58', 'TH');

  let payload = pfi + poi + tag29 + currency;

  if (amount && Number(amount) > 0) {
    const num = Number(amount);
    const amtStr = num.toFixed(2);
    payload += formatTag('54', amtStr);
  }

  payload += country;
  payload += '6304';
  const checksum = crc16(payload);
  return payload + checksum;
}

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

function readRawBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        reject(new AssignmentError('Request body is too large', 'BODY_TOO_LARGE', 413));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function readRawBuffer(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        reject(new AssignmentError('Request body is too large', 'BODY_TOO_LARGE', 413));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function decodeRequestHeader(value, field, maxLength = 500) {
  const encoded = String(value || '');
  if (!encoded) return '';
  try {
    const decoded = decodeURIComponent(encoded);
    if (decoded.length > maxLength) throw new Error('too long');
    return decoded;
  } catch {
    throw new AssignmentError(`${field} is invalid`, 'DOCUMENT_METADATA_INVALID', 422);
  }
}

function documentStorageLocator({ storeId, caseId, sourceRequestId, fileName }) {
  const requestHash = crypto.createHash('sha256').update(sourceRequestId).digest('hex');
  const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 180) || 'document';
  return `private/kyc/${storeId}/${caseId}/${requestHash}-${safeName}`;
}

async function withDocumentUploadLock(storageLocator, callback) {
  const previous = documentUploadLocks.get(storageLocator) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  documentUploadLocks.set(storageLocator, current);
  await previous;
  try {
    return await callback();
  } finally {
    release();
    if (documentUploadLocks.get(storageLocator) === current) documentUploadLocks.delete(storageLocator);
  }
}

async function parseJsonBody(req, maxBytes = 1024 * 1024) {
  const bodyStr = await readRawBody(req, maxBytes);
  try {
    return JSON.parse(bodyStr || '{}');
  } catch {
    return {};
  }
}

function isPublicApiRequest(requestPath, method) {
  if (method === 'OPTIONS') return true;
  if (requestPath === '/api/db/auth/login' && method === 'POST') return true;
  if (requestPath === '/api/db/auth/session' && method === 'GET') return true;
  if (/^\/api\/db\/auth\/register-(pd|agent|merchant)$/.test(requestPath) && method === 'POST') return true;
  if (requestPath === '/api/db/health' && method === 'GET') return true;
  if (requestPath === '/api/health/live' && method === 'GET') return true;
  if (requestPath === '/api/health/ready' && method === 'GET') return true;
  if (/^\/api\/v1\/kyc\/documents\/[^/]+\/download$/.test(requestPath) && method === 'GET') return true;
  if (requestPath === '/api/webhooks/assignment-status' && method === 'POST') return true;
  if (requestPath === '/api/webhooks/llgw/payment' && method === 'POST') return true;
  if (requestPath === '/api/webhooks/payment-status' && method === 'POST') return true;
  return false;
}

function configuredOrigins() {
  return String(process.env.ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function setSecurityHeaders(req, res) {
  const origin = String(req.headers.origin || '');
  const origins = configuredOrigins();
  if (origin && origins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

async function resolveAuthorizedStore({ principal, requestedStoreId, allowUnscoped = false }) {
  const storeId = requestedStoreId || principal.storeId || null;
  await assertStoreAccess({ pool, principal, storeId, allowUnscoped });
  return storeId;
}

async function enforcePrincipalRateLimit({ principal, requestPath, limit = 60, windowSeconds = 60 }) {
  return consumeRateLimit({
    pool,
    bucketKey: `api:${principal.id}:${requestPath}`,
    limit,
    windowSeconds,
  });
}

function requestQuery(url) {
  return new URL(`http://127.0.0.1${url}`).searchParams;
}

function requestIdempotencyKey(req, body = {}) {
  return String(req.headers['idempotency-key'] || body.idempotencyKey || '').trim();
}


const server = http.createServer(async (req, res) => {
  const url = req.url || '';

  // Handle API Database routes
  const requestPath = url.split('?')[0];

  if (
    url.startsWith('/api/db') ||
    url.startsWith('/api/v1') ||
    url.startsWith('/api/health') ||
    requestPath === '/api/webhooks/assignment-status' ||
    requestPath === '/api/webhooks/llgw/payment' ||
    requestPath === '/api/webhooks/payment-status'
  ) {
    res.setHeader('Content-Type', 'application/json');
    setSecurityHeaders(req, res);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Idempotency-Key, X-Request-Id, X-ChatPOS-Event-Id, X-ChatPOS-Event-Type, X-ChatPOS-Timestamp, X-ChatPOS-Signature, X-LLGW-Event-Id, X-LLGW-Timestamp, X-LLGW-Signature'
    );

    if (req.method === 'OPTIONS') {
      const origin = String(req.headers.origin || '');
      if (origin && !configuredOrigins().includes(origin)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ success: false, error: { code: 'CORS_ORIGIN_FORBIDDEN', message: 'Origin is not allowed' } }));
        return;
      }
      res.statusCode = 204;
      res.end();
      return;
    }

    metrics.requests += 1;
    const requestStartedAt = Date.now();
    const originalEnd = res.end.bind(res);
    res.end = (...args) => {
      recordMerchantHomeResponse(requestPath, res.statusCode, requestStartedAt);
      return originalEnd(...args);
    };
    try {
      let principal = null;
      if (!isPublicApiRequest(requestPath, req.method)) {
        principal = await getPrincipal({ pool, req });
      }

      if (isMerchantHomeRoute(requestPath) && !merchantHomeContractEnabled) {
        throw new SecurityError('Merchant Home contract is disabled', 'FEATURE_DISABLED', 404);
      }

      if (requestPath === '/api/health/live' && req.method === 'GET') {
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, status: 'alive' }));
        return;
      }

      if (requestPath === '/api/health/ready' && req.method === 'GET') {
        try {
          await pool.query('SELECT 1');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, status: 'ready' }));
        } catch (error) {
          res.statusCode = 503;
          res.end(JSON.stringify({ success: false, status: 'not_ready', code: 'DATABASE_UNAVAILABLE' }));
        }
        return;
      }

      const documentDownloadRoute = requestPath.match(/^\/api\/v1\/kyc\/documents\/([^/]+)\/download$/);
      if (documentDownloadRoute && req.method === 'GET') {
        const query = new URL(url, 'http://localhost').searchParams;
        const result = await getKycDocumentDownload({
          pool,
          versionId: documentDownloadRoute[1],
          token: query.get('token'),
          nowSeconds: Math.floor(Date.now() / 1000),
        });
        await writeAudit({
          poolOrClient: pool,
          actorId: 'signed-document-link',
          actorRole: 'document_link',
          action: 'KYC_DOCUMENT_DOWNLOADED',
          targetType: 'document_version',
          targetId: documentDownloadRoute[1],
          after: { expiresAt: result.expiresAt, access: 'signed-download' },
          requestId: req.headers['x-request-id'] || null,
        });
        res.statusCode = 200;
        res.setHeader('Content-Type', result.version.mimeType);
        res.setHeader('Content-Length', String(result.data.length));
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(result.version.fileName)}`);
        res.setHeader('Cache-Control', 'private, no-store');
        res.end(result.data);
        return;
      }

      if (requestPath === '/api/health/metrics' && req.method === 'GET') {
        assertRole(principal, ['admin', 'compliance']);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, metrics: { ...metrics, uptimeSeconds: Math.floor(process.uptime()) } }));
        return;
      }

      if (requestPath === '/api/db/auth/logout' && req.method === 'POST') {
        await writeAudit({ poolOrClient: pool, principal, action: 'LOGOUT', targetType: 'auth_session', targetId: principal.sessionId, requestId: req.headers['x-request-id'] || null });
        await revokeSession({ pool, req });
        res.setHeader('Set-Cookie', sessionCookie('', 0));
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (requestPath === '/api/db/auth/session' && req.method === 'GET') {
        try {
          const sessionPrincipal = await getPrincipal({ pool, req });
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, user: sessionPrincipal }));
        } catch (error) {
          if (error instanceof SecurityError) {
            res.statusCode = 200;
            res.end(JSON.stringify({ success: false, user: null }));
            return;
          }
          throw error;
        }
        return;
      }

      if (requestPath === '/api/webhooks/assignment-status' && req.method === 'POST') {
        const rawBody = await readRawBody(req);
        const callbackResult = await processAssignmentCallback({
          pool,
          rawBody,
          headers: req.headers,
          callbackSecretResolver: storeCredentialResolver.resolveCallbackSecrets,
          callbackSecret: backofficeConfig.callbackSecrets?.length ? backofficeConfig.callbackSecrets : backofficeConfig.callbackSecret,
        });
        res.statusCode = callbackResult.statusCode || 200;
        res.end(JSON.stringify({
          success: true,
          duplicate: Boolean(callbackResult.duplicate),
          late: Boolean(callbackResult.late),
          data: callbackResult.data || null,
        }));
        return;
      }

      if (requestPath === '/api/v1/assignments/requests' && req.method === 'POST') {
        assertRole(principal, ['merchant']);
        await enforcePrincipalRateLimit({ principal, requestPath, limit: 10, windowSeconds: 300 });
        if (!backofficeConfig.enabled || !backofficeConfig.assignmentEnabled) {
          res.statusCode = 503;
          res.end(JSON.stringify({ success: false, code: 'ASSIGNMENT_INTEGRATION_DISABLED', error: 'Assignment integration is disabled' }));
          return;
        }

        const body = await parseJsonBody(req);
        const storeId = await resolveAuthorizedStore({ principal, requestedStoreId: body.storeId });
        const requestId = String(req.headers['x-request-id'] || crypto.randomUUID());
        const assignmentResult = await createAssignmentRequest({
          pool,
          backofficeClient: assignmentBackofficeClient,
          storeId,
          sourceRequestId: body.sourceRequestId,
          agentPhone: body.agentPhone,
          requestId,
        });
        await writeAudit({
          poolOrClient: pool,
          principal,
          action: 'ASSIGNMENT_REQUESTED',
          targetType: 'store',
          targetId: storeId,
          after: { sourceRequestId: body.sourceRequestId, status: assignmentResult.data?.status || null },
          requestId,
        });
        res.statusCode = assignmentResult.statusCode;
        res.end(JSON.stringify({ success: true, data: assignmentResult.data }));
        return;
      }

      if (requestPath === '/api/v1/stores/profile' && req.method === 'PATCH') {
        assertRole(principal, ['merchant']);
        await enforcePrincipalRateLimit({ principal, requestPath, limit: 20, windowSeconds: 300 });
        if (!backofficeConfig.enabled || !backofficeConfig.profileUpdateEnabled) {
          res.statusCode = 503;
          res.end(JSON.stringify({ success: false, code: 'PROFILE_UPDATE_DISABLED', error: 'Merchant profile integration is disabled' }));
          return;
        }
        const body = await parseJsonBody(req);
        const storeId = await resolveAuthorizedStore({ principal, requestedStoreId: body.storeId });
        delete body.storeId;
        const idempotencyKey = req.headers['idempotency-key'];
        const requestId = String(req.headers['x-request-id'] || crypto.randomUUID());
        const profileResult = await updateStoreProfile({
          pool,
          backofficeClient: profileBackofficeClient,
          storeId,
          body,
          idempotencyKey,
          requestId,
        });
        await writeAudit({
          poolOrClient: pool,
          principal,
          action: 'STORE_PROFILE_UPDATED',
          targetType: 'store',
          targetId: storeId,
          after: body,
          requestId,
        });
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, data: profileResult }));
        return;
      }

      const kycSubmitRoute = requestPath.match(/^\/api\/v1\/kyc\/cases\/([^/]+)\/submit$/);
      if (kycSubmitRoute && req.method === 'POST') {
        assertRole(principal, ['merchant']);
        await enforcePrincipalRateLimit({ principal, requestPath: '/api/v1/kyc/submit', limit: 10, windowSeconds: 300 });
        const body = await parseJsonBody(req);
        const storeId = await assertCaseAccess({ pool, principal, caseId: kycSubmitRoute[1] });
        const requestId = String(req.headers['x-request-id'] || crypto.randomUUID());
        const sourceRequestId = String(body.sourceRequestId || `merchant-kyc-submit-${kycSubmitRoute[1]}`);
        const localResult = await submitKycCaseForReview({
          pool,
          storeId,
          caseId: kycSubmitRoute[1],
          actorId: principal.id,
          actorRole: principal.role,
          requestId,
        });

        let assignment = null;
        let backoffice = { status: 'PENDING_CONFIGURATION', code: 'ASSIGNMENT_INTEGRATION_DISABLED' };
        try {
          const assignmentResult = await createAssignmentRequest({
            pool,
            backofficeClient: assignmentBackofficeClient,
            storeId,
            sourceRequestId,
            agentPhone: body.agentPhone,
            requestId,
          });
          assignment = assignmentResult.data;
          backoffice = assignment.status === 'PENDING_BACKOFFICE_DISPATCH'
            ? { status: 'PENDING_CONFIGURATION', code: assignment.reason || 'BACKOFFICE_DISPATCH_PENDING', assignment }
            : { status: 'FORWARDED', assignment };
        } catch (error) {
          if (!deferredAssignmentErrorCodes.has(error.code)) throw error;
          await writeAudit({
            poolOrClient: pool,
            principal,
            action: 'KYC_BACKOFFICE_DISPATCH_PENDING',
            targetType: 'kyc_case',
            targetId: kycSubmitRoute[1],
            after: { status: 'PENDING_CONFIGURATION', code: error.code },
            requestId,
          });
          backoffice = { status: 'PENDING_CONFIGURATION', code: error.code };
        }

        res.statusCode = backoffice.status === 'FORWARDED' ? 201 : 202;
        res.end(JSON.stringify({ success: true, data: { ...localResult, assignment, backoffice } }));
        return;
      }

      const documentRoute = requestPath.match(/^\/api\/v1\/kyc\/cases\/([^/]+)\/documents$/);
      if (documentRoute && req.method === 'POST') {
        assertRole(principal, ['merchant']);
        await enforcePrincipalRateLimit({ principal, requestPath: '/api/v1/kyc/documents', limit: 20, windowSeconds: 300 });
        const caseStoreId = await assertCaseAccess({ pool, principal, caseId: documentRoute[1] });
        const storeId = caseStoreId;
        const idempotencyKey = req.headers['idempotency-key'];
        const requestId = String(req.headers['x-request-id'] || crypto.randomUUID());
        const sourceRequestId = decodeRequestHeader(req.headers['x-source-request-id'] || idempotencyKey || crypto.randomUUID(), 'sourceRequestId', 120);
        const sourceIssuedAt = decodeRequestHeader(req.headers['x-kyc-source-issued-at'], 'sourceIssuedAt', 80);
        if (!sourceIssuedAt) {
          throw new AssignmentError('sourceIssuedAt is required for an idempotent document operation', 'DOCUMENT_SOURCE_ISSUED_AT_REQUIRED', 422);
        }
        const fileName = decodeRequestHeader(req.headers['x-kyc-file-name'], 'fileName', 255);
        const documentType = decodeRequestHeader(req.headers['x-kyc-document-type'], 'documentType', 120);
        const reason = decodeRequestHeader(req.headers['x-kyc-reason'], 'reason', 500);
        const contentType = String(req.headers['content-type'] || '').split(';', 1)[0].toLowerCase();
        if (!fileName || !documentType || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
          throw new AssignmentError('Binary document upload metadata is invalid', 'DOCUMENT_METADATA_INVALID', 422);
        }
        const data = await readRawBuffer(req, 10 * 1024 * 1024);
        const checksumSha256 = crypto.createHash('sha256').update(data).digest('hex');
        const storageLocator = documentStorageLocator({ storeId, caseId: documentRoute[1], sourceRequestId, fileName });
        const documentResult = await withDocumentUploadLock(storageLocator, async () => {
          let ownsStoredFile = false;
          try {
            await writePrivateDocument({ storageLocator, data, expectedSize: data.length, checksumSha256 });
            ownsStoredFile = true;
          } catch (storageError) {
            if (storageError.code !== 'EEXIST') throw storageError;
            const existingFile = await readPrivateDocument(storageLocator);
            const existingChecksum = crypto.createHash('sha256').update(existingFile.data).digest('hex');
            if (existingFile.data.length !== data.length || existingChecksum !== checksumSha256) {
              throw new ProfileKycError('The upload idempotency key is already associated with different content', 'DOCUMENT_IDEMPOTENCY_CONFLICT', 409);
            }
          }
          try {
            return await intakeKycDocument({
              pool,
              backofficeClient: kycDocumentBackofficeClient,
              storeId,
              caseId: documentRoute[1],
              body: { documentType, fileName, mimeType: contentType, fileSize: data.length, checksumSha256, storageLocator, reason: reason || null, sourceRequestId, ...(sourceIssuedAt ? { sourceIssuedAt } : {}) },
              idempotencyKey,
              requestId,
              documentLinkTtlSeconds: backofficeConfig.documentLinkTtlSeconds,
              publicBaseUrl: process.env.NEXT_PUBLIC_APP_URL,
            });
          } catch (documentError) {
            if (ownsStoredFile && !documentError.localCommitted) await deletePrivateDocument(storageLocator).catch(() => {});
            throw documentError;
          }
        });
        await writeAudit({
          poolOrClient: pool,
          principal,
          action: 'KYC_DOCUMENT_SUBMITTED',
          targetType: 'kyc_case',
          targetId: documentRoute[1],
          after: { documentId: documentResult.document?.id || documentResult.id || null, status: documentResult.status || null },
          requestId,
        });
        res.statusCode = documentResult.replayed ? 200 : 201;
        res.end(JSON.stringify({ success: true, data: documentResult }));
        return;
      }

      const otpRequestRoute = requestPath.match(/^\/api\/v1\/kyc\/cases\/([^/]+)\/otp$/);
      if (otpRequestRoute && req.method === 'POST') {
        assertRole(principal, ['merchant']);
        await enforcePrincipalRateLimit({ pool, principal, requestPath: '/api/v1/kyc/otp/request', limit: 5, windowSeconds: 300 });
        const body = await parseJsonBody(req);
        const storeId = await assertCaseAccess({ pool, principal, caseId: otpRequestRoute[1] });
        const requestId = String(req.headers['x-request-id'] || crypto.randomUUID());
        const result = await requestKycOtp({
          pool,
          caseId: otpRequestRoute[1],
          storeId,
          body,
          config: otpConfig,
          provider: otpProvider,
          requestId,
        });
        await writeAudit({ poolOrClient: pool, principal, action: 'KYC_OTP_REQUESTED', targetType: 'kyc_case', targetId: otpRequestRoute[1], after: result.challenge, requestId });
        res.statusCode = 201;
        res.end(JSON.stringify({ success: true, data: result }));
        return;
      }

      const otpVerifyRoute = requestPath.match(/^\/api\/v1\/kyc\/cases\/([^/]+)\/otp\/verify$/);
      if (otpVerifyRoute && req.method === 'POST') {
        assertRole(principal, ['merchant']);
        await enforcePrincipalRateLimit({ pool, principal, requestPath: '/api/v1/kyc/otp/verify', limit: 20, windowSeconds: 300 });
        const body = await parseJsonBody(req);
        const storeId = await assertCaseAccess({ pool, principal, caseId: otpVerifyRoute[1] });
        const requestId = String(req.headers['x-request-id'] || crypto.randomUUID());
        const result = await verifyKycOtp({
          pool,
          caseId: otpVerifyRoute[1],
          storeId,
          otp: body.otp,
          config: otpConfig,
          provider: otpProvider,
          requestId,
        });
        await writeAudit({ poolOrClient: pool, principal, action: 'KYC_OTP_VERIFIED', targetType: 'kyc_case', targetId: otpVerifyRoute[1], after: result.challenge, requestId });
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, data: result }));
        return;
      }

      // ── AUTH: 1. POST /api/db/auth/login ────────────────────────────
      if (url === '/api/db/auth/login' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const { email, password, role } = body;

        try {
          await consumeRateLimit({
            pool,
            bucketKey: `auth-login:${clientIp(req)}:${String(email || '').trim().toLowerCase()}`,
            limit: Number(process.env.AUTH_LOGIN_RATE_LIMIT || 8),
            windowSeconds: Number(process.env.AUTH_LOGIN_RATE_WINDOW_SECONDS || 300),
          });
        } catch (error) {
          if (error instanceof SecurityError) {
            if (error.retryAfterSeconds) res.setHeader('Retry-After', String(error.retryAfterSeconds));
            res.statusCode = error.statusCode;
            res.end(JSON.stringify({ success: false, error: { code: error.code, message: error.message } }));
            return;
          }
          throw error;
        }

        if (!email || !password) {
          await writeAudit({ poolOrClient: pool, action: 'LOGIN_FAILED', targetType: 'auth', targetId: null, reason: 'MISSING_CREDENTIALS', requestId: req.headers['x-request-id'] || null });
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'กรุณากรอกอีเมลและรหัสผ่าน' }));
          return;
        }

        const cleanEmail = String(email).trim().toLowerCase();

        // 1. Search in User table
        const userRes = await pool.query(
          `SELECT id, name, email, phone, password, role, "isActive", avatar, "createdAt" 
           FROM "User" 
           WHERE LOWER(email) = $1 OR phone = $2 LIMIT 1;`,
          [cleanEmail, email]
        );

        let user = userRes.rows[0];
        let isAdminAccount = false;

        // 2. If not found in User, and attempting Admin, check AdminAccount table
        if (!user && (role === 'admin' || !role)) {
          const adminRes = await pool.query(
            `SELECT id, name, email, phone, password, 'admin' as role, "isActive", avatar, "createdAt" 
             FROM "AdminAccount" 
             WHERE LOWER(email) = $1 LIMIT 1;`,
            [cleanEmail]
          );
          if (adminRes.rows.length > 0) {
            user = adminRes.rows[0];
            isAdminAccount = true;
          }
        }

        if (!user) {
          await writeAudit({ poolOrClient: pool, action: 'LOGIN_FAILED', targetType: 'auth', targetId: null, reason: 'ACCOUNT_NOT_FOUND', requestId: req.headers['x-request-id'] || null });
          res.statusCode = 401;
          res.end(JSON.stringify({ success: false, error: 'ไม่พบบัญชีผู้ใช้งานนี้ในระบบ' }));
          return;
        }

        if (role && normalizeRole(role) !== normalizeRole(user.role)) {
          await writeAudit({ poolOrClient: pool, actorId: user.id, actorRole: user.role, action: 'LOGIN_FAILED', targetType: 'auth', targetId: user.id, reason: 'ROLE_MISMATCH', requestId: req.headers['x-request-id'] || null });
          res.statusCode = 403;
          res.end(JSON.stringify({ success: false, error: 'บทบาทของบัญชีไม่ตรงกับช่องทางเข้าสู่ระบบ' }));
          return;
        }

        if (user.isActive === false) {
          await writeAudit({ poolOrClient: pool, actorId: user.id, actorRole: user.role, action: 'LOGIN_FAILED', targetType: 'auth', targetId: user.id, reason: 'ACCOUNT_INACTIVE', requestId: req.headers['x-request-id'] || null });
          res.statusCode = 403;
          res.end(JSON.stringify({ success: false, error: 'บัญชีผู้ใช้งานนี้ถูกระงับการใช้งานชั่วคราว' }));
          return;
        }

        // Verify password using bcrypt
        let isMatch = false;
        try {
          if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
            isMatch = bcrypt.compareSync(password, user.password);
          } else {
            isMatch = user.password === password;
          }
        } catch (err) {
          isMatch = false;
        }

        if (!isMatch) {
          await writeAudit({ poolOrClient: pool, actorId: user.id, actorRole: user.role, action: 'LOGIN_FAILED', targetType: 'auth', targetId: user.id, reason: 'INVALID_PASSWORD', requestId: req.headers['x-request-id'] || null });
          res.statusCode = 401;
          res.end(JSON.stringify({ success: false, error: 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' }));
          return;
        }

        // Fetch extra role details
        let pdInfo = null;
        let agentInfo = null;
        let storeInfo = null;

        if (user.role === 'pd' || role === 'pd') {
          const pdRes = await pool.query(`SELECT * FROM "ProvincialDirector" WHERE "userId" = $1 LIMIT 1;`, [user.id]);
          pdInfo = pdRes.rows[0] || null;
        }

        if (user.role === 'agent' || role === 'agent') {
          const agRes = await pool.query(`SELECT * FROM "Agent" WHERE "userId" = $1 LIMIT 1;`, [user.id]);
          agentInfo = agRes.rows[0] || null;
        }

        if (user.role === 'owner' || user.role === 'merchant' || role === 'merchant') {
          const stRes = await pool.query(`SELECT * FROM "Store" WHERE "userId" = $1 LIMIT 1;`, [user.id]);
          storeInfo = stRes.rows[0] || null;
        }

        if (isAdminAccount) {
          pool.query(`UPDATE "AdminAccount" SET "lastLoginAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`, [user.id]).catch(() => {});
        }

        const session = await createSession({ pool, user, storeId: storeInfo?.id || null, req });
        await writeAudit({
          poolOrClient: pool,
          actorId: user.id,
          actorRole: user.role,
          action: 'LOGIN_SUCCEEDED',
          targetType: 'auth_session',
          targetId: session.sessionId,
          after: { role: user.role, storeId: storeInfo?.id || null },
          requestId: req.headers['x-request-id'] || null,
        });
        res.setHeader('Set-Cookie', sessionCookie(session.token));

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            sessionExpiresAt: session.expiresAt.toISOString(),
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              phone: user.phone,
              role: user.role,
              avatar: user.avatar,
              pd: pdInfo,
              agent: agentInfo,
              store: storeInfo,
            },
            message: 'เข้าสู่ระบบสำเร็จ',
          })
        );
        return;
      }

      // ── AUTH: 2. POST /api/db/auth/register-pd ─────────────────────
      if (url === '/api/db/auth/register-pd' && req.method === 'POST') {
        try {
          const body = await parseJsonBody(req);
          const { email, password, name, phone, code, displayName, investmentAmount, territoryId, kycData } = body;

          if (!email || !password || !name) {
            res.statusCode = 200;
            res.end(JSON.stringify({ success: false, error: 'กรุณากรอกข้อมูลที่จำเป็น (ชื่อ, อีเมล, รหัสผ่าน)' }));
            return;
          }

          const cleanEmail = String(email).trim().toLowerCase();
          const existing = await pool.query(`SELECT id FROM "User" WHERE LOWER(email) = $1 LIMIT 1;`, [cleanEmail]);
          if (existing.rows.length > 0) {
            res.statusCode = 200;
            res.end(JSON.stringify({ success: false, error: 'อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ หรือใช้อีเมลอื่น' }));
            return;
          }

          const userId = crypto.randomUUID();
          const pdId = crypto.randomUUID();
          const kycId = crypto.randomUUID();
          const hashedPassword = bcrypt.hashSync(password, 10);
          const pdCode = code || `PD-${Date.now().toString().slice(-4)}`;

          await pool.query(
            `INSERT INTO "User" (id, name, email, phone, password, role, "isActive", "createdAt", "updatedAt") 
             VALUES ($1, $2, $3, $4, $5, 'pd', true, NOW(), NOW());`,
            [userId, name, cleanEmail, phone || null, hashedPassword]
          );

          await pool.query(
            `INSERT INTO "ProvincialDirector" (id, "userId", code, "displayName", status, "investmentAmount", "territoryId", "startedAt", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, 'active', $5, $6, NOW(), NOW(), NOW());`,
            [pdId, userId, pdCode, displayName || name, Number(investmentAmount) || 25000, territoryId || null]
          );

          if (kycData) {
            await pool.query(
              `INSERT INTO "KycVerification" (id, "userId", "businessName", "firstName", "lastName", phone, "taxId", "bankName", "bankAccountNumber", "bankAccountName", "currentAddress", status, "currentStep", "applicantType", "approvalLevel", "kycSize", "agreementAccepted", "submittedAt", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', 1, 'individual', 'pending', 'L', true, NOW(), NOW(), NOW());`,
              [
                kycId,
                userId,
                kycData.businessName || displayName || name,
                kycData.firstName || name.split(' ')[0],
                kycData.lastName || name.split(' ')[1] || '',
                phone || null,
                kycData.taxId || kycData.idCard || null,
                kycData.bankName || null,
                kycData.bankAccountNumber || null,
                kycData.bankAccountName || name,
                kycData.address || null,
              ]
            );
          }

          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              message: 'ลงทะเบียนสมัครเป็น Partner Director (PD) สำเร็จ!',
              userId,
              pdId,
              code: pdCode,
            })
          );
          return;
        } catch (err) {
          console.error('[Register PD Error]', err);
          res.statusCode = 200;
          res.end(JSON.stringify({ success: false, error: err.message || 'เกิดข้อผิดพลาดในการลงทะเบียน PD' }));
          return;
        }
      }

      // ── AUTH: 3. POST /api/db/auth/register-agent ──────────────────
      if (url === '/api/db/auth/register-agent' && req.method === 'POST') {
        try {
          const body = await parseJsonBody(req);
          const { email, password, name, phone, code, tier, currentPdId, kycData } = body;

          if (!email || !password || !name) {
            res.statusCode = 200;
            res.end(JSON.stringify({ success: false, error: 'กรุณากรอกข้อมูลที่จำเป็น (ชื่อ, อีเมล, รหัสผ่าน)' }));
            return;
          }

          const cleanEmail = String(email).trim().toLowerCase();
          const existing = await pool.query(`SELECT id FROM "User" WHERE LOWER(email) = $1 LIMIT 1;`, [cleanEmail]);
          if (existing.rows.length > 0) {
            res.statusCode = 200;
            res.end(JSON.stringify({ success: false, error: 'อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ หรือใช้อีเมลอื่น' }));
            return;
          }

          const userId = crypto.randomUUID();
          const agentId = crypto.randomUUID();
          const kycId = crypto.randomUUID();
          const hashedPassword = bcrypt.hashSync(password, 10);
          const agentCode = code || `AG-${Date.now().toString().slice(-4)}`;

          await pool.query(
            `INSERT INTO "User" (id, name, email, phone, password, role, "isActive", "createdAt", "updatedAt") 
             VALUES ($1, $2, $3, $4, $5, 'agent', true, NOW(), NOW());`,
            [userId, name, cleanEmail, phone || null, hashedPassword]
          );

          await pool.query(
            `INSERT INTO "Agent" (id, "userId", code, tier, status, "adBudget", "baseAllowance", "walletBalance", "currentPdId", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, 'active', 100000.00, 4000.00, 0.00, $5, NOW(), NOW());`,
            [agentId, userId, agentCode, tier || 'STANDARD', currentPdId || null]
          );

          if (kycData) {
            await pool.query(
              `INSERT INTO "KycVerification" (id, "userId", "businessName", "firstName", "lastName", phone, "taxId", "bankName", "bankAccountNumber", "bankAccountName", "currentAddress", status, "currentStep", "applicantType", "approvalLevel", "kycSize", "agreementAccepted", "submittedAt", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', 1, 'individual', 'pending', 'M', true, NOW(), NOW(), NOW());`,
              [
                kycId,
                userId,
                kycData.businessName || name,
                kycData.firstName || name.split(' ')[0],
                kycData.lastName || name.split(' ')[1] || '',
                phone || null,
                kycData.taxId || kycData.idCard || null,
                kycData.bankName || null,
                kycData.bankAccountNumber || null,
                kycData.bankAccountName || name,
                kycData.address || null,
              ]
            );
          }

          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              message: 'ลงทะเบียนสมัครเป็นตัวแทน (Agent) สำเร็จ!',
              userId,
              agentId,
              code: agentCode,
            })
          );
          return;
        } catch (err) {
          console.error('[Register Agent Error]', err);
          res.statusCode = 200;
          res.end(JSON.stringify({ success: false, error: err.message || 'เกิดข้อผิดพลาดในการลงทะเบียน Agent' }));
          return;
        }
      }

      // ── AUTH: 4. POST /api/db/auth/register-merchant ───────────────
      if (url === '/api/db/auth/register-merchant' && req.method === 'POST') {
        try {
          const body = await parseJsonBody(req);
          const { email, password, name, phone, storeName, storeType, address, payoutBank, payoutAccountNo, payoutAccountName, kycData, referralCode } = body;

          if (!email || !password || !name || !storeName) {
            res.statusCode = 200;
            res.end(JSON.stringify({ success: false, error: 'กรุณากรอกข้อมูลที่จำเป็น (ชื่อ, อีเมล, รหัสผ่าน, ชื่อร้านค้า)' }));
            return;
          }

          const cleanEmail = String(email).trim().toLowerCase();
          const existing = await pool.query(`SELECT id FROM "User" WHERE LOWER(email) = $1 LIMIT 1;`, [cleanEmail]);
          if (existing.rows.length > 0) {
            res.statusCode = 200;
            res.end(JSON.stringify({ success: false, error: 'อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ หรือใช้อีเมลอื่น' }));
            return;
          }

          const userId = crypto.randomUUID();
          const storeId = crypto.randomUUID();
          const kycId = crypto.randomUUID();
          const merchantIdentityId = crypto.randomUUID();
          const hashedPassword = bcrypt.hashSync(password, 10);
          const merchantId = `S${Date.now().toString().slice(-9)}`;

          await pool.query(
            `INSERT INTO "User" (id, name, email, phone, password, role, "isActive", "createdAt", "updatedAt") 
             VALUES ($1, $2, $3, $4, $5, 'owner', true, NOW(), NOW());`,
            [userId, name, cleanEmail, phone || null, hashedPassword]
          );

          await pool.query(
            `INSERT INTO "Store" (id, name, description, address, phone, "userId", "isActive", currency, language, "isOnboarded", tier, "subscriptionStatus", "monthlyGmvUsed", "monthlyTxnCount", "storeType", "memberStatus", "payoutBankName", "payoutAccountNumber", "payoutAccountName", "referralCodeUsed", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, true, 'THB', 'th', false, 'FREE', 'active', 0.00, 0, $7, 'non_member', $8, $9, $10, $11, NOW(), NOW());`,
            [
              storeId,
              storeName,
              `${storeName} (ร้านค้า ChatPOS)`,
              address || null,
              phone || null,
              userId,
              storeType || 'MAIN',
              payoutBank || null,
              payoutAccountNo || null,
              payoutAccountName || name,
              referralCode || null,
            ]
          );

          await pool.query(
            `INSERT INTO "MerchantIdentity" (id, "merchantId", "clientId", "issuedType", "registeredAt", source, "issuedAt", "lockedAt", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, 'S', NOW(), 'chatpos', NOW(), NOW(), NOW(), NOW());`,
            [merchantIdentityId, merchantId, storeId]
          );

          if (kycData) {
            await pool.query(
              `INSERT INTO "KycVerification" (id, "userId", "businessName", "firstName", "lastName", phone, "taxId", "bankName", "bankAccountNumber", "bankAccountName", "businessAddress", status, "currentStep", "applicantType", "approvalLevel", "kycSize", "agreementAccepted", "submittedAt", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', 1, 'physical_store', 'pending', 'S', true, NOW(), NOW(), NOW());`,
              [
                kycId,
                userId,
                storeName,
                kycData.firstName || name.split(' ')[0],
                kycData.lastName || name.split(' ')[1] || '',
                phone || null,
                kycData.taxId || null,
                payoutBank || null,
                payoutAccountNo || null,
                payoutAccountName || name,
                address || null,
              ]
            );
          }

          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              message: 'ลงทะเบียนเปิดร้านค้าใหม่ (Merchant) สำเร็จ!',
              userId,
              storeId,
              merchantId,
            })
          );
          return;
        } catch (err) {
          console.error('[Register Merchant Error]', err);
          res.statusCode = 200;
          res.end(JSON.stringify({ success: false, error: err.message || 'เกิดข้อผิดพลาดในการลงทะเบียนร้านค้า' }));
          return;
        }
      }

      // ── 5. GET /api/db/health ──────────────────────────────────────
      if (url === '/api/db/health' || url.startsWith('/api/db/health?')) {
        const healthRes = await pool.query(`
          SELECT 
            current_database() as database, 
            current_user as user,
            version() as version,
            (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as total_tables;
        `);
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            status: 'connected',
            host: process.env.PGHOST,
            port: process.env.PGPORT,
            ...healthRes.rows[0],
          })
        );
        return;
      }

      // ── 6. GET /api/db/stats ────────────────────────────────────────
      if (url === '/api/db/stats' || url.startsWith('/api/db/stats?')) {
        assertRole(principal, ['admin', 'compliance']);
        const stats = await pool.query(`
          SELECT 
            (SELECT count(*) FROM "Store") as total_stores,
            (SELECT count(*) FROM "Store" WHERE "isActive" = true) as active_stores,
            (SELECT count(*) FROM "Agent") as total_agents,
            (SELECT count(*) FROM "ProvincialDirector") as total_pds,
            (SELECT count(*) FROM "Transaction") as total_transactions,
            (SELECT coalesce(sum(CAST("amount" as numeric)), 0) FROM "Transaction") as total_volume,
            (SELECT coalesce(sum(CAST("amount" as numeric)), 0) FROM "Transaction" WHERE "createdAt" >= CURRENT_DATE) as today_volume,
            (SELECT count(*) FROM "KycVerification" WHERE "status" = 'pending') as pending_kyc,
            (SELECT count(*) FROM "KycVerification" WHERE "status" = 'approved') as approved_kyc,
            (SELECT count(*) FROM "Product") as total_products,
            (SELECT coalesce(sum(CAST("amount" as numeric)), 0) FROM "CommissionLedger") as total_commission;
        `);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, stats: stats.rows[0] }));
        return;
      }

      if (requestPath === '/api/db/home' && req.method === 'GET') {
        const query = requestQuery(url);
        const storeId = await resolveAuthorizedStore({ principal, requestedStoreId: query.get('storeId') });
        const [storeResult, summaryResult, notificationResult] = await Promise.all([
          pool.query(`
            SELECT s.id, s.name, s."storeType", s."isActive", s.timezone, s.currency,
              mi."merchantId",
              CASE WHEN s."storeType" = 'MAIN' THEN 'สาขาหลัก' ELSE COALESCE('สาขา' || s."storeType", 'สาขาหลัก') END AS branch,
              CASE WHEN s."isActive" THEN 'open' ELSE 'closed' END AS "businessStatus"
            FROM "Store" s
            LEFT JOIN "MerchantIdentity" mi ON mi."clientId" = s.id
            WHERE s.id = $1
            LIMIT 1`, [storeId]),
          pool.query(`
            SELECT
              COUNT(*) FILTER (WHERE t."occurredAt" >= CURRENT_DATE AND t.status IN ('completed', 'paid', 'succeeded', 'settled'))::integer AS "todayTransactionCount",
              COALESCE(SUM(t.amount) FILTER (WHERE t."occurredAt" >= CURRENT_DATE AND t.status IN ('completed', 'paid', 'succeeded', 'settled')), 0) AS "todayGrossAmount",
              COALESCE(SUM(t.fee) FILTER (WHERE t."occurredAt" >= CURRENT_DATE AND t.status IN ('completed', 'paid', 'succeeded', 'settled')), 0) AS "todayFeeAmount",
              COALESCE(SUM(t."netAmount") FILTER (WHERE t."occurredAt" >= CURRENT_DATE AND t.status IN ('completed', 'paid', 'succeeded', 'settled')), 0) AS "todayNetAmount",
              COUNT(*) FILTER (WHERE t.status IN ('pending', 'processing'))::integer AS "pendingTransactionCount",
              COALESCE(SUM(t."netAmount") FILTER (WHERE t.status IN ('pending', 'processing')), 0) AS "pendingNetAmount",
              MAX(t."occurredAt") AS "latestTransactionAt"
            FROM "Transaction" t
            WHERE t."storeId" = $1`, [storeId]),
          pool.query(`
            SELECT COUNT(*)::integer AS count
            FROM notifications
            WHERE "storeId" = $1 AND "recipientId" = $2 AND "readAt" IS NULL`, [storeId, principal.id]),
        ]);
        if (storeResult.rowCount === 0) {
          throw new SecurityError('Store was not found', 'STORE_NOT_FOUND', 404);
        }
        const [capabilityResult, stoppayResult] = await Promise.all([
          pool.query(`SELECT "canViewBalance", "canViewTransactions", "canUseBenefits", "canUseStopPay", "canViewBilling", "updatedAt" FROM merchant_home_capabilities WHERE "storeId" = $1`, [storeId]),
          pool.query(`SELECT status, reason, "version", "updatedAt" FROM merchant_stoppay_controls WHERE "storeId" = $1`, [storeId]),
        ]);
        const capability = capabilityResult.rows[0] || {
          canViewBalance: false,
          canViewTransactions: true,
          canUseBenefits: false,
          canUseStopPay: false,
          canViewBilling: false,
          updatedAt: null,
        };
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          data: {
            store: storeResult.rows[0],
            user: {
              id: principal.id,
              displayName: principal.name,
              role: principal.role,
              allowedActions: Object.keys(stoppayTransitions[principal.role] || {}),
            },
            summary: {
              ...summaryResult.rows[0],
              availableBalance: null,
              balanceStatus: 'not_available',
              totalBalance: null,
              receivedToday: summaryResult.rows[0].todayNetAmount,
              availableToWithdraw: null,
              pendingAmount: summaryResult.rows[0].pendingNetAmount,
              asOf: summaryResult.rows[0].latestTransactionAt,
            },
            counts: {
              unreadNotifications: notificationResult.rows[0]?.count || 0,
              openOrders: null,
              queueWaiting: null,
              lowStockItems: null,
            },
            unreadNotificationCount: notificationResult.rows[0]?.count || 0,
            quickActions: [
              { id: 'transactions', target: '#transactions', enabled: capability.canViewTransactions, disabledReason: capability.canViewTransactions ? null : 'TRANSACTION_VIEW_FORBIDDEN' },
              { id: 'benefits', target: '#benefits', enabled: capability.canUseBenefits, disabledReason: capability.canUseBenefits ? null : 'BENEFITS_NOT_ENABLED' },
              { id: 'stoppay', target: '#stoppay', enabled: capability.canUseStopPay, disabledReason: capability.canUseStopPay ? null : 'STOPPAY_NOT_ENABLED' },
              { id: 'billing', target: '#billing', enabled: capability.canViewBilling, disabledReason: capability.canViewBilling ? null : 'BILLING_NOT_ENABLED' },
            ],
            capabilities: { ...capability, canStopPay: capability.canUseStopPay },
            stoppay: stoppayResult.rows[0] || { status: 'ACTIVE', reason: null, version: 1, updatedAt: null },
            freshness: {
              generatedAt: new Date().toISOString(),
              source: 'postgresql',
              cachePolicy: 'no-store',
              staleAfterSeconds: 60,
              timezone: storeResult.rows[0].timezone || 'Asia/Bangkok',
            },
          },
        }));
        return;
      }

      if (requestPath === '/api/db/capabilities' && req.method === 'GET') {
        const query = requestQuery(url);
        const storeId = await resolveAuthorizedStore({ principal, requestedStoreId: query.get('storeId') });
        const result = await pool.query(`
          SELECT "canViewBalance", "canViewTransactions", "canUseBenefits", "canUseStopPay", "canViewBilling", "metadataJson", "updatedAt"
          FROM merchant_home_capabilities WHERE "storeId" = $1`, [storeId]);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, data: result.rows[0] || { canViewBalance: false, canViewTransactions: true, canUseBenefits: false, canUseStopPay: false, canViewBilling: false, metadataJson: {}, updatedAt: null } }));
        return;
      }

      if (requestPath === '/api/db/benefits' && req.method === 'GET') {
        const query = requestQuery(url);
        const storeId = await resolveAuthorizedStore({ principal, requestedStoreId: query.get('storeId') });
        const page = boundedInteger(query.get('page'), 1, 1, 1000000);
        const limit = boundedInteger(query.get('limit'), 20, 1, 100);
        const offset = (page - 1) * limit;
        const result = await pool.query(`
          SELECT id, code, title, description, status, eligible, "startsAt", "expiresAt", "metadataJson", "updatedAt",
            COUNT(*) OVER()::integer AS "totalCount"
          FROM merchant_benefits
          WHERE "storeId" = $1 AND status = 'ACTIVE'
            AND ("startsAt" IS NULL OR "startsAt" <= NOW())
            AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
          ORDER BY COALESCE("expiresAt", 'infinity'::timestamptz), "createdAt" DESC
          LIMIT $2 OFFSET $3`, [storeId, limit, offset]);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, data: result.rows, pagination: { page, limit, total: result.rows[0]?.totalCount || 0 } }));
        return;
      }

      if (requestPath === '/api/db/notifications' && req.method === 'GET') {
        const query = requestQuery(url);
        const storeId = await resolveAuthorizedStore({ principal, requestedStoreId: query.get('storeId') });
        const page = boundedInteger(query.get('page'), 1, 1, 1000000);
        const limit = boundedInteger(query.get('limit'), 20, 1, 100);
        const offset = (page - 1) * limit;
        const category = String(query.get('category') || '').trim();
        const unreadOnly = query.get('unreadOnly') === 'true';
        const values = [storeId, principal.id];
        const filters = ['"storeId" = $1', '"recipientId" = $2'];
        if (category && ['orders', 'finance', 'kyc', 'system'].includes(category)) {
          values.push(category);
          filters.push(`category = $${values.length}`);
        }
        if (unreadOnly) filters.push('"readAt" IS NULL');
        values.push(limit, offset);
        const result = await pool.query(`
          SELECT id, category, type, title, message, "actionTarget", "metadataJson", "readAt", "createdAt", "updatedAt",
            COUNT(*) OVER()::integer AS "totalCount"
          FROM notifications
          WHERE ${filters.join(' AND ')}
          ORDER BY "createdAt" DESC
          LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, data: result.rows, pagination: { page, limit, total: result.rows[0]?.totalCount || 0 } }));
        return;
      }

      const notificationReadRoute = requestPath.match(/^\/api\/db\/notifications\/([^/]+)\/read$/);
      if (notificationReadRoute && req.method === 'POST') {
        const query = requestQuery(url);
        const storeId = await resolveAuthorizedStore({ principal, requestedStoreId: query.get('storeId') });
        const result = await pool.query(`
          UPDATE notifications
          SET "readAt" = COALESCE("readAt", NOW()), "updatedAt" = NOW()
          WHERE id = $1 AND "storeId" = $2 AND "recipientId" = $3
          RETURNING id, "readAt", "updatedAt"`, [notificationReadRoute[1], storeId, principal.id]);
        if (result.rowCount === 0) throw new SecurityError('Notification was not found', 'NOTIFICATION_NOT_FOUND', 404);
        await writeAudit({ poolOrClient: pool, principal, action: 'NOTIFICATION_READ', targetType: 'notification', targetId: notificationReadRoute[1], requestId: req.headers['x-request-id'] || null });
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, data: result.rows[0] }));
        return;
      }

      if (requestPath === '/api/db/notifications/read-all' && req.method === 'POST') {
        const query = requestQuery(url);
        const storeId = await resolveAuthorizedStore({ principal, requestedStoreId: query.get('storeId') });
        const result = await pool.query(`
          UPDATE notifications SET "readAt" = COALESCE("readAt", NOW()), "updatedAt" = NOW()
          WHERE "storeId" = $1 AND "recipientId" = $2 AND "readAt" IS NULL`, [storeId, principal.id]);
        await writeAudit({ poolOrClient: pool, principal, action: 'NOTIFICATIONS_READ_ALL', targetType: 'store', targetId: storeId, after: { count: result.rowCount }, requestId: req.headers['x-request-id'] || null });
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, data: { markedCount: result.rowCount } }));
        return;
      }

      if (requestPath === '/api/db/stoppay' && req.method === 'GET') {
        const query = requestQuery(url);
        const storeId = await resolveAuthorizedStore({ principal, requestedStoreId: query.get('storeId') });
        const result = await pool.query(`SELECT "storeId", status, reason, "version", "updatedBy", "updatedAt" FROM merchant_stoppay_controls WHERE "storeId" = $1`, [storeId]);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, data: result.rows[0] || { storeId, status: 'ACTIVE', reason: null, version: 1, updatedBy: null, updatedAt: null }, transitions: stoppayTransitions[principal.role] || {} }));
        return;
      }

      if (requestPath === '/api/db/stoppay' && req.method === 'POST') {
        assertRole(principal, ['merchant', 'admin', 'compliance']);
        await enforcePrincipalRateLimit({ principal, requestPath, limit: 20, windowSeconds: 300 });
        const body = await parseJsonBody(req);
        const idempotencyKey = requestIdempotencyKey(req, body);
        if (!idempotencyKey || idempotencyKey.length > 200) {
          throw new SecurityError('Idempotency-Key is required', 'IDEMPOTENCY_KEY_REQUIRED', 400);
        }
        const action = String(body.action || '').trim();
        const transition = getStoppayTransition(principal.role, action);
        if (!transition) throw new SecurityError('STOPPAY action is not allowed for this role', 'STOPPAY_ACTION_FORBIDDEN', 403);
        const storeId = await resolveAuthorizedStore({ principal, requestedStoreId: body.storeId });
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const existingEvent = await client.query(`SELECT "eventId", "toStatus", "createdAt" FROM merchant_stoppay_events WHERE "storeId" = $1 AND "idempotencyKey" = $2`, [storeId, idempotencyKey]);
          if (existingEvent.rowCount > 0) {
            await client.query('COMMIT');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, idempotentReplay: true, data: existingEvent.rows[0] }));
            return;
          }
          if (principal.role === 'merchant') {
            const capability = await client.query(`SELECT "canUseStopPay" FROM merchant_home_capabilities WHERE "storeId" = $1`, [storeId]);
            if (capability.rowCount > 0 && capability.rows[0].canUseStopPay !== true) throw new SecurityError('STOPPAY is not enabled for this Store', 'STOPPAY_NOT_ENABLED', 403);
          }
          await client.query(`INSERT INTO merchant_stoppay_controls ("storeId") VALUES ($1) ON CONFLICT ("storeId") DO NOTHING`, [storeId]);
          const current = await client.query(`SELECT status, reason, "version" FROM merchant_stoppay_controls WHERE "storeId" = $1 FOR UPDATE`, [storeId]);
          const currentState = current.rows[0];
          const validTransition = getStoppayTransition(principal.role, action, currentState.status);
          if (!validTransition) throw new SecurityError(`STOPPAY cannot transition from ${currentState.status}`, 'STOPPAY_INVALID_TRANSITION', 409);
          const reason = String(body.reason || '').trim().slice(0, 1000) || null;
          const eventId = crypto.randomUUID();
          await client.query(`
            INSERT INTO merchant_stoppay_events ("storeId", "eventId", "idempotencyKey", action, "fromStatus", "toStatus", reason, "actorId", "actorRole", "requestId")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [storeId, eventId, idempotencyKey, action, currentState.status, transition.to, reason, principal.id, principal.role, req.headers['x-request-id'] || null]);
          await client.query(`UPDATE merchant_stoppay_controls SET status = $2, reason = $3, "version" = "version" + 1, "lastEventId" = $4, "updatedBy" = $5, "updatedAt" = NOW() WHERE "storeId" = $1`, [storeId, transition.to, reason, eventId, principal.id]);
          await writeAudit({ poolOrClient: client, principal, action: 'STOPPAY_TRANSITION', targetType: 'stoppay_control', targetId: storeId, reason, before: { status: currentState.status, version: currentState.version }, after: { status: transition.to, eventId }, requestId: req.headers['x-request-id'] || null });
          await client.query('COMMIT');
          res.statusCode = 201;
          res.end(JSON.stringify({ success: true, idempotentReplay: false, data: { eventId, storeId, status: transition.to, action, reason } }));
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
        return;
      }

      // ── 7. GET /api/db/assignments ────────────────────────────────
      if (requestPath === '/api/db/assignments' && req.method === 'GET') {
        const query = new URL(`http://127.0.0.1${url}`).searchParams;
        const requestedStoreId = await resolveAuthorizedStore({
          principal,
          requestedStoreId: query.get('storeId'),
          allowUnscoped: ['admin', 'compliance'].includes(principal.role),
        });
        if (requestedStoreId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedStoreId)) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, code: 'INVALID_STORE_ID', error: 'storeId must be a UUID' }));
          return;
        }

        const assignmentQuery = requestedStoreId
          ? {
              text: `
                SELECT
                  aa.id,
                  aa."assignmentRequestId",
                  aa."sourceRequestId",
                  aa.status,
                  aa.reason,
                  aa."createdAt",
                  aa."updatedAt",
                  aa."acceptedAt",
                  aa."rejectedAt",
                  aa."expiresAt",
                  CASE WHEN aa.status = 'ACCEPTED' THEN a.code ELSE NULL END AS agent_code,
                  CASE WHEN aa.status = 'ACCEPTED' THEN pd.code ELSE NULL END AS pd_code,
                  CASE WHEN aa.status = 'ACCEPTED' THEN pd."displayName" ELSE NULL END AS pd_name
                FROM agent_assignments aa
                LEFT JOIN "Agent" a ON aa."agentId" = a.id
                LEFT JOIN "ProvincialDirector" pd ON aa."pdId" = pd.id
                WHERE aa."storeId" = $1
                ORDER BY aa."createdAt" DESC
                LIMIT 20`,
              values: [requestedStoreId],
            }
          : {
              text: `
                SELECT
                  aa.id,
                  aa."assignmentRequestId",
                  aa."sourceRequestId",
                  aa.status,
                  aa.reason,
                  aa."createdAt",
                  aa."updatedAt",
                  aa."acceptedAt",
                  aa."rejectedAt",
                  aa."expiresAt",
                  CASE WHEN aa.status = 'ACCEPTED' THEN a.code ELSE NULL END AS agent_code,
                  CASE WHEN aa.status = 'ACCEPTED' THEN pd.code ELSE NULL END AS pd_code,
                  CASE WHEN aa.status = 'ACCEPTED' THEN pd."displayName" ELSE NULL END AS pd_name
                FROM agent_assignments aa
                LEFT JOIN "Agent" a ON aa."agentId" = a.id
                LEFT JOIN "ProvincialDirector" pd ON aa."pdId" = pd.id
                ORDER BY aa."createdAt" DESC
                LIMIT 20`,
              values: [],
            };
        const assignments = await pool.query(assignmentQuery);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, data: assignments.rows }));
        return;
      }

      if (requestPath === '/api/db/kyc/workspace' && req.method === 'GET') {
        const query = new URL(url, 'http://localhost').searchParams;
        const storeId = await resolveAuthorizedStore({ principal, requestedStoreId: query.get('storeId') });
        const workspace = await getKycWorkspace({ pool, storeId });
        await writeAudit({ poolOrClient: pool, principal, action: 'KYC_WORKSPACE_VIEWED', targetType: 'store', targetId: storeId, requestId: req.headers['x-request-id'] || null });
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, data: workspace }));
        return;
      }

      const kycMessageRoute = requestPath.match(/^\/api\/db\/kyc\/cases\/([^/]+)\/messages$/);
      if (kycMessageRoute && req.method === 'GET') {
        const query = new URL(url, 'http://localhost').searchParams;
        const storeId = await resolveAuthorizedStore({ principal, requestedStoreId: query.get('storeId') });
        await assertCaseAccess({ pool, principal, caseId: kycMessageRoute[1] });
        const workspace = await getKycWorkspace({ pool, storeId });
        const messages = workspace.case.id === kycMessageRoute[1] ? workspace.messages : [];
        if (!messages.length && workspace.case.id !== kycMessageRoute[1]) {
          throw new ProfileKycError('KYC case was not found', 'KYC_CASE_NOT_FOUND', 404);
        }
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, data: messages }));
        return;
      }

      if (kycMessageRoute && req.method === 'POST') {
        await enforcePrincipalRateLimit({ principal, requestPath: '/api/db/kyc/messages', limit: 60, windowSeconds: 60 });
        const body = await parseJsonBody(req);
        const storeId = await assertCaseAccess({ pool, principal, caseId: kycMessageRoute[1] });
        if (Object.prototype.hasOwnProperty.call(body, 'storeId') || Object.prototype.hasOwnProperty.call(body, 'senderId') || Object.prototype.hasOwnProperty.call(body, 'senderRole')) {
          throw new ProfileKycError('Message ownership fields must come from request context', 'MESSAGE_CONTEXT_FORBIDDEN', 422);
        }
        const message = await appendKycMessage({
          pool,
          storeId,
          caseId: kycMessageRoute[1],
          body,
          actorId: principal.id,
          actorRole: principal.role,
        });
        await writeAudit({ poolOrClient: pool, principal, action: 'KYC_MESSAGE_SENT', targetType: 'kyc_case', targetId: kycMessageRoute[1], after: { messageId: message.id }, requestId: req.headers['x-request-id'] || null });
        res.statusCode = 201;
        res.end(JSON.stringify({ success: true, data: message }));
        return;
      }

      const readMessageRoute = requestPath.match(/^\/api\/db\/kyc\/cases\/([^/]+)\/messages\/([^/]+)\/read$/);
      if (readMessageRoute && req.method === 'PATCH') {
        const query = new URL(url, 'http://localhost').searchParams;
        const storeId = await assertCaseAccess({ pool, principal, caseId: readMessageRoute[1] });
        const message = await markKycMessageRead({ pool, storeId, caseId: readMessageRoute[1], messageId: readMessageRoute[2] });
        await writeAudit({ poolOrClient: pool, principal, action: 'KYC_MESSAGE_READ', targetType: 'kyc_message', targetId: readMessageRoute[2], requestId: req.headers['x-request-id'] || null });
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, data: message }));
        return;
      }

      const documentAccessRoute = requestPath.match(/^\/api\/db\/kyc\/documents\/([^/]+)\/access$/);
      if (documentAccessRoute && req.method === 'GET') {
        const query = new URL(url, 'http://localhost').searchParams;
        const storeId = await resolveAuthorizedStore({ principal, requestedStoreId: query.get('storeId') });
        const document = await getDocumentAccess({ pool, storeId, versionId: documentAccessRoute[1], documentLinkTtlSeconds: backofficeConfig.documentLinkTtlSeconds, publicBaseUrl: process.env.NEXT_PUBLIC_APP_URL });
        await writeAudit({ poolOrClient: pool, principal, action: 'KYC_DOCUMENT_ACCESSED', targetType: 'document_version', targetId: documentAccessRoute[1], requestId: req.headers['x-request-id'] || null });
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, data: document }));
        return;
      }

      // ── 8. GET /api/db/kyc ──────────────────────────────────────────
      if (url === '/api/db/kyc' || url.startsWith('/api/db/kyc?')) {
        const kycQuery = new URL(`http://127.0.0.1${url}`).searchParams;
        const requestedStoreId = kycQuery.get('storeId');
        const storeId = requestedStoreId
          ? await resolveAuthorizedStore({ principal, requestedStoreId })
          : null;
        let scopeClause = '';
        const scopeValues = [];
        if (storeId) {
          scopeValues.push(storeId);
          scopeClause = 'WHERE s.id = $1';
        } else if (principal.role === 'merchant') {
          scopeValues.push(principal.id);
          scopeClause = 'WHERE s."userId" = $1';
        } else if (principal.role === 'agent') {
          scopeValues.push(principal.id);
          scopeClause = 'WHERE s."currentAgentId" IN (SELECT id FROM "Agent" WHERE "userId" = $1)';
        } else if (principal.role === 'pd') {
          scopeValues.push(principal.id);
          scopeClause = 'WHERE s."currentPdId" IN (SELECT id FROM "ProvincialDirector" WHERE "userId" = $1)';
        } else {
          assertRole(principal, ['admin', 'compliance']);
        }
        const result = await pool.query(`
          SELECT 
            k.id,
            k."businessName",
            k."firstName",
            k."lastName",
            k."phone",
            k."status",
            k."businessType",
            k."approvalLevel",
            k."kycSize",
            k."taxId",
            k."bankName",
            k."bankAccountNumber",
            k."bankAccountName",
            k."currentAddress",
            k."reviewNotes",
            k."submittedAt",
            k."reviewedAt",
            k."createdAt",
            k."updatedAt",
            u.email as user_email,
            u.name as user_name
          FROM "KycVerification" k
          LEFT JOIN "User" u ON k."userId" = u.id
          LEFT JOIN "Store" s ON s."userId" = k."userId"
          ${scopeClause}
          ORDER BY k."createdAt" DESC
          LIMIT 100;
        `, scopeValues);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, count: result.rows.length, data: result.rows }));
        return;
      }

      // ── 9. GET /api/db/stores ──────────────────────────────────────
      if (url === '/api/db/stores' || url.startsWith('/api/db/stores?')) {
        const storesQuery = new URL(`http://127.0.0.1${url}`).searchParams;
        const requestedStoreId = storesQuery.get('storeId');
        let storeScopeClause = '';
        const storeScopeValues = [];
        if (requestedStoreId) {
          const storeId = await resolveAuthorizedStore({ principal, requestedStoreId });
          storeScopeValues.push(storeId);
          storeScopeClause = 'WHERE s.id = $1';
        } else if (principal.role === 'merchant') {
          storeScopeValues.push(principal.id);
          storeScopeClause = 'WHERE s."userId" = $1';
        } else if (principal.role === 'agent') {
          storeScopeValues.push(principal.id);
          storeScopeClause = 'WHERE s."currentAgentId" IN (SELECT id FROM "Agent" WHERE "userId" = $1)';
        } else if (principal.role === 'pd') {
          storeScopeValues.push(principal.id);
          storeScopeClause = 'WHERE s."currentPdId" IN (SELECT id FROM "ProvincialDirector" WHERE "userId" = $1)';
        } else {
          assertRole(principal, ['admin', 'compliance']);
        }
        const result = await pool.query(`
          SELECT 
            s.id,
            s.name,
            s.description,
            s.phone,
            s.address,
            s."storeType",
            s.tier,
            s."isActive",
            s."monthlyGmvUsed",
            s."monthlyTxnCount",
            s."accountNumber",
            s."payoutBankName",
            s."payoutAccountNumber",
            s."payoutAccountName",
            s.timezone,
            s.currency,
            s."createdAt",
            s."updatedAt",
            mi."merchantId",
            u.name as owner_name,
            u.email as owner_email,
            a.code as agent_code,
            pd.code as pd_code,
            pd."displayName" as pd_name
          FROM "Store" s
          LEFT JOIN "MerchantIdentity" mi ON s.id = mi."clientId"
          LEFT JOIN "User" u ON s."userId" = u.id
          LEFT JOIN "Agent" a ON s."currentAgentId" = a.id
          LEFT JOIN "ProvincialDirector" pd ON s."currentPdId" = pd.id
          ${storeScopeClause}
          ORDER BY s."createdAt" DESC
          LIMIT 100;
        `, storeScopeValues);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, count: result.rows.length, data: result.rows }));
        return;
      }

      // ── 10. GET /api/db/agents ─────────────────────────────────────
      if (url === '/api/db/agents' || url.startsWith('/api/db/agents?')) {
        assertRole(principal, ['admin', 'compliance', 'pd']);
        const result = await pool.query(`
          SELECT 
            a.id,
            a.code,
            a.tier,
            a.status,
            a."walletBalance",
            a."adBudget",
            a."baseAllowance",
            a."createdAt",
            u.name as agent_name,
            u.email as agent_email,
            u.phone as agent_phone,
            pd.code as pd_code,
            pd."displayName" as pd_name,
            (SELECT count(*) FROM "Store" WHERE "currentAgentId" = a.id) as stores_count,
            (SELECT coalesce(sum(CAST("amount" as numeric)), 0) FROM "CommissionLedger" WHERE "agentId" = a.id) as earned_commission
          FROM "Agent" a
          LEFT JOIN "User" u ON a."userId" = u.id
          LEFT JOIN "ProvincialDirector" pd ON a."currentPdId" = pd.id
          ORDER BY a."createdAt" DESC;
        `);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, count: result.rows.length, data: result.rows }));
        return;
      }

      // ── 10. GET /api/db/pds ────────────────────────────────────────
      if (url === '/api/db/pds' || url.startsWith('/api/db/pds?')) {
        assertRole(principal, ['admin', 'compliance']);
        const result = await pool.query(`
          SELECT 
            pd.id,
            pd.code,
            pd."displayName",
            pd.status,
            pd."investmentAmount",
            pd."startedAt",
            pd."createdAt",
            u.name as pd_owner_name,
            u.email as pd_email,
            u.phone as pd_phone,
            (SELECT count(*) FROM "Agent" WHERE "currentPdId" = pd.id) as agent_count,
            (SELECT count(*) FROM "Store" WHERE "currentPdId" = pd.id) as store_count,
            (SELECT coalesce(sum(CAST("amount" as numeric)), 0) FROM "CommissionLedger" WHERE "pdId" = pd.id) as total_pd_commission
          FROM "ProvincialDirector" pd
          LEFT JOIN "User" u ON pd."userId" = u.id
          ORDER BY pd."createdAt" DESC;
        `);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, count: result.rows.length, data: result.rows }));
        return;
      }

      // ── 11. GET /api/db/transactions ───────────────────────────────
      if (url === '/api/db/transactions' || url.startsWith('/api/db/transactions?')) {
        const query = requestQuery(url);
        const transactionScopeValues = [];
        const filters = [];
        const requestedStoreId = query.get('storeId');
        if (requestedStoreId) {
          const storeId = await resolveAuthorizedStore({ principal, requestedStoreId });
          transactionScopeValues.push(storeId);
          filters.push(`t."storeId" = $${transactionScopeValues.length}`);
        } else if (principal.role === 'merchant') {
          transactionScopeValues.push(principal.id);
          filters.push(`s."userId" = $${transactionScopeValues.length}`);
        } else if (principal.role === 'agent') {
          transactionScopeValues.push(principal.id);
          filters.push(`s."currentAgentId" IN (SELECT id FROM "Agent" WHERE "userId" = $${transactionScopeValues.length})`);
        } else if (principal.role === 'pd') {
          transactionScopeValues.push(principal.id);
          filters.push(`s."currentPdId" IN (SELECT id FROM "ProvincialDirector" WHERE "userId" = $${transactionScopeValues.length})`);
        } else {
          assertRole(principal, ['admin', 'compliance']);
        }
        const transactionFilters = getTransactionFilters(query);
        Object.entries(transactionFilters).forEach(([key, value]) => {
          if (value) {
            transactionScopeValues.push(value);
            filters.push(`t."${key}" = $${transactionScopeValues.length}`);
          }
        });
        const from = query.get('from');
        const to = query.get('to');
        if (from && !Number.isNaN(Date.parse(from))) {
          transactionScopeValues.push(from);
          filters.push(`COALESCE(t."occurredAt", t."createdAt") >= $${transactionScopeValues.length}`);
        }
        if (to && !Number.isNaN(Date.parse(to))) {
          transactionScopeValues.push(to);
          filters.push(`COALESCE(t."occurredAt", t."createdAt") < $${transactionScopeValues.length}`);
        }
        const page = boundedInteger(query.get('page'), 1, 1, 1000000);
        const limit = boundedInteger(query.get('limit'), 50, 1, 100);
        const offset = (page - 1) * limit;
        transactionScopeValues.push(limit, offset);
        const result = await pool.query(`
          SELECT 
            t.id,
            t.reference,
            t.amount,
            t.fee,
            t."netAmount",
            t.channel,
            t.status,
            t."customerName",
            t."customerPhone",
            t.note,
            t."paymentMethod",
            t."isSettled",
            t.currency,
            t."transactionType",
            t."refundOfId",
            t."payoutReference",
            COALESCE(t."occurredAt", t."createdAt") AS "occurredAt",
            t."paidAt",
            t."createdAt",
            s.name as store_name,
            COUNT(*) OVER()::integer AS "totalCount"
          FROM "Transaction" t
          LEFT JOIN "Store" s ON t."storeId" = s.id
          ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
          ORDER BY COALESCE(t."occurredAt", t."createdAt") DESC
          LIMIT $${transactionScopeValues.length - 1} OFFSET $${transactionScopeValues.length};
        `, transactionScopeValues);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, count: result.rows.length, data: result.rows, pagination: { page, limit, total: result.rows[0]?.totalCount || 0 } }));
        return;
      }

      // ── 11.1 POST /api/db/transactions/create ───────────────────────
      if (req.method === 'POST' && url === '/api/db/transactions/create') {
        assertRole(principal, ['merchant']);
        await enforcePrincipalRateLimit({ principal, requestPath, limit: 30, windowSeconds: 60 });
        try {
          const body = await parseJsonBody(req);
          const {
            amount,
            storeId,
            channel = 'promptpay',
            paymentMethod = 'PromptPay พร้อมเพย์ QR',
            customerName = 'ลูกค้าหน้าร้าน',
            customerPhone = null,
            tableName = 'คิดเงินหน้าร้าน',
            note = 'ชำระเงินผ่านระบบ PromptPay QR',
            origin = 'POS',
            transactionType = 'payment',
          } = body;
          const idempotencyKey = requestIdempotencyKey(req, body);
          if (!idempotencyKey || idempotencyKey.length > 200) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'Idempotency-Key is required' }));
            return;
          }
          if (transactionType !== 'payment') {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, code: 'TRANSACTION_TYPE_NOT_ALLOWED', error: 'Only payment records may be created by this endpoint' }));
            return;
          }

          const id = crypto.randomUUID();
          const reference = `TXN-${Date.now().toString().slice(-8)}`;
          const parsedAmount = Number.parseFloat(amount);
          if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 1000000000000) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, code: 'AMOUNT_INVALID', error: 'amount must be greater than zero' }));
            return;
          }
          const fee = 0;
          const netAmount = parsedAmount.toFixed(2);

          const targetStoreId = await resolveAuthorizedStore({ principal, requestedStoreId: storeId });
          const existing = await pool.query(`
            SELECT * FROM "Transaction"
            WHERE "storeId" = $1 AND "idempotencyKey" = $2
            LIMIT 1`, [targetStoreId, idempotencyKey]);
          if (existing.rowCount > 0) {
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, idempotentReplay: true, transaction: existing.rows[0] }));
            return;
          }

          const insertRes = await pool.query(
            `
            INSERT INTO "Transaction" (
              id, reference, amount, fee, "netAmount", channel, status,
              "storeId", "userId", currency, "transactionType", "kitchenStatus", origin,
              "paymentMethod", "paymentMethodLabel", "customerName", "customerPhone",
              "tableName", note, "idempotencyKey", "createdAt", "updatedAt", "paidAt", "occurredAt"
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10, $11, $12, $13,
              $14, $15, $16, $17,
              $18, $19, $20, NOW(), NOW(), NOW(), NOW()
            )
            ON CONFLICT ("storeId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL DO NOTHING
            RETURNING *;
            `,
            [
              id,
              reference,
              parsedAmount,
              fee,
              netAmount,
              channel,
              'completed',
              targetStoreId,
              principal.id,
              'THB',
              transactionType,
              'SERVED',
              origin,
              paymentMethod,
              paymentMethod,
              customerName,
              customerPhone,
              tableName,
              note,
              idempotencyKey,
            ]
          );

          if (insertRes.rowCount === 0) {
            const replay = await pool.query(`SELECT * FROM "Transaction" WHERE "storeId" = $1 AND "idempotencyKey" = $2 LIMIT 1`, [targetStoreId, idempotencyKey]);
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, idempotentReplay: true, transaction: replay.rows[0] || null }));
            return;
          }

          await writeAudit({ poolOrClient: pool, principal, action: 'TRANSACTION_CREATED', targetType: 'transaction', targetId: id, after: { storeId: targetStoreId, transactionType, amount: netAmount }, requestId: req.headers['x-request-id'] || null });
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, idempotentReplay: false, transaction: insertRes.rows[0] }));
          return;
        } catch (err) {
          console.error('Error creating real transaction:', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message || 'Failed to create transaction' }));
          return;
        }
      }

      // ── 12. GET /api/db/products ───────────────────────────────────
      if (url === '/api/db/products' || url.startsWith('/api/db/products?')) {
        const result = await pool.query(`
          SELECT 
            p.id,
            p.name,
            p.description,
            p.price,
            p.cost,
            p.stock,
            p.category,
            p.image,
            p.sku,
            p."isActive",
            p."trackStock",
            p."createdAt",
            s.name as store_name
          FROM "Product" p
          LEFT JOIN "Store" s ON p."storeId" = s.id
          ORDER BY p."createdAt" DESC
          LIMIT 100;
        `);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, count: result.rows.length, data: result.rows }));
        return;
      }

      // ── 13. GET /api/db/commissions ────────────────────────────────
      if (url === '/api/db/commissions' || url.startsWith('/api/db/commissions?')) {
        const commissionScopeValues = [];
        let commissionScopeClause = '';
        if (principal.role === 'merchant') {
          commissionScopeValues.push(principal.id);
          commissionScopeClause = 'WHERE s."userId" = $1';
        } else if (principal.role === 'agent') {
          commissionScopeValues.push(principal.id);
          commissionScopeClause = 'WHERE c."agentId" IN (SELECT id FROM "Agent" WHERE "userId" = $1)';
        } else if (principal.role === 'pd') {
          commissionScopeValues.push(principal.id);
          commissionScopeClause = 'WHERE c."pdId" IN (SELECT id FROM "ProvincialDirector" WHERE "userId" = $1)';
        } else {
          assertRole(principal, ['admin', 'compliance']);
        }
        const result = await pool.query(`
          SELECT 
            c.id,
            c."sourceType",
            c."sourceRef",
            c."beneficiaryType",
            c.amount,
            c."grossAmount",
            c."ratePercent",
            c.status,
            c."ruleCode",
            c."earnedAt",
            c."createdAt",
            a.code as agent_code,
            pd.code as pd_code,
            s.name as store_name
          FROM "CommissionLedger" c
          LEFT JOIN "Agent" a ON c."agentId" = a.id
          LEFT JOIN "ProvincialDirector" pd ON c."pdId" = pd.id
          LEFT JOIN "Store" s ON c."storeId" = s.id
          ${commissionScopeClause}
          ORDER BY c."createdAt" DESC
          LIMIT 100;
        `, commissionScopeValues);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, count: result.rows.length, data: result.rows }));
        return;
      }

      // ── 14. POST /api/db/kyc/update-status ─────────────────────────
      if (url === '/api/db/kyc/update-status' && req.method === 'POST') {
        assertRole(principal, ['admin', 'compliance']);
        await enforcePrincipalRateLimit({ principal, requestPath, limit: 60, windowSeconds: 60 });
        const body = await parseJsonBody(req);
        const { id, status, reviewNotes } = body;
        if (!id || !status) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'id and status required' }));
          return;
        }

        const beforeResult = await pool.query('SELECT id, status, "reviewNotes" FROM "KycVerification" WHERE id = $1', [id]);
        if (beforeResult.rowCount === 0) {
          res.statusCode = 404;
          res.end(JSON.stringify({ success: false, error: 'KYC record not found' }));
          return;
        }
        await pool.query(
          `UPDATE "KycVerification" 
           SET "status" = $1, "reviewNotes" = $2, "reviewedAt" = NOW(), "updatedAt" = NOW() 
           WHERE id = $3;`,
          [status, reviewNotes || null, id]
        );
        await writeAudit({ poolOrClient: pool, principal, action: 'KYC_STATUS_UPDATED', targetType: 'kyc_verification', targetId: id, before: beforeResult.rows[0], after: { status, reviewNotes: reviewNotes || null }, requestId: req.headers['x-request-id'] || null });

        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: 'KYC status updated successfully' }));
        return;
      }

      // ── PHASE 4: LLGW payment webhook ───────────────────────────────
      if (req.method === 'POST' && requestPath === '/api/webhooks/payment-status') {
        if (!backofficeConfig.paymentStatusWebhookEnabled) {
          res.statusCode = 503;
          res.end(JSON.stringify({ success: false, error: { code: 'PAYMENT_STATUS_WEBHOOK_DISABLED', message: 'Payment status webhook is disabled' } }));
          return;
        }
        const rawBody = await readRawBody(req);
        try {
          const verified = verifyPaymentStatusWebhook({
            rawBody,
            headers: req.headers,
            secret: backofficeConfig.paymentStatusWebhookSecrets?.length
              ? backofficeConfig.paymentStatusWebhookSecrets
              : backofficeConfig.paymentStatusWebhookSecret,
            toleranceSeconds: backofficeConfig.paymentStatusTimestampToleranceSeconds,
          });
          let body;
          try {
            body = JSON.parse(rawBody || '{}');
          } catch {
            throw new TransactionRoutingError('Payment status webhook body must be valid JSON', 'INVALID_WEBHOOK_JSON');
          }
          const result = await processPaymentWebhook({
            pool,
            rawBody,
            body,
            verified,
            provider: 'backoffice-payment-status',
            commissionConfig: {
              enabled: backofficeConfig.commissionEventEnabled,
              sourceUrl: backofficeConfig.commissionEventSourceUrl,
              webhookSecret: backofficeConfig.commissionWebhookSecret,
              grossBenefitField: backofficeConfig.commissionGrossBenefitField,
            },
          });
          await writeAudit({
            poolOrClient: pool,
            actorId: null,
            actorRole: 'backoffice',
            action: 'PAYMENT_STATUS_WEBHOOK_PROCESSED',
            targetType: 'transaction',
            targetId: result.transaction?.id || body.transactionId || body.transactionReference,
            after: { status: result.transaction?.status || null, duplicate: Boolean(result.duplicate), late: Boolean(result.late) },
            requestId: verified.eventId,
          });
          let settlement = null;
          if (result.settlementEvent) {
            try {
              settlement = await dispatchSettlementEvent({
                pool,
                eventId: result.settlementEvent.eventId,
                config: {
                  enabled: backofficeConfig.commissionEventEnabled,
                  sourceUrl: backofficeConfig.commissionEventSourceUrl,
                  webhookSecret: backofficeConfig.commissionWebhookSecret,
                },
              });
              await writeAudit({ poolOrClient: pool, actorRole: 'system', action: 'SETTLEMENT_SENT', targetType: 'settlement_event', targetId: result.settlementEvent.eventId, after: { sent: Boolean(settlement.sent) }, requestId: verified.eventId });
            } catch (settlementError) {
              await writeAudit({ poolOrClient: pool, actorRole: 'system', action: 'SETTLEMENT_SEND_FAILED', targetType: 'settlement_event', targetId: result.settlementEvent.eventId, after: { code: settlementError.code || 'SETTLEMENT_SEND_FAILED' }, requestId: verified.eventId });
              settlement = { sent: false, pending: true, code: settlementError.code || 'SETTLEMENT_SEND_FAILED' };
            }
          }
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            duplicate: Boolean(result.duplicate),
            late: Boolean(result.late),
            transaction: result.transaction || null,
            settlement,
          }));
        } catch (error) {
          const statusCode = error.statusCode || 400;
          res.statusCode = statusCode;
          res.end(JSON.stringify({ success: false, error: { code: error.code || 'PAYMENT_STATUS_WEBHOOK_FAILED', message: error.message } }));
        }
        return;
      }

      // ── PHASE 4: LLGW payment webhook ───────────────────────────────
      if (req.method === 'POST' && requestPath === '/api/webhooks/llgw/payment') {
        if (!backofficeConfig.llgwPaymentWebhookEnabled) {
          res.statusCode = 503;
          res.end(JSON.stringify({ success: false, error: { code: 'LLGW_PAYMENT_WEBHOOK_DISABLED', message: 'LLGW payment webhook is disabled' } }));
          return;
        }
        const rawBody = await readRawBody(req);
        try {
          const verified = verifyLlgwWebhook({
            rawBody,
            headers: req.headers,
            secret: backofficeConfig.llgwPaymentWebhookSecrets?.length ? backofficeConfig.llgwPaymentWebhookSecrets : backofficeConfig.llgwPaymentWebhookSecret,
            toleranceSeconds: backofficeConfig.llgwTimestampToleranceSeconds,
          });
          let body;
          try {
            body = JSON.parse(rawBody || '{}');
          } catch {
            throw new TransactionRoutingError('LLGW webhook body must be valid JSON', 'INVALID_WEBHOOK_JSON');
          }
          const result = await processPaymentWebhook({
            pool,
            rawBody,
            body,
            verified,
            commissionConfig: {
              enabled: backofficeConfig.commissionEventEnabled,
              sourceUrl: backofficeConfig.commissionEventSourceUrl,
              webhookSecret: backofficeConfig.commissionWebhookSecret,
              grossBenefitField: backofficeConfig.commissionGrossBenefitField,
            },
          });
          await writeAudit({
            poolOrClient: pool,
            actorId: null,
            actorRole: 'llgw',
            action: 'PAYMENT_WEBHOOK_PROCESSED',
            targetType: 'transaction',
            targetId: result.transaction?.id || body.paymentReference || body.clientReference,
            after: { status: result.transaction?.status || null, duplicate: Boolean(result.duplicate), late: Boolean(result.late) },
            requestId: verified.eventId,
          });
          let settlement = null;
          if (result.settlementEvent) {
            try {
              settlement = await dispatchSettlementEvent({
                pool,
                eventId: result.settlementEvent.eventId,
                config: {
                  enabled: backofficeConfig.commissionEventEnabled,
                  sourceUrl: backofficeConfig.commissionEventSourceUrl,
                  webhookSecret: backofficeConfig.commissionWebhookSecret,
                },
              });
              await writeAudit({ poolOrClient: pool, actorRole: 'system', action: 'SETTLEMENT_SENT', targetType: 'settlement_event', targetId: result.settlementEvent.eventId, after: { sent: Boolean(settlement.sent) }, requestId: verified.eventId });
            } catch (settlementError) {
              await writeAudit({ poolOrClient: pool, actorRole: 'system', action: 'SETTLEMENT_SEND_FAILED', targetType: 'settlement_event', targetId: result.settlementEvent.eventId, after: { code: settlementError.code || 'SETTLEMENT_SEND_FAILED' }, requestId: verified.eventId });
              settlement = { sent: false, pending: true, code: settlementError.code || 'SETTLEMENT_SEND_FAILED' };
            }
          }
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            duplicate: Boolean(result.duplicate),
            late: Boolean(result.late),
            transaction: result.transaction || null,
            settlement,
          }));
        } catch (error) {
          const statusCode = error.statusCode || 400;
          res.statusCode = statusCode;
          res.end(JSON.stringify({ success: false, error: { code: error.code || 'WEBHOOK_FAILED', message: error.message } }));
        }
        return;
      }

      // ── PHASE 4: signed transaction command ─────────────────────────
      if (req.method === 'POST' && requestPath === '/api/v1/transactions') {
        assertRole(principal, ['merchant']);
        await enforcePrincipalRateLimit({ principal, requestPath, limit: 30, windowSeconds: 60 });
        if (!backofficeConfig.transactionRoutingEnabled) {
          res.statusCode = 503;
          res.end(JSON.stringify({ success: false, error: { code: 'TRANSACTION_ROUTING_DISABLED', message: 'Transaction routing is disabled' } }));
          return;
        }
        const rawBody = await readRawBody(req);
        let body;
        try {
          body = JSON.parse(rawBody || '{}');
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } }));
          return;
        }
        try {
          const storeId = await resolveAuthorizedStore({ principal, requestedStoreId: body.storeId });
          delete body.storeId;
          const result = await createTransactionCommand({
            pool,
            backofficeClient: transactionBackofficeClient,
            storeId,
            body,
            idempotencyKey: req.headers['idempotency-key'],
            requestId: req.headers['x-request-id'] || undefined,
          });
          await writeAudit({ poolOrClient: pool, principal, action: 'TRANSACTION_CREATED', targetType: 'transaction', targetId: result.transaction?.id || result.transaction?.reference, after: { storeId, status: result.transaction?.status || null }, requestId: req.headers['x-request-id'] || null });
          res.statusCode = result.idempotentReplay ? 200 : 201;
          res.end(JSON.stringify({ success: true, idempotentReplay: result.idempotentReplay, transaction: result.transaction }));
        } catch (error) {
          const statusCode = error.statusCode || (error.code === 'INTEGRATION_DISABLED' ? 503 : 400);
          res.statusCode = statusCode;
          res.end(JSON.stringify({ success: false, error: { code: error.code || 'TRANSACTION_COMMAND_FAILED', message: error.message } }));
        }
        return;
      }

      // ── PHASE 4: transaction status ─────────────────────────────────
      const transactionStatusRoute = requestPath.match(/^\/api\/v1\/transactions\/([^/]+)(?:\/payment)?$/);
      if (req.method === 'GET' && transactionStatusRoute) {
        try {
          const reference = decodeURIComponent(transactionStatusRoute[1]);
          if (backofficeConfig.transactionQueryRoutingEnabled) {
            const transaction = await getTransactionStatus({
              backofficeClient: transactionBackofficeClient,
              storeId: principal.storeId,
              reference,
              requestId: req.headers['x-request-id'] || undefined,
            });
            await assertStoreAccess({ pool, principal, storeId: transaction.storeId });
            await writeAudit({ poolOrClient: pool, principal, action: 'TRANSACTION_STATUS_QUERIED', targetType: 'transaction', targetId: transaction.id || transaction.reference, requestId: req.headers['x-request-id'] || null });
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, transaction }));
            return;
          }
          const transaction = await getTransaction({ pool, reference });
          await assertStoreAccess({ pool, principal, storeId: transaction.storeId });
          await writeAudit({ poolOrClient: pool, principal, action: 'TRANSACTION_VIEWED', targetType: 'transaction', targetId: transaction.id, requestId: req.headers['x-request-id'] || null });
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, transaction }));
        } catch (error) {
          res.statusCode = error.statusCode || 500;
          res.end(JSON.stringify({ success: false, error: { code: error.code || 'TRANSACTION_READ_FAILED', message: error.message } }));
        }
        return;
      }

      // ── DEVELOPER API: 15. POST /api/v1/payments/qr ──────────────────
      if (req.method === 'POST' && (url === '/api/v1/payments/qr' || url.startsWith('/api/v1/payments/qr?'))) {
        assertRole(principal, ['merchant']);
        await enforcePrincipalRateLimit({ principal, requestPath: '/api/v1/payments/qr', limit: 30, windowSeconds: 60 });
        if (backofficeConfig.transactionRoutingEnabled) {
          res.statusCode = 410;
          res.end(JSON.stringify({ success: false, error: { code: 'PAYMENT_OWNERSHIP_MOVED', message: 'Payment creation is owned by Backoffice transaction routing' } }));
          return;
        }
        const body = await parseJsonBody(req);
        const {
          amount,
          channel = 'promptpay',
          orderId,
          customerName = 'ลูกค้าหน้าร้าน',
          customerPhone = null,
          note = 'สร้าง QR ชำระเงินผ่าน Developer API',
          promptPayId: customPromptPay,
          tableName = 'คิดเงินหน้าร้าน'
        } = body;

        const parsedAmount = parseFloat(amount) || 0;
        const id = crypto.randomUUID();
        const reference = orderId || `TXN-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

        // 1. Resolve store & PromptPay recipient
        const targetStoreId = await resolveAuthorizedStore({ principal, requestedStoreId: body.storeId });
        const storeRes = await pool.query('SELECT id, name, phone, "qrSettings", "webhookUrl", "webhookSecret" FROM "Store" WHERE id = $1;', [targetStoreId]);
        const store = storeRes.rows[0];
        const targetPromptPay = customPromptPay || store?.phone || (store?.qrSettings && store.qrSettings.promptPayId) || '0823456789';

        // 2. Generate standard EMVCo PromptPay QR string & base64 image
        const emvcoPayload = generatePromptPayPayload(targetPromptPay, parsedAmount);
        const qrDataUrl = await QRCode.toDataURL(emvcoPayload, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 320,
          color: { dark: '#0f172a', light: '#ffffff' }
        });

        // 3. Insert real pending Transaction in PostgreSQL
        await pool.query(
          `INSERT INTO "Transaction" (
            id, reference, amount, fee, "netAmount", channel, status,
            "storeId", currency, "kitchenStatus", origin,
            "paymentMethod", "paymentMethodLabel", "customerName", "customerPhone",
            "tableName", note, "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11,
            $12, $13, $14, $15,
            $16, $17, NOW(), NOW()
          );`,
          [
            id,
            reference,
            parsedAmount,
            0,
            parsedAmount,
            channel,
            'pending',
            targetStoreId,
            'THB',
            'NONE',
            'API_DEVELOPER',
            'PromptPay พร้อมเพย์ QR',
            'PromptPay พร้อมเพย์ QR',
            customerName,
            customerPhone,
            tableName,
            note
          ]
        );

        // 4. Log in WebhookEventLog for Developer Console Live Stream
        await pool.query(
          `INSERT INTO "WebhookEventLog" (
            id, "storeId", "eventType", status, "payloadJson", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          ON CONFLICT DO NOTHING;`,
          [
            crypto.randomUUID(),
            targetStoreId,
            'payment.created',
            'DELIVERED',
            JSON.stringify({
              event: 'payment.created',
              reference,
              amount: parsedAmount,
              channel,
              createdAt: new Date().toISOString()
            })
          ]
        ).catch(() => {});

        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          reference,
          amount: parsedAmount,
          currency: 'THB',
          channel,
          qrCodeUrl: qrDataUrl,
          qrRawText: emvcoPayload,
          status: 'pending',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          merchantPromptPayId: targetPromptPay
        }));
        return;
      }

      // ── DEVELOPER API: 16. GET /api/v1/payments/:reference ────────────
      if (req.method === 'GET' && url.startsWith('/api/v1/payments/')) {
        const ref = decodeURIComponent(url.replace('/api/v1/payments/', '').split('?')[0]);
        const txnRes = await pool.query(
          `SELECT t.*, s.name as store_name FROM "Transaction" t LEFT JOIN "Store" s ON t."storeId" = s.id WHERE t.reference = $1 OR t.id = $1 LIMIT 1;`,
          [ref]
        );
        if (txnRes.rows.length === 0) {
          res.statusCode = 404;
          res.end(JSON.stringify({ success: false, error: 'Transaction reference not found' }));
          return;
        }
        const txn = txnRes.rows[0];
        await assertStoreAccess({ pool, principal, storeId: txn.storeId });
        await writeAudit({ poolOrClient: pool, principal, action: 'PAYMENT_VIEWED', targetType: 'transaction', targetId: txn.id, requestId: req.headers['x-request-id'] || null });
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          reference: txn.reference,
          status: txn.status,
          amount: parseFloat(txn.amount),
          currency: txn.currency || 'THB',
          channel: txn.channel,
          customerName: txn.customerName,
          paidAt: txn.paidAt,
          createdAt: txn.createdAt,
          storeName: txn.store_name
        }));
        return;
      }

      // ── DEVELOPER API: 17. POST /api/v1/payments/confirm ──────────────
      if (req.method === 'POST' && (url === '/api/v1/payments/confirm' || url.startsWith('/api/v1/payments/confirm?') || url.includes('/confirm'))) {
        assertRole(principal, ['merchant']);
        await enforcePrincipalRateLimit({ principal, requestPath: '/api/v1/payments/confirm', limit: 30, windowSeconds: 60 });
        if (backofficeConfig.transactionRoutingEnabled) {
          res.statusCode = 410;
          res.end(JSON.stringify({ success: false, error: { code: 'PAYMENT_OWNERSHIP_MOVED', message: 'Payment confirmation is owned by LLGW webhook events' } }));
          return;
        }
        const body = await parseJsonBody(req);
        const ref = body.reference || decodeURIComponent(url.replace('/api/v1/payments/', '').replace('/confirm', '').split('?')[0]);
        const existingTxn = await pool.query(
          'SELECT id, "storeId" FROM "Transaction" WHERE reference = $1 OR id = $1 LIMIT 1',
          [ref]
        );
        if (existingTxn.rowCount === 0) {
          res.statusCode = 404;
          res.end(JSON.stringify({ success: false, error: 'Transaction not found to confirm' }));
          return;
        }
        await assertStoreAccess({ pool, principal, storeId: existingTxn.rows[0].storeId });

        const updateRes = await pool.query(
          `UPDATE "Transaction" 
           SET status = 'completed', "paidAt" = NOW(), "updatedAt" = NOW() 
           WHERE (reference = $1 OR id = $1) AND "storeId" = $2
           RETURNING *;`,
          [ref, existingTxn.rows[0].storeId]
        );

        if (updateRes.rows.length === 0) {
          res.statusCode = 404;
          res.end(JSON.stringify({ success: false, error: 'Transaction not found to confirm' }));
          return;
        }

        const txn = updateRes.rows[0];
        await writeAudit({ poolOrClient: pool, principal, action: 'PAYMENT_STATUS_UPDATED', targetType: 'transaction', targetId: txn.id, after: { status: txn.status }, requestId: req.headers['x-request-id'] || null });

        // Log event in WebhookEventLog
        await pool.query(
          `INSERT INTO "WebhookEventLog" (
            id, "storeId", "eventType", status, "payloadJson", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          ON CONFLICT DO NOTHING;`,
          [
            crypto.randomUUID(),
            txn.storeId,
            'payment.success',
            'DELIVERED',
            JSON.stringify({
              event: 'payment.success',
              reference: txn.reference,
              amount: parseFloat(txn.amount),
              channel: txn.channel,
              paidAt: txn.paidAt
            })
          ]
        ).catch(() => {});

        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          reference: txn.reference,
          status: 'completed',
          amount: parseFloat(txn.amount),
          paidAt: txn.paidAt
        }));
        return;
      }

      // ── DEVELOPER API: 18. GET /api/v1/balance ─────────────────────────
      if (req.method === 'GET' && (url === '/api/v1/balance' || url.startsWith('/api/v1/balance?'))) {
        assertRole(principal, ['merchant']);
        const storeId = await resolveAuthorizedStore({ principal, requestedStoreId: new URL(`http://127.0.0.1${url}`).searchParams.get('storeId') });
        const statsRes = await pool.query(
          `SELECT COALESCE(SUM(amount), 0) as total_balance, COUNT(id) as txns_count FROM "Transaction" WHERE status = 'completed' AND "storeId" = $1;`,
          [storeId]
        );
        const stat = statsRes.rows[0];
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          balance: parseFloat(stat.total_balance) || 0,
          currency: 'THB',
          txnCount: parseInt(stat.txns_count, 10) || 0,
          monthlyGmv: parseFloat(stat.total_balance) || 0
        }));
        return;
      }

      // ── DEVELOPER API: 19. POST /api/v1/auth ───────────────────────────
      if (req.method === 'POST' && (url === '/api/v1/auth' || url.startsWith('/api/v1/auth?'))) {
        res.statusCode = 410;
        res.end(JSON.stringify({ success: false, error: { code: 'API_TOKEN_DEPRECATED', message: 'Use the authenticated server session; browser API token generation is disabled' } }));
        return;
      }

      // ── DEVELOPER API: 20. POST /api/v1/payouts ────────────────────────
      if (req.method === 'POST' && (url === '/api/v1/payouts' || url.startsWith('/api/v1/payouts?'))) {
        assertRole(principal, ['merchant']);
        const body = await parseJsonBody(req);
        const payoutId = `PO-${Date.now().toString().slice(-8)}`;
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          payoutId,
          reference: `REF-${payoutId}`,
          amount: body.amount || 0,
          status: 'processing',
          createdAt: new Date().toISOString()
        }));
        return;
      }

      // ── DEVELOPER API: 21. GET /api/v1/developer/logs ──────────────────
      if (req.method === 'GET' && (url === '/api/v1/developer/logs' || url.startsWith('/api/v1/developer/logs?'))) {
        const logsRes = await pool.query(
          `SELECT 
            id, 
            "eventType" as event, 
            status, 
            "payloadJson" as payload, 
            "createdAt" as timestamp 
           FROM "WebhookEventLog" 
           ORDER BY "createdAt" DESC 
           LIMIT 25;`
        ).catch(() => ({ rows: [] }));

        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, logs: logsRes.rows }));
        return;
      }

      // 404 for unknown endpoint
      res.statusCode = 404;
      res.end(JSON.stringify({ success: false, error: `Endpoint ${url} not found` }));
      return;
    } catch (err) {
      metrics.errors += 1;
      if (err.code === 'RATE_LIMITED') metrics.rateLimited += 1;
      console.error('[Server DB API Error]:', err.message);
      res.statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500;
      res.end(JSON.stringify({
        success: false,
        code: err.code || 'INTERNAL_ERROR',
        error: err.message,
      }));
      return;
    }
  }

  // Serve static dist files
  let safePath = path.normalize(url.split('?')[0]);
  if (safePath === '/' || safePath === '') {
    safePath = '/index.html';
  }

  let filePath = path.join(__dirname, 'dist', safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(__dirname, 'dist', 'index.html');
    }

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Error loading ' + safePath);
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(port, () => {
  console.log(`🚀 ChatPOS Production Server running at http://localhost:${port}`);
  console.log(`📍 Database configured: ${configuredDatabaseName}`);
});

const settlementRetryInterval = setInterval(() => {
  retryPendingSettlementEvents({
    pool,
    config: {
      enabled: backofficeConfig.commissionEventEnabled,
      sourceUrl: backofficeConfig.commissionEventSourceUrl,
      webhookSecret: backofficeConfig.commissionWebhookSecret,
      grossBenefitField: backofficeConfig.commissionGrossBenefitField,
      maxAttempts: Number(process.env.SETTLEMENT_MAX_ATTEMPTS || 8),
    },
  }).catch((error) => console.error('[Settlement Retry Error]:', error.message));
}, Number(process.env.SETTLEMENT_RETRY_INTERVAL_MS || 30000));
settlementRetryInterval.unref();

const crypto = require('crypto');

const SESSION_COOKIE = 'chatpos_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const ROLE_ALIASES = new Map([['owner', 'merchant']]);
const ROLES = new Set(['merchant', 'agent', 'pd', 'compliance', 'admin']);

class SecurityError extends Error {
  constructor(message, code, statusCode = 401, details = {}) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    this.statusCode = statusCode;
    Object.assign(this, details);
  }
}

function normalizeRole(role) {
  const normalized = ROLE_ALIASES.get(String(role || '').toLowerCase()) || String(role || '').toLowerCase();
  return ROLES.has(normalized) ? normalized : null;
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function createOpaqueToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function parseCookies(headerValue) {
  return String(headerValue || '').split(';').reduce((cookies, part) => {
    const separator = part.indexOf('=');
    if (separator <= 0) return cookies;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function getSessionToken(req) {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE]) return cookies[SESSION_COOKIE];
  const authorization = String(req.headers.authorization || '');
  if (authorization.startsWith('Bearer ')) return authorization.slice(7).trim();
  return null;
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'unknown';
}

function sessionCookie(token, maxAgeSeconds = SESSION_TTL_SECONDS, secure = process.env.NODE_ENV === 'production') {
  const attributes = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}

async function createSession({ pool, user, storeId, req, ttlSeconds = SESSION_TTL_SECONDS }) {
  const role = normalizeRole(user.role);
  if (!role) throw new SecurityError('User role is not allowed', 'ROLE_INVALID', 403);
  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const result = await pool.query(
    `INSERT INTO auth_sessions
      ("tokenHash", "userId", role, "storeId", "expiresAt", "ipHash", "userAgentHash")
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [hashValue(token), user.id, role, storeId || null, expiresAt.toISOString(), hashValue(clientIp(req)), hashValue(req.headers['user-agent'] || '')]
  );
  return { token, expiresAt, sessionId: result.rows[0].id };
}

async function getPrincipal({ pool, req, touch = true }) {
  const token = getSessionToken(req);
  if (!token) throw new SecurityError('Authentication is required', 'AUTH_REQUIRED', 401);
  const result = await pool.query(
    `SELECT s.id, s."userId", s.role, s."storeId", s."expiresAt",
        COALESCE(u.name, aa.name) AS name,
        COALESCE(u.email, aa.email) AS email,
        COALESCE(u.phone, aa.phone) AS phone,
        COALESCE(u."isActive", aa."isActive") AS "isActive"
     FROM auth_sessions s
     LEFT JOIN "User" u ON u.id = s."userId"
     LEFT JOIN "AdminAccount" aa ON aa.id = s."userId" AND s.role = 'admin'
     WHERE s."tokenHash" = $1 AND s."revokedAt" IS NULL AND s."expiresAt" > NOW()
     LIMIT 1`,
    [hashValue(token)]
  );
  if (result.rowCount === 0) throw new SecurityError('Session is invalid or expired', 'SESSION_INVALID', 401);
  const row = result.rows[0];
  if (row.isActive !== true) throw new SecurityError('Account is inactive or missing', 'ACCOUNT_INACTIVE', 403);
  if (touch) {
    await pool.query('UPDATE auth_sessions SET "lastSeenAt" = NOW() WHERE id = $1', [row.id]);
  }
  return {
    sessionId: row.id,
    id: row.userId,
    role: normalizeRole(row.role),
    storeId: row.storeId,
    name: row.name,
    email: row.email,
    phone: row.phone,
  };
}

async function revokeSession({ pool, req }) {
  const token = getSessionToken(req);
  if (!token) return false;
  const result = await pool.query(
    'UPDATE auth_sessions SET "revokedAt" = NOW() WHERE "tokenHash" = $1 AND "revokedAt" IS NULL',
    [hashValue(token)]
  );
  return result.rowCount > 0;
}

function assertRole(principal, allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!roles.includes(principal.role)) {
    throw new SecurityError('This role is not allowed to perform the requested action', 'FORBIDDEN_ROLE', 403);
  }
}

async function assertStoreAccess({ pool, principal, storeId, allowUnscoped = false }) {
  if (!storeId) {
    if (allowUnscoped && ['admin', 'compliance'].includes(principal.role)) return null;
    throw new SecurityError('Store scope is required', 'STORE_SCOPE_REQUIRED', 403);
  }
  if (['admin', 'compliance'].includes(principal.role)) return storeId;
  const result = await pool.query(
    `SELECT s.id
     FROM "Store" s
     LEFT JOIN "Agent" a ON a.id = s."currentAgentId"
     LEFT JOIN "ProvincialDirector" pd ON pd.id = s."currentPdId"
     WHERE s.id = $1 AND (
       ( $2 = 'merchant' AND s."userId" = $3 ) OR
       ( $2 = 'agent' AND a."userId" = $3 ) OR
       ( $2 = 'pd' AND pd."userId" = $3 )
     )
     LIMIT 1`,
    [storeId, principal.role, principal.id]
  );
  if (result.rowCount === 0) throw new SecurityError('Store is outside the actor scope', 'STORE_FORBIDDEN', 403);
  return storeId;
}

async function assertCaseAccess({ pool, principal, caseId }) {
  const result = await pool.query(
    `SELECT c."storeId" FROM merchant_kyc_cases c WHERE c.id = $1 LIMIT 1`,
    [caseId]
  );
  if (result.rowCount === 0) throw new SecurityError('KYC case was not found', 'CASE_NOT_FOUND', 404);
  await assertStoreAccess({ pool, principal, storeId: result.rows[0].storeId });
  return result.rows[0].storeId;
}

async function consumeRateLimit({ pool, bucketKey, limit, windowSeconds }) {
  const result = await pool.query(
    `INSERT INTO security_rate_limit_buckets ("bucketKey", "windowStart", count, "updatedAt")
     VALUES ($1, NOW(), 1, NOW())
     ON CONFLICT ("bucketKey") DO UPDATE
       SET count = CASE
         WHEN security_rate_limit_buckets."windowStart" <= NOW() - ($2 * INTERVAL '1 second') THEN 1
         ELSE security_rate_limit_buckets.count + 1
       END,
       "windowStart" = CASE
         WHEN security_rate_limit_buckets."windowStart" <= NOW() - ($2 * INTERVAL '1 second') THEN NOW()
         ELSE security_rate_limit_buckets."windowStart"
       END,
       "updatedAt" = NOW()
     RETURNING count`,
    [bucketKey, windowSeconds]
  );
  const count = Number(result.rows[0]?.count || 0);
  if (count > limit) {
    throw new SecurityError('Too many requests', 'RATE_LIMITED', 429, { retryAfterSeconds: windowSeconds });
  }
  return { count, remaining: Math.max(0, limit - count) };
}

function redactAuditValue(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 100).map(redactAuditValue);
  if (typeof value !== 'object') return typeof value === 'string' && value.length > 4000 ? `${value.slice(0, 4000)}...[redacted]` : value;
  return Object.entries(value).reduce((result, [key, item]) => {
    if (/password|token|secret|authorization|cookie|privatekey|contentbase64/i.test(key)) {
      result[key] = '[REDACTED]';
    } else if (/account(number)?|taxid|nationalid/i.test(key)) {
      result[key] = item ? `***${String(item).slice(-4)}` : item;
    } else {
      result[key] = redactAuditValue(item);
    }
    return result;
  }, {});
}

async function writeAudit({ poolOrClient, principal = null, actorId = null, actorRole = null, action, targetType, targetId, reason = null, before = null, after = null, requestId = null }) {
  await poolOrClient.query(
    `INSERT INTO audit_logs
      ("actorId", "actorRole", action, "targetType", "targetId", reason, "beforeJson", "afterJson", "requestId", "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, NOW())`,
    [principal?.id || actorId, principal?.role || actorRole, action, targetType, String(targetId), reason, JSON.stringify(redactAuditValue(before)), JSON.stringify(redactAuditValue(after)), requestId]
  );
}

module.exports = {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  SecurityError,
  assertCaseAccess,
  assertRole,
  assertStoreAccess,
  clientIp,
  consumeRateLimit,
  createSession,
  getPrincipal,
  hashValue,
  normalizeRole,
  revokeSession,
  sessionCookie,
  writeAudit,
};

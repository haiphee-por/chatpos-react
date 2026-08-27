const crypto = require('crypto');

const DEFAULT_DOCUMENT_LINK_TTL_SECONDS = 86400;
const MAX_DOCUMENT_LINK_TTL_SECONDS = 31536000;

class DocumentAccessError extends Error {
  constructor(message, code, statusCode = 401) {
    super(message);
    this.name = 'DocumentAccessError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function documentLinkSecret(env = process.env) {
  const secret = String(env.KYC_DOCUMENT_LINK_SECRET || env.SESSION_SECRET || '').trim();
  if (!secret) throw new DocumentAccessError('Document link signing secret is not configured', 'DOCUMENT_LINK_SECRET_MISSING', 503);
  return secret;
}

function signPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('base64url');
}

function createDocumentDownloadToken({ versionId, storeId, ttlSeconds = DEFAULT_DOCUMENT_LINK_TTL_SECONDS, secret = documentLinkSecret(), nowSeconds = Math.floor(Date.now() / 1000) }) {
  const normalizedTtl = Number(ttlSeconds);
  if (!Number.isSafeInteger(normalizedTtl) || normalizedTtl <= 0 || normalizedTtl > MAX_DOCUMENT_LINK_TTL_SECONDS || !Number.isSafeInteger(nowSeconds)) {
    throw new DocumentAccessError('Document link TTL is invalid', 'DOCUMENT_LINK_TTL_INVALID', 500);
  }
  const expiresAt = nowSeconds + normalizedTtl;
  const payload = base64UrlEncode(JSON.stringify({
    versionId: String(versionId),
    storeId: String(storeId),
    issuedAt: nowSeconds,
    expiresAt,
  }));
  return {
    token: `${payload}.${signPayload(payload, secret)}`,
    expiresAt,
  };
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyDocumentDownloadToken(token, { versionId, storeId, secret = documentLinkSecret(), nowSeconds = Math.floor(Date.now() / 1000) }) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1] || !safeEqual(parts[1], signPayload(parts[0], secret))) {
    throw new DocumentAccessError('Document link token is invalid', 'DOCUMENT_LINK_TOKEN_INVALID', 401);
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(parts[0]));
  } catch {
    throw new DocumentAccessError('Document link token is invalid', 'DOCUMENT_LINK_TOKEN_INVALID', 401);
  }
  if (payload.versionId !== String(versionId) || payload.storeId !== String(storeId)) {
    throw new DocumentAccessError('Document link token does not match this document', 'DOCUMENT_LINK_SCOPE_INVALID', 403);
  }
  if (!Number.isSafeInteger(payload.issuedAt) || payload.issuedAt > nowSeconds || !Number.isSafeInteger(payload.expiresAt) || payload.expiresAt <= payload.issuedAt || payload.expiresAt <= nowSeconds) {
    throw new DocumentAccessError('Document link has expired', 'DOCUMENT_LINK_EXPIRED', 410);
  }
  return payload;
}

function createDocumentDownloadUrl({ baseUrl, versionId, storeId, ttlSeconds, secret, nowSeconds }) {
  let parsedBaseUrl;
  try {
    parsedBaseUrl = new URL(String(baseUrl || ''));
  } catch {
    throw new DocumentAccessError('Document link base URL is not configured', 'DOCUMENT_LINK_BASE_URL_INVALID', 503);
  }
  if (!['http:', 'https:'].includes(parsedBaseUrl.protocol) || parsedBaseUrl.username || parsedBaseUrl.password || parsedBaseUrl.search || parsedBaseUrl.hash) {
    throw new DocumentAccessError('Document link base URL is invalid', 'DOCUMENT_LINK_BASE_URL_INVALID', 503);
  }
  const { token, expiresAt } = createDocumentDownloadToken({ versionId, storeId, ttlSeconds, secret, nowSeconds });
  const url = new URL(`/api/v1/kyc/documents/${encodeURIComponent(versionId)}/download`, parsedBaseUrl);
  url.searchParams.set('token', token);
  return { url: url.toString(), expiresAt: new Date(expiresAt * 1000).toISOString() };
}

module.exports = {
  DEFAULT_DOCUMENT_LINK_TTL_SECONDS,
  MAX_DOCUMENT_LINK_TTL_SECONDS,
  DocumentAccessError,
  createDocumentDownloadToken,
  createDocumentDownloadUrl,
  documentLinkSecret,
  verifyDocumentDownloadToken,
};

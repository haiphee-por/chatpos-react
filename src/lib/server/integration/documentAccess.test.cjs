const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createDocumentDownloadToken,
  createDocumentDownloadUrl,
  verifyDocumentDownloadToken,
} = require('./documentAccess.cjs');

const versionId = '10000000-0000-4000-8000-000000000001';
const storeId = '20000000-0000-4000-8000-000000000002';
const secret = 'document-link-test-secret';
const nowSeconds = 1700000000;

test('creates a 24-hour URL bound to the document and Store', () => {
  const result = createDocumentDownloadUrl({
    baseUrl: 'https://merchant.chatpos.biz',
    versionId,
    storeId,
    ttlSeconds: 86400,
    secret,
    nowSeconds,
  });

  assert.equal(result.expiresAt, new Date((nowSeconds + 86400) * 1000).toISOString());
  const url = new URL(result.url);
  assert.equal(url.origin, 'https://merchant.chatpos.biz');
  assert.equal(url.pathname, `/api/v1/kyc/documents/${versionId}/download`);
  assert.deepEqual(verifyDocumentDownloadToken(url.searchParams.get('token'), { versionId, storeId, secret, nowSeconds }), {
    versionId,
    storeId,
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + 86400,
  });
});

test('rejects expired and out-of-scope document tokens', () => {
  const { token } = createDocumentDownloadToken({ versionId, storeId, ttlSeconds: 60, secret, nowSeconds });

  assert.throws(
    () => verifyDocumentDownloadToken(token, { versionId, storeId: '30000000-0000-4000-8000-000000000003', secret, nowSeconds }),
    (error) => error.code === 'DOCUMENT_LINK_SCOPE_INVALID' && error.statusCode === 403
  );
  assert.throws(
    () => verifyDocumentDownloadToken(token, { versionId, storeId, secret, nowSeconds: nowSeconds + 60 }),
    (error) => error.code === 'DOCUMENT_LINK_EXPIRED' && error.statusCode === 410
  );
});

test('rejects invalid TTL and non-web base URLs', () => {
  assert.throws(
    () => createDocumentDownloadToken({ versionId, storeId, ttlSeconds: 31536001, secret, nowSeconds }),
    (error) => error.code === 'DOCUMENT_LINK_TTL_INVALID'
  );
  assert.throws(
    () => createDocumentDownloadUrl({ baseUrl: 'http://user:pass@localhost:3000', versionId, storeId, ttlSeconds: 86400, secret, nowSeconds }),
    (error) => error.code === 'DOCUMENT_LINK_BASE_URL_INVALID'
  );
});

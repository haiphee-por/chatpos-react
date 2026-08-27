const assert = require('node:assert/strict');
const test = require('node:test');
const {
  StoreCredentialError,
  createStoreCredentialResolver,
} = require('./storeBackofficeCredentials.cjs');
const { SignedMerchantApiClient } = require('./signedMerchantClient.cjs');

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';

function credentialRow(storeId, suffix) {
  return {
    storeId,
    environment: 'staging',
    backofficeBaseUrl: `https://backoffice-${suffix}.test`,
    backofficeStoreId: `bo-${suffix}`,
    keyId: `key-${suffix}`,
    bearerSecretRef: `secret:bearer:${suffix}`,
    signingSecretRef: `secret:signing:${suffix}`,
    signingSecretPreviousRef: null,
    callbackSecretRef: `secret:callback:${suffix}`,
    callbackSecretPreviousRef: null,
    status: 'ACTIVE',
  };
}

test('resolves independent credentials for each ChatPOS Store', async () => {
  const rows = new Map([
    [storeA, credentialRow(storeA, 'a')],
    [storeB, credentialRow(storeB, 'b')],
  ]);
  const pool = {
    query: async (_sql, parameters) => ({ rows: rows.has(parameters[0]) ? [rows.get(parameters[0])] : [] }),
  };
  const resolver = createStoreCredentialResolver({
    pool,
    environment: 'staging',
    secretResolver: async (reference) => `resolved-${reference}`,
    fallbackConfig: { enabled: true, timeoutMs: 1000, maxRetries: 0, retryBaseDelayMs: 0, maxRetryDelayMs: 0 },
  });

  const resolvedA = await resolver.resolve(storeA);
  const resolvedB = await resolver.resolve(storeB);

  assert.equal(resolvedA.storeId, 'bo-a');
  assert.equal(resolvedB.storeId, 'bo-b');
  assert.equal(resolvedA.keyId, 'key-a');
  assert.equal(resolvedB.keyId, 'key-b');
  assert.equal(resolvedA.bearerSecret, 'resolved-secret:bearer:a');
  assert.equal(resolvedB.signingSecret, 'resolved-secret:signing:b');
  assert.deepEqual(await resolver.resolveCallbackSecrets(storeA), ['resolved-secret:callback:a']);
});

test('fails closed when a Store has no active credential mapping', async () => {
  const resolver = createStoreCredentialResolver({
    pool: { query: async () => ({ rows: [] }) },
    environment: 'staging',
    fallbackConfig: {
      enabled: true,
      chatposStoreId: storeA,
      storeId: 'backoffice-only-id',
      keyId: 'environment-key-id',
      bearerSecret: 'environment-bearer-secret',
      signingSecret: 'environment-signing-secret',
    },
  });

  await assert.rejects(
    resolver.resolve(storeA),
    (error) => error instanceof StoreCredentialError && error.code === 'STORE_CREDENTIAL_MAPPING_MISSING'
  );
});

test('signed client sends the resolved Key ID and credentials per Store', async () => {
  const rows = new Map([
    [storeA, credentialRow(storeA, 'a')],
    [storeB, credentialRow(storeB, 'b')],
  ]);
  const requests = [];
  const resolver = createStoreCredentialResolver({
    pool: { query: async (_sql, parameters) => ({ rows: rows.has(parameters[0]) ? [rows.get(parameters[0])] : [] }) },
    environment: 'staging',
    secretResolver: async (reference) => `resolved-${reference}`,
    fallbackConfig: {
      enabled: true,
      timeoutMs: 1000,
      maxRetries: 0,
      retryBaseDelayMs: 0,
      maxRetryDelayMs: 0,
      keyIdHeaderName: 'X-ChatPOS-Key-Id',
    },
  });
  const client = new SignedMerchantApiClient({
    config: { enabled: true, timeoutMs: 1000, maxRetries: 0, retryBaseDelayMs: 0, maxRetryDelayMs: 0 },
    credentialResolver: resolver.resolve,
    nowSeconds: () => 1700000000,
    nonceFactory: (() => {
      let index = 0;
      return () => `nonce-store-${index++}-123456`;
    })(),
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        status: 200,
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => '{}',
      };
    },
    logger: { log: () => {} },
  });

  await client.request('/api/v1/assignments/requests', {
    method: 'POST',
    storeId: storeA,
    body: { sourceRequestId: 'source-a' },
    idempotencyKey: 'assignment:a:1',
  });
  await client.request('/api/v1/assignments/requests', {
    method: 'POST',
    storeId: storeB,
    body: { sourceRequestId: 'source-b' },
    idempotencyKey: 'assignment:b:1',
  });

  assert.equal(requests[0].options.headers.Authorization, 'Bearer resolved-secret:bearer:a');
  assert.equal(requests[1].options.headers.Authorization, 'Bearer resolved-secret:bearer:b');
  assert.equal(requests[0].options.headers['X-ChatPOS-Key-Id'], 'key-a');
  assert.equal(requests[1].options.headers['X-ChatPOS-Key-Id'], 'key-b');
  assert.notEqual(requests[0].options.headers['X-ChatPOS-Signature'], requests[1].options.headers['X-ChatPOS-Signature']);
});

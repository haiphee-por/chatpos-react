const assert = require('node:assert/strict');
const test = require('node:test');
const {
  IdempotencyConflictError,
  IdempotencyStore,
  NonceReplayError,
  NonceReplayStore,
  SignedMerchantApiClient,
  buildCanonicalRequest,
  createSignature,
  createSignedRequest,
  createStructuredLogger,
  sha256Hex,
  verifySignedRequest,
} = require('./signedMerchantClient.cjs');

const signingSecret = 'test-signing-secret';
const bearerSecret = 'test-bearer-secret';
const baseUrl = 'https://backoffice.test';

function signedHeaders(signed, idempotencyKey = 'assignment:store-1:1', requestId = 'request-1') {
  return {
    Authorization: `Bearer ${bearerSecret}`,
    'X-ChatPOS-Timestamp': signed.timestamp,
    'X-ChatPOS-Nonce': signed.nonce,
    'X-ChatPOS-Signature': signed.signature,
    'Idempotency-Key': idempotencyKey,
    'X-Request-Id': requestId,
  };
}

function response(status, data, headers = { 'content-type': 'application/json' }) {
  const text = JSON.stringify(data);
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(headers),
    text: async () => text,
    arrayBuffer: async () => Buffer.from(text),
  };
}

test('canonical request sorts query pairs and signs the exact body digest', () => {
  const rawBody = '{"sourceRequestId":"source-1"}';
  const canonical = buildCanonicalRequest({
    method: 'post',
    url: `${baseUrl}/api/v1/assignments/requests?z=last&a=second&a=first`,
    timestamp: 1700000000,
    nonce: 'nonce-1234567890',
    idempotencyKey: 'assignment:store-1:1',
    rawBody,
  });
  const expected = [
    'POST',
    '/api/v1/assignments/requests?a=first&a=second&z=last',
    '1700000000',
    'nonce-1234567890',
    'assignment:store-1:1',
    sha256Hex(rawBody),
  ].join('\n');

  assert.equal(canonical, expected);
  assert.match(createSignature(canonical, signingSecret), /^v1=[0-9a-f]{64}$/);
});

test('rejects a stale timestamp before accepting the signature', () => {
  const signed = createSignedRequest({
    method: 'POST',
    url: `${baseUrl}/api/v1/assignments/requests`,
    rawBody: '{}',
    idempotencyKey: 'assignment:store-1:1',
    signingSecret,
    timestamp: 1700000000,
    nonce: 'nonce-stale-123456',
  });

  assert.throws(
    () => verifySignedRequest({
      method: 'POST',
      url: `${baseUrl}/api/v1/assignments/requests`,
      headers: signedHeaders(signed),
      rawBody: '{}',
      signingSecret,
      bearerSecret,
      nowSeconds: 1700000301,
      nonceStore: new NonceReplayStore({ now: () => 1700000301 }),
      idempotencyStore: new IdempotencyStore(),
      requireIdempotencyKey: true,
    }),
    (error) => error.code === 'STALE_TIMESTAMP'
  );
});

test('rejects a replayed nonce while allowing a first request', () => {
  const signed = createSignedRequest({
    method: 'POST',
    url: `${baseUrl}/api/v1/assignments/requests`,
    rawBody: '{}',
    idempotencyKey: 'assignment:store-1:1',
    signingSecret,
    timestamp: 1700000000,
    nonce: 'nonce-replay-12345',
  });
  const nonceStore = new NonceReplayStore({ now: () => 1700000000 });
  const idempotencyStore = new IdempotencyStore();
  const input = {
    method: 'POST',
    url: `${baseUrl}/api/v1/assignments/requests`,
    headers: signedHeaders(signed),
    rawBody: '{}',
    signingSecret,
    bearerSecret,
    nowSeconds: 1700000000,
    nonceStore,
    idempotencyStore,
    requireIdempotencyKey: true,
  };

  assert.equal(verifySignedRequest(input).idempotentReplay, false);
  assert.throws(() => verifySignedRequest(input), (error) => error instanceof NonceReplayError);
});

test('rejects a changed payload under an existing idempotency key', () => {
  const nonceStore = new NonceReplayStore({ now: () => 1700000000 });
  const idempotencyStore = new IdempotencyStore();
  const firstBody = '{"sourceRequestId":"source-1"}';
  const firstSigned = createSignedRequest({
    method: 'POST',
    url: `${baseUrl}/api/v1/assignments/requests`,
    rawBody: firstBody,
    idempotencyKey: 'assignment:store-1:1',
    signingSecret,
    timestamp: 1700000000,
    nonce: 'nonce-first-123456',
  });
  const secondBody = '{"sourceRequestId":"source-2"}';
  const secondSigned = createSignedRequest({
    method: 'POST',
    url: `${baseUrl}/api/v1/assignments/requests`,
    rawBody: secondBody,
    idempotencyKey: 'assignment:store-1:1',
    signingSecret,
    timestamp: 1700000000,
    nonce: 'nonce-second-12345',
  });
  const baseInput = {
    method: 'POST',
    url: `${baseUrl}/api/v1/assignments/requests`,
    signingSecret,
    bearerSecret,
    nowSeconds: 1700000000,
    nonceStore,
    idempotencyStore,
    requireIdempotencyKey: true,
  };

  verifySignedRequest({
    ...baseInput,
    headers: signedHeaders(firstSigned),
    rawBody: firstBody,
  });
  assert.throws(
    () => verifySignedRequest({
      ...baseInput,
      headers: signedHeaders(secondSigned),
      rawBody: secondBody,
    }),
    (error) => error instanceof IdempotencyConflictError
  );
});

test('retries retryable responses with the same body and idempotency key', async () => {
  const requests = [];
  let now = 1700000000;
  const client = new SignedMerchantApiClient({
    config: {
      baseUrl,
      bearerSecret,
      signingSecret,
      enabled: true,
      timeoutMs: 1000,
      maxRetries: 1,
      retryBaseDelayMs: 0,
      maxRetryDelayMs: 100,
    },
    nowSeconds: () => now++,
    nonceFactory: (() => {
      let index = 0;
      return () => `nonce-retry-${String(index++).padStart(12, '0')}`;
    })(),
    fetchImpl: async (url, options) => {
      requests.push({ url, options: { ...options, headers: { ...options.headers } } });
      return requests.length === 1 ? response(503, { error: 'busy' }) : response(200, { accepted: true });
    },
    sleep: async () => {},
    random: () => 0,
    logger: { log: () => {} },
  });

  const result = await client.request('/api/v1/assignments/requests', {
    method: 'POST',
    body: { sourceRequestId: 'source-1' },
    idempotencyKey: 'assignment:store-1:1',
    requestId: 'request-1',
    sourceRequestId: 'source-1',
    headers: {
      Authorization: 'Bearer attacker-value',
      'X-ChatPOS-Signature': 'v1=attacker-value',
    },
  });

  assert.equal(result.status, 200);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.body, requests[1].options.body);
  assert.equal(JSON.parse(requests[0].options.body).sourceRequestId, 'source-1');
  assert.equal(requests[0].options.headers['Idempotency-Key'], requests[1].options.headers['Idempotency-Key']);
  assert.equal(requests[0].options.headers.Authorization, `Bearer ${bearerSecret}`);
  assert.match(requests[0].options.headers['X-ChatPOS-Signature'], /^v1=[0-9a-f]{64}$/);
  assert.notEqual(requests[0].options.headers['X-ChatPOS-Nonce'], requests[1].options.headers['X-ChatPOS-Nonce']);
  assert.notEqual(requests[0].options.headers['X-ChatPOS-Timestamp'], requests[1].options.headers['X-ChatPOS-Timestamp']);
  assert.equal(requests[0].options.headers['X-Request-Id'], requests[1].options.headers['X-Request-Id']);
  assert.equal(requests[0].options.headers['X-Request-Id'], 'request-1');
});

test('redacts secrets, PII, raw body and full signature from structured logs', () => {
  const output = [];
  const logger = createStructuredLogger({ info: (line) => output.push(line), log: (line) => output.push(line) });
  logger.log('info', 'test_event', {
    rawBody: '{"phone":"0812345678"}',
    authorization: 'Bearer secret',
    phone: '0812345678',
    signature: 'v1=1234567890123456789012345678901234567890123456789012345678901234',
    bodyDigest: 'digest-is-allowed',
  });
  const line = output[0];

  assert.doesNotMatch(line, /secret|0812345678|\{"phone/);
  assert.doesNotMatch(line, /v1=1234567890123456789012345678901234567890123456789012345678901234/);
  assert.match(line, /digest-is-allowed/);
});

// Reads bearer + signing secret from local .env and calls PD Backoffice /api/v1/transactions directly.
require('dotenv').config({ path: '.env' });

const crypto = require('crypto');

const baseUrl = 'https://member.chatpos.biz';
const path = '/api/v1/transactions';
const bearer = process.env.CHATPOS_BACKOFFICE_BEARER_SECRET;
const signingSecret = process.env.CHATPOS_BACKOFFICE_SIGNING_SECRET;

if (!bearer || !signingSecret) {
  console.error('missing CHATPOS_BACKOFFICE_BEARER_SECRET or CHATPOS_BACKOFFICE_SIGNING_SECRET in .env');
  process.exit(1);
}

const clientReference = `PROBE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const idempotencyKey = `probe:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

const body = JSON.stringify({
  schemaVersion: 'transaction.command.v1',
  amount: '10.00',
  currency: 'THB',
  channel: 'promptpay',
  clientReference,
  customerName: 'Probe Tester',
  customerPhone: '0800000000',
  description: `probe ${clientReference}`,
});

const timestamp = String(Math.floor(Date.now() / 1000));
const nonce = crypto.randomBytes(24).toString('base64url'); // 32-char, matches 16-128 base64url regex
const bodyDigest = crypto.createHash('sha256').update(body).digest('hex');

const canonical = ['POST', path, timestamp, nonce, idempotencyKey, bodyDigest].join('\n');
const signature = 'v1=' + crypto.createHmac('sha256', signingSecret).update(canonical).digest('hex');

console.log('---- request ----');
console.log('url:', baseUrl + path);
console.log('idempotencyKey:', idempotencyKey);
console.log('clientReference:', clientReference);
console.log('bodyDigest:', bodyDigest);
console.log('canonical:');
console.log(canonical);
console.log('signature:', signature);

const startedAt = Date.now();

fetch(baseUrl + path, {
  method: 'POST',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${bearer}`,
    'Idempotency-Key': idempotencyKey,
    'X-ChatPOS-Timestamp': timestamp,
    'X-ChatPOS-Nonce': nonce,
    'X-ChatPOS-Signature': signature,
    'X-Request-Id': crypto.randomUUID(),
  },
  body,
})
  .then(async (response) => {
    const elapsed = Date.now() - startedAt;
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    console.log('---- response ----');
    console.log('status:', response.status);
    console.log('elapsed:', elapsed + 'ms');
    console.log('cf-ray:', response.headers.get('cf-ray'));
    console.log('server:', response.headers.get('server'));
    console.log('server-timing:', response.headers.get('server-timing'));
    console.log('content-type:', contentType);
    if (contentType.includes('application/json')) {
      try {
        console.log('body:', JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        console.log('body(raw):', text.slice(0, 2000));
      }
    } else {
      console.log('body(raw):', text.slice(0, 2000));
    }
  })
  .catch((err) => {
    console.error('fetch error:', err.message);
    process.exitCode = 1;
  });
